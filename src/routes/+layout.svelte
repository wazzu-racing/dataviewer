<script lang="ts">
	import { base } from '$app/paths';
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';

	import { useRegisterSW } from 'virtual:pwa-register/svelte';
	const { needRefresh, offlineReady, updateServiceWorker } = useRegisterSW();

	import TimeSlider from '$lib/components/TimeSlider.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="manifest" href="{base}/manifest.webmanifest" />
</svelte:head>

<div class="min-h-[100vh] flex flex-col">
	<!-- Sticky time slider toolbar -->
	<div class="sticky top-0 z-20 bg-white border-b border-stone-200 shadow-sm">
		<TimeSlider />
	</div>
	<main class="flex-1 flex flex-col overflow-hidden">
		{@render children()}
	</main>
</div>
