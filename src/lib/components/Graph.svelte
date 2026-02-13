<script lang="ts">
	import { line, curveLinear, Delaunay, range, scaleLinear, scaleUtc } from 'd3';
	import type { Line, ScaleLinear, ScaleTime } from 'd3';
	import { data as globalData } from '$lib/data.svelte';
	import type { DataLine } from '$lib/types';

	// Which fields to graph - you can change these to any DataLine properties
	let xField: keyof DataLine = 'unixtime'; // x-axis field
	let yField: keyof DataLine = 'rpm'; // y-axis field

	// Performance settings
	const MAX_POINTS = 1000; // Maximum points to render for performance
	let downsampleFactor = 1;
	let enableTooltips = false; // Disable tooltips for better performance

	// Available fields for graphing
	const availableFields: (keyof DataLine)[] = [
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
		'unixtime',
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
	];

	const marginTop = 40; // the top margin, in pixels
	const marginRight = 0; // the right margin, in pixels
	const marginBottom = 30; // the bottom margin, in pixels
	const marginLeft = 50; // the left margin, in pixels
	const inset = 0; // inset the default range, in pixels
	const width = 600; // the outer width of the chart, in pixels
	const height = 350; // the outer height of the chart, in pixels
	let xLabel = ''; // a label for the x-axis
	let yLabel = ''; // a label for the y-axis

	const horizontalGrid = true; // show horizontal grid lines
	const verticalGrid = true; // show vertical grid lines
	const colors = ['#F50057', '#42A5F5', '#26A69A', '#9575CD']; // fill color for dots && number of colors in fill array MUST match number of subsets in data
	const showDots = false; // whether dots should be displayed (disabled for performance)
	const dotsFilled = true; // whether dots should be filled or outlined
	const r = 5; // (fixed) radius of dots, in pixels
	const strokeWidth = 2; // stroke width of line, in pixels (reduced for performance)
	const strokeOpacity = 0.9; // stroke opacity of line
	const tooltipBackground = 'white'; // background color of tooltip
	const tooltipTextColor = 'black'; // text color of tooltip
	const strokeLinecap = 'round'; // stroke line cap of the line
	const strokeLinejoin = 'round'; // stroke line join of the line
	const xScalefactor = width / 150; // x-axis number of values (reduced for performance)
	const yScalefactor = height / 80; // y-axis number of values (reduced for performance)
	const curve = curveLinear; // method of interpolation between points
	const xType = scaleUtc; // type of x-scale
	const insetTop = inset; // inset from top
	const insetRight = inset; // inset from right
	const insetBottom = inset; // inset fro bottom
	const insetLeft = inset; // inset from left
	const xRange = [marginLeft + insetLeft, width - marginRight - insetRight]; // [left, right]
	const yType = scaleLinear; // type of y-scale
	const yRange = [height - marginBottom - insetBottom, marginTop + insetTop]; // [bottom, top]

	let x: keyof DataLine;
	let y: keyof DataLine;
	let dotInfo: [number[], number, MouseEvent] | null = null;
	let lines: (string | null)[] = [];
	let xVals: (number | Date)[] = [];
	let yVals: number[] = [];
	let points: Array<{ x: number | Date; y: number; color: number }> = [];
	let colorVals: number[] = [];

	let I: number[] = [];
	let cleanData: boolean[] = [];
	let xDomain: [Date | number, Date | number] = [0, 1];
	let yDomain: [number, number] = [0, 1];
	let xScale: ScaleTime<number, number> | ScaleLinear<number, number> = xType(xDomain, xRange);
	let yScale: ScaleLinear<number, number> = yType(yDomain, yRange);
	let niceY: ScaleLinear<number, number> = scaleLinear().domain([0, 1]).nice();
	let chartLine: Line<number> = line();
	let pointsScaled: [number, number][] = [];
	let delaunayGrid: Delaunay<[number, number]>;
	let voronoiGrid: ReturnType<Delaunay<[number, number]>['voronoi']>;
	let xTicks: (Date | number)[] = [];
	let xTicksFormatted: (string | number)[] = [];
	let yTicks: number[] = [];

	// Downsample data for performance
	function downsampleData(data: DataLine[], factor: number): DataLine[] {
		if (factor <= 1) return data;
		const result: DataLine[] = [];
		for (let i = 0; i < data.length; i += factor) {
			result.push(data[i]);
		}
		return result;
	}

	// Downsample data when raw data changes
	let sampledData: DataLine[] = [];
	$: if (globalData.lines && globalData.lines.length > 0) {
		const dataLength = globalData.lines.length;
		downsampleFactor = Math.max(1, Math.ceil(dataLength / MAX_POINTS));
		sampledData = downsampleData(globalData.lines, downsampleFactor);
	}

	// Update axis labels when fields change
	$: {
		xLabel = String(xField);
		yLabel = String(yField);
	}

	// Transform data when sampled data or fields change
	$: if (sampledData.length > 0) {
		x = xField;
		y = yField;

		xVals = sampledData.map((el) => el[x] as number | Date);
		yVals = sampledData.map((el) => Number(el[y]));
		colorVals = sampledData.map(() => 0);
		points = sampledData.map((el) => ({
			x: el[x] as number | Date,
			y: Number(el[y]),
			color: 0
		}));

		I = range(xVals.length) as number[];
	}

	// Calculate scales when values change
	$: if (xVals.length > 0 && yVals.length > 0) {
		const gaps = (_d: unknown, i: number) => {
			const xVal = xVals[i];
			const yVal = yVals[i];
			return !isNaN(xVal instanceof Date ? xVal.getTime() : Number(xVal)) && !isNaN(yVal);
		};
		cleanData = points.map(gaps);

		xDomain = [xVals[0], xVals[xVals.length - 1]];
		yDomain = [0, Math.max(...yVals)];
		xScale = xType(xDomain, xRange);
		yScale = yType(yDomain, yRange);
		niceY = scaleLinear()
			.domain([0, Math.max(...yVals)])
			.nice();

		xTicks = xScale.ticks(xScalefactor);
		xTicksFormatted = xTicks.map((el) => (el instanceof Date ? el.getFullYear() : Number(el)));
		yTicks = niceY.ticks(yScalefactor);
	}

	// Generate chart line and paths when scales change
	$: if (xScale && yScale && cleanData.length > 0) {
		chartLine = line<number>()
			.defined((i: number) => cleanData[i])
			.curve(curve)
			.x((i: number) => xScale(xVals[i] as Date | number) as number)
			.y((i: number) => yScale(yVals[i]));

		lines = [];
		colors.forEach((color, j) => {
			const filteredI = I.filter((el, i) => colorVals[i] === j);
			lines.push(chartLine(filteredI));
		});

		if (enableTooltips) {
			pointsScaled = points.map((el) => [xScale(el.x) as number, yScale(el.y)]);
			delaunayGrid = Delaunay.from(pointsScaled);
			voronoiGrid = delaunayGrid.voronoi([0, 0, width, height]);
		}
	}
</script>

{#if globalData.lines && globalData.lines.length > 0}
	<div class="controls">
		<div class="field-selector">
			<label for="x-field">X-Axis:</label>
			<select id="x-field" bind:value={xField}>
				{#each availableFields as field (field)}
					<option value={field}>{field}</option>
				{/each}
			</select>
		</div>
		<div class="field-selector">
			<label for="y-field">Y-Axis:</label>
			<select id="y-field" bind:value={yField}>
				{#each availableFields as field (field)}
					<option value={field}>{field}</option>
				{/each}
			</select>
		</div>
		<div class="field-selector">
			<label for="tooltips">
				<input id="tooltips" type="checkbox" bind:checked={enableTooltips} />
				Enable Tooltips
			</label>
		</div>
		<div class="info">
			<span>Data points: {globalData.lines.length.toLocaleString()}</span>
			<span>Displayed: {points.length.toLocaleString()}</span>
			{#if downsampleFactor > 1}
				<span class="warning">(Downsampled {downsampleFactor}x for performance)</span>
			{/if}
		</div>
	</div>
	<div class="chart-container">
		<svg
			{width}
			{height}
			viewBox="0 0 {width} {height}"
			cursor={enableTooltips ? 'crosshair' : 'default'}
			on:mouseout={() => (dotInfo = null)}
			on:blur={() => (dotInfo = null)}
			role="document"
		>
			<!-- Chart lines (optimized rendering) -->
			<g class="chartlines" pointer-events="none">
				{#each lines as subsetLine, i (i)}
					{#if dotInfo}
						<path
							class="line"
							fill="none"
							stroke-opacity={points[dotInfo[1]].color === i ? '1' : '0.1'}
							stroke={colors[i]}
							d={subsetLine}
						/>
					{:else}
						<path class="line" fill="none" stroke={colors[i]} d={subsetLine} />
					{/if}
				{/each}
				{#if dotInfo}
					<circle
						cx={xScale(points[dotInfo[1]].x)}
						cy={yScale(points[dotInfo[1]].y)}
						{r}
						stroke={colors[points[dotInfo[1]].color]}
						fill={dotsFilled ? colors[points[dotInfo[1]].color] : 'none'}
					/>
				{/if}
			</g>

			<!-- Y-axis and horizontal grid lines -->
			<g class="y-axis" transform="translate({marginLeft}, 0)" pointer-events="none">
				<path
					class="domain"
					stroke="black"
					d="M{insetLeft}, {marginTop} V{height - marginBottom + 6}"
				/>
				{#each yTicks as tick (tick)}
					<g class="tick" transform="translate(0, {yScale(tick)})">
						<line class="tick-start" x1={insetLeft - 6} x2={insetLeft} />
						{#if horizontalGrid}
							<line class="tick-grid" x1={insetLeft} x2={width - marginLeft - marginRight} />
						{/if}
						<text x="-{marginLeft}" y="5">{tick}</text>
					</g>
				{/each}
				<text x="-{marginLeft}" y={marginTop - 10}>{yLabel}</text>
			</g>
			<!-- X-axis and vertical grid lines -->
			<g
				class="x-axis"
				transform="translate(0,{height - marginBottom - insetBottom})"
				pointer-events="none"
			>
				<path class="domain" stroke="black" d="M{marginLeft},0.5 H{width - marginRight}" />
				{#each xTicks as tick, i (i)}
					<g class="tick" transform="translate({xScale(tick)}, 0)">
						<line class="tick-start" stroke="black" y2="6" />
						{#if verticalGrid}
							<line class="tick-grid" y2={-height + 70} />
						{/if}
						<text font-size="8px" x={-marginLeft / 4} y="20">{xTicksFormatted[i]}</text>
					</g>
				{/each}
				<text x={width - marginLeft - marginRight - 40} y={marginBottom}>{xLabel}</text>
			</g>

			{#if enableTooltips}
				{#each pointsScaled as point, i (i)}
					<path
						stroke="none"
						fill-opacity="0"
						class="voronoi-cell"
						role="button"
						tabindex="0"
						d={voronoiGrid.renderCell(i)}
						on:mouseover={(e) => (dotInfo = [point, i, e as unknown as MouseEvent])}
						on:focus={(e) => (dotInfo = [point, i, e as unknown as MouseEvent])}
					></path>
				{/each}
			{/if}
		</svg>
	</div>
	<!-- Tooltip -->
	{#if enableTooltips && dotInfo}
		<div
			class="tooltip"
			style="position:absolute; left:{dotInfo[2].clientX + 12}px; top:{dotInfo[2].clientY +
				12}px; pointer-events:none; background-color:{tooltipBackground}; color:{tooltipTextColor}"
		>
			{xField}: {points[dotInfo[1]].x instanceof Date
				? points[dotInfo[1]].x.toLocaleString()
				: points[dotInfo[1]].x}<br />
			{yField}: {typeof points[dotInfo[1]].y === 'number'
				? points[dotInfo[1]].y.toFixed(2)
				: points[dotInfo[1]].y}
		</div>
	{/if}
{:else}
	<div class="no-data">
		<p class="text-gray-400 text-center">No data loaded. Please load a data file first.</p>
	</div>
{/if}

<style>
	.controls {
		display: flex;
		gap: 20px;
		padding: 15px;
		background-color: #f5f5f5;
		border-radius: 8px;
		margin-bottom: 20px;
		justify-content: center;
		align-items: center;
		flex-wrap: wrap;
	}
	.info {
		display: flex;
		flex-direction: column;
		gap: 2px;
		font-size: 12px;
		color: #666;
		padding: 5px 10px;
		background-color: white;
		border-radius: 4px;
		border: 1px solid #ddd;
	}
	.info .warning {
		color: #f57c00;
		font-weight: 600;
	}
	.field-selector {
		display: flex;
		flex-direction: column;
		gap: 5px;
	}
	.field-selector label {
		font-size: 14px;
		font-weight: 600;
		color: #333;
		display: flex;
		align-items: center;
		gap: 8px;
		cursor: pointer;
	}
	.field-selector input[type='checkbox'] {
		cursor: pointer;
		width: 16px;
		height: 16px;
	}
	.field-selector select {
		padding: 8px 12px;
		border: 1px solid #ccc;
		border-radius: 4px;
		background-color: white;
		font-size: 14px;
		cursor: pointer;
		min-width: 200px;
	}
	.field-selector select:hover {
		border-color: #999;
	}
	.field-selector select:focus {
		outline: none;
		border-color: #42a5f5;
		box-shadow: 0 0 0 2px rgba(66, 165, 245, 0.2);
	}
	.chart-container {
		justify-content: center;
		align-items: center;
		margin-top: 50px;
		margin-left: 8 0px;
	}
	svg {
		max-width: 100%;
		height: auto;
		height: 'intrinsic';
		margin: auto;
	}
	.line {
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
		stroke-opacity: 0.9;
	}
	.chartlines {
		shape-rendering: geometricPrecision;
	}
	.y-axis {
		font-size: '10px';
		font-family: sans-serif;
		text-anchor: 'end';
	}
	.x-axis {
		font-size: '10px';
		font-family: sans-serif;
		text-anchor: 'end';
	}
	.tick {
		opacity: 1;
	}
	.tick-start {
		stroke: black;
		stroke-opacity: 1;
	}
	.tick-grid {
		stroke: black;
		stroke-opacity: 0.2;
		font-size: '11px';
		color: black;
	}
	.tick text {
		fill: black;
		text-anchor: start;
	}

	.tooltip {
		border-radius: 5px;
		padding: 5px;
		box-shadow:
			rgba(0, 0, 0, 0.4) 0px 2px 4px,
			rgba(0, 0, 0, 0.3) 0px 7px 13px -3px,
			rgba(0, 0, 0, 0.2) 0px -3px 0px inset;
	}
</style>
