<script lang="ts">
	import type { PaneWidgetType, GraphConfig, TableConfig, GaugeConfig } from '$lib/types';
	import GraphWidget from '$lib/components/widgets/GraphWidget.svelte';
	import MapWidget from '$lib/components/widgets/MapWidget.svelte';
	import TableWidget from '$lib/components/widgets/TableWidget.svelte';
	import GaugeWidget from '$lib/components/widgets/GaugeWidget.svelte';
	import LoadDataWidget from '$lib/components/widgets/LoadDataWidget.svelte';
	import MetadataWidget from '$lib/components/widgets/MetadataWidget.svelte';

	type Props = {
		type: PaneWidgetType;
		config?: Record<string, unknown>;
		onConfigChange?: (cfg: Record<string, unknown>) => void;
		/** Called when the widget requests its own dismissal (e.g. LoadDataWidget "done") */
		onDismiss?: () => void;
	};

	let { type, config, onConfigChange, onDismiss }: Props = $props();
</script>

{#if type === 'graph'}
	<div data-testid="widget-renderer-graph">
		<GraphWidget
			config={config as GraphConfig | undefined}
			onConfigChange={onConfigChange as ((cfg: GraphConfig) => void) | undefined}
		/>
	</div>
{:else if type === 'map'}
	<div data-testid="widget-renderer-map">
		<MapWidget />
	</div>
{:else if type === 'table'}
	<div data-testid="widget-renderer-table">
		<TableWidget
			config={config as TableConfig | undefined}
			onConfigChange={onConfigChange as ((cfg: TableConfig) => void) | undefined}
		/>
	</div>
{:else if type === 'gauge'}
	<div data-testid="widget-renderer-gauge">
		<GaugeWidget
			config={config as GaugeConfig | undefined}
			onConfigChange={onConfigChange as ((cfg: GaugeConfig) => void) | undefined}
		/>
	</div>
{:else if type === 'load-data'}
	<div data-testid="widget-renderer-load-data">
		<LoadDataWidget onDismiss={onDismiss} />
	</div>
{:else if type === 'metadata'}
	<div data-testid="widget-renderer-metadata">
		<MetadataWidget {onConfigChange} />
	</div>
{:else}
	<div
		data-testid="widget-renderer-unknown"
		class="flex h-full items-center justify-center text-sm text-stone-400"
	>
		Unknown widget type: {type}
	</div>
{/if}
