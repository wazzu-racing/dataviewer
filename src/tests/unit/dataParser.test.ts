import { describe, it, expect } from 'vitest';
import {
	parseDataLine,
	scaleGps,
	scaleSpeed,
	scaleEcu,
	scaleSusp,
	scaleThermo,
	scaleBrake,
	GPS_SCALE,
	SPEED_SCALE,
	ECU_SCALE,
	SUSP_ADC_MAX,
	SUSP_MM_PER_INCH,
	THERMO_ADC_MAX,
	THERMO_V_MAX,
	THERMO_V_MIN,
	THERMO_T_MAX,
	THERMO_T_MIN,
	BRAKE_ADC_MAX,
	BRAKE_PSI_MAX,
	BRAKE_V_ZERO,
	BRAKE_V_SPAN
} from '$lib/dataParser';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a zero-filled row of 48 ints */
function zeroRow(): number[] {
	return new Array(48).fill(0);
}

// ---------------------------------------------------------------------------
// Individual scaling helpers
// ---------------------------------------------------------------------------
describe('scaleGps', () => {
	it('converts raw integer to degrees', () => {
		// 46.7327° N  → raw = 467327000
		expect(scaleGps(467_327_000)).toBeCloseTo(46.7327, 4);
	});

	it('handles zero', () => {
		expect(scaleGps(0)).toBe(0);
	});

	it('handles negative (southern/western hemisphere)', () => {
		expect(scaleGps(-100_000_000)).toBeCloseTo(-10, 4);
	});
});

describe('scaleSpeed', () => {
	it('returns 0 for raw 0', () => {
		expect(scaleSpeed(0)).toBe(0);
	});

	it('converts raw value to mph correctly', () => {
		// One SPEED_SCALE unit = 1 mph
		expect(scaleSpeed(SPEED_SCALE)).toBeCloseTo(1, 5);
	});

	it('converts a larger raw value', () => {
		// 60 mph → raw = 60 * SPEED_SCALE
		expect(scaleSpeed(Math.round(60 * SPEED_SCALE))).toBeCloseTo(60, 1);
	});
});

describe('scaleEcu', () => {
	it('divides by 1000', () => {
		expect(scaleEcu(14_500)).toBeCloseTo(14.5, 5);
	});

	it('handles zero', () => {
		expect(scaleEcu(0)).toBe(0);
	});

	it('handles negative values', () => {
		expect(scaleEcu(-1_000)).toBe(-1);
	});
});

describe('scaleSusp', () => {
	it('returns 0 for raw 0', () => {
		expect(scaleSusp(0)).toBe(0);
	});

	it('at full ADC scale returns 100/25.4 mm', () => {
		// raw = SUSP_ADC_MAX → 100 counts / 25.4 mm/inch
		const expected = 100 / SUSP_MM_PER_INCH;
		expect(scaleSusp(SUSP_ADC_MAX)).toBeCloseTo(expected, 5);
	});

	it('scales linearly', () => {
		const half = scaleSusp(SUSP_ADC_MAX / 2);
		const full = scaleSusp(SUSP_ADC_MAX);
		expect(half).toBeCloseTo(full / 2, 5);
	});
});

describe('scaleThermo', () => {
	it('returns THERMO_T_MIN when raw voltage is at THERMO_V_MAX', () => {
		// raw/ADC_MAX = THERMO_V_MAX → temperature = THERMO_T_MIN
		// Math.round() on the raw introduces up to ~0.1 °C error; use precision 0
		const raw = Math.round(THERMO_V_MAX * THERMO_ADC_MAX);
		expect(scaleThermo(raw)).toBeCloseTo(THERMO_T_MIN, 0);
	});

	it('returns THERMO_T_MAX when raw voltage is at THERMO_V_MIN', () => {
		// raw/ADC_MAX = THERMO_V_MIN → temperature = THERMO_T_MAX
		const raw = Math.round(THERMO_V_MIN * THERMO_ADC_MAX);
		expect(scaleThermo(raw)).toBeCloseTo(THERMO_T_MAX, 1);
	});

	it('returns a value between T_MIN and T_MAX for a midpoint voltage', () => {
		const midV = (THERMO_V_MAX + THERMO_V_MIN) / 2;
		const raw = Math.round(midV * THERMO_ADC_MAX);
		const result = scaleThermo(raw);
		expect(result).toBeGreaterThan(THERMO_T_MIN);
		expect(result).toBeLessThan(THERMO_T_MAX);
	});
});

describe('scaleBrake', () => {
	it('returns 0 psi when raw voltage is at BRAKE_V_ZERO', () => {
		// Math.round() introduces up to ~0.1 psi error; use precision 0
		const raw = Math.round(BRAKE_V_ZERO * BRAKE_ADC_MAX);
		expect(scaleBrake(raw)).toBeCloseTo(0, 0);
	});

	it('returns BRAKE_PSI_MAX when raw voltage is at (V_ZERO + V_SPAN)', () => {
		const raw = Math.round((BRAKE_V_ZERO + BRAKE_V_SPAN) * BRAKE_ADC_MAX);
		expect(scaleBrake(raw)).toBeCloseTo(BRAKE_PSI_MAX, 0);
	});

	it('returns a negative value below the zero-offset voltage', () => {
		expect(scaleBrake(0)).toBeLessThan(0);
	});
});

// ---------------------------------------------------------------------------
// parseDataLine — full row conversion
// ---------------------------------------------------------------------------
describe('parseDataLine', () => {
	it('passthrough fields (millis, rpm, time, etc.) are returned as-is', () => {
		const row = zeroRow();
		row[0] = 12345; // write_millis
		row[1] = 67890; // ecu_millis
		row[8] = 4200; // rpm
		row[9] = 999; // time

		const result = parseDataLine(row);
		expect(result.write_millis).toBe(12345);
		expect(result.ecu_millis).toBe(67890);
		expect(result.rpm).toBe(4200);
		expect(result.time).toBe(999);
	});

	it('scales lat and lon via GPS_SCALE', () => {
		const row = zeroRow();
		row[12] = 467_327_000; // lat
		row[13] = -1_172_800_000; // lon

		const result = parseDataLine(row);
		expect(result.lat).toBeCloseTo(46.7327, 4);
		expect(result.lon).toBeCloseTo(-117.28, 4);
	});

	it('constructs unixtime as a Date from row[15] * 1000', () => {
		const row = zeroRow();
		const unixSeconds = 1_700_000_000;
		row[15] = unixSeconds;

		const result = parseDataLine(row);
		expect(result.unixtime).toBeInstanceOf(Date);
		expect(result.unixtime.getTime()).toBe(unixSeconds * 1_000);
	});

	it('scales ground_speed via SPEED_SCALE', () => {
		const row = zeroRow();
		row[16] = Math.round(30 * SPEED_SCALE); // 30 mph

		const result = parseDataLine(row);
		expect(result.ground_speed).toBeCloseTo(30, 1);
	});

	it('scales ECU fields (afr, tps, batt, etc.) by dividing by 1000', () => {
		const row = zeroRow();
		row[17] = 14_700; // afr = 14.7
		row[24] = 75_000; // tps = 75.0
		row[25] = 12_400; // batt = 12.4

		const result = parseDataLine(row);
		expect(result.afr).toBeCloseTo(14.7, 3);
		expect(result.tps).toBeCloseTo(75.0, 3);
		expect(result.batt).toBeCloseTo(12.4, 3);
	});

	it('scales suspension pots via scaleSusp', () => {
		const row = zeroRow();
		row[39] = SUSP_ADC_MAX; // FL at full scale

		const result = parseDataLine(row);
		expect(result.susp_pot_1_FL).toBeCloseTo(100 / SUSP_MM_PER_INCH, 5);
	});

	it('scales thermocouple channels (rad_in, rad_out)', () => {
		const row = zeroRow();
		// Use mid-voltage → expect mid-temperature
		const midV = (THERMO_V_MAX + THERMO_V_MIN) / 2;
		const raw = Math.round(midV * THERMO_ADC_MAX);
		row[43] = raw;
		row[44] = raw;

		const result = parseDataLine(row);
		expect(result.rad_in).toBeGreaterThan(THERMO_T_MIN);
		expect(result.rad_in).toBeLessThan(THERMO_T_MAX);
		expect(result.rad_in).toBeCloseTo(result.rad_out, 5);
	});

	it('passes amb_air_temp through without scaling', () => {
		const row = zeroRow();
		row[45] = 72; // °F raw value

		const result = parseDataLine(row);
		expect(result.amb_air_temp).toBe(72);
	});

	it('scales brake channels via scaleBrake', () => {
		const row = zeroRow();
		// Set raw to produce ~0 psi
		const zeroPsiRaw = Math.round(BRAKE_V_ZERO * BRAKE_ADC_MAX);
		row[46] = zeroPsiRaw;
		row[47] = zeroPsiRaw;

		const result = parseDataLine(row);
		expect(result.brake1).toBeCloseTo(0, 0);
		expect(result.brake2).toBeCloseTo(0, 0);
	});

	it('maps all 48 row indices with no undefined fields', () => {
		const row = zeroRow();
		const result = parseDataLine(row);

		const expectedKeys: (keyof typeof result)[] = [
			'write_millis',
			'ecu_millis',
			'gps_millis',
			'imu_millis',
			'accel_millis',
			'analogx1_millis',
			'analogx2_millis',
			'analogx3_millis',
			'rpm',
			'time',
			'syncloss_count',
			'syncloss_code',
			'lat',
			'lon',
			'elev',
			'unixtime',
			'ground_speed',
			'afr',
			'fuelload',
			'spark_advance',
			'baro',
			'map',
			'mat',
			'clnt_temp',
			'tps',
			'batt',
			'oil_press',
			'ltcl_timing',
			've1',
			've2',
			'egt',
			'maf',
			'in_temp',
			'ax',
			'ay',
			'az',
			'imu_x',
			'imu_y',
			'imu_z',
			'susp_pot_1_FL',
			'susp_pot_2_FR',
			'susp_pot_3_RR',
			'susp_pot_4_RL',
			'rad_in',
			'rad_out',
			'amb_air_temp',
			'brake1',
			'brake2'
		];

		for (const key of expectedKeys) {
			expect(result[key]).toBeDefined();
		}
	});
});
