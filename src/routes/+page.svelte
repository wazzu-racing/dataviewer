<script lang="ts">
	import { browser } from '$app/environment';
	import type { DataLine } from '$lib/types';
	import type {
		LayoutNode,
		FloatingPaneState,
		PaneWidgetType,
		DropPosition,
		SavedLayout
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
	import PaneLayout from '$lib/components/PaneLayout.svelte';
	import PaneToolbar from '$lib/components/PaneToolbar.svelte';

	// --- Add new pane at reasonable location on click ---
	function handleAddPane(type: PaneWidgetType) {
		// Always add a pane, preserving existing panes (even if only one exists)
		layout = ensureIds(insertPane(layout, layout.id, type, 'right'));
	}

	import FloatingPane from '$lib/components/FloatingPane.svelte';
	import LoadDataModal from '$lib/components/LoadDataModal.svelte';
	import SaveLayoutModal from '$lib/components/SaveLayoutModal.svelte';
	import ManageLayoutsModal from '$lib/components/ManageLayoutsModal.svelte';
	import TopBar from '$lib/components/TopBar.svelte';

	import { data as globalData } from '$lib/data.svelte';
	import { dataStore } from '$lib/stores/dataStore';

	// ---------------------------------------------------------------------------
	// Default layout — shown the first time (no saved state)
	// ---------------------------------------------------------------------------
	function defaultLayout(): LayoutNode {
		return ensureIds({ id: '', type: 'graph' });
	}

	function workingLayout(): LayoutNode {
		return defaultLayout();
	}

	// Always prompt for data on every page load — telemetry is never persisted across sessions.
	let showLoadDataModal: boolean = $state(true);

	$effect(() => {
		if (browser) {
			if (showLoadDataModal) {
				document.body.classList.add('modal-open');
			} else {
				document.body.classList.remove('modal-open');
			}
		}
	});

	// ---------------------------------------------------------------------------
	// Window handling
	// ---------------------------------------------------------------------------

	let isChild: boolean = false;
	let windowObject: Window | null = null;

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
			window.addEventListener('message', recieveMessageFromParent);
		}
	}

	function recieveMessageFromParent(e: MessageEvent): void {
		globalData.lines = JSON.parse(e.data);

		dataStore.update((old) => ({
			...old,
			telemetry: globalData.lines
		}));
	}

	// ---------------------------------------------------------------------------
	// Layout management - Initialize and migrate if needed
	// ---------------------------------------------------------------------------

	// Run migration once on load
	if (browser) {
		migrateExistingLayout(isChild);
	}

	// Load the active layout or default
	const initialLayoutData = browser
		? loadActiveLayout(isChild)
		: { layout: defaultLayout(), floatingPanes: [], layoutId: null };

	let layout: LayoutNode = $state(initialLayoutData.layout);
	let floatingPanes: FloatingPaneState[] = $state(initialLayoutData.floatingPanes);
	let activeLayoutId: string | null = $state(initialLayoutData.layoutId);
	let layouts: SavedLayout[] = $state(browser ? getAllLayouts(isChild) : []);

	// FloatingPane z-index convention: max 40 (modal = z-[1000], time slider = z-20, overlays = z-10)
	let topZ = $state(30);

	// Modal states
	let showSaveLayoutModal: boolean = $state(false);
	let showManageLayoutsModal: boolean = $state(false);
	let currentLayoutName: string | undefined = $state(undefined);

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
			// Last pane removed — transition to the working layout
			layout = workingLayout();
		}
	}

	function handlePopOut(nodeId: string) {
		const node = findNode(layout, nodeId);
		if (!node) return;
		const type = node.type as PaneWidgetType;
		const config = node.config;

		// Remove from tiled tree
		const updated = removePane(layout, nodeId);
		layout = updated ? ensureIds(updated) : workingLayout();

		// Add as floating pane, centered in viewport
		topZ = Math.min(topZ + 1, 40); // cap at 40
		const w = 480;
		const h = 340;
		const x = browser ? Math.max(0, (window.innerWidth - w) / 2) : 100;
		const y = browser ? Math.max(0, (window.innerHeight - h) / 3) : 80;

		floatingPanes = [
			...floatingPanes,
			{ id: generateUUID(), type, x, y, width: w, height: h, zIndex: topZ, config }
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

	// --- Handle pane moves / swaps ---
	function handleMove(sourceId: string, targetId: string, position: DropPosition) {
		if (sourceId === targetId) return;
		let updated: LayoutNode | null;
		if (position === 'center') {
			updated = swapPanes(layout, sourceId, targetId);
		} else {
			updated = movePane(layout, sourceId, targetId, position);
		}
		layout = updated ? ensureIds(updated) : workingLayout();
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
</script>

<div class="flex flex-col w-full flex-1 min-h-0 overflow-hidden bg-stone-100">
	<TopBar
		openChildWindow={() => createChildWindow()}
		{layouts}
		currentLayoutId={activeLayoutId}
		onLayoutSelect={handleLoadLayout}
		onSaveLayout={handleSaveLayoutClick}
		onManageLayouts={handleManageLayoutsClick}
	/>
	<div class="flex flex-1 overflow-hidden">
		<PaneToolbar onAddPane={handleAddPane} />
		<div class="relative flex-1 overflow-hidden">
			<PaneLayout
				{layout}
				onDrop={handleDrop}
				onRemove={handleRemove}
				onPopOut={handlePopOut}
				onConfigChange={handleLayoutConfigChange}
				onMove={handleMove}
			/>

			{#each floatingPanes as pane (pane.id)}
				<FloatingPane
					{pane}
					onClose={handleFloatClose}
					onFocus={handleFloatFocus}
					onDock={handleDock}
					onConfigChange={handleFloatConfigChange}
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
		{layouts}
		currentLayoutId={activeLayoutId}
		onLayoutSelect={handleLoadLayout}
		onManageLayouts={handleManageLayoutsClick}
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
