<script lang="ts">
	import PaneLayout from './PaneLayout.svelte';
	import PaneToolbar from '$lib/components/PaneToolbar.svelte';
	import type { LayoutNode, DropPosition } from '$lib/types';
	import { ensureIds, insertPane, removePane, movePane } from '$lib/layoutUtils';

	// Start with a simple layout
	let layout: LayoutNode = ensureIds({
		type: 'horizontal',
		panes: [
			{
				type: 'vertical',
				defaultSize: 50,
				panes: [
					{ type: 'leaf', defaultSize: 50 },
					{ type: 'leaf', defaultSize: 50 }
				]
			},
			{ type: 'leaf', defaultSize: 50 }
		]
	});

	function handleDrop(nodeId: string, paneType: string, position: DropPosition) {
		console.log('Drop:', { nodeId, paneType, position });
		layout = ensureIds(insertPane(layout, nodeId, paneType, position));
	}

	function handleMove(sourceId: string, targetId: string, position: DropPosition) {
		console.log('Move:', { sourceId, targetId, position });
		const newLayout = movePane(layout, sourceId, targetId, position);
		if (newLayout) {
			layout = ensureIds(newLayout);
		}
	}

	function handleRemove(nodeId: string) {
		console.log('Remove:', nodeId);
		const newLayout = removePane(layout, nodeId);
		if (newLayout) {
			layout = ensureIds(newLayout);
		}
	}

	// Example layouts (commented out)
	// Complex nested layout:
	// let layout: LayoutNode = ensureIds({
	// 	type: 'horizontal',
	// 	panes: [
	// 		{
	// 			type: 'vertical',
	// 			defaultSize: 50,
	// 			panes: [
	// 				{ type: 'leaf', defaultSize: 50 },
	// 				{ type: 'leaf', defaultSize: 50 }
	// 			]
	// 		},
	// 		{
	// 			type: 'vertical',
	// 			defaultSize: 50,
	// 			panes: [
	// 				{ type: 'graph', defaultSize: 60 },
	// 				{ type: 'map', defaultSize: 40 }
	// 			]
	// 		}
	// 	]
	// });

	// Simple two-pane layout:
	// let layout: LayoutNode = ensureIds({
	// 	type: 'horizontal',
	// 	panes: [
	// 		{ type: 'leaf', defaultSize: 50 },
	// 		{ type: 'leaf', defaultSize: 50 }
	// 	]
	// });
</script>

<div class="h-screen w-full flex">
	<!-- Sidebar with draggable pane types -->
	<PaneToolbar />

	<!-- Main layout area -->
	<div class="flex-1 overflow-hidden">
		<PaneLayout {layout} onDrop={handleDrop} onMove={handleMove} onRemove={handleRemove} />
	</div>
</div>
