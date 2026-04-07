import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import TableWidget from '$lib/components/widgets/TableWidget.svelte';
import { data as globalData } from '$lib/data.svelte';
import type { DataLine, TableConfig, NumericField } from '$lib/types';
import { formatFieldValue, getFieldLabelWithUnit } from '$lib/fieldMetadata';

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
		const { getByText } = render(TableWidget);
		const defaultFields: NumericField[] = ['time', 'rpm', 'ground_speed', 'tps', 'afr', 'batt'];
		defaultFields.forEach((field) => {
			expect(getByText(getFieldLabelWithUnit(field))).toBeTruthy();
		});
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
		const { getByText } = render(TableWidget);
		expect(getByText(formatFieldValue('time', 42, { includeUnit: true }))).toBeTruthy();
		expect(getByText(formatFieldValue('rpm', 3000, { includeUnit: true }))).toBeTruthy();
	});

	it('formats numeric cells using field metadata precision and units', () => {
		globalData.lines = [makeDataLine({ afr: 14.6789 })];
		const { getByText } = render(TableWidget);
		expect(getByText(formatFieldValue('afr', 14.6789, { includeUnit: true }))).toBeTruthy();
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
			if (cb.closest('label')?.textContent?.includes(getFieldLabelWithUnit('time'))) {
				timeCheckbox = cb;
			}
		});
		expect(timeCheckbox).toBeTruthy();

		// Uncheck it
		await fireEvent.click(timeCheckbox!);

		// 'time' header should no longer appear
		const headerSection = container.querySelector('.shrink-0.border-b');
		const headerTexts = Array.from(headerSection?.querySelectorAll('.w-28') ?? []).map((h) =>
			h.textContent?.trim()
		);
		expect(headerTexts).not.toContain(getFieldLabelWithUnit('time'));
	});

	// ---------------------------------------------------------------------------
	// Config persistence
	// ---------------------------------------------------------------------------

	it('seeds visibleColumns from config.visibleColumns prop', () => {
		const config: TableConfig = { visibleColumns: ['rpm', 'tps'] };
		globalData.lines = [makeDataLine({ rpm: 3000, tps: 50 })];
		const { getByText, queryByText } = render(TableWidget, { props: { config } });
		expect(getByText(getFieldLabelWithUnit('rpm'))).toBeTruthy();
		expect(getByText(getFieldLabelWithUnit('tps'))).toBeTruthy();
		// Should not contain default columns that weren't in config
		expect(queryByText(getFieldLabelWithUnit('afr'))).toBeNull();
		expect(queryByText(getFieldLabelWithUnit('batt'))).toBeNull();
	});

	it('does not fire onConfigChange on initial mount', async () => {
		const onConfigChange = vi.fn();
		render(TableWidget, { props: { onConfigChange } });
		await waitFor(() => {});
		expect(onConfigChange).not.toHaveBeenCalled();
	});

	it('fires onConfigChange when a column is toggled', async () => {
		const onConfigChange = vi.fn();
		const { getByText, container } = render(TableWidget, { props: { onConfigChange } });

		await fireEvent.click(getByText(/Columns/));

		// Toggle 'afr' off (it's a default column)
		const checkboxes = container.querySelectorAll(
			'input[type="checkbox"]'
		) as NodeListOf<HTMLInputElement>;
		let afrCheckbox: HTMLInputElement | undefined;
		checkboxes.forEach((cb) => {
			if (cb.closest('label')?.textContent?.trim() === getFieldLabelWithUnit('afr')) {
				afrCheckbox = cb;
			}
		});
		expect(afrCheckbox).toBeTruthy();
		await fireEvent.click(afrCheckbox!);

		await waitFor(() => {
			expect(onConfigChange).toHaveBeenCalled();
		});
		const cfg = onConfigChange.mock.calls[0][0] as TableConfig;
		expect(cfg.visibleColumns).not.toContain('afr');
	});
});
