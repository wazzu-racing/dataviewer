import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import PaneLayout from '$lib/components/PaneLayout.svelte';
import type { LayoutNode } from '$lib/types';

// ---------------------------------------------------------------------------
// Mock heavy widgets so their dynamic imports / DOM requirements don't break tests
// ---------------------------------------------------------------------------
vi.mock('$lib/components/widgets/GraphWidget.svelte', () => ({
	default: vi.fn()
}));
vi.mock('$lib/components/widgets/MapWidget.svelte', () => ({
	default: vi.fn()
}));
vi.mock('paneforge', () => ({
	PaneGroup: vi.fn(),
	Pane: vi.fn(),
	PaneResizer: vi.fn()
}));

function makeLeaf(id: string, type: LayoutNode['type'] = 'gauge'): LayoutNode {
	return { id, type };
}

const defaultProps = {
	onDrop: vi.fn(),
	onRemove: vi.fn(),
	onPopOut: vi.fn(),
	onConfigChange: vi.fn()
};

describe('PaneLayout — leaf nodes', () => {
	it('renders the correct label for "gauge" widget type', () => {
		const { getByText } = render(PaneLayout, {
			props: { layout: makeLeaf('n1', 'gauge'), ...defaultProps }
		});
		expect(getByText('Gauge')).toBeTruthy();
	});

	it('renders the correct label for "table" widget type', () => {
		const { getByText } = render(PaneLayout, {
			props: { layout: makeLeaf('n1', 'table'), ...defaultProps }
		});
		expect(getByText('Table')).toBeTruthy();
	});

	it('renders the correct label for "map" widget type', () => {
		const { getByText } = render(PaneLayout, {
			props: { layout: makeLeaf('n1', 'map'), ...defaultProps }
		});
		expect(getByText('Map')).toBeTruthy();
	});

	it('renders the correct label for "load-data" widget type', () => {
		const { getAllByText } = render(PaneLayout, {
			props: { layout: makeLeaf('n1', 'load-data'), ...defaultProps }
		});
		// "Load Data" appears in both the toolbar title and the widget heading
		expect(getAllByText('Load Data').length).toBeGreaterThanOrEqual(1);
	});

	it('fires onPopOut with the node id when pop-out button is clicked', () => {
		const onPopOut = vi.fn();
		const { getByTitle } = render(PaneLayout, {
			props: { layout: makeLeaf('my-node', 'gauge'), ...defaultProps, onPopOut }
		});
		const btn = getByTitle('Pop out into floating window');
		fireEvent.click(btn);
		expect(onPopOut).toHaveBeenCalledWith('my-node');
	});

	it('fires onRemove with the node id when close button is clicked', () => {
		const onRemove = vi.fn();
		const { getByTitle } = render(PaneLayout, {
			props: { layout: makeLeaf('my-node', 'gauge'), ...defaultProps, onRemove }
		});
		const btn = getByTitle('Close pane');
		fireEvent.click(btn);
		expect(onRemove).toHaveBeenCalledWith('my-node');
	});
});
