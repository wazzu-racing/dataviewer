import { writable } from 'svelte/store';
import type { DragItem } from '$lib/types';

/**
 * Global store for tracking the current drag operation
 * Contains information about what is being dragged (pane type or existing node ID)
 */
export const dragState = writable<DragItem | null>(null);

/**
 * Start a drag operation by storing drag information in the global store
 * @param item - The drag item containing operation type and pane/node info
 * @example
 * startDrag({ paneType: 'graph', operation: 'add' });
 */
export function startDrag(item: DragItem) {
	dragState.set(item);
}

/**
 * End a drag operation by clearing the global drag state
 * Called when drag ends, regardless of whether drop succeeded
 */
export function endDrag() {
	dragState.set(null);
}
