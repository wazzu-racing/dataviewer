<script lang="ts">
	import { data as globalData } from '$lib/data.svelte';
	import type { DataLine, GraphConfig, XDisplayMode } from '$lib/types';
	import { browser } from '$app/environment';
	import { untrack } from 'svelte'; // still used by the xDisplayMode reset effect below
	import 'uplot/dist/uPlot.min.css';
	import { isTimeField, formatRelative, formatAbsolute } from '$lib/timeFormat';

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
	function getYRange(u: any, scaleKey: string): [number, number] {
		const s = u.scales[scaleKey];
		if (s && isFinite(s.min) && isFinite(s.max)) return [s.min as number, s.max as number];
		// Fallback: compute from series data
		const seriesIdx = (u.series as { scale?: string }[]).findIndex((sr) => sr.scale === scaleKey);
		if (seriesIdx > 0) {
			const yData = (u.data[seriesIdx] as number[]).filter(isFinite);
			if (yData.length > 0)
				return yData.reduce(
					([lo, hi], v) => [v < lo ? v : lo, v > hi ? v : hi],
					[yData[0], yData[0]]
				);
		}
		return [0, 1];
	}

	function detectAxisZone(
		clientX: number,
		clientY: number,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		u: any,
		wrap: HTMLElement
	): 'x' | `y${number}` | 'plot' {
		const over = wrap.querySelector('.u-over') as HTMLElement | null;
		if (over) {
			const r = over.getBoundingClientRect();
			if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom)
				return 'plot';
		}
		const axisEls = wrap.querySelectorAll('.u-axis');
		for (let i = 0; i < axisEls.length; i++) {
			const r = axisEls[i].getBoundingClientRect();
			if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) {
				// u.axes[0] is the x-axis, u.axes[1..n] are y0, y1, ...
				const scale = (u.axes as { scale?: string }[])[i]?.scale ?? 'x';
				return scale as 'x' | `y${number}`;
			}
		}
		return 'plot';
	}

	function attachWheelZoom(
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		u: any,
		wrap: HTMLElement,
		manualYRanges: Map<string, [number, number]>
	) {
		function onWheel(e: WheelEvent) {
			e.preventDefault();
			const factor = e.deltaY > 0 ? 1.15 : 1 / 1.15;

			// Use the inner plot overlay rect as the reference for cursor-pivot fractions.
			const over = wrap.querySelector('.u-over') as HTMLElement | null;
			const overRect = over?.getBoundingClientRect() ?? wrap.getBoundingClientRect();

			// Horizontal fraction (0 = left edge, 1 = right edge)
			const xFrac = Math.max(0, Math.min(1, (e.clientX - overRect.left) / overRect.width));
			// Vertical fraction (0 = bottom, 1 = top) — matches data coordinates direction
			const yFrac = 1 - Math.max(0, Math.min(1, (e.clientY - overRect.top) / overRect.height));

			const zone = e.shiftKey ? detectAxisZone(e.clientX, e.clientY, u, wrap) : 'plot';

			const zoomX = zone === 'plot' || zone === 'x';
			const zoomY = zone === 'plot';
			const zoomSpecificY = zone !== 'plot' && zone !== 'x' ? zone : null;

			if (zoomX) {
				const [min, max] = getXRange(u);
				const span = max - min;
				const pivot = min + xFrac * span;
				u.setScale('x', {
					min: pivot - xFrac * span * factor,
					max: pivot + (1 - xFrac) * span * factor
				});
			}

			if (zoomY) {
				// Zoom all y-scales
				const yScaleKeys = Object.keys(u.scales as Record<string, unknown>).filter((k) =>
					k.startsWith('y')
				);
				for (const key of yScaleKeys) {
					const [yMin, yMax] = getYRange(u, key);
					const ySpan = yMax - yMin;
					const pivot = yMin + yFrac * ySpan;
					const newMin = pivot - yFrac * ySpan * factor;
					const newMax = pivot + (1 - yFrac) * ySpan * factor;
					manualYRanges.set(key, [newMin, newMax]);
					u.setScale(key, { min: newMin, max: newMax });
				}
			} else if (zoomSpecificY) {
				const [yMin, yMax] = getYRange(u, zoomSpecificY);
				const ySpan = yMax - yMin;
				const pivot = yMin + yFrac * ySpan;
				const newMin = pivot - yFrac * ySpan * factor;
				const newMax = pivot + (1 - yFrac) * ySpan * factor;
				manualYRanges.set(zoomSpecificY, [newMin, newMax]);
				u.setScale(zoomSpecificY, { min: newMin, max: newMax });
			}
		}
		wrap.addEventListener('wheel', onWheel, { passive: false });
		return () => wrap.removeEventListener('wheel', onWheel);
	}

	function attachPan(
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		u: any,
		el: HTMLElement,
		manualYRanges: Map<string, [number, number]>
	) {
		let dragging = false;
		let startX = 0;
		let startY = 0;
		let startMin = 0;
		let startMax = 0;
		// Snapshot of all y-scale ranges at drag start, keyed by scale name
		let startYRanges = new Map<string, [number, number]>();

		function onMouseDown(e: MouseEvent) {
			// Only left button
			if (e.button !== 0) return;
			dragging = true;
			startX = e.clientX;
			startY = e.clientY;
			[startMin, startMax] = getXRange(u);
			startYRanges = new Map(
				Object.keys(u.scales as Record<string, unknown>)
					.filter((k) => k.startsWith('y'))
					.map((k) => [k, getYRange(u, k)] as [string, [number, number]])
			);
		}

		function onMouseMove(e: MouseEvent) {
			if (!dragging) return;
			const rect = el.getBoundingClientRect();

			// Pan x
			const xSpan = startMax - startMin;
			const pxWidth = rect.width;
			if (pxWidth > 0) {
				const dx = e.clientX - startX;
				const dValX = (dx / pxWidth) * xSpan;
				u.setScale('x', { min: startMin - dValX, max: startMax - dValX });
			}

			// Pan y — only when at least one y-scale had a manual range at drag start
			if (startYRanges.size > 0) {
				const pxHeight = rect.height;
				if (pxHeight > 0) {
					const dy = e.clientY - startY;
					for (const [key, [yMin, yMax]] of startYRanges) {
						const ySpan = yMax - yMin;
						// dy > 0 means cursor moved down → data shifts up → increase min/max
						const dValY = (dy / pxHeight) * ySpan;
						const newMin = yMin + dValY;
						const newMax = yMax + dValY;
						manualYRanges.set(key, [newMin, newMax]);
						u.setScale(key, { min: newMin, max: newMax });
					}
				}
			}
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

	// Double-click on the plot area resets all manual y-zoom, restoring auto-fit.
	// Suppressed when the double-click is the tail end of a drag (displacement > 4px).
	function attachDoubleClickReset(
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		u: any,
		el: HTMLElement,
		manualYRanges: Map<string, [number, number]>
	) {
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
			manualYRanges.clear();
			u.redraw();
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
	$effect(() => {
		if (!browser || !container) return;

		// Track reactive dependencies
		const lines = globalData.lines;
		const x = xField;
		const ys = yFields;
		const displayMode = xDisplayMode;

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

			const { data: chartData, epochDate, firstMs } = buildData(lines, x, ys);

			// Helper: format an x value for the current display mode
			const formatXValue = (val: number): string => {
				if (displayMode === 'relative') return formatRelative(val - firstMs);
				if (displayMode === 'absolute') return formatAbsolute(val, epochDate, firstMs);
				return val.toFixed(3);
			};

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

			// Independent scale per Y series.
			// manualYRanges holds user-set y-zoom ranges keyed by scale name.
			// When populated, the range function returns the locked bounds instead of
			// letting uPlot auto-fit, which prevents panning the x-axis from resetting
			// a y-zoom the user has already applied.
			const manualYRanges = new Map<string, [number, number]>();
			const scales: Record<string, uPlot.Scale> = { x: { time: false } };
			for (let i = 0; i < ys.length; i++) {
				const key = `y${i}`;
				scales[key] = {
					// range is called by uPlot whenever it needs to (re)compute the visible
					// y bounds. Returning null falls back to uPlot's built-in auto-fit.
					range: (_u, dataMin, dataMax) => {
						const manual = manualYRanges.get(key);
						if (manual) return manual;
						// Auto-fit: give a small 5% padding so the line isn't flush with
						// the axis edges, matching uPlot's default auto behaviour.
						const pad = (dataMax - dataMin) * 0.05 || 1;
						return [dataMin - pad, dataMax + pad];
					}
				};
			}

			// Show at most 2 Y axes (left + right) to avoid clutter
			const xAxis: uPlot.Axis = { label: prettyLabel(x) };
			if (displayMode !== 'raw') {
				// Custom tick-label formatter for time display modes.
				// uPlot calls values(u, splits, axisIdx, foundSpace, foundIncr) → (string | number | null)[]
				// splits may contain null for suppressed ticks — return "" for those.
				xAxis.values = (_u, splits) =>
					splits.map((t) => {
						if (t == null) return '';
						if (displayMode === 'relative') return formatRelative(t - firstMs);
						return formatAbsolute(t, epochDate, firstMs);
					});
			}
			const axes: uPlot.Axis[] = [xAxis];
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
							tooltipXValue = xVal != null ? formatXValue(xVal) : '—';

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

			uplotInstance = new uPlot(opts, chartData, chartMount!);

			// Defer size correction to the next animation frame so the flexbox
			// layout has been computed and clientWidth/clientHeight are non-zero.
			requestAnimationFrame(() => {
				if (cancelled || !uplotInstance) return;
				const { width, height } = plotSize();
				uplotInstance.setSize({ width, height });
			});

			// Attach wheel zoom to the whole uPlot wrapper (so axis gutters are included),
			// and pan to the inner overlay only (pan is scoped to the plot area).
			const wrapEl = container!.querySelector('.u-wrap') as HTMLElement | null;
			const overEl = container!.querySelector('.u-over') as HTMLElement | null;
			if (wrapEl && overEl) {
				const detachWheel = attachWheelZoom(uplotInstance, wrapEl, manualYRanges);
				const detachPan = attachPan(uplotInstance, overEl, manualYRanges);
				const detachDblClick = attachDoubleClickReset(uplotInstance, overEl, manualYRanges);
				// Stash cleanup on the instance for teardown
				uplotInstance._detachInteractions = () => {
					detachWheel();
					detachPan();
					detachDblClick();
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
