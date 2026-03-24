<script lang="ts">
	let { openChildWindow } = $props();
</script>

<!-- TopBar: fixed height + all styling, accepts parent classes via $attributes -->
<div
	class="w-full h-16 bg-primary dark:bg-neutral-900 text-white shadow-card flex items-center justify-between px-6 select-none dark:border-b dark:border-neutral-800"
>
	<div class="flex gap-3 items-center">
		<!-- Future extension slots go here -->
		<button
			class="bg-white dark:bg-neutral-800 text-primary dark:text-primary hover:bg-background hover:dark:bg-neutral-700 hover:text-primary border border-primary dark:border-neutral-700 rounded-md px-4 py-1.5 text-sm font-semibold transition-colors shadow-card disabled:opacity-50"
			onclick={openChildWindow}
		>
			New Window
		</button>
	</div>
	<div class="flex items-center gap-2">
		<span class="tracking-wide text-lg font-bold uppercase dark:text-neutral-100">
			Wazzu Racing
		</span>
		<!-- add logo/icon/expand here later -->
	</div>
</div>
