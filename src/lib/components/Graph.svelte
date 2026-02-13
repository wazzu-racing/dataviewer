<script lang="ts" context="module">
	// Module-level cache for Chart.js (shared across all Graph instances)
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let chartJsCache: Promise<any> | null = null;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let ChartClass: any = null;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let zoomPluginCached: any = null;

	async function loadChartJs() {
		if (!chartJsCache) {
			chartJsCache = (async () => {
				const chartModule = await import('chart.js');
				const zoomModule = await import('chartjs-plugin-zoom');

				ChartClass = chartModule.Chart;
				zoomPluginCached = zoomModule.default;

				// Register Chart.js components once
				ChartClass.register(
					chartModule.LineController,
					chartModule.LineElement,
					chartModule.PointElement,
					chartModule.LinearScale,
					chartModule.Title,
					chartModule.Tooltip,
					chartModule.Legend,
					chartModule.Filler,
					zoomPluginCached
				);

				return { Chart: ChartClass, zoomPlugin: zoomPluginCached };
			})();
		}
		return chartJsCache;
	}
</script>

<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { data as globalData } from '$lib/data.svelte';
	import type { DataLine } from '$lib/types';

	export let onClose: () => void = () => {};

	let canvas: HTMLCanvasElement;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let chart: any = null;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let Chart: any = null;

	// Get all available fields from DataLine type (excluding Date type)
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

	// Default selections
	let xAxis: keyof DataLine = 'time';
	let yAxis: keyof DataLine = 'rpm';

	// Format field names for display
	function formatFieldName(field: string): string {
		return field
			.replace(/_/g, ' ')
			.split(' ')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ');
	}

	async function initChart() {
		if (!browser) return;

		// Load Chart.js from module-level cache (instant after first load)
		await loadChartJs();
		Chart = ChartClass;
		createChart();
	}

	function createChart() {
		if (!canvas || !globalData.lines || globalData.lines.length === 0 || !Chart) {
			return;
		}

		// Destroy existing chart
		if (chart) {
			chart.destroy();
		}

		// Extract data for selected axes
		const xData = globalData.lines.map((line) => {
			const val = line[xAxis];
			return typeof val === 'number' ? val : 0;
		});

		const yData = globalData.lines.map((line) => {
			const val = line[yAxis];
			return typeof val === 'number' ? val : 0;
		});

		// Create data points
		const chartData = xData.map((x, i) => ({ x, y: yData[i] }));

		chart = new Chart(canvas, {
			type: 'line',
			data: {
				datasets: [
					{
						label: `${formatFieldName(yAxis)} vs ${formatFieldName(xAxis)}`,
						data: chartData,
						borderColor: 'rgb(59, 130, 246)',
						backgroundColor: 'rgba(59, 130, 246, 0.1)',
						borderWidth: 2,
						pointRadius: 0,
						pointHoverRadius: 5,
						tension: 0,
						fill: false,
						normalized: true,
						parsing: false,
						segment: {
							borderColor: 'rgb(59, 130, 246)'
						}
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				animation: false,
				events: ['mousemove', 'mouseout', 'click', 'touchstart', 'touchmove'],
				responsiveAnimationDuration: 0,
				interaction: {
					mode: 'nearest',
					axis: 'xy',
					intersect: true
				},
				plugins: {
					title: {
						display: true,
						text: `${formatFieldName(yAxis)} vs ${formatFieldName(xAxis)}`,
						font: {
							size: 16,
							weight: 'bold'
						}
					},
					legend: {
						display: false
					},
					tooltip: {
						enabled: true,
						callbacks: {
							// eslint-disable-next-line @typescript-eslint/no-explicit-any
							title: function (context: any) {
								const xVal = context[0]?.parsed?.x;
								return `${formatFieldName(xAxis)}: ${xVal !== undefined && xVal !== null ? xVal.toFixed(3) : 'N/A'}`;
							},
							// eslint-disable-next-line @typescript-eslint/no-explicit-any
							label: function (context: any) {
								const yVal = context.parsed?.y;
								return `${formatFieldName(yAxis)}: ${yVal !== undefined && yVal !== null ? yVal.toFixed(3) : 'N/A'}`;
							}
						}
					},
					zoom: {
						pan: {
							enabled: true,
							mode: 'xy',
							modifierKey: null
						},
						zoom: {
							wheel: {
								enabled: true,
								speed: 0.25
							},
							pinch: {
								enabled: true
							},
							mode: 'xy',
							drag: {
								enabled: false
							},
							animation: {
								duration: 0
							}
						}
					}
				},
				scales: {
					x: {
						type: 'linear',
						bounds: 'data',
						title: {
							display: true,
							text: formatFieldName(xAxis),
							font: {
								size: 14,
								weight: 'bold'
							}
						},
						ticks: {
							maxTicksLimit: 8
						}
					},
					y: {
						type: 'linear',
						bounds: 'data',
						title: {
							display: true,
							text: formatFieldName(yAxis),
							font: {
								size: 14,
								weight: 'bold'
							}
						},
						ticks: {
							maxTicksLimit: 8
						}
					}
				}
			}
		});
	}

	function resetZoom() {
		if (chart) {
			chart.resetZoom();
		}
	}

	// Update chart when axes change
	$: if (browser && xAxis && yAxis && Chart) {
		createChart();
	}

	onMount(() => {
		initChart();
	});

	onDestroy(() => {
		if (chart) {
			chart.destroy();
		}
	});
</script>

<div class="graph-container">
	{#if !globalData.lines || globalData.lines.length === 0}
		<div class="no-data">
			<p class="text-gray-500 text-lg">No data loaded</p>
			<p class="text-gray-400 text-sm mt-2">Load data using the "Load Data" pane first</p>
		</div>
	{:else}
		<div class="controls">
			<div class="control-group">
				<label for="x-axis">
					<span class="label-text">X-Axis:</span>
					<select id="x-axis" bind:value={xAxis}>
						{#each availableFields as field (field)}
							<option value={field}>{formatFieldName(field)}</option>
						{/each}
					</select>
				</label>
			</div>

			<div class="control-group">
				<label for="y-axis">
					<span class="label-text">Y-Axis:</span>
					<select id="y-axis" bind:value={yAxis}>
						{#each availableFields as field (field)}
							<option value={field}>{formatFieldName(field)}</option>
						{/each}
					</select>
				</label>
			</div>

			<button class="reset-button" on:click={resetZoom} title="Reset zoom and pan">
				Reset View
			</button>

			<div class="info-text">
				<span>🖱️ Scroll to zoom • Drag to pan</span>
			</div>
		</div>

		<div class="chart-wrapper">
			<canvas bind:this={canvas}></canvas>
		</div>

		<div class="stats">
			<div class="stat-item">
				<span class="stat-label">Data Points:</span>
				<span class="stat-value">{globalData.lines.length.toLocaleString()}</span>
			</div>
		</div>
	{/if}
</div>

<style>
	.graph-container {
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 0;
	}

	.no-data {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
	}

	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		align-items: center;
		padding: 0.75rem 1rem;
		background: #f9fafb;
		border-bottom: 1px solid #e5e7eb;
		flex-shrink: 0;
	}

	.control-group {
		display: flex;
		align-items: center;
	}

	.control-group label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
		color: #374151;
	}

	.label-text {
		font-weight: 600;
		white-space: nowrap;
	}

	select {
		padding: 0.375rem 0.75rem;
		border: 1px solid #d1d5db;
		border-radius: 0.375rem;
		background: white;
		font-size: 0.875rem;
		color: #374151;
		cursor: pointer;
		transition: all 0.2s;
		min-width: 150px;
	}

	select:hover {
		border-color: #3b82f6;
	}

	select:focus {
		outline: none;
		border-color: #3b82f6;
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
	}

	.reset-button {
		padding: 0.375rem 1rem;
		background: #3b82f6;
		color: white;
		border: none;
		border-radius: 0.375rem;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
		white-space: nowrap;
	}

	.reset-button:hover {
		background: #2563eb;
	}

	.reset-button:active {
		transform: scale(0.98);
	}

	.info-text {
		margin-left: auto;
		font-size: 0.75rem;
		color: #6b7280;
		font-style: italic;
	}

	.chart-wrapper {
		flex: 1;
		position: relative;
		min-height: 0;
		padding: 1rem;
		overflow: hidden;
	}

	canvas {
		max-width: 100%;
		max-height: 100%;
	}

	.stats {
		display: flex;
		gap: 1.5rem;
		padding: 0.75rem 1rem;
		background: #f9fafb;
		border-top: 1px solid #e5e7eb;
		font-size: 0.875rem;
		flex-shrink: 0;
	}

	.stat-item {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.stat-label {
		color: #6b7280;
		font-weight: 500;
	}

	.stat-value {
		color: #374151;
		font-weight: 600;
	}
</style>
