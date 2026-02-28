<script lang="ts">
	import type { PaneWidgetType } from '$lib/types';

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
		}
	];

	function handleDragStart(event: DragEvent, type: PaneWidgetType) {
		if (!event.dataTransfer) return;
		event.dataTransfer.setData('application/pane-type', type);
		event.dataTransfer.effectAllowed = 'copy';
	}
</script>

<aside
	class="flex h-full w-14 flex-col items-center gap-1 border-r border-stone-200 bg-stone-50 py-2"
>
	{#each PANE_TYPES as { type, label, icon, colorClass } (type)}
		<button
			draggable="true"
			ondragstart={(e) => handleDragStart(e, type)}
			title={label}
			class="flex w-10 cursor-grab flex-col items-center justify-center gap-0.5 rounded p-1.5 text-stone-600 transition-colors active:cursor-grabbing {colorClass}"
		>
			<span class="text-xl leading-none">{icon}</span>
			<span class="text-[9px] font-medium leading-none">{label}</span>
		</button>
	{/each}
</aside>
