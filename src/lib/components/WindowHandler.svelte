<script lang="ts">
	import { browser } from '$app/environment';

	export let isChild: boolean = false;

	// If this window is the parent, then this refers to the child. Otherwise it
	// refers to the parent.
	let windowObject: Window | null = null;

	setIsChild();

	export function createChildWindow(): void {
		if (!browser) {
			return;
		}

		windowObject = window.open('/dataviewer', '', 'popup=true');

		window.setTimeout(() => {
			windowObject?.postMessage('This is a message');
		}, 2000);
		windowObject?.postMessage('This is a message');
	}

	function setIsChild(): void {
		if (!browser) {
			return;
		}
		alert('Running setIsChild');

		if (window.opener != null) {
			alert('Is a child');
			isChild = true;
			windowObject = window.opener;
			window.addEventListener('message', recieveMessageFromParent);
		}
	}

	function recieveMessageFromParent(e: MessageEvent): void {
		alert(e.data);
	}
</script>
