import { describe, it, expect } from 'vitest';
import { parseBinaryBuffer, parseDataLine, GPS_SCALE, ECU_SCALE } from '$lib/dataParser';
import { BIN_FIELD_COUNT, WR_FIELD_COUNT } from '$lib/types';

describe('dataParser', () => {
	describe('parseDataLine', () => {
		it('correctly parses legacy .bin format (48 fields)', () => {
			const row = Array(BIN_FIELD_COUNT).fill(0);
			row[0] = 1000; // write_millis
			row[8] = 5000; // rpm
			row[12] = 46.7 * GPS_SCALE; // lat
			row[17] = 14.7 * ECU_SCALE; // afr
			row[30] = 800 * ECU_SCALE; // egt

			const line = parseDataLine(row, 'bin');

			expect(line.write_millis).toBe(1000);
			expect(line.rpm).toBe(5000);
			expect(line.lat).toBeCloseTo(46.7);
			expect(line.afr).toBeCloseTo(14.7);
			expect(line.egt).toBeCloseTo(800);
			// New fields should be 0 or default
			expect(line.breakout_millis).toBe(0);
			expect(line.steering).toBe(0);
		});

		it('correctly parses new .wr format (53 fields) using the new struct order', () => {
			const row = Array(WR_FIELD_COUNT).fill(0);
			row[0] = 1000; // write_millis
			row[2] = 500; // breakout_millis
			row[6] = 2000; // analog_millis (maps to x1, x2, x3)
			row[8] = 5000; // rpm
			row[17] = 14.7 * ECU_SCALE; // afr
			row[42] = 200 * ECU_SCALE; // oil_temp
			row[48] = 45; // steering

			const line = parseDataLine(row, 'wr');

			expect(line.write_millis).toBe(1000);
			expect(line.breakout_millis).toBe(500);
			expect(line.analogx1_millis).toBe(2000);
			expect(line.analogx2_millis).toBe(2000);
			expect(line.analogx3_millis).toBe(2000);
			expect(line.rpm).toBe(5000);
			expect(line.afr).toBeCloseTo(14.7);
			expect(line.oil_temp).toBeCloseTo(200);
			expect(line.steering).toBe(45);
			// EGT is not in new struct, should be 0
			expect(line.egt).toBe(0);
		});
	});

	describe('parseBinaryBuffer', () => {
		it('parses multiple rows for .bin', () => {
			const buffer = new ArrayBuffer(BIN_FIELD_COUNT * 4 * 2);
			const view = new DataView(buffer);
			view.setInt32(0, 100, true); // row 1 write_millis
			view.setInt32(BIN_FIELD_COUNT * 4, 200, true); // row 2 write_millis

			const lines = parseBinaryBuffer(buffer, 'bin');
			expect(lines).toHaveLength(2);
			expect(lines[0].write_millis).toBe(100);
			expect(lines[1].write_millis).toBe(200);
		});

		it('parses multiple rows for .wr', () => {
			const buffer = new ArrayBuffer(WR_FIELD_COUNT * 4 * 2);
			const view = new DataView(buffer);
			view.setInt32(0, 300, true); // row 1 write_millis
			view.setInt32(WR_FIELD_COUNT * 4, 400, true); // row 2 write_millis

			const lines = parseBinaryBuffer(buffer, 'wr');
			expect(lines).toHaveLength(2);
			expect(lines[0].write_millis).toBe(300);
			expect(lines[1].write_millis).toBe(400);
		});
	});
});
