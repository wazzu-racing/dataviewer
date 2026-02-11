import type { LayoutNode, DropPosition } from './types';

/**
 * Generate a unique ID for a layout node
 */
export function generateId(): string {
	return `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Recursively add IDs to all nodes in a layout tree
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
 * Find a node by ID in the layout tree
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
 * Find the parent of a node by ID
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
 * Insert a new pane at the specified position relative to a target node
 */
export function insertPane(
	root: LayoutNode,
	targetId: string,
	newPaneType: string,
	position: DropPosition
): LayoutNode {
	const newNode = structuredClone(root);
	const target = findNode(newNode, targetId);
	const parentInfo = findParent(newNode, targetId);

	if (!target) return newNode;

	const newPane: LayoutNode = {
		type: newPaneType,
		id: generateId(),
		defaultSize: 50,
		minSize: 20
	};

	// Handle center drop - replace target with a group containing both panes
	if (position === 'center') {
		const direction = Math.random() > 0.5 ? 'horizontal' : 'vertical';
		const newGroup: LayoutNode = {
			type: direction,
			id: generateId(),
			panes: [
				{ ...target, defaultSize: 50 },
				{ ...newPane, defaultSize: 50 }
			]
		};

		// Replace target with the new group
		if (parentInfo?.parent && parentInfo.index >= 0) {
			parentInfo.parent.panes![parentInfo.index] = newGroup;
		} else {
			// Target is root - this shouldn't happen in practice
			return newGroup;
		}
		return newNode;
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
			parent.panes!.splice(insertIndex, 0, newPane);

			// Recalculate sizes
			const numPanes = parent.panes!.length;
			parent.panes!.forEach((pane) => {
				pane.defaultSize = 100 / numPanes;
			});
		} else {
			// Parent has wrong direction, need to wrap target and new pane
			const newGroup: LayoutNode = {
				type: requiredDirection,
				id: generateId(),
				panes: isBeforePosition
					? [
							{ ...newPane, defaultSize: 50 },
							{ ...target, defaultSize: 50 }
						]
					: [
							{ ...target, defaultSize: 50 },
							{ ...newPane, defaultSize: 50 }
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
						{ ...newPane, defaultSize: 50 },
						{ ...target, defaultSize: 50 }
					]
				: [
						{ ...target, defaultSize: 50 },
						{ ...newPane, defaultSize: 50 }
					]
		};
		return newGroup;
	}

	return newNode;
}

/**
 * Remove a pane from the layout tree
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
 * Check if targetId is a descendant of nodeId
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
 * Move a pane from one location to another
 */
export function movePane(
	root: LayoutNode,
	sourceId: string,
	targetId: string,
	position: DropPosition
): LayoutNode | null {
	console.log('movePane called:', { sourceId, targetId, position });

	// Can't move onto itself
	if (sourceId === targetId) {
		console.log('Cannot move onto itself');
		return root;
	}

	// Can't move a node onto its own descendant (would create invalid tree)
	if (isDescendant(root, sourceId, targetId)) {
		console.warn('Cannot move a node onto its own descendant');
		return root;
	}

	// Find the source node - make a deep copy to preserve everything
	const sourceNode = findNode(root, sourceId);
	if (!sourceNode) {
		console.warn('Source node not found:', sourceId);
		return root;
	}

	// Deep clone the source node to preserve all properties
	const sourceNodeCopy = structuredClone(sourceNode);
	console.log('Source node found:', sourceNodeCopy);

	// Remove the source node from its current location
	const withoutSource = removePane(root, sourceId);
	if (!withoutSource) {
		console.warn('Failed to remove source node');
		return root;
	}

	console.log('Source removed, now inserting at target');

	// Check if target still exists after removal (it might have been collapsed)
	const targetStillExists = findNode(withoutSource, targetId);
	if (!targetStillExists) {
		console.log('Target was collapsed, creating new root');
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

	// Now we need to insert the actual source node at the target position
	// We'll do this manually instead of using insertPane to preserve the node
	const result = insertPaneNode(withoutSource, targetId, sourceNodeCopy, position);
	console.log('Move complete');
	return result;
}

/**
 * Insert an actual node (not just a type) at a position
 */
function insertPaneNode(
	root: LayoutNode,
	targetId: string,
	nodeToInsert: LayoutNode,
	position: DropPosition
): LayoutNode {
	const newRoot = structuredClone(root);
	const target = findNode(newRoot, targetId);
	const parentInfo = findParent(newRoot, targetId);

	if (!target) return newRoot;

	// Handle center drop - replace target with a group containing both
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

		if (parentInfo?.parent && parentInfo.index >= 0) {
			parentInfo.parent.panes![parentInfo.index] = newGroup;
		} else {
			return newGroup;
		}
		return newRoot;
	}

	// Handle edge drops
	const isVerticalPosition = position === 'top' || position === 'bottom';
	const isBeforePosition = position === 'top' || position === 'left';
	const requiredDirection = isVerticalPosition ? 'vertical' : 'horizontal';

	if (parentInfo?.parent) {
		const parent = parentInfo.parent;
		const index = parentInfo.index;

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
			// Parent has wrong direction, wrap target and new pane
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
