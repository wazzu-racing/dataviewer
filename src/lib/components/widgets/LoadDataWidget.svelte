<script lang="ts">
	import ReadData from '$lib/components/ReadData.svelte';

	let { onDismiss }: { onDismiss?: () => void } = $props();
</script>

<ReadData {onDismiss} />
