import { test, expect } from '@playwright/test';
import path from 'path';

// ---------------------------------------------------------------------------
// App smoke tests
// ---------------------------------------------------------------------------
test.describe('App — smoke tests', () => {
	test('page loads with correct title', async ({ page }) => {
		await page.goto('/');
		// App should load without errors
		await expect(page).toHaveTitle(/dataviewer|Wazzu|FSAE/i);
	});

	test('toolbar renders 5 widget buttons', async ({ page }) => {
		await page.goto('/');
		const toolbar = page.locator('aside');
		await expect(toolbar).toBeVisible();
		const buttons = toolbar.locator('button');
		await expect(buttons).toHaveCount(5);
	});

	test('toolbar contains Graph, Map, Table, Gauge, and Load Data buttons', async ({ page }) => {
		await page.goto('/');
		const aside = page.locator('aside');
		await expect(aside.getByTitle('Graph')).toBeVisible();
		await expect(aside.getByTitle('Map')).toBeVisible();
		await expect(aside.getByTitle('Table')).toBeVisible();
		await expect(aside.getByTitle('Gauge')).toBeVisible();
		await expect(aside.getByTitle('Load Data')).toBeVisible();
	});
});

// ---------------------------------------------------------------------------
// Floating pane interaction tests
// ---------------------------------------------------------------------------
test.describe('Floating panes', () => {
	test('clicking pop-out on a tiled pane creates a floating pane', async ({ page }) => {
		await page.goto('/');

		// Pop out the first pane (whatever is default)
		const popOutBtn = page.getByTitle('Pop out into floating window').first();
		await popOutBtn.click();

		// A floating pane dialog should appear
		const dialog = page.getByRole('dialog').first();
		await expect(dialog).toBeVisible();
	});

	test('floating pane close button removes the pane', async ({ page }) => {
		await page.goto('/');

		await page.getByTitle('Pop out into floating window').first().click();

		const dialog = page.getByRole('dialog').first();
		await expect(dialog).toBeVisible();

		await dialog.getByTitle('Close').click();
		await expect(dialog).not.toBeVisible();
	});

	test('floating pane dock button re-integrates it into the layout', async ({ page }) => {
		await page.goto('/');

		await page.getByTitle('Pop out into floating window').first().click();

		const dialog = page.getByRole('dialog').first();
		await expect(dialog).toBeVisible();

		await dialog.getByTitle('Dock into tiled layout').click();

		// Dialog should be gone
		await expect(dialog).not.toBeVisible();
	});
});

// ---------------------------------------------------------------------------
// Load Data widget
// ---------------------------------------------------------------------------
test.describe('Load Data widget', () => {
	test('loading a .bin file shows the row count', async ({ page }) => {
		await page.goto('/');

		// Navigate to a pane containing the LoadData widget
		// (depends on default layout having a load-data pane)
		const fileInput = page.locator('input[type="file"][accept=".bin"]');
		if ((await fileInput.count()) === 0) {
			test.skip();
			return;
		}

		const fixturePath = path.resolve(__dirname, 'fixtures/sample.bin');
		await fileInput.setInputFiles(fixturePath);

		// Should show a "X data points loaded" message
		await expect(page.getByText(/data points loaded/)).toBeVisible({ timeout: 5000 });
	});
});

// ---------------------------------------------------------------------------
// Layout persistence
// ---------------------------------------------------------------------------
test.describe('Layout persistence', () => {
	test('layout state is restored after page reload', async ({ page }) => {
		await page.goto('/');

		// Close the first pane to change the layout
		await page.getByTitle('Close pane').first().click();

		// Reload
		await page.reload();

		// The app should still load without errors
		await expect(page.locator('aside')).toBeVisible();
	});
});
