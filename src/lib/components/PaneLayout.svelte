<script lang="ts">
	import { PaneGroup, Pane, PaneResizer } from 'paneforge';
	import type { LayoutNode, DropPosition, PaneWidgetType } from '$lib/types';
	import PaneLayout from '$lib/components/PaneLayout.svelte';
	import DropZone from '$lib/components/DropZone.svelte';
	import WidgetRenderer from '$lib/components/WidgetRenderer.svelte';
	import { dragState } from '$lib/dragState.svelte';
	import { WIDGET_LABELS } from '$lib/types';

	type Props = {
		layout: LayoutNode;
		onDrop: (nodeId: string, widgetType: PaneWidgetType, position: DropPosition) => void;
		onRemove: (nodeId: string) => void;
		onPopOut: (nodeId: string) => void;
		onFullscreen?: (nodeId: string) => void;
		onConfigChange: (nodeId: string, config: Record<string, unknown>) => void;
		onMove?: (sourceId: string, nodeId: string, position: DropPosition) => void;
		fullscreenPaneId?: string;
	};

	let {
		layout,
		onDrop,
		onRemove,
		onPopOut,
		onFullscreen,
		onConfigChange,
		onMove,
		fullscreenPaneId
	}: Props = $props();

	// Drag events for tile move
	const canMove = $derived(typeof onMove === 'function');

	function handleDragStart(event: DragEvent) {
		if (!canMove) return;
		event.dataTransfer?.setData('application/pane-id', layout.id);
		event.dataTransfer!.effectAllowed = 'move';
		dragState.draggingPaneId = layout.id;

		// Create ghost
		const target = event.target as HTMLElement;
		if (target) {
			const ghost = target.cloneNode(true) as HTMLElement;
			ghost.style.position = 'absolute';
			ghost.style.top = '-9999px';
			ghost.style.left = '-9999px';
			ghost.style.opacity = '0.6';
			ghost.style.pointerEvents = 'none';
			document.body.appendChild(ghost);
			setTimeout(() => {
				event.dataTransfer!.setDragImage(ghost, ghost.offsetWidth / 2, ghost.offsetHeight / 2);
				setTimeout(() => document.body.removeChild(ghost), 50);
			}, 0);
		}
	}

	function handleDragEnd(_event: DragEvent) {
		dragState.draggingPaneId = null;
	}
</script>

{#if layout.type === 'horizontal' || layout.type === 'vertical'}
	<PaneGroup
		direction={layout.type === 'horizontal' ? 'horizontal' : 'vertical'}
		class="h-full w-full"
	>
		{#each layout.panes ?? [] as child, i (child.id)}
			<Pane defaultSize={child.defaultSize ?? 50} minSize={child.minSize ?? 5}>
				<!-- Recurse -->
				<PaneLayout
					layout={child}
					{onDrop}
					{onRemove}
					{onPopOut}
					{onFullscreen}
					{onConfigChange}
					{onMove}
					{fullscreenPaneId}
				/>
			</Pane>
			{#if i < (layout.panes?.length ?? 0) - 1}
				<PaneResizer
					class={layout.type === 'horizontal'
						? 'w-1 cursor-col-resize bg-border dark:bg-neutral-800 transition-colors hover:bg-primary/40 active:bg-primary/60'
						: 'h-1 cursor-row-resize bg-border dark:bg-neutral-800 transition-colors hover:bg-primary/40 active:bg-primary/60'}
				/>
			{/if}
		{/each}
	</PaneGroup>
{:else}
	<!-- Leaf / widget node -->
	<div
		class="flex h-full w-full flex-col overflow-hidden border border-border dark:border-neutral-800 rounded-lg shadow-card bg-card dark:bg-neutral-900"
	>
		<!-- Title bar -->
		<div
			class="flex shrink-0 items-center gap-1 border-b border-border dark:border-neutral-800 bg-background dark:bg-neutral-800 px-3 py-1"
			role="toolbar"
			aria-label="Pane header"
			tabindex="0"
			draggable={canMove}
			ondragstart={canMove ? handleDragStart : undefined}
			ondragend={canMove ? handleDragEnd : undefined}
		>
			<span class="flex-1 text-xs font-semibold text-primary dark:text-neutral-100">
				{WIDGET_LABELS[layout.type as PaneWidgetType] ?? layout.type}
			</span>
			<button
				onclick={() => onPopOut(layout.id)}
				title="Pop out into floating window"
				class="rounded px-1 py-0.5 text-xs text-stone-400 dark:text-neutral-300 hover:bg-primary/10 dark:hover:bg-primary/20 hover:text-primary dark:hover:text-primary-100"
			>
				⬡
			</button>
			<button
				onclick={() => onFullscreen?.(layout.id)}
				title="Fullscreen"
				class="rounded px-1 py-0.5 text-xs text-stone-400 dark:text-neutral-300 hover:bg-primary/10 dark:hover:bg-primary/20 hover:text-primary dark:hover:text-primary-100"
			>
				⛶
			</button>
			<button
				onclick={() => onRemove(layout.id)}
				title="Close pane"
				class="rounded px-1 py-0.5 text-xs text-stone-400 dark:text-neutral-300 hover:bg-red-100 dark:hover:bg-red-800 hover:text-red-600 dark:hover:text-red-100"
			>
				✕
			</button>
		</div>

		<!-- Widget content wrapped in a drop zone -->
		<div
			class="min-h-0 flex-1 overflow-hidden"
			style:visibility={layout.id === fullscreenPaneId ? 'hidden' : undefined}
		>
			<DropZone nodeId={layout.id} {onDrop} {onMove}>
				<WidgetRenderer
					type={layout.type as PaneWidgetType}
					config={layout.config}
					onConfigChange={(cfg) => onConfigChange(layout.id, cfg)}
					onDismiss={() => onRemove(layout.id)}
				/>
			</DropZone>
		</div>
	</div>
{/if}

