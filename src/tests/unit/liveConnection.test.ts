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

	it('parses a frame even when the stream is misaligned by 1-3 bytes', () => {
		const row = makeRawRow({ 0: 789, 8: 7100, 15: 1_700_000_000 });
		const frame = encodeRow(row);

		for (const padLength of [1, 2, 3]) {
			const pad = Array.from({ length: padLength }, (_, idx) => 250 - idx);
			const payload = new Uint8Array([...pad, ...frame, ...LIVE_FRAME_DELIMITER]);
			const result = consumeLiveSerialBytes([], payload);
			expect(result.lines).toHaveLength(1);
			expectParsedLine(result.lines[0], 789, 7100);
		}
	});

	it('accepts a delimiter run of four newlines', () => {
		const row = makeRawRow({ 0: 111, 8: 9000, 15: 1_700_000_000 });
		const delimiter4 = [...LIVE_FRAME_DELIMITER, 10];
		const payload = new Uint8Array([...encodeRow(row), ...delimiter4]);

		const result = consumeLiveSerialBytes([], payload);

		expect(result.lines).toHaveLength(1);
		expectParsedLine(result.lines[0], 111, 9000);
		expect(result.remainder).toEqual([]);
	});

	it('parses two back-to-back frames in a single buffer', () => {
		const row1 = makeRawRow({ 0: 200, 8: 5000, 15: 1_700_000_000 });
		const row2 = makeRawRow({ 0: 250, 8: 5200, 15: 1_700_000_001 });
		const payload = new Uint8Array([
			...encodeRow(row1),
			...LIVE_FRAME_DELIMITER,
			...encodeRow(row2),
			...LIVE_FRAME_DELIMITER
		]);

		const result = consumeLiveSerialBytes([], payload);

		expect(result.lines).toHaveLength(2);
		expectParsedLine(result.lines[0], 200, 5000);
		expectParsedLine(result.lines[1], 250, 5200);
		expect(result.remainder).toEqual([]);
	});
});
