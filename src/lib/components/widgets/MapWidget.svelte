<script lang="ts">
	import { untrack } from 'svelte';
	import { browser } from '$app/environment';
	import { formatLabelWithUnit, isNumericField } from '$lib/fieldMetadata';
	import { loadLeaflet } from '$lib/leaflet';
	import { findNearestTelemetryIndex } from '$lib/mapSelection';
	import { dataStore } from '$lib/stores/dataStore';
	import { setIndex, timeIndexStore } from '$lib/stores/time';
	import { NUMERIC_FIELDS, type MapConfig, type NumericField } from '$lib/types';
	import type * as L from 'leaflet';

	type Props = {
		config?: MapConfig;
		onConfigChange?: (cfg: MapConfig) => void;
	};

	type TrackPoint = {
		lat: number;
		lon: number;
		value: number;
	};

	type ColoredTrackSegment = {
		coords: [number, number][];
		color: string;
	};

	const BRAND_ACCENT = '#a60f2d';

	const { config: _cfg, onConfigChange }: Props = $props();
	const _seedField: NumericField = untrack(() => {
		const field = _cfg?.field;
		return field && isNumericField(field) ? field : 'ground_speed';
	});

	const HEATMAP_FIELDS = NUMERIC_FIELDS;

	let mapContainer: HTMLDivElement | undefined = $state();
	let leafletMap: L.Map | null = $state(null);
	let trackLayers: L.Polyline[] = $state([]);
	let trackHitArea: L.Polyline | null = $state(null);
	let startMarker: L.CircleMarker | null = $state(null);
	let endMarker: L.CircleMarker | null = $state(null);
	let timeMarker: L.CircleMarker | null = $state(null);
	let trackRenderer: L.Renderer | null = $state(null);
	let mapWidth = $state(0);
	let lastFittedTrackKey = $state('');

	let selectedField: NumericField = $state(_seedField);
	let isDarkTheme = $state(false);

	const hasData = $derived(
		$dataStore.telemetry.length > 0 && $dataStore.telemetry.some((line) => line.lat !== 0 && line.lon !== 0)
	);

	const trackPoints = $derived.by<TrackPoint[]>(() => {
		return $dataStore.telemetry.flatMap((line) => {
			if (
				typeof line.lat !== 'number' ||
				typeof line.lon !== 'number' ||
				line.lat === 0 ||
				line.lon === 0
			) {
				return [];
			}

			const value = line[selectedField];
			if (typeof value !== 'number' || !Number.isFinite(value)) {
				return [];
			}

			return [{ lat: line.lat, lon: line.lon, value }];
		});
	});

	const trackSamples = $derived.by(() =>
		$dataStore.telemetry.flatMap((line, telemetryIndex) =>
			typeof line.lat === 'number' &&
			typeof line.lon === 'number' &&
			line.lat !== 0 &&
			line.lon !== 0
				? [{ telemetryIndex, lat: line.lat, lon: line.lon }]
				: []
		)
	);

	const colorDomain = $derived.by(() => {
		const values = trackPoints.map((point) => point.value).filter((value) => Number.isFinite(value));
		if (values.length === 0) {
			return { min: 0, max: 1 };
		}
		return {
			min: Math.min(...values),
			max: Math.max(...values)
		};
	});

	const displayTrackPoints = $derived.by<TrackPoint[]>(() => {
		if (trackPoints.length <= 2) {
			return trackPoints;
		}

		const maxPoints = Math.max(300, Math.floor(mapWidth * 1.5));
		if (trackPoints.length <= maxPoints) {
			return trackPoints;
		}

		const stride = Math.ceil(trackPoints.length / maxPoints);
		const sampled: TrackPoint[] = [trackPoints[0]];
		for (let i = stride; i < trackPoints.length - 1; i += stride) {
			sampled.push(trackPoints[i]);
		}
		const lastPoint = trackPoints[trackPoints.length - 1];
		if (sampled[sampled.length - 1] !== lastPoint) {
			sampled.push(lastPoint);
		}
		return sampled;
	});

	function persistConfig() {
		onConfigChange?.({ field: selectedField });
	}

	function clearTrackLayers() {
		if (!leafletMap) return;
		for (const layer of trackLayers) {
			leafletMap.removeLayer(layer);
		}
		trackLayers = [];

		if (trackHitArea) {
			leafletMap.removeLayer(trackHitArea);
			trackHitArea = null;
		}
	}

	function clearEndpointMarkers() {
		if (!leafletMap) return;
		if (startMarker) {
			leafletMap.removeLayer(startMarker);
			startMarker = null;
		}
		if (endMarker) {
			leafletMap.removeLayer(endMarker);
			endMarker = null;
		}
	}

	function normalizeValue(value: number, min: number, max: number): number {
		if (!Number.isFinite(value)) return 0;
		if (max <= min) return 0.5;
		return Math.max(0, Math.min(1, (value - min) / (max - min)));
	}

	function interpolateColor(start: [number, number, number], end: [number, number, number], t: number) {
		const [sr, sg, sb] = start;
		const [er, eg, eb] = end;
		const r = Math.round(sr + (er - sr) * t);
		const g = Math.round(sg + (eg - sg) * t);
		const b = Math.round(sb + (eb - sb) * t);
		return `rgb(${r}, ${g}, ${b})`;
	}

	function interpolateMultiStop(
		stops: [[number, number, number], [number, number, number], [number, number, number]],
		t: number
	): string {
		if (t <= 0.5) {
			return interpolateColor(stops[0], stops[1], t / 0.5);
		}
		return interpolateColor(stops[1], stops[2], (t - 0.5) / 0.5);
	}

	function getHeatColor(value: number, min: number, max: number): string {
		const t = normalizeValue(value, min, max);
		return isDarkTheme
			? interpolateMultiStop(
					[
						[125, 211, 252],
						[250, 204, 21],
						[248, 113, 113]
					],
					t
				)
			: interpolateMultiStop(
					[
						[125, 211, 252],
						[234, 179, 8],
						[220, 38, 38]
					],
					t
				);
	}

	function buildColoredSegments(points: TrackPoint[], min: number, max: number): ColoredTrackSegment[] {
		if (points.length < 2) return [];

		const segments: ColoredTrackSegment[] = [];
		const colorBuckets = 24;

		for (let i = 1; i < points.length; i += 1) {
			const previousPoint = points[i - 1];
			const currentPoint = points[i];
			const segmentValue = (previousPoint.value + currentPoint.value) / 2;
			const normalized = normalizeValue(segmentValue, min, max);
			const bucket = Math.round(normalized * (colorBuckets - 1)) / (colorBuckets - 1);
			const segmentColor = getHeatColor(min + (max - min) * bucket, min, max);
			const nextCoords: [number, number][] = [
				[previousPoint.lat, previousPoint.lon],
				[currentPoint.lat, currentPoint.lon]
			];

			const lastSegment = segments[segments.length - 1];
			if (lastSegment && lastSegment.color === segmentColor) {
				lastSegment.coords.push(nextCoords[1]);
			} else {
				segments.push({
					coords: nextCoords,
					color: segmentColor
				});
			}
		}

		return segments;
	}

	$effect(() => {
		if (!browser) return;

		const readTheme = () => document.documentElement.classList.contains('dark');
		const updateTheme = (detail?: 'light' | 'dark') => {
			isDarkTheme = detail ? detail === 'dark' : readTheme();
		};

		updateTheme();

		const handleThemeChange = (event: Event) => {
			const detail = (event as CustomEvent<'light' | 'dark'>).detail;
			updateTheme(detail);
		};

		window.addEventListener('themechange', handleThemeChange as EventListener);

		return () => {
			window.removeEventListener('themechange', handleThemeChange as EventListener);
		};
	});

	$effect(() => {
		if (!browser || !mapContainer) return;

		let cancelled = false;

		loadLeaflet().then((L) => {
			if (cancelled || leafletMap) return;

			if (!document.getElementById('leaflet-css')) {
				const link = document.createElement('link');
				link.id = 'leaflet-css';
				link.rel = 'stylesheet';
				link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
				document.head.appendChild(link);
			}

			leafletMap = L.map(mapContainer!).setView([0, 0], 2);
			trackRenderer = L.canvas({ padding: 0.5 });
			L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
				attribution: '© OpenStreetMap contributors',
				maxZoom: 19
			}).addTo(leafletMap);
			mapContainer!.style.overflow = 'hidden';
			mapContainer!.style.position = 'relative';
		});

		return () => {
			cancelled = true;
			if (leafletMap) {
				leafletMap.remove();
				leafletMap = null;
			}
			trackLayers = [];
			startMarker = null;
			endMarker = null;
			timeMarker = null;
			trackRenderer = null;
			mapWidth = 0;
			lastFittedTrackKey = '';
		};
	});

	$effect(() => {
		if (!browser || !leafletMap) return;

		let cancelled = false;
		const points = displayTrackPoints;
		const samples = trackSamples;
		const { min, max } = colorDomain;
		const darkTheme = isDarkTheme;
		const fittedTrackKey = trackPoints.map((point) => `${point.lat},${point.lon}`).join('|');

		loadLeaflet().then((L) => {
			if (cancelled || !leafletMap) return;

			clearTrackLayers();
			clearEndpointMarkers();

			if (points.length === 0) {
				lastFittedTrackKey = '';
				return;
			}

			for (const segmentDef of buildColoredSegments(points, min, max)) {
				const segment = L.polyline(segmentDef.coords, {
					color: segmentDef.color,
					weight: 4,
					opacity: 0.95,
					renderer: trackRenderer ?? undefined
				}).addTo(leafletMap);
				trackLayers.push(segment);
			}

			const trackCoords: [number, number][] = samples.map((sample) => [sample.lat, sample.lon]);
			if (trackCoords.length > 1) {
				trackHitArea = L.polyline(trackCoords, {
					color: BRAND_ACCENT,
					weight: 16,
					opacity: 0,
					renderer: trackRenderer ?? undefined
				}).addTo(leafletMap);

				trackHitArea.on('click', (event: L.LeafletMouseEvent) => {
					const nearestIndex = findNearestTelemetryIndex(
						samples,
						event.latlng.lat,
						event.latlng.lng
					);
					if (nearestIndex !== null) {
						setIndex(nearestIndex);
					}
				});
			}

			const startColor = darkTheme ? '#22c55e' : '#16a34a';
			startMarker = L.circleMarker([points[0].lat, points[0].lon], {
				radius: 7,
				color: startColor,
				fillColor: startColor,
				fillOpacity: 1
			})
				.bindTooltip('Start')
				.addTo(leafletMap);

			const endColor = darkTheme ? '#ef4444' : '#dc2626';
			const endPoint = points[points.length - 1];
			endMarker = L.circleMarker([endPoint.lat, endPoint.lon], {
				radius: 7,
				color: endColor,
				fillColor: endColor,
				fillOpacity: 1
			})
				.bindTooltip('End')
				.addTo(leafletMap);

			if (fittedTrackKey !== lastFittedTrackKey) {
				const bounds = L.latLngBounds(points.map((point) => [point.lat, point.lon] as [number, number]));
				leafletMap.fitBounds(bounds, { padding: [20, 20] });
			}
			lastFittedTrackKey = fittedTrackKey;
		});

		return () => {
			cancelled = true;
		};
	});

	$effect(() => {
		if (!browser || !leafletMap || !hasData) {
			if (timeMarker) {
				leafletMap?.removeLayer(timeMarker);
				timeMarker = null;
			}
			return;
		}

		let cancelled = false;

		loadLeaflet().then((L) => {
			if (cancelled || !leafletMap) return;

			const idx = $timeIndexStore.selectedIndex;
			const line = $dataStore.telemetry[idx];
			if (
				!line ||
				typeof line.lat !== 'number' ||
				typeof line.lon !== 'number' ||
				line.lat === 0 ||
				line.lon === 0
			) {
				if (timeMarker) {
					leafletMap.removeLayer(timeMarker);
					timeMarker = null;
				}
				return;
			}

			if (timeMarker) {
				leafletMap.removeLayer(timeMarker);
				timeMarker = null;
			}

			timeMarker = L.circleMarker([line.lat, line.lon], {
				radius: 9,
				color: BRAND_ACCENT,
				fillColor: BRAND_ACCENT,
				fillOpacity: 0.85,
				weight: 4
			}).addTo(leafletMap);
		});

		return () => {
			cancelled = true;
		};
	});

	$effect(() => {
		if (!browser || !mapContainer || !leafletMap) return;
		const observer = new ResizeObserver(() => {
			mapWidth = mapContainer?.clientWidth ?? 0;
			leafletMap?.invalidateSize();
		});
		observer.observe(mapContainer);
		mapWidth = mapContainer.clientWidth;
		return () => observer.disconnect();
	});
</script>

<div
	class="relative flex h-full w-full flex-col overflow-hidden rounded-xl bg-white shadow-md ring-1 ring-primary/15 group focus-within:ring-2 focus-within:ring-primary dark:bg-neutral-900"
>
	<div class="shrink-0 border-b border-primary/10 bg-white/95 px-3 py-2 dark:border-neutral-800 dark:bg-neutral-900/95">
		<label
			class="flex max-w-xs items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary-700 dark:text-neutral-300"
		>
			<span>Hotline</span>
			<select
				bind:value={selectedField}
				onchange={persistConfig}
				class="min-w-0 flex-1 rounded-md border border-primary/20 bg-white px-2 py-1 text-xs font-semibold text-primary-900 shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
				aria-label="Map heatmap variable"
			>
				{#each HEATMAP_FIELDS as field (field)}
					<option value={field}>{formatLabelWithUnit(field)}</option>
				{/each}
			</select>
		</label>
	</div>

	<div bind:this={mapContainer} class="min-h-0 flex-1 w-full"></div>

	{#if !hasData}
		<div
			class="absolute inset-0 z-10 flex items-center justify-center rounded-xl border border-primary/15 bg-white/90 text-sm font-semibold text-primary-700 shadow-lg pointer-events-auto dark:bg-neutral-900/95 dark:text-primary-100"
			style="z-index:10;"
		>
			No data loaded — use a <span class="mx-1 font-semibold text-primary">Load Data</span> pane to import
			a file
		</div>
	{/if}
</div>
