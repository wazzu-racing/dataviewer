<script lang="ts">
	import { browser } from '$app/environment';
	import {
		type LayoutNode,
		type FloatingPaneState,
		type PaneWidgetType,
		type DropPosition,
		type SavedLayout
	} from '$lib/types';
	import {
		ensureIds,
		insertPane,
		removePane,
		findNode,
		updateConfig,
		movePane,
		swapPanes,
		generateUUID
	} from '$lib/layoutUtils';
	import {
		migrateExistingLayout,
		loadActiveLayout,
		saveLayout as saveLayoutToStore,
		updateLayout as updateLayoutInStore,
		getAllLayouts,
		getLayout,
		setActiveLayout,
		deleteLayout as deleteLayoutFromStore,
		renameLayout as renameLayoutInStore,
		duplicateLayout as duplicateLayoutInStore,
		updateChildWindowState
	} from '$lib/stores/layoutStore';
	import { deserializeLayout, generateShareUrl } from '$lib/shareUtils';
	import { parseBinaryBuffer } from '$lib/dataParser';
	import { saveWazzuFile, convertBinToWazzu, downloadBlob } from '$lib/fileFormat';
	import { data as globalData } from '$lib/data.svelte';
	import { consumeLiveSerialBytes } from '$lib/liveConnection';
	import { appendLiveTelemetry, replaceSession, startLiveSession } from '$lib/liveSession';
	import { selectedIndex, setIndex } from '$lib/stores/time';
	import {
		createChildBridge,
		createMasterBridge,
		type ChildBridge,
		type MasterBridge
	} from '$lib/windowBridge';
	import { setMasterBridge, getMasterBridge } from '$lib/windowBridgeRegistry';
	import type { Command, DataLine, SessionMetadata } from '$lib/types';
	import { onDestroy } from 'svelte';
	import { fade } from 'svelte/transition';
	import PaneLayout from '$lib/components/PaneLayout.svelte';
	import PaneToolbar from '$lib/components/PaneToolbar.svelte';
	import FloatingPane from '$lib/components/FloatingPane.svelte';
	import LoadDataModal from '$lib/components/LoadDataModal.svelte';
	import SaveLayoutModal from '$lib/components/SaveLayoutModal.svelte';
	import ManageLayoutsModal from '$lib/components/ManageLayoutsModal.svelte';
	import TopBar from '$lib/components/TopBar.svelte';
	import CommandPalette from '$lib/components/CommandPalette.svelte';
	import FullscreenOverlay from '$lib/components/FullscreenOverlay.svelte';

	// ---------------------------------------------------------------------------
	// Early message listener for child windows (captures data sent immediately
	// after window.open, before the full Svelte app and proper bridge listener
	// are ready). This dramatically reduces the "no data" wait time.
	// ---------------------------------------------------------------------------
	let __earlyTelemetry: { telemetry: DataLine[]; metadata: SessionMetadata } | null = null;
	let __earlyDataUrl: string | null = null;

	if (browser) {
		const isPotentialChild = window.opener != null;
		if (isPotentialChild) {
			const earlyHandler = (event: MessageEvent) => {
				if (event.origin !== window.location.origin) return;
				const d = event.data;
				if (!d || d.protocol !== 'wr-dataviewer' || d.version !== 1) return;

				if (d.kind === 'telemetry:replace' || d.kind === 'init') {
					const tel = d.kind === 'init' ? d.session?.telemetry : d.telemetry;
					const meta = d.kind === 'init' ? d.session?.metadata : d.metadata;
					if (tel) {
						__earlyTelemetry = { telemetry: tel, metadata: meta };
						window.removeEventListener('message', earlyHandler);
					}
				} else if (d.kind === 'telemetry:replace-url') {
					__earlyDataUrl = d.url;
					window.removeEventListener('message', earlyHandler);
				}
			};
			window.addEventListener('message', earlyHandler);
		}
	}

	/**
	 * Consume any data captured by the ultra-early listener.
	 * Called as early as possible so the first widgets that mount see real data.
	 */
	function consumeEarlyDataIfPresent() {
		if (!browser) return;

		if (__earlyTelemetry) {
			replaceSession(__earlyTelemetry.telemetry, __earlyTelemetry.metadata);
			__earlyTelemetry = null;
			dataSyncInProgress = false;
			if (document?.documentElement) {
				delete document.documentElement.dataset.dataSync;
			}
			return true;
		}

		if (__earlyDataUrl) {
			// Async path for large data via Blob URL.
			// Start the fetch immediately so it overlaps with the rest of boot.
			dataSyncInProgress = true;
			fetch(__earlyDataUrl)
				.then((r) => r.json())
				.then((telemetry: DataLine[]) => {
					replaceSession(telemetry, {
						name: 'Child Session',
						version: '1.0',
						driver: '',
						location: '',
						datetime: '',
						conditions: '',
						files: { telemetry: 'data.csv' }
					} as any);
					dataSyncInProgress = false;
					if (document?.documentElement) delete document.documentElement.dataset.dataSync;
				})
				.catch(console.error)
				.finally(() => {
					try {
						URL.revokeObjectURL(__earlyDataUrl!);
					} catch {}
					__earlyDataUrl = null;
				});
			return true;
		}
		return false;
	}

	// Default dimensions for a newly popped-out floating pane
	const DEFAULT_FLOAT_WIDTH = 480;
	const DEFAULT_FLOAT_HEIGHT = 340;

	let serialBuffer: number[] = [];
	let activeSerialPort: SerialPort | null = null;
	let serialReadActive = false;
	let lastLiveWriteMillis: number | null = null;

	const SERIAL_DEBUG = false;

	// ---------------------------------------------------------------------------
	// Default layout — shown the first time (no saved state)
	// ---------------------------------------------------------------------------
	function defaultLayout(): LayoutNode {
		return ensureIds({ id: '', type: 'graph' });
	}

	// ---------------------------------------------------------------------------
	// Data export / conversion handlers
	// ---------------------------------------------------------------------------

	async function handleExportWazzu() {
		if (globalData.lines.length === 0) {
			alert('No data to export.');
			return;
		}

		const metadata = $state.snapshot(globalData.metadata);
		const blob = await saveWazzuFile(globalData.lines, metadata);
		downloadBlob(blob, `${metadata.name.replace(/\s+/g, '_')}.wazzuracing`);
	}

	async function handleConvertBin() {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.bin';
		input.onchange = async (e: Event) => {
			const file = (e.target as HTMLInputElement).files?.[0];
			if (!file) return;

			const buffer = await file.arrayBuffer();
			const currentMetadata = $state.snapshot(globalData.metadata);
			const newName = file.name.replace('.bin', '');

			// Update global metadata with the new name from the file
			globalData.metadata.name = newName;

			const blob = await convertBinToWazzu(
				buffer,
				newName,
				currentMetadata.driver,
				currentMetadata.location,
				new Date().toISOString()
			);

			downloadBlob(blob, `${file.name.replace('.bin', '')}.wazzuracing`);
		};
		input.click();
	}

	async function handleConnectToCar() {
		if (isChild) {
			alert('Live telemetry connection is only available in the main window.');
			return;
		}
		if (SERIAL_DEBUG) console.log('[SerialDebug] handleConnectToCar called');
		if (!browser || !('serial' in navigator) || !navigator.serial) {
			if (SERIAL_DEBUG) console.warn('[SerialDebug] Browser does not support WebSerial');
			alert('Connection to car is not supported. Use a different browser (chromium)');
			return;
		}

		const usbVendorId = 0x239a;

		try {
			if (SERIAL_DEBUG)
				console.log(
					'[SerialDebug] Opening port picker (usbVendorId=0x' + usbVendorId.toString(16) + ')...'
				);
			const port = await navigator.serial.requestPort({ filters: [{ usbVendorId }] });
			if (SERIAL_DEBUG) console.log('[SerialDebug] Port selected:', port);
			await disconnectSerialPort();

			if (SERIAL_DEBUG) console.log('[SerialDebug] Starting live session');
			startLiveSession();
			showLoadDataModal = false;
			if (SERIAL_DEBUG) console.log('[SerialDebug] Storing reference to selected port.');
			activeSerialPort = port;
			if (SERIAL_DEBUG) console.log('[SerialDebug] Resetting serialBuffer and lastLiveWriteMillis');
			serialBuffer = [];
			lastLiveWriteMillis = null;

			if (SERIAL_DEBUG) console.log('[SerialDebug] Beginning to read from serial port...');
			await readDataFromSerial(port);
		} catch (error) {
			console.error('[SerialDebug] Serial connection error:', error);
			if (error instanceof DOMException && error.name === 'NotFoundError') {
				alert('Please select the receiver from the list of devices.');
				return;
			}

			const message = error instanceof Error ? error.message : 'Unknown connection error';
			alert(`Failed to connect to car: ${message}`);
		}
	}

	async function readDataFromSerial(port: SerialPort) {
		if (SERIAL_DEBUG) console.log('[SerialDebug] readDataFromSerial called', port);
		// TRANSMITTER VERIFIED: 9600 baud, 212-byte frames (.wr format), 3 newlines (\n\n\n = [10, 10, 10])
		if (SERIAL_DEBUG) console.log('[SerialDebug] Opening serial port at 9600 baud...');
		await port.open({ baudRate: 9600 });
		if (SERIAL_DEBUG) console.log('[SerialDebug] Port opened successfully!');
		serialReadActive = true;

		try {
			if (SERIAL_DEBUG) console.log('[SerialDebug] Entering main serial read loop...');
			while (serialReadActive && port.readable) {
				const reader = port.readable.getReader();
				try {
					if (SERIAL_DEBUG) console.log('[SerialDebug] Acquired reader, starting chunked read...');
					while (serialReadActive) {
						const { value, done } = await reader.read();
						if (value) {
							if (SERIAL_DEBUG)
								console.log('[SerialDebug] Serial chunk received, length:', value.length, value);
						}
						if (done) break;
						if (!value) continue;

						const result = consumeLiveSerialBytes(serialBuffer, value);
						if (SERIAL_DEBUG)
							console.log(
								'[SerialDebug] consumeLiveSerialBytes lines:',
								result.lines.length,
								'remainder:',
								result.remainder.length
							);
						serialBuffer = result.remainder;

						const nextLines = result.lines.filter((line) => {
							if (lastLiveWriteMillis !== null) {
								// Standard deduplication: strictly increasing millis
								if (line.write_millis <= lastLiveWriteMillis) {
									return false;
								}
							}
							lastLiveWriteMillis = line.write_millis;
							return true;
						});

						if (nextLines.length > 0) {
							if (SERIAL_DEBUG)
								console.log('[SerialDebug] Appending live telemetry:', nextLines.length, nextLines);
							appendLiveTelemetry(nextLines);
						}
					}
				} finally {
					if (SERIAL_DEBUG) console.log('[SerialDebug] Released serial reader lock.');
					reader.releaseLock();
				}
			}
		} catch (error) {
			console.error('[SerialDebug] Serial read failed:', error);
			const message = error instanceof Error ? error.message : 'Unknown serial read error';
			alert(`Lost connection to car: ${message}`);
		} finally {
			await disconnectSerialPort();
		}
	}

	async function disconnectSerialPort() {
		serialReadActive = false;
		serialBuffer = [];
		lastLiveWriteMillis = null;

		if (!activeSerialPort) return;

		const port = activeSerialPort;
		activeSerialPort = null;

		try {
			if (port.readable || port.writable) {
				await port.close();
			}
		} catch (error) {
			console.error('Failed to close serial port:', error);
		}
	}

	onDestroy(() => {
		void disconnectSerialPort();
		if (childLayoutSaveDebounceTimer !== null) {
			clearTimeout(childLayoutSaveDebounceTimer);
			childLayoutSaveDebounceTimer = null;
		}
	});

	// --- Add new pane at reasonable location on click ---
	function handleAddPane(type: PaneWidgetType) {
		// Always add a pane, preserving existing panes (even if only one exists)
		layout = ensureIds(insertPane(layout, layout.id, type, 'right'));
	}

	// ---------------------------------------------------------------------------
	// Window handling
	// ---------------------------------------------------------------------------

	let isChild: boolean = false;
	let childWindow: Window | null = null;
	let masterBridge: MasterBridge | null = null;
	let childBridge: ChildBridge | null = null;
	let childInitialized = false;
	let dataSyncInProgress = $state(false);

	// Reflect syncing state globally so individual widgets can show appropriate empty-state text
	// without prop drilling.
	$effect(() => {
		if (!browser || !isChild) return;
		if (dataSyncInProgress) {
			document.documentElement.dataset.dataSync = 'in-progress';
		} else {
			delete document.documentElement.dataset.dataSync;
		}
	});
	let childLayoutSaveDebounceTimer: number | null = null;

	// Always prompt for data on every page load in master — telemetry is never persisted across sessions.
	let showLoadDataModal: boolean = $state(true);

	setIsChild();

	// Consume early data as soon as we know we're a child.
	// This runs very early so the first widgets that mount see real telemetry.
	if (isChild) {
		consumeEarlyDataIfPresent();
	}

	function setIsChild(): void {
		if (!browser) return;
		isChild = window.opener != null;
		if (isChild) {
			showLoadDataModal = false;
		}
	}

	/**
	 * Lazily ensure the master bridge exists.
	 * The $effect below will still run for cleanup, but user actions (e.g. "Open Child Window"
	 * from the command palette) can happen before effects run, so we create on demand.
	 */
	function ensureMasterBridge(): MasterBridge | null {
		if (masterBridge) return masterBridge;
		if (!browser || isChild) return null;

		const bridge = createMasterBridge({
			onChildHello: () => {
				if (!bridge.hasChild()) return;
				const active = activeLayoutId ? getLayout(activeLayoutId, false) : null;
				const childState = active?.child ?? defaultWindowLayoutState();
				bridge.sendInit(
					$state.snapshot(globalData.lines),
					$state.snapshot(globalData.metadata),
					structuredClone(childState)
				);
			},
			onChildLayoutUpdate: (state) => {
				queuePersistChildState(state);
			},
			onRequestTelemetry: () => {
				if (globalData.lines.length > 0) {
					bridge.sendFullTelemetry(
						$state.snapshot(globalData.lines),
						$state.snapshot(globalData.metadata)
					);
				}
			}
		});

		masterBridge = bridge;
		setMasterBridge(bridge);
		bridge.setChildWindow(childWindow);
		return bridge;
	}

	function defaultWindowLayoutState(): { layout: LayoutNode; floatingPanes: FloatingPaneState[] } {
		return { layout: defaultLayout(), floatingPanes: [] };
	}

	function ensureChildWindow(): Window | null {
		if (!browser || isChild) return null;
		if (childWindow && !childWindow.closed) {
			childWindow.focus();
			return childWindow;
		}
		const opened = window.open('/dataviewer', '', 'popup=true');
		childWindow = opened;
		masterBridge?.setChildWindow(opened);
		return opened;
	}

	function closeChildWindow(): void {
		if (!browser) return;
		if (childWindow && !childWindow.closed) {
			childWindow.close();
		}
		childWindow = null;
		// Use whatever bridge we have (may have been created on demand)
		(masterBridge ?? getMasterBridge())?.setChildWindow(null);
	}

	function queuePersistChildState(state: {
		layout: LayoutNode;
		floatingPanes: FloatingPaneState[];
	}) {
		if (!browser || isChild || !activeLayoutId) return;
		const layoutId = activeLayoutId;
		const payload = {
			layout: structuredClone(state.layout),
			floatingPanes: structuredClone(state.floatingPanes)
		};

		if (childLayoutSaveDebounceTimer !== null) {
			clearTimeout(childLayoutSaveDebounceTimer);
		}

		childLayoutSaveDebounceTimer = window.setTimeout(() => {
			updateChildWindowState(layoutId, { childEnabled: true, child: payload });
			childLayoutSaveDebounceTimer = null;
		}, 500);
	}

	function openOrFocusChildWindow(opts: { cloneCurrentMain?: boolean } = {}): void {
		if (!browser || isChild) return;

		// Must ensure the bridge exists *before* we try to talk to the child,
		// because the creation effect can race with command-palette actions.
		const bridge = ensureMasterBridge();
		if (!bridge) return;

		const win = ensureChildWindow();
		if (!win) return;
		bridge.setChildWindow(win);

		if (!activeLayoutId) return;

		if (opts.cloneCurrentMain) {
			// Explicit user action "Open Child Window": seed the child's state from whatever
			// the master currently shows. This makes the popup start as a true visual extension.
			const payload = {
				layout: structuredClone(layout),
				floatingPanes: structuredClone($state.snapshot(floatingPanes))
			};
			updateChildWindowState(activeLayoutId, { childEnabled: true, child: payload });
			bridge.sendChildLayoutApply(structuredClone(payload));
		} else {
			// Restore/ensure using whatever child state (if any) is saved for this preset.
			// Do not clobber a dedicated companion layout with the current main.
			updateChildWindowState(activeLayoutId, { childEnabled: true });
			const active = getLayout(activeLayoutId, false);
			const state = active?.child ?? defaultWindowLayoutState();
			bridge.sendChildLayoutApply(structuredClone(state));
		}

		// Proactively push current telemetry right after opening (now that we know we have a bridge).
		// The postMessage will be queued by the browser until the child has its listener.
		if (globalData.lines.length > 0) {
			bridge.sendFullTelemetry(
				$state.snapshot(globalData.lines),
				$state.snapshot(globalData.metadata)
			);
		}
	}

	function disableChildWindow(): void {
		if (!browser || isChild) return;
		if (activeLayoutId) {
			updateChildWindowState(activeLayoutId, { childEnabled: false });
		}
		closeChildWindow();
	}

	function syncChildWindowToActiveLayout(): void {
		if (!browser || isChild || !activeLayoutId) return;
		const active = getLayout(activeLayoutId, false);
		if (!active) return;
		if (active.childEnabled) {
			const bridge = ensureMasterBridge();
			if (!bridge) return;

			ensureChildWindow();
			const state = active.child ?? defaultWindowLayoutState();
			bridge.sendChildLayoutApply(structuredClone(state));

			if (globalData.lines.length > 0) {
				bridge.sendTelemetryReplace(
					$state.snapshot(globalData.lines),
					$state.snapshot(globalData.metadata)
				);
			}
		} else {
			closeChildWindow();
		}
	}

	$effect(() => {
		if (!browser || isChild) return;
		activeLayoutId;
		masterBridge;
		syncChildWindowToActiveLayout();
	});

	$effect(() => {
		if (!browser || isChild) return;

		// If ensureMasterBridge() already created one on demand (because the user opened
		// the child before this effect ran), just keep it alive and make sure the child ref is set.
		if (masterBridge) {
			masterBridge.setChildWindow(childWindow);
			// The on-demand creation already registered it in the registry.
			return () => {
				setMasterBridge(null);
				masterBridge?.destroy();
				masterBridge = null;
			};
		}

		const bridge = createMasterBridge({
			onChildHello: () => {
				if (!bridge.hasChild()) return;
				const active = activeLayoutId ? getLayout(activeLayoutId, false) : null;
				const childState = active?.child ?? defaultWindowLayoutState();
				bridge.sendInit(
					$state.snapshot(globalData.lines),
					$state.snapshot(globalData.metadata),
					structuredClone(childState)
				);
			},
			onChildLayoutUpdate: (state) => {
				queuePersistChildState(state);
			},
			onRequestTelemetry: () => {
				if (globalData.lines.length > 0) {
					bridge.sendFullTelemetry(
						$state.snapshot(globalData.lines),
						$state.snapshot(globalData.metadata)
					);
				}
			}
		});

		masterBridge = bridge;
		setMasterBridge(bridge);
		bridge.setChildWindow(childWindow);

		return () => {
			setMasterBridge(null);
			bridge.destroy();
			masterBridge = null;
		};
	});

	$effect(() => {
		if (!browser || isChild) return;
		const interval = window.setInterval(() => {
			if (!childWindow) return;
			if (childWindow.closed) {
				childWindow = null;
				(masterBridge ?? getMasterBridge())?.setChildWindow(null);
				if (activeLayoutId) {
					updateChildWindowState(activeLayoutId, { childEnabled: false });
				}
			}
		}, 500);

		return () => window.clearInterval(interval);
	});

	// --- Master → Child time index sync ---
	// Forward the current selected time index to the child so both windows stay in sync.
	let timeSyncTimer: number | null = null;
	$effect(() => {
		if (!browser || isChild) return;

		const unsubscribe = selectedIndex.subscribe((idx) => {
			const b = masterBridge ?? getMasterBridge();
			if (!b?.hasChild?.()) return;

			if (timeSyncTimer !== null) clearTimeout(timeSyncTimer);
			timeSyncTimer = window.setTimeout(() => {
				b.sendTimeSelect(idx);
				timeSyncTimer = null;
			}, 50); // light debounce for smooth slider dragging
		});

		return () => {
			unsubscribe();
			if (timeSyncTimer !== null) clearTimeout(timeSyncTimer);
		};
	});

	$effect(() => {
		if (!browser || !isChild) return;
		if (!window.opener) return;

		const bridge = createChildBridge(window.opener, {
			onInit: (msg) => {
				childInitialized = true;
				dataSyncInProgress = false;
				layout = ensureIds(msg.childState.layout);
				floatingPanes = msg.childState.floatingPanes;
				replaceSession(msg.session.telemetry, msg.session.metadata);
			},
			onTelemetryAppend: (lines) => {
				appendLiveTelemetry(lines);
			},
			onTelemetryReplace: (telemetry, metadata) => {
				dataSyncInProgress = false;
				replaceSession(telemetry, metadata);
			},
			onTelemetryReplaceUrl: async (url, metadata) => {
				try {
					const res = await fetch(url);
					const telemetry: import('$lib/types').DataLine[] = await res.json();
					dataSyncInProgress = false;
					replaceSession(telemetry, metadata);
				} catch (err) {
					console.error('Failed to load telemetry via URL from master:', err);
				} finally {
					// Child can try to revoke; master also has a timeout.
					try {
						URL.revokeObjectURL(url);
					} catch {}
				}
			},
			onChildLayoutApply: (state) => {
				layout = ensureIds(state.layout);
				floatingPanes = state.floatingPanes;
			},
			onTimeSelect: (index) => {
				// Apply time from master (do not echo back to avoid loops)
				setIndex(index);
			}
		});

		childBridge = bridge;
		showLoadDataModal = false;
		dataSyncInProgress = true;

		// Fallback: if the ultra-early consumption (right after setIsChild) didn't catch it
		// (e.g. the proactive message arrived between that call and now), try again.
		if ((__earlyTelemetry || __earlyDataUrl) && globalData.lines.length === 0) {
			consumeEarlyDataIfPresent();
		}

		bridge.sendHello();
		// Explicitly request current telemetry in case early push messages arrived before
		// our listener was installed. Master will reply with sendTelemetryReplace if it has data.
		bridge.sendRequestTelemetry();

		return () => {
			bridge.destroy();
			childBridge = null;
		};
	});

	$effect(() => {
		if (!browser || !isChild || !childBridge || !childInitialized) return;
		layout;
		floatingPanes;

		const state = {
			layout: structuredClone(layout),
			floatingPanes: structuredClone($state.snapshot(floatingPanes))
		};

		let timer: number | null = window.setTimeout(() => {
			childBridge?.sendChildLayoutUpdate(state);
			timer = null;
		}, 500);

		return () => {
			if (timer !== null) {
				clearTimeout(timer);
			}
		};
	});

	// ---------------------------------------------------------------------------
	// Layout management - Initialize and migrate if needed
	// ---------------------------------------------------------------------------

	// Run migration once on load
	if (browser) {
		migrateExistingLayout(false);
	}

	// Load the active layout or default
	let initialLayoutData = browser
		? isChild
			? { layout: defaultLayout(), floatingPanes: [], layoutId: null }
			: loadActiveLayout(false)
		: { layout: defaultLayout(), floatingPanes: [], layoutId: null };

	// Handle shared layout from URL
	if (browser) {
		const params = new URLSearchParams(window.location.search);
		const sharedLayoutBase64 = params.get('layout');
		if (sharedLayoutBase64) {
			const decoded = deserializeLayout(sharedLayoutBase64);
			if (decoded) {
				initialLayoutData = {
					layout: decoded.layout,
					floatingPanes: decoded.floatingPanes,
					layoutId: null
				};
				showLoadDataModal = false;
			}
		}

		const dataUrl = params.get('data');
		if (dataUrl) {
			showLoadDataModal = false;
		}
	}

	$effect(() => {
		if (browser) {
			if (showLoadDataModal) {
				document.body.classList.add('modal-open');
			} else {
				document.body.classList.remove('modal-open');
			}
		}
	});

	$effect(() => {
		if (!browser || !isChild) return;
		if (showLoadDataModal) {
			showLoadDataModal = false;
		}
	});

	let layout: LayoutNode = $state(initialLayoutData.layout);
	let floatingPanes: FloatingPaneState[] = $state(initialLayoutData.floatingPanes);
	let activeLayoutId: string | null = $state(initialLayoutData.layoutId);

	// Handle shared data from URL
	$effect(() => {
		if (browser) {
			const params = new URLSearchParams(window.location.search);
			const dataUrl = params.get('data');
			if (dataUrl) {
				console.log('Fetching shared data from:', dataUrl);
				fetch(dataUrl)
					.then((res) => {
						if (!res.ok)
							throw new Error(`Could not fetch shared data: ${res.status} ${res.statusText}`);
						return res.arrayBuffer();
					})
					.then((buffer) => {
						const parsedLines = parseBinaryBuffer(buffer);
						console.log('Parsed lines count:', parsedLines.length);

						replaceSession(parsedLines);

						if (SERIAL_DEBUG) console.log('[SerialDebug] Hiding Load Data modal');
						showLoadDataModal = false;
						console.log('Data loaded successfully from URL');
					})
					.catch((err: any) => {
						console.error('Error loading shared data:', err);
						alert('Failed to load shared data: ' + err.message);
					});
			}
		}
	});

	let layouts: SavedLayout[] = $state(browser && !isChild ? getAllLayouts(false) : []);

	// FloatingPane z-index convention: max 40 (modal = z-[1000], time slider = z-20, overlays = z-10)
	let topZ = $state(30);

	// Modal states
	let showSaveLayoutModal: boolean = $state(false);
	let showManageLayoutsModal: boolean = $state(false);
	let currentLayoutName: string | undefined = $state(undefined);

	// Fullscreen state
	let fullscreenNode: { id: string; type: PaneWidgetType; isFloating: boolean } | null =
		$state(null);

	// ---------------------------------------------------------------------------
	// Persist layout changes - Auto-save to active layout
	// ---------------------------------------------------------------------------
	let saveDebounceTimer: number | null = null;
	let isLoadingLayout = false; // Flag to prevent auto-save during layout loading

	$effect(() => {
		// Watch layout and floatingPanes changes
		layout;
		floatingPanes;

		if (!browser || isChild || !activeLayoutId || isLoadingLayout) {
			return;
		}

		// Capture values to avoid stale closure issues
		const layoutIdToSave = activeLayoutId;
		const layoutToSave = layout;
		const floatingPanesToSave = floatingPanes;

		// Debounce saves to avoid excessive writes
		if (saveDebounceTimer !== null) {
			clearTimeout(saveDebounceTimer);
		}

		saveDebounceTimer = window.setTimeout(() => {
			updateLayoutInStore(layoutIdToSave, layoutToSave, floatingPanesToSave, false);
			saveDebounceTimer = null;
		}, 500);

		// Cleanup function to prevent stale saves
		return () => {
			if (saveDebounceTimer !== null) {
				clearTimeout(saveDebounceTimer);
				saveDebounceTimer = null;
			}
		};
	});

	// ---------------------------------------------------------------------------
	// Tiled layout callbacks
	// ---------------------------------------------------------------------------
	function handleDrop(nodeId: string, widgetType: PaneWidgetType, position: DropPosition) {
		layout = ensureIds(insertPane(layout, nodeId, widgetType, position));
	}

	function handleRemove(nodeId: string) {
		const updated = removePane(layout, nodeId);
		if (updated) {
			layout = ensureIds(updated);
		} else {
			// Last pane removed — reset to default single-pane layout
			layout = defaultLayout();
		}
	}

	function handlePopOut(nodeId: string) {
		const node = findNode(layout, nodeId);
		if (!node) return;
		const type = node.type as PaneWidgetType;
		const config = node.config;

		// Remove from tiled tree
		const updated = removePane(layout, nodeId);
		layout = updated ? ensureIds(updated) : defaultLayout();

		// Add as floating pane, centered in viewport
		topZ = Math.min(topZ + 1, 40); // cap at 40
		const x = browser ? Math.max(0, (window.innerWidth - DEFAULT_FLOAT_WIDTH) / 2) : 100;
		const y = browser ? Math.max(0, (window.innerHeight - DEFAULT_FLOAT_HEIGHT) / 3) : 80;

		floatingPanes = [
			...floatingPanes,
			{
				id: generateUUID(),
				type,
				x,
				y,
				width: DEFAULT_FLOAT_WIDTH,
				height: DEFAULT_FLOAT_HEIGHT,
				zIndex: topZ,
				config
			}
		];
	}

	// ---------------------------------------------------------------------------
	// Floating pane callbacks
	// ---------------------------------------------------------------------------
	function handleFloatClose(id: string) {
		floatingPanes = floatingPanes.filter((p) => p.id !== id);
	}

	function handleFloatFocus(id: string) {
		topZ = Math.min(topZ + 1, 40); // cap at 40
		floatingPanes = floatingPanes.map((p) => (p.id === id ? { ...p, zIndex: topZ } : p));
	}

	function handleDock(id: string) {
		const pane = floatingPanes.find((p) => p.id === id);
		if (!pane) return;

		// Remove from floating
		floatingPanes = floatingPanes.filter((p) => p.id !== id);

		// Wrap current layout in a horizontal group with the new pane docked on the right
		const newNode: LayoutNode = ensureIds({
			id: '',
			type: pane.type,
			defaultSize: 25,
			minSize: 10,
			config: pane.config
		});

		layout = ensureIds({
			id: '',
			type: 'horizontal',
			panes: [{ ...layout, defaultSize: 75 }, newNode]
		});
	}

	// ---------------------------------------------------------------------------
	// Config change callbacks
	// ---------------------------------------------------------------------------
	function handleLayoutConfigChange(nodeId: string, config: Record<string, unknown>) {
		layout = updateConfig(layout, nodeId, config);
	}

	function handleFloatConfigChange(id: string, config: Record<string, unknown>) {
		floatingPanes = floatingPanes.map((p) => (p.id === id ? { ...p, config } : p));
	}

	// ---------------------------------------------------------------------------
	// Fullscreen handlers
	// ---------------------------------------------------------------------------
	function handleFullscreen(id: string, isFloating: boolean) {
		const source = isFloating ? floatingPanes.find((p) => p.id === id) : findNode(layout, id);

		if (source) {
			fullscreenNode = {
				id,
				type: source.type as PaneWidgetType,
				isFloating
			};
		}
	}

	function handleCloseFullscreen() {
		fullscreenNode = null;
	}

	// --- Handle pane moves / swaps ---
	function handleMove(sourceId: string, targetId: string, position: DropPosition) {
		if (sourceId === targetId) return;
		let updated: LayoutNode | null;
		if (position === 'center') {
			updated = swapPanes(layout, sourceId, targetId);
		} else {
			updated = movePane(layout, sourceId, targetId, position);
		}
		layout = updated ? ensureIds(updated) : defaultLayout();
	}

	// ---------------------------------------------------------------------------
	// Layout management handlers
	// ---------------------------------------------------------------------------

	function handleSaveLayoutClick() {
		if (isChild) return;
		const activeLayout = activeLayoutId ? getLayout(activeLayoutId, false) : null;
		currentLayoutName = activeLayout?.name;
		showSaveLayoutModal = true;
	}

	function handleSaveLayout(name: string, isNew: boolean) {
		if (isChild) return;
		if (isNew || !activeLayoutId) {
			// Save as new layout
			const newId = saveLayoutToStore(name, layout, floatingPanes, false);
			activeLayoutId = newId;
			setActiveLayout(newId, false);
		} else {
			// Update existing layout (also rename if name changed)
			const existingLayout = getLayout(activeLayoutId, false);
			if (existingLayout && existingLayout.name !== name) {
				renameLayoutInStore(activeLayoutId, name, false);
			}
			updateLayoutInStore(activeLayoutId, layout, floatingPanes, false);
		}

		// Refresh layouts list
		layouts = getAllLayouts(false);
		showSaveLayoutModal = false;
	}

	function handleLoadLayout(layoutId: string) {
		if (isChild) return;
		const layoutData = getLayout(layoutId, false);

		if (layoutData) {
			// Set flag to prevent auto-save during loading
			isLoadingLayout = true;

			layout = ensureIds(layoutData.layout);
			floatingPanes = layoutData.floatingPanes;
			activeLayoutId = layoutId;
			setActiveLayout(layoutId, false);
			layouts = getAllLayouts(false);

			if (layoutData.childEnabled) {
				openOrFocusChildWindow(); // will restore the saved child state for this preset
			} else {
				disableChildWindow();
			}

			// Clear flag after a short delay to allow effects to settle
			setTimeout(() => {
				isLoadingLayout = false;
			}, 100);
		}
	}

	function handleDeleteLayout(layoutId: string) {
		if (isChild) return;
		deleteLayoutFromStore(layoutId, false);

		// If we deleted the active layout, load the new active one
		if (activeLayoutId === layoutId) {
			const layoutData = loadActiveLayout(false);
			layout = layoutData.layout;
			floatingPanes = layoutData.floatingPanes;
			activeLayoutId = layoutData.layoutId;
		}

		layouts = getAllLayouts(false);
	}

	function handleRenameLayout(layoutId: string, newName: string) {
		if (isChild) return;
		renameLayoutInStore(layoutId, newName, false);
		layouts = getAllLayouts(false);
	}

	function handleDuplicateLayout(layoutId: string) {
		if (isChild) return;
		const newId = duplicateLayoutInStore(layoutId, false);
		if (newId) {
			layouts = getAllLayouts(false);
		}
	}

	function handleManageLayoutsClick() {
		showManageLayoutsModal = true;
	}

	// ---------------------------------------------------------------------------
	// Fullscreen Logic
	// ---------------------------------------------------------------------------
	const fullscreenConfig = $derived.by(() => {
		if (!fullscreenNode) return undefined;
		if (fullscreenNode.isFloating) {
			return floatingPanes.find((p) => p.id === fullscreenNode!.id)?.config;
		} else {
			return findNode(layout, fullscreenNode.id)?.config;
		}
	});

	function handleFullscreenConfigChange(config: Record<string, unknown>) {
		if (!fullscreenNode) return;
		if (fullscreenNode.isFloating) {
			handleFloatConfigChange(fullscreenNode.id, config);
		} else {
			handleLayoutConfigChange(fullscreenNode.id, config);
		}
	}

	// ---------------------------------------------------------------------------
	// Sharing logic
	// ---------------------------------------------------------------------------
	let showShareSuccess = $state(false);

	function handleShare() {
		const params = new URLSearchParams(window.location.search);
		const dataUrl = params.get('data') || undefined;
		const active = activeLayoutId && !isChild ? getLayout(activeLayoutId, false) : null;
		const childEnabled = active?.childEnabled ?? false;
		const childState = active?.child ?? null;
		const shareUrl = generateShareUrl(dataUrl, layout, floatingPanes, childEnabled, childState);

		console.log('Generating share link with dataUrl:', dataUrl);

		navigator.clipboard
			.writeText(shareUrl)
			.then(() => {
				showShareSuccess = true;
				setTimeout(() => {
					showShareSuccess = false;
				}, 3000);
			})
			.catch((err) => {
				console.error('Failed to copy share link:', err);
				alert('Failed to copy share link. You can copy it from the URL bar after sharing.');
			});
	}

	// ---------------------------------------------------------------------------
	// Command Palette
	// ---------------------------------------------------------------------------
	let showCommandPalette = $state(false);

	const masterStaticCommands: Command[] = [
		{
			id: 'share-screen',
			label: 'Share Layout',
			description: 'Copy a shareable link of the current layout and data',
			action: handleShare
		},
		{
			id: 'new-window',
			label: 'Open Child Window',
			description: 'Open or focus the second dashboard window',
			action: () => openOrFocusChildWindow({ cloneCurrentMain: true })
		},
		{
			id: 'close-window',
			label: 'Close Child Window',
			description: 'Close the second dashboard window',
			action: disableChildWindow
		},
		{
			id: 'save-layout',
			label: 'Save Layout',
			description: 'Save the current tiled and floating arrangement',
			shortcut: 'Ctrl+S',
			action: handleSaveLayoutClick
		},
		{
			id: 'manage-layouts',
			label: 'Manage Layouts',
			description: 'Rename, duplicate, or delete saved layouts',
			action: handleManageLayoutsClick
		},
		{
			id: 'load-data',
			label: 'Load Data',
			description: 'Open the data import modal',
			action: () => (showLoadDataModal = true)
		},
		{
			id: 'export-wazzu',
			label: 'Export as .wazzuracing',
			description: 'Save the current session in the new format',
			action: handleExportWazzu
		},
		{
			id: 'convert-bin',
			label: 'Convert .bin to .wazzuracing',
			description: 'Select a .bin file and convert it to the new format',
			action: handleConvertBin
		}
	];

	const childStaticCommands: Command[] = [
		{
			id: 'share-screen',
			label: 'Share Layout',
			description: 'Copy a shareable link of the current layout and data',
			action: handleShare
		}
	];

	type ThemePreference = 'system' | 'light' | 'dark';

	const THEME_CHANGE_EVENT = 'themechange';

	let themePreference: ThemePreference = $state('system');

	function dispatchThemeChange(mode: 'light' | 'dark') {
		if (!browser) return;
		window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: mode }));
	}

	function resolveTheme(preference: ThemePreference): 'light' | 'dark' {
		if (preference === 'system') {
			if (!browser) return 'light';
			return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
		}
		return preference;
	}

	function applyTheme(preference: ThemePreference, persist = true) {
		themePreference = preference;
		if (!browser) return;

		const resolved = resolveTheme(preference);
		const isDark = resolved === 'dark';
		document.documentElement.classList.toggle('dark', isDark);
		document.body.classList.toggle('dark', isDark);
		document.documentElement.dataset.theme = resolved;
		document.body.dataset.theme = resolved;
		dispatchThemeChange(resolved);

		if (!persist) return;
		if (preference === 'system') {
			localStorage.removeItem('theme-preference');
		} else {
			localStorage.setItem('theme-preference', preference);
		}
	}

	$effect(() => {
		if (!browser) {
			return;
		}

		const storedPreference = localStorage.getItem('theme-preference');
		const initialPreference: ThemePreference =
			storedPreference === 'light' || storedPreference === 'dark'
				? (storedPreference as ThemePreference)
				: 'system';
		applyTheme(initialPreference, false);

		const media = window.matchMedia('(prefers-color-scheme: dark)');
		const handleMediaChange = () => {
			if (themePreference === 'system') {
				applyTheme('system', false);
			}
		};
		media.addEventListener('change', handleMediaChange);

		return () => {
			media.removeEventListener('change', handleMediaChange);
		};
	});

	$effect(() => {
		if (!browser) return;
		const handleStorage = (event: StorageEvent) => {
			if (event.key !== 'theme-preference') return;
			const value = event.newValue;
			const preference: ThemePreference =
				value === 'light' || value === 'dark' ? (value as ThemePreference) : 'system';
			applyTheme(preference, false);
		};
		window.addEventListener('storage', handleStorage);
		return () => window.removeEventListener('storage', handleStorage);
	});

	let commands = $derived.by(() => {
		const staticCommands = isChild ? childStaticCommands : masterStaticCommands;

		const layoutCommands: Command[] = layouts.map((l) => ({
			id: `load-layout-${l.id}`,
			label: l.name,
			description: `Load this layout`,
			action: () => handleLoadLayout(l.id)
		}));

		const themeCommands: Command[] = [
			{
				id: 'theme-light',
				label: 'Light',
				action: () => applyTheme('light')
			},
			{
				id: 'theme-dark',
				label: 'Dark',
				action: () => applyTheme('dark')
			},
			{
				id: 'theme-system',
				label: 'System Default',
				action: () => applyTheme('system')
			}
		];

		const widgetCommands: Command[] = [
			{ id: 'add-graph', label: 'Graph', action: () => handleAddPane('graph') },
			{ id: 'add-map', label: 'Map', action: () => handleAddPane('map') },
			{ id: 'add-table', label: 'Table', action: () => handleAddPane('table') },
			{ id: 'add-gauge', label: 'Gauge', action: () => handleAddPane('gauge') },
			{ id: 'add-metadata', label: 'Metadata', action: () => handleAddPane('metadata') }
		];

		const rootCommands: Command[] = [
			...staticCommands,
			...(isChild
				? []
				: [
						{
							id: 'switch-layout-menu',
							label: 'Switch Layout...',
							description: 'Select a saved layout to load',
							children: layoutCommands
						},
						{
							id: 'add-widget-menu',
							label: 'Add Widget...',
							description: 'Choose a widget type to add to the dashboard',
							children: widgetCommands
						}
					]),
			{
				id: 'change-theme-menu',
				label: 'Change Theme...',
				description: 'Switch between light and dark mode',
				children: themeCommands
			}
		];

		return rootCommands;
	});

	function handleGlobalKeydown(e: KeyboardEvent) {
		// Escape to close fullscreen, but let the command palette handle Escape first when open.
		if (!showCommandPalette && e.key === 'Escape' && fullscreenNode) {
			handleCloseFullscreen();
			return;
		}

		// Ctrl+Shift+P or Cmd+Shift+P
		if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'p') {
			e.preventDefault();
			showCommandPalette = !showCommandPalette;
		}
		// Ctrl+S for Save — skip when command palette is open so typing "s" in the palette
		// does not accidentally trigger a save or suppress the browser's default behavior.
		if (!showCommandPalette && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
			e.preventDefault();
			handleSaveLayoutClick();
		}
	}
</script>

<svelte:window onkeydown={handleGlobalKeydown} />

<div class="flex flex-col w-full flex-1 min-h-0 overflow-hidden bg-stone-100">
	<TopBar onOpenCommands={() => (showCommandPalette = true)} />
	<div class="flex flex-1 overflow-hidden">
		<PaneToolbar onAddPane={handleAddPane} />
		<div class="relative flex-1 overflow-hidden">
			{#if showShareSuccess}
				<div
					class="absolute top-4 right-4 z-[100] flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-lg transition-all"
					transition:fade
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-4 w-4"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="3"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<polyline points="20 6 9 17 4 12" />
					</svg>
					Share link copied!
				</div>
			{/if}
			<PaneLayout
				{layout}
				onDrop={handleDrop}
				onRemove={handleRemove}
				onPopOut={handlePopOut}
				onFullscreen={(id) => handleFullscreen(id, false)}
				onConfigChange={handleLayoutConfigChange}
				onMove={handleMove}
				fullscreenPaneId={fullscreenNode && !fullscreenNode.isFloating
					? fullscreenNode.id
					: undefined}
			/>

			{#each floatingPanes as pane (pane.id)}
				<FloatingPane
					{pane}
					onClose={handleFloatClose}
					onFocus={handleFloatFocus}
					onDock={handleDock}
					onFullscreen={(id) => handleFullscreen(id, true)}
					onConfigChange={handleFloatConfigChange}
					hidden={fullscreenNode?.id === pane.id && fullscreenNode.isFloating}
				/>
			{/each}
		</div>
	</div>
</div>

{#if showLoadDataModal}
	<LoadDataModal
		onDismiss={() => {
			showLoadDataModal = false;
		}}
		onConnectToCar={handleConnectToCar}
	/>
{/if}

{#if showSaveLayoutModal}
	<SaveLayoutModal
		{currentLayoutName}
		onSave={handleSaveLayout}
		onCancel={() => {
			showSaveLayoutModal = false;
		}}
	/>
{/if}

{#if showManageLayoutsModal}
	<ManageLayoutsModal
		{layouts}
		{activeLayoutId}
		onLoad={handleLoadLayout}
		onRename={handleRenameLayout}
		onDelete={handleDeleteLayout}
		onDuplicate={handleDuplicateLayout}
		onClose={() => {
			showManageLayoutsModal = false;
		}}
	/>
{/if}

<CommandPalette
	bind:isOpen={showCommandPalette}
	{commands}
	onClose={() => (showCommandPalette = false)}
/>

{#if fullscreenNode}
	<FullscreenOverlay
		node={fullscreenNode}
		config={fullscreenConfig}
		onClose={handleCloseFullscreen}
		onConfigChange={handleFullscreenConfigChange}
	/>
{/if}
