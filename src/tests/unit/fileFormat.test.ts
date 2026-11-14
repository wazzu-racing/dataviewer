import { describe, it, expect } from 'vitest';
import Papa from 'papaparse';
import {
	loadWazzuFile,
	saveWazzuFile,
	convertBinToWazzu,
	parseCsvBuffer
} from '../../lib/fileFormat';
import { NUMERIC_FIELDS, type DataLine, type SessionMetadata } from '../../lib/types';

describe('fileFormat', () => {
	/** @vitest-environment node */
	const mockTelemetry: DataLine[] = [
		{
			write_millis: 100,
			ecu_millis: 101,
			gps_millis: 102,
			imu_millis: 103,
			accel_millis: 104,
			analogx1_millis: 105,
			analogx2_millis: 106,
			analogx3_millis: 107,
			rpm: 5000,
			time: 10,
			syncloss_count: 0,
			syncloss_code: 0,
			lat: 46.7,
			lon: -117.1,
			elev: 750,
			unixtime: new Date('2026-03-28T10:00:00Z'),
			ground_speed: 60,
			afr: 14.7,
			fuelload: 50,
			spark_advance: 20,
			baro: 101.3,
			map: 100,
			mat: 30,
			clnt_temp: 90,
			tps: 80,
			batt: 13.8,
			oil_press: 50,
			ltcl_timing: 0,
			ve1: 60,
			ve2: 0,
			egt: 800,
			maf: 150,
			in_temp: 25,
			ax: 0,
			ay: 0,
			az: 0,
			imu_x: 0,
			imu_y: 0,
			imu_z: 0,
			susp_pot_1_FL: 0,
			susp_pot_2_FR: 0,
			susp_pot_3_RR: 0,
			susp_pot_4_RL: 0,
			rad_in: 80,
			rad_out: 70,
			amb_air_temp: 20,
			brake1: 100,
			brake2: 100,
			breakout_millis: 0,
			thermo_millis: 0,
			thermo_1: 0,
			thermo_2: 0,
			thermo_3: 0,
			thermo_4: 0,
			steering: 0,
			oil_temp: 0
		}
	];

	const mockMetadata: SessionMetadata = {
		version: '1.0',
		name: 'Test Session',
		driver: 'Test Driver',
		location: 'Test Location',
		datetime: '2026-03-28T10:00:00Z',
		files: {
			telemetry: 'data.csv'
		}
	};

	it('should save and load .wazzuracing files', async () => {
		const blob = await saveWazzuFile(mockTelemetry, mockMetadata);
		const buffer = await blob.arrayBuffer();

		const { telemetry, metadata } = await loadWazzuFile(buffer);

		expect(metadata).toEqual(mockMetadata);
		expect(telemetry.length).toBe(1);
		expect(telemetry[0].rpm).toBe(5000);
		expect(telemetry[0].unixtime.toISOString()).toBe(mockTelemetry[0].unixtime.toISOString());
	});

	it('should convert .bin to .wazzuracing', async () => {
		// Create a mock .bin buffer (48 * 4 bytes)
		const buffer = new ArrayBuffer(48 * 4);
		const view = new DataView(buffer);
		for (let i = 0; i < 48; i++) {
			view.setInt32(i * 4, i * 10, true);
		}

		const blob = await convertBinToWazzu(buffer, 'Converted Session', 'Driver', 'Loc');
		const resultBuffer = await blob.arrayBuffer();
		const { telemetry, metadata } = await loadWazzuFile(resultBuffer);

		expect(metadata.name).toBe('Converted Session');
		expect(metadata.driver).toBe('Driver');
		expect(telemetry.length).toBe(1);
	});

	describe('parseCsvBuffer', () => {
		const toBuffer = (csv: string) => new TextEncoder().encode(csv).buffer as ArrayBuffer;
		const noColumnsError = /no data cols that could be recognized/;

		it('imports every supported column', () => {
			const header = ['unixtime', ...NUMERIC_FIELDS].join(',');
			const row = ['1700000000', ...NUMERIC_FIELDS.map((_, i) => String(i + 1))].join(',');

			const [line] = parseCsvBuffer(toBuffer(`${header}\n${row}\n`));

			expect(line.unixtime.getTime()).toBe(1_700_000_000_000);
			NUMERIC_FIELDS.forEach((field, i) => expect(line[field]).toBe(i + 1));
		});

		it('drops unknown columns and sets missing fields to zero', () => {
			const telemetry = parseCsvBuffer(toBuffer('rpm,foo,tps\n5000,hello,12.5\n6000,world,50\n'));

			expect(telemetry).toHaveLength(2);
			expect([telemetry[0].rpm, telemetry[0].tps]).toEqual([5000, 12.5]);
			expect([telemetry[1].rpm, telemetry[1].tps]).toEqual([6000, 50]);
			expect('foo' in telemetry[0]).toBe(false);
			expect(telemetry[0].write_millis).toBe(0);
			expect(telemetry[0].unixtime.getTime()).toBe(0);
			for (const field of NUMERIC_FIELDS) {
				expect(typeof telemetry[0][field]).toBe('number');
			}
		});

		it('sets blank and non-numeric cells to zero', () => {
			const [line] = parseCsvBuffer(toBuffer('rpm,tps,afr\n1,abc,\n'));

			expect([line.rpm, line.tps, line.afr]).toEqual([1, 0, 0]);
		});

		it('trims header whitespace and skips blank rows', () => {
			const telemetry = parseCsvBuffer(toBuffer(' rpm , tps\r\n1,2\r\n,\r\n\r\n'));

			expect(telemetry).toHaveLength(1);
			expect([telemetry[0].rpm, telemetry[0].tps]).toEqual([1, 2]);
		});

		it.each([
			['epoch seconds', '1700000000'],
			['epoch milliseconds', '1700000000000'],
			['an ISO string', '2023-11-14T22:13:20.000Z']
		])('parses unixtime given as %s', (_format, cell) => {
			const [line] = parseCsvBuffer(toBuffer(`rpm,unixtime\n1,${cell}\n`));

			expect(line.unixtime.getTime()).toBe(1_700_000_000_000);
		});

		it('falls back to the epoch for an unparseable unixtime', () => {
			const [line] = parseCsvBuffer(toBuffer('rpm,unixtime\n1,not-a-date\n'));

			expect(line.unixtime.getTime()).toBe(0);
		});

		it('reads back the CSV that Download CSV exports', () => {
			expect(parseCsvBuffer(toBuffer(Papa.unparse(mockTelemetry)))).toEqual(mockTelemetry);
		});

		it('throws when no column is recognized or there are no data rows', () => {
			expect(() => parseCsvBuffer(toBuffer('foo,bar\n1,2\n'))).toThrow(noColumnsError);
			expect(() => parseCsvBuffer(toBuffer('rpm,tps\n'))).toThrow(noColumnsError);
			expect(() => parseCsvBuffer(toBuffer(''))).toThrow(noColumnsError);
		});
	});
});
