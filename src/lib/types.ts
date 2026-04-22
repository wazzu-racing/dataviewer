/**
 * Represents a single line of telemetry data from the datalogger
 */
export type DataLine = {
	write_millis: number;
	ecu_millis: number;
	breakout_millis: number; // new
	gps_millis: number;
	imu_millis: number;
	accel_millis: number;
	analogx1_millis: number;
	analogx2_millis: number;
	analogx3_millis: number;
	thermo_millis: number; // new
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
	thermo_1: number; // new
	thermo_2: number; // new
	thermo_3: number; // new
	thermo_4: number; // new
	steering: number; // new
	oil_temp: number; // new
};

export const BIN_FIELD_COUNT = 48;
export const WR_FIELD_COUNT = 53;

/** Union of binary file extensions */
export type FileExtension = 'bin' | 'wr';

// ---------------------------------------------------------------------------
// Widget configuration types
// ---------------------------------------------------------------------------

/** How the x-axis is labelled when a time-based field is selected */
export type XDisplayMode = 'raw' | 'relative' | 'absolute';

/** Type of 3D visualization mode */
export type Graph3DMode = '3d-scatter' | '3d-surface';

/** Type of 2D visualization mode */
export type Graph2DMode = 'line' | 'scatter' | 'area';

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
	/** Type of 2D visualization: line, scatter, or area */
	mode2D?: Graph2DMode;
};

/** Per-pane configuration for the Gauge widget */
export type GaugeConfig = {
	field: string; // e.g. 'rpm'
};

/** Per-pane configuration for the Map widget */
export type MapConfig = {
	field: NumericField; // e.g. 'ground_speed'
};

/** Per-pane configuration for the Table widget */
export type TableConfig = {
	visibleColumns: string[]; // e.g. ['time', 'rpm', 'tps']
};

// ---------------------------------------------------------------------------
// Pane / windowing system types
// ---------------------------------------------------------------------------

/** All widget types that can occupy a pane */
export type PaneWidgetType = 'graph' | 'map' | 'table' | 'gauge' | 'load-data' | 'metadata';

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

/** Shared labels for widget types */
export const WIDGET_LABELS: Record<PaneWidgetType, string> = {
	graph: 'Graph',
	map: 'Map',
	table: 'Table',
	gauge: 'Gauge',
	'load-data': 'Load Data',
	metadata: 'Metadata'
};

/** Data structure for the layout store in localStorage */
export type LayoutStoreData = {
	layouts: SavedLayout[];
	activeLayoutId: string | null;
	autoSaveEnabled: boolean;
};

// ---------------------------------------------------------------------------
// Shared field lists
// ---------------------------------------------------------------------------

/**
 * All numeric (plottable) keys from DataLine — excludes 'unixtime' (which is a Date).
 * Exported here so that widgets (GraphWidget, TableWidget, etc.) can share a
 * single source of truth instead of each maintaining their own copy.
 */
export const NUMERIC_FIELDS = [
	'write_millis',
	'ecu_millis',
	'breakout_millis',
	'gps_millis',
	'imu_millis',
	'accel_millis',
	'analogx1_millis',
	'analogx2_millis',
	'analogx3_millis',
	'thermo_millis',
	'rpm',
	'time',
	'syncloss_count',
	'syncloss_code',
	'lat',
	'lon',
	'elev',
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
	'brake2',
	'thermo_1',
	'thermo_2',
	'thermo_3',
	'thermo_4',
	'steering',
	'oil_temp'
] as const satisfies (keyof DataLine)[];

/** Union of all numeric DataLine field names */
export type NumericField = (typeof NUMERIC_FIELDS)[number];

// ---------------------------------------------------------------------------
// File format types
// ---------------------------------------------------------------------------

/** Metadata stored in the .wazzuracing ZIP format */
export type SessionMetadata = {
	version: string;
	name: string;
	driver?: string;
	location?: string;
	datetime?: string;
	conditions?: string;
	files: {
		telemetry: string; // reference to the CSV file within the ZIP
	};
};

// ---------------------------------------------------------------------------
// Command Palette Types
// ---------------------------------------------------------------------------

/** A command that can be executed from the command palette */
export type Command = ExecutableCommand | CommandGroup;

export type BaseCommand = {
	id: string;
	label: string;
	description?: string;
	shortcut?: string;
	category?: string;
};

export type ExecutableCommand = BaseCommand & {
	action: () => void;
	children?: never;
};

export type CommandGroup = BaseCommand & {
	action?: never;
	children: Command[];
};
