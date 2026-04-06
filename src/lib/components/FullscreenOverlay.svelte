<script lang="ts">
	import {
		WIDGET_LABELS,
		type PaneWidgetType,
		type GraphConfig,
		type TableConfig,
		type GaugeConfig
	} from '$lib/types';
	import GraphWidget from '$lib/components/widgets/GraphWidget.svelte';
	import MapWidget from '$lib/components/widgets/MapWidget.svelte';
	import TableWidget from '$lib/components/widgets/TableWidget.svelte';
	import GaugeWidget from '$lib/components/widgets/GaugeWidget.svelte';
	import LoadDataWidget from '$lib/components/widgets/LoadDataWidget.svelte';
	import MetadataWidget from '$lib/components/widgets/MetadataWidget.svelte';

	type Props = {
		node: { id: string; type: PaneWidgetType; isFloating: boolean };
		config: any;
		onClose: () => void;
		onConfigChange: (config: Record<string, unknown>) => void;
	};

	let { node, config, onClose, onConfigChange }: Props = $props();
</script>

<div class="fixed inset-0 z-[500] flex flex-col bg-white dark:bg-neutral-950">
	<div
		class="flex shrink-0 items-center gap-1 border-b border-border dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800 px-4 py-2"
	>
		<span class="flex-1 text-sm font-semibold text-primary-900 dark:text-neutral-100">
			{WIDGET_LABELS[node.type]} (Fullscreen)
		</span>
		<button
			onclick={onClose}
			title="Exit Fullscreen"
			class="rounded px-2 py-1 text-sm text-stone-400 dark:text-neutral-300 hover:bg-primary/10 dark:hover:bg-primary/20 hover:text-primary transition-colors"
		>
			✕ Exit Fullscreen
		</button>
	</div>
	<div class="flex-1 min-h-0 overflow-hidden">
		{#if node.type === 'graph'}
			<GraphWidget config={config as GraphConfig | undefined} {onConfigChange} />
		{:else if node.type === 'map'}
			<MapWidget />
		{:else if node.type === 'table'}
			<TableWidget config={config as TableConfig | undefined} {onConfigChange} />
		{:else if node.type === 'gauge'}
			<GaugeWidget config={config as GaugeConfig | undefined} {onConfigChange} />
		{:else if node.type === 'load-data'}
			<LoadDataWidget onDismiss={onClose} />
		{:else if node.type === 'metadata'}
			<MetadataWidget {onConfigChange} />
		{/if}
	</div>
</div>
