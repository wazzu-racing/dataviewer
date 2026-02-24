import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/svelte';
import MapWidget from '$lib/components/widgets/MapWidget.svelte';
import { data as globalData } from '$lib/data.svelte';
import type { DataLine } from '$lib/types';

// ---------------------------------------------------------------------------
// Mock $lib/leaflet — our thin wrapper around Leaflet.
// Mocking the wrapper (not leaflet directly) ensures vi.mock intercepts it
// reliably regardless of whether it's called via static or dynamic import.
// vi.mock is hoisted, so we must define the mock objects via vi.hoisted().
// ---------------------------------------------------------------------------
const { mockL, mockMap, mockPolyline, mockCircleMarker, mockTileLayer } = vi.hoisted(() => {
	const mockPolyline = {
		addTo: vi.fn().mockReturnThis(),
		getBounds: vi.fn().mockReturnValue({ isValid: () => true }),
		remove: vi.fn()
	};
	const mockCircleMarker = {
		addTo: vi.fn().mockReturnThis(),
		bindTooltip: vi.fn().mockReturnThis()
	};
	const mockTileLayer = { addTo: vi.fn().mockReturnThis() };
	const mockMap = {
		setView: vi.fn().mockReturnThis(),
		fitBounds: vi.fn().mockReturnThis(),
		invalidateSize: vi.fn(),
		removeLayer: vi.fn(),
		remove: vi.fn()
	};
	const mockL = {
		map: vi.fn().mockReturnValue(mockMap),
		tileLayer: vi.fn().mockReturnValue(mockTileLayer),
		polyline: vi.fn().mockReturnValue(mockPolyline),
		circleMarker: vi.fn().mockReturnValue(mockCircleMarker)
	};
	return { mockL, mockMap, mockPolyline, mockCircleMarker, mockTileLayer };
});

vi.mock('$lib/leaflet', () => ({ loadLeaflet: async () => mockL }));

// Mock $app/environment to report browser = true
vi.mock('$app/environment', () => ({ browser: true }));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDataLine(lat: number, lon: number): DataLine {
	return {
		write_millis: 0,
		ecu_millis: 0,
		gps_millis: 0,
		imu_millis: 0,
		accel_millis: 0,
		analogx1_millis: 0,
		analogx2_millis: 0,
		analogx3_millis: 0,
		rpm: 0,
		time: 0,
		syncloss_count: 0,
		syncloss_code: 0,
		lat,
		lon,
		elev: 0,
		unixtime: new Date(0),
		ground_speed: 0,
		afr: 0,
		fuelload: 0,
		spark_advance: 0,
		baro: 0,
		map: 0,
		mat: 0,
		clnt_temp: 0,
		tps: 0,
		batt: 0,
		oil_press: 0,
		ltcl_timing: 0,
		ve1: 0,
		ve2: 0,
		egt: 0,
		maf: 0,
		in_temp: 0,
		ax: 0,
		ay: 0,
		az: 0,
		imu_x: 0,
		imu_y: 0,
		imu_z: 0,
		susp_pot_1_FL: 0,
		susp_pot_2_FR: 0,
		susp_pot_3_RR: 0,
		susp_pot_4_RL: 0,
		rad_in: 0,
		rad_out: 0,
		amb_air_temp: 0,
		brake1: 0,
		brake2: 0
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('MapWidget', () => {
	beforeEach(() => {
		globalData.lines = [];
		vi.clearAllMocks();
		// Reset mock return values after vi.clearAllMocks() wipes them
		mockL.map.mockReturnValue(mockMap);
		mockL.tileLayer.mockReturnValue(mockTileLayer);
		mockL.polyline.mockReturnValue(mockPolyline);
		mockL.circleMarker.mockReturnValue(mockCircleMarker);
		mockMap.setView.mockReturnThis();
		mockPolyline.addTo.mockReturnThis();
		mockPolyline.getBounds.mockReturnValue({ isValid: () => true });
		mockCircleMarker.addTo.mockReturnThis();
		mockCircleMarker.bindTooltip.mockReturnThis();
		mockTileLayer.addTo.mockReturnThis();
	});

	afterEach(() => {
		globalData.lines = [];
	});

	it('renders without error when no data is loaded', () => {
		const { container } = render(MapWidget);
		expect(container).toBeTruthy();
	});

	it('shows "No data loaded" overlay when globalData is empty', () => {
		const { getByText } = render(MapWidget);
		expect(getByText(/No data loaded/)).toBeTruthy();
	});

	it('does not show "No data loaded" when data is present', () => {
		globalData.lines = [makeDataLine(46.7327, -117.28)];
		const { queryByText } = render(MapWidget);
		expect(queryByText(/No data loaded/)).toBeNull();
	});

	it('renders a map container div', () => {
		const { container } = render(MapWidget);
		const mapDiv = container.querySelector('.h-full.w-full');
		expect(mapDiv).toBeTruthy();
	});

	it('calls L.polyline with correct coordinates', async () => {
		const lines = [
			makeDataLine(46.73, -117.28),
			makeDataLine(46.74, -117.29),
			makeDataLine(46.75, -117.3)
		];
		globalData.lines = lines;

		render(MapWidget);

		await waitFor(() => {
			expect(mockL.polyline).toHaveBeenCalledWith(
				[
					[46.73, -117.28],
					[46.74, -117.29],
					[46.75, -117.3]
				],
				expect.objectContaining({ color: '#3b82f6' })
			);
		});
	});

	it('places start and end circle markers', async () => {
		const lines = [makeDataLine(46.73, -117.28), makeDataLine(46.75, -117.3)];
		globalData.lines = lines;

		render(MapWidget);

		await waitFor(() => {
			// circleMarker called twice: start + end
			expect(mockL.circleMarker).toHaveBeenCalledTimes(2);
		});
		// First call is start (green)
		expect(mockL.circleMarker).toHaveBeenNthCalledWith(
			1,
			[46.73, -117.28],
			expect.objectContaining({ color: '#22c55e' })
		);
		// Second call is end (red)
		expect(mockL.circleMarker).toHaveBeenNthCalledWith(
			2,
			[46.75, -117.3],
			expect.objectContaining({ color: '#ef4444' })
		);
	});

	it('filters out rows where lat=0 or lon=0', async () => {
		globalData.lines = [
			makeDataLine(0, 0), // should be filtered
			makeDataLine(46.73, -117.28),
			makeDataLine(0, -117.29) // should be filtered (lat=0)
		];

		render(MapWidget);

		await waitFor(() => {
			// Only one valid coordinate
			expect(mockL.polyline).toHaveBeenCalledWith([[46.73, -117.28]], expect.anything());
		});
	});
});
