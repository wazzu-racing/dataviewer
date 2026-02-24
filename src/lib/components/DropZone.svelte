<script lang="ts">
	import type { DropPosition, PaneWidgetType } from '$lib/types';

	type Props = {
		nodeId: string;
		onDrop: (nodeId: string, widgetType: PaneWidgetType, position: DropPosition) => void;
		children: import('svelte').Snippet;
	};

	let { nodeId, onDrop, children }: Props = $props();

	let isDraggingOver = $state(false);
	let dropPosition: DropPosition | null = $state(null);

	function getDropPosition(event: DragEvent, el: HTMLElement): DropPosition {
		const rect = el.getBoundingClientRect();
		const x = event.clientX - rect.left;
		const y = event.clientY - rect.top;
		const w = rect.width;
		const h = rect.height;

		// 25% edge zones
		const edgeFraction = 0.25;
		const leftEdge = w * edgeFraction;
		const rightEdge = w * (1 - edgeFraction);
		const topEdge = h * edgeFraction;
		const bottomEdge = h * (1 - edgeFraction);

		if (y < topEdge) return 'top';
		if (y > bottomEdge) return 'bottom';
		if (x < leftEdge) return 'left';
		if (x > rightEdge) return 'right';
		return 'center';
	}

	function isDraggingPaneType(event: DragEvent): boolean {
		return event.dataTransfer?.types.includes('application/pane-type') ?? false;
	}

	function handleDragOver(event: DragEvent) {
		if (!isDraggingPaneType(event)) return;
		event.preventDefault();
		if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
		isDraggingOver = true;
		dropPosition = getDropPosition(event, event.currentTarget as HTMLElement);
	}

	function handleDragLeave(event: DragEvent) {
		// Only clear if leaving the zone itself, not entering a child
		const target = event.currentTarget as HTMLElement;
		const related = event.relatedTarget as Node | null;
		if (!related || !target.contains(related)) {
			isDraggingOver = false;
			dropPosition = null;
		}
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		isDraggingOver = false;
		const widgetType = event.dataTransfer?.getData('application/pane-type') as
			| PaneWidgetType
			| undefined;
		if (!widgetType || !dropPosition) return;
		onDrop(nodeId, widgetType, dropPosition);
		dropPosition = null;
	}
</script>

<div
	class="relative h-full w-full"
	role="region"
	ondragover={handleDragOver}
	ondragleave={handleDragLeave}
	ondrop={handleDrop}
>
	{@render children()}

	{#if isDraggingOver && dropPosition}
		<!-- Directional drop indicators -->
		{#if dropPosition === 'top'}
			<div
				class="pointer-events-none absolute inset-x-0 top-0 z-50 h-1 bg-blue-500 shadow-lg"
			></div>
			<div class="pointer-events-none absolute inset-0 z-40 bg-blue-500/10"></div>
		{:else if dropPosition === 'bottom'}
			<div
				class="pointer-events-none absolute inset-x-0 bottom-0 z-50 h-1 bg-blue-500 shadow-lg"
			></div>
			<div class="pointer-events-none absolute inset-0 z-40 bg-blue-500/10"></div>
		{:else if dropPosition === 'left'}
			<div
				class="pointer-events-none absolute inset-y-0 left-0 z-50 w-1 bg-blue-500 shadow-lg"
			></div>
			<div class="pointer-events-none absolute inset-0 z-40 bg-blue-500/10"></div>
		{:else if dropPosition === 'right'}
			<div
				class="pointer-events-none absolute inset-y-0 right-0 z-50 w-1 bg-blue-500 shadow-lg"
			></div>
			<div class="pointer-events-none absolute inset-0 z-40 bg-blue-500/10"></div>
		{:else if dropPosition === 'center'}
			<div
				class="pointer-events-none absolute inset-2 z-50 flex items-center justify-center rounded border-2 border-dashed border-blue-500 bg-blue-500/15"
			>
				<span class="rounded bg-blue-500 px-2 py-1 text-sm font-semibold text-white">+</span>
			</div>
		{/if}
	{/if}
</div>
