<script lang="ts">
	import type { DragItem } from '$lib/types';
	import { startDrag, endDrag } from '$lib/stores/dragStore';

	type PaneType = {
		type: string;
		label: string;
		icon: string;
		color: string;
	};

	const paneTypes: PaneType[] = [
		{ type: 'leaf', label: 'Blank', icon: '📄', color: 'bg-gray-100 hover:bg-gray-200' },
		{ type: 'graph', label: 'Graph', icon: '📊', color: 'bg-blue-100 hover:bg-blue-200' },
		{ type: 'map', label: 'Map', icon: '🗺️', color: 'bg-green-100 hover:bg-green-200' },
		{ type: 'table', label: 'Table', icon: '📋', color: 'bg-purple-100 hover:bg-purple-200' },
		{ type: 'video', label: 'Video', icon: '🎥', color: 'bg-red-100 hover:bg-red-200' }
	];

	function handleDragStart(event: DragEvent, paneType: string) {
		if (!event.dataTransfer) return;

		const dragItem: DragItem = {
			paneType,
			operation: 'add'
		};

		// Store in drag state for access during dragover
		startDrag(dragItem);

		event.dataTransfer.effectAllowed = 'copy';
		event.dataTransfer.setData('application/json', JSON.stringify(dragItem));

		// Create a custom drag image
		const dragImage = (event.target as HTMLElement).cloneNode(true) as HTMLElement;
		dragImage.style.opacity = '0.8';
		dragImage.style.position = 'absolute';
		dragImage.style.top = '-9999px';
		document.body.appendChild(dragImage);
		event.dataTransfer.setDragImage(dragImage, 50, 25);

		// Clean up reliably using requestAnimationFrame
		requestAnimationFrame(() => {
			if (dragImage.parentNode) {
				document.body.removeChild(dragImage);
			}
		});
	}

	function handleDragEnd() {
		endDrag();
	}
</script>

<div class="pane-toolbar bg-gray-800 text-white p-4 shadow-lg">
	<h3 class="text-lg font-semibold mb-3">Pane Types</h3>
	<p class="text-sm text-gray-400 mb-4">Drag to add to layout</p>

	<div class="grid grid-cols-1 gap-2">
		{#each paneTypes as paneType (paneType.type)}
			<button
				draggable="true"
				on:dragstart={(e) => handleDragStart(e, paneType.type)}
				on:dragend={handleDragEnd}
				class="pane-type-button {paneType.color} border-2 border-transparent hover:border-gray-600 rounded-lg p-3 cursor-move transition-all duration-200 flex items-center gap-3 text-gray-800 font-medium"
			>
				<span class="text-2xl">{paneType.icon}</span>
				<span class="flex-1 text-left">{paneType.label}</span>
				<span class="text-xs text-gray-500">⋮⋮</span>
			</button>
		{/each}
	</div>

	<div class="mt-6 pt-4 border-t border-gray-600">
		<p class="text-xs text-gray-400">
			💡 <strong>Tip:</strong> Drop on edges to split, or center to replace
		</p>
	</div>
</div>

<style>
	.pane-toolbar {
		min-width: 200px;
		max-width: 250px;
		height: 100%;
		overflow-y: auto;
	}

	.pane-type-button {
		user-select: none;
		-webkit-user-drag: element;
	}

	.pane-type-button:active {
		transform: scale(0.98);
	}
</style>
