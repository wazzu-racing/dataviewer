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

	type Props = {
		layout: LayoutNode;
		onDrop: (nodeId: string, widgetType: PaneWidgetType, position: DropPosition) => void;
		onRemove: (nodeId: string) => void;
		onPopOut: (nodeId: string) => void;
		onConfigChange: (nodeId: string, config: Record<string, unknown>) => void;
	};

	let { layout, onDrop, onRemove, onPopOut, onConfigChange }: Props = $props();

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
				<PaneLayout layout={child} {onDrop} {onRemove} {onPopOut} {onConfigChange} />
			</Pane>
			{#if i < (layout.panes?.length ?? 0) - 1}
				<PaneResizer
					class={layout.type === 'horizontal'
						? 'w-1 cursor-col-resize bg-stone-200 transition-colors hover:bg-blue-400 active:bg-blue-500'
						: 'h-1 cursor-row-resize bg-stone-200 transition-colors hover:bg-blue-400 active:bg-blue-500'}
				/>
			{/if}
		{/each}
	</PaneGroup>
{:else}
	<!-- Leaf / widget node -->
	<div class="flex h-full w-full flex-col overflow-hidden border border-stone-200 bg-white">
		<!-- Title bar -->
		<div
			class="flex shrink-0 items-center gap-1 border-b border-stone-200 bg-stone-100 px-2 py-0.5"
		>
			<span class="flex-1 text-xs font-medium text-stone-600">
				{WIDGET_LABELS[layout.type as PaneWidgetType] ?? layout.type}
			</span>
			<button
				onclick={() => onPopOut(layout.id)}
				title="Pop out into floating window"
				class="rounded px-1 py-0.5 text-xs text-stone-400 hover:bg-stone-200 hover:text-stone-700"
			>
				⬡
			</button>
			<button
				onclick={() => onRemove(layout.id)}
				title="Close pane"
				class="rounded px-1 py-0.5 text-xs text-stone-400 hover:bg-red-100 hover:text-red-600"
			>
				✕
			</button>
		</div>

		<!-- Widget content wrapped in a drop zone -->
		<div class="min-h-0 flex-1 overflow-hidden">
			<DropZone nodeId={layout.id} {onDrop}>
				{#if layout.type === 'graph'}
					<GraphWidget
						config={layout.config as GraphConfig | undefined}
						onConfigChange={(cfg) => onConfigChange(layout.id, cfg as Record<string, unknown>)}
					/>
				{:else if layout.type === 'map'}
					<MapWidget />
				{:else if layout.type === 'table'}
					<TableWidget />
				{:else if layout.type === 'gauge'}
					<GaugeWidget />
				{:else if layout.type === 'load-data'}
					<LoadDataWidget />
				{:else}
					<div class="flex h-full items-center justify-center text-sm text-stone-400">
						Unknown widget type: {layout.type}
					</div>
				{/if}
			</DropZone>
		</div>
	</div>
{/if}
