// src/lib/stores/dataStore.ts
import { writable } from 'svelte/store';

// Example: The shared state can be expanded, but keep it JSON-serializable
import type { DataLine } from '$lib/types';

export type DataState = {
	telemetry: DataLine[]; // Actual loaded data for telemetry
	widgets: any[];
};

const defaultState: DataState = {
	telemetry: [],
	widgets: []
};

// Main store: parent owns writes, child only receives
export const dataStore = writable<DataState>(defaultState);

export function setFromExternal(external: DataState) {
	console.log('[dataStore] setFromExternal called with:', external);
	dataStore.set(external);
	console.log('[dataStore] dataStore state is now:', getStoreSnapshot());
}

export function getStoreSnapshot(): DataState {
	let snapshot: DataState;
	dataStore.subscribe((value) => {
		snapshot = value;
	})();
	// Typescript safe assertion
	return snapshot!;
}
