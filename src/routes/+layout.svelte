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

<div class="h-screen flex flex-col overflow-y-hidden">
	<main class="flex-1 min-h-0 flex flex-col overflow-hidden">
		{@render children()}
	</main>
	<!-- Sticky time slider now at bottom -->
	<div class="sticky bottom-0 z-20 bg-white h-14 shadow-sm flex items-stretch">
		<TimeSlider />
	</div>
</div>
