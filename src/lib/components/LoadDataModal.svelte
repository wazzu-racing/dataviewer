<script lang="ts">
	import ReadData from '$lib/components/ReadData.svelte';

	type Props = {
		onDismiss: () => void;
	};

	let { onDismiss }: Props = $props();
</script>

<!-- Backdrop -->
<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
	role="dialog"
	aria-modal="true"
	aria-label="Load Data"
>
	<!-- Card -->
	<div class="relative w-full max-w-sm rounded-xl border border-stone-200 bg-white shadow-2xl">
		<!-- Close button -->
		<button
			onclick={onDismiss}
			title="Close"
			class="absolute right-2 top-2 rounded px-1.5 py-0.5 text-xs text-stone-400 hover:bg-red-100 hover:text-red-600"
		>
			✕
		</button>

		<!-- ReadData fills the card -->
		<div class="min-h-56">
			<ReadData {onDismiss} />
		</div>
	</div>
</div>
