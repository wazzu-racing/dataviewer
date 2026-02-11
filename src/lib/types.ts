/**
 * Represents a node in the layout tree
 * Can be either a group (horizontal/vertical) or a leaf (actual pane content)
 */
export type LayoutNode = {
	/** The type of node - 'horizontal'/'vertical' for groups, or pane type for leaves */
	type: 'horizontal' | 'vertical' | 'leaf' | 'graph' | 'map' | string;
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
