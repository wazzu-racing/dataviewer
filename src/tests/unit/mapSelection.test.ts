import { describe, expect, it } from 'vitest';
import { findNearestTelemetryIndex } from '$lib/mapSelection';

describe('findNearestTelemetryIndex', () => {
	it('returns null when there are no samples', () => {
		expect(findNearestTelemetryIndex([], 46.73, -117.28)).toBeNull();
	});

	it('returns the telemetry index of the nearest GPS sample', () => {
		const samples = [
			{ telemetryIndex: 3, lat: 46.73, lon: -117.28 },
			{ telemetryIndex: 7, lat: 46.74, lon: -117.29 },
			{ telemetryIndex: 11, lat: 46.75, lon: -117.3 }
		];

		expect(findNearestTelemetryIndex(samples, 46.7402, -117.2898)).toBe(7);
	});

	it('preserves the original telemetry index when GPS rows were filtered', () => {
		const samples = [
			{ telemetryIndex: 1, lat: 46.73, lon: -117.28 },
			{ telemetryIndex: 4, lat: 46.75, lon: -117.3 }
		];

		expect(findNearestTelemetryIndex(samples, 46.7499, -117.3001)).toBe(4);
	});
});
