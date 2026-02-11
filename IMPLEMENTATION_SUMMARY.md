# Drag-and-Drop Pane Layout Implementation Summary

This document summarizes the complete implementation of arbitrarily nested, drag-and-drop pane layouts for the dataviewer project.

## 🎯 Features Implemented

### Core Functionality

- ✅ Arbitrarily nested pane groups (horizontal/vertical)
- ✅ Drag pane types from toolbar into layout
- ✅ **Drag existing panes to move them** (NEW!)
- ✅ Drop zones with visual position indicators
- ✅ Remove panes with click
- ✅ Automatic tree restructuring on insert/remove
- ✅ Real-time visual feedback during dragging
- ✅ Smart prevention of invalid moves (can't drop on self/descendants)
- ✅ Type-safe TypeScript implementation

### User Interactions

1. **Add New Panes** - Drag pane types from the sidebar toolbar (blue indicators)
2. **Move Existing Panes** - Drag pane headers to reposition them (purple indicators)
3. **Drop** - Position indicators show where the pane will be placed:
   - **Center** - Splits the target pane (replaces with a group)
   - **Edges** (top/bottom/left/right) - Inserts adjacent to target
4. **Remove** - Click the (×) button on any pane to remove it
5. **Resize** - Drag the dividers between panes to adjust sizes

## 📁 Files Created

```
dataviewer/
├── src/
│   ├── lib/
│   │   ├── types.ts                          # Type definitions
│   │   ├── layoutUtils.ts                    # Tree manipulation utilities
│   │   └── components/
│   │       ├── PaneToolbar.svelte            # Draggable pane types sidebar
│   │       └── DropZone.svelte               # Drop detection & visual feedback
│   └── routes/
│       ├── +page.svelte                      # Main page with layout state
│       └── PaneLayout.svelte                 # Recursive layout renderer
├── PANE_LAYOUT.md                            # Basic layout documentation
├── DRAG_DROP_GUIDE.md                        # Comprehensive D&D guide
├── MOVE_PANES_GUIDE.md                       # Moving panes documentation
├── VISUAL_REFERENCE.md                       # ASCII diagrams and examples
├── QUICK_START.md                            # 5-minute getting started guide
└── IMPLEMENTATION_SUMMARY.md                 # This file
```

## 🏗️ Architecture

### Data Structure

The layout is represented as a recursive tree:

```typescript
type LayoutNode = {
	type: 'horizontal' | 'vertical' | 'leaf' | 'graph' | 'map' | string;
	panes?: LayoutNode[]; // Children (for groups)
	defaultSize?: number; // Size percentage (0-100)
	minSize?: number; // Minimum size percentage
	id?: string; // Unique identifier
};
```

**Example:**

```typescript
{
    type: 'horizontal',
    id: 'root-123',
    panes: [
        {
            type: 'vertical',
            id: 'group-456',
            defaultSize: 50,
            panes: [
                { type: 'leaf', id: 'leaf-1', defaultSize: 50 },
                { type: 'graph', id: 'leaf-2', defaultSize: 50 }
            ]
        },
        { type: 'map', id: 'leaf-3', defaultSize: 50 }
    ]
}
```

Visual representation:

```
┌──────────────┬──────────────┐
│     Leaf     │              │
├──────────────┤     Map      │
│    Graph     │              │
└──────────────┴──────────────┘
```

### Component Hierarchy

```
+page.svelte (State Management)
├── PaneToolbar.svelte (Drag Source)
│   └── Draggable pane type buttons
└── PaneLayout.svelte (Recursive Renderer)
    ├── PaneGroup (horizontal/vertical)
    │   ├── Pane
    │   │   └── PaneLayout (recursive)
    │   ├── PaneResizer
    │   └── Pane
    │       └── PaneLayout (recursive)
    └── DropZone (Drop Target)
        └── Leaf/Custom content
```

## 🔄 Data Flow

### Adding a Pane

```
1. User drags pane type from toolbar
   │
   ├─→ DragEvent contains: { paneType: 'graph' }
   │
2. User hovers over a pane
   │
   ├─→ DropZone calculates position (top/bottom/left/right/center)
   ├─→ Visual indicator appears
   │
3. User drops
   │
   ├─→ handleDrop(nodeId, paneType, position) called
   ├─→ insertPane() mutates layout tree
   ├─→ ensureIds() ensures all nodes have IDs
   ├─→ layout variable reassigned (triggers reactivity)
   │
4. Svelte re-renders
   │
   └─→ New pane appears in layout
```

### Removing a Pane

```
1. User clicks (×) button
   │
   ├─→ handleRemove(nodeId) called
   │
2. removePane() finds and removes node
   │
   ├─→ Parent's panes array updated
   ├─→ If parent has 1 child, collapse parent
   ├─→ Recalculate sizes for remaining panes
   │
3. layout variable reassigned
   │
4. Svelte re-renders
   │
   └─→ Pane removed, layout restructured
```

## 🛠️ Key Utilities

### layoutUtils.ts

| Function                                  | Purpose                          | Example                                            |
| ----------------------------------------- | -------------------------------- | -------------------------------------------------- |
| `ensureIds(node)`                         | Add unique IDs to all nodes      | `layout = ensureIds(layout)`                       |
| `insertPane(root, targetId, type, pos)`   | Insert new pane                  | `insertPane(layout, 'node-123', 'graph', 'right')` |
| `removePane(root, targetId)`              | Remove pane from tree            | `removePane(layout, 'node-123')`                   |
| `findNode(root, targetId)`                | Find node by ID                  | `findNode(layout, 'node-123')`                     |
| `findParent(root, targetId)`              | Find node's parent               | `findParent(layout, 'node-123')`                   |
| `movePane(root, sourceId, targetId, pos)` | Move existing pane               | `movePane(layout, 'node-1', 'node-2', 'right')`    |
| `isDescendant(root, nodeId, targetId)`    | Check if target is child of node | `isDescendant(layout, 'node-1', 'node-2')`         |
| `generateId()`                            | Create unique ID                 | `generateId() // 'node-1234567890-abc'`            |

## 🎨 Drop Position Logic

The drop position is calculated based on mouse coordinates:

```typescript
// Calculate center of pane
const centerX = rect.width / 2;
const centerY = rect.height / 2;

// Distance from center
const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));

// Within 25% of center? → Center drop
if (distance < threshold) {
	return 'center';
}

// Otherwise, find closest edge
const distances = {
	top: y,
	bottom: rect.height - y,
	left: x,
	right: rect.width - x
};
return closestEdge(distances);
```

### Visual Indicators

| Position | Indicator Style | Size                   |
| -------- | --------------- | ---------------------- |
| Top      | Horizontal bar  | 8px height, full width |
| Bottom   | Horizontal bar  | 8px height, full width |
| Left     | Vertical bar    | 8px width, full height |
| Right    | Vertical bar    | 8px width, full height |
| Center   | Dashed overlay  | Full pane with overlay |

All indicators pulse with animation for visibility.

## 🧩 Tree Mutation Logic

### Center Drop (Split)

**Before:**

```typescript
{ type: 'leaf', id: 'A' }
```

**After:**

```typescript
{
    type: 'horizontal', // randomly horizontal or vertical
    id: 'group-new',
    panes: [
        { type: 'leaf', id: 'A', defaultSize: 50 },
        { type: 'graph', id: 'B', defaultSize: 50 }
    ]
}
```

### Edge Drop (Insert)

**Scenario 1: Parent has correct direction**

Parent is horizontal, dropping to the right:

```typescript
// Before
parent: {
    type: 'horizontal',
    panes: [A, B, C]
}

// After (insert new pane D after B)
parent: {
    type: 'horizontal',
    panes: [A, B, D, C]  // D inserted
}
```

**Scenario 2: Parent has wrong direction**

Parent is horizontal, dropping above (needs vertical):

```typescript
// Before
parent: {
    type: 'horizontal',
    panes: [A, B, C]
}

// After (replace B with a vertical group)
parent: {
    type: 'horizontal',
    panes: [
        A,
        {
            type: 'vertical',
            panes: [D, B]  // D above B in new group
        },
        C
    ]
}
```

### Remove with Collapse

**Before:**

```typescript
{
    type: 'horizontal',
    panes: [
        A,
        {
            type: 'vertical',
            panes: [B, C]
        }
    ]
}
```

**Remove B:**

```typescript
{
    type: 'horizontal',
    panes: [
        A,
        C  // Vertical group collapsed, C moved up
    ]
}
```

## 🎨 Customization

### Adding Custom Pane Types

**1. Define in PaneToolbar.svelte:**

```typescript
const paneTypes = [
	{
		type: 'terminal',
		label: 'Terminal',
		icon: '💻',
		color: 'bg-black hover:bg-gray-800'
	}
];
```

**2. Handle in PaneLayout.svelte:**

```svelte
{:else if layout.type === 'terminal'}
    <DropZone nodeId={layout.id || ''} {onDrop}>
        <Terminal />
    </DropZone>
{/if}
```

### Styling Drop Indicators

Edit `DropZone.svelte`:

```css
.drop-indicator {
	background: rgba(34, 197, 94, 0.5); /* Green */
	border: 2px solid rgb(34, 197, 94);
}

.drop-indicator.center {
	background: rgba(34, 197, 94, 0.2);
	border: 3px dashed rgb(34, 197, 94);
}
```

### Changing Pane Toolbar Position

Move toolbar to the right side:

```svelte
<div class="h-screen w-full flex">
	<!-- Swap order -->
	<div class="flex-1 overflow-hidden">
		<PaneLayout {layout} {onDrop} {onRemove} />
	</div>
	<PaneToolbar />
</div>
```

## 📊 State Management Example

### Basic Setup

```svelte
<script lang="ts">
	import PaneLayout from './PaneLayout.svelte';
	import PaneToolbar from '$lib/components/PaneToolbar.svelte';
	import { ensureIds, insertPane, removePane } from '$lib/layoutUtils';
	import type { LayoutNode, DropPosition } from '$lib/types';

	// Initialize layout with IDs
	let layout: LayoutNode = ensureIds({
		type: 'horizontal',
		panes: [
			{ type: 'leaf', defaultSize: 50 },
			{ type: 'leaf', defaultSize: 50 }
		]
	});

	// Handle drop events
	function handleDrop(nodeId: string, paneType: string, position: DropPosition) {
		layout = ensureIds(insertPane(layout, nodeId, paneType, position));
	}

	// Handle remove events
	function handleRemove(nodeId: string) {
		const newLayout = removePane(layout, nodeId);
		if (newLayout) {
			layout = ensureIds(newLayout);
		}
	}
</script>

<div class="h-screen w-full flex">
	<PaneToolbar />
	<div class="flex-1 overflow-hidden">
		<PaneLayout {layout} onDrop={handleDrop} onRemove={handleRemove} />
	</div>
</div>
```

### With Persistence

```typescript
import { browser } from '$app/environment';

// Load from localStorage
function loadLayout(): LayoutNode {
	if (browser) {
		const saved = localStorage.getItem('layout');
		if (saved) {
			return ensureIds(JSON.parse(saved));
		}
	}
	return getDefaultLayout();
}

// Save to localStorage
function saveLayout(layout: LayoutNode) {
	if (browser) {
		localStorage.setItem('layout', JSON.stringify(layout));
	}
}

let layout = loadLayout();

// Auto-save on changes
$: if (browser) saveLayout(layout);
```

## 🔍 Debugging

### Enable Logging

```typescript
function handleDrop(nodeId: string, paneType: string, position: DropPosition) {
	console.log('Drop Event:', { nodeId, paneType, position });
	console.log('Before:', structuredClone(layout));

	layout = ensureIds(insertPane(layout, nodeId, paneType, position));

	console.log('After:', structuredClone(layout));
}
```

### Visualize Tree Structure

```typescript
function printTree(node: LayoutNode, depth = 0) {
	const indent = '  '.repeat(depth);
	console.log(`${indent}${node.type} (${node.id})`);
	if (node.panes) {
		node.panes.forEach((pane) => printTree(pane, depth + 1));
	}
}

printTree(layout);
```

## ⚡ Performance Considerations

### Current Implementation

- Uses `structuredClone()` for immutable updates
- Svelte keying with unique IDs for efficient diffing
- Drop position calculated on every `mousemove` (throttling recommended for complex layouts)

### Optimization Tips

1. **Throttle drag calculations** for layouts with 10+ panes
2. **Memoize** tree traversal functions if layout is large
3. **Virtualize** if you have 50+ panes visible
4. **Debounce** localStorage saves to reduce I/O

## 🚀 Next Steps

### Recommended Enhancements

1. **Undo/Redo** - Track layout history for undo/redo operations
2. **Keyboard shortcuts** - Add/remove/navigate panes without mouse
3. **~~Drag to reorder~~** - ✅ **IMPLEMENTED!** Drag existing panes to move them
4. **Copy mode** - Hold Ctrl while dragging to copy instead of move
5. **Layout presets** - Quick load common layouts
6. **Pane locking** - Prevent accidental removal of important panes
7. **Tabs in panes** - Multiple views within a single pane
8. **Min/max pixel sizes** - Size constraints in pixels, not percentages
9. **Export/import** - Share layouts as JSON files
10. **Drag animation** - Smooth visual transitions when moving panes

### Integration Ideas

- **Route-based layouts** - Different layouts for different routes
- **User profiles** - Save layouts per user
- **Responsive breakpoints** - Different layouts for mobile/tablet/desktop
- **Real-time collaboration** - Share layout changes between users

## 📚 Related Documentation

- `PANE_LAYOUT.md` - Basic nested layout concepts
- `DRAG_DROP_GUIDE.md` - Comprehensive drag-and-drop guide
- Component JSDoc comments for API details

## 🤝 Contributing

When adding features:

1. Maintain immutability in tree operations
2. Always use `ensureIds()` after mutations
3. Add visual feedback for user actions
4. Test edge cases (empty layout, single pane, etc.)
5. Update type definitions as needed

## 📝 License

Same as parent project.

---

**Implementation Date:** 2024
**Status:** ✅ Complete and functional
**Dependencies:** Svelte 4+, Paneforge, TypeScript
