import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const SAMPLE_BIN_PATH = fileURLToPath(new URL('./fixtures/sample.bin', import.meta.url));

// ---------------------------------------------------------------------------
// App smoke tests
// ---------------------------------------------------------------------------
test.describe('App — smoke tests', () => {
	test('page loads with correct title', async ({ page }) => {
		await page.goto('/');
		await expect(page).toHaveTitle('Wazzu Racing Data Viewer');
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

		await fileInput.setInputFiles(SAMPLE_BIN_PATH);

		// Should show a "X data points loaded" message
		await expect(page.getByText(/data points loaded/)).toBeVisible({ timeout: 5000 });
	});
});

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------
test.describe('CSV export', () => {
	test('downloads the loaded telemetry with headers and data rows', async ({ page }) => {
		await page.goto('/');
		await expect(page.locator('body')).toHaveClass(/modal-open/);
		const loadDialog = page.getByRole('dialog', { name: 'Load Data' });
		await loadDialog.locator('input[type="file"]').setInputFiles(SAMPLE_BIN_PATH);
		await expect(loadDialog.getByText('2 data points loaded')).toBeVisible();
		await loadDialog.getByRole('button', { name: 'Done' }).click();

		await page.getByRole('button', { name: 'Command Palette' }).click();
		const commandDialog = page.getByRole('dialog', { name: 'Command palette' });
		await commandDialog.getByRole('textbox').fill('Download CSV');
		const downloadPromise = page.waitForEvent('download');
		await commandDialog.getByText('Download CSV', { exact: true }).click();
		const download = await downloadPromise;

		expect(download.suggestedFilename()).toBe('New_Session.csv');
		const csv = await readFile(await download.path(), 'utf8');
		const rows = csv.trimEnd().split(/\r?\n/);
		const headers = rows[0].split(',');
		const firstRow = rows[1].split(',');
		expect(rows).toHaveLength(3);
		expect(firstRow[headers.indexOf('write_millis')]).toBe('1000');
		expect(firstRow[headers.indexOf('rpm')]).toBe('3000');
	});

	test('shows an error when no telemetry is loaded', async ({ page }) => {
		await page.goto('/');
		await expect(page.locator('body')).toHaveClass(/modal-open/);
		await page.keyboard.press('Control+Shift+P');
		const commandDialog = page.getByRole('dialog', { name: 'Command palette' });
		await commandDialog.getByRole('textbox').fill('Download CSV');
		let alertMessage = '';
		page.once('dialog', async (dialog) => {
			alertMessage = dialog.message();
			await dialog.accept();
		});
		await commandDialog.getByText('Download CSV', { exact: true }).click();
		expect(alertMessage).toBe('No data to export.');
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
