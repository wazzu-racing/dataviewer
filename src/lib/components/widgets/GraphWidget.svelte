<script lang="ts">
	import { data as globalData } from '$lib/data.svelte';
	import type { DataLine, GraphConfig } from '$lib/types';
	import { browser } from '$app/environment';
	import { untrack } from 'svelte';
	import 'uplot/dist/uPlot.min.css';

	// ---------------------------------------------------------------------------
	// All numeric (plottable) keys from DataLine — excludes 'unixtime' (Date)
	// Must be defined before Props so NumericField type is available
	// ---------------------------------------------------------------------------
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

	// ---------------------------------------------------------------------------
	// Color palette for multi-series
	// ---------------------------------------------------------------------------
	const SERIES_COLORS = [
		'#3b82f6', // blue
		'#f97316', // orange
		'#22c55e', // green
		'#ef4444', // red
		'#a855f7', // purple
		'#eab308', // yellow
		'#06b6d4', // cyan
		'#ec4899' // pink
	];

	function prettyLabel(field: string): string {
		return field.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
	}

	// ---------------------------------------------------------------------------
	// Props
	// ---------------------------------------------------------------------------
	type Props = {
		config?: GraphConfig;
		onConfigChange?: (config: GraphConfig) => void;
	};
	// Use $props() as Props cast; destructure config to a private name so we can
	// snapshot it for $state initialization. untrack() prevents Svelte from
	// treating the prop reads as reactive dependencies (seed-once pattern).
	const { config: _cfg, onConfigChange }: Props = $props();
	const _seedX: NumericField = untrack(() => (_cfg?.xField as NumericField) ?? 'time');
	const _seedY: NumericField[] = untrack(() =>
		(_cfg?.yFields as NumericField[] | undefined)?.length
			? (_cfg!.yFields as NumericField[])
			: ['rpm']
	);

	// ---------------------------------------------------------------------------
	// Widget state — seeded once from persisted config
	// ---------------------------------------------------------------------------
	let xField: NumericField = $state(_seedX);
	let yFields: NumericField[] = $state([..._seedY]);

	// Dropdown open state
	let yDropdownOpen = $state(false);

	function toggleYField(field: NumericField) {
		if (yFields.includes(field)) {
			// Don't remove the last field
			if (yFields.length > 1) {
				yFields = yFields.filter((f) => f !== field);
			}
		} else {
			yFields = [...yFields, field];
		}
	}

	// ---------------------------------------------------------------------------
	// Tooltip state (updated by uPlot setCursor hook)
	// ---------------------------------------------------------------------------
	type TooltipEntry = { label: string; value: string; color: string };
	let tooltipVisible = $state(false);
	let tooltipX = $state(0);
	let tooltipY = $state(0);
	let tooltipFlipped = $state(false); // true when tooltip should render to the left of cursor
	let tooltipXLabel = $state('');
	let tooltipXValue = $state('');
	let tooltipEntries: TooltipEntry[] = $state([]);

	// ---------------------------------------------------------------------------
	// uPlot refs
	// ---------------------------------------------------------------------------
	let container: HTMLDivElement | undefined = $state(); // chart-area div (below controls bar)
	let chartMount: HTMLDivElement | undefined = $state(); // inner absolute div uPlot renders into
	// Plain let (not $state) — mutations must not feed back into Svelte's reactive
	// graph, otherwise the chart-build $effect would re-run every time a new uPlot
	// instance is assigned, which destroys the new chart and resets pan/zoom.
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let uplotInstance: any = null;

	/** Returns the pixel dimensions available for the chart. */
	function plotSize(): { width: number; height: number } {
		return {
			width: Math.max(1, container?.clientWidth ?? 1),
			height: Math.max(1, container?.clientHeight ?? 1)
		};
	}

	// ---------------------------------------------------------------------------
	// Data builder
	// ---------------------------------------------------------------------------
	function buildData(
		lines: DataLine[],
		x: NumericField,
		ys: NumericField[]
	): [number[], ...number[][]] {
		const xs: number[] = [];
		const yArrays: number[][] = ys.map(() => []);
		for (const line of lines) {
			xs.push(line[x] as number);
			for (let i = 0; i < ys.length; i++) {
				yArrays[i].push(line[ys[i]] as number);
			}
		}
		// uPlot's closestIdx uses binary search and requires x values sorted ascending.
		// Sort all arrays together by x to guarantee correct rendering of the full dataset.
		const order = Array.from({ length: xs.length }, (_, i) => i).sort((a, b) => xs[a] - xs[b]);
		const sortedXs = order.map((i) => xs[i]);
		const sortedYs = yArrays.map((arr) => order.map((i) => arr[i]));
		return [sortedXs, ...sortedYs];
	}

	// ---------------------------------------------------------------------------
	// Zoom / pan helpers (operate on uPlot x scale)
	// ---------------------------------------------------------------------------
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	function getXRange(u: any): [number, number] {
		const scaleMin = u.scales.x.min as number | null;
		const scaleMax = u.scales.x.max as number | null;
		if (scaleMin != null && scaleMax != null && isFinite(scaleMin) && isFinite(scaleMax)) {
			return [scaleMin, scaleMax];
		}
		// Fall back to the full data extent when the scale hasn't been initialised yet
		// or has been corrupted by a NaN setScale call.
		const xData = u.data[0] as number[];
		return [xData[0], xData[xData.length - 1]];
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	function attachWheelZoom(u: any, el: HTMLElement) {
		function onWheel(e: WheelEvent) {
			e.preventDefault();
			const [min, max] = getXRange(u);
			const span = max - min;
			// Zoom towards cursor position within the plot
			const rect = el.getBoundingClientRect();
			const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
			const factor = e.deltaY > 0 ? 1.15 : 1 / 1.15;
			const newSpan = span * factor;
			const pivot = min + frac * span;
			const newMin = pivot - frac * newSpan;
			const newMax = pivot + (1 - frac) * newSpan;
			u.setScale('x', { min: newMin, max: newMax });
		}
		el.addEventListener('wheel', onWheel, { passive: false });
		return () => el.removeEventListener('wheel', onWheel);
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	function attachPan(u: any, el: HTMLElement) {
		let dragging = false;
		let startX = 0;
		let startMin = 0;
		let startMax = 0;

		function onMouseDown(e: MouseEvent) {
			// Only left button
			if (e.button !== 0) return;
			dragging = true;
			startX = e.clientX;
			[startMin, startMax] = getXRange(u);
		}

		function onMouseMove(e: MouseEvent) {
			if (!dragging) return;
			const rect = el.getBoundingClientRect();
			const span = startMax - startMin;
			const pxSpan = rect.width;
			if (pxSpan === 0) return;
			const dx = e.clientX - startX;
			const dVal = (dx / pxSpan) * span;
			u.setScale('x', { min: startMin - dVal, max: startMax - dVal });
		}

		function onMouseUp() {
			dragging = false;
		}

		el.addEventListener('mousedown', onMouseDown);
		window.addEventListener('mousemove', onMouseMove);
		window.addEventListener('mouseup', onMouseUp);

		return () => {
			el.removeEventListener('mousedown', onMouseDown);
			window.removeEventListener('mousemove', onMouseMove);
			window.removeEventListener('mouseup', onMouseUp);
		};
	}

	// ---------------------------------------------------------------------------
	// Build uPlot and attach interactions
	// ---------------------------------------------------------------------------
	$effect(() => {
		if (!browser || !container) return;

		// Track reactive dependencies
		const lines = globalData.lines;
		const x = xField;
		const ys = yFields;

		// Guard against stale async callbacks if the effect re-runs before the
		// dynamic import resolves (e.g. user changes a field quickly).
		let cancelled = false;

		// Dynamically import uPlot to avoid SSR issues
		import('uplot').then(({ default: uPlot }) => {
			if (cancelled) return;

			if (uplotInstance) {
				uplotInstance.destroy();
				uplotInstance = null;
			}
			tooltipVisible = false;

			if (lines.length === 0 || !chartMount) return;

			const data = buildData(lines, x, ys);

			// Build series config — first entry is x-axis (no style needed)
			const series: uPlot.Series[] = [{ label: prettyLabel(x) }];
			for (let i = 0; i < ys.length; i++) {
				series.push({
					label: prettyLabel(ys[i]),
					stroke: SERIES_COLORS[i % SERIES_COLORS.length],
					width: 1.5,
					scale: `y${i}`
				});
			}

			// Independent scale per Y series
			const scales: Record<string, uPlot.Scale> = { x: { time: false } };
			for (let i = 0; i < ys.length; i++) {
				scales[`y${i}`] = { auto: true };
			}

			// Show at most 2 Y axes (left + right) to avoid clutter
			const axes: uPlot.Axis[] = [{ label: prettyLabel(x) }];
			for (let i = 0; i < ys.length; i++) {
				axes.push({
					scale: `y${i}`,
					label: prettyLabel(ys[i]),
					side: i % 2 === 0 ? 3 : 1, // 3 = left, 1 = right
					show: i < 2 // only render first two axes visually
				});
			}

			const opts: uPlot.Options = {
				// Start with placeholder size — corrected immediately after mount below
				width: 1,
				height: 1,
				legend: { show: false }, // we render our own tooltip overlay
				cursor: {
					sync: { key: 'telemetry' },
					drag: { x: false, y: false } // We handle pan/zoom ourselves
				},
				series,
				axes,
				scales,
				hooks: {
					setCursor: [
						(u) => {
							const { left, top, idx } = u.cursor;
							if (idx == null || left == null || top == null || left < 0) {
								tooltipVisible = false;
								return;
							}
							tooltipVisible = true;
							// Flip tooltip to the left when cursor is in the right half to
							// avoid it overflowing off the edge of the chart.
							const chartWidth = container?.clientWidth ?? 0;
							tooltipFlipped = left > chartWidth / 2;
							tooltipX = tooltipFlipped ? left - 16 : left + 16;
							tooltipY = top;

							const xVal = (u.data[0] as number[])[idx];
							tooltipXLabel = prettyLabel(x);
							tooltipXValue = xVal != null ? xVal.toFixed(3) : '—';

							tooltipEntries = ys.map((field, i) => {
								const val = (u.data[i + 1] as number[])[idx!];
								return {
									label: prettyLabel(field),
									value: val != null ? val.toFixed(3) : '—',
									color: SERIES_COLORS[i % SERIES_COLORS.length]
								};
							});
						}
					]
				}
			};

			uplotInstance = new uPlot(opts, data, chartMount!);

			// Defer size correction to the next animation frame so the flexbox
			// layout has been computed and clientWidth/clientHeight are non-zero.
			requestAnimationFrame(() => {
				if (cancelled || !uplotInstance) return;
				const { width, height } = plotSize();
				uplotInstance.setSize({ width, height });
			});

			// Attach zoom and pan to the uPlot overlay element
			const plotEl = container!.querySelector('.u-over') as HTMLElement | null;
			if (plotEl) {
				const detachWheel = attachWheelZoom(uplotInstance, plotEl);
				const detachPan = attachPan(uplotInstance, plotEl);
				// Stash cleanup on the instance for teardown
				uplotInstance._detachInteractions = () => {
					detachWheel();
					detachPan();
				};
			}
		});

		return () => {
			cancelled = true;
			if (uplotInstance) {
				uplotInstance._detachInteractions?.();
				uplotInstance.destroy();
				uplotInstance = null;
			}
			tooltipVisible = false;
		};
	});

	// ---------------------------------------------------------------------------
	// ResizeObserver — drives ALL sizing (initial + subsequent resizes).
	// Observes the chart container div (below the controls bar).
	// ---------------------------------------------------------------------------
	$effect(() => {
		if (!browser || !container) return;
		const observer = new ResizeObserver(() => {
			if (!uplotInstance) return;
			const { width, height } = plotSize();
			uplotInstance.setSize({ width, height });
		});
		observer.observe(container);
		return () => observer.disconnect();
	});

	// ---------------------------------------------------------------------------
	// Config persistence — notify parent only when user changes selection,
	// not on initial mount (which would cause an effect_update_depth_exceeded loop
	// because the parent re-renders the widget with the new config prop).
	// ---------------------------------------------------------------------------
	let _configMounted = false;
	$effect(() => {
		// Read reactive deps first so Svelte tracks them
		const cfg: GraphConfig = { xField, yFields: [...yFields] };
		if (!_configMounted) {
			_configMounted = true;
			return;
		}
		onConfigChange?.(cfg);
	});
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="flex h-full w-full flex-col overflow-hidden">
	<!-- Controls -->
	<div class="flex shrink-0 items-center gap-2 border-b border-stone-200 bg-stone-50 px-2 py-1">
		<!-- X axis selector -->
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

		<!-- Y series multi-select dropdown -->
		<div class="relative flex items-center gap-1 text-xs text-stone-600">
			<span>Y</span>
			<div class="relative">
				<button
					onclick={() => (yDropdownOpen = !yDropdownOpen)}
					class="flex items-center gap-1 rounded border border-stone-300 bg-white px-1 py-0.5 text-xs hover:bg-stone-50"
				>
					<!-- Color swatches for selected fields -->
					{#each yFields as f, i (f)}
						<span
							class="inline-block h-2 w-2 rounded-full"
							style="background:{SERIES_COLORS[i % SERIES_COLORS.length]}"
						></span>
					{/each}
					<span class="ml-0.5 text-stone-700"
						>{yFields.length === 1 ? prettyLabel(yFields[0]) : `${yFields.length} series`}</span
					>
					<span class="text-stone-400">▾</span>
				</button>

				{#if yDropdownOpen}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						class="absolute left-0 top-full z-50 mt-0.5 max-h-64 w-48 overflow-y-auto rounded border border-stone-200 bg-white shadow-lg"
						onmouseleave={() => (yDropdownOpen = false)}
					>
						{#each NUMERIC_FIELDS as f (f)}
							{@const selected = yFields.includes(f)}
							{@const idx = yFields.indexOf(f)}
							<button
								onclick={() => toggleYField(f)}
								class="flex w-full items-center gap-2 px-2 py-1 text-left text-xs hover:bg-stone-50 {selected
									? 'font-medium text-stone-800'
									: 'text-stone-600'}"
							>
								<span
									class="inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-stone-300"
									style={selected ? `background:${SERIES_COLORS[idx % SERIES_COLORS.length]}` : ''}
								></span>
								{prettyLabel(f)}
							</button>
						{/each}
					</div>
				{/if}
			</div>
		</div>

		{#if globalData.lines.length > 0}
			<span class="ml-auto text-xs text-stone-400"
				>{globalData.lines.length.toLocaleString()} pts</span
			>
		{/if}
	</div>

	<!-- uPlot mount point + tooltip overlay -->
	<div bind:this={container} class="relative min-h-0 flex-1 overflow-hidden">
		{#if globalData.lines.length === 0}
			<div class="flex h-full items-center justify-center text-sm text-stone-400">
				No data loaded — use a Load Data pane to import a file
			</div>
		{/if}

		<!-- uPlot renders here; absolutely fills container so it doesn't affect layout measurement -->
		<div bind:this={chartMount} class="absolute inset-0"></div>

		<!-- Tooltip overlay -->
		{#if tooltipVisible}
			<div
				class="pointer-events-none absolute z-10 min-w-32 rounded border border-stone-200 bg-white/90 px-2 py-1.5 shadow-md backdrop-blur-sm"
				style="left:{tooltipX}px; top:{tooltipY}px; transform: translateX({tooltipFlipped
					? '-100%'
					: '0'}) translateY(-50%)"
			>
				<div class="mb-1 text-xs font-medium text-stone-500">
					{tooltipXLabel}: <span class="text-stone-800">{tooltipXValue}</span>
				</div>
				{#each tooltipEntries as entry (entry.label)}
					<div class="flex items-center gap-1.5 text-xs">
						<span
							class="inline-block h-2 w-2 shrink-0 rounded-full"
							style="background:{entry.color}"
						></span>
						<span class="text-stone-500">{entry.label}:</span>
						<span class="font-medium text-stone-800">{entry.value}</span>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
