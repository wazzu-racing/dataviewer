<script lang="ts">
	type Props = {
		currentLayoutName?: string;
		onSave: (name: string, isNew: boolean) => void;
		onCancel: () => void;
	};

	let { currentLayoutName, onSave, onCancel }: Props = $props();

	let layoutName = $state(currentLayoutName || '');
	let saveAsNew = $state(!currentLayoutName);
	let errorMessage = $state('');

	function handleSubmit(e: Event) {
		e.preventDefault();

		const trimmed = layoutName.trim();
		if (!trimmed) {
			errorMessage = 'Layout name cannot be empty';
			return;
		}

		errorMessage = '';
		onSave(trimmed, saveAsNew);
	}

	function handleCancel() {
		onCancel();
	}
</script>

<!-- Backdrop -->
<div
	class="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 backdrop-blur-sm"
	role="dialog"
	aria-modal="true"
	aria-label="Save Layout"
>
	<!-- Modal Card -->
	<div
		class="relative w-full max-w-md rounded-xl border border-stone-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-2xl p-6"
	>
		<h2 class="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">Save Layout</h2>

		<form onsubmit={handleSubmit}>
			<div class="mb-4">
				<label
					for="layout-name"
					class="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300"
				>
					Layout Name
				</label>
				<input
					id="layout-name"
					type="text"
					bind:value={layoutName}
					placeholder="e.g., Race Day, Debugging"
					class="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
					autofocus
				/>
				{#if errorMessage}
					<p class="mt-1 text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
				{/if}
			</div>

			{#if currentLayoutName}
				<div class="mb-4">
					<label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
						<input
							type="checkbox"
							bind:checked={saveAsNew}
							class="w-4 h-4 rounded border-gray-300 dark:border-neutral-600 text-blue-600 focus:ring-blue-500"
						/>
						<span>Save as new layout</span>
					</label>
				</div>
			{/if}

			<div class="flex gap-3 justify-end">
				<button
					type="button"
					onclick={handleCancel}
					class="px-4 py-2 rounded-md border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-700 font-medium"
				>
					Cancel
				</button>
				<button
					type="submit"
					class="px-4 py-2 rounded-md bg-blue-600 dark:bg-blue-700 text-white hover:bg-blue-700 dark:hover:bg-blue-800 font-medium"
				>
					{saveAsNew ? 'Save New' : 'Update'}
				</button>
			</div>
		</form>
	</div>
</div>
