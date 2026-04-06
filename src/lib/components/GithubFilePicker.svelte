<script lang="ts">
	import { replaceState } from '$app/navigation';
	import { page } from '$app/state';

	// Svelte 5 runes only!
	const REPO = 'wazzu-racing/log_files';
	const API_ROOT = `https://api.github.com/repos/${REPO}/contents`;

	let {
		onFileSelected,
		loadingBin = false
	}: { onFileSelected: (url: string) => void; loadingBin?: boolean } = $props();
	let currentPath = $state('');
	let loading = $state(false);
	let error = $state<string | null>(null);
	let nodes = $state<{ name: string; path: string; type: 'file' | 'dir'; download_url?: string }[]>(
		[]
	);

	let breadcrumbs = $derived(currentPath.split('/').filter(Boolean));

	async function fetchNodes(path: string) {
		loading = true;
		error = null;
		nodes = [];
		try {
			const url = path ? `${API_ROOT}/${encodeURIComponent(path)}` : API_ROOT;
			const res = await fetch(url);
			if (!res.ok) throw new Error(`Github API error: ${res.status}`);

			const data = await res.json();
			nodes = (Array.isArray(data) ? data : [data])
				.filter((x) => x.type === 'dir' || (x.type === 'file' && x.name.endsWith('.bin')))
				.map((x) => ({
					name: x.name,
					path: x.path,
					type: x.type,
					download_url: x.download_url ?? undefined
				}));
		} catch (e: any) {
			error = e.message ?? String(e);
		} finally {
			loading = false;
		}
	}

	function goToFolder(path: string) {
		currentPath = path;
		fetchNodes(path);
	}

	function goUp() {
		if (!currentPath) return;
		let parts = currentPath.split('/').filter(Boolean);
		parts.pop();
		currentPath = parts.join('/');
		fetchNodes(currentPath);
	}

	$effect(() => {
		fetchNodes(currentPath);
	});
</script>

<!-- Breadcrumb navigation -->
{#if breadcrumbs.length}
	<nav class="text-xs mb-2 flex gap-1 dark:text-neutral-300">
		<button type="button" class="breadcrumb" onclick={() => goToFolder('')}>repo root</button>
		{#each breadcrumbs as crumb, i}
			<span>/</span>
			<button
				type="button"
				class="breadcrumb"
				onclick={() => goToFolder(breadcrumbs.slice(0, i + 1).join('/'))}
			>
				{crumb}
			</button>
		{/each}
	</nav>
{/if}

{#if loading}
	<div class="py-6 text-center text-gray-400 dark:text-neutral-500">Loading...</div>
{:else if loadingBin}
	<div class="py-10 flex flex-col items-center justify-center">
		<span class="mb-2">
			<svg
				class="animate-spin h-6 w-6 text-blue-500 dark:text-blue-400"
				style="display:inline-block;"
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
			>
				<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
				></circle>
				<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
			</svg>
		</span>
		<span class="text-blue-500 dark:text-blue-400 text-sm">Loading file...</span>
	</div>
{:else if error}
	<div class="py-6 text-center text-red-600 dark:text-red-400">{error}</div>
{:else if nodes.length === 0}
	<div class="py-6 text-center text-gray-700 dark:text-neutral-400">
		No folders or .bin files found
	</div>
{:else}
	<ul class="space-y-1">
		{#each nodes as node}
			{#if node.type === 'dir'}
				<li>
					<button
						type="button"
						class="w-full text-left font-semibold cursor-pointer dark:text-neutral-200 hover:underline"
						onclick={() => goToFolder(node.path)}
					>
						📁 {node.name}
					</button>
				</li>
			{:else}
				<li>
					<button
						type="button"
						class="w-full text-left text-blue-600 dark:text-blue-400 cursor-pointer hover:underline"
						onclick={async () => {
							if (!node.download_url) return;
							const url = new URL(page.url);
							url.searchParams.set('data', node.download_url);
							replaceState(url, {});
							await onFileSelected(node.download_url);
						}}
					>
						📝 {node.name}
					</button>
				</li>
			{/if}
		{/each}
	</ul>
{/if}

<style>
	.breadcrumb {
		display: inline-block;
		margin-right: 8px;
		color: #888;
		cursor: pointer;
		background: none;
		border: none;
		padding: 0;
		font: inherit;
	}
	.breadcrumb:hover {
		text-decoration: underline;
	}
	@media (prefers-color-scheme: dark) {
		.breadcrumb {
			color: #a3a3a3;
		}
	}
</style>
