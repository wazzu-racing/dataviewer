<script lang="ts">
	import { data } from '$lib/data.svelte';
	import { saveWazzuFile } from '$lib/fileFormat';

	let { onConfigChange }: { onConfigChange?: (config: Record<string, unknown>) => void } =
		$props();

	$effect(() => {
		const metadata = $state.snapshot(data.metadata);
		onConfigChange?.(metadata);
	});

	async function handleExport() {
		if (data.lines.length === 0) {
			alert('No data to export.');
			return;
		}

		const metadata = $state.snapshot(data.metadata);
		const blob = await saveWazzuFile(data.lines, metadata);
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${metadata.name.replace(/\s+/g, '_')}.wazzuracing`;
		a.click();
		URL.revokeObjectURL(url);
	}
</script>

<div class="flex h-full flex-col bg-white dark:bg-neutral-900 overflow-y-auto custom-scrollbar p-4">
	<div class="space-y-4">
		<div
			class="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-2"
		>
			<h3 class="text-sm font-bold text-neutral-800 dark:text-neutral-100 uppercase tracking-wider">
				Session Metadata
			</h3>
			<button
				onclick={handleExport}
				disabled={data.lines.length === 0}
				class="text-[10px] font-bold uppercase tracking-widest px-2 py-1 bg-primary text-white rounded hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
			>
				Export .wazzuracing
			</button>
		</div>

		<div class="grid grid-cols-1 gap-4">
			<div class="space-y-1">
				<label
					for="meta-name"
					class="text-[10px] font-bold text-neutral-400 uppercase tracking-widest"
					>Session Name</label
				>
				<input
					id="meta-name"
					type="text"
					bind:value={data.metadata.name}
					placeholder="e.g. Test Run 1"
					class="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-primary transition-all"
				/>
			</div>

			<div class="grid grid-cols-2 gap-4">
				<div class="space-y-1">
					<label
						for="meta-driver"
						class="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Driver</label
					>
					<input
						id="meta-driver"
						type="text"
						bind:value={data.metadata.driver}
						placeholder="Driver Name"
						class="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-primary transition-all"
					/>
				</div>
				<div class="space-y-1">
					<label
						for="meta-location"
						class="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Location</label
					>
					<input
						id="meta-location"
						type="text"
						bind:value={data.metadata.location}
						placeholder="Track/Location"
						class="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-primary transition-all"
					/>
				</div>
			</div>

			<div class="space-y-1">
				<label
					for="meta-datetime"
					class="text-[10px] font-bold text-neutral-400 uppercase tracking-widest"
					>Date / Time</label
				>
				<input
					id="meta-datetime"
					type="datetime-local"
					bind:value={data.metadata.datetime}
					class="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-primary transition-all"
				/>
			</div>

			<div class="space-y-1">
				<label
					for="meta-conditions"
					class="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Conditions</label
				>
				<textarea
					id="meta-conditions"
					bind:value={data.metadata.conditions}
					placeholder="Weather, track temp, etc."
					rows="3"
					class="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-primary transition-all resize-none"
				></textarea>
			</div>
		</div>

		<div class="pt-2 border-t border-neutral-100 dark:border-neutral-800">
			<div
				class="flex items-center justify-between text-[10px] text-neutral-400 uppercase font-bold"
			>
				<span>Version</span>
				<span class="font-mono">{data.metadata.version}</span>
			</div>
			<div
				class="flex items-center justify-between text-[10px] text-neutral-400 uppercase font-bold mt-1"
			>
				<span>Telemetry File</span>
				<span class="font-mono">{data.metadata.files.telemetry}</span>
			</div>
			<div
				class="flex items-center justify-between text-[10px] text-neutral-400 uppercase font-bold mt-1"
			>
				<span>Data Points</span>
				<span class="font-mono">{data.lines.length.toLocaleString()}</span>
			</div>
		</div>
	</div>
</div>

<style>
	.custom-scrollbar::-webkit-scrollbar {
		width: 4px;
	}
	.custom-scrollbar::-webkit-scrollbar-track {
		background: transparent;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background: rgba(156, 163, 175, 0.3);
		border-radius: 20px;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb:hover {
		background: rgba(156, 163, 175, 0.5);
	}
</style>
