export type TrackSample = {
	telemetryIndex: number;
	lat: number;
	lon: number;
};

function squaredDistance(aLat: number, aLon: number, bLat: number, bLon: number): number {
	const dLat = aLat - bLat;
	const dLon = aLon - bLon;
	return dLat * dLat + dLon * dLon;
}

export function findNearestTelemetryIndex(
	samples: TrackSample[],
	targetLat: number,
	targetLon: number
): number | null {
	if (samples.length === 0) return null;

	let nearestIndex = samples[0].telemetryIndex;
	let nearestDistance = squaredDistance(samples[0].lat, samples[0].lon, targetLat, targetLon);

	for (let i = 1; i < samples.length; i += 1) {
		const sample = samples[i];
		const distance = squaredDistance(sample.lat, sample.lon, targetLat, targetLon);
		if (distance < nearestDistance) {
			nearestDistance = distance;
			nearestIndex = sample.telemetryIndex;
		}
	}

	return nearestIndex;
}

export function findNearestTrackSampleByTelemetryIndex(
	samples: TrackSample[],
	targetIndex: number
): TrackSample | null {
	if (samples.length === 0) return null;

	let low = 0;
	let high = samples.length - 1;

	while (low <= high) {
		const mid = Math.floor((low + high) / 2);
		const sampleIndex = samples[mid].telemetryIndex;
		if (sampleIndex === targetIndex) {
			return samples[mid];
		}
		if (sampleIndex < targetIndex) {
			low = mid + 1;
		} else {
			high = mid - 1;
		}
	}

	const previous = high >= 0 ? samples[high] : null;
	const next = low < samples.length ? samples[low] : null;

	if (!previous) return next;
	if (!next) return previous;

	return targetIndex - previous.telemetryIndex <= next.telemetryIndex - targetIndex ? previous : next;
}
