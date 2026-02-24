<script lang="ts">
	import { draggable } from '@neodrag/svelte';
	import type { FloatingPaneState, PaneWidgetType } from '$lib/types';
	import GraphWidget from '$lib/components/widgets/GraphWidget.svelte';
	import MapWidget from '$lib/components/widgets/MapWidget.svelte';
	import TableWidget from '$lib/components/widgets/TableWidget.svelte';
	import GaugeWidget from '$lib/components/widgets/GaugeWidget.svelte';
	import LoadDataWidget from '$lib/components/widgets/LoadDataWidget.svelte';

	type Props = {
		pane: FloatingPaneState;
		onClose: (id: string) => void;
		onFocus: (id: string) => void;
		onDock: (id: string) => void;
	};

	let { pane, onClose, onFocus, onDock }: Props = $props();

	const WIDGET_LABELS: Record<PaneWidgetType, string> = {
		graph: 'Graph',
		map: 'Map',
		table: 'Table',
		gauge: 'Gauge',
		'load-data': 'Load Data'
	};

	// Use $derived so width/height stay in sync if pane prop changes
	const width = $derived(pane.width);
	const height = $derived(pane.height);
</script>

<div
	use:draggable={{
		handle: '.drag-handle',
		bounds: 'parent',
		defaultPosition: { x: pane.x, y: pane.y }
	}}
	class="absolute flex flex-col overflow-hidden rounded-lg border border-stone-300 bg-white shadow-xl"
	style="width:{width}px; height:{height}px; z-index:{pane.zIndex}; resize:both; min-width:200px; min-height:140px;"
	onmousedown={() => onFocus(pane.id)}
	role="dialog"
	tabindex="-1"
	aria-label={WIDGET_LABELS[pane.type]}
>
	<!-- Title bar (drag handle) -->
	<div
		class="drag-handle flex shrink-0 cursor-grab items-center gap-1 border-b border-stone-200 bg-stone-100 px-2 py-1 active:cursor-grabbing"
	>
		<span class="flex-1 select-none text-xs font-medium text-stone-600">
			{WIDGET_LABELS[pane.type]}
		</span>
		<button
			onclick={() => onDock(pane.id)}
			title="Dock into tiled layout"
			class="rounded px-1 py-0.5 text-xs text-stone-400 hover:bg-stone-200 hover:text-stone-700"
		>
			⬢
		</button>
		<button
			onclick={() => onClose(pane.id)}
			title="Close"
			class="rounded px-1 py-0.5 text-xs text-stone-400 hover:bg-red-100 hover:text-red-600"
		>
			✕
		</button>
	</div>

	<!-- Widget content -->
	<div class="min-h-0 flex-1 overflow-hidden">
		{#if pane.type === 'graph'}
			<GraphWidget />
		{:else if pane.type === 'map'}
			<MapWidget />
		{:else if pane.type === 'table'}
			<TableWidget />
		{:else if pane.type === 'gauge'}
			<GaugeWidget />
		{:else if pane.type === 'load-data'}
			<LoadDataWidget />
		{/if}
	</div>
</div>
