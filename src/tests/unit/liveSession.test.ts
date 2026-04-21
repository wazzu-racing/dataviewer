import { beforeEach, describe, expect, it } from 'vitest';
import { data as globalData } from '$lib/data.svelte';
import { dataStore, getStoreSnapshot } from '$lib/stores/dataStore';
import { selectedIndex } from '$lib/stores/time';
import { appendLiveTelemetry, replaceSession, startLiveSession } from '$lib/liveSession';
import type { DataLine, SessionMetadata } from '$lib/types';

function makeDataLine(overrides: Partial<DataLine> = {}): DataLine {
	return {
		write_millis: 0,
		ecu_millis: 0,
		gps_millis: 0,
		imu_millis: 0,
		accel_millis: 0,
		analogx1_millis: 0,
		analogx2_millis: 0,
		analogx3_millis: 0,
		rpm: 4000,
		time: 1,
		syncloss_count: 0,
		syncloss_code: 0,
		lat: 0,
		lon: 0,
		elev: 0,
		unixtime: new Date(0),
		ground_speed: 0,
		afr: 14.7,
		fuelload: 0,
		spark_advance: 0,
		baro: 0,
		map: 0,
		mat: 0,
		clnt_temp: 0,
		tps: 50,
		batt: 12.5,
		oil_press: 0,
		ltcl_timing: 0,
		ve1: 0,
		ve2: 0,
		egt: 0,
		maf: 0,
		in_temp: 0,
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
		rad_in: 0,
		rad_out: 0,
		amb_air_temp: 0,
		brake1: 0,
		brake2: 0,
		...overrides
	};
}

function makeMetadata(overrides: Partial<SessionMetadata> = {}): SessionMetadata {
	return {
		version: '1.0',
		name: 'Test Session',
		driver: '',
		location: '',
		datetime: '2026-04-09T00:00:00.000Z',
		conditions: '',
		...overrides,
		files: {
			telemetry: overrides.files?.telemetry ?? 'data.csv'
		}
	};
}

describe('liveSession', () => {
	beforeEach(() => {
		globalData.lines = [];
		globalData.metadata = makeMetadata({ name: 'Reset Session' });
		dataStore.set({ telemetry: [], widgets: [] });
		selectedIndex.set(0);
	});

	it('starts a new blank live session with default metadata', () => {
		const metadata = startLiveSession();

		expect(metadata.name).toBe('Live Session');
		expect(globalData.metadata.name).toBe('Live Session');
		expect(globalData.lines).toEqual([]);
		expect(getStoreSnapshot().telemetry).toEqual([]);
		expect(getStoreSnapshot().widgets).toEqual([]);
	});

	it('replaces the current session and moves the selected index to the latest row', () => {
		const telemetry = [makeDataLine({ time: 1 }), makeDataLine({ time: 2, rpm: 4500 })];
		replaceSession(telemetry, makeMetadata({ name: 'Imported Session' }));

		expect(globalData.metadata.name).toBe('Imported Session');
		expect(globalData.lines).toEqual(telemetry);
		expect(getStoreSnapshot().telemetry).toEqual(telemetry);

		let currentIndex = -1;
		selectedIndex.subscribe((value) => {
			currentIndex = value;
		})();
		expect(currentIndex).toBe(1);
	});

	it('appends live telemetry and follows the newest sample', () => {
		startLiveSession();
		appendLiveTelemetry(makeDataLine({ time: 1, rpm: 3000 }));
		appendLiveTelemetry([
			makeDataLine({ time: 2, rpm: 3500 }),
			makeDataLine({ time: 3, rpm: 4200 })
		]);

		expect(globalData.lines).toHaveLength(3);
		expect(getStoreSnapshot().telemetry).toHaveLength(3);
		expect(getStoreSnapshot().telemetry[2].rpm).toBe(4200);

		let currentIndex = -1;
		selectedIndex.subscribe((value) => {
			currentIndex = value;
		})();
		expect(currentIndex).toBe(2);
	});
});
