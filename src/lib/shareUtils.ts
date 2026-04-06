import type { LayoutNode, FloatingPaneState } from './types';

export interface SharedState {
	layout: LayoutNode;
	floatingPanes: FloatingPaneState[];
	dataUrl?: string;
}

/**
 * Encodes the layout and floating panes into a base64 string
 */
export function serializeLayout(layout: LayoutNode, floatingPanes: FloatingPaneState[]): string {
	const state = { layout, floatingPanes };
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
} | null {
	try {
		const json = decodeURIComponent(escape(atob(base64)));
		return JSON.parse(json);
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
	floatingPanes: FloatingPaneState[]
): string {
	const url = new URL(window.location.origin + window.location.pathname);
	if (dataUrl) {
		url.searchParams.set('data', dataUrl);
	}
	url.searchParams.set('layout', serializeLayout(layout, floatingPanes));
	return url.toString();
}
