<script lang="ts">
	import { timeIndexStore, setIndex } from '$lib/stores/time';

	function handleChange(e: Event) {
		const val = parseInt((e.target as HTMLInputElement).value, 10);
		setIndex(val);
	}
</script>

<div class="w-full px-4 py-2 bg-gray-900 border-t border-gray-700 flex items-center gap-4">
	<label class="text-xs text-gray-300 font-medium">Time</label>
	<input
		type="range"
		min={$timeIndexStore.minIndex}
		max={$timeIndexStore.maxIndex}
		step="1"
		value={$timeIndexStore.selectedIndex}
		class="flex-grow mx-2 slider accent-red-500"
		on:input={handleChange}
	/>
	<div class="text-xs text-gray-300 font-mono min-w-[100px] text-right">
		Index: {$timeIndexStore.selectedIndex} | {$timeIndexStore.seconds.toFixed(2)}s
	</div>
</div>

<style>
	.slider::-webkit-slider-thumb {
		background: #ef4444;
	}
</style>
