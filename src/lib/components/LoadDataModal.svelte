<script lang="ts">
	import type { SavedLayout } from '$lib/types';
	import ReadData from '$lib/components/ReadData.svelte';
	import GithubFilePicker from '$lib/components/GithubFilePicker.svelte';
	import LayoutSelector from '$lib/components/LayoutSelector.svelte';
	import { data as globalData } from '$lib/data.svelte';

	type Props = {
		onDismiss: () => void;
		onConnectToCar: () => void | Promise<void>;
		layouts: SavedLayout[];
		currentLayoutId: string | null;
		onLayoutSelect: (layoutId: string) => void;
		onManageLayouts: () => void;
	};

	let {
		onDismiss,
		onConnectToCar,
		layouts,
		currentLayoutId,
		onLayoutSelect,
		onManageLayouts
	}: Props = $props();

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

		<!-- Layout Selector Section -->
		<div class="px-4 py-3 border-t border-gray-200 dark:border-neutral-700">
			<div class="flex items-center justify-between gap-3">
				<label class="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
					<span>Layout:</span>
					<LayoutSelector {layouts} {currentLayoutId} onSelect={onLayoutSelect} compact={true} />
				</label>
				<div class="flex gap-2 items-center">
					<button
						onclick={onManageLayouts}
						class="px-3 py-1.5 text-sm border border-gray-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-700 font-medium"
					>
						Manage
					</button>
				</div>
			</div>
		</div>

		<!-- Items loaded + Done button, only after telemetry is parsed -->
		{#if globalData.lines.length > 0}
			<div class="w-full py-2">
				<p class="text-center text-sm text-emerald-600 dark:text-emerald-400 mb-2">
					{globalData.lines.length.toLocaleString()} items loaded
				</p>
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
