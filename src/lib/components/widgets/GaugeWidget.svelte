<script lang="ts">
	import { data as globalData } from '$lib/data.svelte';
	import type { DataLine } from '$lib/types';

	const NUMERIC_FIELDS = [
		'rpm',
		'ground_speed',
		'tps',
		'afr',
		'batt',
		'oil_press',
		'clnt_temp',
		'mat',
		'egt',
		'rad_in',
		'rad_out',
		'amb_air_temp',
		'brake1',
		'brake2',
		'baro',
		'map',
		'maf',
		'in_temp',
		'ax',
		'ay',
		'az',
		'imu_x',
		'imu_y',
		'imu_z',
		'susp_pot_1_FL',
		'susp_pot_2_FR',
		'susp_pot_3_RR',
		'susp_pot_4_RL',
		'lat',
		'lon',
		'elev',
		'spark_advance',
		'fuelload',
		'time',
		'write_millis'
	] as const satisfies (keyof DataLine)[];

	type NumericField = (typeof NUMERIC_FIELDS)[number];

	const FIELD_UNITS: Partial<Record<NumericField, string>> = {
		rpm: 'RPM',
		ground_speed: 'mph',
		tps: '%',
		afr: ':1',
		batt: 'V',
		oil_press: 'kPa',
		clnt_temp: '°F',
		mat: '°F',
		egt: '°F',
		rad_in: '°F',
		rad_out: '°F',
		amb_air_temp: '°F',
		brake1: 'psi',
		brake2: 'psi',
		baro: 'kPa',
		map: 'kPa',
		lat: '°',
		lon: '°',
		elev: 'm',
		spark_advance: '°'
	};

	function prettyLabel(field: string): string {
		return field.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
	}

	let selectedField: NumericField = $state('rpm');

	const lastLine = $derived(globalData.lines.at(-1));
	const currentValue = $derived(lastLine ? (lastLine[selectedField] as number) : null);
	const unit = $derived(FIELD_UNITS[selectedField] ?? '');

	// Min/max across all loaded data for the bar
	const allValues = $derived(
		globalData.lines.length > 0 ? globalData.lines.map((l) => l[selectedField] as number) : []
	);
	const minVal = $derived(allValues.length > 0 ? Math.min(...allValues) : 0);
	const maxVal = $derived(allValues.length > 0 ? Math.max(...allValues) : 1);
	const barPct = $derived(
		currentValue !== null && maxVal > minVal
			? Math.max(0, Math.min(100, ((currentValue - minVal) / (maxVal - minVal)) * 100))
			: 0
	);
</script>

<div class="flex h-full w-full flex-col items-center justify-center gap-4 p-4">
	<!-- Field selector -->
	<select
		bind:value={selectedField}
		class="rounded border border-stone-300 bg-white px-2 py-1 text-sm"
	>
		{#each NUMERIC_FIELDS as f (f)}
			<option value={f}>{prettyLabel(f)}</option>
		{/each}
	</select>

	{#if globalData.lines.length === 0}
		<p class="text-sm text-stone-400">No data loaded</p>
	{:else}
		<!-- Large value display -->
		<div class="text-center">
			<div class="text-5xl font-bold tabular-nums text-stone-800">
				{currentValue !== null ? currentValue.toFixed(1) : '—'}
			</div>
			{#if unit}
				<div class="mt-1 text-lg text-stone-400">{unit}</div>
			{/if}
			<div class="mt-1 text-sm font-medium text-stone-500">{prettyLabel(selectedField)}</div>
		</div>

		<!-- Min/max range bar -->
		<div class="w-full max-w-xs">
			<div class="h-3 w-full overflow-hidden rounded-full bg-stone-200">
				<div
					class="h-full rounded-full bg-blue-500 transition-all duration-100"
					style="width:{barPct}%"
				></div>
			</div>
			<div class="mt-1 flex justify-between text-xs text-stone-400">
				<span>{minVal.toFixed(1)}</span>
				<span>{maxVal.toFixed(1)}</span>
			</div>
		</div>
	{/if}
</div>
