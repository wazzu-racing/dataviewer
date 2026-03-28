<script lang="ts">
	import type { SavedLayout } from '$lib/types';

	type Props = {
		layouts: SavedLayout[];
		currentLayoutId: string | null;
		onSelect: (layoutId: string) => void;
		compact?: boolean;
	};

	let { layouts, currentLayoutId, onSelect, compact = false }: Props = $props();

	let isOpen = $state(false);

	function toggleDropdown() {
		isOpen = !isOpen;
	}

	function selectLayout(id: string) {
		onSelect(id);
		isOpen = false;
	}

	function handleClickOutside(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (!target.closest('.layout-selector')) {
			isOpen = false;
		}
	}

	$effect(() => {
		if (isOpen) {
			document.addEventListener('click', handleClickOutside);
			return () => document.removeEventListener('click', handleClickOutside);
		}
	});

	const currentLayout = $derived(layouts.find((l) => l.id === currentLayoutId));
	const displayName = $derived(currentLayout?.name || 'No Layout');
</script>

<div class="layout-selector relative inline-block">
	<button
		type="button"
		onclick={toggleDropdown}
		class="flex items-center gap-2 px-3 py-2 rounded-md border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-700 text-sm font-medium transition-colors"
		class:compact
	>
		<span class="truncate max-w-[200px]">{displayName}</span>
		<svg
			class="w-4 h-4 transition-transform"
			class:rotate-180={isOpen}
			fill="none"
			stroke="currentColor"
			viewBox="0 0 24 24"
		>
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
		</svg>
	</button>

	{#if isOpen}
		<div
			class="absolute top-full left-0 mt-1 w-64 rounded-md border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-lg z-[1000] max-h-80 overflow-y-auto"
		>
			{#if layouts.length === 0}
				<div class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">
					No saved layouts
				</div>
			{:else}
				<ul class="py-1">
					{#each layouts as layout (layout.id)}
						<li>
							<button
								type="button"
								onclick={() => selectLayout(layout.id)}
								class="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors"
								class:bg-blue-50={currentLayoutId === layout.id}
								class:dark:bg-blue-900={currentLayoutId === layout.id}
								class:text-blue-700={currentLayoutId === layout.id}
								class:dark:text-blue-300={currentLayoutId === layout.id}
							>
								<div class="font-medium">{layout.name}</div>
								<div class="text-xs text-gray-500 dark:text-gray-400">
									Last used: {new Date(layout.lastUsed).toLocaleDateString()}
								</div>
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/if}
</div>

<style>
	.compact {
		padding: 0.375rem 0.75rem;
		font-size: 0.875rem;
	}
</style>
