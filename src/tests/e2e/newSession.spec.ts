import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const APP_PATH = '/dataviewer/';
const SAMPLE_BIN_PATH = fileURLToPath(new URL('./fixtures/sample.bin', import.meta.url));
const SHARED_LAYOUT = Buffer.from(
	JSON.stringify({
		layout: { id: 'session-gauge', type: 'gauge', config: { field: 'rpm' } },
		floatingPanes: []
	})
).toString('base64');

async function runCommand(page: Page, label: string): Promise<void> {
	await page.getByRole('button', { name: 'Command Palette', exact: true }).click();
	const dialog = page.getByRole('dialog', { name: 'Command palette', exact: true });
	await dialog.getByRole('textbox').fill(label);
	const command = dialog.getByText(label, { exact: true });
	await expect(command).toBeVisible();
	await command.click();
	await expect(dialog).toBeHidden();
}

async function openSharedSession(page: Page): Promise<string> {
	await page.route('**/new-session-fixture.bin', (route) =>
		route.fulfill({ path: SAMPLE_BIN_PATH, contentType: 'application/octet-stream' })
	);
	const params = new URLSearchParams({
		data: `${APP_PATH}new-session-fixture.bin`,
		layout: SHARED_LAYOUT
	});
	await page.goto(`${APP_PATH}?${params}#session`);
	await expect(page.getByRole('img', { name: 'RPM (rpm) gauge', exact: true })).toBeVisible();
	await expect(page.getByRole('dialog', { name: 'Load Data', exact: true })).toBeHidden();
	return page.url();
}

test.describe('New Session', () => {
	test('reopens the file modal after loading a local file', async ({ page }) => {
		await page.goto(APP_PATH);
		await expect(page.locator('body')).toHaveClass(/modal-open/);
		const loadDialog = page.getByRole('dialog', { name: 'Load Data', exact: true });
		await loadDialog.locator('input[type="file"]').setInputFiles(SAMPLE_BIN_PATH);
		await expect(loadDialog.getByText('2 data points loaded', { exact: true })).toBeVisible();
		await loadDialog.getByRole('button', { name: 'Done', exact: true }).click();
		await expect(loadDialog).toBeHidden();

		await runCommand(page, 'New Session');

		await expect(loadDialog).toBeVisible();
		await expect(loadDialog.locator('input[type="file"]')).toBeVisible();
		await expect(page.locator('body')).toHaveClass(/modal-open/);
	});

	test('clears the shared URL in place and preserves the current layout', async ({ page }) => {
		const sharedUrl = new URL(await openSharedSession(page));
		await page.getByRole('combobox').selectOption('tps');
		const historyLength = await page.evaluate(() => window.history.length);
		let documentRequests = 0;
		page.on('request', (request) => {
			if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
				documentRequests += 1;
			}
		});

		await runCommand(page, 'New Session');

		sharedUrl.search = '';
		sharedUrl.hash = '';
		await expect(page).toHaveURL(sharedUrl.toString());
		await expect(page.getByRole('dialog', { name: 'Load Data', exact: true })).toBeVisible();
		await expect(page.getByRole('combobox')).toHaveValue('tps');
		expect(await page.evaluate(() => window.history.length)).toBe(historyLength);
		expect(documentRequests).toBe(0);
	});

	test('loads a replacement file instead of appending to the previous telemetry', async ({
		page
	}) => {
		await openSharedSession(page);
		await runCommand(page, 'New Session');

		const fixture = await readFile(SAMPLE_BIN_PATH);
		// Keep only the first of the fixture's two telemetry rows.
		const replacement = fixture.subarray(0, fixture.length / 2);
		const loadDialog = page.getByRole('dialog', { name: 'Load Data', exact: true });
		await loadDialog.locator('input[type="file"]').setInputFiles({
			name: 'replacement.bin',
			mimeType: 'application/octet-stream',
			buffer: replacement
		});
		await expect(loadDialog.getByText('1 data points loaded', { exact: true })).toBeVisible();
		await loadDialog.getByRole('button', { name: 'Done', exact: true }).click();
		await expect(loadDialog).toBeHidden();

		const downloadPromise = page.waitForEvent('download');
		await runCommand(page, 'Download CSV');
		const download = await downloadPromise;
		const csv = await readFile(await download.path(), 'utf8');
		const rows = csv.trimEnd().split(/\r?\n/);
		const headers = rows[0].split(',');
		const values = rows[1].split(',');
		expect(rows).toHaveLength(2);
		expect(values[headers.indexOf('write_millis')]).toBe('1000');
		expect(values[headers.indexOf('rpm')]).toBe('3000');
	});

	test('existing Load Data command still opens the modal without clearing the URL', async ({
		page
	}) => {
		const sharedUrl = await openSharedSession(page);

		await runCommand(page, 'Load Data');

		await expect(page.getByRole('dialog', { name: 'Load Data', exact: true })).toBeVisible();
		await expect(page).toHaveURL(sharedUrl);
	});
});
