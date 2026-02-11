import type { LayoutNode, DropPosition } from './types';

/**
 * Generate a unique ID for a layout node
 * @returns A unique identifier string in the format "node-{timestamp}-{random}"
 * @example
 * const id = generateId(); // "node-1234567890-abc123def"
 */
export function generateId(): string {
	return `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Recursively add IDs to all nodes in a layout tree that don't already have one
 * @param node - The root node of the layout tree
 * @returns A new layout tree with all nodes having unique IDs
 * @example
 * const layoutWithIds = ensureIds({
 *   type: 'horizontal',
 *   panes: [{ type: 'leaf' }, { type: 'graph' }]
 * });
 */
export function ensureIds(node: LayoutNode): LayoutNode {
	const newNode = { ...node };
	if (!newNode.id) {
		newNode.id = generateId();
	}
	if (newNode.panes) {
		newNode.panes = newNode.panes.map(ensureIds);
	}
	return newNode;
}

/**
 * Find a node by ID in the layout tree using depth-first search
 * @param root - The root node to search from
 * @param targetId - The ID of the node to find
 * @returns The found node or null if not found
 * @example
 * const node = findNode(layout, 'node-123');
 * if (node) console.log('Found:', node.type);
 */
export function findNode(root: LayoutNode, targetId: string): LayoutNode | null {
	if (root.id === targetId) {
		return root;
	}
	if (root.panes) {
		for (const pane of root.panes) {
			const found = findNode(pane, targetId);
			if (found) return found;
		}
	}
	return null;
}

/**
 * Find the parent of a node by ID and return the parent with the child's index
 * @param root - The root node to search from
 * @param targetId - The ID of the node whose parent to find
 * @param parent - Internal parameter for recursion (don't pass manually)
 * @returns An object with the parent node and the child's index, or null if not found
 * @example
 * const result = findParent(layout, 'node-123');
 * if (result) console.log('Parent:', result.parent, 'Index:', result.index);
 */
export function findParent(
	root: LayoutNode,
	targetId: string,
	parent: LayoutNode | null = null
): { parent: LayoutNode | null; index: number } | null {
	if (root.id === targetId) {
		if (parent && parent.panes) {
			const index = parent.panes.findIndex((p) => p.id === targetId);
			return { parent, index };
		}
		return { parent: null, index: -1 };
	}
	if (root.panes) {
		for (let i = 0; i < root.panes.length; i++) {
			const found = findParent(root.panes[i], targetId, root);
			if (found) return found;
		}
	}
	return null;
}

/**
 * Insert a new pane or existing node at the specified position relative to a target node
 * @param root - The root layout node
 * @param targetId - ID of the target node to insert relative to
 * @param nodeOrType - Either a LayoutNode to insert or a string type to create a new pane
 * @param position - Where to insert relative to target
 */
function insertNodeInternal(
	root: LayoutNode,
	targetId: string,
	nodeOrType: LayoutNode | string,
	position: DropPosition
): LayoutNode {
	const newRoot = structuredClone(root);
	const target = findNode(newRoot, targetId);
	const parentInfo = findParent(newRoot, targetId);

	if (!target) return newRoot;

	// Create the node to insert
	const nodeToInsert: LayoutNode =
		typeof nodeOrType === 'string'
			? {
					type: nodeOrType,
					id: generateId(),
					defaultSize: 50,
					minSize: 20
				}
			: nodeOrType;

	// Handle center drop - replace target with a group containing both panes
	if (position === 'center') {
		const direction = Math.random() > 0.5 ? 'horizontal' : 'vertical';
		const newGroup: LayoutNode = {
			type: direction,
			id: generateId(),
			panes: [
				{ ...target, defaultSize: 50 },
				{ ...nodeToInsert, defaultSize: 50 }
			]
		};

		// Replace target with the new group
		if (parentInfo?.parent && parentInfo.index >= 0) {
			parentInfo.parent.panes![parentInfo.index] = newGroup;
		} else {
			// Target is root
			return newGroup;
		}
		return newRoot;
	}

	// Handle edge drops (top, bottom, left, right)
	const isVerticalPosition = position === 'top' || position === 'bottom';
	const isBeforePosition = position === 'top' || position === 'left';
	const requiredDirection = isVerticalPosition ? 'vertical' : 'horizontal';

	if (parentInfo?.parent) {
		const parent = parentInfo.parent;
		const index = parentInfo.index;

		// Check if parent has the right direction
		if (parent.type === requiredDirection) {
			// Parent has correct direction, insert into parent's panes
			const insertIndex = isBeforePosition ? index : index + 1;
			parent.panes!.splice(insertIndex, 0, nodeToInsert);

			// Recalculate sizes
			const numPanes = parent.panes!.length;
			parent.panes!.forEach((pane) => {
				pane.defaultSize = 100 / numPanes;
			});
		} else {
			// Parent has wrong direction, wrap target and new pane in a group
			const newGroup: LayoutNode = {
				type: requiredDirection,
				id: generateId(),
				panes: isBeforePosition
					? [
							{ ...nodeToInsert, defaultSize: 50 },
							{ ...target, defaultSize: 50 }
						]
					: [
							{ ...target, defaultSize: 50 },
							{ ...nodeToInsert, defaultSize: 50 }
						]
			};
			parent.panes![index] = newGroup;
		}
	} else {
		// Target is root - wrap in a group
		const newGroup: LayoutNode = {
			type: requiredDirection,
			id: generateId(),
			panes: isBeforePosition
				? [
						{ ...nodeToInsert, defaultSize: 50 },
						{ ...target, defaultSize: 50 }
					]
				: [
						{ ...target, defaultSize: 50 },
						{ ...nodeToInsert, defaultSize: 50 }
					]
		};
		return newGroup;
	}

	return newRoot;
}

/**
 * Insert a new pane of the specified type at a position relative to a target node
 * @param root - The root layout node
 * @param targetId - ID of the target node to insert relative to
 * @param newPaneType - The type string for the new pane (e.g., 'leaf', 'graph', 'map')
 * @param position - Where to insert: 'top', 'bottom', 'left', 'right', or 'center'
 * @returns A new layout tree with the pane inserted
 * @example
 * const newLayout = insertPane(layout, 'node-123', 'graph', 'right');
 */
export function insertPane(
	root: LayoutNode,
	targetId: string,
	newPaneType: string,
	position: DropPosition
): LayoutNode {
	return insertNodeInternal(root, targetId, newPaneType, position);
}

/**
 * Remove a pane from the layout tree and automatically collapse single-child parents
 * @param root - The root layout node
 * @param targetId - ID of the node to remove
 * @returns The updated layout tree, or null if the operation failed
 * @remarks If removing a node leaves its parent with only one child, the parent is collapsed
 * @example
 * const newLayout = removePane(layout, 'node-123');
 * if (newLayout) layout = ensureIds(newLayout);
 */
export function removePane(root: LayoutNode, targetId: string): LayoutNode | null {
	const newNode = structuredClone(root);
	const parentInfo = findParent(newNode, targetId);

	if (!parentInfo?.parent) {
		// Can't remove root node
		return newNode;
	}

	const parent = parentInfo.parent;
	const index = parentInfo.index;

	if (parent.panes) {
		parent.panes.splice(index, 1);

		// If parent now has only one child, collapse it
		if (parent.panes.length === 1) {
			const remainingChild = parent.panes[0];
			const grandparentInfo = findParent(newNode, parent.id!);

			if (grandparentInfo?.parent) {
				// Replace parent with the remaining child
				grandparentInfo.parent.panes![grandparentInfo.index] = remainingChild;
			} else {
				// Parent is root, return the remaining child as new root
				return remainingChild;
			}
		} else if (parent.panes.length === 0) {
			// No children left, remove parent too
			return removePane(newNode, parent.id!);
		}
	}

	return newNode;
}

/**
 * Check if targetId is a descendant of nodeId (prevents circular references)
 * @param root - The root layout node
 * @param nodeId - The potential ancestor node ID
 * @param targetId - The potential descendant node ID
 * @returns True if targetId is a descendant of nodeId, false otherwise
 * @example
 * if (isDescendant(layout, 'parent-id', 'child-id')) {
 *   console.log('Cannot drop parent onto its own child');
 * }
 */
export function isDescendant(root: LayoutNode, nodeId: string, targetId: string): boolean {
	const node = findNode(root, nodeId);
	if (!node) return false;

	if (node.id === targetId) return true;

	if (node.panes) {
		for (const pane of node.panes) {
			if (isDescendant(pane, pane.id!, targetId)) {
				return true;
			}
		}
	}

	return false;
}

/**
 * Move a pane from one location to another in the layout tree
 * @param root - The root layout node
 * @param sourceId - ID of the node to move
 * @param targetId - ID of the target node to move relative to
 * @param position - Where to position relative to target: 'top', 'bottom', 'left', 'right', or 'center'
 * @returns The updated layout tree, or the original if the move is invalid
 * @remarks Prevents moving a node onto itself or onto its own descendants
 * @example
 * const newLayout = movePane(layout, 'node-123', 'node-456', 'right');
 * if (newLayout) layout = ensureIds(newLayout);
 */
export function movePane(
	root: LayoutNode,
	sourceId: string,
	targetId: string,
	position: DropPosition
): LayoutNode | null {
	// Can't move onto itself
	if (sourceId === targetId) {
		return root;
	}

	// Can't move a node onto its own descendant (would create invalid tree)
	if (isDescendant(root, sourceId, targetId)) {
		return root;
	}

	// Find and clone the source node
	const sourceNode = findNode(root, sourceId);
	if (!sourceNode) {
		return root;
	}

	const sourceNodeCopy = structuredClone(sourceNode);

	// Remove the source node from its current location
	const withoutSource = removePane(root, sourceId);
	if (!withoutSource) {
		return root;
	}

	// Check if target still exists after removal (it might have been collapsed)
	const targetStillExists = findNode(withoutSource, targetId);
	if (!targetStillExists) {
		// Target was removed during collapse, insert at root level
		const newRoot: LayoutNode = {
			type: position === 'top' || position === 'bottom' ? 'vertical' : 'horizontal',
			id: generateId(),
			panes:
				position === 'top' || position === 'left'
					? [sourceNodeCopy, withoutSource]
					: [withoutSource, sourceNodeCopy]
		};
		return newRoot;
	}

	// Insert the source node at the target position
	return insertNodeInternal(withoutSource, targetId, sourceNodeCopy, position);
}
