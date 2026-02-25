<script lang="ts">
	import { browser } from '$app/environment';
	import type { LayoutNode, FloatingPaneState, PaneWidgetType, DropPosition } from '$lib/types';
	import { ensureIds, insertPane, removePane, findNode, updateConfig } from '$lib/layoutUtils';
	import PaneLayout from '$lib/components/PaneLayout.svelte';
	import PaneToolbar from '$lib/components/PaneToolbar.svelte';
	import FloatingPane from '$lib/components/FloatingPane.svelte';
	import LoadDataModal from '$lib/components/LoadDataModal.svelte';

	// ---------------------------------------------------------------------------
	// Default layout — shown the first time (no saved state)
	// ---------------------------------------------------------------------------
	function defaultLayout(): LayoutNode {
		return ensureIds({ id: '', type: 'graph' });
	}

	function workingLayout(): LayoutNode {
		return defaultLayout();
	}

	function loadSavedLayout(): LayoutNode {
		if (!browser) return defaultLayout();
		try {
			const raw = localStorage.getItem('layout');
			if (!raw) return defaultLayout();
			const parsed = JSON.parse(raw) as LayoutNode;
			return ensureIds(parsed);
		} catch {
			return defaultLayout();
		}
	}

	const VALID_WIDGET_TYPES = new Set<string>(['graph', 'map', 'table', 'gauge', 'load-data']);

	function isValidFloatingPane(p: unknown): p is FloatingPaneState {
		if (typeof p !== 'object' || p === null) return false;
		const o = p as Record<string, unknown>;
		return (
			typeof o.id === 'string' &&
			typeof o.type === 'string' &&
			VALID_WIDGET_TYPES.has(o.type) &&
			typeof o.x === 'number' &&
			typeof o.y === 'number' &&
			typeof o.width === 'number' &&
			typeof o.height === 'number' &&
			typeof o.zIndex === 'number'
		);
	}

	function loadSavedFloatingPanes(): FloatingPaneState[] {
		if (!browser) return [];
		try {
			const raw = localStorage.getItem('floating-panes');
			if (!raw) return [];
			const parsed = JSON.parse(raw);
			if (!Array.isArray(parsed)) return [];
			return parsed.filter(isValidFloatingPane);
		} catch {
			return [];
		}
	}

	// ---------------------------------------------------------------------------
	// State — seeded from localStorage on mount
	// ---------------------------------------------------------------------------
	let layout: LayoutNode = $state(loadSavedLayout());
	let floatingPanes: FloatingPaneState[] = $state(loadSavedFloatingPanes());
	let topZ = $state(200);
	// Always prompt for data on every page load — telemetry is never persisted across sessions.
	let showLoadDataModal: boolean = $state(true);

	// ---------------------------------------------------------------------------
	// Persist layout and floating pane positions on change
	// ---------------------------------------------------------------------------
	$effect(() => {
		if (browser) localStorage.setItem('layout', JSON.stringify(layout));
	});

	$effect(() => {
		if (browser) localStorage.setItem('floating-panes', JSON.stringify(floatingPanes));
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
		topZ += 1;
		const w = 480;
		const h = 340;
		const x = browser ? Math.max(0, (window.innerWidth - w) / 2) : 100;
		const y = browser ? Math.max(0, (window.innerHeight - h) / 3) : 80;

		floatingPanes = [
			...floatingPanes,
			{ id: crypto.randomUUID(), type, x, y, width: w, height: h, zIndex: topZ, config }
		];
	}

	// ---------------------------------------------------------------------------
	// Floating pane callbacks
	// ---------------------------------------------------------------------------
	function handleFloatClose(id: string) {
		floatingPanes = floatingPanes.filter((p) => p.id !== id);
	}

	function handleFloatFocus(id: string) {
		topZ += 1;
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
</script>

<div class="flex h-screen w-full overflow-hidden bg-stone-100">
	<!-- Sidebar toolbar -->
	<PaneToolbar />

	<!-- Main tiled layout area + floating pane container -->
	<div class="relative flex-1 overflow-hidden">
		<PaneLayout
			{layout}
			onDrop={handleDrop}
			onRemove={handleRemove}
			onPopOut={handlePopOut}
			onConfigChange={handleLayoutConfigChange}
		/>

		<!-- Floating panes rendered on top -->
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

{#if showLoadDataModal}
	<LoadDataModal
		onDismiss={() => {
			showLoadDataModal = false;
		}}
	/>
{/if}
