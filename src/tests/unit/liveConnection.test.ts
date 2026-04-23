import { describe, expect, it } from 'vitest';
import { consumeLiveSerialBytes, LIVE_FRAME_DELIMITER } from '$lib/liveConnection';
import { WR_FIELD_COUNT, type DataLine } from '$lib/types';

function makeRawRow(overrides: Partial<Record<number, number>> = {}): number[] {
	return Array.from({ length: WR_FIELD_COUNT }, (_, index) => overrides[index] ?? 0);
}

function encodeRow(row: number[]): Uint8Array {
	const bytes = new Uint8Array(WR_FIELD_COUNT * 4);
	const view = new DataView(bytes.buffer);

	for (let i = 0; i < WR_FIELD_COUNT; i++) {
		view.setInt32(i * 4, row[i], true);
	}

	return bytes;
}

function expectParsedLine(line: DataLine, expectedWriteMillis: number, expectedRpm: number) {
	expect(line.write_millis).toBe(expectedWriteMillis);
	expect(line.rpm).toBe(expectedRpm);
}

describe('consumeLiveSerialBytes', () => {
	it('keeps partial frame bytes buffered until a delimiter arrives', () => {
		const row = makeRawRow({ 0: 123, 8: 4500 });
		const frame = encodeRow(row);
		const partial = frame.slice(0, 40);

		const result = consumeLiveSerialBytes([], partial);

		expect(result.lines).toEqual([]);
		expect(result.remainder).toHaveLength(40);
	});

	it('parses a completed delimited frame into a DataLine', () => {
		const row = makeRawRow({ 0: 123, 8: 4500, 15: 1_700_000_000 });
		const payload = new Uint8Array([...encodeRow(row), ...LIVE_FRAME_DELIMITER]);

		const result = consumeLiveSerialBytes([], payload);

		expect(result.lines).toHaveLength(1);
		expectParsedLine(result.lines[0], 123, 4500);
		expect(result.remainder).toEqual([]);
	});

	it('uses the last full row before the delimiter when extra bytes precede it', () => {
		const junk = [99, 98, 97, 96];
		const row = makeRawRow({ 0: 456, 8: 6200, 15: 1_700_000_000 });
		const payload = new Uint8Array([...junk, ...encodeRow(row), ...LIVE_FRAME_DELIMITER]);

		const result = consumeLiveSerialBytes([], payload);

		expect(result.lines).toHaveLength(1);
		expectParsedLine(result.lines[0], 456, 6200);
	});
});
