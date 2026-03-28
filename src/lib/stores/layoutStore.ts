import type { LayoutNode, FloatingPaneState, SavedLayout, LayoutStoreData } from '$lib/types';
import { ensureIds, generateUUID } from '$lib/layoutUtils';

/**
 * Get the storage key based on whether this is a child window or main window
 */
function getStorageKey(isChild: boolean): string {
	return isChild ? 'saved-layouts-child' : 'saved-layouts';
}

/**
 * Load the layout store data from localStorage
 */
function loadStoreData(isChild: boolean): LayoutStoreData {
	if (typeof window === 'undefined') {
		return { layouts: [], activeLayoutId: null, autoSaveEnabled: true };
	}

	try {
		const raw = localStorage.getItem(getStorageKey(isChild));
		if (!raw) {
			return { layouts: [], activeLayoutId: null, autoSaveEnabled: true };
		}
		const parsed = JSON.parse(raw) as LayoutStoreData;
		return parsed;
	} catch {
		return { layouts: [], activeLayoutId: null, autoSaveEnabled: true };
	}
}

/**
 * Save the layout store data to localStorage
 */
function saveStoreData(data: LayoutStoreData, isChild: boolean): void {
	if (typeof window === 'undefined') return;
	try {
		localStorage.setItem(getStorageKey(isChild), JSON.stringify(data));
	} catch (err) {
		console.error('Failed to save layout store:', err);
	}
}

/**
 * Get default layout (single graph pane)
 */
function getDefaultLayout(): LayoutNode {
	return ensureIds({ id: '', type: 'graph' });
}

/**
 * Migrate existing old-format layout from localStorage to a new "Default" saved layout
 * This is a one-time migration that runs on first load
 */
export function migrateExistingLayout(isChild: boolean): void {
	if (typeof window === 'undefined') return;

	const storeData = loadStoreData(isChild);

	// If we already have layouts, migration was already done
	if (storeData.layouts.length > 0) return;

	const oldLayoutKey = isChild ? 'child-layout' : 'layout';
	const oldFloatingKey = isChild ? 'child-floating-panes' : 'floating-panes';

	try {
		const oldLayoutRaw = localStorage.getItem(oldLayoutKey);
		const oldFloatingRaw = localStorage.getItem(oldFloatingKey);

		if (oldLayoutRaw) {
			const oldLayout = JSON.parse(oldLayoutRaw) as LayoutNode;
			const oldFloating = oldFloatingRaw ? (JSON.parse(oldFloatingRaw) as FloatingPaneState[]) : [];

			// Create a "Default" layout from the old data
			const defaultLayout: SavedLayout = {
				id: generateUUID(),
				name: 'Default',
				layout: ensureIds(oldLayout),
				floatingPanes: oldFloating,
				createdAt: Date.now(),
				lastUsed: Date.now()
			};

			storeData.layouts.push(defaultLayout);
			storeData.activeLayoutId = defaultLayout.id;
			saveStoreData(storeData, isChild);

			// Clean up old keys
			localStorage.removeItem(oldLayoutKey);
			localStorage.removeItem(oldFloatingKey);

			if (import.meta.env.DEV) {
				console.log('Migrated existing layout to "Default" saved layout');
			}
		}
	} catch (err) {
		console.error('Failed to migrate existing layout:', err);
	}
}

/**
 * Get all saved layouts, sorted by most recently used
 */
export function getAllLayouts(isChild: boolean): SavedLayout[] {
	const data = loadStoreData(isChild);
	return [...data.layouts].sort((a, b) => b.lastUsed - a.lastUsed);
}

/**
 * Get a specific layout by ID
 * Returns a deep clone to prevent mutations
 */
export function getLayout(id: string, isChild: boolean): SavedLayout | null {
	const data = loadStoreData(isChild);
	const found = data.layouts.find((l) => l.id === id);
	if (!found) return null;

	// Return a deep clone to prevent accidental mutations
	return {
		...found,
		layout: structuredClone(found.layout),
		floatingPanes: structuredClone(found.floatingPanes)
	};
}

/**
 * Get the currently active layout ID
 */
export function getActiveLayoutId(isChild: boolean): string | null {
	const data = loadStoreData(isChild);
	return data.activeLayoutId;
}

/**
 * Save a new layout or update an existing one
 * @returns The ID of the saved layout
 */
export function saveLayout(
	name: string,
	layout: LayoutNode,
	floatingPanes: FloatingPaneState[],
	isChild: boolean,
	existingId?: string
): string {
	const data = loadStoreData(isChild);
	const now = Date.now();

	if (existingId) {
		// Update existing layout
		const index = data.layouts.findIndex((l) => l.id === existingId);
		if (index !== -1) {
			data.layouts[index] = {
				...data.layouts[index],
				name,
				layout: ensureIds(layout),
				floatingPanes,
				lastUsed: now
			};
			saveStoreData(data, isChild);
			return existingId;
		}
	}

	// Check for duplicate names and append number if needed
	let finalName = name;
	let counter = 2;
	while (data.layouts.some((l) => l.name === finalName && l.id !== existingId)) {
		finalName = `${name} (${counter})`;
		counter++;
	}

	// Create new layout
	const newLayout: SavedLayout = {
		id: generateUUID(),
		name: finalName,
		layout: ensureIds(layout),
		floatingPanes,
		createdAt: now,
		lastUsed: now
	};

	data.layouts.push(newLayout);
	saveStoreData(data, isChild);
	return newLayout.id;
}

/**
 * Update an existing layout's data (used for auto-save)
 */
export function updateLayout(
	id: string,
	layout: LayoutNode,
	floatingPanes: FloatingPaneState[],
	isChild: boolean
): void {
	const data = loadStoreData(isChild);
	const index = data.layouts.findIndex((l) => l.id === id);

	if (index !== -1) {
		data.layouts[index] = {
			...data.layouts[index],
			layout: ensureIds(layout),
			floatingPanes,
			lastUsed: Date.now()
		};
		saveStoreData(data, isChild);
	}
}

/**
 * Delete a layout by ID
 */
export function deleteLayout(id: string, isChild: boolean): void {
	const data = loadStoreData(isChild);
	data.layouts = data.layouts.filter((l) => l.id !== id);

	// If we deleted the active layout, switch to the most recently used one
	if (data.activeLayoutId === id) {
		const sorted = [...data.layouts].sort((a, b) => b.lastUsed - a.lastUsed);
		data.activeLayoutId = sorted.length > 0 ? sorted[0].id : null;
	}

	saveStoreData(data, isChild);
}

/**
 * Rename a layout
 */
export function renameLayout(id: string, newName: string, isChild: boolean): void {
	const data = loadStoreData(isChild);
	const index = data.layouts.findIndex((l) => l.id === id);

	if (index !== -1) {
		// Check for duplicate names
		let finalName = newName;
		let counter = 2;
		while (data.layouts.some((l) => l.name === finalName && l.id !== id)) {
			finalName = `${newName} (${counter})`;
			counter++;
		}

		data.layouts[index].name = finalName;
		saveStoreData(data, isChild);
	}
}

/**
 * Duplicate a layout
 * @returns The ID of the new layout
 */
export function duplicateLayout(id: string, isChild: boolean): string | null {
	const data = loadStoreData(isChild);
	const original = data.layouts.find((l) => l.id === id);

	if (!original) return null;

	const now = Date.now();

	// Generate unique name with duplicate detection
	let baseName = `${original.name} (Copy)`;
	let finalName = baseName;
	let counter = 2;
	while (data.layouts.some((l) => l.name === finalName)) {
		finalName = `${baseName} (${counter})`;
		counter++;
	}

	const newLayout: SavedLayout = {
		id: generateUUID(),
		name: finalName,
		layout: ensureIds(original.layout),
		floatingPanes: [...original.floatingPanes],
		createdAt: now,
		lastUsed: now
	};

	data.layouts.push(newLayout);
	saveStoreData(data, isChild);
	return newLayout.id;
}

/**
 * Set the active layout
 */
export function setActiveLayout(id: string | null, isChild: boolean): void {
	const data = loadStoreData(isChild);
	data.activeLayoutId = id;

	// Update lastUsed timestamp
	if (id) {
		const index = data.layouts.findIndex((l) => l.id === id);
		if (index !== -1) {
			data.layouts[index].lastUsed = Date.now();
		}
	}

	saveStoreData(data, isChild);
}

/**
 * Load the active layout, or return default if none exists
 * Returns deep clones to prevent mutations
 */
export function loadActiveLayout(isChild: boolean): {
	layout: LayoutNode;
	floatingPanes: FloatingPaneState[];
	layoutId: string | null;
} {
	const data = loadStoreData(isChild);

	if (data.activeLayoutId) {
		const activeLayout = data.layouts.find((l) => l.id === data.activeLayoutId);
		if (activeLayout) {
			return {
				layout: ensureIds(structuredClone(activeLayout.layout)),
				floatingPanes: structuredClone(activeLayout.floatingPanes),
				layoutId: activeLayout.id
			};
		}
	}

	// No active layout, check if we have any layouts
	if (data.layouts.length > 0) {
		const sorted = [...data.layouts].sort((a, b) => b.lastUsed - a.lastUsed);
		const mostRecent = sorted[0];
		setActiveLayout(mostRecent.id, isChild);
		return {
			layout: ensureIds(structuredClone(mostRecent.layout)),
			floatingPanes: structuredClone(mostRecent.floatingPanes),
			layoutId: mostRecent.id
		};
	}

	// No layouts at all, return default
	return {
		layout: getDefaultLayout(),
		floatingPanes: [],
		layoutId: null
	};
}

/**
 * Check if auto-save is enabled
 */
export function isAutoSaveEnabled(isChild: boolean): boolean {
	const data = loadStoreData(isChild);
	return data.autoSaveEnabled;
}

/**
 * Set auto-save enabled/disabled
 */
export function setAutoSaveEnabled(enabled: boolean, isChild: boolean): void {
	const data = loadStoreData(isChild);
	data.autoSaveEnabled = enabled;
	saveStoreData(data, isChild);
}
