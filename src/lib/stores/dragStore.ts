import { writable } from 'svelte/store';
import type { DragItem } from '$lib/types';

export const dragState = writable<DragItem | null>(null);

export function startDrag(item: DragItem) {
	dragState.set(item);
}

export function endDrag() {
	dragState.set(null);
}
