<script lang="ts">
	import { browser } from '$app/environment';
	import type { LayoutNode, FloatingPaneState, PaneWidgetType, DropPosition } from '$lib/types';
	import { ensureIds, insertPane, removePane, findNode } from '$lib/layoutUtils';
	import PaneLayout from '$lib/components/PaneLayout.svelte';
	import PaneToolbar from '$lib/components/PaneToolbar.svelte';
	import FloatingPane from '$lib/components/FloatingPane.svelte';

	// ---------------------------------------------------------------------------
	// Default layout — shown the first time (no saved state)
	// ---------------------------------------------------------------------------
	function defaultLayout(): LayoutNode {
		return ensureIds({
			id: '',
			type: 'horizontal',
			panes: [
				{ id: '', type: 'load-data', defaultSize: 25, minSize: 15 },
				{ id: '', type: 'graph', defaultSize: 75, minSize: 20 }
			]
		});
	}

	// ---------------------------------------------------------------------------
	// Persistence helpers
	// ---------------------------------------------------------------------------
	function loadLayout(): LayoutNode | null {
		if (!browser) return null;
		try {
			const raw = localStorage.getItem('pane-layout');
			if (raw) return ensureIds(JSON.parse(raw) as LayoutNode);
		} catch {
			// corrupted — ignore
		}
		return null;
	}

	function loadFloating(): FloatingPaneState[] {
		if (!browser) return [];
		try {
			const raw = localStorage.getItem('floating-panes');
			if (raw) return JSON.parse(raw) as FloatingPaneState[];
		} catch {
			// corrupted — ignore
		}
		return [];
	}

	// ---------------------------------------------------------------------------
	// State
	// ---------------------------------------------------------------------------
	let layout: LayoutNode = $state(loadLayout() ?? defaultLayout());
	let floatingPanes: FloatingPaneState[] = $state(loadFloating());
	let topZ = $state(200);

	// ---------------------------------------------------------------------------
	// Persist on change
	// ---------------------------------------------------------------------------
	$effect(() => {
		if (browser) localStorage.setItem('pane-layout', JSON.stringify(layout));
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
			// Last pane removed — reset to default
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
</script>

<div class="flex h-screen w-full overflow-hidden bg-stone-100">
	<!-- Sidebar toolbar -->
	<PaneToolbar />

	<!-- Main tiled layout area + floating pane container -->
	<div class="relative flex-1 overflow-hidden">
		<PaneLayout {layout} onDrop={handleDrop} onRemove={handleRemove} onPopOut={handlePopOut} />

		<!-- Floating panes rendered on top -->
		{#each floatingPanes as pane (pane.id)}
			<FloatingPane
				{pane}
				onClose={handleFloatClose}
				onFocus={handleFloatFocus}
				onDock={handleDock}
			/>
		{/each}
	</div>
</div>
