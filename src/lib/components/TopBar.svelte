<script lang="ts">
	import type { SavedLayout } from '$lib/types';
	import LayoutSelector from '$lib/components/LayoutSelector.svelte';

	type Props = {
		openChildWindow: () => void;
		layouts: SavedLayout[];
		currentLayoutId: string | null;
		onLayoutSelect: (layoutId: string) => void;
		onSaveLayout: () => void;
		onManageLayouts: () => void;
	};

	let {
		openChildWindow,
		layouts,
		currentLayoutId,
		onLayoutSelect,
		onSaveLayout,
		onManageLayouts
	}: Props = $props();
</script>

<!-- TopBar: fixed height + all styling, accepts parent classes via $attributes -->
<div
	class="w-full h-16 bg-primary dark:bg-neutral-900 text-white shadow-card flex items-center justify-between px-6 select-none dark:border-b dark:border-neutral-800"
>
	<div class="flex gap-3 items-center">
		<button
			class="bg-white dark:bg-neutral-800 text-primary dark:text-primary hover:bg-background hover:dark:bg-neutral-700 hover:text-primary border border-primary dark:border-neutral-700 rounded-md px-4 py-1.5 text-sm font-semibold transition-colors shadow-card disabled:opacity-50"
			onclick={openChildWindow}
		>
			New Window
		</button>

		<!-- Layout Controls -->
		<div class="flex gap-2 items-center border-l border-gray-300 dark:border-neutral-700 pl-3">
			<button
				onclick={onSaveLayout}
				class="bg-white dark:bg-neutral-800 text-primary dark:text-primary hover:bg-background hover:dark:bg-neutral-700 hover:text-primary border border-primary dark:border-neutral-700 rounded-md px-4 py-1.5 text-sm font-semibold transition-colors shadow-card disabled:opacity-50"
				title="Save current layout"
			>
				Save Layout
			</button>

			<LayoutSelector {layouts} {currentLayoutId} onSelect={onLayoutSelect} compact={true} />

			<button
				onclick={onManageLayouts}
				class="bg-white dark:bg-neutral-800 text-primary dark:text-primary hover:bg-background hover:dark:bg-neutral-700 hover:text-primary border border-primary dark:border-neutral-700 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors shadow-card disabled:opacity-50"
				title="Manage layouts"
			>
				Manage
			</button>
		</div>
	</div>
	<div class="flex items-center gap-2">
		<span class="tracking-wide text-lg font-bold uppercase dark:text-neutral-100">
			Wazzu Racing
		</span>
		<!-- add logo/icon/expand here later -->
	</div>
</div>
