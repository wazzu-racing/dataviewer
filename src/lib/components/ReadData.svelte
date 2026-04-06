<script lang="ts">
	import { data as globalData } from '$lib/data.svelte';
	import { parseBinaryBuffer } from '$lib/dataParser';
	import { dataStore } from '$lib/stores/dataStore';
	import { loadWazzuFile } from '$lib/fileFormat';

	let { onDismiss }: { onDismiss?: () => void } = $props();

	let files: FileList | undefined = $state();
	let parseError: string | null = $state(null);

	async function handleLoadFile() {
		if (!files || files.length === 0) return;
		parseError = null;
		const f = files[0];
		const buffer = await f.arrayBuffer();

		if (f.name.endsWith('.wazzuracing')) {
			try {
				const { telemetry, metadata } = await loadWazzuFile(buffer);
				globalData.lines = telemetry;
				globalData.metadata = metadata;
				dataStore.update((old) => ({
					...old,
					telemetry: globalData.lines
				}));
			} catch (err: any) {
				parseError = `Error parsing .wazzuracing file: ${err.message}`;
			}
		} else {
			parse(buffer);
		}
	}

	export async function parse(buffer: ArrayBuffer) {
		try {
			globalData.lines = parseBinaryBuffer(buffer);

			// Synchronize telemetry to shared dataStore!
			dataStore.update((old) => ({
				...old,
				telemetry: globalData.lines
			}));
		} catch (err: any) {
			parseError = `Corrupted data — file may be truncated or malformed: ${err.message}`;
		}
	}
</script>

<div class="flex h-full w-full flex-col items-center justify-center gap-5 p-8">
	<div class="text-center mb-1">
		<h1 class="text-3xl font-bold text-primary dark:text-primary tracking-tight mb-1">Load Data</h1>
		<p class="text-base text-muted dark:text-neutral-400">
			Import a <span class="font-mono text-primary dark:text-primary">.</span> telemetry file
		</p>
	</div>

	<input
		type="file"
		bind:files
		onchange={handleLoadFile}
		accept=".bin,.wazzuracing"
		class="text-sm text-zinc-700 dark:text-neutral-300 file:mr-3 file:cursor-pointer file:rounded-md file:border-2 file:border-primary file:bg-background dark:file:bg-neutral-800 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-primary dark:file:text-neutral-100 transition-all duration-150 hover:file:bg-primary hover:file:text-white focus:file:ring-2 focus:file:ring-primary/70 focus:file:outline-none"
	/>

	{#if parseError}
		<p
			class="max-w-xs text-center text-[15px] font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-md px-3 py-2 mt-2 shadow"
		>
			{parseError}
		</p>
	{/if}

	{#if globalData.lines.length > 0}
		<p
			class="text-sm font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-md px-3 py-1 mt-2"
		>
			{globalData.lines.length.toLocaleString()} data points loaded
		</p>
	{/if}
</div>
