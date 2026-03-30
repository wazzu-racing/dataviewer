<script lang="ts">
	import { PaneGroup, Pane, PaneResizer } from 'paneforge';
	import type { LayoutNode, DropPosition, PaneWidgetType, GraphConfig } from '$lib/types';
	import PaneLayout from '$lib/components/PaneLayout.svelte';
	import DropZone from '$lib/components/DropZone.svelte';
	import GraphWidget from '$lib/components/widgets/GraphWidget.svelte';
	import MapWidget from '$lib/components/widgets/MapWidget.svelte';
	import TableWidget from '$lib/components/widgets/TableWidget.svelte';
	import GaugeWidget from '$lib/components/widgets/GaugeWidget.svelte';
	import LoadDataWidget from '$lib/components/widgets/LoadDataWidget.svelte';

	import { dragState } from '$lib/dragState.svelte';

	type Props = {
		layout: LayoutNode;
		onDrop: (nodeId: string, widgetType: PaneWidgetType, position: DropPosition) => void;
		onRemove: (nodeId: string) => void;
		onPopOut: (nodeId: string) => void;
		onConfigChange: (nodeId: string, config: Record<string, unknown>) => void;
		onMove?: (sourceId: string, nodeId: string, position: DropPosition) => void;
	};

	let { layout, onDrop, onRemove, onPopOut, onConfigChange, onMove }: Props = $props();

	// Drag events for tile move
	const canMove = $derived(typeof onMove === 'function');

	function handleDragStart(event: DragEvent) {
		if (!canMove) return;
		event.dataTransfer?.setData('application/pane-id', layout.id);
		event.dataTransfer!.effectAllowed = 'move';
		dragState.draggingPaneId = layout.id;

		// Create ghost
		const target = event.target as HTMLElement;
		if (target) {
			const ghost = target.cloneNode(true) as HTMLElement;
			ghost.style.position = 'absolute';
			ghost.style.top = '-9999px';
			ghost.style.left = '-9999px';
			ghost.style.opacity = '0.6';
			ghost.style.pointerEvents = 'none';
			document.body.appendChild(ghost);
			setTimeout(() => {
				event.dataTransfer!.setDragImage(ghost, ghost.offsetWidth / 2, ghost.offsetHeight / 2);
				setTimeout(() => document.body.removeChild(ghost), 50);
			}, 0);
		}
	}

	function handleDragEnd(_event: DragEvent) {
		dragState.draggingPaneId = null;
	}

	const WIDGET_LABELS: Record<PaneWidgetType, string> = {
		graph: 'Graph',
		map: 'Map',
		table: 'Table',
		gauge: 'Gauge',
		'load-data': 'Load Data'
	};
</script>

{#if layout.type === 'horizontal' || layout.type === 'vertical'}
	<PaneGroup
		direction={layout.type === 'horizontal' ? 'horizontal' : 'vertical'}
		class="h-full w-full"
	>
		{#each layout.panes ?? [] as child, i (child.id)}
			<Pane defaultSize={child.defaultSize ?? 50} minSize={child.minSize ?? 5}>
				<!-- Recurse -->
				<PaneLayout layout={child} {onDrop} {onRemove} {onPopOut} {onConfigChange} {onMove} />
			</Pane>
			{#if i < (layout.panes?.length ?? 0) - 1}
				<PaneResizer
					class={layout.type === 'horizontal'
						? 'w-1 cursor-col-resize bg-border dark:bg-neutral-800 transition-colors hover:bg-primary/40 active:bg-primary/60'
						: 'h-1 cursor-row-resize bg-border dark:bg-neutral-800 transition-colors hover:bg-primary/40 active:bg-primary/60'}
				/>
			{/if}
		{/each}
	</PaneGroup>
{:else}
	<!-- Leaf / widget node -->
	<div
		class="flex h-full w-full flex-col overflow-hidden border border-border dark:border-neutral-800 rounded-lg shadow-card bg-card dark:bg-neutral-900"
	>
		<!-- Title bar -->
		{#if canMove}
			<div
				class="flex shrink-0 items-center gap-1 border-b border-border dark:border-neutral-800 bg-background dark:bg-neutral-800 px-3 py-1"
				role="toolbar"
				aria-label="Pane header"
				tabindex="0"
				draggable={true}
				ondragstart={handleDragStart}
				ondragend={handleDragEnd}
			>
				<span class="flex-1 text-xs font-semibold text-primary dark:text-neutral-100">
					{WIDGET_LABELS[layout.type as PaneWidgetType] ?? layout.type}
				</span>
				<button
					onclick={() => onPopOut(layout.id)}
					title="Pop out into floating window"
					class="rounded px-1 py-0.5 text-xs text-stone-400 dark:text-neutral-300 hover:bg-primary/10 dark:hover:bg-primary/20 hover:text-primary dark:hover:text-primary-100"
				>
					⬡
				</button>
				<button
					onclick={() => onRemove(layout.id)}
					title="Close pane"
					class="rounded px-1 py-0.5 text-xs text-stone-400 dark:text-neutral-300 hover:bg-red-100 dark:hover:bg-red-800 hover:text-red-600 dark:hover:text-red-100"
				>
					✕
				</button>
			</div>
		{:else}
			<div
				class="flex shrink-0 items-center gap-1 border-b border-border dark:border-neutral-800 bg-background dark:bg-neutral-800 px-3 py-1"
			>
				<span class="flex-1 text-xs font-semibold text-primary dark:text-neutral-100">
					{WIDGET_LABELS[layout.type as PaneWidgetType] ?? layout.type}
				</span>
				<button
					onclick={() => onPopOut(layout.id)}
					title="Pop out into floating window"
					class="rounded px-1 py-0.5 text-xs text-stone-400 dark:text-neutral-300 hover:bg-primary/10 dark:hover:bg-primary/20 hover:text-primary dark:hover:text-primary-100"
				>
					⬡
				</button>
				<button
					onclick={() => onRemove(layout.id)}
					title="Close pane"
					class="rounded px-1 py-0.5 text-xs text-stone-400 dark:text-neutral-300 hover:bg-red-100 dark:hover:bg-red-800 hover:text-red-600 dark:hover:text-red-100"
				>
					✕
				</button>
			</div>
		{/if}

		<!-- Widget content wrapped in a drop zone -->
		<div class="min-h-0 flex-1 overflow-hidden">
			<DropZone nodeId={layout.id} {onDrop} {onMove}>
				{#if layout.type === 'graph'}
					<GraphWidget
						config={layout.config as GraphConfig | undefined}
						onConfigChange={(cfg) => onConfigChange(layout.id, cfg as Record<string, unknown>)}
					/>
				{:else if layout.type === 'map'}
					<MapWidget />
				{:else if layout.type === 'table'}
					<TableWidget
						config={layout.config as any}
						onConfigChange={(cfg) => onConfigChange(layout.id, cfg as Record<string, unknown>)}
					/>
				{:else if layout.type === 'gauge'}
					<GaugeWidget
						config={layout.config as any}
						onConfigChange={(cfg) => onConfigChange(layout.id, cfg as Record<string, unknown>)}
					/>
				{:else if layout.type === 'load-data'}
					<LoadDataWidget onDismiss={() => onRemove(layout.id)} />
				{:else}
					<div class="flex h-full items-center justify-center text-sm text-stone-400">
						Unknown widget type: {layout.type}
					</div>
				{/if}
			</DropZone>
		</div>
	</div>
{/if}
