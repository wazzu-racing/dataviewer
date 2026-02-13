<script lang="ts">
	import type { DropPosition } from '$lib/types';
	import { dragState } from '$lib/stores/dragStore';

	export let nodeId: string;
	export let onDrop: (nodeId: string, paneType: string, position: DropPosition) => void;
	export let onMove: (
		sourceId: string,
		targetId: string,
		position: DropPosition
	) => void = () => {};

	// Constants for drop position detection
	const CENTER_DROP_THRESHOLD = 0.25; // 25% of smallest dimension

	let isDraggingOver = false;
	let dropPosition: DropPosition | null = null;

	$: dragOperation = $dragState?.operation || null;
	$: dragSourceId = $dragState?.nodeId || null;

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		if (!event.dataTransfer) return;

		// Check if we're trying to drop on self
		if (dragOperation === 'move' && dragSourceId === nodeId) {
			event.dataTransfer.dropEffect = 'none';
			isDraggingOver = false;
			dropPosition = null;
			return;
		}

		event.dataTransfer.dropEffect = dragOperation === 'move' ? 'move' : 'copy';
		isDraggingOver = true;

		// Calculate drop position based on mouse position
		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
		const x = event.clientX - rect.left;
		const y = event.clientY - rect.top;

		const centerX = rect.width / 2;
		const centerY = rect.height / 2;

		const distanceFromCenter = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
		const threshold = Math.min(rect.width, rect.height) * CENTER_DROP_THRESHOLD;

		if (distanceFromCenter < threshold) {
			dropPosition = 'center';
		} else {
			// Determine which edge is closest
			const distances = {
				top: y,
				bottom: rect.height - y,
				left: x,
				right: rect.width - x
			};

			let closest: DropPosition = 'top';
			let minDist = distances.top;

			if (distances.bottom < minDist) {
				closest = 'bottom';
				minDist = distances.bottom;
			}
			if (distances.left < minDist) {
				closest = 'left';
				minDist = distances.left;
			}
			if (distances.right < minDist) {
				closest = 'right';
			}

			dropPosition = closest;
		}
	}

	function handleDragLeave(event: DragEvent) {
		// Only hide if we're actually leaving the drop zone (not entering a child)
		const relatedTarget = event.relatedTarget as HTMLElement;
		if (!relatedTarget || !(event.currentTarget as HTMLElement).contains(relatedTarget)) {
			isDraggingOver = false;
			dropPosition = null;
		}
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		event.stopPropagation();

		if (!dropPosition || !$dragState) {
			return;
		}

		// Use the drag state store instead of trying to parse event data
		const dragItem = $dragState;

		if (dragItem.operation === 'move' && dragItem.nodeId) {
			// Moving an existing pane
			if (dragItem.nodeId !== nodeId) {
				onMove(dragItem.nodeId, nodeId, dropPosition);
			}
		} else if (dragItem.paneType) {
			// Adding a new pane
			onDrop(nodeId, dragItem.paneType, dropPosition);
		}

		isDraggingOver = false;
		dropPosition = null;
	}
</script>

<div
	class="drop-zone"
	on:dragover={handleDragOver}
	on:dragleave={handleDragLeave}
	on:drop={handleDrop}
	role="button"
	tabindex="0"
>
	<slot />

	{#if isDraggingOver && dropPosition}
		{@const isMove = dragOperation === 'move'}
		{@const orientationClass =
			dropPosition === 'top' || dropPosition === 'bottom'
				? 'horizontal'
				: dropPosition === 'center'
					? 'center'
					: 'vertical'}
		<div class="drop-indicator-container">
			<div class="drop-indicator {orientationClass} {dropPosition} {isMove ? 'move' : ''}">
				{#if dropPosition === 'center'}
					<div class="center-overlay {isMove ? 'move' : ''}">
						<div class="center-icon">{isMove ? '↔' : '+'}</div>
						<div class="center-text">{isMove ? 'Move here' : 'Drop to split'}</div>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	.drop-zone {
		position: relative;
		width: 100%;
		height: 100%;
	}

	.drop-indicator-container {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		pointer-events: none;
		z-index: 1000;
	}

	.drop-indicator {
		position: absolute;
		background: rgba(59, 130, 246, 0.5);
		border: 2px solid rgb(59, 130, 246);
		animation: pulse 1s ease-in-out infinite;
	}

	.drop-indicator.move {
		background: rgba(168, 85, 247, 0.5);
		border: 2px solid rgb(168, 85, 247);
	}

	.drop-indicator.horizontal {
		left: 0;
		right: 0;
		height: 8px;
	}

	.drop-indicator.horizontal.top {
		top: 0;
		border-radius: 4px 4px 0 0;
	}

	.drop-indicator.horizontal.bottom {
		bottom: 0;
		border-radius: 0 0 4px 4px;
	}

	.drop-indicator.vertical {
		top: 0;
		bottom: 0;
		width: 8px;
	}

	.drop-indicator.vertical.left {
		left: 0;
		border-radius: 4px 0 0 4px;
	}

	.drop-indicator.vertical.right {
		right: 0;
		border-radius: 0 4px 4px 0;
	}

	.drop-indicator.center {
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(59, 130, 246, 0.2);
		border: 3px dashed rgb(59, 130, 246);
		border-radius: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.center-overlay {
		background: rgba(59, 130, 246, 0.9);
		color: white;
		padding: 2rem;
		border-radius: 12px;
		text-align: center;
		box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
	}

	.center-overlay.move {
		background: rgba(168, 85, 247, 0.9);
	}

	.center-icon {
		font-size: 3rem;
		font-weight: bold;
		margin-bottom: 0.5rem;
	}

	.center-text {
		font-size: 1.125rem;
		font-weight: 600;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.6;
		}
	}
</style>
