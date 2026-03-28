<script lang="ts">
	import type { SavedLayout } from '$lib/types';

	type Props = {
		layouts: SavedLayout[];
		activeLayoutId: string | null;
		onLoad: (id: string) => void;
		onRename: (id: string, newName: string) => void;
		onDelete: (id: string) => void;
		onDuplicate: (id: string) => void;
		onClose: () => void;
	};

	let { layouts, activeLayoutId, onLoad, onRename, onDelete, onDuplicate, onClose }: Props =
		$props();

	let editingId = $state<string | null>(null);
	let editingName = $state('');

	function startRename(layout: SavedLayout) {
		editingId = layout.id;
		editingName = layout.name;
	}

	function saveRename() {
		if (editingId && editingName.trim()) {
			onRename(editingId, editingName.trim());
			editingId = null;
			editingName = '';
		}
	}

	function cancelRename() {
		editingId = null;
		editingName = '';
	}

	function handleDeleteClick(id: string, name: string) {
		if (confirm(`Are you sure you want to delete the layout "${name}"?`)) {
			onDelete(id);
		}
	}

	function formatDate(timestamp: number): string {
		return new Date(timestamp).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}
</script>

<!-- Backdrop -->
<div
	class="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 backdrop-blur-sm"
	role="dialog"
	aria-modal="true"
	aria-label="Manage Layouts"
>
	<!-- Modal Card -->
	<div
		class="relative w-full max-w-2xl max-h-[80vh] rounded-xl border border-stone-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-2xl flex flex-col"
	>
		<!-- Header -->
		<div
			class="flex items-center justify-between p-6 border-b border-gray-200 dark:border-neutral-700"
		>
			<h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">Manage Layouts</h2>
			<button
				type="button"
				onclick={onClose}
				class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
				aria-label="Close"
			>
				<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M6 18L18 6M6 6l12 12"
					/>
				</svg>
			</button>
		</div>

		<!-- Content -->
		<div class="flex-1 overflow-y-auto p-6">
			{#if layouts.length === 0}
				<div class="text-center py-8 text-gray-500 dark:text-gray-400">
					<p class="text-lg mb-2">No saved layouts</p>
					<p class="text-sm">
						Save your first layout using the "Save Layout" button in the top bar
					</p>
				</div>
			{:else}
				<div class="space-y-3">
					{#each layouts as layout (layout.id)}
						{@const isActive = activeLayoutId === layout.id}
						<div
							class="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
							class:bg-blue-50={isActive}
							class:border-blue-300={isActive}
							class:border-gray-200={!isActive}
							class:dark:border-neutral-700={!isActive}
						>
							<div class="flex items-start justify-between gap-4">
								<div class="flex-1 min-w-0">
									{#if editingId === layout.id}
										<div class="flex items-center gap-2 mb-2">
											<input
												type="text"
												bind:value={editingName}
												class="flex-1 px-2 py-1 border border-gray-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
												autofocus
												onkeydown={(e) => {
													if (e.key === 'Enter') saveRename();
													if (e.key === 'Escape') cancelRename();
												}}
											/>
											<button
												type="button"
												onclick={saveRename}
												class="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
											>
												Save
											</button>
											<button
												type="button"
												onclick={cancelRename}
												class="px-2 py-1 text-xs bg-gray-200 dark:bg-neutral-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-neutral-600"
											>
												Cancel
											</button>
										</div>
									{:else}
										<div class="flex items-center gap-2 mb-1">
											<h3 class="font-semibold text-gray-900 dark:text-gray-100 truncate">
												{layout.name}
											</h3>
											{#if activeLayoutId === layout.id}
												<span
													class="px-2 py-0.5 text-xs font-medium bg-blue-600 text-white rounded"
												>
													Active
												</span>
											{/if}
										</div>
									{/if}

									<div class="text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
										<div>Created: {formatDate(layout.createdAt)}</div>
										<div>Last used: {formatDate(layout.lastUsed)}</div>
									</div>
								</div>

								<div class="flex flex-col gap-2">
									{#if activeLayoutId !== layout.id}
										<button
											type="button"
											onclick={() => onLoad(layout.id)}
											class="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
										>
											Load
										</button>
									{/if}
									<button
										type="button"
										onclick={() => startRename(layout)}
										class="px-3 py-1 text-sm border border-gray-300 dark:border-neutral-600 rounded hover:bg-gray-100 dark:hover:bg-neutral-700 text-gray-700 dark:text-gray-300"
									>
										Rename
									</button>
									<button
										type="button"
										onclick={() => onDuplicate(layout.id)}
										class="px-3 py-1 text-sm border border-gray-300 dark:border-neutral-600 rounded hover:bg-gray-100 dark:hover:bg-neutral-700 text-gray-700 dark:text-gray-300"
									>
										Duplicate
									</button>
									<button
										type="button"
										onclick={() => handleDeleteClick(layout.id, layout.name)}
										class="px-3 py-1 text-sm border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
									>
										Delete
									</button>
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Footer -->
		<div class="p-6 border-t border-gray-200 dark:border-neutral-700 flex justify-end">
			<button
				type="button"
				onclick={onClose}
				class="px-4 py-2 bg-gray-200 dark:bg-neutral-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-neutral-600 font-medium"
			>
				Close
			</button>
		</div>
	</div>
</div>
