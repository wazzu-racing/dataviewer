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
	<GraphWidget
		config={config as GraphConfig | undefined}
		onConfigChange={onConfigChange as ((cfg: GraphConfig) => void) | undefined}
	/>
{:else if type === 'map'}
	<MapWidget />
{:else if type === 'table'}
	<TableWidget
		config={config as TableConfig | undefined}
		onConfigChange={onConfigChange as ((cfg: TableConfig) => void) | undefined}
	/>
{:else if type === 'gauge'}
	<GaugeWidget
		config={config as GaugeConfig | undefined}
		onConfigChange={onConfigChange as ((cfg: GaugeConfig) => void) | undefined}
	/>
{:else if type === 'load-data'}
	<LoadDataWidget {onDismiss} />
{:else if type === 'metadata'}
	<MetadataWidget {onConfigChange} />
{:else}
	Unknown widget type: {type}
{/if}
