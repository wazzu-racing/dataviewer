<script lang="ts">
	import { timeIndexStore, setIndex } from '$lib/stores/time';

	function handleChange(e: Event) {
		const val = parseInt((e.target as HTMLInputElement).value, 10);
		setIndex(val);
	}
</script>

<div
	class="w-full h-14 px-4 bg-primary dark:bg-neutral-900 dark:border-t dark:border-neutral-800 flex items-center gap-4 text-white dark:text-neutral-100"
>
	<label class="text-xs font-semibold">Time</label>
	<input
		type="range"
		min={$timeIndexStore.minIndex}
		max={$timeIndexStore.maxIndex}
		step="1"
		value={$timeIndexStore.selectedIndex}
		class="flex-grow mx-2 slider accent-primary"
		on:input={handleChange}
	/>
	<div class="text-xs font-mono min-w-[100px] text-right opacity-80">
		Index: {$timeIndexStore.selectedIndex} | {$timeIndexStore.seconds.toFixed(2)}s
	</div>
</div>

<style>
	.slider::-webkit-slider-thumb {
		background: #ef4444;
	}
</style>
