import { render, fireEvent, waitFor } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MapWidget from '$lib/components/widgets/MapWidget.svelte';
import { dataStore, type DataState } from '$lib/stores/dataStore';
import { selectedIndex, setIndex } from '$lib/stores/time';
import type { DataLine } from '$lib/types';

const { mockL, mockMap, mockPolyline, mockCircleMarker, mockTileLayer, mockBounds, mockRenderer } = vi.hoisted(
	() => {
		const mockBounds = { isValid: () => true };
		const mockRenderer = {};
		const mockPolyline = {
			addTo: vi.fn().mockReturnThis(),
			getBounds: vi.fn().mockReturnValue(mockBounds),
			remove: vi.fn(),
			on: vi.fn().mockReturnThis()
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
			circleMarker: vi.fn().mockReturnValue(mockCircleMarker),
			latLngBounds: vi.fn().mockReturnValue(mockBounds),
			canvas: vi.fn().mockReturnValue(mockRenderer)
		};
		return { mockL, mockMap, mockPolyline, mockCircleMarker, mockTileLayer, mockBounds, mockRenderer };
	}
);

vi.mock('$lib/leaflet', () => ({ loadLeaflet: async () => mockL }));
vi.mock('$app/environment', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$app/environment')>();
	return {
		...actual,
		browser: true
	};
});

function syncTelemetry(lines: DataLine[]) {
	const nextState: DataState = {
		telemetry: lines,
		widgets: []
	};
	dataStore.set(nextState);
	setIndex(lines.length > 0 ? lines.length - 1 : 0);
}

function makeDataLine(overrides: Partial<DataLine> = {}): DataLine {
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
		lat: 0,
		lon: 0,
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
		brake2: 0,
		...overrides
	};
}

describe('MapWidget', () => {
	beforeEach(() => {
		syncTelemetry([]);
		vi.clearAllMocks();
		mockL.map.mockReturnValue(mockMap);
		mockL.tileLayer.mockReturnValue(mockTileLayer);
		mockL.polyline.mockReturnValue(mockPolyline);
		mockL.circleMarker.mockReturnValue(mockCircleMarker);
		mockL.latLngBounds.mockReturnValue(mockBounds);
		mockL.canvas.mockReturnValue(mockRenderer);
		mockMap.setView.mockReturnThis();
		mockMap.fitBounds.mockReturnThis();
		mockPolyline.addTo.mockReturnThis();
		mockPolyline.getBounds.mockReturnValue(mockBounds);
		mockPolyline.on.mockReturnThis();
		mockCircleMarker.addTo.mockReturnThis();
		mockCircleMarker.bindTooltip.mockReturnThis();
		mockTileLayer.addTo.mockReturnThis();
	});

	afterEach(() => {
		syncTelemetry([]);
	});

	it('renders without error when no data is loaded', () => {
		const { container } = render(MapWidget);
		expect(container).toBeTruthy();
	});

	it('shows "No data loaded" overlay when telemetry is empty', () => {
		const { getByText } = render(MapWidget);
		expect(getByText(/No data loaded/)).toBeTruthy();
	});

	it('renders a heatmap variable selector defaulted to ground_speed', () => {
		const { getByLabelText } = render(MapWidget);
		const select = getByLabelText('Map heatmap variable') as HTMLSelectElement;
		expect(select.value).toBe('ground_speed');
	});

	it('does not show the empty overlay when GPS data is present', () => {
		syncTelemetry([makeDataLine({ lat: 46.7327, lon: -117.28, ground_speed: 42 })]);
		const { queryByText } = render(MapWidget);
		expect(queryByText(/No data loaded/)).toBeNull();
	});

	it('renders one colored segment per consecutive pair of valid GPS points', async () => {
		syncTelemetry([
			makeDataLine({ lat: 46.73, lon: -117.28, ground_speed: 10 }),
			makeDataLine({ lat: 46.74, lon: -117.29, ground_speed: 20 }),
			makeDataLine({ lat: 46.75, lon: -117.3, ground_speed: 30 })
		]);

		render(MapWidget);

		await waitFor(() => {
			expect(mockL.polyline).toHaveBeenCalledTimes(3);
		});

		expect(mockL.polyline).toHaveBeenNthCalledWith(
			1,
			[
				[46.73, -117.28],
				[46.74, -117.29]
			],
			expect.objectContaining({
				color: expect.stringMatching(/^rgb\(/),
				weight: 4
			})
		);
		expect(mockL.polyline).toHaveBeenNthCalledWith(
			2,
			[
				[46.74, -117.29],
				[46.75, -117.3]
			],
			expect.objectContaining({
				color: expect.stringMatching(/^rgb\(/),
				weight: 4
			})
		);
		expect(mockL.polyline).toHaveBeenNthCalledWith(
			3,
			[
				[46.73, -117.28],
				[46.74, -117.29],
				[46.75, -117.3]
			],
			expect.objectContaining({
				color: '#a60f2d',
				weight: 16,
				opacity: 0
			})
		);
	});

	it('places start and end circle markers', async () => {
		syncTelemetry([
			makeDataLine({ lat: 46.73, lon: -117.28, ground_speed: 10 }),
			makeDataLine({ lat: 46.75, lon: -117.3, ground_speed: 20 })
		]);

		render(MapWidget);

		await waitFor(() => {
			expect(mockL.circleMarker).toHaveBeenCalledTimes(3);
		});

		expect(mockL.circleMarker).toHaveBeenNthCalledWith(
			1,
			[46.73, -117.28],
			expect.objectContaining({ color: '#16a34a' })
		);
		expect(mockL.circleMarker).toHaveBeenNthCalledWith(
			2,
			[46.75, -117.3],
			expect.objectContaining({ color: '#dc2626' })
		);
	});

	it('filters out rows where lat=0 or lon=0 before drawing segments', async () => {
		syncTelemetry([
			makeDataLine({ lat: 0, lon: 0, ground_speed: 10 }),
			makeDataLine({ lat: 46.73, lon: -117.28, ground_speed: 20 }),
			makeDataLine({ lat: 0, lon: -117.29, ground_speed: 30 }),
			makeDataLine({ lat: 46.75, lon: -117.3, ground_speed: 40 })
		]);

		render(MapWidget);

		await waitFor(() => {
			expect(mockL.polyline).toHaveBeenCalledTimes(2);
		});

		expect(mockL.polyline).toHaveBeenNthCalledWith(
			1,
			[
				[46.73, -117.28],
				[46.75, -117.3]
			],
			expect.objectContaining({ weight: 4 })
		);
		expect(mockL.polyline).toHaveBeenNthCalledWith(
			2,
			[
				[46.73, -117.28],
				[46.75, -117.3]
			],
			expect.objectContaining({ color: '#a60f2d', opacity: 0, weight: 16 })
		);
	});

	it('seeds selected field from config.field prop', () => {
		const { getByLabelText } = render(MapWidget, { props: { config: { field: 'tps' } } });
		const select = getByLabelText('Map heatmap variable') as HTMLSelectElement;
		expect(select.value).toBe('tps');
	});

	it('fires onConfigChange when a different field is selected', async () => {
		const onConfigChange = vi.fn();
		const { getByLabelText } = render(MapWidget, { props: { onConfigChange } });
		const select = getByLabelText('Map heatmap variable') as HTMLSelectElement;

		await fireEvent.change(select, { target: { value: 'tps' } });

		await waitFor(() => {
			expect(onConfigChange).toHaveBeenCalledWith({ field: 'tps' });
		});
	});

	it('updates the global time index when the track is clicked', async () => {
		syncTelemetry([
			makeDataLine({ lat: 0, lon: 0 }),
			makeDataLine({ lat: 46.73, lon: -117.28 }),
			makeDataLine({ lat: 46.74, lon: -117.29 }),
			makeDataLine({ lat: 46.75, lon: -117.3 })
		]);
		setIndex(0);

		render(MapWidget);

		await waitFor(() => {
			expect(mockPolyline.on).toHaveBeenCalledWith('click', expect.any(Function));
		});

		const clickHandler = mockPolyline.on.mock.calls.find(([eventName]) => eventName === 'click')?.[1];
		expect(clickHandler).toBeTypeOf('function');

		clickHandler({
			latlng: {
				lat: 46.7398,
				lng: -117.2902
			}
		});

		expect(get(selectedIndex)).toBe(2);
	});
});
