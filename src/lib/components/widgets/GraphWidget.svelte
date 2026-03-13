<script lang="ts">
	import { dataStore } from '$lib/stores/dataStore';
	import { timeIndexStore } from '$lib/stores/time';
	import type { DataLine, GraphConfig, XDisplayMode } from '$lib/types';
	import { browser } from '$app/environment';
	import { untrack, onMount } from 'svelte'; // onMount is used for browser-only Plotly integration
	// Plotly import moved to browser-only lifecycle below
	import { isTimeField, formatRelative, formatAbsolute } from '$lib/timeFormat';

	// Plotly will be used for chart rendering.
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
	const _seedDisplayMode: XDisplayMode = untrack(() => _cfg?.xDisplayMode ?? 'raw');

	// ---------------------------------------------------------------------------
	// Widget state — seeded once from persisted config
	// ---------------------------------------------------------------------------
	let xField: NumericField = $state(_seedX);
	let yFields: NumericField[] = $state([..._seedY]);
	let xDisplayMode: XDisplayMode = $state(_seedDisplayMode);

	// Reset display mode to 'raw' when the user switches to a non-time field,
	// and notify the parent of the combined change (new xField + reset xDisplayMode).
	//
	// This effect is also the sole notifier for xField changes — the X select's
	// onchange does NOT call notifyConfigChange directly, because doing so would
	// fire a first notification with the stale xDisplayMode before this effect
	// has a chance to reset it to 'raw'.
	//
	// Mount guard: skip the very first run so that initialising with a non-time
	// xField (e.g. a saved config with xField='rpm') does not fire onConfigChange
	// during mount, which would trigger a parent re-render before the widget is
	// fully set up.
	let _xEffectMounted = false;
	$effect(() => {
		const currentX = xField; // tracked dependency
		if (!_xEffectMounted) {
			_xEffectMounted = true;
			return;
		}
		untrack(() => {
			if (!isTimeField(currentX)) {
				xDisplayMode = 'raw';
			}
			notifyConfigChange();
		});
	});

	// Dropdown open state
	let yDropdownOpen = $state(false);

	function toggleYField(field: NumericField) {
		if (yFields.includes(field)) {
			// Don't remove the last field
			if (yFields.length > 1) {
				yFields = yFields.filter((f) => f !== field);
				notifyConfigChange();
			}
		} else {
			yFields = [...yFields, field];
			notifyConfigChange();
		}
	}

	// ---------------------------------------------------------------------------
	// Tooltip state
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
	// Plotly refs
	// ---------------------------------------------------------------------------
	let container: HTMLDivElement | undefined = $state(); // chart-area div (below controls bar)
	let chartMount: HTMLDivElement | undefined = $state(); // Plotly chart mount
	let plotlyInstance: any = $state(null); // Plotly chart reference

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
	type BuiltData = {
		data: [number[], ...number[][]];
		epochDate: Date; // unixtime of the earliest row (by xField)
		firstMs: number; // xField value of that same earliest row
	};

	function buildData(lines: DataLine[], x: NumericField, ys: NumericField[]): BuiltData {
		const xs: number[] = [];
		const yArrays: number[][] = ys.map(() => []);
		const unixtimes: Date[] = [];
		for (const line of lines) {
			xs.push(line[x] as number);
			unixtimes.push(line.unixtime);
			for (let i = 0; i < ys.length; i++) {
				yArrays[i].push(line[ys[i]] as number);
			}
		}
		// uPlot's closestIdx uses binary search and requires x values sorted ascending.
		// Sort all arrays together by x to guarantee correct rendering of the full dataset.
		const order = Array.from({ length: xs.length }, (_, i) => i).sort((a, b) => xs[a] - xs[b]);
		const sortedXs = order.map((i) => xs[i]);
		const sortedYs = yArrays.map((arr) => order.map((i) => arr[i]));
		// The first element after sorting is the earliest row — use its unixtime as the epoch.
		const firstIdx = order[0];
		return {
			data: [sortedXs, ...sortedYs],
			epochDate: unixtimes[firstIdx] ?? new Date(0),
			firstMs: sortedXs[0] ?? 0
		};
	}

	// ---------------------------------------------------------------------------
	// Plotly handles zoom, pan, and reset internally with its modebar and drag controls.
	// Custom overlays and control handlers will be adapted to Plotly events; manual axis helpers are removed.

	// Fall back to the full data extent when the scale hasn't been initialised yet

	// eslint-disable-next-line @typescript-eslint/no-explicit-any

	// Resets all manual y-zoom and x-zoom, restoring the full auto-fit view.
	// Safe to call at any time; no-ops if no plot is mounted yet.
	// Reset view must be browser-only and Plotly-only
	let resetView = () => {};
	// Inside onMount, this will be redefined

	// Double-click on the plot area resets the view (both axes).
	// Suppressed when the double-click is the tail end of a drag (displacement > 4px).
	function attachDoubleClickReset(el: HTMLElement) {
		let downX = 0;
		let downY = 0;
		function onMouseDown(e: MouseEvent) {
			downX = e.clientX;
			downY = e.clientY;
		}
		function onDblClick(e: MouseEvent) {
			const dx = e.clientX - downX;
			const dy = e.clientY - downY;
			if (dx * dx + dy * dy > 16) return; // suppress if drag > 4px
			resetView();
		}
		el.addEventListener('mousedown', onMouseDown);
		el.addEventListener('dblclick', onDblClick);
		return () => {
			el.removeEventListener('mousedown', onMouseDown);
			el.removeEventListener('dblclick', onDblClick);
		};
	}

	// ---------------------------------------------------------------------------
	// Build uPlot and attach interactions
	// ---------------------------------------------------------------------------
	onMount(() => {
		if (!browser) return;
		(async () => {
			let Plotly: any;
			try {
				Plotly = (await import('plotly.js-dist-min')).default;
			} catch (e) {
				console.error('Plotly import failed:', e);
				return;
			}

			function renderChart() {
				if (!chartMount || !$dataStore.telemetry.length) return;
				const lines = $dataStore.telemetry;
				const x = xField;
				const ys = yFields;
				const displayMode = xDisplayMode;

				const xs: number[] = [];
				const yArrays: number[][] = ys.map(() => []);
				const unixtimes: Date[] = [];
				for (const line of lines) {
					xs.push(line[x] as number);
					unixtimes.push(line.unixtime);
					for (let i = 0; i < ys.length; i++) {
						yArrays[i].push(line[ys[i]] as number);
					}
				}
				const order = Array.from({ length: xs.length }, (_, i) => i).sort((a, b) => xs[a] - xs[b]);
				const sortedXs = order.map((i) => xs[i]);
				const sortedYs = yArrays.map((arr) => order.map((i) => arr[i]));
				const epochDate = unixtimes[order[0]] ?? new Date(0);
				const firstMs = sortedXs[0] ?? 0;

				const formatXValue = (val: number): string => {
					if (displayMode === 'relative') return formatRelative(val - firstMs);
					if (displayMode === 'absolute') return formatAbsolute(val, epochDate, firstMs);
					return val.toFixed(3);
				};

				const traces = sortedYs.map((ysArr, i) => ({
					x: sortedXs,
					y: ysArr,
					type: 'scattergl',
					mode: 'lines',
					name: prettyLabel(ys[i]),
					line: { color: SERIES_COLORS[i % SERIES_COLORS.length], width: 1.5 },
					hoverinfo: 'x+y+name'
				}));

				const layout = {
					margin: { l: 40, r: 16, t: 16, b: 40 },
					legend: { orientation: 'h', y: -0.2 },
					xaxis: {
						title: prettyLabel(x),
						showgrid: true
					},
					yaxis: {
						title: ys.length === 1 ? prettyLabel(ys[0]) : undefined,
						showgrid: true
					},
					showlegend: false,
					dragmode: 'pan'
				};

				Plotly.react(chartMount, traces, layout, { responsive: true });
				plotlyInstance = chartMount;
				// Tooltip/event overlays as before
				attachTooltipEvents();
			}

			function attachTooltipEvents() {
				if (!plotlyInstance || !chartMount) return;
				const chartEl = chartMount;
				const hoverHandler = (event: any) => {
					if (event && event.points && event.points.length > 0) {
						const pt = event.points[0];
						tooltipVisible = true;
						const chartWidth = container?.clientWidth ?? 0;
						tooltipFlipped = pt.xpx > chartWidth / 2;
						tooltipX = tooltipFlipped ? pt.xpx - 16 : pt.xpx + 16;
						tooltipY = pt.ypx;
						tooltipXLabel = pt.xaxis.title.text ?? prettyLabel(xField);
						tooltipXValue = pt.x != null ? pt.x.toFixed(3) : '—';
						tooltipEntries = yFields.map((field, i) => ({
							label: prettyLabel(field),
							value: pt.y != null ? pt.y.toFixed(3) : '—',
							color: SERIES_COLORS[i % SERIES_COLORS.length]
						}));
					}
				};
				const unhoverHandler = () => {
					tooltipVisible = false;
				};
				chartEl.addEventListener('plotly_hover', hoverHandler);
				chartEl.addEventListener('plotly_unhover', unhoverHandler);
				plotlyInstance._detachPlotlyTooltip = () => {
					chartEl.removeEventListener('plotly_hover', hoverHandler);
					chartEl.removeEventListener('plotly_unhover', unhoverHandler);
				};
			}

			renderChart();
			// Cleanup function for onMount
			return () => {
				if (plotlyInstance && plotlyInstance._detachPlotlyTooltip) {
					plotlyInstance._detachPlotlyTooltip();
					Plotly.purge(chartMount);
					plotlyInstance = null;
				}
				tooltipVisible = false;
			};
		})();
	});

	// Global time indicator pixel calculation (for overlay)
	// ---------------------------------------------------------------------------
	let timeIndicatorX = $state<number | null>(null);
	$effect(() => {
		if (!browser || !container || !plotlyInstance) {
			timeIndicatorX = null;
			return;
		}

		const chartWidth = container.clientWidth ?? 0;
		if (chartWidth <= 0) {
			timeIndicatorX = null;
			return;
		}

		// Use Plotly's axis extents for x
		let xMin = 0;
		let xMax = 1;
		const fullLayout = plotlyInstance._fullLayout;
		if (
			fullLayout &&
			fullLayout.xaxis &&
			typeof fullLayout.xaxis.range === 'object' &&
			fullLayout.xaxis.range.length === 2
		) {
			xMin = Number(fullLayout.xaxis.range[0]);
			xMax = Number(fullLayout.xaxis.range[1]);
		}

		const currentLine = $timeIndexStore.currentLine;
		let currentXValue: number | undefined = undefined;
		if (currentLine && typeof currentLine[xField] === 'number') {
			currentXValue = currentLine[xField];
		}

		if (typeof currentXValue !== 'number' || !isFinite(currentXValue)) {
			timeIndicatorX = null;
			return;
		}

		let px;
		if (currentXValue < xMin) {
			px = 0;
		} else if (currentXValue > xMax) {
			px = chartWidth - 1;
		} else {
			const frac = (currentXValue - xMin) / (xMax - xMin);
			px = Math.round(frac * chartWidth);
		}
		timeIndicatorX = Math.max(0, Math.min(px, chartWidth - 1));
	});

	// ---------------------------------------------------------------------------
	// ResizeObserver — drives ALL sizing (initial + subsequent resizes).
	// Observes the chart container div (below the controls bar).
	// ---------------------------------------------------------------------------
	$effect(() => {
		if (!browser || !container || !plotlyInstance) return;
		// Plotly must be loaded in browser/onMount
		const observer = new ResizeObserver(() => {
			if (!plotlyInstance) return;
			const { width, height } = plotSize();
			// Plotly instance returned from onMount	only
			if (typeof plotlyInstance.relayout === 'function') {
				plotlyInstance.relayout({ width, height });
			} else if (
				typeof window.Plotly !== 'undefined' &&
				typeof window.Plotly.relayout === 'function'
			) {
				window.Plotly.relayout(plotlyInstance, { width, height });
			}
		});
		observer.observe(container);
		return () => observer.disconnect();
	});

	// ---------------------------------------------------------------------------
	// Config persistence helper — called directly from user-interaction handlers
	// so that config is only propagated upward in response to explicit user
	// actions, never as a side-effect of receiving new props from the parent.
	// This avoids the effect_update_depth_exceeded reactive cycle that occurs
	// when an $effect calls onConfigChange → parent updates layout → parent
	// re-renders widget with new config prop → effect re-runs → repeat.
	// ---------------------------------------------------------------------------
	function notifyConfigChange() {
		onConfigChange?.({ xField, yFields: [...yFields], xDisplayMode });
	}
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

		<!-- Timestamp display mode toggle — only shown for time-based x fields -->
		{#if isTimeField(xField)}
			<label class="flex items-center gap-1 text-xs text-stone-600">
				<select
					bind:value={xDisplayMode}
					onchange={notifyConfigChange}
					class="rounded border border-stone-300 bg-white px-1 py-0.5 text-xs"
				>
					<option value="raw">Raw</option>
					<option value="relative">Relative</option>
					<option value="absolute">Absolute</option>
				</select>
			</label>
		{/if}

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

		<div class="ml-auto flex items-center gap-2">
			{#if $dataStore.telemetry.length > 0}
				<span class="text-xs text-stone-400"
					>{$dataStore.telemetry.length.toLocaleString()} pts</span
				>
				<button
					onclick={resetView}
					class="rounded border border-stone-300 bg-white px-1.5 py-0.5 text-xs text-stone-600 hover:bg-stone-50 active:bg-stone-100"
					title="Reset view (also double-click on chart)"
				>
					Reset view
				</button>
			{/if}
		</div>
	</div>

	<!-- uPlot mount point + tooltip overlay -->
	<div bind:this={container} class="relative min-h-0 flex-1 overflow-hidden">
		{#if $dataStore.telemetry.length === 0}
			<div class="flex h-full items-center justify-center text-sm text-stone-400">
				No data loaded — use a Load Data pane to import a file
			</div>
		{/if}

		<!-- uPlot renders here; absolutely fills container so it doesn't affect layout measurement -->
		<div bind:this={chartMount} class="absolute inset-0"></div>

		<!-- Global time indicator overlay -->
		<!--
		Global Time Indicator Overlay
		- Renders a vertical line at pixel position corresponding to global time index.
		- Shows pill overlay above line with formatted value.
		- Both line and pill are visible unless timeIndicatorX === null (uncomputable).
		- OOB values clamp indicator to chart edge (left/right).
		-->
		{#if timeIndicatorX !== null}
			<div
				class="pointer-events-none absolute top-0 h-full w-[2px] z-20 bg-fuchsia-500 opacity-70"
				style="left:{timeIndicatorX}px"
				aria-label="Global Time Indicator"
			></div>

			<!-- Pill overlay for indicator label -->
			<div
				class="pointer-events-none absolute z-30 px-2 py-0.5 rounded-full bg-fuchsia-200 text-fuchsia-700 text-xs font-medium shadow-md border border-fuchsia-400 select-none"
				style="left:{timeIndicatorX}px; top:8px; transform:translateX(-50%)"
				aria-label="Indicator Value Label"
			>
				{(() => {
					// Show value at current global index for selected xField; format for time-like, else show raw.
					const currentLine = $timeIndexStore.currentLine;
					const val =
						currentLine && typeof currentLine[xField] === 'number' ? currentLine[xField] : null;
					if (val == null || isNaN(val)) return '—';
					if (isTimeField(xField)) {
						if (xDisplayMode === 'absolute') {
							const epoch =
								currentLine && currentLine.unixtime ? currentLine.unixtime : new Date(0);
							return formatAbsolute(val, epoch, val);
						} else if (xDisplayMode === 'relative') {
							return formatRelative(val);
						} else {
							return val.toFixed(3);
						}
					} else {
						// Non-time field: show raw numeric value
						return val.toFixed(3);
					}
				})()}
			</div>
		{/if}

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
