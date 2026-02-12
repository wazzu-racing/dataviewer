<script lang="ts">
	import { type DataLine, NUM_FIELDS } from '$lib/types';
	import { data as globalData } from '$lib/data.svelte';

	export let onClose: () => void = () => {};

	let files: FileList;

	async function parse() {
		let f = files[0];
		let buffer = await f.arrayBuffer();
		let dataview = new DataView(buffer);

		let bytesPerRow = 4 * NUM_FIELDS;
		let numRows = buffer.byteLength / bytesPerRow;

		// new data list
		let data = [];

		// create an array for each line, then push each line to `data`
		for (var row_i = 0; row_i < numRows; row_i++) {
			let row = [];
			try {
				for (var i = 0; i < NUM_FIELDS; i++) {
					row.push(dataview.getInt32(row_i * bytesPerRow + 4 * i, true)); // all little endian
				}
			} catch {
				alert('Error: corrupted data.');
			}

			data.push(row);
		}

		let out = [];

		data.forEach((row) => {
			// BUG: there are so many magic numbers here
			let o: DataLine = {
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
				lat: row[12] / 10_000_000,
				lon: row[13] / 10_000_000,
				elev: row[14],
				unixtime: new Date(row[15] * 1_000),
				ground_speed: row[16] / 447.04,
				afr: row[17] / 1_000,
				fuelload: row[18] / 1_000,
				spark_advance: row[19] / 1_000,
				baro: row[20] / 1_000,
				map: row[21] / 1_000,
				mat: row[22] / 1_000,
				clnt_temp: row[23] / 1_000,
				tps: row[24] / 1_000,
				batt: row[25] / 1_000,
				oil_press: row[26] / 1_000,
				ltcl_timing: row[27] / 1_000,
				ve1: row[28] / 1_000,
				ve2: row[29] / 1_000,
				egt: row[30] / 1_000,
				maf: row[31] / 1_000,
				in_temp: row[32] / 1_000,
				ax: row[33] / 1_000,
				ay: row[34] / 1_000,
				az: row[35] / 1_000,
				imu_x: row[36] / 1_000,
				imu_y: row[37] / 1_000,
				imu_z: row[38] / 1_000,
				susp_pot_1_FL: ((row[39] / 5024 / 1) * 100) / 25.4,
				susp_pot_2_FR: ((row[40] / 5024 / 1) * 100) / 25.4,
				susp_pot_3_RR: ((row[41] / 5024 / 1) * 100) / 25.4,
				susp_pot_4_RL: ((row[42] / 5024 / 1) * 100) / 25.4,
				rad_in: ((row[43] / 5024 - 0.5232) / (0.0084 - 0.5232)) * (302 + 58) - 58,
				rad_out: ((row[44] / 5024 - 0.5232) / (0.0084 - 0.5232)) * (302 + 58) - 58,
				amb_air_temp: row[45],
				brake1: 5000 * ((row[46] / 5024.0 - 0.1) / 0.8),
				brake2: 5000 * ((row[47] / 5024.0 - 0.1) / 0.8)
			};

			out.push(o);
		});

		globalData.lines = out;

		// Close the pane after successfully loading the data
		onClose();
	}
</script>

<div class="flex justify-center items-center">
	<div>
		<h1 class="text-3xl">Load Data</h1>
		<p>Import a .bin file or load from online.</p>
		<br />

		<input
			type="file"
			bind:files
			on:change={parse}
			accept=".bin"
			class="text-sm text-stone-500 file:mr-5 file:py-1 file:px-3 file:border file:text-xs file:font-medium file:bg-stone-50 file:text-stone-700 hover:file:cursor-pointer hover:file:bg-blue-50 hover:file:text-blue-700"
		/>
	</div>
</div>
