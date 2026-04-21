import { dataStore } from './stores/dataStore';
import type { DataLine, SessionMetadata } from './types';

export const data = $state({
	lines: [] as DataLine[],
	metadata: {
		version: '1.0',
		name: 'New Session',
		driver: '',
		location: '',
		datetime: '',
		conditions: '',
		files: { telemetry: 'data.csv' }
	} as SessionMetadata
});

// Bridge to legacy dataStore
export function syncToLegacy() {
	dataStore.update((old) => ({
		...old,
		telemetry: data.lines
	}));
}
