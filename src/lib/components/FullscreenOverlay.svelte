<script lang="ts">
	import { focus } from '$lib/actions';
	import { WIDGET_LABELS, type PaneWidgetType } from '$lib/types';
	import WidgetRenderer from '$lib/components/WidgetRenderer.svelte';

	type Props = {
		node: { id: string; type: PaneWidgetType; isFloating: boolean };
		config: unknown;
		onClose: () => void;
		onConfigChange: (config: Record<string, unknown>) => void;
	};

	let { node, config, onClose, onConfigChange }: Props = $props();
</script>

<div
	class="fixed inset-0 z-[500] flex flex-col bg-white dark:bg-neutral-950"
	role="dialog"
	aria-modal="true"
	aria-label="{WIDGET_LABELS[node.type]} (Fullscreen)"
>
	<div
		class="flex shrink-0 items-center gap-1 border-b border-border dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800 px-4 py-2"
	>
		<span class="flex-1 text-sm font-semibold text-primary-900 dark:text-neutral-100">
			{WIDGET_LABELS[node.type]} (Fullscreen)
		</span>
		<button
			onclick={onClose}
			title="Exit Fullscreen"
			use:focus
			class="rounded px-2 py-1 text-sm text-stone-400 dark:text-neutral-300 hover:bg-primary/10 dark:hover:bg-primary/20 hover:text-primary transition-colors"
		>
			✕ Exit Fullscreen
		</button>
	</div>
	<div class="flex-1 min-h-0 overflow-hidden">
		<WidgetRenderer
			type={node.type}
			config={config as Record<string, unknown> | undefined}
			{onConfigChange}
			onDismiss={onClose}
		/>
	</div>
</div>
