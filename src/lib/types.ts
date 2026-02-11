export type LayoutNode = {
	type: 'horizontal' | 'vertical' | 'leaf' | 'graph' | 'map' | string;
	panes?: LayoutNode[];
	defaultSize?: number;
	minSize?: number;
	id?: string; // Unique identifier for each node
};

export type DropPosition = 'top' | 'bottom' | 'left' | 'right' | 'center';

export type DragItem = {
	paneType?: string; // For adding new panes
	nodeId?: string; // For moving existing panes
	operation: 'add' | 'move';
};

export type DropTarget = {
	nodeId: string;
	position: DropPosition;
};
