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
		duplicateLayout as duplicateLayoutInStore
	} from '$lib/stores/layoutStore';
	import { deserializeLayout, generateShareUrl } from '$lib/shareUtils';
	import { parseBinaryBuffer } from '$lib/dataParser';
	import { saveWazzuFile, convertBinToWazzu, downloadBlob } from '$lib/fileFormat';
	import { data as globalData } from '$lib/data.svelte';
	import { consumeLiveSerialBytes } from '$lib/liveConnection';
	import { appendLiveTelemetry, replaceSession, startLiveSession } from '$lib/liveSession';
	import type { Command } from '$lib/types';
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

	// Default dimensions for a newly popped-out floating pane
	const DEFAULT_FLOAT_WIDTH = 480;
	const DEFAULT_FLOAT_HEIGHT = 340;

	let serialBuffer: number[] = [];
	let activeSerialPort: SerialPort | null = null;
	let serialReadActive = false;
	let lastLiveWriteMillis: number | null = null;

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
		if (!browser || !('serial' in navigator) || !navigator.serial) {
			alert('Connection to car is not supported. Use a different browser (chromium)');
			return;
		}

		const usbVendorId = 0x239a;

		try {
			const port = await navigator.serial.requestPort({ filters: [{ usbVendorId }] });
			await disconnectSerialPort();

			startLiveSession();
			showLoadDataModal = false;
			activeSerialPort = port;
			serialBuffer = [];
			lastLiveWriteMillis = null;

			await readDataFromSerial(port);
		} catch (error) {
			if (error instanceof DOMException && error.name === 'NotFoundError') {
				alert('Please select the receiver from the list of devices.');
				return;
			}

			const message = error instanceof Error ? error.message : 'Unknown connection error';
			alert(`Failed to connect to car: ${message}`);
		}
	}

	async function readDataFromSerial(port: SerialPort) {
		// TRANSMITTER VERIFIED: 9600 baud, 212-byte frames (.wr format), 3 newlines (\n\n\n = [10, 10, 10])
		await port.open({ baudRate: 9600 });
		serialReadActive = true;

		try {
			while (serialReadActive && port.readable) {
				const reader = port.readable.getReader();
				try {
					while (serialReadActive) {
						const { value, done } = await reader.read();
						if (done) break;
						if (!value) continue;

						const result = consumeLiveSerialBytes(serialBuffer, value);
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
							appendLiveTelemetry(nextLines);
						}
					}
				} finally {
					reader.releaseLock();
				}
			}
		} catch (error) {
			console.error('Serial read failed:', error);
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
	let windowObject: Window | null = null;

	// Always prompt for data on every page load — telemetry is never persisted across sessions.
	let showLoadDataModal: boolean = $state(true);

	setIsChild();

	function createChildWindow(): void {
		if (!browser) {
			return;
		}

		windowObject = window.open('/dataviewer', '', 'popup=true');

		window.setTimeout(() => {
			windowObject?.postMessage(JSON.stringify(globalData.lines));
		}, 1000);
	}

	function setIsChild(): void {
		if (!browser) {
			return;
		}

		if (window.opener != null) {
			isChild = true;
			showLoadDataModal = false;
			globalData.lines = [];

			windowObject = window.opener;
			window.addEventListener('message', receiveMessageFromParent);
		}
	}

	function receiveMessageFromParent(e: MessageEvent): void {
		replaceSession(JSON.parse(e.data));
	}

	// ---------------------------------------------------------------------------
	// Layout management - Initialize and migrate if needed
	// ---------------------------------------------------------------------------

	// Run migration once on load
	if (browser) {
		migrateExistingLayout(isChild);
	}

	// Load the active layout or default
	let initialLayoutData = browser
		? loadActiveLayout(isChild)
		: { layout: defaultLayout(), floatingPanes: [], layoutId: null };

	// Handle shared layout from URL
	let isSharedLayout = false;
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
				isSharedLayout = true;
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

	let layouts: SavedLayout[] = $state(browser ? getAllLayouts(isChild) : []);

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

		if (!browser || !activeLayoutId || isLoadingLayout) {
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
			updateLayoutInStore(layoutIdToSave, layoutToSave, floatingPanesToSave, isChild);
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
		const activeLayout = activeLayoutId ? getLayout(activeLayoutId, isChild) : null;
		currentLayoutName = activeLayout?.name;
		showSaveLayoutModal = true;
	}

	function handleSaveLayout(name: string, isNew: boolean) {
		if (isNew || !activeLayoutId) {
			// Save as new layout
			const newId = saveLayoutToStore(name, layout, floatingPanes, isChild);
			activeLayoutId = newId;
			setActiveLayout(newId, isChild);
		} else {
			// Update existing layout (also rename if name changed)
			const existingLayout = getLayout(activeLayoutId, isChild);
			if (existingLayout && existingLayout.name !== name) {
				renameLayoutInStore(activeLayoutId, name, isChild);
			}
			updateLayoutInStore(activeLayoutId, layout, floatingPanes, isChild);
		}

		// Refresh layouts list
		layouts = getAllLayouts(isChild);
		showSaveLayoutModal = false;
	}

	function handleLoadLayout(layoutId: string) {
		const layoutData = getLayout(layoutId, isChild);

		if (layoutData) {
			// Set flag to prevent auto-save during loading
			isLoadingLayout = true;

			layout = ensureIds(layoutData.layout);
			floatingPanes = layoutData.floatingPanes;
			activeLayoutId = layoutId;
			setActiveLayout(layoutId, isChild);
			layouts = getAllLayouts(isChild);

			// Clear flag after a short delay to allow effects to settle
			setTimeout(() => {
				isLoadingLayout = false;
			}, 100);
		}
	}

	function handleDeleteLayout(layoutId: string) {
		deleteLayoutFromStore(layoutId, isChild);

		// If we deleted the active layout, load the new active one
		if (activeLayoutId === layoutId) {
			const layoutData = loadActiveLayout(isChild);
			layout = layoutData.layout;
			floatingPanes = layoutData.floatingPanes;
			activeLayoutId = layoutData.layoutId;
		}

		layouts = getAllLayouts(isChild);
	}

	function handleRenameLayout(layoutId: string, newName: string) {
		renameLayoutInStore(layoutId, newName, isChild);
		layouts = getAllLayouts(isChild);
	}

	function handleDuplicateLayout(layoutId: string) {
		const newId = duplicateLayoutInStore(layoutId, isChild);
		if (newId) {
			layouts = getAllLayouts(isChild);
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
		const shareUrl = generateShareUrl(dataUrl, layout, floatingPanes);

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

	const staticCommands: Command[] = [
		{
			id: 'share-screen',
			label: 'Share Layout',
			description: 'Copy a shareable link of the current layout and data',
			action: handleShare
		},
		{
			id: 'new-window',
			label: 'New Window',
			description: 'Open a new dashboard window',
			action: createChildWindow
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
			},
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
