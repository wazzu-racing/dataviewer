<script lang="ts">
	import { draggable } from '@neodrag/svelte';
	import {
		WIDGET_LABELS,
		type FloatingPaneState,
		type PaneWidgetType,
		type GraphConfig
	} from '$lib/types';
	import GraphWidget from '$lib/components/widgets/GraphWidget.svelte';
	import MapWidget from '$lib/components/widgets/MapWidget.svelte';
	import TableWidget from '$lib/components/widgets/TableWidget.svelte';
	import GaugeWidget from '$lib/components/widgets/GaugeWidget.svelte';
	import LoadDataWidget from '$lib/components/widgets/LoadDataWidget.svelte';
	import MetadataWidget from '$lib/components/widgets/MetadataWidget.svelte';

	type Props = {
		pane: FloatingPaneState;
		onClose: (id: string) => void;
		onFocus: (id: string) => void;
		onDock: (id: string) => void;
		onFullscreen?: (id: string) => void;
		onConfigChange: (id: string, config: Record<string, unknown>) => void;
		hidden?: boolean;
	};

	let {
		pane,
		onClose,
		onFocus,
		onDock,
		onFullscreen,
		onConfigChange,
		hidden = false
	}: Props = $props();

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
	class="absolute flex flex-col overflow-hidden rounded-lg border border-border dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-card"
	style="width:{width}px; height:{height}px; z-index:{pane.zIndex}; resize:both; min-width:200px; min-height:140px; {hidden
		? 'visibility:hidden;'
		: ''}"
	onmousedown={() => onFocus(pane.id)}
	role="dialog"
	tabindex="-1"
	aria-label={WIDGET_LABELS[pane.type]}
>
	<!-- Title bar (drag handle) -->
	<div
		class="drag-handle flex shrink-0 cursor-grab items-center gap-1 border-b border-border dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800 px-3 py-1 active:cursor-grabbing"
	>
		<span class="flex-1 select-none text-xs font-semibold text-primary-900 dark:text-neutral-100">
			{WIDGET_LABELS[pane.type]}
		</span>
		<button
			onclick={() => onDock(pane.id)}
			title="Dock into tiled layout"
			class="rounded px-1 py-0.5 text-xs text-stone-400 dark:text-neutral-300 hover:bg-primary/10 dark:hover:bg-primary/20 hover:text-primary dark:hover:text-primary-100"
		>
			⬢
		</button>
		<button
			onclick={() => onFullscreen?.(pane.id)}
			title="Fullscreen"
			class="rounded px-1 py-0.5 text-xs text-stone-400 dark:text-neutral-300 hover:bg-primary/10 dark:hover:bg-primary/20 hover:text-primary dark:hover:text-primary-100"
		>
			⛶
		</button>
		<button
			onclick={() => onClose(pane.id)}
			title="Close"
			class="rounded px-1 py-0.5 text-xs text-stone-400 dark:text-neutral-300 hover:bg-red-100 dark:hover:bg-red-800 hover:text-red-600 dark:hover:text-red-100"
		>
			✕
		</button>
	</div>

	<!-- Widget content -->
	<div class="min-h-0 flex-1 overflow-hidden">
		{#if pane.type === 'graph'}
			<GraphWidget
				config={pane.config as GraphConfig | undefined}
				onConfigChange={(cfg) => onConfigChange(pane.id, cfg as Record<string, unknown>)}
			/>
		{:else if pane.type === 'map'}
			<MapWidget />
		{:else if pane.type === 'table'}
			<TableWidget
				config={pane.config as any}
				onConfigChange={(cfg) => onConfigChange(pane.id, cfg as Record<string, unknown>)}
			/>
		{:else if pane.type === 'gauge'}
			<GaugeWidget
				config={pane.config as any}
				onConfigChange={(cfg) => onConfigChange(pane.id, cfg as Record<string, unknown>)}
			/>
		{:else if pane.type === 'load-data'}
			<LoadDataWidget />
		{:else if pane.type === 'metadata'}
			<MetadataWidget
				onConfigChange={(cfg) => onConfigChange(pane.id, cfg as Record<string, unknown>)}
			/>
		{/if}
	</div>
</div>
