import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import TopBar from '$lib/components/TopBar.svelte';

describe('TopBar', () => {
	it('renders only the centered command palette button', () => {
		const { getAllByRole, getByRole, queryByRole } = render(TopBar, {
			props: { onOpenCommands: vi.fn() }
		});

		expect(getAllByRole('button')).toHaveLength(1);
		expect(getByRole('button', { name: /command palette/i })).toBeTruthy();
		expect(queryByRole('button', { name: /new window/i })).toBeNull();
		expect(queryByRole('button', { name: /save layout/i })).toBeNull();
		expect(queryByRole('button', { name: /manage/i })).toBeNull();
	});

	it('shows the renamed label', () => {
		const { getByText, queryByText } = render(TopBar, {
			props: { onOpenCommands: vi.fn() }
		});

		expect(getByText('Command Palette')).toBeTruthy();
		expect(queryByText('Search')).toBeNull();
	});

	it('opens the command palette when clicked', async () => {
		const onOpenCommands = vi.fn();
		const { getByRole } = render(TopBar, {
			props: { onOpenCommands }
		});

		await fireEvent.click(getByRole('button', { name: /command palette/i }));

		expect(onOpenCommands).toHaveBeenCalledOnce();
	});
});
