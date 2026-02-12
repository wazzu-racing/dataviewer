/**
 * Represents a node in the layout tree
 * Can be either a group (horizontal/vertical) or a leaf (actual pane content)
 */
export type LayoutNode = {
	/** The type of node - 'horizontal'/'vertical' for groups, or pane type for leaves */
	type: 'horizontal' | 'vertical' | 'loaddata' | 'graph' | 'map' | string;
	/** Child panes (only present for horizontal/vertical groups) */
	panes?: LayoutNode[];
	/** Default size as a percentage (0-100) */
	defaultSize?: number;
	/** Minimum size as a percentage (0-100) */
	minSize?: number;
	/** Unique identifier for each node */
	id?: string;
};

/**
 * Position where a pane can be dropped relative to a target
 * - Edge positions (top/bottom/left/right) insert adjacent to target
 * - Center replaces target with a split group
 */
export type DropPosition = 'top' | 'bottom' | 'left' | 'right' | 'center';

/**
 * Information about the current drag operation
 * Used to track what is being dragged and what operation to perform on drop
 */
export type DragItem = {
	/** Type of pane being added (for 'add' operations) */
	paneType?: string;
	/** ID of existing node being moved (for 'move' operations) */
	nodeId?: string;
	/** Whether this is adding a new pane or moving an existing one */
	operation: 'add' | 'move';
};

/**
 * Represents a valid drop target with position information
 * Used to describe where a pane will be dropped
 */
export type DropTarget = {
	/** ID of the target node */
	nodeId: string;
	/** Position relative to the target node */
	position: DropPosition;
};

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
