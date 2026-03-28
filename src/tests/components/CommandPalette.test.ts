import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import CommandPalette from '$lib/components/CommandPalette.svelte';
import type { Command } from '$lib/types';

// Svelte's fade/fly transitions rely on Element.animate() (Web Animations API)
// which is not available in jsdom.  Return a zero-duration CSS transition so
// Svelte can resolve the animation synchronously without errors.
vi.mock('svelte/transition', () => ({
	fade: () => ({ delay: 0, duration: 0, css: () => '' }),
	fly: () => ({ delay: 0, duration: 0, css: () => '' })
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCommands(): Command[] {
	const actionA = vi.fn();
	const actionB = vi.fn();
	const actionDark = vi.fn();
	const actionLight = vi.fn();

	return [
		{
			id: 'open',
			label: 'Open Window',
			description: 'Open a new window',
			action: actionA
		},
		{
			id: 'save',
			label: 'Save Layout',
			shortcut: 'Ctrl+S',
			action: actionB
		},
		{
			id: 'themes',
			label: 'Change Theme',
			children: [
				{ id: 'theme-dark', label: 'Dark', action: actionDark },
				{ id: 'theme-light', label: 'Light', action: actionLight }
			]
		}
	];
}

function renderOpen(commands: Command[], onClose = vi.fn()) {
	return render(CommandPalette, { props: { isOpen: true, commands, onClose } });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CommandPalette', () => {
	it('renders nothing when closed', () => {
		const { queryByRole } = render(CommandPalette, {
			props: { isOpen: false, commands: makeCommands(), onClose: vi.fn() }
		});
		expect(queryByRole('textbox')).toBeNull();
	});

	it('renders search input and all commands when open', () => {
		const { getByRole, getByText } = renderOpen(makeCommands());
		expect(getByRole('textbox')).toBeTruthy();
		expect(getByText('Open Window')).toBeTruthy();
		expect(getByText('Save Layout')).toBeTruthy();
		expect(getByText('Change Theme')).toBeTruthy();
	});

	// -------------------------------------------------------------------------
	// Filtering
	// -------------------------------------------------------------------------

	it('shows only matching commands when a query is entered', async () => {
		const { getByRole, getByText, queryByText } = renderOpen(makeCommands());

		const input = getByRole('textbox');
		await fireEvent.input(input, { target: { value: 'save' } });

		expect(getByText('Save Layout')).toBeTruthy();
		expect(queryByText('Open Window')).toBeNull();
		expect(queryByText('Change Theme')).toBeNull();
	});

	it('matches on description text', async () => {
		const { getByRole, getByText, queryByText } = renderOpen(makeCommands());

		const input = getByRole('textbox');
		await fireEvent.input(input, { target: { value: 'new window' } });

		expect(getByText('Open Window')).toBeTruthy();
		expect(queryByText('Save Layout')).toBeNull();
	});

	it('shows "No results" message when nothing matches', async () => {
		const { getByRole, getByText } = renderOpen(makeCommands());

		const input = getByRole('textbox');
		await fireEvent.input(input, { target: { value: 'zzznomatch' } });

		expect(getByText(/No results found/i)).toBeTruthy();
	});

	// -------------------------------------------------------------------------
	// Enter — execute / navigate
	// -------------------------------------------------------------------------

	it('executes action and calls onClose when Enter is pressed on the selected command', async () => {
		const commands = makeCommands();
		const onClose = vi.fn();
		renderOpen(commands, onClose);

		// Index 0 is selected by default
		await fireEvent.keyDown(window, { key: 'Enter' });

		expect((commands[0] as { action: ReturnType<typeof vi.fn> }).action).toHaveBeenCalledOnce();
		expect(onClose).toHaveBeenCalledOnce();
	});

	it('navigates into a submenu when Enter is pressed on a group command', async () => {
		const commands = makeCommands();
		const onClose = vi.fn();
		const { getByText, queryByText } = renderOpen(commands, onClose);

		// Move selection down twice to reach "Change Theme" (index 2)
		await fireEvent.keyDown(window, { key: 'ArrowDown' });
		await fireEvent.keyDown(window, { key: 'ArrowDown' });
		await fireEvent.keyDown(window, { key: 'Enter' });

		// Should now show the submenu items
		expect(getByText('Dark')).toBeTruthy();
		expect(getByText('Light')).toBeTruthy();
		// Root items should no longer be visible
		expect(queryByText('Open Window')).toBeNull();
		// onClose must NOT have been called
		expect(onClose).not.toHaveBeenCalled();
	});

	// -------------------------------------------------------------------------
	// Escape / Backspace navigation
	// -------------------------------------------------------------------------

	it('calls onClose when Escape is pressed at the root level', async () => {
		const onClose = vi.fn();
		renderOpen(makeCommands(), onClose);

		await fireEvent.keyDown(window, { key: 'Escape' });

		expect(onClose).toHaveBeenCalledOnce();
	});

	it('goes back to the parent menu on Escape when inside a submenu', async () => {
		const commands = makeCommands();
		const onClose = vi.fn();
		const { getByText, queryByText } = renderOpen(commands, onClose);

		// Enter the submenu
		await fireEvent.keyDown(window, { key: 'ArrowDown' });
		await fireEvent.keyDown(window, { key: 'ArrowDown' });
		await fireEvent.keyDown(window, { key: 'Enter' });
		expect(getByText('Dark')).toBeTruthy();

		// Escape should navigate back, not close
		await fireEvent.keyDown(window, { key: 'Escape' });

		expect(onClose).not.toHaveBeenCalled();
		expect(queryByText('Dark')).toBeNull();
		expect(getByText('Open Window')).toBeTruthy();
	});

	it('goes back on Backspace when the query is empty and inside a submenu', async () => {
		const commands = makeCommands();
		const onClose = vi.fn();
		const { getByRole, getByText, queryByText } = renderOpen(commands, onClose);

		// Enter the submenu
		await fireEvent.keyDown(window, { key: 'ArrowDown' });
		await fireEvent.keyDown(window, { key: 'ArrowDown' });
		await fireEvent.keyDown(window, { key: 'Enter' });
		expect(getByText('Dark')).toBeTruthy();

		// Entering a submenu clears the query — verify it is empty before Backspace
		const input = getByRole('textbox');
		expect(input).toHaveValue('');

		// Backspace with an empty query should go back
		await fireEvent.keyDown(window, { key: 'Backspace' });

		expect(queryByText('Dark')).toBeNull();
		expect(getByText('Open Window')).toBeTruthy();
	});

	// -------------------------------------------------------------------------
	// Arrow-key selection
	// -------------------------------------------------------------------------

	it('moves selection down with ArrowDown and executes the new selection on Enter', async () => {
		const commands = makeCommands();
		const onClose = vi.fn();
		renderOpen(commands, onClose);

		// Move to index 1 (Save Layout) and press Enter
		await fireEvent.keyDown(window, { key: 'ArrowDown' });
		await fireEvent.keyDown(window, { key: 'Enter' });

		expect((commands[1] as { action: ReturnType<typeof vi.fn> }).action).toHaveBeenCalledOnce();
	});

	it('wraps selection from last item back to first with ArrowDown', async () => {
		const commands = makeCommands();
		const onClose = vi.fn();
		renderOpen(commands, onClose);

		// 3 items: 0 → 1 → 2 → wraps to 0
		await fireEvent.keyDown(window, { key: 'ArrowDown' });
		await fireEvent.keyDown(window, { key: 'ArrowDown' });
		await fireEvent.keyDown(window, { key: 'ArrowDown' });
		await fireEvent.keyDown(window, { key: 'Enter' });

		// Back at index 0 (Open Window)
		expect((commands[0] as { action: ReturnType<typeof vi.fn> }).action).toHaveBeenCalledOnce();
	});

	it('wraps selection from first item to last with ArrowUp', async () => {
		const commands = makeCommands();
		const onClose = vi.fn();
		renderOpen(commands, onClose);

		// ArrowUp from index 0 should wrap to index 2 (Change Theme group)
		await fireEvent.keyDown(window, { key: 'ArrowUp' });
		await fireEvent.keyDown(window, { key: 'Enter' });

		// Change Theme is a group; no action called, submenu shown, palette stays open
		expect(onClose).not.toHaveBeenCalled();
	});

	// -------------------------------------------------------------------------
	// Click-outside / backdrop
	// -------------------------------------------------------------------------

	it('calls onClose when the backdrop is clicked', async () => {
		const onClose = vi.fn();
		const { getByRole } = renderOpen(makeCommands(), onClose);

		// The backdrop renders with role="button" and aria-label="Close command palette"
		const backdrop = getByRole('button', { name: /close command palette/i });
		await fireEvent.click(backdrop);

		expect(onClose).toHaveBeenCalledOnce();
	});

	it('calls onClose when Enter is pressed on the backdrop', async () => {
		const onClose = vi.fn();
		const { getByRole } = renderOpen(makeCommands(), onClose);

		const backdrop = getByRole('button', { name: /close command palette/i });
		await fireEvent.keyDown(backdrop, { key: 'Enter' });

		expect(onClose).toHaveBeenCalledOnce();
	});
});
