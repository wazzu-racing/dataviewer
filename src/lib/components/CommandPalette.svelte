<script lang="ts">
	import type { Command } from '$lib/types';
	import { fade, fly } from 'svelte/transition';

	type Props = {
		isOpen: boolean;
		commands: Command[];
		onClose: () => void;
	};

	let { isOpen = $bindable(), commands, onClose }: Props = $props();

	let query = $state('');
	let selectedIndex = $state(0);
	let inputElement: HTMLInputElement | undefined = $state();

	// Navigation stack for nested menus
	let navigationStack: { label: string; items: Command[] }[] = $state([]);

	let currentItems = $derived.by(() => {
		if (navigationStack.length > 0) {
			return navigationStack[navigationStack.length - 1].items;
		}
		return commands;
	});

	let currentTitle = $derived.by(() => {
		if (navigationStack.length > 0) {
			return navigationStack[navigationStack.length - 1].label;
		}
		return 'Type a command or search...';
	});

	// Fuzzy search logic: prefix > word start > substring
	let filteredCommands = $derived.by(() => {
		const q = query.toLowerCase().trim();
		if (!q) return currentItems;

		return currentItems
			.map((cmd) => {
				const label = cmd.label.toLowerCase();
				let score = 0;

				if (label === q) score = 100;
				else if (label.startsWith(q)) score = 80;
				else if (label.includes(' ' + q)) score = 60;
				else if (label.includes(q)) score = 40;
				else if (cmd.description?.toLowerCase().includes(q)) score = 20;

				return { cmd, score };
			})
			.filter((item) => item.score > 0)
			.sort((a, b) => b.score - a.score)
			.map((item) => item.cmd);
	});

	$effect(() => {
		if (isOpen) {
			query = '';
			selectedIndex = 0;
			navigationStack = [];
			// Focus input when opened
			setTimeout(() => inputElement?.focus(), 0);
		}
	});

	// Reset selection when results change or menu changes
	$effect(() => {
		// Just watching currentItems and filteredCommands
		currentItems;
		if (filteredCommands.length > 0 && selectedIndex >= filteredCommands.length) {
			selectedIndex = 0;
		}
	});

	function handleAction(cmd: Command) {
		if (cmd.children && cmd.children.length > 0) {
			navigationStack.push({ label: cmd.label, items: cmd.children });
			query = '';
			selectedIndex = 0;
		} else if (cmd.action) {
			cmd.action();
			onClose();
		}
	}

	function goBack() {
		navigationStack.pop();
		query = '';
		selectedIndex = 0;
		inputElement?.focus();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (!isOpen) return;

		if (e.key === 'Escape') {
			e.preventDefault();
			e.stopPropagation();
			if (navigationStack.length > 0) {
				goBack();
			} else {
				onClose();
			}
			return;
		}

		if (e.key === 'ArrowDown') {
			e.preventDefault();
			if (filteredCommands.length > 0) {
				selectedIndex = (selectedIndex + 1) % filteredCommands.length;
			}
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			if (filteredCommands.length > 0) {
				selectedIndex = (selectedIndex - 1 + filteredCommands.length) % filteredCommands.length;
			}
		} else if (e.key === 'Enter') {
			e.preventDefault();
			if (filteredCommands[selectedIndex]) {
				handleAction(filteredCommands[selectedIndex]);
			}
		} else if (e.key === 'Backspace' && query === '' && navigationStack.length > 0) {
			e.preventDefault();
			goBack();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-[1100] flex items-start justify-center pt-[15vh] px-4 sm:px-6"
		transition:fade={{ duration: 150 }}
		onclick={onClose}
	>
		<div class="fixed inset-0 bg-black/40 backdrop-blur-[2px]"></div>

		<div
			class="relative w-full max-w-2xl bg-white dark:bg-neutral-900 rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden flex flex-col"
			transition:fly={{ y: -20, duration: 200 }}
			onclick={(e) => e.stopPropagation()}
		>
			<div class="p-4 border-b border-neutral-100 dark:border-neutral-800">
				<div
					class="flex items-center gap-3 bg-neutral-100 dark:bg-neutral-800 px-3 py-2 rounded-lg ring-1 ring-inset ring-neutral-200 dark:ring-neutral-700 focus-within:ring-2 focus-within:ring-primary"
				>
					{#if navigationStack.length > 0}
						<button
							onclick={goBack}
							class="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded text-neutral-500"
							title="Go back"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="w-4 h-4"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"><path d="m15 18-6-6 6-6" /></svg
							>
						</button>
						<div class="h-4 w-px bg-neutral-300 dark:bg-neutral-600"></div>
					{:else}
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="w-5 h-5 text-neutral-400"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg
						>
					{/if}
					<input
						bind:this={inputElement}
						bind:value={query}
						type="text"
						placeholder={currentTitle}
						class="flex-1 bg-transparent border-none outline-none text-neutral-900 dark:text-neutral-100 placeholder-neutral-500 text-base"
					/>
				</div>
			</div>

			<div class="max-h-[60vh] overflow-y-auto p-2 custom-scrollbar">
				{#if filteredCommands.length > 0}
					{#each filteredCommands as cmd, i (cmd.id)}
						<button
							class="w-full flex items-center justify-between px-4 py-3 rounded-lg text-left transition-colors {i ===
							selectedIndex
								? 'bg-primary text-white'
								: 'hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300'}"
							onclick={() => handleAction(cmd)}
							onmouseenter={() => (selectedIndex = i)}
						>
							<div class="flex flex-col">
								<span class="font-medium">{cmd.label}</span>
								{#if cmd.description}
									<span
										class="text-xs {i === selectedIndex ? 'text-white/80' : 'text-neutral-500'}"
									>
										{cmd.description}
									</span>
								{/if}
							</div>
							<div class="flex items-center gap-2">
								{#if cmd.children && cmd.children.length > 0}
									<svg
										xmlns="http://www.w3.org/2000/svg"
										class="w-4 h-4 {i === selectedIndex ? 'text-white/60' : 'text-neutral-400'}"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg
									>
								{/if}
								{#if cmd.shortcut}
									<span
										class="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border {i ===
										selectedIndex
											? 'border-white/40 bg-white/20 text-white'
											: 'border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-neutral-400'} font-mono"
									>
										{cmd.shortcut}
									</span>
								{/if}
							</div>
						</button>
					{/each}
				{:else}
					<div class="py-12 text-center text-neutral-500">
						<p>No results found for "{query}"</p>
					</div>
				{/if}
			</div>

			<div
				class="px-4 py-2 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 flex justify-between items-center text-[10px] text-neutral-400 uppercase tracking-widest font-semibold"
			>
				<div class="flex gap-4">
					<span
						><span
							class="text-neutral-500 dark:text-neutral-300 bg-neutral-200 dark:bg-neutral-800 px-1 rounded mr-1"
							>↑↓</span
						> Navigate</span
					>
					<span
						><span
							class="text-neutral-500 dark:text-neutral-300 bg-neutral-200 dark:bg-neutral-800 px-1 rounded mr-1"
							>Enter</span
						> Select</span
					>
				</div>
				<span
					><span
						class="text-neutral-500 dark:text-neutral-300 bg-neutral-200 dark:bg-neutral-800 px-1 rounded mr-1"
						>Esc</span
					> Close</span
				>
			</div>
		</div>
	</div>
{/if}

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
