<script lang="ts">
	import { data as globalData } from '$lib/data.svelte';
	import type { DataLine } from '$lib/types';
	import { browser } from '$app/environment';

	// All numeric (plottable) keys from DataLine — excludes 'unixtime' (Date)
	const NUMERIC_FIELDS = [
		'write_millis',
		'ecu_millis',
		'gps_millis',
		'imu_millis',
		'accel_millis',
		'analogx1_millis',
		'analogx2_millis',
		'analogx3_millis',
		'rpm',
		'time',
		'syncloss_count',
		'syncloss_code',
		'lat',
		'lon',
		'elev',
		'ground_speed',
		'afr',
		'fuelload',
		'spark_advance',
		'baro',
		'map',
		'mat',
		'clnt_temp',
		'tps',
		'batt',
		'oil_press',
		'ltcl_timing',
		've1',
		've2',
		'egt',
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
		'rad_in',
		'rad_out',
		'amb_air_temp',
		'brake1',
		'brake2'
	] as const satisfies (keyof DataLine)[];

	type NumericField = (typeof NUMERIC_FIELDS)[number];

	function prettyLabel(field: string): string {
		return field.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
	}

	let xField: NumericField = $state('time');
	let yField: NumericField = $state('rpm');

	let container: HTMLDivElement | undefined = $state();
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let uplotInstance: any = $state(null);

	function buildData(lines: DataLine[], x: NumericField, y: NumericField): [number[], number[]] {
		const xs: number[] = [];
		const ys: number[] = [];
		for (const line of lines) {
			xs.push(line[x] as number);
			ys.push(line[y] as number);
		}
		return [xs, ys];
	}

	$effect(() => {
		if (!browser || !container) return;

		// Dynamically import uPlot to avoid SSR issues
		import('uplot').then(({ default: uPlot }) => {
			if (uplotInstance) {
				uplotInstance.destroy();
				uplotInstance = null;
			}

			const lines = globalData.lines;
			if (lines.length === 0) return;

			const [xs, ys] = buildData(lines, xField, yField);

			const opts: uPlot.Options = {
				width: container!.clientWidth,
				height: container!.clientHeight,
				cursor: { sync: { key: 'telemetry' } },
				series: [
					{ label: prettyLabel(xField) },
					{
						label: prettyLabel(yField),
						stroke: '#3b82f6',
						width: 1.5,
						fill: 'rgba(59,130,246,0.07)'
					}
				],
				axes: [{ label: prettyLabel(xField) }, { label: prettyLabel(yField) }],
				scales: { x: { time: false } }
			};

			uplotInstance = new uPlot(opts, [xs, ys], container!);
		});

		return () => {
			if (uplotInstance) {
				uplotInstance.destroy();
				uplotInstance = null;
			}
		};
	});

	// Resize observer — update uPlot dimensions when pane is resized
	$effect(() => {
		if (!browser || !container) return;
		const observer = new ResizeObserver(() => {
			if (uplotInstance && container) {
				uplotInstance.setSize({
					width: container.clientWidth,
					height: container.clientHeight - 40
				});
			}
		});
		observer.observe(container);
		return () => observer.disconnect();
	});
</script>

<div class="flex h-full w-full flex-col overflow-hidden">
	<!-- Controls -->
	<div class="flex shrink-0 items-center gap-2 border-b border-stone-200 bg-stone-50 px-2 py-1">
		<label class="flex items-center gap-1 text-xs text-stone-600">
			X
			<select
				bind:value={xField}
				class="rounded border border-stone-300 bg-white px-1 py-0.5 text-xs"
			>
				{#each NUMERIC_FIELDS as f (f)}
					<option value={f}>{prettyLabel(f)}</option>
				{/each}
			</select>
		</label>
		<label class="flex items-center gap-1 text-xs text-stone-600">
			Y
			<select
				bind:value={yField}
				class="rounded border border-stone-300 bg-white px-1 py-0.5 text-xs"
			>
				{#each NUMERIC_FIELDS as f (f)}
					<option value={f}>{prettyLabel(f)}</option>
				{/each}
			</select>
		</label>
		{#if globalData.lines.length > 0}
			<span class="ml-auto text-xs text-stone-400"
				>{globalData.lines.length.toLocaleString()} pts</span
			>
		{/if}
	</div>

	<!-- uPlot mount point -->
	<div bind:this={container} class="min-h-0 flex-1 overflow-hidden">
		{#if globalData.lines.length === 0}
			<div class="flex h-full items-center justify-center text-sm text-stone-400">
				No data loaded — use a Load Data pane to import a file
			</div>
		{/if}
	</div>
</div>
