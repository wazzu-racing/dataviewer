<script lang="ts">
	import { dataStore } from '$lib/stores/dataStore';
	import { timeIndexStore } from '$lib/stores/time';
	import {
		type DataLine,
		type GraphConfig,
		type XDisplayMode,
		type Graph3DMode,
		type Graph2DMode,
		NUMERIC_FIELDS,
		type NumericField
	} from '$lib/types';
	import { browser, dev } from '$app/environment';
	import { untrack, onMount } from 'svelte'; // onMount is used for browser-only Plotly integration
	// Plotly import moved to browser-only lifecycle below
	import { isTimeField, formatRelative, formatAbsolute } from '$lib/timeFormat';
	import {
		formatFieldValue,
		getFieldLabel,
		getFieldLabelWithUnit,
		unitSuffix
	} from '$lib/fieldMetadata';

	// Helper: Compute 3D time indicator plane data for restyle
	function get3DIndicatorRestyleData(
		x: NumericField,
		ys: NumericField[],
		zs: NumericField[],
		currentLine: DataLine | undefined | null
	) {
		if (!currentLine) return null;

		let timeAxis: 'x' | 'y' | 'z' | null = null;
		let timeVal = 0;

		if (isTimeField(x)) {
			timeAxis = 'x';
			timeVal = currentLine[x] as number;
		} else {
			const yTime = ys.find(isTimeField);
			if (yTime) {
				timeAxis = 'y';
				timeVal = currentLine[yTime] as number;
			} else {
				const zTime = zs.find(isTimeField);
				if (zTime) {
					timeAxis = 'z';
					timeVal = currentLine[zTime] as number;
				}
			}
		}

		if (!timeAxis || !isFinite(timeVal)) return null;

		// We use the last calculated ranges to avoid re-scanning the telemetry on every frame
		// Plotly traces usually store their min/max or we can grab them from the layout
		if (!plotlyInstance || !plotlyInstance._fullLayout || !plotlyInstance._fullLayout.scene) {
			return null;
		}

		const scene = plotlyInstance._fullLayout.scene;
		const xr = scene.xaxis.range;
		const yr = scene.yaxis.range;
		const zr = scene.zaxis.range;

		if (timeAxis === 'x') {
			return {
				x: [[timeVal, timeVal, timeVal, timeVal]],
				y: [[yr[0], yr[1], yr[1], yr[0]]],
				z: [[zr[0], zr[0], zr[1], zr[1]]]
			};
		} else if (timeAxis === 'y') {
			return {
				x: [[xr[0], xr[1], xr[1], xr[0]]],
				y: [[timeVal, timeVal, timeVal, timeVal]],
				z: [[zr[0], zr[0], zr[1], zr[1]]]
			};
		} else if (timeAxis === 'z') {
			return {
				x: [[xr[0], xr[1], xr[1], xr[0]]],
				y: [[yr[0], yr[0], yr[1], yr[1]]],
				z: [[timeVal, timeVal, timeVal, timeVal]]
			};
		}
		return null;
	}

	// Helper: Compute 3D time indicator plane
	function get3DTimeIndicator(
		x: NumericField,
		ys: NumericField[],
		zs: NumericField[],
		currentLine: DataLine | undefined | null
	) {
		if (!currentLine) return null;

		// Check which axis is the time field
		let timeAxis: 'x' | 'y' | 'z' | null = null;
		let timeVal = 0;

		if (isTimeField(x)) {
			timeAxis = 'x';
			timeVal = currentLine[x] as number;
		} else {
			const yTime = ys.find(isTimeField);
			if (yTime) {
				timeAxis = 'y';
				timeVal = currentLine[yTime] as number;
			} else {
				const zTime = zs.find(isTimeField);
				if (zTime) {
					timeAxis = 'z';
					timeVal = currentLine[zTime] as number;
				}
			}
		}

		if (!timeAxis || !isFinite(timeVal)) return null;

		// We'll use a mesh3d or surface to create a plane.
		// For a plane perpendicular to an axis, we need the ranges of the other two axes.
		// Since we don't easily have the current view ranges here without layout,
		// we'll rely on Plotly to scale it if we provide large enough bounds or
		// better, we can use the data bounds.
		const lines = $dataStore.telemetry;
		if (lines.length === 0) return null;

		const getRange = (field: NumericField | NumericField[]) => {
			const fields = Array.isArray(field) ? field : [field];
			let min = Infinity;
			let max = -Infinity;
			for (const line of lines) {
				for (const f of fields) {
					const v = line[f] as number;
					if (isFinite(v)) {
						if (v < min) min = v;
						if (v > max) max = v;
					}
				}
			}
			return [min, max];
		};

		const xRange = getRange(x);
		const yRange = getRange(ys);
		const zRange = getRange(zs);

		// Create a rectangular plane trace
		// We use 4 points to define a plane
		let planeTrace: any = {
			type: 'mesh3d',
			opacity: 0.2,
			color: 'rgba(236, 72, 153, 0.5)',
			hoverinfo: 'skip',
			showlegend: false,
			name: 'Time Indicator'
		};

		if (timeAxis === 'x') {
			planeTrace.x = [timeVal, timeVal, timeVal, timeVal];
			planeTrace.y = [yRange[0], yRange[1], yRange[1], yRange[0]];
			planeTrace.z = [zRange[0], zRange[0], zRange[1], zRange[1]];
			planeTrace.i = [0, 0];
			planeTrace.j = [1, 2];
			planeTrace.k = [2, 3];
		} else if (timeAxis === 'y') {
			planeTrace.x = [xRange[0], xRange[1], xRange[1], xRange[0]];
			planeTrace.y = [timeVal, timeVal, timeVal, timeVal];
			planeTrace.z = [zRange[0], zRange[0], zRange[1], zRange[1]];
			planeTrace.i = [0, 0];
			planeTrace.j = [1, 2];
			planeTrace.k = [2, 3];
		} else if (timeAxis === 'z') {
			planeTrace.x = [xRange[0], xRange[1], xRange[1], xRange[0]];
			planeTrace.y = [yRange[0], yRange[0], yRange[1], yRange[1]];
			planeTrace.z = [timeVal, timeVal, timeVal, timeVal];
			planeTrace.i = [0, 0];
			planeTrace.j = [1, 2];
			planeTrace.k = [2, 3];
		}

		return planeTrace;
	}

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
	// Wazzu theme series, a60f2d is primary accent
	const SERIES_COLORS = [
		'#a60f2d', // primary accent
		'#f97316', // orange
		'#3b82f6', // blue
		'#22c55e', // green
		'#ef4444', // red
		'#a855f7', // purple
		'#eab308', // yellow
		'#06b6d4' // cyan
	];

	function label(field: NumericField): string {
		return getFieldLabel(field);
	}

	function labelWithUnit(field: NumericField): string {
		return getFieldLabelWithUnit(field);
	}

	function hoverLine(field: NumericField, axisKey: 'x' | 'y' | 'z'): string {
		return `<b>${label(field)}</b>: %{${axisKey}:.3f}${unitSuffix(field)}<br>`;
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
	const _seedIs3D: boolean = untrack(() => _cfg?.is3D ?? false);
	const _seedZ: NumericField[] = untrack(() =>
		(_cfg?.zFields as NumericField[] | undefined)?.length
			? (_cfg!.zFields as NumericField[])
			: ['rpm']
	);
	const _seedMode3D: Graph3DMode = untrack(() => _cfg?.mode3D ?? '3d-scatter');
	const _seedMode2D: Graph2DMode = untrack(() => _cfg?.mode2D ?? 'line');

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
	let is3D: boolean = $state(_seedIs3D);
	let zFields: NumericField[] = $state([..._seedZ]);
	let mode3D: Graph3DMode = $state(_seedMode3D);
	let mode2D: Graph2DMode = $state(_seedMode2D);

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
	let zDropdownOpen = $state(false);

	function handleWindowClick(event: MouseEvent) {
		if (!yDropdownOpen && !zDropdownOpen) {
			return;
		}

		const target = event.target as HTMLElement | null;
		if (!target?.closest('.graph-series-dropdown')) {
			yDropdownOpen = false;
			zDropdownOpen = false;
		}
	}

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

	function toggleZField(field: NumericField) {
		if (zFields.includes(field)) {
			// Don't remove the last field
			if (zFields.length > 1) {
				zFields = zFields.filter((f) => f !== field);
				notifyConfigChange();
			}
		} else {
			zFields = [...zFields, field];
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
	let renderedSeries = $state<Record<NumericField, number[]>>({} as Record<NumericField, number[]>);

	// ---------------------------------------------------------------------------
	// Plotly refs
	// ---------------------------------------------------------------------------
	let container: HTMLDivElement | undefined = $state(); // chart-area div (below controls bar)
	let chartMount: HTMLDivElement | undefined = $state(); // Plotly chart mount
	let plotlyInstance: any = $state(null); // Plotly chart reference
	let wheelFramePending = false;

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
	type SortedSeries2D = {
		xs: number[];
		ys: number[][];
	};

	function decimate2DSeries(
		sortedXs: number[],
		sortedYs: number[][],
		maxPoints: number
	): SortedSeries2D {
		if (sortedXs.length <= maxPoints || maxPoints < 3) {
			return { xs: sortedXs, ys: sortedYs };
		}

		const stride = Math.ceil(sortedXs.length / maxPoints);
		const sampledIndices: number[] = [0];

		for (let i = stride; i < sortedXs.length - 1; i += stride) {
			sampledIndices.push(i);
		}

		if (sampledIndices[sampledIndices.length - 1] !== sortedXs.length - 1) {
			sampledIndices.push(sortedXs.length - 1);
		}

		return {
			xs: sampledIndices.map((index) => sortedXs[index]),
			ys: sortedYs.map((series) => sampledIndices.map((index) => series[index]))
		};
	}

	/**
	 * Builds a surface plot trace by binning 1D telemetry data into a 2D grid.
	 * For racing telemetry (time-series data), we bin by X and Y ranges.
	 *
	 * @param lines - telemetry data
	 * @param xField - field for X axis
	 * @param yField - field for Y axis
	 * @param zField - field for Z axis (the "height" of the surface)
	 * @param xBins - number of bins along X axis (default: 30)
	 * @param yBins - number of bins along Y axis (default: 30)
	 * @returns Plotly surface trace object
	 */
	function buildSurfaceTrace(
		lines: DataLine[],
		xField: NumericField,
		yField: NumericField,
		zField: NumericField,
		xBins: number = 30,
		yBins: number = 30
	): any {
		// Extract data
		const xVals: number[] = [];
		const yVals: number[] = [];
		const zVals: number[] = [];

		for (const line of lines) {
			const x = line[xField] as number;
			const y = line[yField] as number;
			const z = line[zField] as number;
			if (isFinite(x) && isFinite(y) && isFinite(z)) {
				xVals.push(x);
				yVals.push(y);
				zVals.push(z);
			}
		}

		if (xVals.length === 0) {
			// No valid data - return empty surface
			return {
				type: 'surface',
				x: [],
				y: [],
				z: [],
				colorscale: 'Viridis',
				showscale: true
			};
		}

		// Find ranges
		const xMin = Math.min(...xVals);
		const xMax = Math.max(...xVals);
		const yMin = Math.min(...yVals);
		const yMax = Math.max(...yVals);

		// Create bins
		const xStep = (xMax - xMin) / xBins;
		const yStep = (yMax - yMin) / yBins;

		// Initialize grid
		const zGrid: number[][] = Array.from({ length: yBins }, () => Array(xBins).fill(0));
		const counts: number[][] = Array.from({ length: yBins }, () => Array(xBins).fill(0));

		// Bin the data (average Z values in each bin)
		for (let i = 0; i < xVals.length; i++) {
			const xIdx = Math.min(Math.floor((xVals[i] - xMin) / xStep), xBins - 1);
			const yIdx = Math.min(Math.floor((yVals[i] - yMin) / yStep), yBins - 1);
			if (xIdx >= 0 && xIdx < xBins && yIdx >= 0 && yIdx < yBins) {
				zGrid[yIdx][xIdx] += zVals[i];
				counts[yIdx][xIdx]++;
			}
		}

		// Average the bins
		for (let yi = 0; yi < yBins; yi++) {
			for (let xi = 0; xi < xBins; xi++) {
				if (counts[yi][xi] > 0) {
					zGrid[yi][xi] /= counts[yi][xi];
				} else {
					// No data in this bin - use NaN so Plotly doesn't render it
					zGrid[yi][xi] = NaN;
				}
			}
		}

		// Create axis arrays
		const xAxis = Array.from({ length: xBins }, (_, i) => xMin + (i + 0.5) * xStep);
		const yAxis = Array.from({ length: yBins }, (_, i) => yMin + (i + 0.5) * yStep);

		return {
			type: 'surface',
			x: xAxis,
			y: yAxis,
			z: zGrid,
			colorscale: 'Viridis',
			showscale: true,
			colorbar: {
				title: { text: labelWithUnit(zField), side: 'right' },
				thickness: 15,
				len: 0.7
			},
			hovertemplate: `${hoverLine(xField, 'x')}${hoverLine(yField, 'y')}${hoverLine(zField, 'z')}<extra></extra>`
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

	// Track dark mode state reactively
	let isDarkMode = $state(false);

	$effect(() => {
		if (!browser) return;

		const readTheme = () => document.documentElement.classList.contains('dark');
		const updateTheme = (detail?: 'light' | 'dark') => {
			isDarkMode = detail ? detail === 'dark' : readTheme();
		};

		updateTheme();

		const handleThemeEvent = (event: Event) => {
			const detail = (event as CustomEvent<'light' | 'dark'>).detail;
			updateTheme(detail);
		};

		window.addEventListener('themechange', handleThemeEvent as EventListener);

		return () => {
			window.removeEventListener('themechange', handleThemeEvent as EventListener);
		};
	});

	$effect(() => {
		const darkMode = isDarkMode;

		if (dev) {
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
				yFields,
				'z:',
				zFields,
				'is3D:',
				is3D,
				'mode3D:',
				mode3D,
				'darkMode:',
				darkMode
			);
		}
		if (!browser) return;
		if (!plotlyLib) return;
		if (!chartMount) return;
		if (!$dataStore.telemetry.length) return;

		// Detect Tailwind dark mode from html classList.

		const lines = $dataStore.telemetry;
		const x = xField;
		const ys = yFields;
		const zs = zFields;
		const mode = mode3D;

		// Branch: 2D vs 3D rendering
		if (is3D) {
			renderedSeries = {} as Record<NumericField, number[]>;
			// ============ 3D RENDERING PATH ============
			// Optimization: Use decimated data for 3D plots if dataset is large
			const MAX_3D_POINTS = 5000;
			const step = Math.max(1, Math.floor(lines.length / MAX_3D_POINTS));

			const xs: number[] = [];
			const yArrays: number[][] = ys.map(() => []);
			const zArrays: number[][] = zs.map(() => []);

			for (let i = 0; i < lines.length; i += step) {
				const line = lines[i];
				xs.push(line[x] as number);
				for (let j = 0; j < ys.length; j++) {
					yArrays[j].push(line[ys[j]] as number);
				}
				for (let j = 0; j < zs.length; j++) {
					zArrays[j].push(line[zs[j]] as number);
				}
			}

			// Sort by X for consistent rendering
			const order = Array.from({ length: xs.length }, (_, i) => i).sort((a, b) => xs[a] - xs[b]);
			const sortedXs = order.map((i) => xs[i]);
			const sortedYs = yArrays.map((arr) => order.map((i) => arr[i]));
			const sortedZs = zArrays.map((arr) => order.map((i) => arr[i]));

			// Build 3D traces
			const traces: any[] = [];

			if (mode === '3d-scatter') {
				// Scatter3d traces: one trace per (Y, Z) pair
				// For simplicity, pair each Y with each Z (creates Y×Z traces)
				for (let yi = 0; yi < ys.length; yi++) {
					for (let zi = 0; zi < zs.length; zi++) {
						const colorIdx = (yi * zs.length + zi) % SERIES_COLORS.length;
						traces.push({
							x: sortedXs,
							y: sortedYs[yi],
							z: sortedZs[zi],
							type: 'scatter3d',
							mode: 'lines',
							name: `${labelWithUnit(ys[yi])} vs ${labelWithUnit(zs[zi])}`,
							line: {
								color: SERIES_COLORS[colorIdx],
								width: 3
							},
							hovertemplate: `${hoverLine(x, 'x')}${hoverLine(ys[yi], 'y')}${hoverLine(zs[zi], 'z')}<extra></extra>`
						});
					}
				}
			} else if (mode === '3d-surface') {
				// Surface mode: create a surface for each Y×Z combination
				// Surface plots show how Z varies across the X-Y plane
				for (let yi = 0; yi < ys.length; yi++) {
					for (let zi = 0; zi < zs.length; zi++) {
						const surfaceTrace = buildSurfaceTrace(lines, x, ys[yi], zs[zi]);
						// Customize colorscale per trace
						const colorIdx = (yi * zs.length + zi) % SERIES_COLORS.length;
						surfaceTrace.name = `${labelWithUnit(ys[yi])} × ${labelWithUnit(zs[zi])}`;
						surfaceTrace.colorscale = [
							[0, '#0c4a6e'], // dark blue
							[0.25, '#3b82f6'], // blue
							[0.5, '#22c55e'], // green
							[0.75, '#eab308'], // yellow
							[1, '#ef4444'] // red
						];
						traces.push(surfaceTrace);
					}
				}
			}

			// Add 3D time indicator plane if any axis is time-based
			const indicator3D = get3DTimeIndicator(x, ys, zs, $timeIndexStore.currentLine);
			if (indicator3D) {
				traces.push(indicator3D);
			}

			// 3D layout
			const layout3D: any = {
				margin: { l: 0, r: 0, t: 16, b: 0 },
				uirevision: `3d:${x}:${ys.join(',')}:${zs.join(',')}:${mode}`,
				scene: {
					xaxis: {
						title: { text: labelWithUnit(x), font: { color: darkMode ? '#f4f4f5' : '#27272a' } },
						showgrid: true,
						gridcolor: darkMode ? '#23272f' : '#e5e7eb',
						color: darkMode ? '#f4f4f5' : '#27272a',
						backgroundcolor: darkMode ? '#18181b' : '#fff'
					},
					yaxis: {
						title: {
							text: ys.length === 1 ? labelWithUnit(ys[0]) : 'Y Series (mixed units)',
							font: { color: darkMode ? '#f4f4f5' : '#27272a' }
						},
						showgrid: true,
						gridcolor: darkMode ? '#23272f' : '#e5e7eb',
						color: darkMode ? '#f4f4f5' : '#27272a',
						backgroundcolor: darkMode ? '#18181b' : '#fff'
					},
					zaxis: {
						title: {
							text: zs.length === 1 ? labelWithUnit(zs[0]) : 'Z Series (mixed units)',
							font: { color: darkMode ? '#f4f4f5' : '#27272a' }
						},
						showgrid: true,
						gridcolor: darkMode ? '#23272f' : '#e5e7eb',
						color: darkMode ? '#f4f4f5' : '#27272a',
						backgroundcolor: darkMode ? '#18181b' : '#fff'
					},
					bgcolor: darkMode ? '#18181b' : '#fff',
					camera: {
						eye: { x: 1.5, y: 1.5, z: 1.5 }
					}
				},
				paper_bgcolor: darkMode ? '#18181b' : '#fff',
				font: {
					family: 'Inter, ui-sans-serif, system-ui, sans-serif',
					color: darkMode ? '#f4f4f5' : '#18181b',
					size: 13
				},
				showlegend: traces.length > 1,
				legend: {
					orientation: 'v',
					x: 1.05,
					y: 1,
					font: { color: darkMode ? '#f4f4f5' : '#18181b', size: 11 },
					bgcolor: 'rgba(0,0,0,0)',
					borderwidth: 0
				},
				hoverlabel: {
					bgcolor: darkMode ? '#23272f' : '#fff',
					bordercolor: darkMode ? '#a60f2d' : '#bababa',
					font: { color: darkMode ? '#f4f4f5' : '#18181b' }
				},
				modebar: {
					bgcolor: darkMode ? '#18181b' : '#fff',
					color: darkMode ? '#f4f4f5' : '#18181b',
					activecolor: darkMode ? '#a60f2d' : '#f47521'
				}
			};

			plotlyLib.react(chartMount, traces, layout3D, { responsive: true });
			plotlyInstance = chartMount;

			// No custom wheel handler in 3D mode - Plotly has built-in orbit controls
		} else {
			// ============ 2D RENDERING PATH (ORIGINAL) ============
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
			const max2DPoints = Math.max(1200, (container?.clientWidth ?? 800) * 2);
			const decimated = decimate2DSeries(sortedXs, sortedYs, max2DPoints);
			const plotXs = decimated.xs;
			const plotYs = decimated.ys;
			const seriesMap: Record<NumericField, number[]> = {} as Record<NumericField, number[]>;
			for (let i = 0; i < ys.length; i++) {
				seriesMap[ys[i]] = plotYs[i];
			}
			renderedSeries = seriesMap;

			const traces = plotYs.map((ysArr, i) => {
				const axis = i === 0 ? 'y' : 'y2';
				const color = SERIES_COLORS[i % SERIES_COLORS.length];
				const baseTrace: any = {
					x: plotXs,
					y: ysArr,
					name: labelWithUnit(ys[i]),
					hovertemplate: `${hoverLine(x, 'x')}${hoverLine(ys[i], 'y')}<extra></extra>`,
					yaxis: axis
				};

				switch (mode2D) {
					case 'scatter':
						return {
							...baseTrace,
							type: 'scattergl',
							mode: 'markers',
							marker: { size: 6, color }
						};
					case 'area':
						return {
							...baseTrace,
							type: 'scattergl',
							mode: 'lines',
							fill: 'tozeroy',
							fillcolor: color + '40', // 25% opacity
							line: { color, width: 1.5 }
						};
					case 'line':
					default:
						return {
							...baseTrace,
							type: 'scattergl',
							mode: 'lines',
							line: { color, width: 1.5 }
						};
				}
			});

			const layout: any = {
				margin: { l: 40, r: 40, t: 16, b: 40 },
				uirevision: `2d:${x}:${ys.join(',')}:${mode2D}`,
				legend: {
					orientation: 'h',
					y: -0.2,
					font: { color: darkMode ? '#f4f4f5' : '#18181b', size: 13 },
					bgcolor: darkMode ? '#18181b' : '#fff',
					borderwidth: 0
				},
				paper_bgcolor: darkMode ? '#18181b' : '#fff', // dark: neutral-900, light: white
				plot_bgcolor: darkMode ? '#18181b' : '#fff',
				xaxis: {
					title: { text: labelWithUnit(x), font: { color: darkMode ? '#f4f4f5' : '#27272a' } },
					showgrid: true,
					color: darkMode ? '#f4f4f5' : '#27272a', // axis, ticks
					tickcolor: darkMode ? '#8a8a8a' : '#bababa',
					tickfont: { color: darkMode ? '#f4f4f5' : '#18181b' },
					gridcolor: darkMode ? '#23272f' : '#e5e7eb',
					zerolinecolor: darkMode ? '#30333b' : '#bababa',
					linecolor: darkMode ? '#23272f' : '#bababa',
					showline: true
				},
				yaxis: {
					title: { text: labelWithUnit(ys[0]), font: { color: darkMode ? '#f4f4f5' : '#27272a' } },
					showgrid: true,
					color: darkMode ? '#f4f4f5' : '#27272a', // axis, ticks
					tickcolor: darkMode ? '#8a8a8a' : '#bababa',
					tickfont: { color: darkMode ? '#f4f4f5' : '#18181b' },
					gridcolor: darkMode ? '#23272f' : '#e5e7eb',
					zerolinecolor: darkMode ? '#30333b' : '#bababa',
					linecolor: darkMode ? '#23272f' : '#bababa',
					showline: true
				},
				font: {
					family: 'Inter, ui-sans-serif, system-ui, sans-serif',
					color: darkMode ? '#f4f4f5' : '#18181b',
					size: 13
				},
				showlegend: false,
				dragmode: 'pan',
				hoverlabel: {
					bgcolor: darkMode ? '#23272f' : '#fff',
					bordercolor: darkMode ? '#a60f2d' : '#bababa',
					font: { color: darkMode ? '#f4f4f5' : '#18181b' }
				},
				modebar: {
					bgcolor: darkMode ? '#18181b' : '#fff',
					color: darkMode ? '#f4f4f5' : '#18181b',
					activecolor: darkMode ? '#a60f2d' : '#f47521'
				}
			};

			if (ys.length > 1) {
				layout.yaxis2 = {
					title: {
						text: ys
							.slice(1)
							.map((field) => labelWithUnit(field))
							.join(', '),
						font: { color: darkMode ? '#f4f4f5' : '#27272a' }
					},
					showgrid: false,
					overlaying: 'y',
					side: 'right',
					color: darkMode ? '#f4f4f5' : '#27272a',
					tickcolor: darkMode ? '#8a8a8a' : '#bababa',
					tickfont: { color: darkMode ? '#f4f4f5' : '#18181b' },
					linecolor: darkMode ? '#23272f' : '#bababa',
					showline: true
				};
			}

			// Initial render: set time indicator to current (safe, no future dependency on time)
			const indicatorShape = getTimeIndicatorShape(x, ys, undefined); // Don't depend on currentLine
			layout.shapes = indicatorShape ? [indicatorShape] : [];

			plotlyLib.react(chartMount, traces, layout, { responsive: true });
			plotlyInstance = chartMount;
		} // End of 2D rendering path
	});

	// Global time indicator now handled as a Plotly shape (see layout.shapes logic)

	// EFFECT: Only update indicator when time or axes change (never full redraw)
	// NOTE: Time indicator works differently in 3D mode via trace update
	$effect(() => {
		if (!browser || !plotlyLib || !plotlyInstance) return;

		if (is3D) {
			// In 3D mode, update the time indicator trace if it exists
			const currentTraces = plotlyInstance.data;
			const indicatorIdx = currentTraces.findIndex((t: any) => t.name === 'Time Indicator');

			if (indicatorIdx !== -1) {
				const restyleData = get3DIndicatorRestyleData(
					xField,
					yFields,
					zFields,
					$timeIndexStore.currentLine
				);
				if (restyleData) {
					// Optimization: Use requestAnimationFrame for smooth UI updates
					requestAnimationFrame(() => {
						if (!plotlyInstance) return;
						plotlyLib.restyle(plotlyInstance, restyleData, [indicatorIdx]);
					});
				}
			}
			return;
		}

		const indicatorShape = getTimeIndicatorShape(xField, yFields, $timeIndexStore.currentLine);
		// Only the shapes array is updated; this preserves all zoom/pan state
		plotlyLib.relayout(plotlyInstance, {
			shapes: indicatorShape ? [indicatorShape] : []
		});
	});

	$effect(() => {
		if (!browser || is3D || !chartMount || !plotlyInstance || !plotlyLib) return;
		if (plotlyInstance._fullLayout) {
			plotlyInstance._fullLayout.scrollZoom = false;
		}

		const el = chartMount;

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

		function pixelToData(x: number, y: number, yAxis: 'y' | 'y2' = 'y'): { xx: number; yy: number } {
			const layout = plotlyInstance._fullLayout;
			const w = el.clientWidth;
			const h = el.clientHeight;
			const [xMin, xMax, yMin, yMax] = getCurrentRanges();
			const left = layout.margin?.l ?? 40;
			const top = layout.margin?.t ?? 16;
			const right = w - (layout.margin?.r ?? 40);
			const bottom = h - (layout.margin?.b ?? 40);

			const px = Math.max(left, Math.min(x, right));
			const py = Math.max(top, Math.min(y, bottom));

			const xPct = (px - left) / (right - left);
			const xx = xMin + (xMax - xMin) * xPct;

			if (yAxis === 'y2' && layout.yaxis2 && layout.yaxis2.range) {
				const y2Min = Number(layout.yaxis2.range[0]);
				const y2Max = Number(layout.yaxis2.range[1]);
				const yPct = 1 - (py - top) / (bottom - top);
				const yy = y2Min + (y2Max - y2Min) * yPct;
				return { xx, yy };
			}

			const yPct = 1 - (py - top) / (bottom - top);
			const yy = yMin + (yMax - yMin) * yPct;
			return { xx, yy };
		}

		function wheelHandler(e: WheelEvent): void {
			if (!(plotlyInstance && plotlyInstance._fullLayout)) return;
			if (e.ctrlKey || e.metaKey) return;
			e.preventDefault();
			if (wheelFramePending) return;

			wheelFramePending = true;
			requestAnimationFrame(() => {
				wheelFramePending = false;
				if (!(plotlyInstance && plotlyInstance._fullLayout)) return;

				let yMarginZoom: 'left' | 'right' | null = null;
				let useY2 = false;
				const [xMin, xMax, yMin, yMax] = getCurrentRanges();
				let zoomX = true;
				let zoomY = true;
				const margin = 24;

				if (e.shiftKey) {
					const layout = plotlyInstance._fullLayout;
					const rightMargin = el.clientWidth - (layout.margin?.r ?? 40);
					const hasRightY = yFields.length > 1;
					if (e.offsetY > el.clientHeight - margin) zoomY = false;
					if (e.offsetX < margin) {
						zoomX = false;
						yMarginZoom = 'left';
					}
					if (hasRightY && e.offsetX > rightMargin) {
						zoomX = false;
						yMarginZoom = 'right';
						useY2 = true;
					}
					if (!zoomX && !zoomY) return;
				}

				const { xx, yy } = useY2
					? pixelToData(e.offsetX, e.offsetY, 'y2')
					: pixelToData(e.offsetX, e.offsetY, 'y');

				const dz = Math.sign(e.deltaY) * 0.1;
				const minSpan = 1e-12;
				let nx0 = xMin;
				let nx1 = xMax;
				let ny0 = yMin;
				let ny1 = yMax;

				if (zoomX) {
					const x0 = xx - (xx - xMin) * (1 + dz);
					const x1 = xx + (xMax - xx) * (1 + dz);
					if (isFinite(x0) && isFinite(x1) && Math.abs(x1 - x0) > minSpan) {
						nx0 = x0;
						nx1 = x1;
					}
				}

				if (zoomY) {
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

				const relayoutUpdate: Record<string, unknown> = {};
				if (yMarginZoom === 'left') {
					relayoutUpdate['yaxis.range'] = [ny0, ny1];
				} else if (yMarginZoom === 'right') {
					relayoutUpdate['yaxis2.range'] = [ny0, ny1];
				} else {
					relayoutUpdate['xaxis.range'] = [nx0, nx1];
					relayoutUpdate['yaxis.range'] = [ny0, ny1];
				}

				const indicatorShape = getTimeIndicatorShape(xField, yFields, $timeIndexStore.currentLine);
				relayoutUpdate.shapes = indicatorShape ? [indicatorShape] : [];
				plotlyLib.relayout(plotlyInstance, relayoutUpdate);
			});
		}

		el.addEventListener('wheel', wheelHandler, { passive: false });
		return () => {
			el.removeEventListener('wheel', wheelHandler);
		};
	});

	$effect(() => {
		if (!browser || is3D || !chartMount || !plotlyInstance) return;

		const chartEl = chartMount;
		const hoverHandler = (event: any) => {
			if (event && event.points && event.points.length > 0) {
				const pt = event.points[0];
				const pointIndex =
					typeof pt.pointIndex === 'number'
						? pt.pointIndex
						: typeof pt.pointNumber === 'number'
							? pt.pointNumber
							: null;
				tooltipVisible = true;
				const chartWidth = container?.clientWidth ?? 0;
				tooltipFlipped = pt.xpx > chartWidth / 2;
				tooltipX = tooltipFlipped ? pt.xpx - 16 : pt.xpx + 16;
				tooltipY = pt.ypx;
				tooltipXLabel = pt.xaxis.title.text ?? labelWithUnit(xField);
				tooltipXValue = formatFieldValue(xField, typeof pt.x === 'number' ? pt.x : undefined, {
					includeUnit: true
				});
				tooltipEntries = yFields.map((field, i) => ({
					label: labelWithUnit(field),
					value: formatFieldValue(
						field,
						pointIndex !== null && renderedSeries[field]
							? renderedSeries[field][pointIndex]
							: undefined,
						{ includeUnit: true }
					),
					color: SERIES_COLORS[i % SERIES_COLORS.length]
				}));
			}
		};
		const unhoverHandler = () => {
			tooltipVisible = false;
		};

		chartEl.addEventListener('plotly_hover', hoverHandler);
		chartEl.addEventListener('plotly_unhover', unhoverHandler);
		return () => {
			chartEl.removeEventListener('plotly_hover', hoverHandler);
			chartEl.removeEventListener('plotly_unhover', unhoverHandler);
		};
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
		onConfigChange?.({
			xField,
			yFields: [...yFields],
			xDisplayMode,
			is3D,
			zFields: [...zFields],
			mode3D,
			mode2D
		});
	}
</script>

<svelte:window onclick={handleWindowClick} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="flex h-full w-full flex-col overflow-hidden rounded-xl shadow-md bg-white dark:bg-neutral-900 ring-1 ring-primary/15 focus-within:ring-2 focus-within:ring-primary"
>
	<!-- Controls -->
	<div
		class="flex shrink-0 items-center gap-2 border-b border-primary/10 dark:border-neutral-800 bg-primary/5 dark:bg-neutral-800 px-4 py-2 rounded-t-xl text-primary-900 dark:text-neutral-100"
	>
		<!-- X axis selector -->
		<label
			class="flex items-center gap-1 text-xs text-primary-700 dark:text-neutral-300 font-semibold"
		>
			X
			<select
				bind:value={xField}
				onchange={notifyConfigChange}
				class="rounded-md border border-primary/20 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-primary-900 dark:text-neutral-100 px-2 py-1 text-xs font-semibold shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80 transition"
			>
				{#each NUMERIC_FIELDS as f (f)}
					<option value={f}>{labelWithUnit(f)}</option>
				{/each}
			</select>
		</label>

		<!-- Y series multi-select dropdown -->
		<div
			class="graph-series-dropdown relative flex items-center gap-1 text-xs text-primary-700 dark:text-neutral-300 font-semibold"
		>
			<span>Y</span>
			<div class="relative">
				<button
					onclick={() => (yDropdownOpen = !yDropdownOpen)}
					class="flex items-center gap-1 rounded-lg border border-primary/20 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1 text-xs font-semibold shadow-sm hover:bg-primary/10 dark:hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 transition"
				>
					<!-- Color swatches for selected fields -->
					{#each yFields as f, i (f)}
						<span
							class="inline-block h-2 w-2 rounded-full border border-primary/20 bg-primary/40"
							style="background:{SERIES_COLORS[i % SERIES_COLORS.length]}"
						></span>
					{/each}
					<span class="ml-1 text-primary-900 dark:text-neutral-100"
						>{yFields.length === 1 ? labelWithUnit(yFields[0]) : `${yFields.length} series`}</span
					>
					<span class="text-primary-400 dark:text-neutral-400">▾</span>
				</button>

				{#if yDropdownOpen}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						class="absolute left-0 top-full z-50 mt-2 max-h-64 w-52 overflow-y-auto rounded-xl border border-primary/20 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-lg py-1"
						onmouseleave={() => (yDropdownOpen = false)}
					>
						{#each NUMERIC_FIELDS as f (f)}
							{@const selected = yFields.includes(f)}
							{@const idx = yFields.indexOf(f)}
							<button
								onclick={() => toggleYField(f)}
								class="flex w-full items-center gap-2 px-2 py-1 text-left text-xs transition
										font-semibold
										hover:bg-primary/10 dark:hover:bg-primary/20
										focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70
										{selected
									? 'text-primary-900 dark:text-neutral-100 bg-primary/5 dark:bg-primary/15'
									: 'text-neutral-700 dark:text-neutral-300'}"
							>
								<span
									class="inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-primary/20 bg-primary/30"
									style={selected ? `background:${SERIES_COLORS[idx % SERIES_COLORS.length]}` : ''}
								></span>
								{labelWithUnit(f)}
							</button>
						{/each}
					</div>
				{/if}
			</div>
		</div>

		<!-- Z series multi-select dropdown — only shown in 3D mode -->
		{#if is3D}
			<div
				class="graph-series-dropdown relative flex items-center gap-1 text-xs text-primary-700 dark:text-neutral-300 font-semibold"
			>
				<span>Z</span>
				<div class="relative">
					<button
						onclick={() => (zDropdownOpen = !zDropdownOpen)}
						class="flex items-center gap-1 rounded-lg border border-primary/20 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1 text-xs font-semibold shadow-sm hover:bg-primary/10 dark:hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 transition"
					>
						<!-- Color swatches for selected Z fields -->
						{#each zFields as f, i (f)}
							<span
								class="inline-block h-2 w-2 rounded-full border border-primary/20 bg-primary/40"
								style="background:{SERIES_COLORS[i % SERIES_COLORS.length]}"
							></span>
						{/each}
						<span class="ml-1 text-primary-900 dark:text-neutral-100"
							>{zFields.length === 1 ? labelWithUnit(zFields[0]) : `${zFields.length} series`}</span
						>
						<span class="text-primary-400 dark:text-neutral-400">▾</span>
					</button>

					{#if zDropdownOpen}
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							class="absolute left-0 top-full z-50 mt-2 max-h-64 w-52 overflow-y-auto rounded-xl border border-primary/20 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-lg py-1"
							onmouseleave={() => (zDropdownOpen = false)}
						>
							{#each NUMERIC_FIELDS as f (f)}
								{@const selected = zFields.includes(f)}
								{@const idx = zFields.indexOf(f)}
								<button
									onclick={() => toggleZField(f)}
									class="flex w-full items-center gap-2 px-2 py-1 text-left text-xs transition
											font-semibold
											hover:bg-primary/10 dark:hover:bg-primary/20
											focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70
											{selected
										? 'text-primary-900 dark:text-neutral-100 bg-primary/5 dark:bg-primary/15'
										: 'text-neutral-700 dark:text-neutral-300'}"
								>
									<span
										class="inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-primary/20 bg-primary/30"
										style={selected
											? `background:${SERIES_COLORS[idx % SERIES_COLORS.length]}`
											: ''}
									></span>
									{labelWithUnit(f)}
								</button>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		{/if}

		<div class="ml-auto flex items-center gap-2">
			<!-- 2D Mode Selector — only shown in 2D mode -->
			{#if !is3D}
				<select
					bind:value={mode2D}
					onchange={notifyConfigChange}
					class="rounded-md border border-primary/20 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-primary-900 dark:text-neutral-100 px-2 py-1 text-xs font-semibold shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80 transition"
					title="2D visualization type"
				>
					<option value="line">Line</option>
					<option value="scatter">Scatter</option>
					<option value="area">Area</option>
				</select>
			{/if}

			<!-- 3D Mode Selector (scatter vs surface) — only shown in 3D mode -->
			{#if is3D}
				<select
					bind:value={mode3D}
					onchange={notifyConfigChange}
					class="rounded-md border border-primary/20 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-primary-900 dark:text-neutral-100 px-2 py-1 text-xs font-semibold shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80 transition"
					title="3D visualization type"
				>
					<option value="3d-scatter">Scatter</option>
					<option value="3d-surface">Surface</option>
				</select>
			{/if}

			<!-- 2D/3D Toggle Button -->
			<button
				onclick={() => {
					is3D = !is3D;
					notifyConfigChange();
				}}
				class="rounded-md border border-primary/20 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-primary-900 dark:text-neutral-100 px-2 py-1 text-xs font-semibold shadow-sm hover:bg-primary/10 dark:hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80 transition"
				title={is3D ? 'Switch to 2D graph' : 'Switch to 3D graph'}
			>
				{is3D ? '3D' : '2D'}
			</button>

			{#if $dataStore.telemetry.length > 0}
				<span class="text-xs text-stone-400 dark:text-neutral-400">
					{$dataStore.telemetry.length.toLocaleString()} pts
				</span>
			{/if}
		</div>
	</div>

	<!-- Plotly chart mount point + tooltip overlay -->
	<div
		bind:this={container}
		class="relative min-h-0 flex-1 overflow-hidden"
		onpointermove={is3D ? undefined : onPointerMoveMarginZoom}
		onpointerleave={is3D ? undefined : onPointerLeaveMarginZoom}
	>
		{#if $dataStore.telemetry.length === 0}
			<div
				class="flex h-full items-center justify-center text-sm text-neutral-400 dark:text-neutral-500"
			>
				No data loaded — use a Load Data pane to import a file
			</div>
		{/if}

		<!-- Plotly renders here; absolutely fills container so it doesn't affect layout measurement -->
		<div bind:this={chartMount} class="absolute inset-0"></div>

		<!-- Zoom margin hover indicators - only in 2D mode -->
		{#if !is3D && zoomMarginHover === 'left'}
			<div
				class="pointer-events-none absolute left-0 top-0 h-full z-30 rounded-l-lg bg-primary/10"
				style="width:24px;"
				aria-hidden="true"
			></div>
		{/if}
		{#if !is3D && zoomMarginHover === 'right' && yFields.length > 1}
			<div
				class="pointer-events-none absolute right-0 top-0 h-full z-30 rounded-r-lg bg-primary/15"
				style="width:24px;"
				aria-hidden="true"
			></div>
		{/if}
		{#if !is3D && zoomMarginHover === 'bottom'}
			<div
				class="pointer-events-none absolute left-0 bottom-0 w-full z-30 rounded-b-lg bg-primary/10"
				style="height:24px;"
				aria-hidden="true"
			></div>
		{/if}

		<!-- (Removed: Global time indicator overlay) Now integrated as Plotly shape that pans/zooms with data. -->

		<!-- Tooltip overlay -->
		{#if tooltipVisible}
			<div
				class="pointer-events-none absolute z-10 min-w-32 rounded-lg border border-primary/20 dark:border-neutral-700 bg-white/90 dark:bg-neutral-900/95 px-2 py-1.5 shadow-lg backdrop-blur-sm"
				style="left:{tooltipX}px; top:{tooltipY}px; transform: translateX({tooltipFlipped
					? '-100%'
					: '0'}) translateY(-50%)"
			>
				<div class="mb-1 text-xs font-semibold text-primary-700 dark:text-neutral-200">
					{tooltipXLabel}:
					<span class="text-primary-900 dark:text-neutral-100">{tooltipXValue}</span>
				</div>
				{#each tooltipEntries as entry (entry.label)}
					<div class="flex items-center gap-1.5 text-xs">
						<span
							class="inline-block h-2 w-2 shrink-0 rounded-full border border-primary/30 bg-primary/40"
							style="background:{entry.color}"
						></span>
						<span class="text-primary-800 dark:text-neutral-200">{entry.label}:</span>
						<span class="font-semibold text-primary-950 dark:text-neutral-100">{entry.value}</span>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
