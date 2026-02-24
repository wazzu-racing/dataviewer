import type { LayoutNode, DropPosition, PaneWidgetType } from '$lib/types';

// ---------------------------------------------------------------------------
// Structured clone sanitizer: strips functions, classes, DOM nodes, etc.
// ---------------------------------------------------------------------------
function sanitizeForStructuredClone(value: unknown): any {
	if (value === null || typeof value === 'undefined') return value;
	if (typeof value === 'function' || typeof value === 'symbol') return undefined;
	if (typeof value !== 'object') return value;

	// Reject DOM nodes and known non-plain classes.
	if (typeof window !== 'undefined' && (value instanceof Element || value instanceof Node))
		return undefined;
	// Allow known classes
	if (
		value instanceof Date ||
		value instanceof RegExp ||
		value instanceof Map ||
		value instanceof Set
	)
		return value;

	if (Array.isArray(value)) {
		const arr = value.map(sanitizeForStructuredClone).filter((v) => v !== undefined);
		return arr;
	}

	if (Object.getPrototypeOf(value) !== Object.prototype) return undefined;

	const result: any = {};
	for (const [k, v] of Object.entries(value)) {
		const sanitized = sanitizeForStructuredClone(v);
		if (sanitized !== undefined) result[k] = sanitized;
	}
	return result;
}

// ---------------------------------------------------------------------------
// ID management
// ---------------------------------------------------------------------------

/** Recursively assigns a unique ID to every node that is missing one or has an empty id */
export function ensureIds(node: LayoutNode): LayoutNode {
	const result: LayoutNode = {
		...node,
		id: node.id || crypto.randomUUID()
	};
	if (result.panes) {
		result.panes = result.panes.map(ensureIds);
	}
	return result;
}

// ---------------------------------------------------------------------------
// Tree traversal
// ---------------------------------------------------------------------------

/** Find a node by id, returns null if not found */
export function findNode(root: LayoutNode, id: string): LayoutNode | null {
	if (root.id === id) return root;
	if (root.panes) {
		for (const child of root.panes) {
			const found = findNode(child, id);
			if (found) return found;
		}
	}
	return null;
}

/** Find the parent of a node by the child's id */
export function findParent(
	root: LayoutNode,
	id: string
): { parent: LayoutNode; index: number } | null {
	if (root.panes) {
		for (let i = 0; i < root.panes.length; i++) {
			if (root.panes[i].id === id) return { parent: root, index: i };
			const found = findParent(root.panes[i], id);
			if (found) return found;
		}
	}
	return null;
}

// ---------------------------------------------------------------------------
// Tree mutation (all functions return a new tree  immutable updates)
// ---------------------------------------------------------------------------

/**
 * Insert a new widget pane relative to `targetId`.
 * - top/bottom   2 wrap target + new pane in a vertical group
 * - left/right   2 wrap target + new pane in a horizontal group
 * - center       2 wrap target + new pane in a horizontal group (side by side)
 *
 * If the parent already has the right direction, we just splice in-place
 * (no extra wrapping level needed).
 */
export function insertPane(
	root: LayoutNode,
	targetId: string,
	widgetType: PaneWidgetType,
	position: DropPosition
): LayoutNode {
	const cloned = structuredClone(sanitizeForStructuredClone(root));

	const newNode: LayoutNode = ensureIds({
		id: '',
		type: widgetType,
		defaultSize: 50,
		minSize: 10
	});

	const result = findParent(cloned, targetId);
	const target = findNode(cloned, targetId);
	if (!target) return cloned;

	const isVertical = position === 'top' || position === 'bottom';
	const isBefore = position === 'top' || position === 'left';
	const requiredDirection = isVertical ? 'vertical' : 'horizontal';

	if (result) {
		const { parent, index } = result;

		// Parent already has the correct direction — just splice the new node in
		if (parent.type === requiredDirection) {
			const insertAt = isBefore ? index : index + 1;
			// Rebalance sizes evenly
			const count = (parent.panes?.length ?? 0) + 1;
			const size = Math.floor(100 / count);
			parent.panes!.splice(insertAt, 0, { ...newNode, defaultSize: size });
			parent.panes!.forEach((p) => (p.defaultSize = size));
			return cloned;
		}
	}

	// Otherwise wrap the target node and the new node in a new group
	const wrappedTarget: LayoutNode = { ...target, defaultSize: 50 };
	const group: LayoutNode = ensureIds({
		id: '',
		type: requiredDirection,
		defaultSize: target.defaultSize,
		minSize: target.minSize,
		panes: isBefore ? [newNode, wrappedTarget] : [wrappedTarget, newNode]
	});

	if (!result) {
		// target is root — replace root with group
		return group;
	}

	const { parent, index } = result;
	parent.panes![index] = group;
	return cloned;
}

/**
 * Remove a pane by id. Automatically collapses groups that end up with a
 * single child (hoisting the child up to replace the group).
 * Returns null if the removed node was the root.
 */
export function removePane(root: LayoutNode, targetId: string): LayoutNode | null {
	if (root.id === targetId) return null;

	const cloned = structuredClone(sanitizeForStructuredClone(root));
	_removeNode(cloned, targetId);
	return cloned;
}

function _removeNode(node: LayoutNode, targetId: string): void {
	if (!node.panes) return;

	const index = node.panes.findIndex((p) => p.id === targetId);
	if (index !== -1) {
		node.panes.splice(index, 1);
		// Collapse group with single child
		if (node.panes.length === 1) {
			const only = node.panes[0];
			// Hoist child's properties into the group node
			node.type = only.type;
			node.panes = only.panes;
			node.config = only.config;
			// Keep the group's own id/size
		}
		return;
	}

	for (const child of node.panes) {
		_removeNode(child, targetId);
	}
}
