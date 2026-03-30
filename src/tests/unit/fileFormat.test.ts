import { describe, it, expect } from 'vitest';
import { loadWazzuFile, saveWazzuFile, convertBinToWazzu } from '../../lib/fileFormat';
import type { DataLine, SessionMetadata } from '../../lib/types';

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
			brake2: 100
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
});
