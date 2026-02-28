import { describe, it, expect } from 'vitest';
import {
	ensureIds,
	findNode,
	findParent,
	insertPane,
	removePane,
	updateConfig
} from '$lib/layoutUtils';
import type { LayoutNode } from '$lib/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal leaf node (widget pane) */
function leaf(id: string, type: LayoutNode['type'] = 'graph'): LayoutNode {
	return { id, type };
}

/** Build a horizontal group with given children */
function hGroup(id: string, panes: LayoutNode[]): LayoutNode {
	return { id, type: 'horizontal', panes };
}

/** Build a vertical group with given children */
function vGroup(id: string, panes: LayoutNode[]): LayoutNode {
	return { id, type: 'vertical', panes };
}

// ---------------------------------------------------------------------------
// ensureIds
// ---------------------------------------------------------------------------
describe('ensureIds', () => {
	it('assigns an id to a node missing one', () => {
		const node: LayoutNode = { id: '', type: 'graph' };
		const result = ensureIds(node);
		expect(result.id).toBeTruthy();
		expect(result.id).not.toBe('');
	});

	it('preserves an existing id', () => {
		const node = leaf('existing-id');
		const result = ensureIds(node);
		expect(result.id).toBe('existing-id');
	});

	it('is idempotent — calling twice gives the same ids', () => {
		const node = leaf('a');
		const once = ensureIds(node);
		const twice = ensureIds(once);
		expect(twice.id).toBe(once.id);
	});

	it('recursively assigns ids to children', () => {
		const tree: LayoutNode = {
			id: '',
			type: 'horizontal',
			panes: [
				{ id: '', type: 'graph' },
				{ id: 'child-b', type: 'map' }
			]
		};
		const result = ensureIds(tree);
		expect(result.id).toBeTruthy();
		expect(result.panes![0].id).toBeTruthy();
		expect(result.panes![1].id).toBe('child-b');
	});

	it('handles deeply nested trees', () => {
		const tree: LayoutNode = {
			id: '',
			type: 'vertical',
			panes: [
				{
					id: '',
					type: 'horizontal',
					panes: [{ id: '', type: 'gauge' }]
				}
			]
		};
		const result = ensureIds(tree);
		expect(result.id).toBeTruthy();
		expect(result.panes![0].id).toBeTruthy();
		expect(result.panes![0].panes![0].id).toBeTruthy();
	});
});

// ---------------------------------------------------------------------------
// findNode
// ---------------------------------------------------------------------------
describe('findNode', () => {
	it('finds the root by its own id', () => {
		const root = leaf('root');
		expect(findNode(root, 'root')).toBe(root);
	});

	it('returns null for an id that does not exist', () => {
		const root = leaf('root');
		expect(findNode(root, 'missing')).toBeNull();
	});

	it('finds a direct child', () => {
		const child = leaf('child');
		const root = hGroup('root', [child]);
		expect(findNode(root, 'child')).toEqual(child);
	});

	it('finds a deeply nested node', () => {
		const deep = leaf('deep');
		const root = vGroup('root', [hGroup('mid', [deep])]);
		expect(findNode(root, 'deep')).toEqual(deep);
	});

	it('returns null for a leaf with no children', () => {
		const root = leaf('root');
		expect(findNode(root, 'nonexistent')).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// findParent
// ---------------------------------------------------------------------------
describe('findParent', () => {
	it('returns null when searching for the root id', () => {
		const root = leaf('root');
		expect(findParent(root, 'root')).toBeNull();
	});

	it('returns null when id is not in the tree', () => {
		const root = hGroup('root', [leaf('a')]);
		expect(findParent(root, 'missing')).toBeNull();
	});

	it('finds the parent of a direct child and its index', () => {
		const a = leaf('a');
		const b = leaf('b');
		const root = hGroup('root', [a, b]);
		const result = findParent(root, 'b');
		expect(result).not.toBeNull();
		expect(result!.parent.id).toBe('root');
		expect(result!.index).toBe(1);
	});

	it('finds the parent of a deeply nested node', () => {
		const deep = leaf('deep');
		const mid = hGroup('mid', [deep]);
		const root = vGroup('root', [mid]);
		const result = findParent(root, 'deep');
		expect(result).not.toBeNull();
		expect(result!.parent.id).toBe('mid');
		expect(result!.index).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// insertPane
// ---------------------------------------------------------------------------
describe('insertPane', () => {
	it('wraps root in a vertical group when dropping "top"', () => {
		const root = leaf('root', 'graph');
		const result = insertPane(root, 'root', 'map', 'top');
		expect(result.type).toBe('vertical');
		expect(result.panes).toHaveLength(2);
		// New pane should be first (before root)
		expect(result.panes![0].type).toBe('map');
		expect(result.panes![1].type).toBe('graph');
	});

	it('wraps root in a vertical group when dropping "bottom"', () => {
		const root = leaf('root', 'graph');
		const result = insertPane(root, 'root', 'map', 'bottom');
		expect(result.type).toBe('vertical');
		// New pane comes after
		expect(result.panes![0].type).toBe('graph');
		expect(result.panes![1].type).toBe('map');
	});

	it('wraps root in a horizontal group when dropping "left"', () => {
		const root = leaf('root', 'graph');
		const result = insertPane(root, 'root', 'table', 'left');
		expect(result.type).toBe('horizontal');
		expect(result.panes![0].type).toBe('table');
		expect(result.panes![1].type).toBe('graph');
	});

	it('wraps root in a horizontal group when dropping "right"', () => {
		const root = leaf('root', 'graph');
		const result = insertPane(root, 'root', 'table', 'right');
		expect(result.type).toBe('horizontal');
		expect(result.panes![0].type).toBe('graph');
		expect(result.panes![1].type).toBe('table');
	});

	it('treats "center" the same as "right" (horizontal group)', () => {
		const root = leaf('root', 'graph');
		const result = insertPane(root, 'root', 'gauge', 'center');
		expect(result.type).toBe('horizontal');
		expect(result.panes![0].type).toBe('graph');
		expect(result.panes![1].type).toBe('gauge');
	});

	it('splices into existing horizontal parent when dropping "right"', () => {
		const a = leaf('a', 'graph');
		const b = leaf('b', 'map');
		const root = hGroup('root', [a, b]);
		const result = insertPane(root, 'a', 'table', 'right');
		// No extra wrapping — still a horizontal group with 3 children
		expect(result.type).toBe('horizontal');
		expect(result.panes).toHaveLength(3);
		expect(result.panes![0].id).toBe('a');
		expect(result.panes![1].type).toBe('table');
		expect(result.panes![2].id).toBe('b');
	});

	it('splices into existing vertical parent when dropping "top"', () => {
		const a = leaf('a', 'graph');
		const b = leaf('b', 'map');
		const root = vGroup('root', [a, b]);
		const result = insertPane(root, 'b', 'gauge', 'top');
		expect(result.type).toBe('vertical');
		expect(result.panes).toHaveLength(3);
		expect(result.panes![0].id).toBe('a');
		expect(result.panes![1].type).toBe('gauge');
		expect(result.panes![2].id).toBe('b');
	});

	it('rebalances sizes evenly when splicing into existing group', () => {
		const a = leaf('a');
		const b = leaf('b');
		const root = hGroup('root', [a, b]);
		const result = insertPane(root, 'a', 'table', 'right');
		// 3 children → each should be floor(100/3) = 33
		result.panes!.forEach((p) => expect(p.defaultSize).toBe(33));
	});

	it('returns the cloned tree unchanged if target id is not found', () => {
		const root = leaf('root', 'graph');
		const result = insertPane(root, 'nonexistent', 'map', 'right');
		expect(result.type).toBe('graph');
	});

	it('assigns a new id to the inserted pane', () => {
		const root = leaf('root', 'graph');
		const result = insertPane(root, 'root', 'map', 'right');
		const newPaneId = result.panes![1].id;
		expect(newPaneId).toBeTruthy();
		expect(newPaneId).not.toBe('root');
	});
});

// ---------------------------------------------------------------------------
// removePane
// ---------------------------------------------------------------------------
describe('removePane', () => {
	it('returns null when removing the root', () => {
		const root = leaf('root');
		expect(removePane(root, 'root')).toBeNull();
	});

	it('removes a direct child leaf from a group', () => {
		const a = leaf('a');
		const b = leaf('b');
		const root = hGroup('root', [a, b]);
		const result = removePane(root, 'a');
		// Single child left — group collapses: root should become node b
		expect(result).not.toBeNull();
		expect(result!.type).toBe('graph');
	});

	it('collapses a group with one remaining child by hoisting it', () => {
		const a = leaf('a', 'gauge');
		const b = leaf('b', 'table');
		const root = hGroup('root', [a, b]);
		const result = removePane(root, 'b')!;
		// root now has no panes and becomes the type of the remaining child
		expect(result.type).toBe('gauge');
		expect(result.panes).toBeUndefined();
	});

	it('removes a node from a group with 3 children without collapsing', () => {
		const a = leaf('a');
		const b = leaf('b');
		const c = leaf('c');
		const root = hGroup('root', [a, b, c]);
		const result = removePane(root, 'b')!;
		expect(result.panes).toHaveLength(2);
		expect(result.panes![0].id).toBe('a');
		expect(result.panes![1].id).toBe('c');
	});

	it('removes a deeply nested node', () => {
		const deep = leaf('deep', 'map');
		const sibling = leaf('sib', 'gauge');
		const mid = hGroup('mid', [deep, sibling]);
		const root = vGroup('root', [mid, leaf('other', 'table')]);
		const result = removePane(root, 'deep')!;
		// mid had 2 children, removes one → collapses to just 'sib'
		const midResult = findNode(result, 'mid')!;
		expect(midResult.type).toBe('gauge');
	});

	it('does not mutate the original tree', () => {
		const a = leaf('a');
		const b = leaf('b');
		const root = hGroup('root', [a, b]);
		const original = JSON.stringify(root);
		removePane(root, 'a');
		expect(JSON.stringify(root)).toBe(original);
	});
});

// ---------------------------------------------------------------------------
// updateConfig
// ---------------------------------------------------------------------------
describe('updateConfig', () => {
	it('updates the config of the root node', () => {
		const root = leaf('root');
		const config = { xField: 'time', yFields: ['rpm'] };
		const result = updateConfig(root, 'root', config);
		expect(result.config).toEqual(config);
		// Original not mutated
		expect(root.config).toBeUndefined();
	});

	it('updates the config of a nested node', () => {
		const a = leaf('a');
		const root = hGroup('root', [a, leaf('b')]);
		const result = updateConfig(root, 'a', { key: 'value' });
		const updated = findNode(result, 'a')!;
		expect(updated.config).toEqual({ key: 'value' });
		// Other nodes unchanged
		expect(findNode(result, 'b')!.config).toBeUndefined();
	});

	it('is a no-op when id is not found', () => {
		const root = leaf('root');
		const result = updateConfig(root, 'nonexistent', { key: 'value' });
		expect(result).toEqual(root);
	});

	it('replaces (not merges) the config', () => {
		const root: LayoutNode = { id: 'root', type: 'graph', config: { old: true } };
		const result = updateConfig(root, 'root', { new: true });
		expect(result.config).toEqual({ new: true });
		expect(result.config).not.toHaveProperty('old');
	});
});
