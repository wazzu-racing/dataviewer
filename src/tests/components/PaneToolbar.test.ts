import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import PaneToolbar from '$lib/components/PaneToolbar.svelte';

describe('PaneToolbar', () => {
	it('renders 6 draggable widget buttons', () => {
		const { getAllByRole } = render(PaneToolbar);
		const buttons = getAllByRole('button');
		expect(buttons).toHaveLength(6);
	});

	it('renders buttons with expected labels', () => {
		const { getByTitle } = render(PaneToolbar);
		expect(getByTitle('Graph')).toBeTruthy();
		expect(getByTitle('Map')).toBeTruthy();
		expect(getByTitle('Table')).toBeTruthy();
		expect(getByTitle('Gauge')).toBeTruthy();
		expect(getByTitle('Load Data')).toBeTruthy();
	});

	it('all buttons have draggable="true"', () => {
		const { getAllByRole } = render(PaneToolbar);
		const buttons = getAllByRole('button');
		for (const button of buttons) {
			expect(button).toHaveAttribute('draggable', 'true');
		}
	});

	it('sets application/pane-type data on dragstart for Graph', () => {
		const { getByTitle } = render(PaneToolbar);
		const graphBtn = getByTitle('Graph');

		const setData = vi.fn();
		const dt = {
			setData,
			effectAllowed: ''
		} as unknown as DataTransfer;
		const dragEvent = new Event('dragstart', { bubbles: true }) as DragEvent;
		Object.defineProperty(dragEvent, 'dataTransfer', { value: dt });

		fireEvent(graphBtn, dragEvent);

		expect(setData).toHaveBeenCalledWith('application/pane-type', 'graph');
	});

	it('sets application/pane-type data on dragstart for Map', () => {
		const { getByTitle } = render(PaneToolbar);
		const mapBtn = getByTitle('Map');

		const setData = vi.fn();
		const dt = { setData, effectAllowed: '' } as unknown as DataTransfer;
		const dragEvent = new Event('dragstart', { bubbles: true }) as DragEvent;
		Object.defineProperty(dragEvent, 'dataTransfer', { value: dt });

		fireEvent(mapBtn, dragEvent);

		expect(setData).toHaveBeenCalledWith('application/pane-type', 'map');
	});

	it('sets application/pane-type data on dragstart for Table', () => {
		const { getByTitle } = render(PaneToolbar);
		const btn = getByTitle('Table');

		const setData = vi.fn();
		const dt = { setData, effectAllowed: '' } as unknown as DataTransfer;
		const dragEvent = new Event('dragstart', { bubbles: true }) as DragEvent;
		Object.defineProperty(dragEvent, 'dataTransfer', { value: dt });

		fireEvent(btn, dragEvent);
		expect(setData).toHaveBeenCalledWith('application/pane-type', 'table');
	});

	it('sets application/pane-type data on dragstart for Gauge', () => {
		const { getByTitle } = render(PaneToolbar);
		const btn = getByTitle('Gauge');

		const setData = vi.fn();
		const dt = { setData, effectAllowed: '' } as unknown as DataTransfer;
		const dragEvent = new Event('dragstart', { bubbles: true }) as DragEvent;
		Object.defineProperty(dragEvent, 'dataTransfer', { value: dt });

		fireEvent(btn, dragEvent);
		expect(setData).toHaveBeenCalledWith('application/pane-type', 'gauge');
	});

	it('sets application/pane-type data on dragstart for Load Data', () => {
		const { getByTitle } = render(PaneToolbar);
		const btn = getByTitle('Load Data');

		const setData = vi.fn();
		const dt = { setData, effectAllowed: '' } as unknown as DataTransfer;
		const dragEvent = new Event('dragstart', { bubbles: true }) as DragEvent;
		Object.defineProperty(dragEvent, 'dataTransfer', { value: dt });

		fireEvent(btn, dragEvent);
		expect(setData).toHaveBeenCalledWith('application/pane-type', 'load-data');
	});
});
