// src/lib/stores/time.ts
import { writable, derived } from 'svelte/store';
import { dataStore } from './dataStore';
import type { DataLine } from '$lib/types';

// Index-based global time system
export type GlobalTimeIndexState = {
	selectedIndex: number; // Current index (integer)
	minIndex: number; // Earliest available index
	maxIndex: number; // Latest available index
	seconds: number; // Seconds at selected index (optional, for display)
	currentLine?: DataLine; // DataLine at selectedIndex
};

const defaultIndexState: GlobalTimeIndexState = {
	selectedIndex: 0,
	minIndex: 0,
	maxIndex: 100,
	seconds: 0,
	currentLine: undefined
};

export const selectedIndex = writable<number>(0);
export const timeIndexStore = derived(
	[dataStore, selectedIndex],
	([$dataStore, $selectedIndex], set) => {
		const lines: DataLine[] = $dataStore.telemetry || [];
		const minIndex = 0;
		const maxIndex = Math.max(lines.length - 1, 0);
		const clampedIndex = Math.min(Math.max($selectedIndex, minIndex), maxIndex);
		const currentLine = lines[clampedIndex] || undefined;
		const seconds = currentLine && typeof currentLine.time === 'number' ? currentLine.time : 0;
		set({
			selectedIndex: clampedIndex,
			minIndex,
			maxIndex,
			seconds,
			currentLine
		});
	},
	defaultIndexState
);

export function setIndex(newIndex: number) {
	selectedIndex.set(newIndex);
}
