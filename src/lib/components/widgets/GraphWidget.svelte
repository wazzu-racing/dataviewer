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

	// Helper: Compute time indicator shape for Plotly layout
	function getTimeIndicatorShape(
		x: NumericField,
		ys: NumericField[],
		currentLine: DataLine | undefined | null
	) {
		if (!currentLine) return null;
		if (isTimeField(x)) {
			const v = currentLine[x];
			if (typeof v === 'number' && isFinite(v)) {
				return {
					type: 'line',
					xref: 'x',
					yref: 'paper',
					x0: v,
					x1: v,
					y0: 0,
					y1: 1,
					line: {
						color: 'rgba(236, 72, 153, 0.85)',
						width: 2
					}
				};
			}
		} else if (Array.isArray(ys)) {
			const timeYField = ys.find(isTimeField);
			if (timeYField) {
				const v = currentLine[timeYField];
				if (typeof v === 'number' && isFinite(v)) {
					return {
						type: 'line',
						xref: 'paper',
						yref: 'y',
						x0: 0,
						x1: 1,
						y0: v,
						y1: v,
						line: {
							color: 'rgba(236, 72, 153, 0.85)',
							width: 2
						}
					};
				}
			}
		}
		return null;
	}

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
	// Margin zoom highlight state and axis margin pointer handlers
	let zoomMarginHover: 'left' | 'right' | 'bottom' | null = $state(null);

	function onPointerMoveMarginZoom(e: PointerEvent) {
		if (!e.shiftKey || !container) {
			zoomMarginHover = null;
			return;
		}
		const margin = 24;
		const rect = container.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;
		if (x < margin) {
			zoomMarginHover = 'left';
		} else if (y > rect.height - margin) {
			zoomMarginHover = 'bottom';
		} else if (yFields.length > 1 && x > rect.width - margin) {
			zoomMarginHover = 'right';
		} else {
			zoomMarginHover = null;
		}
	}

	function onPointerLeaveMarginZoom() {
		zoomMarginHover = null;
	}

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

	// ---------------------------------------------------------------------------
	// Build uPlot and attach interactions
	// ---------------------------------------------------------------------------
	let plotlyLib: any = $state(null);

	onMount(() => {
		if (!browser) return;
		(async () => {
			try {
				plotlyLib = (await import('plotly.js-dist-min')).default;
			} catch (e) {
				console.error('Plotly import failed:', e);
			}
		})();
	});

	$effect(() => {
		console.log(
			'[GraphWidget effect] browser:',
			browser,
			'plotlyLib:',
			plotlyLib,
			'chartMount:',
			chartMount,
			'telemetry:',
			$dataStore.telemetry.length,
			'x:',
			xField,
			'y:',
			yFields
		);
		if (!browser) return;
		if (!plotlyLib) return;
		if (!chartMount) return;
		if (!$dataStore.telemetry.length) return;

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

		const traces = sortedYs.map((ysArr, i) => {
			const axis = i === 0 ? 'y' : 'y2';
			return {
				x: sortedXs,
				y: ysArr,
				type: 'scattergl',
				mode: 'lines',
				name: prettyLabel(ys[i]),
				line: { color: SERIES_COLORS[i % SERIES_COLORS.length], width: 1.5 },
				hoverinfo: 'x+y+name',
				yaxis: axis
			};
		});

		const layout: any = {
			margin: { l: 40, r: 40, t: 16, b: 40 },
			legend: { orientation: 'h', y: -0.2 },
			xaxis: {
				title: prettyLabel(x),
				showgrid: true
			},
			yaxis: {
				title: prettyLabel(ys[0]),
				showgrid: true,
				color: SERIES_COLORS[0]
			},
			showlegend: false,
			dragmode: 'pan'
		};

		if (ys.length > 1) {
			layout.yaxis2 = {
				title: prettyLabel(ys.slice(1).join(', ')),
				showgrid: false,
				overlaying: 'y',
				side: 'right',
				color: SERIES_COLORS[1]
			};
		}

		// Initial render: set time indicator to current (safe, no future dependency on time)
		const indicatorShape = getTimeIndicatorShape(x, ys, undefined); // Don't depend on currentLine
		layout.shapes = indicatorShape ? [indicatorShape] : [];

		plotlyLib.react(chartMount, traces, layout, { responsive: true });
		plotlyInstance = chartMount;

		// Attach overlays/events after render (reuse logic as before)
		function attachTooltipEvents() {
			// ------------------------ CUSTOM WHEEL ZOOM HANDLER ------------------------
			// Implements pixel-perfect scroll-to-zoom for both axes and axis-specific zoom.
			// Behavior:
			//   - Normal wheel: zooms BOTH axes at the pointer.
			//   - Shift+wheel in margins:
			//       • Left Y margin: zooms only primary (left) Y axis.
			//       • Right Y margin (if 2+ yFields): zooms only secondary (right) Y axis.
			//       • Bottom margin: zooms only X axis (disables Y zoom).
			//   - Drag (pan) uses Plotly's internal dragmode (never handled here).
			//   - Margin zone = 24px from each edge. Axis/margin rules:
			//       1. If shift is NOT held: zoom both axes at cursor.
			//       2. If shift IS held:
			//           a. Left Y margin only: zoom only primary Y axis.
			//           b. Right Y margin only (and 2+ Y axes): zoom only secondary Y axis.
			//           c. Bottom margin only: zoom only X axis.
			//           d. If neither, do nothing (require clear margin intent).
			//   - Edge case: If only one Y axis, right margin has no effect.
			// Axis relayout handled via Plotly `relayout()` in margin-mode switches.
			// For full details, see hit-test logic and relayout sections below.
			// Clean-up logic removes wheel handler on widget/browser unmount.
			//
			// Maintainer quick test protocol (after changes):
			//   - Zoom/pan in all margin regions with/without secondary Y axes.
			//   - Confirm single-axis-only zoom in margins, dual axis zoom elsewhere.
			//   - Reset view restores full range; double-click resets as well.
			//
			// Safe for runes syntax, SSR, and full TS strict mode.
			$effect(() => {
				if (!browser || !chartMount || !plotlyInstance) return;

				// Disable Plotly's internal scroll-zoomer
				if (plotlyInstance._fullLayout) plotlyInstance._fullLayout.scrollZoom = false;

				const el = chartMount;
				// Returns [xMin, xMax, yMin, yMax] from Plotly layout
				function getCurrentRanges(): [number, number, number, number] {
					const layout = plotlyInstance._fullLayout;
					const arr = [
						layout?.xaxis?.range?.[0],
						layout?.xaxis?.range?.[1],
						layout?.yaxis?.range?.[0],
						layout?.yaxis?.range?.[1]
					].map(Number);
					if (arr.length !== 4 || arr.some((n) => !isFinite(n))) {
						return [0, 1, 0, 1];
					}
					return arr as [number, number, number, number];
				}

				/**
				 * Converts a pixel (x, y) coordinate to data values.
				 * By default does y for primary axis; pass yAxis = "y2" for secondary right axis.
				 */
				function pixelToData(
					x: number,
					y: number,
					yAxis: 'y' | 'y2' = 'y'
				): { xx: number; yy: number } {
					const layout = plotlyInstance._fullLayout;
					const w = el.clientWidth;
					const h = el.clientHeight;

					// Main axis ranges
					const [xMin, xMax, yMin, yMax] = getCurrentRanges();
					const left = layout.margin?.l ?? 40;
					const top = layout.margin?.t ?? 16;
					const right = w - (layout.margin?.r ?? 40);
					const bottom = h - (layout.margin?.b ?? 40);

					const px = Math.max(left, Math.min(x, right));
					const py = Math.max(top, Math.min(y, bottom));

					const xPct = (px - left) / (right - left);
					const xx = xMin + (xMax - xMin) * xPct;

					// Which Y axis? Overlayed axes must use their own range
					if (yAxis === 'y2' && layout.yaxis2 && layout.yaxis2.range) {
						const y2Min = Number(layout.yaxis2.range[0]);
						const y2Max = Number(layout.yaxis2.range[1]);
						// y2 overlays primary, so pixels are the same; just remap the range
						const yPct = 1 - (py - top) / (bottom - top);
						const yy = y2Min + (y2Max - y2Min) * yPct;
						return { xx, yy };
					} else {
						const yPct = 1 - (py - top) / (bottom - top);
						const yy = yMin + (yMax - yMin) * yPct;
						return { xx, yy };
					}
				}

				function wheelHandler(e: WheelEvent): void {
					if (!(plotlyInstance && plotlyInstance._fullLayout)) return;
					// Only act if ctrl/cmd are NOT held (browser zoom)
					if (e.ctrlKey || e.metaKey) return;
					e.preventDefault();
					let yMarginZoom: 'left' | 'right' | null = null;
					let useY2 = false;
					const [xMin, xMax, yMin, yMax] = getCurrentRanges();
					let zoomX = true,
						zoomY = true;
					const margin = 24; // px: margin region for axis-specific zoom

					if (e.shiftKey) {
						const layout = plotlyInstance._fullLayout;
						const rightMargin = el.clientWidth - (layout.margin?.r ?? 40);
						const hasRightY = ys.length > 1;
						if (e.offsetY > el.clientHeight - margin) zoomY = false; // in bottom margin
						if (e.offsetX < margin) {
							zoomX = false; // in left Y margin
							yMarginZoom = 'left';
						}
						if (hasRightY && e.offsetX > rightMargin) {
							zoomX = false; // in right Y margin (for yaxis2)
							yMarginZoom = 'right';
							useY2 = true;
						}
						// Now, if in *either* Y margin, only Y will zoom (zoomY = true, zoomX = false)
						if (!zoomX && !zoomY) return; // must hit margin for axis-specific zoom
						// If both are false (i.e., pointer is outside any axis margin), do nothing
					}

					const { xx, yy } = useY2
						? pixelToData(e.offsetX, e.offsetY, 'y2')
						: pixelToData(e.offsetX, e.offsetY, 'y');

					const dz = Math.sign(e.deltaY) * 0.1; // 10% per notch
					const minSpan = 1e-12;
					let nx0 = xMin,
						nx1 = xMax,
						ny0 = yMin,
						ny1 = yMax;
					if (zoomX) {
						const x0 = xx - (xx - xMin) * (1 + dz);
						const x1 = xx + (xMax - xx) * (1 + dz);
						if (isFinite(x0) && isFinite(x1) && Math.abs(x1 - x0) > minSpan) {
							nx0 = x0;
							nx1 = x1;
						}
					}
					if (zoomY) {
						// For y2, use y2 range; otherwise normal
						if (useY2 && plotlyInstance._fullLayout.yaxis2) {
							const y2Min = Number(plotlyInstance._fullLayout.yaxis2.range[0]);
							const y2Max = Number(plotlyInstance._fullLayout.yaxis2.range[1]);
							const y0 = yy - (yy - y2Min) * (1 + dz);
							const y1 = yy + (y2Max - yy) * (1 + dz);
							if (isFinite(y0) && isFinite(y1) && Math.abs(y1 - y0) > minSpan) {
								ny0 = y0;
								ny1 = y1;
							}
						} else {
							const y0 = yy - (yy - yMin) * (1 + dz);
							const y1 = yy + (yMax - yy) * (1 + dz);
							if (isFinite(y0) && isFinite(y1) && Math.abs(y1 - y0) > minSpan) {
								ny0 = y0;
								ny1 = y1;
							}
						}
					}

					if (yMarginZoom === 'left') {
						plotlyLib.relayout(plotlyInstance, {
							'yaxis.range': [ny0, ny1]
						});
					} else if (yMarginZoom === 'right') {
						plotlyLib.relayout(plotlyInstance, {
							'yaxis2.range': [ny0, ny1]
						});
					} else {
						plotlyLib.relayout(plotlyInstance, {
							'xaxis.range': [nx0, nx1],
							'yaxis.range': [ny0, ny1]
						});
					}
					// END of wheelHandler
					// (Redundant relayouts removed in accordance with code review)
					// Only a single relayout per wheel event is necessary.
				}

				el.addEventListener('wheel', wheelHandler, { passive: false });
				return () => {
					el.removeEventListener('wheel', wheelHandler);
				};
			});

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

		attachTooltipEvents();
	});

	// Global time indicator now handled as a Plotly shape (see layout.shapes logic)

	// EFFECT: Move indicator only on time change (no layout/pan reset)
	// EFFECT: Only update indicator when time or axes change (never full redraw)
	$effect(() => {
		if (!browser || !plotlyLib || !plotlyInstance) return;
		const indicatorShape = getTimeIndicatorShape(xField, yFields, $timeIndexStore.currentLine);
		// Only the shapes array is updated; this preserves all zoom/pan state
		plotlyLib.relayout(plotlyInstance, {
			shapes: indicatorShape ? [indicatorShape] : []
		});
	});

	// Main chart render (never depend on currentLine!
	// Only depend on data, axes, config, resize, or mount)
	// (No code change here, just doc to clarify responsibilities)

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
				<span class="text-xs text-stone-400">
					{$dataStore.telemetry.length.toLocaleString()} pts
				</span>
			{/if}
		</div>
	</div>

	<!-- uPlot mount point + tooltip overlay -->
	<div
		bind:this={container}
		class="relative min-h-0 flex-1 overflow-hidden"
		onpointermove={onPointerMoveMarginZoom}
		onpointerleave={onPointerLeaveMarginZoom}
	>
		{#if $dataStore.telemetry.length === 0}
			<div class="flex h-full items-center justify-center text-sm text-stone-400">
				No data loaded — use a Load Data pane to import a file
			</div>
		{/if}

		<!-- uPlot renders here; absolutely fills container so it doesn't affect layout measurement -->
		<div bind:this={chartMount} class="absolute inset-0"></div>
		{#if zoomMarginHover === 'left'}
			<div
				class="pointer-events-none absolute left-0 top-0 h-full z-30"
				style="width:24px; background:rgba(59,130,246,0.11); border-radius:6px 0 0 6px;"
				aria-hidden="true"
			></div>
		{/if}
		{#if zoomMarginHover === 'right' && yFields.length > 1}
			<div
				class="pointer-events-none absolute right-0 top-0 h-full z-30"
				style="width:24px; background:rgba(236,72,153,0.10); border-radius:0 6px 6px 0;"
				aria-hidden="true"
			></div>
		{/if}
		{#if zoomMarginHover === 'bottom'}
			<div
				class="pointer-events-none absolute left-0 bottom-0 w-full z-30"
				style="height:24px; background:rgba(16,185,129,0.07); border-radius:0 0 6px 6px;"
				aria-hidden="true"
			></div>
		{/if}

		<!-- (Removed: Global time indicator overlay) Now integrated as Plotly shape that pans/zooms with data. -->

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
