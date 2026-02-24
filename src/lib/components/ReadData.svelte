<script lang="ts">
	import { type DataLine, NUM_FIELDS } from '$lib/types';
	import { data as globalData } from '$lib/data.svelte';

	// Scaling constants for binary fields
	const GPS_SCALE = 10_000_000;
	const SPEED_SCALE = 447.04; // raw units → mph
	const ECU_SCALE = 1_000; // millis → real units
	const SUSP_ADC_MAX = 5024; // ADC full-scale counts
	const SUSP_MM_PER_INCH = 25.4;
	const THERMO_ADC_MAX = 5024;
	const THERMO_V_MAX = 0.5232; // thermocouple voltage at 0 °F
	const THERMO_V_MIN = 0.0084; // thermocouple voltage at 302 °F
	const THERMO_T_MAX = 302; // °F
	const THERMO_T_MIN = -58; // °F
	const BRAKE_ADC_MAX = 5024;
	const BRAKE_PSI_MAX = 5000;
	const BRAKE_V_ZERO = 0.1; // normalised voltage at 0 psi
	const BRAKE_V_SPAN = 0.8; // normalised voltage span

	let files: FileList | undefined = $state();

	async function parse() {
		if (!files || files.length === 0) return;
		const f = files[0];
		const buffer = await f.arrayBuffer();
		const dataview = new DataView(buffer);

		const bytesPerRow = 4 * NUM_FIELDS;
		const numRows = Math.floor(buffer.byteLength / bytesPerRow);

		const rawRows: number[][] = [];

		for (let row_i = 0; row_i < numRows; row_i++) {
			const row: number[] = [];
			try {
				for (let i = 0; i < NUM_FIELDS; i++) {
					row.push(dataview.getInt32(row_i * bytesPerRow + 4 * i, true)); // little-endian
				}
			} catch {
				alert('Error: corrupted data at row ' + row_i);
				return;
			}
			rawRows.push(row);
		}

		const out: DataLine[] = rawRows.map((row) => ({
			write_millis: row[0],
			ecu_millis: row[1],
			gps_millis: row[2],
			imu_millis: row[3],
			accel_millis: row[4],
			analogx1_millis: row[5],
			analogx2_millis: row[6],
			analogx3_millis: row[7],
			rpm: row[8],
			time: row[9],
			syncloss_count: row[10],
			syncloss_code: row[11],
			lat: row[12] / GPS_SCALE,
			lon: row[13] / GPS_SCALE,
			elev: row[14],
			unixtime: new Date(row[15] * 1_000),
			ground_speed: row[16] / SPEED_SCALE,
			afr: row[17] / ECU_SCALE,
			fuelload: row[18] / ECU_SCALE,
			spark_advance: row[19] / ECU_SCALE,
			baro: row[20] / ECU_SCALE,
			map: row[21] / ECU_SCALE,
			mat: row[22] / ECU_SCALE,
			clnt_temp: row[23] / ECU_SCALE,
			tps: row[24] / ECU_SCALE,
			batt: row[25] / ECU_SCALE,
			oil_press: row[26] / ECU_SCALE,
			ltcl_timing: row[27] / ECU_SCALE,
			ve1: row[28] / ECU_SCALE,
			ve2: row[29] / ECU_SCALE,
			egt: row[30] / ECU_SCALE,
			maf: row[31] / ECU_SCALE,
			in_temp: row[32] / ECU_SCALE,
			ax: row[33] / ECU_SCALE,
			ay: row[34] / ECU_SCALE,
			az: row[35] / ECU_SCALE,
			imu_x: row[36] / ECU_SCALE,
			imu_y: row[37] / ECU_SCALE,
			imu_z: row[38] / ECU_SCALE,
			susp_pot_1_FL: ((row[39] / SUSP_ADC_MAX) * 100) / SUSP_MM_PER_INCH,
			susp_pot_2_FR: ((row[40] / SUSP_ADC_MAX) * 100) / SUSP_MM_PER_INCH,
			susp_pot_3_RR: ((row[41] / SUSP_ADC_MAX) * 100) / SUSP_MM_PER_INCH,
			susp_pot_4_RL: ((row[42] / SUSP_ADC_MAX) * 100) / SUSP_MM_PER_INCH,
			rad_in:
				((row[43] / THERMO_ADC_MAX - THERMO_V_MAX) / (THERMO_V_MIN - THERMO_V_MAX)) *
					(THERMO_T_MAX - THERMO_T_MIN) +
				THERMO_T_MIN,
			rad_out:
				((row[44] / THERMO_ADC_MAX - THERMO_V_MAX) / (THERMO_V_MIN - THERMO_V_MAX)) *
					(THERMO_T_MAX - THERMO_T_MIN) +
				THERMO_T_MIN,
			amb_air_temp: row[45],
			brake1: BRAKE_PSI_MAX * ((row[46] / BRAKE_ADC_MAX - BRAKE_V_ZERO) / BRAKE_V_SPAN),
			brake2: BRAKE_PSI_MAX * ((row[47] / BRAKE_ADC_MAX - BRAKE_V_ZERO) / BRAKE_V_SPAN)
		}));

		globalData.lines = out;
	}
</script>

<div class="flex h-full w-full flex-col items-center justify-center gap-3 p-4">
	<div class="text-center">
		<h1 class="text-2xl font-semibold">Load Data</h1>
		<p class="text-sm text-stone-500">Import a .bin telemetry file</p>
	</div>

	<input
		type="file"
		bind:files
		onchange={parse}
		accept=".bin"
		class="text-sm text-stone-500 file:mr-3 file:cursor-pointer file:rounded file:border file:border-stone-300 file:bg-stone-50 file:px-3 file:py-1 file:text-xs file:font-medium file:text-stone-700 hover:file:bg-blue-50 hover:file:text-blue-700"
	/>

	{#if globalData.lines.length > 0}
		<p class="text-sm text-emerald-600">
			{globalData.lines.length.toLocaleString()} data points loaded
		</p>
	{/if}
</div>
