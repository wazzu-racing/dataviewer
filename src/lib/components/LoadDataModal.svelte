<script lang="ts">
	import ReadData from '$lib/components/ReadData.svelte';
	import GithubFilePicker from '$lib/components/GithubFilePicker.svelte';
	import { data as globalData } from '$lib/data.svelte';

	type Props = {
		onDismiss: () => void;
		onConnectToCar: () => void | Promise<void>;
	};

	let { onDismiss, onConnectToCar }: Props = $props();

	let readData: ReadData;

	let showGithubPicker = $state(false);
	let loadingBin = $state(false);

	async function handleGithubFile(url: string) {
		loadingBin = true;
		try {
			const res = await fetch(url);
			if (!res.ok) throw new Error('Could not fetch file');
			const buffer = await res.arrayBuffer();
			await readData.parse(buffer);
			showGithubPicker = false; // Optionally hide picker after load
		} catch (err: any) {
			alert('Error loading .bin from Github: ' + err.message);
		}
		loadingBin = false;
	}

	function loadFromGithub() {
		showGithubPicker = !showGithubPicker;
	}
</script>

<!-- Backdrop -->
<div
	class="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 backdrop-blur-sm"
	role="dialog"
	aria-modal="true"
	aria-label="Load Data"
>
	<!-- Card -->
	<div
		class="relative w-full max-w-sm rounded-xl border border-stone-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-2xl overflow-hidden"
	>
		<div>
			<ReadData bind:this={readData} {onDismiss} />

			<div class="px-8 pb-6 pt-1">
				<div
					class="relative my-1 text-center text-xs font-semibold uppercase tracking-[0.24em] text-gray-400 dark:text-neutral-500"
				>
					<span class="bg-white px-3 dark:bg-neutral-900">or</span>
				</div>
				<button
					onclick={onConnectToCar}
					class="mt-4 w-full rounded bg-[#a60f2d] px-4 py-2 text-base font-semibold text-white! hover:bg-[#8b0d25] transition-colors shadow-sm"
				>
					Connect to Car
				</button>
				<button
					onclick={loadFromGithub}
					class="mt-3 w-full rounded bg-blue-500 px-4 py-2 text-base font-semibold text-white hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700"
				>
					{showGithubPicker ? 'Hide Github Files' : 'Load from Github'}
				</button>
				{#if showGithubPicker}
					<div class="mt-3 max-h-64 overflow-y-auto rounded border dark:border-neutral-700">
						<GithubFilePicker onFileSelected={handleGithubFile} {loadingBin} />
					</div>
				{/if}
			</div>
		</div>

		<!-- Done button, only after telemetry is parsed -->
		{#if globalData.lines.length > 0}
			<div class="w-full py-2">
				<button
					onclick={onDismiss}
					class="w-full px-4 py-2 rounded bg-blue-600 dark:bg-blue-700 text-white font-semibold hover:bg-blue-700 dark:hover:bg-blue-800"
				>
					Done
				</button>
			</div>
		{/if}
	</div>
</div>
