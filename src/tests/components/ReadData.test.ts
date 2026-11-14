import { describe, it, expect, beforeEach } from 'vitest';
import { fireEvent, render } from '@testing-library/svelte';
import ReadData from '$lib/components/ReadData.svelte';
import { data as globalData } from '$lib/data.svelte';
import { replaceSession } from '$lib/liveSession';

const VALID_CSV = 'write_millis,rpm,foo\n0,1000,x\n100,2000,y\n200,3000,z\n';

function renderReadData() {
	const result = render(ReadData);
	const input = result.container.querySelector('input[type="file"]') as HTMLInputElement;
	return { ...result, input };
}

/**
 * Selects a file the way the browser does. jsdom can't build a real FileList, and
 * `bind:files` writes the value back to the input, so the property needs a setter.
 */
async function selectFile(input: HTMLInputElement, file: File) {
	const files = Object.assign([file], { item: (index: number) => (index === 0 ? file : null) });
	Object.defineProperty(input, 'files', {
		configurable: true,
		get: () => files,
		set: () => {}
	});
	await fireEvent.change(input);
}

function csvFile(contents: string, name = 'session.csv') {
	return new File([contents], name, { type: 'text/csv' });
}

describe('ReadData', () => {
	beforeEach(() => {
		replaceSession([]);
	});

	it('accepts .csv files in the file picker', () => {
		const { input } = renderReadData();

		expect(input.accept.split(',')).toContain('.csv');
	});

	it('loads a CSV file into the session', async () => {
		const { input, findByText } = renderReadData();

		await selectFile(input, csvFile(VALID_CSV));

		expect(await findByText('3 data points loaded')).toBeInTheDocument();
		expect(globalData.lines.map((line) => line.rpm)).toEqual([1000, 2000, 3000]);
		expect(globalData.lines.map((line) => line.write_millis)).toEqual([0, 100, 200]);
		expect(globalData.lines[0].tps).toBe(0);
	});

	it('shows an error and keeps the current session when no column is recognized', async () => {
		const { input, findByText } = renderReadData();
		await selectFile(input, csvFile(VALID_CSV));
		await findByText('3 data points loaded');

		await selectFile(input, csvFile('foo,bar\n1,2\n', 'unknown.csv'));

		expect(await findByText(/^Error parsing \.csv file:/)).toBeInTheDocument();
		expect(globalData.lines.map((line) => line.rpm)).toEqual([1000, 2000, 3000]);
	});
});
