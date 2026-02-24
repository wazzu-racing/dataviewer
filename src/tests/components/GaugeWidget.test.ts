import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import GaugeWidget from '$lib/components/widgets/GaugeWidget.svelte';
import { data as globalData } from '$lib/data.svelte';
import type { DataLine } from '$lib/types';

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('GaugeWidget', () => {
	beforeEach(() => {
		globalData.lines = [];
	});

	afterEach(() => {
		globalData.lines = [];
	});

	it('shows "No data loaded" when globalData is empty', () => {
		const { getByText } = render(GaugeWidget);
		expect(getByText('No data loaded')).toBeTruthy();
	});

	it('renders a field selector dropdown', () => {
		const { container } = render(GaugeWidget);
		const select = container.querySelector('select');
		expect(select).toBeTruthy();
	});

	it('field selector contains at least the default fields', () => {
		const { container } = render(GaugeWidget);
		const options = container.querySelectorAll('select option');
		// GaugeWidget has 35 fields
		expect(options.length).toBeGreaterThanOrEqual(35);
	});

	it('displays the last data point value when data is loaded', async () => {
		globalData.lines = [makeDataLine({ rpm: 3500 }), makeDataLine({ rpm: 7200 })];

		const { container } = render(GaugeWidget);
		// Default field is 'rpm'; last value is 7200
		const select = container.querySelector('select')!;
		// Ensure 'rpm' is selected
		expect((select as HTMLSelectElement).value).toBe('rpm');
		// The large value display is in the text-5xl div
		const bigValue = container.querySelector('.text-5xl');
		expect(bigValue?.textContent?.trim()).toBe('7200.0');
	});

	it('displays the unit label for the selected field', () => {
		globalData.lines = [makeDataLine({ rpm: 1000 })];
		const { getByText } = render(GaugeWidget);
		expect(getByText('RPM')).toBeTruthy();
	});

	it('renders the min/max bar when data is loaded', () => {
		globalData.lines = [makeDataLine({ rpm: 1000 }), makeDataLine({ rpm: 5000 })];
		const { container } = render(GaugeWidget);
		const bar = container.querySelector('.bg-blue-500');
		expect(bar).toBeTruthy();
	});

	it('shows min value of 0 and max value of the highest rpm', () => {
		globalData.lines = [makeDataLine({ rpm: 0 }), makeDataLine({ rpm: 8000 })];
		const { container } = render(GaugeWidget);
		// Min/max are shown in the .flex.justify-between span elements
		const spans = container.querySelectorAll('.flex.justify-between span');
		const texts = Array.from(spans).map((s) => s.textContent?.trim());
		expect(texts).toContain('0.0');
		expect(texts).toContain('8000.0');
	});

	it('renders the field label below the value', () => {
		globalData.lines = [makeDataLine({ rpm: 4000 })];
		const { container } = render(GaugeWidget);
		// prettyLabel('rpm') → 'Rpm' — shown in the .text-sm.font-medium div below the value
		const label = container.querySelector('.text-sm.font-medium');
		expect(label?.textContent?.trim()).toBe('Rpm');
	});

	it('updates displayed value when a different field is selected', async () => {
		globalData.lines = [makeDataLine({ rpm: 4000, tps: 75 })];
		const { container } = render(GaugeWidget);

		const select = container.querySelector('select') as HTMLSelectElement;
		await fireEvent.change(select, { target: { value: 'tps' } });

		const bigValue = container.querySelector('.text-5xl');
		expect(bigValue?.textContent?.trim()).toBe('75.0');
	});
});
