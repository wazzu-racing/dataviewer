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
// Widget configuration types
// ---------------------------------------------------------------------------

/** How the x-axis is labelled when a time-based field is selected */
export type XDisplayMode = 'raw' | 'relative' | 'absolute';

/** Type of 3D visualization mode */
export type Graph3DMode = '3d-scatter' | '3d-surface';

/**
 * Per-pane configuration for the Graph widget.
 * Supports both 2D and 3D graph modes.
 */
export type GraphConfig = {
	xField: string; // e.g. 'time'
	yFields: string[]; // e.g. ['rpm', 'tps']
	xDisplayMode?: XDisplayMode; // how x-axis labels are formatted for time fields
	/** When true, renders as 3D graph instead of 2D */
	is3D?: boolean;
	/** Z-axis fields for 3D mode (multiple fields supported like yFields) */
	zFields?: string[];
	/** Type of 3D visualization: scatter (points/lines) or surface (heatmap) */
	mode3D?: Graph3DMode;
};

/** Per-pane configuration for the Gauge widget */
export type GaugeConfig = {
	field: string; // e.g. 'rpm'
};

/** Per-pane configuration for the Table widget */
export type TableConfig = {
	visibleColumns: string[]; // e.g. ['time', 'rpm', 'tps']
};

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

// ---------------------------------------------------------------------------
// Saved Layout Management
// ---------------------------------------------------------------------------

/** A saved layout configuration that can be loaded by the user */
export type SavedLayout = {
	id: string;
	name: string;
	layout: LayoutNode;
	floatingPanes: FloatingPaneState[];
	createdAt: number;
	lastUsed: number;
};

/** Data structure for the layout store in localStorage */
export type LayoutStoreData = {
	layouts: SavedLayout[];
	activeLayoutId: string | null;
	autoSaveEnabled: boolean;
};
