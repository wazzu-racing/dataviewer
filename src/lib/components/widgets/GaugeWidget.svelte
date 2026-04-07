<script lang="ts">
	import { untrack } from 'svelte';
	import { dataStore } from '$lib/stores/dataStore';
	import type { DataLine, GaugeConfig } from '$lib/types';
	import { timeIndexStore } from '$lib/stores/time';

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

	// ---------------------------------------------------------------------------
	// Props
	// ---------------------------------------------------------------------------
	type Props = {
		config?: GaugeConfig;
		onConfigChange?: (cfg: GaugeConfig) => void;
	};
	const { config: _cfg, onConfigChange }: Props = $props();
	const _seedField: NumericField = untrack(
		() => (_cfg?.field as NumericField | undefined) ?? 'rpm'
	);

	// ---------------------------------------------------------------------------
	// Widget state — seeded once from persisted config
	// ---------------------------------------------------------------------------
	let selectedField: NumericField = $state(_seedField);

	// ---------------------------------------------------------------------------
	// Config persistence — same mount-guard pattern as GraphWidget
	// ---------------------------------------------------------------------------
	let _configMounted = false;
	$effect(() => {
		const cfg: GaugeConfig = { field: selectedField };
		if (!_configMounted) {
			_configMounted = true;
			return;
		}
		onConfigChange?.(cfg);
	});

	// ---------------------------------------------------------------------------
	// Derived values
	// ---------------------------------------------------------------------------
	// Global index-based current line
	const currentLine = $derived($timeIndexStore.currentLine);
	const currentValue = $derived(currentLine ? (currentLine[selectedField] as number) : null);

	const unit = $derived(FIELD_UNITS[selectedField] ?? '');

	const allValues = $derived(
		$dataStore.telemetry.length > 0
			? $dataStore.telemetry
					.map((l) => l[selectedField] as number)
					.filter(
						(v) => typeof v === 'number' && isFinite(v) && v !== null && v !== undefined && v > 0
					) // Exclude zeros/nulls/NaN
			: []
	);
	const minVal = $derived(allValues.length > 0 ? Math.min(...allValues) : 0);
	const maxVal = $derived(allValues.length > 0 ? Math.max(...allValues) : 1);
	const avgVal = $derived(
		allValues.length > 0
			? allValues.reduce((sum, value) => sum + value, 0) / allValues.length
			: null
	);
	const barPct = $derived(
		currentValue !== null && maxVal > minVal
			? Math.max(0, Math.min(1, (currentValue - minVal) / (maxVal - minVal)))
			: 0
	);

	// ---------------------------------------------------------------------------
	// SVG arc gauge geometry
	// SVG viewBox: 0 0 200 120
	// Semi-circle centred at (100, 100), radius 80, sweeping 180° (left → right)
	// ---------------------------------------------------------------------------
	const CX = 100;
	const CY = 100;
	const R = 80;

	/**
	 * Convert polar angle to SVG cartesian coords.
	 * 0° = 3 o'clock (right)
	 * 90° = 12 o'clock (top)
	 * 180° = 9 o'clock (left)
	 * 270° = 6 o'clock (bottom)
	 */
	function polar(cx: number, cy: number, r: number, angleDeg: number): [number, number] {
		const rad = (angleDeg * Math.PI) / 180;
		return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
	}

	/**
	 * Build an SVG arc path string for a stroke-based arc.
	 * Angles are in degrees measured clockwise from the top (12 o'clock).
	 * The gauge sweeps from 180° (left) to 0° (right) — i.e. startAngle=180, endAngle=0
	 * mapped to the convention where 270° = left and 90° = right.
	 */
	function arcPath(startDeg: number, endDeg: number, pct: number): string {
		const [x1, y1] = polar(CX, CY, R, startDeg);
		const [x2, y2] = polar(CX, CY, R, endDeg);
		const sweepFlag = 1;
		const largeArcFlag = pct > 0.5 ? 1 : 0;
		return `M ${x1.toFixed(3)} ${y1.toFixed(3)} A ${R} ${R} 0 ${largeArcFlag} ${sweepFlag} ${x2.toFixed(3)} ${y2.toFixed(3)}`;
	}

	function formatNumber(value: number | null, decimals = 1): string {
		return typeof value === 'number' && isFinite(value) ? value.toFixed(decimals) : '—';
	}

	// Track arc: full 180° sweep
	// Track arc: full 180° sweep from left (9 o'clock/180°) to right (3 o'clock/0°)
	const trackPath = $derived(arcPath(180, 0, 1)); // Full sweep, barPct=1

	const fillEndDeg = $derived(180 * barPct);
	const fillPath = $derived(
		(() => {
			// if (barPct === 0) return '';
			const x1 = CX - R;
			const y1 = CY;
			const x2 = CX - R * Math.cos(fillEndDeg * (Math.PI / 180));
			const y2 = CY - R * Math.sin(fillEndDeg * (Math.PI / 180));

			// Pie segment path: move to point, then draw arc.
			return `M ${x1.toFixed(3)} ${y1.toFixed(3)} A ${R} ${R} 0 0 1 ${x2.toFixed(3)} ${y2.toFixed(3)}`;
		})()
	); // Pie segment for fill arc
</script>

<div
	class="flex h-full w-full flex-col items-center justify-start gap-2 p-4 bg-white dark:bg-neutral-900 ring-1 ring-primary/15 dark:ring-neutral-800 rounded-xl shadow-md"
>
	<!-- Field selector -->
	<select
		bind:value={selectedField}
		class="w-full max-w-xs rounded-md border border-primary/20 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-primary-900 dark:text-neutral-100 px-2 py-1 text-xs font-semibold shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80 transition"
	>
		{#each NUMERIC_FIELDS as f (f)}
			<option value={f}>{prettyLabel(f)}</option>
		{/each}
	</select>

	{#if $dataStore.telemetry.length === 0}
		<p class="mt-4 text-sm text-neutral-400 dark:text-neutral-500">No data loaded</p>
	{:else}
		<!-- SVG arc gauge -->
		<svg
			viewBox="0 0 210 120"
			class="w-full max-w-xs"
			aria-label="{prettyLabel(selectedField)} gauge"
			role="img"
		>
			<!-- Background track arc -->
			<path
				d={trackPath}
				fill="none"
				stroke="#e7e5e4"
				stroke-width="18"
				stroke-linecap="round"
				class="dark:stroke-neutral-800"
			/>
			<!-- Value fill arc (brand accent!) -->
			<path d={fillPath} fill="none" stroke="#a60f2d" stroke-width="18" stroke-linecap="round" />
			<!-- Current value (large, centered) -->
			<text
				x={CX}
				y={CY - 4}
				text-anchor="middle"
				dominant-baseline="auto"
				font-size="26"
				font-weight="bold"
				class="fill-primary-950 dark:fill-neutral-100"
				font-family="monospace"
			>
				{typeof currentValue === 'number' && isFinite(currentValue) ? currentValue.toFixed(1) : '—'}
			</text>
			<!-- Unit label -->
			{#if unit}
				<text
					x={CX}
					y={CY + 16}
					text-anchor="middle"
					dominant-baseline="auto"
					font-size="11"
					fill="#a8a29e"
					class="dark:fill-neutral-400"
				>
					{unit}
				</text>
			{/if}
			<!-- Field label -->
			<text
				x={CX}
				y={CY + 30}
				text-anchor="middle"
				dominant-baseline="auto"
				font-size="10"
				font-weight="600"
				fill="#78716c"
				class="dark:fill-neutral-400"
			>
				{prettyLabel(selectedField)}
			</text>
			<!-- Min label (left end of arc) -->
			<text
				x="14"
				y="118"
				text-anchor="middle"
				font-size="9"
				fill="#a8a29e"
				class="dark:fill-neutral-400"
			>
				{typeof minVal === 'number' && isFinite(minVal) ? minVal.toFixed(1) : '—'}
			</text>
			<!-- Max label (right end of arc) -->
			<text
				x="186"
				y="118"
				text-anchor="middle"
				font-size="9"
				fill="#a8a29e"
				class="dark:fill-neutral-400"
			>
				{typeof maxVal === 'number' && isFinite(maxVal) ? maxVal.toFixed(1) : '—'}
			</text>
		</svg>

		<div
			class="w-full max-w-xs grid grid-cols-3 gap-2 text-center text-[10px] font-semibold text-neutral-500 dark:text-neutral-400"
		>
			<div class="rounded-md bg-neutral-50 dark:bg-neutral-800/40 px-2 py-1">
				<div class="uppercase tracking-wide text-[9px] text-neutral-400 dark:text-neutral-500">
					Min
				</div>
				<div class="text-base text-primary-900 dark:text-neutral-100 font-mono">
					{formatNumber(minVal)}
				</div>
			</div>
			<div class="rounded-md bg-neutral-50 dark:bg-neutral-800/40 px-2 py-1">
				<div class="uppercase tracking-wide text-[9px] text-neutral-400 dark:text-neutral-500">
					Max
				</div>
				<div class="text-base text-primary-900 dark:text-neutral-100 font-mono">
					{formatNumber(maxVal)}
				</div>
			</div>
			<div class="rounded-md bg-neutral-50 dark:bg-neutral-800/40 px-2 py-1">
				<div class="uppercase tracking-wide text-[9px] text-neutral-400 dark:text-neutral-500">
					Avg
				</div>
				<div class="text-base text-primary-900 dark:text-neutral-100 font-mono">
					{formatNumber(avgVal)}
				</div>
			</div>
		</div>
	{/if}
</div>
