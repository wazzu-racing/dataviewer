<script lang="ts">
	import { dataStore } from '$lib/stores/dataStore';
	import { browser } from '$app/environment';
	import { loadLeaflet } from '$lib/leaflet';
	import { setIndex, timeIndexStore } from '$lib/stores/time';
	import { findNearestTelemetryIndex } from '$lib/mapSelection';
	import type * as L from 'leaflet';

	let mapContainer: HTMLDivElement | undefined = $state();
	let leafletMap: L.Map | null = null;
	let trackLine: L.Polyline | null = null;

	// HACK: compute if there is any usable GPS data, up front and after import
	const hasData = $derived(
		$dataStore.telemetry.length > 0 && $dataStore.telemetry.some((l) => l.lat !== 0 && l.lon !== 0)
	);

	let isDarkTheme = $state(false);
	const trackSamples = $derived(
		$dataStore.telemetry.flatMap((line, telemetryIndex) =>
			line.lat !== 0 && line.lon !== 0
				? [{ telemetryIndex, lat: line.lat, lon: line.lon }]
				: []
		)
	);

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

	// Theme color constants (match design tokens and branding)
	const BRAND_ACCENT = '#a60f2d';
	const GREEN_LIGHT = '#16a34a'; // Tailwind green-600
	const GREEN_DARK = '#22c55e'; // Tailwind green-500
	const RED_LIGHT = '#dc2626'; // Tailwind red-600
	const RED_DARK = '#ef4444'; // Tailwind red-500
	const CARD_BG_LIGHT = '#fff';
	const CARD_BG_DARK = '#171717';

	$effect(() => {
		const darkTheme = isDarkTheme;
		if (!browser || !mapContainer || !hasData) return;

		let cancelled = false;

		loadLeaflet().then((L) => {
			if (cancelled) return;

			if (!document.getElementById('leaflet-css')) {
				const link = document.createElement('link');
				link.id = 'leaflet-css';
				link.rel = 'stylesheet';
				link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
				document.head.appendChild(link);
			}

			if (!leafletMap) {
				leafletMap = L.map(mapContainer!).setView([0, 0], 2);
				L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
					attribution: '© OpenStreetMap contributors',
					maxZoom: 19
				}).addTo(leafletMap);
				mapContainer!.style.overflow = 'hidden';
				mapContainer!.style.position = 'relative';
			}

			// Draw/update GPS track
			const coords: [number, number][] = trackSamples.map((sample) => [sample.lat, sample.lon]);
			if (coords.length === 0) return;

			if (trackLine) {
				leafletMap.removeLayer(trackLine);
			}
			const trackColor = BRAND_ACCENT;
			trackLine = L.polyline(coords, { color: trackColor, weight: 3 }).addTo(leafletMap);
			trackLine.on('click', (event: L.LeafletMouseEvent) => {
				const nearestIndex = findNearestTelemetryIndex(
					trackSamples,
					event.latlng.lat,
					event.latlng.lng
				);
				if (nearestIndex !== null) {
					setIndex(nearestIndex);
				}
			});

			// Start/End markers
			const startColor = darkTheme ? GREEN_DARK : GREEN_LIGHT;
			L.circleMarker(coords[0], {
				radius: 7,
				color: startColor,
				fillColor: startColor,
				fillOpacity: 1
			})
				.bindTooltip('Start')
				.addTo(leafletMap);

			const endColor = darkTheme ? RED_DARK : RED_LIGHT;
			L.circleMarker(coords[coords.length - 1], {
				radius: 7,
				color: endColor,
				fillColor: endColor,
				fillOpacity: 1
			})
				.bindTooltip('End')
				.addTo(leafletMap);

			leafletMap.fitBounds(trackLine.getBounds(), { padding: [20, 20] });
		});

		return () => {
			cancelled = true;
			if (leafletMap) {
				leafletMap.remove();
				leafletMap = null;
				trackLine = null;
			}
		};
	});

	// Global time position marker with brand accent
	let timeMarker: L.CircleMarker | null = null;
	$effect(() => {
		if (!browser || !leafletMap || !hasData) {
			if (timeMarker) {
				leafletMap?.removeLayer(timeMarker);
				timeMarker = null;
			}
			return;
		}

		let cancelled = false;

		// Use the same Leaflet instance as the map creation effect
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

	// Invalidate map size when container resizes
	$effect(() => {
		if (!browser || !mapContainer || !leafletMap) return;
		const observer = new ResizeObserver(() => {
			leafletMap?.invalidateSize();
		});
		observer.observe(mapContainer);
		return () => observer.disconnect();
	});
</script>

<!-- Modern Card Container -->
<div
	class="flex flex-col h-full w-full rounded-xl shadow-md ring-1 ring-primary/15 bg-white dark:bg-neutral-900 overflow-hidden group focus-within:ring-2 focus-within:ring-primary"
>
	<!-- Map container (Leaflet attaches here) -->
	<div bind:this={mapContainer} class="h-full w-full"></div>

	<!-- Empty overlay, styled to match Table/GraphWidget empty state -->
	{#if !hasData}
		<div
			class="absolute inset-0 z-10 flex items-center justify-center bg-white/90 dark:bg-neutral-900/95 border border-primary/15 text-primary-700 dark:text-primary-100 text-sm font-semibold rounded-xl shadow-lg pointer-events-auto"
			style="z-index:10;"
		>
			No data loaded — use a <span class="mx-1 font-semibold text-primary">Load Data</span> pane to import
			a file
		</div>
	{/if}
</div>
