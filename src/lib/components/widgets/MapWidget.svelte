<script lang="ts">
	import { dataStore } from '$lib/stores/dataStore';
	import { browser } from '$app/environment';
	import { loadLeaflet } from '$lib/leaflet';
	import { timeIndexStore } from '$lib/stores/time';

	let mapContainer: HTMLDivElement | undefined = $state();
	// Plain variables — not reactive state; only used inside effects, never in template
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let leafletMap: any = null;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let trackLine: any = null;

	// HACK: compute if there is any usable GPS data, up front and after import
	// (if there are any lines where lat/lon !== 0)
	const hasData = $derived(
		$dataStore.telemetry.length > 0 && $dataStore.telemetry.some((l) => l.lat !== 0 && l.lon !== 0)
	);

	// Only initialize the map if there is GPS data (prevents Leaflet artifacts with empty map)
	$effect(() => {
		if (!browser || !mapContainer || !hasData) return;

		let cancelled = false;

		loadLeaflet().then((L) => {
			if (cancelled) return;

			// Import leaflet CSS once
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
				// Ensure the Leaflet pane/canvas is fully contained in mapContainer:
				mapContainer!.style.overflow = 'hidden';
				mapContainer!.style.position = 'relative';
			}

			// Draw/update the GPS track
			const lines = $dataStore.telemetry;
			if (lines.length === 0) return;

			const coords: [number, number][] = lines
				.filter((l) => l.lat !== 0 && l.lon !== 0)
				.map((l) => [l.lat, l.lon]);

			if (coords.length === 0) return;

			if (trackLine) {
				leafletMap.removeLayer(trackLine);
			}

			trackLine = L.polyline(coords, { color: '#3b82f6', weight: 2 }).addTo(leafletMap);

			// Start / end markers
			L.circleMarker(coords[0], {
				radius: 6,
				color: '#22c55e',
				fillColor: '#22c55e',
				fillOpacity: 1
			})
				.bindTooltip('Start')
				.addTo(leafletMap);
			L.circleMarker(coords[coords.length - 1], {
				radius: 6,
				color: '#ef4444',
				fillColor: '#ef4444',
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

	// Global time position marker
	let timeMarker: any = null;
	$effect(() => {
		if (!browser || !leafletMap || !hasData) {
			if (timeMarker) {
				leafletMap.removeLayer(timeMarker);
				timeMarker = null;
			}
			return;
		}
		const lines = $dataStore.telemetry.filter(
			(l) => l.lat !== 0 && l.lon !== 0 && typeof l.time === 'number'
		);
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
		// draw marker
		const lat = line.lat;
		const lon = line.lon;
		timeMarker = L.circleMarker([lat, lon], {
			radius: 7,
			color: '#e11d48', // fuchsia-600
			fillColor: '#e11d48',
			fillOpacity: 0.85,
			weight: 3
		}).addTo(leafletMap);
		// Optionally, we could pan to marker:
		// leafletMap.panTo([lat, lon]);
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

<!--
MapWidget "empty map" rendering bug fix:
- Only run map+Leaflet if there is data
- When no data, render only empty container and overlay (never calls Leaflet)
- Keep overlays strictly above any map artifacts
-->
<div class="relative h-full w-full overflow-hidden">
	<!-- Map container (Leaflet attaches here) -->
	<div bind:this={mapContainer} class="h-full w-full"></div>

	{#if !hasData}
		<div
			class="absolute inset-0 flex items-center justify-center bg-stone-50 text-sm text-stone-400 z-10 pointer-events-auto"
			style="z-index:10;"
		>
			No data loaded — use a Load Data pane to import a file
		</div>
	{/if}
</div>
