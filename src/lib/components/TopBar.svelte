<script lang="ts">
	let { openChildWindow } = $props();
</script>

<!-- TopBar: fixed height + all styling, accepts parent classes via $attributes -->
<div class="w-full h-16 bg-gray-900 text-white shadow flex items-center justify-between px-4">
	<div class="flex gap-3 items-center">
		<!-- Future extension slots go here -->
		<button
			class="bg-indigo-600 hover:bg-indigo-700 rounded px-3 py-1 text-sm font-semibold disabled:opacity-50"
			onclick={openChildWindow}
		>
			New Window
		</button>
	</div>
	<div>
		<!-- Right section for future features -->
	</div>
</div>
