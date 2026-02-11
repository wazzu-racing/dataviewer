<script lang="ts">
	import { PaneGroup, Pane, PaneResizer } from 'paneforge';
	import type { LayoutNode } from '$lib/types';

	export let layout: LayoutNode;

	export let depth: number = 0;
</script>

{#if layout.type === 'horizontal' || layout.type === 'vertical'}
	<PaneGroup direction={layout.type} class="h-full w-full">
		{#each layout.panes || [] as pane, i (i)}
			<Pane
				defaultSize={pane.defaultSize || 50}
				minSize={pane.minSize || 20}
				class="flex items-center justify-center"
			>
				<svelte:self layout={pane} depth={depth + 1} />
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
	<!-- Custom pane types like graph, map, etc. -->
	<div class="h-full w-full bg-white border border-gray-200 p-6">
		<h2 class="text-2xl font-semibold text-gray-800 mb-4 capitalize">{layout.type}</h2>
		<p class="text-gray-600">Custom pane type: {layout.type} (depth: {depth})</p>
	</div>
{/if}
