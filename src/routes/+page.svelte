<script lang="ts">
	import PaneLayout from './PaneLayout.svelte';
	import type { LayoutNode } from '$lib/types';

	// Example: Complex nested layout
	// let layout: LayoutNode = {
	// 	type: 'horizontal',
	// 	panes: [
	// 		{
	// 			type: 'vertical',
	// 			defaultSize: 50,
	// 			panes: [
	// 				{
	// 					type: 'leaf',
	// 					defaultSize: 50
	// 				},
	// 				{
	// 					type: 'leaf',
	// 					defaultSize: 50
	// 				}
	// 			]
	// 		},
	// 		{
	// 			type: 'vertical',
	// 			defaultSize: 50,
	// 			panes: [
	// 				{
	// 					type: 'graph',
	// 					defaultSize: 60
	// 				},
	// 				{
	// 					type: 'map',
	// 					defaultSize: 40
	// 				}
	// 			]
	// 		}
	// 	]
	// };

	// Example: Simple two-pane layout
	// let layout: LayoutNode = {
	// 	type: 'horizontal',
	// 	panes: [
	// 		{ type: 'leaf', defaultSize: 50 },
	// 		{ type: 'leaf', defaultSize: 50 }
	// 	]
	// };

	// Example: Three levels deep
	let layout: LayoutNode = {
		type: 'horizontal',
		panes: [
			{
				type: 'vertical',
				defaultSize: 33,
				panes: [
					{ type: 'leaf', defaultSize: 50 },
					{
						type: 'horizontal',
						defaultSize: 50,
						panes: [
							{ type: 'graph', defaultSize: 50 },
							{ type: 'map', defaultSize: 50 }
						]
					}
				]
			},
			{ type: 'leaf', defaultSize: 33 },
			{ type: 'leaf', defaultSize: 34 }
		]
	};
</script>

<div class="h-screen w-full">
	<PaneLayout {layout} />
</div>
