<script lang="ts">
	import { data as globalData } from '$lib/data.svelte';
	import type { DataLine } from '$lib/types';

	// All displayable columns (everything except unixtime)
	const ALL_COLUMNS = [
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

	type Column = (typeof ALL_COLUMNS)[number];

	// Default visible columns
	let visibleColumns: Column[] = $state(['time', 'rpm', 'ground_speed', 'tps', 'afr', 'batt']);
	let showColumnPicker = $state(false);

	// Windowed rendering — only render rows within scroll viewport
	const ROW_HEIGHT = 28; // px
	const BUFFER = 10;

	let scrollContainer: HTMLDivElement | undefined = $state();
	let scrollTop = $state(0);

	const lines = $derived(globalData.lines);
	const totalRows = $derived(lines.length);
	const totalHeight = $derived(totalRows * ROW_HEIGHT);

	const startIdx = $derived(Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - BUFFER));
	const visibleCount = $derived(
		scrollContainer ? Math.ceil(scrollContainer.clientHeight / ROW_HEIGHT) + BUFFER * 2 : 50
	);
	const endIdx = $derived(Math.min(totalRows, startIdx + visibleCount));
	const visibleRows = $derived(lines.slice(startIdx, endIdx));
	const offsetY = $derived(startIdx * ROW_HEIGHT);

	function fmt(val: unknown): string {
		if (typeof val === 'number') return val.toFixed(3);
		return String(val);
	}

	function toggleColumn(col: Column) {
		if (visibleColumns.includes(col)) {
			if (visibleColumns.length > 1) visibleColumns = visibleColumns.filter((c) => c !== col);
		} else {
			visibleColumns = [...visibleColumns, col];
		}
	}
</script>

<div class="flex h-full w-full flex-col overflow-hidden text-xs">
	<!-- Toolbar -->
	<div class="flex shrink-0 items-center gap-2 border-b border-stone-200 bg-stone-50 px-2 py-1">
		<span class="text-stone-500">{totalRows.toLocaleString()} rows</span>
		<div class="relative ml-auto">
			<button
				onclick={() => (showColumnPicker = !showColumnPicker)}
				class="rounded border border-stone-300 bg-white px-2 py-0.5 text-xs hover:bg-stone-100"
			>
				Columns ▾
			</button>
			{#if showColumnPicker}
				<div
					class="absolute right-0 top-full z-50 mt-1 max-h-64 w-44 overflow-y-auto rounded border border-stone-200 bg-white shadow-lg"
				>
					{#each ALL_COLUMNS as col (col)}
						<label class="flex cursor-pointer items-center gap-2 px-2 py-1 hover:bg-stone-50">
							<input
								type="checkbox"
								checked={visibleColumns.includes(col)}
								onchange={() => toggleColumn(col)}
								class="accent-blue-500"
							/>
							<span>{col}</span>
						</label>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	{#if totalRows === 0}
		<div class="flex flex-1 items-center justify-center text-stone-400">
			No data loaded — use a Load Data pane to import a file
		</div>
	{:else}
		<!-- Sticky header -->
		<div class="shrink-0 border-b border-stone-200 bg-stone-100">
			<div class="flex">
				<div class="w-14 shrink-0 px-2 py-1 font-semibold text-stone-500">#</div>
				{#each visibleColumns as col (col)}
					<div class="w-28 shrink-0 px-2 py-1 font-semibold text-stone-700">{col}</div>
				{/each}
			</div>
		</div>

		<!-- Virtualized scroll body -->
		<div
			bind:this={scrollContainer}
			class="flex-1 overflow-auto"
			onscroll={() => (scrollTop = scrollContainer?.scrollTop ?? 0)}
		>
			<!-- Full-height spacer so scrollbar is correct size -->
			<div style="height:{totalHeight}px; position:relative;">
				<div style="transform: translateY({offsetY}px);">
					{#each visibleRows as row, i (startIdx + i)}
						<div
							class="flex border-b border-stone-100 hover:bg-blue-50 {(startIdx + i) % 2 === 0
								? ''
								: 'bg-stone-50'}"
							style="height:{ROW_HEIGHT}px;"
						>
							<div class="w-14 shrink-0 px-2 py-1 text-stone-400">{startIdx + i}</div>
							{#each visibleColumns as col (col)}
								<div class="w-28 shrink-0 overflow-hidden px-2 py-1 text-stone-700">
									{fmt(row[col])}
								</div>
							{/each}
						</div>
					{/each}
				</div>
			</div>
		</div>
	{/if}
</div>
