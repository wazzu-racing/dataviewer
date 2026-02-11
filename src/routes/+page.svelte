<script lang="ts">
	import { PaneGroup, Pane, PaneResizer } from 'paneforge';
</script>

<div class="h-screen w-full bg-gray-50">
	<PaneGroup direction="horizontal" class="h-full">
		<Pane defaultSize={50} minSize={20} class="flex items-center justify-center">
			<div class="h-full w-full bg-white border-r border-gray-200 p-6">
				<h2 class="text-2xl font-semibold text-gray-800 mb-4">Pane 1</h2>
				<p class="text-gray-600">Left pane content goes here</p>
			</div>
		</Pane>

		<PaneResizer
			class="w-1 bg-gray-300 hover:bg-blue-500 transition-colors duration-200 cursor-col-resize active:bg-blue-600"
		/>

		<Pane defaultSize={50} minSize={20} class="flex items-center justify-center">
			<div class="h-full w-full bg-white p-6">
				<h2 class="text-2xl font-semibold text-gray-800 mb-4">Pane 2</h2>
				<p class="text-gray-600">Right pane content goes here</p>
			</div>
		</Pane>
	</PaneGroup>
</div>
