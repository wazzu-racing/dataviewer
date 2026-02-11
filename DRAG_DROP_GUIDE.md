# Drag-and-Drop Pane Layout Guide

This guide explains how to use and customize the drag-and-drop functionality for dynamically adding and removing panes in your layout.

## Overview

The drag-and-drop system allows users to:
- **Drag** pane types from the toolbar into the layout
- **Drop** them in specific positions to split or replace existing panes
- **Remove** panes with a click
- See **real-time visual feedback** during dragging

## Architecture

### Components

1. **`PaneToolbar.svelte`** - Sidebar with draggable pane type buttons
2. **`DropZone.svelte`** - Wrapper component that detects drop positions
3. **`PaneLayout.svelte`** - Recursive layout renderer with drop zones
4. **`layoutUtils.ts`** - Tree manipulation utilities

### Data Flow

```
User drags pane type → DropZone detects position → handleDrop callback
→ insertPane() mutates tree → layout updates → UI re-renders
```

## How It Works

### 1. Drag Initiation

When a user drags a pane type from the toolbar:

```typescript
function handleDragStart(event: DragEvent, paneType: string) {
    const dragItem: DragItem = { paneType };
    event.dataTransfer.setData('application/json', JSON.stringify(dragItem));
}
```

The pane type (e.g., 'graph', 'map', 'leaf') is serialized and attached to the drag event.

### 2. Drop Position Detection

As the user hovers over a pane, `DropZone.svelte` calculates which position they're targeting:

- **Center** - Mouse is within 25% of the pane's center → splits the pane
- **Top** - Mouse is closest to top edge → inserts above
- **Bottom** - Mouse is closest to bottom edge → inserts below
- **Left** - Mouse is closest to left edge → inserts to the left
- **Right** - Mouse is closest to right edge → inserts to the right

```typescript
// Center detection
const distanceFromCenter = Math.sqrt(
    Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2)
);
if (distanceFromCenter < threshold) {
    dropPosition = 'center';
}
```

### 3. Visual Feedback

Different indicators appear based on drop position:

| Position | Indicator | Meaning |
|----------|-----------|---------|
| Top | Blue horizontal bar at top | Insert above |
| Bottom | Blue horizontal bar at bottom | Insert below |
| Left | Blue vertical bar at left | Insert to left |
| Right | Blue vertical bar at right | Insert to right |
| Center | Blue dashed overlay with "+" | Replace/split |

### 4. Layout Tree Mutation

When the drop occurs, `insertPane()` modifies the layout tree:

#### Center Drop (Replace)
```typescript
// Target node is replaced with a group containing both panes
{
    type: 'leaf',
    id: 'node-1'
}
// Becomes:
{
    type: 'horizontal', // or 'vertical'
    id: 'node-group',
    panes: [
        { type: 'leaf', id: 'node-1', defaultSize: 50 },
        { type: 'graph', id: 'node-2', defaultSize: 50 }
    ]
}
```

#### Edge Drop (Insert)
```typescript
// For top/bottom: needs vertical group
// For left/right: needs horizontal group

// If parent already has correct direction:
parent.panes.splice(insertIndex, 0, newPane);

// If parent has wrong direction:
// Wrap target and new pane in a new group
```

### 5. Node Removal

When the remove button (×) is clicked:

```typescript
function handleRemove(nodeId: string) {
    const newLayout = removePane(layout, nodeId);
    if (newLayout) {
        layout = ensureIds(newLayout);
    }
}
```

The `removePane()` function:
1. Finds the node's parent
2. Removes the node from parent's panes array
3. Collapses parent if it has only one child remaining
4. Returns the updated tree

## Key Functions

### `ensureIds(node: LayoutNode): LayoutNode`

Recursively adds unique IDs to all nodes that don't have one. IDs are required for:
- Tracking nodes during drag-and-drop
- Efficient Svelte keying
- Tree navigation

```typescript
const layout = ensureIds({
    type: 'horizontal',
    panes: [
        { type: 'leaf' },
        { type: 'graph' }
    ]
});
// Now each node has a unique ID
```

### `insertPane(root, targetId, paneType, position): LayoutNode`

Inserts a new pane at the specified position:

```typescript
// Insert a graph to the right of node-123
const newLayout = insertPane(
    layout,           // Current layout
    'node-123',       // Target node ID
    'graph',          // Pane type to insert
    'right'           // Position
);
```

**Parameters:**
- `root` - The layout tree root
- `targetId` - ID of the node to insert relative to
- `paneType` - Type of pane to create ('leaf', 'graph', etc.)
- `position` - Where to insert ('top', 'bottom', 'left', 'right', 'center')

### `removePane(root, targetId): LayoutNode | null`

Removes a pane from the tree:

```typescript
const newLayout = removePane(layout, 'node-123');
```

Automatically collapses parent groups that end up with only one child.

### `findNode(root, targetId): LayoutNode | null`

Searches the tree for a node by ID:

```typescript
const node = findNode(layout, 'node-123');
if (node) {
    console.log('Found:', node.type);
}
```

### `findParent(root, targetId): { parent, index } | null`

Finds a node's parent and its index within the parent:

```typescript
const result = findParent(layout, 'node-123');
if (result.parent) {
    console.log('Parent:', result.parent.id);
    console.log('Child index:', result.index);
}
```

## Usage Example

### Basic Setup

```svelte
<script lang="ts">
    import PaneLayout from './PaneLayout.svelte';
    import PaneToolbar from '$lib/components/PaneToolbar.svelte';
    import { ensureIds, insertPane, removePane } from '$lib/layoutUtils';
    import type { LayoutNode, DropPosition } from '$lib/types';

    let layout: LayoutNode = ensureIds({
        type: 'horizontal',
        panes: [
            { type: 'leaf', defaultSize: 50 },
            { type: 'leaf', defaultSize: 50 }
        ]
    });

    function handleDrop(nodeId: string, paneType: string, position: DropPosition) {
        layout = ensureIds(insertPane(layout, nodeId, paneType, position));
    }

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

### Adding Custom Pane Types

In `PaneToolbar.svelte`, add to the `paneTypes` array:

```typescript
const paneTypes: PaneType[] = [
    // ... existing types
    { 
        type: 'video', 
        label: 'Video Player', 
        icon: '🎥', 
        color: 'bg-red-100 hover:bg-red-200' 
    },
    { 
        type: 'terminal', 
        label: 'Terminal', 
        icon: '💻', 
        color: 'bg-gray-100 hover:bg-gray-200' 
    }
];
```

Then handle the custom type in `PaneLayout.svelte`:

```svelte
{#if layout.type === 'video'}
    <div class="h-full w-full">
        <VideoPlayer />
    </div>
{:else if layout.type === 'terminal'}
    <div class="h-full w-full">
        <Terminal />
    </div>
{/if}
```

## Styling Drop Indicators

Customize the drop zone appearance in `DropZone.svelte`:

```css
.drop-indicator {
    background: rgba(59, 130, 246, 0.5); /* Blue with transparency */
    border: 2px solid rgb(59, 130, 246);
    animation: pulse 1s ease-in-out infinite;
}

.drop-indicator.center {
    border: 3px dashed rgb(59, 130, 246);
}

@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
}
```

## Advanced Features

### Persisting Layout State

Save and restore layouts from localStorage:

```typescript
import { browser } from '$app/environment';

// Save layout
function saveLayout(layout: LayoutNode) {
    if (browser) {
        localStorage.setItem('pane-layout', JSON.stringify(layout));
    }
}

// Load layout
function loadLayout(): LayoutNode | null {
    if (browser) {
        const saved = localStorage.getItem('pane-layout');
        if (saved) {
            return ensureIds(JSON.parse(saved));
        }
    }
    return null;
}

// Usage
let layout = loadLayout() ?? getDefaultLayout();
$: saveLayout(layout); // Auto-save on changes
```

### Undo/Redo

Track layout history:

```typescript
let layoutHistory: LayoutNode[] = [layout];
let historyIndex = 0;

function handleDrop(nodeId: string, paneType: string, position: DropPosition) {
    const newLayout = ensureIds(insertPane(layout, nodeId, paneType, position));
    
    // Add to history
    layoutHistory = [...layoutHistory.slice(0, historyIndex + 1), newLayout];
    historyIndex = layoutHistory.length - 1;
    layout = newLayout;
}

function undo() {
    if (historyIndex > 0) {
        historyIndex--;
        layout = layoutHistory[historyIndex];
    }
}

function redo() {
    if (historyIndex < layoutHistory.length - 1) {
        historyIndex++;
        layout = layoutHistory[historyIndex];
    }
}
```

### Layout Presets

Define and switch between preset layouts:

```typescript
const presets = {
    dashboard: {
        type: 'horizontal',
        panes: [
            { type: 'graph', defaultSize: 70 },
            {
                type: 'vertical',
                defaultSize: 30,
                panes: [
                    { type: 'map', defaultSize: 50 },
                    { type: 'table', defaultSize: 50 }
                ]
            }
        ]
    },
    
    simple: {
        type: 'horizontal',
        panes: [
            { type: 'leaf', defaultSize: 50 },
            { type: 'leaf', defaultSize: 50 }
        ]
    }
};

function loadPreset(name: keyof typeof presets) {
    layout = ensureIds(presets[name]);
}
```

### Constraints and Validation

Prevent certain operations:

```typescript
function handleDrop(nodeId: string, paneType: string, position: DropPosition) {
    // Limit maximum depth
    const depth = calculateDepth(layout, nodeId);
    if (depth >= 5) {
        alert('Maximum nesting depth reached');
        return;
    }
    
    // Limit total number of panes
    const paneCount = countPanes(layout);
    if (paneCount >= 20) {
        alert('Maximum number of panes reached');
        return;
    }
    
    layout = ensureIds(insertPane(layout, nodeId, paneType, position));
}

function calculateDepth(node: LayoutNode, targetId: string, depth = 0): number {
    if (node.id === targetId) return depth;
    if (node.panes) {
        for (const pane of node.panes) {
            const result = calculateDepth(pane, targetId, depth + 1);
            if (result > 0) return result;
        }
    }
    return 0;
}
```

## Troubleshooting

### Drop zones not working
- Ensure all nodes have unique IDs (use `ensureIds()`)
- Check that `onDrop` and `onRemove` callbacks are passed down correctly
- Verify `dragover` event has `preventDefault()` called

### Layout doesn't update after drop
- Make sure you're reassigning the layout variable: `layout = newLayout`
- Use `ensureIds()` after mutations to trigger Svelte reactivity
- Check browser console for errors

### Visual indicators not appearing
- Verify CSS is loaded correctly
- Check z-index values for conflicts
- Ensure `isDraggingOver` state is being set properly

### Performance issues with many panes
- Consider virtualizing large layouts
- Debounce drag position calculations
- Use `requestAnimationFrame` for smooth animations

## Best Practices

1. **Always use `ensureIds()`** after loading or mutating layouts
2. **Clone before mutating** - `structuredClone()` is used internally
3. **Validate drop operations** before applying them
4. **Provide visual feedback** at every stage of drag-and-drop
5. **Test edge cases** like removing the last pane or dropping on root
6. **Persist layouts** so users don't lose their configuration
7. **Set size limits** to prevent infinite nesting or too many panes

## Future Enhancements

Potential features to add:

- **Drag-to-reorder** - Drag panes to swap positions
- **Pane locking** - Prevent certain panes from being removed/modified
- **Keyboard shortcuts** - Quick actions without dragging
- **Layout templates** - Pre-built layouts for common use cases
- **Pane resizing constraints** - Min/max pixel sizes instead of percentages
- **Multi-select** - Operate on multiple panes at once
- **Collapsible panes** - Temporarily hide panes without removing them
- **Tabs within panes** - Multiple content views in a single pane
