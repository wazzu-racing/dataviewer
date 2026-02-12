<script lang="ts">
	import { PaneGroup, Pane, PaneResizer } from 'paneforge';
	import type { LayoutNode, DropPosition, DragItem } from '$lib/types';
	import DropZone from '$lib/components/DropZone.svelte';
	import { startDrag, endDrag } from '$lib/stores/dragStore';
	import ReadData from '$lib/components/ReadData.svelte';

	export let layout: LayoutNode;
	export let depth: number = 0;
	export let onDrop: (nodeId: string, paneType: string, position: DropPosition) => void = () => {};
	export let onMove: (
		sourceId: string,
		targetId: string,
		position: DropPosition
	) => void = () => {};
	export let onRemove: (nodeId: string) => void = () => {};

	function handleDragStart(event: DragEvent, nodeId: string, paneType: string) {
		if (!event.dataTransfer) return;

		const dragItem: DragItem = {
			nodeId,
			paneType,
			operation: 'move'
		};

		startDrag(dragItem);

		event.dataTransfer.effectAllowed = 'move';
		event.dataTransfer.setData('application/json', JSON.stringify(dragItem));

		// Add visual feedback
		const target = event.currentTarget as HTMLElement;
		target.style.opacity = '0.5';
	}

	function handleDragEnd(event: DragEvent) {
		const target = event.currentTarget as HTMLElement;
		target.style.opacity = '1';
		endDrag();
	}

	// Get the node ID with a fallback to prevent undefined access
	$: nodeId = layout.id || '';
</script>

{#if layout.type === 'horizontal' || layout.type === 'vertical'}
	<PaneGroup direction={layout.type} class="h-full w-full">
		{#each layout.panes || [] as pane, i (pane.id || i)}
			<Pane
				defaultSize={pane.defaultSize || 50}
				minSize={pane.minSize || 20}
				class="flex items-center justify-center"
			>
				<svelte:self layout={pane} depth={depth + 1} {onDrop} {onMove} {onRemove} />
			</Pane>

			{#if i < (layout.panes?.length || 0) - 1}
				<PaneResizer
					class={layout.type === 'horizontal'
						? 'w-1 bg-gray-300 hover:bg-blue-500 transition-colors duration-200 cursor-col-resize active:bg-blue-600'
						: 'h-1 bg-gray-300 hover:bg-blue-500 transition-colors duration-200 cursor-row-resize active:bg-blue-600'}
				/>
			{/if}
		{/each}
	</PaneGroup>
{:else}
	<!-- Leaf or custom pane types with drop zone -->
	<DropZone {nodeId} {onDrop} {onMove}>
		<div class="h-full w-full bg-white border border-gray-200 relative pane-content">
			<!-- Drag Handle Header -->
			<div
				class="drag-handle"
				draggable="true"
				on:dragstart={(e) => handleDragStart(e, nodeId, layout.type)}
				on:dragend={handleDragEnd}
				role="button"
				tabindex="0"
				title="Drag to move this pane"
			>
				<span class="drag-icon">⋮⋮</span>
				<span class="pane-title">
					{#if layout.type === 'leaf'}
						Blank Pane
					{:else}
						<span class="capitalize">{layout.type}</span>
					{/if}
				</span>
				<button
					class="remove-button"
					on:click|stopPropagation={() => onRemove(nodeId)}
					title="Remove pane"
				>
					×
				</button>
			</div>

			<!-- Pane Content -->
			<div class="pane-body">
				{#if layout.type === 'leaf'}
					<div class="text-center">
						<p class="text-gray-400 text-lg mb-2">👈 Drag a pane from the sidebar</p>
						<p class="text-gray-500 text-sm">Drop it here or on the edges to split the view</p>
					</div>
				{:else if layout.type === 'loaddata'}
					<ReadData onClose={() => onRemove(nodeId)} />
					<!-- <p class="text-gray-600">Custom pane type: {layout.type} (depth: {depth})</p>
					<p class="text-sm text-gray-400 mt-2">ID: {nodeId}</p> -->
				{:else}
					<p class="text-gray-600">Custom pane type: {layout.type} (depth: {depth})</p>
					<p class="text-sm text-gray-400 mt-2">ID: {nodeId}</p>
				{/if}
			</div>
		</div>
	</DropZone>
{/if}

<style>
	.pane-content {
		transition: transform 0.1s ease;
		display: flex;
		flex-direction: column;
	}

	.drag-handle {
		background: linear-gradient(to bottom, #f9fafb 0%, #f3f4f6 100%);
		border-bottom: 1px solid #e5e7eb;
		padding: 0.5rem 1rem;
		cursor: move;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		user-select: none;
		transition: background-color 0.2s;
		flex-shrink: 0;
	}

	.drag-handle:hover {
		background: linear-gradient(to bottom, #f3f4f6 0%, #e5e7eb 100%);
	}

	.drag-handle:active {
		cursor: grabbing;
		background: #e5e7eb;
	}

	.drag-icon {
		color: #9ca3af;
		font-size: 1rem;
		font-weight: bold;
		line-height: 1;
	}

	.pane-title {
		flex: 1;
		font-weight: 600;
		font-size: 0.875rem;
		color: #374151;
	}

	.remove-button {
		background: #ef4444;
		color: white;
		border: none;
		border-radius: 9999px;
		width: 1.5rem;
		height: 1.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.125rem;
		font-weight: bold;
		cursor: pointer;
		transition: all 0.2s;
		z-index: 10;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
	}

	.remove-button:hover {
		background: #dc2626;
		transform: scale(1.1);
	}

	.pane-body {
		flex: 1;
		padding: 1.5rem;
		overflow: auto;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.capitalize {
		text-transform: capitalize;
	}
</style>
