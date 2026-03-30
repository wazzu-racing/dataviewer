<script lang="ts">
	import type { SessionMetadata } from '$lib/types';

	let {
		show = $bindable(false),
		initialMetadata,
		onConfirm
	}: {
		show: boolean;
		initialMetadata: SessionMetadata;
		onConfirm: (metadata: SessionMetadata) => void;
	} = $props();

	let metadata = $state<SessionMetadata>({
		version: '1.0',
		name: '',
		driver: '',
		location: '',
		datetime: '',
		files: { telemetry: 'data.csv' }
	});

	$effect(() => {
		if (show) {
			metadata = { ...initialMetadata };
		}
	});

	function handleConfirm() {
		onConfirm($state.snapshot(metadata));
		show = false;
	}

	function handleCancel() {
		show = false;
	}
</script>

{#if show}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
		<div
			class="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md overflow-hidden"
		>
			<div class="px-6 py-4 border-b border-slate-700 bg-slate-800/50">
				<h2 class="text-xl font-bold text-white">Session Metadata</h2>
				<p class="text-sm text-slate-400">Enter details for the .wazzuracing file</p>
			</div>

			<div class="p-6 space-y-4">
				<div class="space-y-1">
					<label
						for="session-name"
						class="text-xs font-semibold text-slate-400 uppercase tracking-wider"
						>Session Name</label
					>
					<input
						id="session-name"
						type="text"
						bind:value={metadata.name}
						placeholder="e.g. Test Run 1"
						class="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
					/>
				</div>

				<div class="space-y-1">
					<label
						for="driver-name"
						class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Driver</label
					>
					<input
						id="driver-name"
						type="text"
						bind:value={metadata.driver}
						placeholder="Driver Name"
						class="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
					/>
				</div>

				<div class="space-y-1">
					<label
						for="location"
						class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Location</label
					>
					<input
						id="location"
						type="text"
						bind:value={metadata.location}
						placeholder="Track/Location"
						class="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
					/>
				</div>
			</div>

			<div class="px-6 py-4 bg-slate-800/30 flex justify-end gap-3">
				<button
					onclick={handleCancel}
					class="px-4 py-2 rounded-lg text-slate-300 hover:bg-slate-700 transition-colors"
				>
					Cancel
				</button>
				<button
					onclick={handleConfirm}
					class="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-lg shadow-blue-900/20 transition-all active:scale-95"
				>
					Save File
				</button>
			</div>
		</div>
	</div>
{/if}
