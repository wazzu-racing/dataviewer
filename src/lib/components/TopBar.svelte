<script lang="ts">
	type Props = {
		onOpenCommands: () => void;
	};

	let { onOpenCommands }: Props = $props();
</script>

<!-- TopBar: fixed height + all styling -->
<div
	class="grid h-16 w-full grid-cols-[1fr_auto_1fr] items-center bg-primary px-6 shadow-card select-none dark:border-b dark:border-neutral-800 dark:bg-neutral-900"
>
	<div></div>

	<button
		class="flex items-center gap-2 rounded-md border border-primary/20 bg-white px-4 py-2 text-sm font-semibold text-primary shadow-sm transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700"
		onclick={onOpenCommands}
		title="Open Command Palette (Ctrl+Shift+P)"
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			class="h-4 w-4"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2.5"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<circle cx="11" cy="11" r="8" />
			<path d="m21 21-4.3-4.3" />
		</svg>
		<span>Command Palette</span>
	</button>

	<div class="justify-self-end">
		<span class="text-lg font-bold uppercase tracking-wide text-primary-950 dark:text-neutral-100">
			Wazzu Racing
		</span>
	</div>
</div>
