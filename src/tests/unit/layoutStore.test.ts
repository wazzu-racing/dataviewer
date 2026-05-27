import { describe, it, expect, beforeEach } from 'vitest';
import { migrateExistingLayout, getLayout } from '$lib/stores/layoutStore';
import type { LayoutStoreData, SavedLayout } from '$lib/types';

function makeV1Store(layouts: any[], activeLayoutId: string | null): LayoutStoreData {
	return {
		layouts: layouts as SavedLayout[],
		activeLayoutId,
		autoSaveEnabled: true
	};
}

describe('layoutStore v2 migration', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it('migrates v1 main/child stores into saved-layouts-v2', () => {
		const main = makeV1Store(
			[
				{
					id: 'main-1',
					name: 'Main',
					layout: { id: '', type: 'graph' },
					floatingPanes: [],
					createdAt: 1,
					lastUsed: 2
				}
			],
			'main-1'
		);

		const child = makeV1Store(
			[
				{
					id: 'child-1',
					name: 'Child',
					layout: { id: '', type: 'map' },
					floatingPanes: [],
					createdAt: 1,
					lastUsed: 2
				}
			],
			'child-1'
		);

		localStorage.setItem('saved-layouts', JSON.stringify(main));
		localStorage.setItem('saved-layouts-child', JSON.stringify(child));

		migrateExistingLayout(false);

		const raw = localStorage.getItem('saved-layouts-v2');
		expect(raw).toBeTruthy();

		// old v1 keys should be removed
		expect(localStorage.getItem('saved-layouts')).toBeNull();
		expect(localStorage.getItem('saved-layouts-child')).toBeNull();

		const saved = getLayout('main-1', false);
		expect(saved).not.toBeNull();
		expect(saved!.childEnabled).toBe(true);
		expect(saved!.child).not.toBeNull();
		expect(saved!.child!.layout.type).toBe('map');
	});
});
