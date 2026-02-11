# Drag-and-Drop Pane Layout System

A complete implementation of arbitrarily nested, drag-and-drop pane layouts for data visualization and dashboard applications.

## 🎯 Features at a Glance

✅ **Arbitrarily Nested Layouts** - Create complex layouts with panes inside panes  
✅ **Add New Panes** - Drag pane types from toolbar (blue indicators)  
✅ **Move Existing Panes** - Drag pane headers to reorganize (purple indicators)  
✅ **Smart Drop Zones** - Visual feedback shows exactly where panes will go  
✅ **Remove Panes** - Click × button to delete any pane  
✅ **Resizable** - Drag dividers to adjust pane sizes  
✅ **Auto-Restructuring** - Tree automatically reorganizes as you modify it  
✅ **Type-Safe** - Full TypeScript implementation

## 🚀 Quick Start

### 1. Run the Application

```bash
npm run dev
```

Navigate to `http://localhost:5173`

### 2. Add a New Pane

1. Look at the **dark sidebar** on the left
2. **Drag** a pane type (📄 Blank, 📊 Graph, 🗺️ Map, etc.)
3. **Hover** over the layout area
4. See **blue indicators** showing drop positions
5. **Release** to add the pane

### 3. Move an Existing Pane

1. Look for the **⋮⋮ icon** in any pane's header bar
2. **Drag** the header (not the content)
3. **Hover** over another pane
4. See **purple indicators** showing move positions
5. **Release** to move the pane

### 4. Remove a Pane

Click the **red × button** in the top-right corner of any pane.

### 5. Resize Panes

Drag the **gray dividers** between panes.

## 🎨 Visual Indicators

### Blue = Adding New Panes

When dragging from the toolbar:

- **Blue bars** on edges → Insert adjacent to target
- **Blue dashed overlay** at center → Split target pane
- **Text**: "Drop to split"
- **Icon**: +

### Purple = Moving Existing Panes

When dragging a pane header:

- **Purple bars** on edges → Move adjacent to target
- **Purple overlay** at center → Move and group with target
- **Text**: "Move here"
- **Icon**: ↔

## 📊 Drop Positions

| Position   | Visual                   | Effect                                         |
| ---------- | ------------------------ | ---------------------------------------------- |
| **Top**    | Horizontal bar at top    | Insert above target                            |
| **Bottom** | Horizontal bar at bottom | Insert below target                            |
| **Left**   | Vertical bar at left     | Insert to left of target                       |
| **Right**  | Vertical bar at right    | Insert to right of target                      |
| **Center** | Dashed overlay           | Split target (add) or group with target (move) |

## 🏗️ Examples

### Create a Dashboard Layout

**Step 1:** Start with default layout

```
┌──────────┐
│   Leaf   │
└──────────┘
```

**Step 2:** Add Graph to the right

```
┌─────┬─────┐
│Leaf │Graph│
└─────┴─────┘
```

**Step 3:** Add Map below Graph

```
┌─────┬─────┐
│Leaf │Graph│
│     ├─────┤
│     │ Map │
└─────┴─────┘
```

**Step 4:** Add Table below Leaf

```
┌─────┬─────┐
│Leaf │Graph│
├─────┼─────┤
│Table│ Map │
└─────┴─────┘
```

### Reorganize by Moving Panes

**Before:**

```
┌───┬───┬───┐
│ A │ B │ C │
└───┴───┴───┘
```

**Action:** Drag A's header to right of C (purple indicator)

**After:**

```
┌───┬───┬───┐
│ B │ C │ A │
└───┴───┴───┘
```

## 🔧 Architecture

### Data Structure

```typescript
type LayoutNode = {
	type: 'horizontal' | 'vertical' | 'leaf' | 'graph' | 'map' | string;
	panes?: LayoutNode[];
	defaultSize?: number;
	minSize?: number;
	id?: string;
};
```

### Key Components

- **PaneToolbar** - Draggable pane types sidebar
- **DropZone** - Detects drop position and shows indicators
- **PaneLayout** - Recursive renderer for nested layouts
- **layoutUtils** - Tree manipulation utilities

### Core Functions

```typescript
ensureIds(layout)           // Add unique IDs to all nodes
insertPane(...)             // Add new pane at position
movePane(...)               // Move existing pane
removePane(...)             // Remove pane and collapse tree
findNode(...)               // Search tree by ID
```

## 🎓 Advanced Usage

### Save Layout to localStorage

```typescript
import { browser } from '$app/environment';

// Auto-save on changes
$: if (browser) {
	localStorage.setItem('layout', JSON.stringify(layout));
}

// Load on startup
function loadLayout() {
	if (browser) {
		const saved = localStorage.getItem('layout');
		return saved ? ensureIds(JSON.parse(saved)) : getDefault();
	}
}
```

### Add Custom Pane Type

**1. Add to toolbar** (`PaneToolbar.svelte`):

```typescript
{
    type: 'terminal',
    label: 'Terminal',
    icon: '💻',
    color: 'bg-gray-100 hover:bg-gray-200'
}
```

**2. Handle in layout** (`PaneLayout.svelte`):

```svelte
{:else if layout.type === 'terminal'}
    <DropZone nodeId={layout.id || ''} {onDrop} {onMove}>
        <TerminalComponent />
    </DropZone>
{/if}
```

### Change Indicator Colors

**Edit `DropZone.svelte`:**

```css
/* Add operation (default: blue) */
.drop-indicator {
	background: rgba(34, 197, 94, 0.5); /* Green */
	border: 2px solid rgb(34, 197, 94);
}

/* Move operation (default: purple) */
.drop-indicator.move {
	background: rgba(249, 115, 22, 0.5); /* Orange */
	border: 2px solid rgb(249, 115, 22);
}
```

## 🚫 Restrictions

### Can't Drop Pane on Itself

When dragging a pane, you cannot drop it onto itself. No indicator will appear.

### Can't Drop on Descendants

You cannot move a parent pane onto its own children. This prevents invalid tree structures.

**Example:**

```
A (dragging)
└── B
    └── C  ❌ Can't drop A onto B or C
```

## 🐛 Troubleshooting

### Pane Won't Drag

- Make sure you're dragging the **header bar** (with ⋮⋮ icon)
- Don't drag the content area - only the header is draggable

### No Indicators Appear

- Might be trying to drop on itself or a descendant
- Try a different target pane
- Check browser console for errors

### Layout Breaks After Refresh

```javascript
// Clear saved layout
localStorage.removeItem('layout');
// Or better: add validation when loading
```

### Pane Disappears

- Check console for errors
- Target might have been collapsed during move
- Refresh page to reset

## 📚 Documentation

- **`QUICK_START.md`** - Get started in 5 minutes
- **`IMPLEMENTATION_SUMMARY.md`** - Complete technical overview
- **`DRAG_DROP_GUIDE.md`** - Advanced adding features
- **`MOVE_PANES_GUIDE.md`** - Comprehensive moving guide
- **`VISUAL_REFERENCE.md`** - ASCII diagrams of all operations
- **`PANE_LAYOUT.md`** - Layout structure concepts

## 💡 Pro Tips

1. **Blue vs Purple** - Remember: Blue = add new, Purple = move existing
2. **Center Drops** - Fastest way to split a pane in half
3. **Move First** - Reorganize by moving rather than delete + re-add
4. **Header Dragging** - Only the header (⋮⋮) is draggable, not content
5. **Start Simple** - Begin with 2-3 panes, expand as needed
6. **Save Often** - Implement localStorage to persist your layouts

## 🎯 Common Patterns

### Sidebar Layout

```typescript
{
    type: 'horizontal',
    panes: [
        { type: 'leaf', defaultSize: 20 },    // Sidebar
        { type: 'graph', defaultSize: 80 }    // Main
    ]
}
```

### Dashboard Grid

```typescript
{
    type: 'vertical',
    panes: [
        { type: 'graph', defaultSize: 60 },   // Top chart
        {
            type: 'horizontal',
            defaultSize: 40,
            panes: [
                { type: 'map', defaultSize: 33 },
                { type: 'table', defaultSize: 33 },
                { type: 'video', defaultSize: 34 }
            ]
        }
    ]
}
```

### Three Columns

```typescript
{
    type: 'horizontal',
    panes: [
        { type: 'leaf', defaultSize: 25 },
        { type: 'graph', defaultSize: 50 },
        { type: 'map', defaultSize: 25 }
    ]
}
```

## 🚀 Future Enhancements

### Planned

- [ ] Undo/Redo functionality
- [ ] Copy panes (Ctrl+Drag)
- [ ] Keyboard shortcuts
- [ ] Layout presets/templates
- [ ] Pane locking (prevent removal)
- [ ] Tabs within panes
- [ ] Min/max pixel sizes
- [ ] Export/import layouts
- [ ] Drag animations
- [ ] Multi-select panes

### Ideas

- Route-based layouts (different per page)
- User profiles (save layouts per user)
- Responsive breakpoints (mobile/tablet/desktop)
- Real-time collaboration
- Layout version history

## 📊 Performance

### Complexity

- **Insert Pane**: O(n) where n = number of nodes
- **Move Pane**: O(n)
- **Remove Pane**: O(n)
- **Find Node**: O(n)

### Optimization Tips

For layouts with 50+ panes:

- Throttle drag position calculations
- Debounce localStorage saves
- Consider virtualization for very large layouts

## ✅ Status

**Implementation**: ✅ Complete and functional  
**Testing**: ✅ No TypeScript/Svelte errors  
**Documentation**: ✅ Comprehensive guides available  
**Dependencies**: Svelte 4+, Paneforge, TypeScript

## 🤝 Contributing

When extending:

1. Maintain immutability in tree operations
2. Always use `ensureIds()` after mutations
3. Provide visual feedback for user actions
4. Test edge cases (empty, single pane, etc.)
5. Update type definitions

## 📝 License

Same as parent project.

---

**Ready to build?** Start with `QUICK_START.md` then explore the comprehensive guides! 🎉

For technical details, see `IMPLEMENTATION_SUMMARY.md`.
