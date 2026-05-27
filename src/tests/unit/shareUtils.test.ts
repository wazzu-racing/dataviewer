import { describe, it, expect } from 'vitest';
import { serializeLayout, deserializeLayout } from '$lib/shareUtils';

describe('shareUtils serialize/deserialize', () => {
	it('round-trips main+child layout state', () => {
		const layout = { id: 'root', type: 'graph' as const };
		const floatingPanes: any[] = [];
		const childState = { layout: { id: 'c', type: 'map' as const }, floatingPanes: [] };

		const encoded = serializeLayout(layout, floatingPanes, true, childState);
		const decoded = deserializeLayout(encoded);

		expect(decoded).not.toBeNull();
		expect(decoded!.layout.type).toBe('graph');
		expect(decoded!.childEnabled).toBe(true);
		expect(decoded!.child?.layout.type).toBe('map');
	});

	it('supports old payloads that only include layout+floatingPanes', () => {
		const old = btoa(
			unescape(
				encodeURIComponent(
					JSON.stringify({ layout: { id: 'a', type: 'table' }, floatingPanes: [] })
				)
			)
		);
		const decoded = deserializeLayout(old);
		expect(decoded).not.toBeNull();
		expect(decoded!.layout.type).toBe('table');
		expect(decoded!.childEnabled).toBeUndefined();
	});
});
