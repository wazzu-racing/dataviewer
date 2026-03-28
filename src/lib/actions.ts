/**
 * Svelte action to focus an element when it mounts.
 * Used as a replacement for the `autofocus` attribute to avoid a11y warnings.
 *
 * @example
 * <input use:focus />
 */
export function focus(node: HTMLElement): void {
	node.focus();
}
