/**
 * Represents a single line of telemetry data from the datalogger
 */
export type DataLine = {
	write_millis: number;
	ecu_millis: number;
	gps_millis: number;
	imu_millis: number;
	accel_millis: number;
	analogx1_millis: number;
	analogx2_millis: number;
	analogx3_millis: number;
	rpm: number;
	time: number;
	syncloss_count: number;
	syncloss_code: number;
	lat: number;
	lon: number;
	elev: number;
	unixtime: Date;
	ground_speed: number;
	afr: number;
	fuelload: number;
	spark_advance: number;
	baro: number;
	map: number;
	mat: number;
	clnt_temp: number;
	tps: number;
	batt: number;
	oil_press: number;
	ltcl_timing: number;
	ve1: number;
	ve2: number;
	egt: number;
	maf: number;
	in_temp: number;
	ax: number;
	ay: number;
	az: number;
	imu_x: number;
	imu_y: number;
	imu_z: number;
	susp_pot_1_FL: number;
	susp_pot_2_FR: number;
	susp_pot_3_RR: number;
	susp_pot_4_RL: number;
	rad_in: number;
	rad_out: number;
	amb_air_temp: number;
	brake1: number;
	brake2: number;
};

export const NUM_FIELDS = 48;

// ---------------------------------------------------------------------------
// Pane / windowing system types
// ---------------------------------------------------------------------------

/** All widget types that can occupy a pane */
export type PaneWidgetType = 'graph' | 'map' | 'table' | 'gauge' | 'load-data';

/**
 * A node in the recursive layout tree.
 * - 'horizontal' / 'vertical' → group nodes with children
 * - PaneWidgetType → leaf nodes containing a widget
 */
export type LayoutNode = {
	id: string;
	type: 'horizontal' | 'vertical' | PaneWidgetType;
	panes?: LayoutNode[];
	defaultSize?: number; // 0–100 percentage within the parent group
	minSize?: number; // 0–100 percentage minimum
	config?: Record<string, unknown>; // widget-specific settings (e.g. which fields to plot)
};

/** Where a dragged widget is being dropped relative to an existing pane */
export type DropPosition = 'top' | 'bottom' | 'left' | 'right' | 'center';

/** State for a free-floating (popped-out) panel */
export type FloatingPaneState = {
	id: string;
	type: PaneWidgetType;
	x: number;
	y: number;
	width: number;
	height: number;
	zIndex: number;
	config?: Record<string, unknown>;
};
