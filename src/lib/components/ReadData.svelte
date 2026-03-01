<script lang="ts">
	import { NUM_FIELDS } from '$lib/types';
	import { data as globalData } from '$lib/data.svelte';
	import { parseDataLine } from '$lib/dataParser';
	import { dataStore } from '$lib/stores/dataStore';

	let { onDismiss }: { onDismiss?: () => void } = $props();

	let files: FileList | undefined = $state();
	let parseError: string | null = $state(null);

	async function handleLoadFile() {
		if (!files || files.length === 0) return;
		parseError = null;
		const f = files[0];
		const buffer = await f.arrayBuffer();
		parse(buffer);
	}

	export async function parse(buffer: ArrayBuffer) {
		const dataview = new DataView(buffer);

		const bytesPerRow = 4 * NUM_FIELDS;
		const numRows = Math.floor(buffer.byteLength / bytesPerRow);

		const rawRows: number[][] = [];

		for (let row_i = 0; row_i < numRows; row_i++) {
			const row: number[] = [];
			try {
				for (let i = 0; i < NUM_FIELDS; i++) {
					row.push(dataview.getInt32(row_i * bytesPerRow + 4 * i, true)); // little-endian
				}
			} catch {
				parseError = `Corrupted data at row ${row_i} — file may be truncated or malformed.`;
				return;
			}
			rawRows.push(row);
		}

		globalData.lines = rawRows.map(parseDataLine);

		// Synchronize telemetry to shared dataStore!
		dataStore.update((old) => ({
			...old,
			telemetry: globalData.lines
		}));
	}
</script>

<div class="flex h-full w-full flex-col items-center justify-center gap-3 p-4">
	<div class="text-center">
		<h1 class="text-2xl font-semibold">Load Data</h1>
		<p class="text-sm text-stone-500">Import a .bin telemetry file</p>
	</div>

	<input
		type="file"
		bind:files
		onchange={handleLoadFile}
		accept=".bin"
		class="text-sm text-stone-500 file:mr-3 file:cursor-pointer file:rounded file:border file:border-stone-300 file:bg-stone-50 file:px-3 file:py-1 file:text-xs file:font-medium file:text-stone-700 hover:file:bg-blue-50 hover:file:text-blue-700"
	/>

	{#if parseError}
		<p class="max-w-xs text-center text-sm text-red-600">{parseError}</p>
	{/if}

	{#if globalData.lines.length > 0}
		<p class="text-sm text-emerald-600">
			{globalData.lines.length.toLocaleString()} data points loaded
		</p>
	{/if}
</div>
