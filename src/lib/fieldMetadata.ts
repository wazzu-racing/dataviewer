import { NUMERIC_FIELDS, type NumericField } from './types';

export type FieldMetadata = {
	label: string;
	unit?: string;
	precision?: number;
	formatter?: (value: number) => string;
};

type FieldMetadataMap = Record<NumericField, FieldMetadata>;

const FIELD_METADATA: FieldMetadataMap = {
	write_millis: { label: 'Write Millis', unit: 'ms', precision: 0 },
	ecu_millis: { label: 'ECU Millis', unit: 'ms', precision: 0 },
	gps_millis: { label: 'GPS Millis', unit: 'ms', precision: 0 },
	imu_millis: { label: 'IMU Millis', unit: 'ms', precision: 0 },
	accel_millis: { label: 'Accel Millis', unit: 'ms', precision: 0 },
	analogx1_millis: { label: 'Analog X1 Millis', unit: 'ms', precision: 0 },
	analogx2_millis: { label: 'Analog X2 Millis', unit: 'ms', precision: 0 },
	analogx3_millis: { label: 'Analog X3 Millis', unit: 'ms', precision: 0 },
	rpm: { label: 'RPM', unit: 'rpm', precision: 0 },
	time: { label: 'Time', unit: 'ms', precision: 0 },
	syncloss_count: { label: 'Sync Loss Count', unit: 'count', precision: 0 },
	syncloss_code: { label: 'Sync Loss Code', unit: 'code', precision: 0 },
	lat: { label: 'Latitude', unit: '°', precision: 6 },
	lon: { label: 'Longitude', unit: '°', precision: 6 },
	elev: { label: 'Elevation', unit: 'm', precision: 1 },
	ground_speed: { label: 'Ground Speed', unit: 'mph', precision: 1 },
	afr: { label: 'Air-Fuel Ratio', unit: ':1', precision: 2 },
	fuelload: { label: 'Fuel Load', unit: '%', precision: 1 },
	spark_advance: { label: 'Spark Advance', unit: '°', precision: 1 },
	baro: { label: 'Barometric Pressure', unit: 'kPa', precision: 1 },
	map: { label: 'Manifold Absolute Pressure', unit: 'kPa', precision: 1 },
	mat: { label: 'Manifold Air Temp', unit: '°F', precision: 1 },
	clnt_temp: { label: 'Coolant Temp', unit: '°F', precision: 1 },
	tps: { label: 'Throttle Position', unit: '%', precision: 1 },
	batt: { label: 'Battery Voltage', unit: 'V', precision: 2 },
	oil_press: { label: 'Oil Pressure', unit: 'kPa', precision: 1 },
	ltcl_timing: { label: 'LTCL Timing', unit: '°', precision: 1 },
	ve1: { label: 'VE Table 1', unit: '%', precision: 1 },
	ve2: { label: 'VE Table 2', unit: '%', precision: 1 },
	egt: { label: 'EGT', unit: '°F', precision: 1 },
	maf: { label: 'Mass Air Flow', unit: 'g/s', precision: 2 },
	in_temp: { label: 'Intake Temp', unit: '°F', precision: 1 },
	ax: { label: 'Accel X', unit: 'm/s²', precision: 3 },
	ay: { label: 'Accel Y', unit: 'm/s²', precision: 3 },
	az: { label: 'Accel Z', unit: 'm/s²', precision: 3 },
	imu_x: { label: 'IMU Roll Rate', unit: 'deg/s', precision: 2 },
	imu_y: { label: 'IMU Pitch Rate', unit: 'deg/s', precision: 2 },
	imu_z: { label: 'IMU Yaw Rate', unit: 'deg/s', precision: 2 },
	susp_pot_1_FL: { label: 'Susp Pot FL', unit: 'in', precision: 2 },
	susp_pot_2_FR: { label: 'Susp Pot FR', unit: 'in', precision: 2 },
	susp_pot_3_RR: { label: 'Susp Pot RR', unit: 'in', precision: 2 },
	susp_pot_4_RL: { label: 'Susp Pot RL', unit: 'in', precision: 2 },
	rad_in: { label: 'Radiator Inlet Temp', unit: '°F', precision: 1 },
	rad_out: { label: 'Radiator Outlet Temp', unit: '°F', precision: 1 },
	amb_air_temp: { label: 'Ambient Air Temp', unit: '°F', precision: 1 },
	brake1: { label: 'Brake Pressure 1', unit: 'psi', precision: 0 },
	brake2: { label: 'Brake Pressure 2', unit: 'psi', precision: 0 },
	breakout_millis: { label: 'Breakout Millis', unit: 'ms', precision: 0 },
	thermo_millis: { label: 'Thermo Millis', unit: 'ms', precision: 0 },
	thermo_1: { label: 'Thermo 1', unit: '°F', precision: 1 },
	thermo_2: { label: 'Thermo 2', unit: '°F', precision: 1 },
	thermo_3: { label: 'Thermo 3', unit: '°F', precision: 1 },
	thermo_4: { label: 'Thermo 4', unit: '°F', precision: 1 },
	steering: { label: 'Steering Angle', unit: '°', precision: 1 },
	oil_temp: { label: 'Oil Temp', unit: '°F', precision: 1 }
};

const FALLBACK_LABEL = (field: string) =>
	field.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export function getFieldMetadata(field: NumericField): FieldMetadata {
	return FIELD_METADATA[field] ?? { label: FALLBACK_LABEL(field) };
}

export function getFieldLabel(field: NumericField): string {
	return getFieldMetadata(field).label;
}

export function getFieldUnit(field: NumericField): string | undefined {
	return getFieldMetadata(field).unit;
}

export function getFieldLabelWithUnit(field: NumericField): string {
	const metadata = getFieldMetadata(field);
	return metadata.unit ? `${metadata.label} (${metadata.unit})` : metadata.label;
}

type FormatValueOptions = {
	includeUnit?: boolean;
	fallback?: string;
	precision?: number;
};

function formatNumber(value: number, precision: number): string {
	return Number.isFinite(value) ? value.toFixed(precision) : '—';
}

export function formatFieldValue(
	field: NumericField,
	value: number | null | undefined,
	options: FormatValueOptions = {}
): string {
	const fallback = options.fallback ?? '—';
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		return fallback;
	}
	const metadata = getFieldMetadata(field);
	const precision = options.precision ?? metadata.precision ?? (Math.abs(value) >= 100 ? 0 : 2);
	const base = metadata.formatter ? metadata.formatter(value) : formatNumber(value, precision);
	if (options.includeUnit && metadata.unit) {
		return `${base} ${metadata.unit}`;
	}
	return base;
}

export function formatLabelWithUnit(field: NumericField): string {
	return getFieldLabelWithUnit(field);
}

export function unitSuffix(field: NumericField): string {
	const unit = getFieldUnit(field);
	return unit ? ` ${unit}` : '';
}

export function isNumericField(value: string): value is NumericField {
	return (NUMERIC_FIELDS as readonly string[]).includes(value);
}
