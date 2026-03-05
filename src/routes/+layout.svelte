<script lang="ts">
	import { base } from '$app/paths';
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';

	import { useRegisterSW } from 'virtual:pwa-register/svelte';
	const { needRefresh, offlineReady, updateServiceWorker } = useRegisterSW();

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="manifest" href="{base}/manifest.webmanifest" />
</svelte:head>

{@render children()}
