/**
 * Thin re-export of Leaflet via a dynamic import.
 *
 * Keeping the dynamic import here (rather than directly in MapWidget) means:
 *  1. SSR is safe — this module is only called from browser $effects.
 *  2. Tests can mock '$lib/leaflet' as a static module via vi.mock, which
 *     Vitest intercepts reliably regardless of whether the caller uses a
 *     dynamic or static import.
 */

import type * as LeafletType from 'leaflet';

export async function loadLeaflet(): Promise<typeof LeafletType> {
	const L = await import('leaflet');
	return L;
}
