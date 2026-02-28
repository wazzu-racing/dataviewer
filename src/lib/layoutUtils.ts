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
// Tree mutation (all functions return a new tree ð immutable updates)
// ---------------------------------------------------------------------------

/**
 * Insert a new widget pane relative to `targetId`.
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
		if (parent.type === requiredDirection) {
			const insertAt = isBefore ? index : index + 1;
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

/**
 * Update the config of a node by id.
 * Returns a new tree with the config updated; does nothing if node not found.
 * Preserves reference identity for unchanged subtrees to avoid spurious
 * Svelte re-renders of unrelated panes.
 */
export function updateConfig(
	root: LayoutNode,
	targetId: string,
	config: Record<string, unknown>
): LayoutNode {
	if (root.id === targetId) {
		return { ...root, config };
	}
	if (!root.panes) return root;
	const newPanes = root.panes.map((child) => updateConfig(child, targetId, config));
	if (newPanes.every((p, i) => p === root.panes![i])) return root;
	return { ...root, panes: newPanes };
}

function _removeNode(node: LayoutNode, targetId: string): void {
	if (!node.panes) return;
	const index = node.panes.findIndex((p) => p.id === targetId);
	if (index !== -1) {
		node.panes.splice(index, 1);
		// Collapse group with single child
		if (node.panes.length === 1) {
			const only = node.panes[0];
			node.type = only.type;
			node.panes = only.panes;
			node.config = only.config;
		}
		return;
	}
	for (const child of node.panes) {
		_removeNode(child, targetId);
	}
}

// ---- Pane Move/Swap helpers ---- //

/**
 * Move an existing pane (sourceId) to a new position relative to a targetId and direction (top/bottom/left/right).
 * The source pane is removed, and re-inserted at the new position as a child or sibling according to the same rules as insertPane.
 * Returns a new tree (immutable update).
 */
export function movePane(
	root: LayoutNode,
	sourceId: string,
	targetId: string,
	position: DropPosition
): LayoutNode {
	const nodeToMove = findNode(root, sourceId);
	if (!nodeToMove) return root;
	let withoutSource = removePane(root, sourceId);

	if (!withoutSource) return root;
	function insertExistingPane(
		tree: LayoutNode,
		targetId: string,
		node: LayoutNode,
		position: DropPosition
	): LayoutNode {
		const cloned = structuredClone(sanitizeForStructuredClone(tree));
		const result = findParent(cloned, targetId);
		const target = findNode(cloned, targetId);
		if (!target) return cloned;
		const isVertical = position === 'top' || position === 'bottom';
		const isBefore = position === 'top' || position === 'left';
		const requiredDirection = isVertical ? 'vertical' : 'horizontal';
		if (result) {
			const { parent, index } = result;
			if (parent.type === requiredDirection) {
				const insertAt = isBefore ? index : index + 1;
				const count = (parent.panes?.length ?? 0) + 1;
				const size = Math.floor(100 / count);
				parent.panes!.splice(insertAt, 0, { ...node, defaultSize: size });
				parent.panes!.forEach((p) => (p.defaultSize = size));
				return cloned;
			}
		}
		const wrappedTarget: LayoutNode = { ...target, defaultSize: 50 };
		const group: LayoutNode = ensureIds({
			id: '',
			type: requiredDirection,
			defaultSize: target.defaultSize,
			minSize: target.minSize,
			panes: isBefore ? [node, wrappedTarget] : [wrappedTarget, node]
		});
		if (!result) {
			return group;
		}
		const { parent, index } = result;
		parent.panes![index] = group;
		return cloned;
	}
	// ---- Special case: target is now the root after source removal ----
	// If the only sibling of the source was the target, the group collapses/hoists,
	// so the targetId is now the root's id. To maintain a valid pane structure,
	// we create a new group as the root combining the moved pane (source) and
	// the new root (target), using the intended split direction.
	// This guarantees pane operations never remove the last pane or drop a pane.
	// (see Wazzu Racing issue: disappearing panes after two-pane move)

	// insert beside the new root node by creating a new group as the root.
	// NEW: If target is now at the root (no parent), forcibly wrap in new group
	if (findParent(withoutSource, targetId) === null) {
		const isVertical = position === 'top' || position === 'bottom';
		const isBefore = position === 'top' || position === 'left';
		const requiredDirection = isVertical ? 'vertical' : 'horizontal';
		const wrappedTarget: LayoutNode = { ...withoutSource, defaultSize: 50 };
		const wrappedSource: LayoutNode = { ...nodeToMove, defaultSize: 50 };
		const group: LayoutNode = ensureIds({
			id: '',
			type: requiredDirection,
			defaultSize: 100,
			panes: isBefore ? [wrappedSource, wrappedTarget] : [wrappedTarget, wrappedSource]
		});
		return group;
	}
	return insertExistingPane(withoutSource, targetId, nodeToMove, position);
}

/**
 * Swap the positions of two panes by their IDs.
 * Works for panes with the same parent and different parents.
 * Returns a new tree (immutable update).
 */
export function swapPanes(root: LayoutNode, idA: string, idB: string): LayoutNode {
	if (idA === idB) return root;
	const cloned = structuredClone(sanitizeForStructuredClone(root));
	const parentA = findParent(cloned, idA);
	const parentB = findParent(cloned, idB);
	if (!parentA || !parentB) return cloned;
	const paneA = parentA.parent.panes![parentA.index];
	const paneB = parentB.parent.panes![parentB.index];
	if (parentA.parent === parentB.parent) {
		const panes = parentA.parent.panes!;
		[panes[parentA.index], panes[parentB.index]] = [panes[parentB.index], panes[parentA.index]];
		return cloned;
	}
	parentA.parent.panes![parentA.index] = paneB;
	parentB.parent.panes![parentB.index] = paneA;
	return cloned;
}
