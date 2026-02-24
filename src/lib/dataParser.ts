import type { DataLine } from './types';

// ---------------------------------------------------------------------------
// Scaling constants for binary telemetry fields
// ---------------------------------------------------------------------------
export const GPS_SCALE = 10_000_000;
export const SPEED_SCALE = 447.04; // raw units → mph
export const ECU_SCALE = 1_000; // millis → real units
export const SUSP_ADC_MAX = 5024; // ADC full-scale counts
export const SUSP_MM_PER_INCH = 25.4;
export const THERMO_ADC_MAX = 5024;
export const THERMO_V_MAX = 0.5232; // thermocouple voltage at 0 °F
export const THERMO_V_MIN = 0.0084; // thermocouple voltage at 302 °F
export const THERMO_T_MAX = 302; // °F
export const THERMO_T_MIN = -58; // °F
export const BRAKE_ADC_MAX = 5024;
export const BRAKE_PSI_MAX = 5000;
export const BRAKE_V_ZERO = 0.1; // normalised voltage at 0 psi
export const BRAKE_V_SPAN = 0.8; // normalised voltage span

// ---------------------------------------------------------------------------
// Pure conversion helpers (exported for unit testing)
// ---------------------------------------------------------------------------

/** Convert a raw GPS integer to degrees */
export function scaleGps(raw: number): number {
	return raw / GPS_SCALE;
}

/** Convert a raw speed integer to mph */
export function scaleSpeed(raw: number): number {
	return raw / SPEED_SCALE;
}

/** Convert a raw ECU integer to real units (divide by 1000) */
export function scaleEcu(raw: number): number {
	return raw / ECU_SCALE;
}

/** Convert a raw suspension ADC count to millimetres of travel */
export function scaleSusp(raw: number): number {
	return ((raw / SUSP_ADC_MAX) * 100) / SUSP_MM_PER_INCH;
}

/**
 * Convert a raw thermocouple ADC count to degrees Fahrenheit.
 * The sensor outputs a voltage in [THERMO_V_MIN, THERMO_V_MAX] that maps
 * linearly to [THERMO_T_MAX, THERMO_T_MIN] (note: inverted — higher voltage =
 * lower temperature).
 */
export function scaleThermo(raw: number): number {
	return (
		((raw / THERMO_ADC_MAX - THERMO_V_MAX) / (THERMO_V_MIN - THERMO_V_MAX)) *
			(THERMO_T_MAX - THERMO_T_MIN) +
		THERMO_T_MIN
	);
}

/** Convert a raw brake pressure ADC count to psi */
export function scaleBrake(raw: number): number {
	return BRAKE_PSI_MAX * ((raw / BRAKE_ADC_MAX - BRAKE_V_ZERO) / BRAKE_V_SPAN);
}

// ---------------------------------------------------------------------------
// Main parser: converts one raw row (48 int32 values) into a DataLine
// ---------------------------------------------------------------------------

/**
 * Parse a single row of raw telemetry integers into a typed DataLine.
 * @param row  Array of exactly 48 signed 32-bit integers (little-endian from
 *             the .bin file) in the order defined by the datalogger firmware.
 */
export function parseDataLine(row: number[]): DataLine {
	return {
		write_millis: row[0],
		ecu_millis: row[1],
		gps_millis: row[2],
		imu_millis: row[3],
		accel_millis: row[4],
		analogx1_millis: row[5],
		analogx2_millis: row[6],
		analogx3_millis: row[7],
		rpm: row[8],
		time: row[9],
		syncloss_count: row[10],
		syncloss_code: row[11],
		lat: scaleGps(row[12]),
		lon: scaleGps(row[13]),
		elev: row[14],
		unixtime: new Date(row[15] * 1_000),
		ground_speed: scaleSpeed(row[16]),
		afr: scaleEcu(row[17]),
		fuelload: scaleEcu(row[18]),
		spark_advance: scaleEcu(row[19]),
		baro: scaleEcu(row[20]),
		map: scaleEcu(row[21]),
		mat: scaleEcu(row[22]),
		clnt_temp: scaleEcu(row[23]),
		tps: scaleEcu(row[24]),
		batt: scaleEcu(row[25]),
		oil_press: scaleEcu(row[26]),
		ltcl_timing: scaleEcu(row[27]),
		ve1: scaleEcu(row[28]),
		ve2: scaleEcu(row[29]),
		egt: scaleEcu(row[30]),
		maf: scaleEcu(row[31]),
		in_temp: scaleEcu(row[32]),
		ax: scaleEcu(row[33]),
		ay: scaleEcu(row[34]),
		az: scaleEcu(row[35]),
		imu_x: scaleEcu(row[36]),
		imu_y: scaleEcu(row[37]),
		imu_z: scaleEcu(row[38]),
		susp_pot_1_FL: scaleSusp(row[39]),
		susp_pot_2_FR: scaleSusp(row[40]),
		susp_pot_3_RR: scaleSusp(row[41]),
		susp_pot_4_RL: scaleSusp(row[42]),
		rad_in: scaleThermo(row[43]),
		rad_out: scaleThermo(row[44]),
		amb_air_temp: row[45],
		brake1: scaleBrake(row[46]),
		brake2: scaleBrake(row[47])
	};
}
