<script lang="ts">
	import { data as globalData } from '$lib/data.svelte';
	import { browser } from '$app/environment';
	import { loadLeaflet } from '$lib/leaflet';

	let mapContainer: HTMLDivElement | undefined = $state();
	// Plain variables — not reactive state; only used inside effects, never in template
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let leafletMap: any = null;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let trackLine: any = null;

	$effect(() => {
		if (!browser || !mapContainer) return;

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
			}

			// Draw/update the GPS track
			const lines = globalData.lines;
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

<div class="relative h-full w-full overflow-hidden">
	<div bind:this={mapContainer} class="h-full w-full"></div>

	{#if globalData.lines.length === 0}
		<div
			class="absolute inset-0 flex items-center justify-center bg-stone-50 text-sm text-stone-400"
		>
			No data loaded — use a Load Data pane to import a file
		</div>
	{/if}
</div>
