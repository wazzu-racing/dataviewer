<script lang="ts">
	import { untrack } from 'svelte';
	import { data as globalData } from '$lib/data.svelte';
	import type { DataLine, GaugeConfig } from '$lib/types';

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
	const lastLine = $derived(globalData.lines.at(-1));
	const currentValue = $derived(lastLine ? (lastLine[selectedField] as number) : null);
	const unit = $derived(FIELD_UNITS[selectedField] ?? '');

	const allValues = $derived(
		globalData.lines.length > 0 ? globalData.lines.map((l) => l[selectedField] as number) : []
	);
	const minVal = $derived(allValues.length > 0 ? Math.min(...allValues) : 0);
	const maxVal = $derived(allValues.length > 0 ? Math.max(...allValues) : 1);
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

	/** Convert polar angle (degrees, 0 = right / 3 o'clock) to SVG cartesian coords. */
	function polar(cx: number, cy: number, r: number, angleDeg: number): [number, number] {
		const rad = ((angleDeg - 90) * Math.PI) / 180;
		return [cx + r * Math.sin(rad), cy - r * Math.cos(rad)];
	}

	/**
	 * Build an SVG arc path string for a stroke-based arc.
	 * Angles are in degrees measured clockwise from the top (12 o'clock).
	 * The gauge sweeps from 180° (left) to 0° (right) — i.e. startAngle=180, endAngle=0
	 * mapped to the convention where 270° = left and 90° = right.
	 */
	function arcPath(startDeg: number, endDeg: number): string {
		// Map gauge degrees (0 = left, 180 = right) → SVG polar degrees
		// Gauge 0° → SVG 270° (left), Gauge 180° → SVG 90° (right)
		const svgStart = 270 - startDeg; // startDeg=0 → 270 (left)
		const svgEnd = 270 - endDeg; // endDeg=180 → 90 (right)
		const [x1, y1] = polar(CX, CY, R, svgStart);
		const [x2, y2] = polar(CX, CY, R, svgEnd);
		const sweep = endDeg - startDeg;
		const largeArc = sweep > 180 ? 1 : 0;
		// Clockwise sweep direction = 1 (SVG positive direction)
		return `M ${x1.toFixed(3)} ${y1.toFixed(3)} A ${R} ${R} 0 ${largeArc} 1 ${x2.toFixed(3)} ${y2.toFixed(3)}`;
	}

	// Track arc: full 180° sweep
	const trackPath = $derived(arcPath(0, 180));
	// Fill arc: proportional to barPct — only computed/rendered when value is above minimum
	const fillDeg = $derived(barPct * 180);
	const fillPath = $derived(fillDeg > 0 ? arcPath(0, fillDeg) : null);
</script>

<div class="flex h-full w-full flex-col items-center justify-start gap-2 p-3">
	<!-- Field selector -->
	<select
		bind:value={selectedField}
		class="w-full max-w-xs rounded border border-stone-300 bg-white px-2 py-1 text-sm"
	>
		{#each NUMERIC_FIELDS as f (f)}
			<option value={f}>{prettyLabel(f)}</option>
		{/each}
	</select>

	{#if globalData.lines.length === 0}
		<p class="mt-4 text-sm text-stone-400">No data loaded</p>
	{:else}
		<!-- SVG arc gauge -->
		<svg
			viewBox="0 0 200 120"
			class="w-full max-w-xs"
			aria-label="{prettyLabel(selectedField)} gauge"
			role="img"
		>
			<!-- Background track arc -->
			<path d={trackPath} fill="none" stroke="#e7e5e4" stroke-width="18" stroke-linecap="round" />
			<!-- Value fill arc — only rendered when value is above minimum -->
			{#if fillPath}
				<path d={fillPath} fill="none" stroke="#3b82f6" stroke-width="18" stroke-linecap="round" />
			{/if}
			<!-- Current value (large, centered) -->
			<text
				x={CX}
				y={CY - 4}
				text-anchor="middle"
				dominant-baseline="auto"
				font-size="26"
				font-weight="bold"
				fill="#1c1917"
				font-family="monospace"
			>
				{currentValue !== null ? currentValue.toFixed(1) : '—'}
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
			>
				{prettyLabel(selectedField)}
			</text>
			<!-- Min label (left end of arc) -->
			<text x="14" y="118" text-anchor="middle" font-size="9" fill="#a8a29e">
				{minVal.toFixed(1)}
			</text>
			<!-- Max label (right end of arc) -->
			<text x="186" y="118" text-anchor="middle" font-size="9" fill="#a8a29e">
				{maxVal.toFixed(1)}
			</text>
		</svg>
	{/if}
</div>
