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
		layout = ensureIds(insertPane(layout, nodeId, paneType, position));
	}

	function handleMove(sourceId: string, targetId: string, position: DropPosition) {
		const newLayout = movePane(layout, sourceId, targetId, position);
		if (newLayout) {
			layout = ensureIds(newLayout);
		}
	}

	function handleRemove(nodeId: string) {
		const newLayout = removePane(layout, nodeId);
		if (newLayout) {
			layout = ensureIds(newLayout);
		}
	}

	// For more layout examples, see QUICK_START.md
</script>

<div class="h-screen w-full flex">
	<!-- Sidebar with draggable pane types -->
	<PaneToolbar />

	<!-- Main layout area -->
	<div class="flex-1 overflow-hidden">
		<PaneLayout {layout} onDrop={handleDrop} onMove={handleMove} onRemove={handleRemove} />
	</div>
</div>
