export type LayoutNode = {
	type: 'horizontal' | 'vertical' | 'leaf' | 'graph' | 'map' | string;
	panes?: LayoutNode[];
	defaultSize?: number;
	minSize?: number;
};
