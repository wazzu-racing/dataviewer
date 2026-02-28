import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import FloatingPane from '$lib/components/FloatingPane.svelte';
import type { FloatingPaneState } from '$lib/types';

// Mock @neodrag/svelte since it requires real browser drag APIs
vi.mock('@neodrag/svelte', () => ({
	draggable: () => ({ destroy: vi.fn() })
}));

// Mock heavy widgets
vi.mock('$lib/components/widgets/GraphWidget.svelte', () => ({
	default: vi.fn()
}));
vi.mock('$lib/components/widgets/MapWidget.svelte', () => ({
	default: vi.fn()
}));

function makePane(overrides: Partial<FloatingPaneState> = {}): FloatingPaneState {
	return {
		id: 'fp-1',
		type: 'gauge',
		x: 100,
		y: 100,
		width: 400,
		height: 300,
		zIndex: 10,
		...overrides
	};
}

describe('FloatingPane', () => {
	it('renders the widget label in the title bar', () => {
		const { getByText } = render(FloatingPane, {
			props: {
				pane: makePane({ type: 'gauge' }),
				onClose: vi.fn(),
				onFocus: vi.fn(),
				onDock: vi.fn(),
				onConfigChange: vi.fn()
			}
		});
		expect(getByText('Gauge')).toBeTruthy();
	});

	it('renders correct label for table pane', () => {
		const { getByText } = render(FloatingPane, {
			props: {
				pane: makePane({ type: 'table' }),
				onClose: vi.fn(),
				onFocus: vi.fn(),
				onDock: vi.fn(),
				onConfigChange: vi.fn()
			}
		});
		expect(getByText('Table')).toBeTruthy();
	});

	it('fires onClose with pane id when close button is clicked', () => {
		const onClose = vi.fn();
		const { getByTitle } = render(FloatingPane, {
			props: {
				pane: makePane({ id: 'pane-abc' }),
				onClose,
				onFocus: vi.fn(),
				onDock: vi.fn(),
				onConfigChange: vi.fn()
			}
		});
		fireEvent.click(getByTitle('Close'));
		expect(onClose).toHaveBeenCalledWith('pane-abc');
	});

	it('fires onDock with pane id when dock button is clicked', () => {
		const onDock = vi.fn();
		const { getByTitle } = render(FloatingPane, {
			props: {
				pane: makePane({ id: 'pane-xyz' }),
				onClose: vi.fn(),
				onFocus: vi.fn(),
				onDock,
				onConfigChange: vi.fn()
			}
		});
		fireEvent.click(getByTitle('Dock into tiled layout'));
		expect(onDock).toHaveBeenCalledWith('pane-xyz');
	});

	it('fires onFocus with pane id on mousedown', () => {
		const onFocus = vi.fn();
		const { getByRole } = render(FloatingPane, {
			props: {
				pane: makePane({ id: 'pane-focus' }),
				onClose: vi.fn(),
				onFocus,
				onDock: vi.fn(),
				onConfigChange: vi.fn()
			}
		});
		const dialog = getByRole('dialog');
		fireEvent.mouseDown(dialog);
		expect(onFocus).toHaveBeenCalledWith('pane-focus');
	});

	it('applies the correct aria-label for the widget type', () => {
		const { getByRole } = render(FloatingPane, {
			props: {
				pane: makePane({ type: 'map' }),
				onClose: vi.fn(),
				onFocus: vi.fn(),
				onDock: vi.fn(),
				onConfigChange: vi.fn()
			}
		});
		expect(getByRole('dialog')).toHaveAttribute('aria-label', 'Map');
	});
});
