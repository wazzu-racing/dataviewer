import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import GaugeWidget from '$lib/components/widgets/GaugeWidget.svelte';
import { data as globalData } from '$lib/data.svelte';
import type { DataLine, GaugeConfig } from '$lib/types';
import {
	formatFieldValue,
	getFieldLabel,
	getFieldLabelWithUnit,
	getFieldUnit
} from '$lib/fieldMetadata';
import { dataStore, type DataState } from '$lib/stores/dataStore';
import { setIndex } from '$lib/stores/time';

function syncTelemetry(lines: DataLine[]) {
	globalData.lines = lines;
	const nextState: DataState = {
		telemetry: lines,
		widgets: []
	};
	dataStore.set(nextState);
	setIndex(lines.length > 0 ? lines.length - 1 : 0);
}

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('GaugeWidget', () => {
	beforeEach(() => {
		syncTelemetry([]);
	});

	afterEach(() => {
		syncTelemetry([]);
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
		syncTelemetry([makeDataLine({ rpm: 3500 }), makeDataLine({ rpm: 7200 })]);

		const { container } = render(GaugeWidget);
		// Default field is 'rpm'; last value is 7200
		const select = container.querySelector('select')!;
		// Ensure 'rpm' is selected
		expect((select as HTMLSelectElement).value).toBe('rpm');
		const valueNode = container.querySelector('svg text[font-size="26"]');
		expect(valueNode?.textContent?.trim()).toBe(formatFieldValue('rpm', 7200));
	});

	it('displays the unit label for the selected field', () => {
		syncTelemetry([makeDataLine({ rpm: 1000 })]);
		const { getByText } = render(GaugeWidget);
		expect(getByText(getFieldUnit('rpm')!)).toBeTruthy();
	});

	it('renders an SVG arc gauge when data is loaded', () => {
		// Two rows with different rpm values so barPct > 0 and the fill arc is rendered
		syncTelemetry([makeDataLine({ rpm: 0 }), makeDataLine({ rpm: 5000 })]);
		const { container } = render(GaugeWidget);
		const svg = container.querySelector('svg');
		expect(svg).toBeTruthy();
		// Should have at least two path elements (track + fill)
		const paths = svg!.querySelectorAll('path');
		expect(paths.length).toBeGreaterThanOrEqual(2);
	});

	it('shows min value and max value as SVG text labels', () => {
		syncTelemetry([makeDataLine({ rpm: 100 }), makeDataLine({ rpm: 8000 })]);
		const { container } = render(GaugeWidget);
		const texts = Array.from(container.querySelectorAll('text')).map((t) => t.textContent?.trim());
		expect(texts).toContain(formatFieldValue('rpm', 100, { includeUnit: true }));
		expect(texts).toContain(formatFieldValue('rpm', 8000, { includeUnit: true }));
	});

	it('renders the field label in the SVG', () => {
		syncTelemetry([makeDataLine({ rpm: 4000 })]);
		const { container } = render(GaugeWidget);
		const svgTexts = Array.from(container.querySelectorAll('svg text')).map((t) =>
			t.textContent?.trim()
		);
		expect(svgTexts).toContain(getFieldLabel('rpm'));
	});

	it('updates displayed value when a different field is selected', async () => {
		syncTelemetry([makeDataLine({ rpm: 4000, tps: 75 })]);
		const { container } = render(GaugeWidget);

		const select = container.querySelector('select') as HTMLSelectElement;
		await fireEvent.change(select, { target: { value: 'tps' } });

		const svgTexts = Array.from(container.querySelectorAll('svg text')).map((t) =>
			t.textContent?.trim()
		);
		expect(svgTexts).toContain(formatFieldValue('tps', 75));
	});

	// ---------------------------------------------------------------------------
	// Config persistence
	// ---------------------------------------------------------------------------

	it('seeds selectedField from config.field prop', () => {
		const config: GaugeConfig = { field: 'tps' };
		const { container } = render(GaugeWidget, { props: { config } });
		const select = container.querySelector('select') as HTMLSelectElement;
		expect(select.value).toBe('tps');
	});

	it('does not fire onConfigChange on initial mount', async () => {
		const onConfigChange = vi.fn();
		render(GaugeWidget, { props: { onConfigChange } });
		await waitFor(() => {});
		expect(onConfigChange).not.toHaveBeenCalled();
	});

	it('fires onConfigChange when a different field is selected', async () => {
		const onConfigChange = vi.fn();
		const { container } = render(GaugeWidget, { props: { onConfigChange } });

		const select = container.querySelector('select') as HTMLSelectElement;
		await fireEvent.change(select, { target: { value: 'tps' } });

		await waitFor(() => {
			expect(onConfigChange).toHaveBeenCalled();
		});
		const cfg = onConfigChange.mock.calls[0][0] as GaugeConfig;
		expect(cfg.field).toBe('tps');
	});
});
