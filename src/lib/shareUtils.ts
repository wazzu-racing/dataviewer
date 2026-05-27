import type { LayoutNode, FloatingPaneState, WindowLayoutState } from './types';

export interface SharedState {
	layout: LayoutNode;
	floatingPanes: FloatingPaneState[];
	childEnabled?: boolean;
	child?: WindowLayoutState | null;
	dataUrl?: string;
}

/**
 * Encodes the layout and floating panes into a base64 string
 */

export function serializeLayout(
	layout: LayoutNode,
	floatingPanes: FloatingPaneState[],
	childEnabled: boolean = false,
	child: WindowLayoutState | null = null
): string {
	const state: SharedState = { layout, floatingPanes, childEnabled, child };
	const json = JSON.stringify(state);
	// Using btoa + encodeURIComponent for basic URL safety
	// For production, a more robust Base64 (e.g., base64url) might be better
	return btoa(unescape(encodeURIComponent(json)));
}

/**
 * Decodes a base64 string back into layout and floating panes
 */
export function deserializeLayout(base64: string): {
	layout: LayoutNode;
	floatingPanes: FloatingPaneState[];
	childEnabled?: boolean;
	child?: WindowLayoutState | null;
} | null {
	try {
		const json = decodeURIComponent(escape(atob(base64)));
		const parsed = JSON.parse(json) as SharedState;
		// Backwards compatibility: old links only contained { layout, floatingPanes }
		return {
			layout: parsed.layout,
			floatingPanes: parsed.floatingPanes,
			childEnabled: parsed.childEnabled,
			child: parsed.child
		};
	} catch (err) {
		console.error('Failed to deserialize layout:', err);
		return null;
	}
}

/**
 * Generates a full shareable URL
 */
export function generateShareUrl(
	dataUrl: string | undefined,
	layout: LayoutNode,
	floatingPanes: FloatingPaneState[],
	childEnabled: boolean = false,
	child: WindowLayoutState | null = null
): string {
	const url = new URL(window.location.origin + window.location.pathname);
	if (dataUrl) {
		url.searchParams.set('data', dataUrl);
	}
	url.searchParams.set('layout', serializeLayout(layout, floatingPanes, childEnabled, child));
	return url.toString();
}
