import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, fireEvent, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import GraphWidget from '$lib/components/widgets/GraphWidget.svelte';
import { data as globalData } from '$lib/data.svelte';
import { dataStore } from '$lib/stores/dataStore';
import { selectedIndex, setIndex } from '$lib/stores/time';
import type { DataLine, GraphConfig } from '$lib/types';

type PlotlyTrace = {
	x: number[];
	y: number[];
	hovertemplate?: string;
};

type PlotlyLayout = {
	xaxis?: { title: { text: string } };
};

// Record the data actually passed to Plotly, without loading WebGL in jsdom.
const { mockPlotlyReact, mockPlotlyRelayout } = vi.hoisted(() => {
	const mockPlotlyReact =
		vi.fn<
			(target: HTMLDivElement, traces: PlotlyTrace[], layout: PlotlyLayout, config: unknown) => void
		>();
	const mockPlotlyRelayout =
		vi.fn<(target: HTMLDivElement, update: Record<string, unknown>) => void>();

	return { mockPlotlyReact, mockPlotlyRelayout };
});

vi.mock('plotly.js-dist-min', () => ({
	default: {
		react: mockPlotlyReact,
		relayout: mockPlotlyRelayout
	}
}));

// Mock $app/environment to report browser = true
vi.mock('$app/environment', () => ({ browser: true, dev: false }));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
		rpm: 4000,
		time: 1,
		syncloss_count: 0,
		syncloss_code: 0,
		lat: 0,
		lon: 0,
		elev: 0,
		unixtime: new Date(0),
		ground_speed: 0,
		afr: 14.7,
		fuelload: 0,
		spark_advance: 0,
		baro: 0,
		map: 0,
		mat: 0,
		clnt_temp: 0,
		tps: 50,
		batt: 12.5,
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
		breakout_millis: 0,
		thermo_millis: 0,
		thermo_1: 0,
		thermo_2: 0,
		thermo_3: 0,
		thermo_4: 0,
		steering: 0,
		oil_temp: 0,
		...overrides
	};
}

function makeResettingTelemetry(): DataLine[] {
	return [
		makeDataLine({ write_millis: 10_000, time: 9_000, rpm: 3000 }),
		makeDataLine({ write_millis: 11_000, time: 0, rpm: 4500 }),
		makeDataLine({ write_millis: 12_000, time: 1_000, rpm: 3500 })
	];
}

function loadTelemetry(lines: DataLine[]): void {
	globalData.lines = lines;
	dataStore.set({ telemetry: lines, widgets: [] });
}

async function waitForPlot(): Promise<{ traces: PlotlyTrace[]; layout: PlotlyLayout }> {
	await waitFor(() => {
		expect(mockPlotlyReact).toHaveBeenCalled();
	});
	const call = mockPlotlyReact.mock.lastCall;
	if (!call) throw new Error('Expected Plotly.react to render the telemetry');
	return { traces: call[1], layout: call[2] };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('GraphWidget', () => {
	beforeEach(() => {
		globalData.lines = [];
		dataStore.set({ telemetry: [], widgets: [] });
		selectedIndex.set(0);
		vi.clearAllMocks();
	});

	afterEach(() => {
		cleanup();
		globalData.lines = [];
		dataStore.set({ telemetry: [], widgets: [] });
		selectedIndex.set(0);
	});

	it('renders the X axis selector dropdown', () => {
		const { container } = render(GraphWidget);
		const selects = container.querySelectorAll('select');
		// There should be an X axis select
		expect(selects.length).toBeGreaterThanOrEqual(1);
	});

	it('shows "No data loaded" message when no data', () => {
		const { getByText } = render(GraphWidget);
		expect(getByText(/No data loaded/)).toBeTruthy();
	});

	it('seeds xField from config prop', () => {
		const config: GraphConfig = { xField: 'rpm', yFields: ['tps'] };
		const { container } = render(GraphWidget, { props: { config } });

		const xSelect = container.querySelector('select') as HTMLSelectElement;
		expect(xSelect.value).toBe('rpm');
	});

	it('seeds yFields from config prop and shows them in the Y button', () => {
		const config: GraphConfig = { xField: 'time', yFields: ['tps', 'afr'] };
		const { getByText } = render(GraphWidget, { props: { config } });
		// With 2 series the button shows "2 series"
		expect(getByText('2 series')).toBeTruthy();
	});

	it('defaults to write_millis on X and rpm on Y when no config', () => {
		const { container } = render(GraphWidget);
		const xSelect = container.querySelector('select') as HTMLSelectElement;
		expect(xSelect.value).toBe('write_millis');
		expect(container.querySelector('.graph-series-dropdown button')).toHaveTextContent('RPM');
	});

	it('shows Y dropdown button with single field name when 1 series', () => {
		const config: GraphConfig = { xField: 'time', yFields: ['rpm'] };
		const { container } = render(GraphWidget, { props: { config } });
		const yBtn = container.querySelector('.graph-series-dropdown button');
		expect(yBtn).toBeTruthy();
		expect(yBtn?.textContent).toContain('RPM');
	});

	it('opens Y dropdown when Y button is clicked', async () => {
		const { container } = render(GraphWidget);
		const yBtn = container.querySelector('.graph-series-dropdown button') as HTMLButtonElement;
		await fireEvent.click(yBtn);
		// Should now show a scrollable list
		const dropdown = container.querySelector('.max-h-64');
		expect(dropdown).toBeTruthy();
	});

	it('closes the Y dropdown when clicking outside it', async () => {
		const { container } = render(GraphWidget);
		const yBtn = container.querySelector('.graph-series-dropdown button') as HTMLButtonElement;

		await fireEvent.click(yBtn);
		expect(container.querySelector('.max-h-64')).toBeTruthy();

		await fireEvent.click(document.body);

		await waitFor(() => {
			expect(container.querySelector('.max-h-64')).toBeNull();
		});
	});

	it('closes the Z dropdown when clicking outside it in 3D mode', async () => {
		const config: GraphConfig = {
			xField: 'time',
			yFields: ['rpm'],
			is3D: true,
			zFields: ['tps']
		};
		const { container } = render(GraphWidget, { props: { config } });
		const buttons = container.querySelectorAll('.graph-series-dropdown button');
		const zBtn = buttons[1] as HTMLButtonElement;

		await fireEvent.click(zBtn);
		expect(container.querySelectorAll('.max-h-64')).toHaveLength(1);

		await fireEvent.click(document.body);

		await waitFor(() => {
			expect(container.querySelector('.max-h-64')).toBeNull();
		});
	});

	it('does not fire onConfigChange on initial mount', async () => {
		const onConfigChange = vi.fn();
		render(GraphWidget, { props: { onConfigChange } });
		// Wait a tick for effects to settle
		await waitFor(() => {});
		expect(onConfigChange).not.toHaveBeenCalled();
	});

	it('fires onConfigChange when xField is changed by user', async () => {
		const onConfigChange = vi.fn();
		const { container } = render(GraphWidget, { props: { onConfigChange } });

		const xSelect = container.querySelector('select') as HTMLSelectElement;
		await fireEvent.change(xSelect, { target: { value: 'rpm' } });

		await waitFor(() => {
			expect(onConfigChange).toHaveBeenCalled();
		});
		const cfg = onConfigChange.mock.calls[0][0] as GraphConfig;
		expect(cfg.xField).toBe('rpm');
	});

	it('shows row count when data is loaded', () => {
		globalData.lines = [makeDataLine(), makeDataLine()];
		dataStore.set({ telemetry: [makeDataLine(), makeDataLine()], widgets: [] });
		const { getByText } = render(GraphWidget);
		expect(getByText('2 pts')).toBeTruthy();
	});

	it('plots the default graph in write order when time resets', async () => {
		const telemetry = makeResettingTelemetry();
		loadTelemetry(telemetry);
		render(GraphWidget);
		const { traces, layout } = await waitForPlot();

		expect(traces[0].x).toEqual([10_000, 11_000, 12_000]);
		expect(traces[0].y).toEqual([3000, 4500, 3500]);
		expect(layout.xaxis?.title.text).toBe('Write Millis (ms)');
		expect(traces[0].hovertemplate).toContain('<b>Write Millis</b>');
		expect(telemetry.map((line) => line.time)).toEqual([9_000, 0, 1_000]);
	});

	it('moves the default graph cursor using write_millis without redrawing traces', async () => {
		loadTelemetry(makeResettingTelemetry());
		render(GraphWidget);
		await waitForPlot();
		const renderCount = mockPlotlyReact.mock.calls.length;

		setIndex(1);
		await tick();

		expect(mockPlotlyRelayout).toHaveBeenLastCalledWith(
			expect.any(HTMLDivElement),
			expect.objectContaining({
				shapes: [expect.objectContaining({ x0: 11_000, x1: 11_000, xref: 'x' })]
			})
		);
		expect(mockPlotlyReact).toHaveBeenCalledTimes(renderCount);
	});
});

// ---------------------------------------------------------------------------
// Chart mount smoke test; the default-time tests above inspect Plotly data.
// ---------------------------------------------------------------------------
describe('GraphWidget — buildData output format', () => {
	it('renders the chart mount area when data is loaded', () => {
		globalData.lines = [makeDataLine({ time: 1, rpm: 3000 }), makeDataLine({ time: 2, rpm: 4500 })];
		dataStore.set({
			telemetry: [makeDataLine({ time: 1, rpm: 3000 }), makeDataLine({ time: 2, rpm: 4500 })],
			widgets: []
		});
		const { container, queryByText } = render(GraphWidget, {
			props: { config: { xField: 'time', yFields: ['rpm'] } }
		});

		expect(container.querySelector('.absolute.inset-0')).not.toBeNull();
		expect(queryByText(/No data loaded/)).toBeNull();
	});
});
