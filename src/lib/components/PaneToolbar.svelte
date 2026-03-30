<script lang="ts">
	import type { PaneWidgetType } from '$lib/types';
	const { onAddPane }: { onAddPane?: (type: PaneWidgetType) => void } = $props();

	type PaneTypeInfo = {
		type: PaneWidgetType;
		label: string;
		icon: string;
		colorClass: string;
	};

	const PANE_TYPES: PaneTypeInfo[] = [
		{
			type: 'graph',
			label: 'Graph',
			icon: '📈',
			colorClass: 'hover:bg-blue-100 hover:text-blue-800'
		},
		{
			type: 'map',
			label: 'Map',
			icon: '🗺️',
			colorClass: 'hover:bg-green-100 hover:text-green-800'
		},
		{
			type: 'table',
			label: 'Table',
			icon: '🗄️',
			colorClass: 'hover:bg-purple-100 hover:text-purple-800'
		},
		{
			type: 'gauge',
			label: 'Gauge',
			icon: '🔢',
			colorClass: 'hover:bg-orange-100 hover:text-orange-800'
		},
		{
			type: 'load-data',
			label: 'Load Data',
			icon: '📂',
			colorClass: 'hover:bg-stone-100 hover:text-stone-800'
		},
		{
			type: 'metadata',
			label: 'Metadata',
			icon: '📝',
			colorClass: 'hover:bg-yellow-100 hover:text-yellow-800'
		}
	];

	function handleDragStart(event: DragEvent, type: PaneWidgetType) {
		if (!event.dataTransfer) return;
		event.dataTransfer.setData('application/pane-type', type);
		event.dataTransfer.effectAllowed = 'copy';
	}
</script>

<aside
	class="flex h-full w-16 flex-col items-center gap-2 border-r border-border bg-neutral-50 dark:bg-neutral-900 py-3"
>
	{#each PANE_TYPES as { type, label, icon, colorClass } (type)}
		<button
			draggable="true"
			ondragstart={(e) => handleDragStart(e, type)}
			onclick={() => {
				onAddPane && onAddPane(type);
			}}
			title={label}
			class="flex w-12 cursor-grab flex-col items-center justify-center gap-0.5 rounded-md p-2 text-zinc-700 dark:text-primary-50 shadow-sm bg-white dark:bg-neutral-800 hover:bg-primary/10 dark:hover:bg-primary/20 hover:text-primary dark:hover:text-primary-100 transition-colors active:cursor-grabbing {colorClass}"
		>
			<span class="text-xl leading-none">{icon}</span>
			<span class="text-[10px] font-semibold leading-none uppercase tracking-wider">{label}</span>
		</button>
	{/each}
</aside>
