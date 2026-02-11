# Move Panes Guide

This guide explains how to move existing panes around in your layout using drag-and-drop.

## 🎯 Overview

In addition to adding new panes from the toolbar, you can now **move existing panes** to reorganize your layout:

- **Drag** the header bar of any pane to start moving it
- **Drop** it on another pane to reposition it
- **Visual feedback** shows the difference between adding (blue) and moving (purple)
- **Smart prevention** - can't drop a pane onto itself or its children

## 🎮 How to Move Panes

### Step 1: Click and Drag the Header

Every pane has a **draggable header bar** at the top:

```
┌─────────────────────────────────┐
│ ⋮⋮  Blank Pane              [×] │ ← Drag this header
├─────────────────────────────────┤
│                                 │
│         Pane Content            │
│                                 │
└─────────────────────────────────┘
```

- **⋮⋮ Icon** - Indicates the pane is draggable
- **Pane Title** - Shows the pane type
- **[×] Button** - Remove button (click to delete)

### Step 2: Hover Over Target

As you drag, hover over another pane. You'll see **purple indicators** (different from the blue "add" indicators):

| Position    | Indicator Color       | Action                     |
| ----------- | --------------------- | -------------------------- |
| Top edge    | 🟣 Purple             | Move above target          |
| Bottom edge | 🟣 Purple             | Move below target          |
| Left edge   | 🟣 Purple             | Move to left of target     |
| Right edge  | 🟣 Purple             | Move to right of target    |
| Center      | 🟣 Purple "Move here" | Move and split with target |

### Step 3: Release to Move

Release the mouse button to complete the move. The pane is:

1. Removed from its original location
2. Inserted at the new location
3. Layout automatically restructures

## 📊 Visual Indicators

### Add Operation (Blue)

When dragging from the **toolbar**:

```
████████████████████  ← Blue bar
┌─────────────────┐
│      Target     │
│                 │
└─────────────────┘

Center: Blue overlay with "+"
```

### Move Operation (Purple)

When dragging an **existing pane**:

```
████████████████████  ← Purple bar
┌─────────────────┐
│      Target     │
│                 │
└─────────────────┘

Center: Purple overlay with "↔"
```

## 🎨 Example Scenarios

### Scenario 1: Swap Positions

**Before:**

```
┌──────┬──────┐
│  A   │  B   │
└──────┴──────┘
```

**Action:** Drag A to the right edge of B

**After:**

```
┌──────┬──────┐
│  B   │  A   │
└──────┴──────┘
```

### Scenario 2: Move to Different Section

**Before:**

```
┌──────┬──────┐
│  A   │  C   │
├──────┤      │
│  B   │      │
└──────┴──────┘
```

**Action:** Drag B to the bottom edge of C

**After:**

```
┌──────┬──────┐
│      │  C   │
│  A   ├──────┤
│      │  B   │
└──────┴──────┘
```

### Scenario 3: Extract from Nested Group

**Before:**

```
┌──────┬──────┐
│  A   │  B   │
│      ├──────┤
│      │  C   │
└──────┴──────┘

Tree:
horizontal
├── A
└── vertical
    ├── B
    └── C
```

**Action:** Drag B to the right edge of A

**After:**

```
┌────┬────┬────┐
│ A  │ B  │ C  │
└────┴────┴────┘

Tree:
horizontal
├── A
├── B
└── C (vertical group collapsed)
```

## 🚫 Restrictions

### Can't Drop on Self

```
┌─────────────────┐
│   Dragging A    │  ← Can't drop A onto A
│                 │
└─────────────────┘
```

### Can't Drop on Descendants

```
A (dragging)
└── vertical
    ├── B
    └── C  ← Can't drop A onto B or C
```

**Why?** This would create an invalid tree structure (infinite loop).

### Visual Feedback for Invalid Drops

When hovering over an invalid target:

- Drop zone doesn't appear
- Cursor shows "not-allowed" icon
- No indicator bars

## 🔄 How Move Works Internally

### 1. Remove from Source

```typescript
// Remove pane from its current location
const withoutSource = removePane(layout, sourceId);
```

### 2. Insert at Target

```typescript
// Insert at new position
const result = insertPane(withoutSource, targetId, sourceNode.type, position);
```

### 3. Preserve Structure

The moved pane keeps all its properties:

- Child panes (if it's a group)
- Size preferences
- Custom settings
- Unique ID

### 4. Handle Collapsed Parents

If removing the pane causes its parent to collapse (only 1 child remains), the layout automatically restructures:

```typescript
// Before: Parent has 2 children
parent: { type: 'horizontal', panes: [A, B] }

// Remove A
parent: B  // Parent collapsed, B promoted
```

## ⌨️ Keyboard Shortcuts (Future)

Planned enhancements:

- **Shift + Drag** - Snap to edges only (no center drop)
- **Ctrl + Drag** - Copy instead of move
- **Arrow keys** - Move pane in direction
- **Escape** - Cancel drag operation

## 🎓 Advanced Tips

### 1. Reorganize Complex Layouts Quickly

Instead of rebuilding, just drag panes to new positions. Much faster than removing and re-adding!

### 2. Extract Nested Panes

Drag deeply nested panes to the top level to simplify your layout.

### 3. Visual Grouping

Use move to group related panes together:

- All graphs in one section
- All maps in another
- Data tables at the bottom

### 4. Experiment Freely

Moving is non-destructive - if you don't like the result, just move it again or use undo (if implemented).

### 5. Watch the Purple Indicators

Purple = moving an existing pane
Blue = adding a new pane

This helps you understand what operation you're performing.

## 🔧 Implementation Details

### Data Structure Changes

```typescript
type DragItem = {
	paneType?: string; // For add operations
	nodeId?: string; // For move operations
	operation: 'add' | 'move';
};
```

### Move Function Signature

```typescript
function movePane(
	root: LayoutNode,
	sourceId: string, // ID of pane to move
	targetId: string, // ID of target pane
	position: DropPosition
): LayoutNode | null;
```

### Validation Checks

1. **Self-check**: `sourceId !== targetId`
2. **Descendant-check**: `!isDescendant(root, sourceId, targetId)`
3. **Existence-check**: Both nodes must exist

## 🐛 Troubleshooting

### Pane disappears after moving

- Check console for errors
- The target might have been removed during the operation
- Try refreshing and moving again

### Can't drop pane anywhere

- You might be trying to drop on itself or a child
- Try a different target pane
- Check that the pane header is being dragged (not the content)

### Layout looks broken after move

- The tree might have invalid structure
- Clear layout: `localStorage.clear()`
- Refresh page to reset

### Drag doesn't start

- Make sure you're dragging the **header bar**, not the content
- Look for the ⋮⋮ icon - that's the drag handle
- Check that draggable="true" is set

## 📈 Performance Considerations

### Move Operation Complexity

- **Remove**: O(n) where n = number of nodes
- **Insert**: O(n)
- **Total**: O(n) - linear time

### For Large Layouts (100+ panes)

- Consider batching multiple moves
- Debounce move operations
- Show loading indicator for complex moves

## 🎨 Customization

### Change Move Indicator Color

Edit `DropZone.svelte`:

```css
.drop-indicator.move {
	background: rgba(34, 197, 94, 0.5); /* Green */
	border: 2px solid rgb(34, 197, 94);
}

.center-overlay.move {
	background: rgba(34, 197, 94, 0.9);
}
```

### Change Drag Handle Style

Edit `PaneLayout.svelte`:

```css
.drag-handle {
	background: linear-gradient(to bottom, #3b82f6 0%, #2563eb 100%);
	color: white;
}

.drag-icon {
	color: white;
}
```

### Add Custom Drag Image

```typescript
function handleDragStart(event: DragEvent, nodeId: string, paneType: string) {
	// Create custom drag image
	const dragImage = document.createElement('div');
	dragImage.textContent = `Moving: ${paneType}`;
	dragImage.style.cssText = 'position: absolute; top: -1000px;';
	document.body.appendChild(dragImage);

	event.dataTransfer?.setDragImage(dragImage, 0, 0);

	setTimeout(() => document.body.removeChild(dragImage), 0);
}
```

## 📚 Related Documentation

- **`DRAG_DROP_GUIDE.md`** - Adding new panes
- **`VISUAL_REFERENCE.md`** - Visual examples of all operations
- **`IMPLEMENTATION_SUMMARY.md`** - Complete technical overview

## 🚀 Future Enhancements

### Planned Features

1. **Undo/Redo** - Revert move operations
2. **Drag preview** - Show ghost pane while dragging
3. **Snap zones** - Magnetic edges for precise placement
4. **Multi-select** - Move multiple panes at once
5. **Keyboard navigation** - Move panes with arrow keys
6. **Animation** - Smooth transitions when moving
7. **Copy mode** - Duplicate instead of move
8. **Swap animation** - Visual feedback when swapping positions

## ✅ Quick Reference

| Task                     | Steps                                                                                   |
| ------------------------ | --------------------------------------------------------------------------------------- |
| **Move a pane**          | 1. Drag pane header<br>2. Hover over target<br>3. Release when purple indicator appears |
| **Move to edge**         | Hover near edge of target pane                                                          |
| **Move to center**       | Hover in center of target pane                                                          |
| **Cancel move**          | Release outside any pane                                                                |
| **Identify move vs add** | Purple = move, Blue = add                                                               |

---

**Move panes freely to create your perfect layout!** 🎨

For questions or issues, see the complete implementation in `IMPLEMENTATION_SUMMARY.md`.
