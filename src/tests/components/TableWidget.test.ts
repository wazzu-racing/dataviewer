import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import TableWidget from '$lib/components/widgets/TableWidget.svelte';
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
describe('TableWidget', () => {
	beforeEach(() => {
		globalData.lines = [];
	});

	afterEach(() => {
		globalData.lines = [];
	});

	it('shows "No data loaded" message when no data', () => {
		const { getByText } = render(TableWidget);
		expect(getByText(/No data loaded/)).toBeTruthy();
	});

	it('shows "0 rows" when no data', () => {
		const { getByText } = render(TableWidget);
		expect(getByText('0 rows')).toBeTruthy();
	});

	it('displays the correct row count when data is loaded', () => {
		globalData.lines = [makeDataLine(), makeDataLine(), makeDataLine()];
		const { getByText } = render(TableWidget);
		expect(getByText('3 rows')).toBeTruthy();
	});

	it('renders default 6 column headers', () => {
		globalData.lines = [makeDataLine()];
		const { container } = render(TableWidget);
		// Default columns: time, rpm, ground_speed, tps, afr, batt
		const headers = container.querySelectorAll('div.font-semibold.text-stone-700');
		expect(headers.length).toBe(6);
	});

	it('renders a "Columns" picker button', () => {
		const { getByText } = render(TableWidget);
		expect(getByText(/Columns/)).toBeTruthy();
	});

	it('opens the column picker dropdown when "Columns" is clicked', async () => {
		const { getByText, container } = render(TableWidget);
		const btn = getByText(/Columns/);
		await fireEvent.click(btn);
		// Should show checkboxes
		const checkboxes = container.querySelectorAll('input[type="checkbox"]');
		expect(checkboxes.length).toBeGreaterThan(0);
	});

	it('column picker shows all 47 available columns as checkboxes', async () => {
		const { getByText, container } = render(TableWidget);
		await fireEvent.click(getByText(/Columns/));
		const checkboxes = container.querySelectorAll('input[type="checkbox"]');
		expect(checkboxes.length).toBe(47);
	});

	it('renders data rows when data is loaded', () => {
		globalData.lines = [makeDataLine({ time: 42, rpm: 3000 })];
		const { container } = render(TableWidget);
		// At least one data row should be present (excluding header)
		const rows = container.querySelectorAll('.border-b.border-stone-100');
		expect(rows.length).toBeGreaterThan(0);
	});

	it('formats numbers to 3 decimal places', () => {
		globalData.lines = [makeDataLine({ time: 1.23456 })];
		const { getByText } = render(TableWidget);
		// 'time' is a default column
		expect(getByText('1.235')).toBeTruthy();
	});

	it('toggles a column off when its checkbox is unchecked', async () => {
		globalData.lines = [makeDataLine()];
		const { getByText, container } = render(TableWidget);

		// Open column picker
		await fireEvent.click(getByText(/Columns/));

		// Find the 'time' checkbox (first default column)
		const checkboxes = container.querySelectorAll(
			'input[type="checkbox"]'
		) as NodeListOf<HTMLInputElement>;
		// Find the one for 'time' — it's inside a label containing 'time'
		let timeCheckbox: HTMLInputElement | undefined;
		checkboxes.forEach((cb) => {
			if (cb.closest('label')?.textContent?.includes('time')) {
				timeCheckbox = cb;
			}
		});
		expect(timeCheckbox).toBeTruthy();

		// Uncheck it
		await fireEvent.click(timeCheckbox!);

		// 'time' header should no longer appear
		const headers = container.querySelectorAll('div.font-semibold.text-stone-700');
		const headerTexts = Array.from(headers).map((h) => h.textContent?.trim());
		expect(headerTexts).not.toContain('time');
	});
});
