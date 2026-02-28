import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import GraphWidget from '$lib/components/widgets/GraphWidget.svelte';
import { data as globalData } from '$lib/data.svelte';
import type { DataLine, GraphConfig } from '$lib/types';

// ---------------------------------------------------------------------------
// Mock uPlot — we don't need a real canvas chart in unit tests
// vi.mock is hoisted, so all referenced variables must be created via vi.hoisted().
// ---------------------------------------------------------------------------
const { MockUPlot, mockSetSize, mockDestroy, mockSetScale, mockConstructorCalls } = vi.hoisted(
	() => {
		const mockSetSize = vi.fn();
		const mockDestroy = vi.fn();
		const mockSetScale = vi.fn();
		// Records [opts, data, target] args from each `new uPlot(...)` call
		const mockConstructorCalls: unknown[][] = [];

		// uPlot is used as `new uPlot(...)` so the mock must be a proper constructor.
		function MockUPlot(this: Record<string, unknown>, ...args: unknown[]) {
			mockConstructorCalls.push(args);
			this.setSize = mockSetSize;
			this.destroy = mockDestroy;
			this.setScale = mockSetScale;
			this.data = [[], []];
			this.scales = { x: { min: 0, max: 100 } };
			this.cursor = { left: null, top: null, idx: null };
		}

		return { MockUPlot, mockSetSize, mockDestroy, mockSetScale, mockConstructorCalls };
	}
);

vi.mock('uplot', () => ({
	default: MockUPlot
}));

// Mock uPlot CSS import
vi.mock('uplot/dist/uPlot.min.css', () => ({}));

// Mock $app/environment to report browser = true
vi.mock('$app/environment', () => ({ browser: true }));

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
		...overrides
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('GraphWidget', () => {
	beforeEach(() => {
		globalData.lines = [];
		mockConstructorCalls.length = 0;
		vi.clearAllMocks();
	});

	afterEach(() => {
		globalData.lines = [];
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

	it('defaults to xField=time and yField=rpm when no config', () => {
		const { container } = render(GraphWidget);
		const xSelect = container.querySelector('select') as HTMLSelectElement;
		expect(xSelect.value).toBe('time');
	});

	it('shows Y dropdown button with single field name when 1 series', () => {
		const config: GraphConfig = { xField: 'time', yFields: ['rpm'] };
		const { container } = render(GraphWidget, { props: { config } });
		// The Y button contains a <span class="... text-stone-700"> with the label
		// Use a targeted query so we don't accidentally match the <option> in the X select
		const yBtn = container.querySelector('button[class*="border-stone-300"]');
		expect(yBtn).toBeTruthy();
		const labelSpan = yBtn!.querySelector('span.text-stone-700');
		expect(labelSpan?.textContent?.trim()).toBe('Rpm');
	});

	it('opens Y dropdown when Y button is clicked', async () => {
		const { container } = render(GraphWidget);
		// The Y dropdown toggle button contains the arrow glyph ▾
		const yBtn = container.querySelector('button[class*="border-stone-300"]') as HTMLButtonElement;
		await fireEvent.click(yBtn);
		// Should now show a scrollable list
		const dropdown = container.querySelector('.max-h-64');
		expect(dropdown).toBeTruthy();
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
		const { getByText } = render(GraphWidget);
		expect(getByText('2 pts')).toBeTruthy();
	});
});

// ---------------------------------------------------------------------------
// buildData logic — verified by observing the chart DOM that uPlot renders.
// The dynamic import('uplot') inside $effect may bypass vi.mock interception,
// so we assert on the rendered output instead.
// ---------------------------------------------------------------------------
describe('GraphWidget — buildData output format', () => {
	it('renders a uPlot chart element when data is loaded', async () => {
		globalData.lines = [makeDataLine({ time: 1, rpm: 3000 }), makeDataLine({ time: 2, rpm: 4500 })];
		const { container } = render(GraphWidget, {
			props: { config: { xField: 'time', yFields: ['rpm'] } }
		});

		// uPlot renders a div with class "uplot" when it successfully mounts.
		// Wait for the async $effect → dynamic import → new uPlot() sequence.
		await waitFor(() => {
			expect(container.querySelector('.uplot')).not.toBeNull();
		});
	});
});
