import { data as globalData, syncToLegacy } from '$lib/data.svelte';
import { dataStore } from '$lib/stores/dataStore';
import { setIndex } from '$lib/stores/time';
import type { DataLine, SessionMetadata } from '$lib/types';

type SessionMetadataOverrides = Partial<Omit<SessionMetadata, 'files'>> & {
	files?: Partial<SessionMetadata['files']>;
};

function createSessionMetadata(overrides: SessionMetadataOverrides = {}): SessionMetadata {
	return {
		version: '1.0',
		name: overrides.name ?? 'New Session',
		driver: overrides.driver ?? '',
		location: overrides.location ?? '',
		datetime: overrides.datetime ?? new Date().toISOString(),
		conditions: overrides.conditions ?? '',
		files: {
			telemetry: overrides.files?.telemetry ?? 'data.csv'
		}
	};
}

function syncTelemetry(telemetry: DataLine[]) {
	globalData.lines = telemetry;
	syncToLegacy();
}

export function replaceSession(
	telemetry: DataLine[],
	metadata: SessionMetadata = {
		...globalData.metadata,
		files: { ...globalData.metadata.files }
	}
) {
	globalData.metadata = metadata;
	syncTelemetry(telemetry);
	setIndex(telemetry.length > 0 ? telemetry.length - 1 : 0);
}

export function startLiveSession(metadataOverrides: SessionMetadataOverrides = {}) {
	const metadata = createSessionMetadata({
		name: 'Live Session',
		...metadataOverrides
	});

	replaceSession([], metadata);
	return metadata;
}

export function appendLiveTelemetry(lines: DataLine | DataLine[]) {
	const nextLines = Array.isArray(lines) ? lines : [lines];
	if (nextLines.length === 0) return;

	const telemetry = [...globalData.lines, ...nextLines];
	syncTelemetry(telemetry);
	setIndex(telemetry.length - 1);
}
