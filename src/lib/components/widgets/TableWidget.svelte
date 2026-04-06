<script lang="ts">
	import { untrack } from 'svelte';
	import { data as globalData } from '$lib/data.svelte';
	import { timeIndexStore } from '$lib/stores/time';
	import { type TableConfig, NUMERIC_FIELDS, type NumericField } from '$lib/types';

	// All displayable columns — imported from shared definition in types.ts
	const ALL_COLUMNS = NUMERIC_FIELDS;
	type Column = NumericField;

	// ---------------------------------------------------------------------------
	// Props
	// ---------------------------------------------------------------------------
	type Props = {
		config?: TableConfig;
		onConfigChange?: (cfg: TableConfig) => void;
	};
	const { config: _cfg, onConfigChange }: Props = $props();
	const _seedColumns: Column[] = untrack(() => {
		const saved = (_cfg?.visibleColumns as string[] | undefined)?.filter((col): col is Column =>
			ALL_COLUMNS.includes(col as Column)
		);
		return saved?.length ? saved : ['time', 'rpm', 'ground_speed', 'tps', 'afr', 'batt'];
	});

	// Default visible columns
	let visibleColumns: Column[] = $state([..._seedColumns]);

	// Guard: sync local state only when pane's config changes
	$effect(() => {
		if (_cfg?.visibleColumns && Array.isArray(_cfg.visibleColumns)) {
			const filteredCols = _cfg.visibleColumns.filter((col): col is Column =>
				ALL_COLUMNS.includes(col as Column)
			);
			if (!arrayEquals(visibleColumns, filteredCols)) {
				visibleColumns = [...filteredCols];
			}
		}
	});

	function arrayEquals(a: Column[], b: Column[]): boolean {
		return (
			Array.isArray(a) &&
			Array.isArray(b) &&
			a.length === b.length &&
			a.every((val, idx) => val === b[idx])
		);
	}
	let showColumnPicker = $state(false);

	// ---------------------------------------------------------------------------
	// Config persistence — notify parent only after initial mount
	// ---------------------------------------------------------------------------
	let _configMounted = false;

	// Windowed rendering — only render rows within scroll viewport
	const ROW_HEIGHT = 28; // px
	const BUFFER = 10;

	// Compute nearest row to global time
	let nearestRowIdx = $state<number | null>(null);
	$effect(() => {
		const idx = $timeIndexStore.selectedIndex;
		const linesArr = globalData.lines;
		if (!linesArr || linesArr.length === 0 || typeof idx !== 'number') {
			nearestRowIdx = null;
			return;
		}
		nearestRowIdx = idx;
	});

	// Scroll nearest row into view when changed and if visible
	$effect(() => {
		if (nearestRowIdx === null || !scrollContainer || globalData.lines.length === 0) return;
		// If nearestRowIdx is currently visible, scroll to it
		const rowTop = nearestRowIdx * ROW_HEIGHT;
		const rowBottom = rowTop + ROW_HEIGHT;
		const visibleTop = scrollContainer.scrollTop;
		const visibleBottom = visibleTop + scrollContainer.clientHeight;
		if (rowTop < visibleTop || rowBottom > visibleBottom) {
			// ---
			// Instantly jump-scroll scrollContainer to nearestRowIdx when global time changes.
			// 'auto' disables animation and ensures immediate scroll-to-row, fixing prior delay.
			// ---
			scrollContainer.scrollTo({
				top: Math.max(0, rowTop - Math.floor(scrollContainer.clientHeight / 2)),
				behavior: 'auto' // Set to 'auto' for instant scroll
			});
		}
	});

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
			visibleColumns = visibleColumns.filter((c) => c !== col);
		} else {
			visibleColumns = [...visibleColumns, col];
		}
		onConfigChange?.({ visibleColumns: [...visibleColumns] });
	}
</script>

<div
	class="flex h-full w-full flex-col overflow-hidden text-xs rounded-xl shadow-md bg-white dark:bg-neutral-900 ring-1 ring-primary/15 dark:ring-neutral-800 focus-within:ring-2 focus-within:ring-primary"
>
	<!-- Toolbar -->
	<div
		class="flex shrink-0 items-center gap-2 border-b border-primary/10 dark:border-neutral-800 bg-primary/5 dark:bg-neutral-800 px-4 py-2 rounded-t-xl text-primary-900 dark:text-neutral-100"
	>
		<span class="text-primary-700 dark:text-neutral-300 font-semibold"
			>{totalRows.toLocaleString()} rows</span
		>
		<div class="relative ml-auto">
			<button
				onclick={() => (showColumnPicker = !showColumnPicker)}
				class="rounded-lg border border-primary/20 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-1 text-xs font-semibold shadow-sm hover:bg-primary/10 dark:hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 transition"
			>
				Columns ▾
			</button>
			{#if showColumnPicker}
				<div
					class="absolute right-0 top-full z-50 mt-2 max-h-64 w-48 overflow-y-auto rounded-xl border border-primary/15 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-lg py-1"
				>
					{#each ALL_COLUMNS as col (col)}
						<label
							class="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-primary/5 dark:hover:bg-neutral-700 rounded"
						>
							<input
								type="checkbox"
								checked={visibleColumns.includes(col)}
								onchange={() => toggleColumn(col)}
								class="accent-primary focus-visible:ring-2 focus-visible:ring-primary"
							/>
							<span class="text-xs text-primary-900 dark:text-neutral-200">{col}</span>
						</label>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	{#if totalRows === 0}
		<div class="flex flex-1 items-center justify-center text-neutral-400 dark:text-neutral-500">
			No data loaded — use a <span class="font-semibold text-primary-600 dark:text-primary-400"
				>Load Data</span
			> pane to import a file
		</div>
	{:else}
		<!-- Sticky header -->
		<div
			class="shrink-0 border-b border-primary/15 dark:border-neutral-800 bg-primary/10 dark:bg-neutral-800 text-primary-900 dark:text-neutral-100"
		>
			<div class="flex">
				<div class="w-14 shrink-0 px-3 py-2 font-bold text-primary-700 dark:text-neutral-300">
					#
				</div>
				{#each visibleColumns as col (col)}
					<div class="w-28 shrink-0 px-3 py-2 font-bold text-primary-800 dark:text-neutral-200">
						{col}
					</div>
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
							class={`flex border-b border-primary/5 dark:border-neutral-800 transition group rounded-md mx-1 my-0.5
								hover:bg-primary/5 dark:hover:bg-neutral-800 focus-within:bg-primary/10 dark:focus-within:bg-neutral-700
								${nearestRowIdx === startIdx + i ? 'bg-primary/20 dark:bg-primary/30 font-bold ring-2 ring-primary/50' : (startIdx + i) % 2 === 0 ? 'bg-white dark:bg-neutral-900' : 'bg-primary/5 dark:bg-neutral-900/60'}`}
							style="height:{ROW_HEIGHT}px;"
							aria-label={nearestRowIdx === startIdx + i ? 'Global time row' : undefined}
						>
							<div
								class="w-14 shrink-0 px-3 py-2 text-primary-500 dark:text-neutral-400 group-hover:text-primary-700 dark:group-hover:text-neutral-300"
							>
								{startIdx + i}
							</div>
							{#each visibleColumns as col (col)}
								<div
									class="w-28 shrink-0 overflow-hidden px-3 py-2 text-neutral-900 dark:text-neutral-200 group-hover:text-primary-800 dark:group-hover:text-neutral-100"
								>
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
