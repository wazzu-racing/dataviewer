import { data as globalData, syncToLegacy } from '$lib/data.svelte';
import { setIndex } from '$lib/stores/time';
import type { DataLine, SessionMetadata } from '$lib/types';

const DEBUG_LIVE_SESSION = false;

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
	if (DEBUG_LIVE_SESSION) {
		console.log(
			'[SerialDebug] appendLiveTelemetry called with',
			Array.isArray(lines) ? lines.length : 1,
			'new lines:',
			lines
		);
	}
	const nextLines = Array.isArray(lines) ? lines : [lines];
	if (nextLines.length === 0) return;

	const telemetry = [...globalData.lines, ...nextLines];
	syncTelemetry(telemetry);
	setIndex(telemetry.length - 1);
}
