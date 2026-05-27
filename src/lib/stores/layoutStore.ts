import type {
	LayoutNode,
	FloatingPaneState,
	SavedLayout,
	LayoutStoreData,
	WindowLayoutState
} from '$lib/types';
import { ensureIds, generateUUID } from '$lib/layoutUtils';

const STORE_KEY_V2 = 'saved-layouts-v2';
const STORE_KEY_MAIN_V1 = 'saved-layouts';
const STORE_KEY_CHILD_V1 = 'saved-layouts-child';

/**
 * Load the layout store data from localStorage
 */
function loadStoreData(): LayoutStoreData {
	if (typeof window === 'undefined') {
		return { layouts: [], activeLayoutId: null, autoSaveEnabled: true };
	}

	try {
		const raw = localStorage.getItem(STORE_KEY_V2);
		if (raw) {
			return JSON.parse(raw) as LayoutStoreData;
		}
		return { layouts: [], activeLayoutId: null, autoSaveEnabled: true };
	} catch {
		return { layouts: [], activeLayoutId: null, autoSaveEnabled: true };
	}
}

/**
 * Save the layout store data to localStorage
 */
function saveStoreData(data: LayoutStoreData): void {
	if (typeof window === 'undefined') return;
	try {
		localStorage.setItem(STORE_KEY_V2, JSON.stringify(data));
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

function getDefaultWindowLayoutState(): WindowLayoutState {
	return { layout: getDefaultLayout(), floatingPanes: [] };
}

function normalizeSavedLayout(raw: SavedLayout): SavedLayout {
	return {
		...raw,
		layout: ensureIds(raw.layout),
		floatingPanes: raw.floatingPanes ?? [],
		childEnabled: raw.childEnabled ?? false,
		child: raw.child
			? { layout: ensureIds(raw.child.layout), floatingPanes: raw.child.floatingPanes ?? [] }
			: null
	};
}

function sanitizeLayouts(data: LayoutStoreData): LayoutStoreData {
	return {
		...data,
		layouts: (data.layouts ?? []).map(normalizeSavedLayout)
	};
}

/**
 * Appends a disambiguating counter suffix to `name` until it is unique among
 * `existingLayouts[*].name`, skipping the entry with `excludeId` if provided.
 */
function ensureUniqueName(
	name: string,
	existingLayouts: { id: string; name: string }[],
	excludeId?: string
): string {
	let finalName = name;
	let counter = 2;
	while (existingLayouts.some((l) => l.name === finalName && l.id !== excludeId)) {
		finalName = `${name} (${counter})`;
		counter++;
	}
	return finalName;
}

/**
 * Migrate existing old-format layout from localStorage to a new "Default" saved layout
 * This is a one-time migration that runs on first load
 */

function migrateV1StoresToV2IfNeeded(): void {
	if (typeof window === 'undefined') return;
	if (localStorage.getItem(STORE_KEY_V2)) return;

	// Start with empty store.
	let v2: LayoutStoreData = { layouts: [], activeLayoutId: null, autoSaveEnabled: true };

	const readV1 = (key: string): LayoutStoreData | null => {
		try {
			const raw = localStorage.getItem(key);
			if (!raw) return null;
			return JSON.parse(raw) as LayoutStoreData;
		} catch {
			return null;
		}
	};

	const mainV1 = readV1(STORE_KEY_MAIN_V1);
	const childV1 = readV1(STORE_KEY_CHILD_V1);

	// Prefer main layouts; attach child active layout to main active layout when possible.
	if (mainV1 && Array.isArray(mainV1.layouts)) {
		v2 = sanitizeLayouts({
			layouts: mainV1.layouts as SavedLayout[],
			activeLayoutId: mainV1.activeLayoutId ?? null,
			autoSaveEnabled: mainV1.autoSaveEnabled ?? true
		});
	}

	if (childV1 && Array.isArray(childV1.layouts)) {
		const childActiveId = childV1.activeLayoutId ?? null;
		const childActive = childActiveId
			? ((childV1.layouts as SavedLayout[]).find((l) => l.id === childActiveId) ?? null)
			: null;

		if (childActive && v2.activeLayoutId) {
			const idx = v2.layouts.findIndex((l) => l.id === v2.activeLayoutId);
			if (idx !== -1) {
				v2.layouts[idx] = {
					...v2.layouts[idx],
					childEnabled: true,
					child: {
						layout: ensureIds(structuredClone(childActive.layout)),
						floatingPanes: structuredClone(childActive.floatingPanes ?? [])
					}
				};
			}
		}
	}

	saveStoreData(v2);

	// Best-effort cleanup of old v1 stores.
	localStorage.removeItem(STORE_KEY_MAIN_V1);
	localStorage.removeItem(STORE_KEY_CHILD_V1);
}

/**
 * Migrate existing old-format layout keys/stores into the v2 saved layout store.
 * Safe to call on every load.
 */
export function migrateExistingLayout(isChild: boolean): void {
	void isChild;
	if (typeof window === 'undefined') return;

	// First, migrate split v1 stores to v2 if needed.
	migrateV1StoresToV2IfNeeded();

	const storeData = loadStoreData();

	// If we already have layouts, migration was already done
	if (storeData.layouts.length > 0) return;

	try {
		const oldLayoutRaw = localStorage.getItem('layout');
		const oldFloatingRaw = localStorage.getItem('floating-panes');
		const oldChildLayoutRaw = localStorage.getItem('child-layout');
		const oldChildFloatingRaw = localStorage.getItem('child-floating-panes');

		if (oldLayoutRaw) {
			const oldLayout = JSON.parse(oldLayoutRaw) as LayoutNode;
			const oldFloating = oldFloatingRaw ? (JSON.parse(oldFloatingRaw) as FloatingPaneState[]) : [];
			const oldChildLayout = oldChildLayoutRaw
				? (JSON.parse(oldChildLayoutRaw) as LayoutNode)
				: null;
			const oldChildFloating = oldChildFloatingRaw
				? (JSON.parse(oldChildFloatingRaw) as FloatingPaneState[])
				: [];

			// Create a "Default" layout from the old data
			const defaultLayout: SavedLayout = {
				id: generateUUID(),
				name: 'Default',
				layout: ensureIds(oldLayout),
				floatingPanes: oldFloating,
				childEnabled: Boolean(oldChildLayoutRaw),
				child: oldChildLayout
					? { layout: ensureIds(oldChildLayout), floatingPanes: oldChildFloating }
					: null,
				createdAt: Date.now(),
				lastUsed: Date.now()
			};

			storeData.layouts.push(defaultLayout);
			storeData.activeLayoutId = defaultLayout.id;
			saveStoreData(storeData);

			// Clean up old keys
			localStorage.removeItem('layout');
			localStorage.removeItem('floating-panes');
			localStorage.removeItem('child-layout');
			localStorage.removeItem('child-floating-panes');

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
	void isChild;
	const data = sanitizeLayouts(loadStoreData());
	return [...data.layouts].sort((a, b) => b.lastUsed - a.lastUsed);
}

/**
 * Get a specific layout by ID
 * Returns a deep clone to prevent mutations
 */
export function getLayout(id: string, isChild: boolean): SavedLayout | null {
	void isChild;
	const data = sanitizeLayouts(loadStoreData());
	const found = data.layouts.find((l) => l.id === id);
	if (!found) return null;

	// Return a deep clone to prevent accidental mutations
	return {
		...found,
		layout: ensureIds(structuredClone(found.layout)),
		floatingPanes: structuredClone(found.floatingPanes ?? []),
		childEnabled: found.childEnabled ?? false,
		child: found.child
			? {
					layout: ensureIds(structuredClone(found.child.layout)),
					floatingPanes: structuredClone(found.child.floatingPanes ?? [])
				}
			: null
	};
}

/**
 * Get the currently active layout ID
 */
export function getActiveLayoutId(isChild: boolean): string | null {
	void isChild;
	const data = loadStoreData();
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
	const data = sanitizeLayouts(loadStoreData());
	const now = Date.now();

	if (existingId) {
		// Update existing layout
		const index = data.layouts.findIndex((l) => l.id === existingId);
		if (index !== -1) {
			if (isChild) {
				data.layouts[index] = {
					...data.layouts[index],
					name,
					childEnabled: true,
					child: { layout: ensureIds(layout), floatingPanes },
					lastUsed: now
				};
			} else {
				data.layouts[index] = {
					...data.layouts[index],
					name,
					layout: ensureIds(layout),
					floatingPanes,
					lastUsed: now
				};
			}
			saveStoreData(data);
			return existingId;
		}
	}

	// Check for duplicate names and append number if needed
	const finalName = ensureUniqueName(name, data.layouts, existingId);

	// Create new layout
	const newLayout: SavedLayout = {
		id: generateUUID(),
		name: finalName,
		layout: ensureIds(layout),
		floatingPanes,
		childEnabled: false,
		child: null,
		createdAt: now,
		lastUsed: now
	};

	data.layouts.push(newLayout);
	saveStoreData(data);
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
	const data = sanitizeLayouts(loadStoreData());
	const index = data.layouts.findIndex((l) => l.id === id);

	if (index !== -1) {
		if (isChild) {
			data.layouts[index] = {
				...data.layouts[index],
				childEnabled: true,
				child: { layout: ensureIds(layout), floatingPanes },
				lastUsed: Date.now()
			};
		} else {
			data.layouts[index] = {
				...data.layouts[index],
				layout: ensureIds(layout),
				floatingPanes,
				lastUsed: Date.now()
			};
		}
		saveStoreData(data);
	}
}

/**
 * Delete a layout by ID
 */
export function deleteLayout(id: string, isChild: boolean): void {
	void isChild;
	const data = sanitizeLayouts(loadStoreData());
	data.layouts = data.layouts.filter((l) => l.id !== id);

	// If we deleted the active layout, switch to the most recently used one
	if (data.activeLayoutId === id) {
		const sorted = [...data.layouts].sort((a, b) => b.lastUsed - a.lastUsed);
		data.activeLayoutId = sorted.length > 0 ? sorted[0].id : null;
	}

	saveStoreData(data);
}

/**
 * Rename a layout
 */
export function renameLayout(id: string, newName: string, isChild: boolean): void {
	void isChild;
	const data = sanitizeLayouts(loadStoreData());
	const index = data.layouts.findIndex((l) => l.id === id);

	if (index !== -1) {
		// Check for duplicate names
		const finalName = ensureUniqueName(newName, data.layouts, id);

		data.layouts[index].name = finalName;
		saveStoreData(data);
	}
}

/**
 * Duplicate a layout
 * @returns The ID of the new layout
 */
export function duplicateLayout(id: string, isChild: boolean): string | null {
	void isChild;
	const data = sanitizeLayouts(loadStoreData());
	const original = data.layouts.find((l) => l.id === id);

	if (!original) return null;

	const now = Date.now();

	// Generate unique name with duplicate detection
	const baseName = `${original.name} (Copy)`;
	const finalName = ensureUniqueName(baseName, data.layouts);

	const newLayout: SavedLayout = {
		id: generateUUID(),
		name: finalName,
		layout: ensureIds(original.layout),
		floatingPanes: [...original.floatingPanes],
		childEnabled: original.childEnabled ?? false,
		child: original.child
			? {
					layout: ensureIds(original.child.layout),
					floatingPanes: [...(original.child.floatingPanes ?? [])]
				}
			: null,
		createdAt: now,
		lastUsed: now
	};

	data.layouts.push(newLayout);
	saveStoreData(data);
	return newLayout.id;
}

/**
 * Set the active layout
 */
export function setActiveLayout(id: string | null, isChild: boolean): void {
	void isChild;
	const data = sanitizeLayouts(loadStoreData());
	data.activeLayoutId = id;

	// Update lastUsed timestamp
	if (id) {
		const index = data.layouts.findIndex((l) => l.id === id);
		if (index !== -1) {
			data.layouts[index].lastUsed = Date.now();
		}
	}

	saveStoreData(data);
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
	const data = sanitizeLayouts(loadStoreData());
	const pickState = (l: SavedLayout): WindowLayoutState => {
		if (isChild) {
			return l.child ?? getDefaultWindowLayoutState();
		}
		return { layout: l.layout, floatingPanes: l.floatingPanes ?? [] };
	};

	if (data.activeLayoutId) {
		const activeLayout = data.layouts.find((l) => l.id === data.activeLayoutId);
		if (activeLayout) {
			const chosen = pickState(activeLayout);
			return {
				layout: ensureIds(structuredClone(chosen.layout)),
				floatingPanes: structuredClone(chosen.floatingPanes ?? []),
				layoutId: activeLayout.id
			};
		}
	}

	// No active layout, check if we have any layouts
	if (data.layouts.length > 0) {
		const sorted = [...data.layouts].sort((a, b) => b.lastUsed - a.lastUsed);
		const mostRecent = sorted[0];
		setActiveLayout(mostRecent.id, isChild);
		const chosen = pickState(mostRecent);
		return {
			layout: ensureIds(structuredClone(chosen.layout)),
			floatingPanes: structuredClone(chosen.floatingPanes ?? []),
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
	void isChild;
	const data = loadStoreData();
	return data.autoSaveEnabled;
}

/**
 * Set auto-save enabled/disabled
 */
export function setAutoSaveEnabled(enabled: boolean, isChild: boolean): void {
	void isChild;
	const data = sanitizeLayouts(loadStoreData());
	data.autoSaveEnabled = enabled;
	saveStoreData(data);
}

/** Update the child-enabled flag and/or child window layout state for a saved layout. */
export function updateChildWindowState(
	id: string,
	state: { childEnabled?: boolean; child?: WindowLayoutState | null }
): void {
	const data = sanitizeLayouts(loadStoreData());
	const idx = data.layouts.findIndex((l) => l.id === id);
	if (idx === -1) return;
	data.layouts[idx] = {
		...data.layouts[idx],
		childEnabled: state.childEnabled ?? data.layouts[idx].childEnabled,
		child: state.child !== undefined ? state.child : data.layouts[idx].child,
		lastUsed: Date.now()
	};
	saveStoreData(data);
}
