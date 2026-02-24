import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import DropZone from '$lib/components/DropZone.svelte';

// ---------------------------------------------------------------------------
// Helpers: build DragEvents with realistic DataTransfer
// ---------------------------------------------------------------------------

/** Build a properly typed fake DragEvent for testing */
function buildDragEvent(
	type: string,
	opts: {
		hasPane?: boolean;
		widgetType?: string;
		clientX?: number;
		clientY?: number;
		relatedTarget?: EventTarget | null;
	} = {}
): DragEvent {
	const {
		hasPane = true,
		widgetType = 'graph',
		clientX = 0,
		clientY = 0,
		relatedTarget = null
	} = opts;

	const dt: DataTransfer = {
		types: hasPane ? ['application/pane-type'] : [],
		getData: (key: string) => (key === 'application/pane-type' ? widgetType : ''),
		setData: vi.fn(),
		dropEffect: 'none',
		effectAllowed: 'none',
		files: [] as unknown as FileList,
		items: {} as DataTransferItemList,
		clearData: vi.fn(),
		setDragImage: vi.fn()
	} as unknown as DataTransfer;

	const event = new MouseEvent(type, {
		bubbles: true,
		cancelable: true,
		clientX,
		clientY
	}) as unknown as DragEvent;

	Object.defineProperty(event, 'dataTransfer', { value: dt, writable: false });
	Object.defineProperty(event, 'relatedTarget', { value: relatedTarget, writable: false });
	return event;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('DropZone', () => {
	it('renders children content', () => {
		// @testing-library/svelte requires children as a snippet — we test via slot text
		const { getByText } = render(DropZone, {
			props: { nodeId: 'node-1', onDrop: vi.fn() }
		});
		// The component renders a wrapping div; it should exist in the document
		const container = document.querySelector('[role="region"]');
		expect(container).toBeTruthy();
	});

	it('shows no overlay when not dragging', () => {
		const { container } = render(DropZone, {
			props: { nodeId: 'node-1', onDrop: vi.fn() }
		});
		// No blue indicator elements when not dragging
		const indicators = container.querySelectorAll('.bg-blue-500');
		expect(indicators).toHaveLength(0);
	});

	it('ignores dragover events that are not pane-type drags', () => {
		const onDrop = vi.fn();
		const { container } = render(DropZone, { props: { nodeId: 'node-1', onDrop } });
		const zone = container.querySelector('[role="region"]')!;

		const event = buildDragEvent('dragover', { hasPane: false });
		fireEvent(zone, event);

		// No overlay should appear
		const indicators = container.querySelectorAll('.bg-blue-500');
		expect(indicators).toHaveLength(0);
	});

	it('shows an overlay when a pane-type drag enters the zone', async () => {
		const { container } = render(DropZone, {
			props: { nodeId: 'node-1', onDrop: vi.fn() }
		});
		const zone = container.querySelector('[role="region"]')!;

		// Mock getBoundingClientRect so position calculation works
		zone.getBoundingClientRect = () => ({
			left: 0,
			top: 0,
			width: 200,
			height: 200,
			right: 200,
			bottom: 200,
			x: 0,
			y: 0,
			toJSON: () => {}
		});

		// Cursor at center (100, 100) within a 200×200 box → center position
		const event = buildDragEvent('dragover', { clientX: 100, clientY: 100 });
		fireEvent(zone, event);

		// Center overlay should be present
		const centerOverlay = container.querySelector('.border-dashed');
		expect(centerOverlay).toBeTruthy();
	});

	it('fires onDrop with correct nodeId, widgetType, and position', () => {
		const onDrop = vi.fn();
		const { container } = render(DropZone, { props: { nodeId: 'test-node', onDrop } });
		const zone = container.querySelector('[role="region"]')!;

		zone.getBoundingClientRect = () => ({
			left: 0,
			top: 0,
			width: 200,
			height: 200,
			right: 200,
			bottom: 200,
			x: 0,
			y: 0,
			toJSON: () => {}
		});

		// First trigger dragover to set dropPosition
		const dragover = buildDragEvent('dragover', {
			widgetType: 'map',
			clientX: 100,
			clientY: 100
		});
		fireEvent(zone, dragover);

		// Then trigger drop
		const drop = buildDragEvent('drop', { widgetType: 'map', clientX: 100, clientY: 100 });
		fireEvent(zone, drop);

		expect(onDrop).toHaveBeenCalledOnce();
		expect(onDrop).toHaveBeenCalledWith('test-node', 'map', 'center');
	});

	it('does not fire onDrop for non-pane-type drops', () => {
		const onDrop = vi.fn();
		const { container } = render(DropZone, { props: { nodeId: 'node-1', onDrop } });
		const zone = container.querySelector('[role="region"]')!;

		const drop = buildDragEvent('drop', { hasPane: false });
		fireEvent(zone, drop);

		expect(onDrop).not.toHaveBeenCalled();
	});

	it('computes "top" drop position when cursor is in the top 25%', () => {
		const onDrop = vi.fn();
		const { container } = render(DropZone, { props: { nodeId: 'n', onDrop } });
		const zone = container.querySelector('[role="region"]')!;

		zone.getBoundingClientRect = () => ({
			left: 0,
			top: 0,
			width: 200,
			height: 200,
			right: 200,
			bottom: 200,
			x: 0,
			y: 0,
			toJSON: () => {}
		});

		// y=10 is within top 25% (< 50)
		fireEvent(zone, buildDragEvent('dragover', { clientX: 100, clientY: 10 }));
		fireEvent(zone, buildDragEvent('drop', { widgetType: 'gauge', clientX: 100, clientY: 10 }));

		expect(onDrop).toHaveBeenCalledWith('n', 'gauge', 'top');
	});

	it('computes "bottom" drop position when cursor is in the bottom 25%', () => {
		const onDrop = vi.fn();
		const { container } = render(DropZone, { props: { nodeId: 'n', onDrop } });
		const zone = container.querySelector('[role="region"]')!;

		zone.getBoundingClientRect = () => ({
			left: 0,
			top: 0,
			width: 200,
			height: 200,
			right: 200,
			bottom: 200,
			x: 0,
			y: 0,
			toJSON: () => {}
		});

		// y=190 is in bottom 25% (> 150)
		fireEvent(zone, buildDragEvent('dragover', { clientX: 100, clientY: 190 }));
		fireEvent(zone, buildDragEvent('drop', { widgetType: 'table', clientX: 100, clientY: 190 }));

		expect(onDrop).toHaveBeenCalledWith('n', 'table', 'bottom');
	});

	it('computes "left" drop position when cursor is in the left 25%', () => {
		const onDrop = vi.fn();
		const { container } = render(DropZone, { props: { nodeId: 'n', onDrop } });
		const zone = container.querySelector('[role="region"]')!;

		zone.getBoundingClientRect = () => ({
			left: 0,
			top: 0,
			width: 200,
			height: 200,
			right: 200,
			bottom: 200,
			x: 0,
			y: 0,
			toJSON: () => {}
		});

		// y=100 (middle vertically), x=10 → left 25% (< 50)
		fireEvent(zone, buildDragEvent('dragover', { clientX: 10, clientY: 100 }));
		fireEvent(zone, buildDragEvent('drop', { widgetType: 'graph', clientX: 10, clientY: 100 }));

		expect(onDrop).toHaveBeenCalledWith('n', 'graph', 'left');
	});

	it('computes "right" drop position when cursor is in the right 25%', () => {
		const onDrop = vi.fn();
		const { container } = render(DropZone, { props: { nodeId: 'n', onDrop } });
		const zone = container.querySelector('[role="region"]')!;

		zone.getBoundingClientRect = () => ({
			left: 0,
			top: 0,
			width: 200,
			height: 200,
			right: 200,
			bottom: 200,
			x: 0,
			y: 0,
			toJSON: () => {}
		});

		// x=190 → right 25% (> 150)
		fireEvent(zone, buildDragEvent('dragover', { clientX: 190, clientY: 100 }));
		fireEvent(zone, buildDragEvent('drop', { widgetType: 'map', clientX: 190, clientY: 100 }));

		expect(onDrop).toHaveBeenCalledWith('n', 'map', 'right');
	});
});
