# Quick Start Guide - Drag-and-Drop Pane Layouts

Get started with the drag-and-drop pane layout system in 5 minutes!

## 🚀 What You Get

- **Add new panes** - Drag pane types from the sidebar into your layout
- **Move existing panes** - Drag pane headers to reorganize your layout
- Drop them with visual indicators showing where they'll go (blue for add, purple for move)
- Remove panes with a click
- Resize panes by dragging the dividers
- Arbitrarily nested layouts (panes inside panes)

## 📦 Installation

The system is already integrated! Just run your dev server:

```bash
npm run dev
```

Navigate to `http://localhost:5173` to see it in action.

## 🎮 How to Use

### 1. Drag a Pane Type

Look at the **dark sidebar on the left**. You'll see pane types like:

- 📄 Blank
- 📊 Graph
- 🗺️ Map
- 📋 Table
- 🎥 Video

Click and drag any of these into the layout area.

### 2. Choose Where to Drop

As you drag over an existing pane, you'll see colored indicators:

| Hover Location  | Indicator          | What Happens              |
| --------------- | ------------------ | ------------------------- |
| **Top edge**    | Blue bar at top    | Inserts pane above        |
| **Bottom edge** | Blue bar at bottom | Inserts pane below        |
| **Left edge**   | Blue bar on left   | Inserts pane to the left  |
| **Right edge**  | Blue bar on right  | Inserts pane to the right |
| **Center**      | Blue dashed box    | Splits pane in half       |

### 3. Drop the Pane

Release the mouse to add the pane. The layout automatically restructures!

### 3.5. Move an Existing Pane

Every pane has a **draggable header** at the top with a ⋮⋮ icon. Click and drag this header to move the pane to a new location.

**Purple indicators** show where the pane will be moved (different from the blue "add" indicators).

### 4. Move a Pane

See the **⋮⋮ icon** in the header bar of each pane? That's the drag handle!

1. Click and drag the header (not the content)
2. Hover over another pane
3. Release when you see the **purple indicator**

The pane moves from its old location to the new one.

### 5. Remove a Pane

See the **red (×) button** in the top-right corner of each pane? Click it to remove that pane.

### 6. Resize Panes

Drag the **gray dividers** between panes to adjust their sizes.

## 💡 Examples

### Example 1: Move Panes Around

1. Start with any layout
2. Click and drag a pane's header (the gray bar at the top)
3. Hover over another pane until you see **purple indicators**
4. Drop → The pane moves to the new position!

### Example 2: Create a Two-Column Layout

1. Start with the default layout
2. Drag "Blank" pane from sidebar
3. Hover over existing pane until you see the **right edge** indicator
4. Drop → You now have two columns!

### Example 3: Create a Dashboard

1. Drag "Graph" → drop on **right edge** of first pane
2. Drag "Map" → drop on **bottom edge** of the graph
3. Drag "Table" → drop on **bottom edge** of the left pane

Result:

```
┌─────────┬─────────┐
│  Blank  │  Graph  │
├─────────┼─────────┤
│  Table  │   Map   │
└─────────┴─────────┘
```

### Example 4: Split a Pane

1. Drag any pane type
2. Hover over center of target until **dashed box** appears
3. Drop → The pane splits in half!

## 🔧 Basic Customization

### Change Initial Layout

Edit `src/routes/+page.svelte`:

```typescript
let layout: LayoutNode = ensureIds({
	type: 'horizontal',
	panes: [
		{ type: 'graph', defaultSize: 70 }, // 70% width
		{ type: 'map', defaultSize: 30 } // 30% width
	]
});
```

### Add Your Own Pane Type

1. **Add to toolbar** (`src/lib/components/PaneToolbar.svelte`):

```typescript
const paneTypes: PaneType[] = [
	// ... existing types
	{
		type: 'mycustom',
		label: 'My Custom',
		icon: '⚡',
		color: 'bg-yellow-100 hover:bg-yellow-200'
	}
];
```

2. **Handle in layout** (`src/routes/PaneLayout.svelte`):

```svelte
{:else if layout.type === 'mycustom'}
    <DropZone nodeId={layout.id || ''} {onDrop}>
        <div class="h-full w-full p-6">
            <h2>My Custom Pane</h2>
            <!-- Your custom component here -->
        </div>
    </DropZone>
{/if}
```

## 🎨 Styling Tips

### Change Drop Indicator Color

Edit `src/lib/components/DropZone.svelte`:

```css
.drop-indicator {
	background: rgba(34, 197, 94, 0.5); /* Green instead of blue */
	border: 2px solid rgb(34, 197, 94);
}
```

### Change Toolbar Width

Edit `src/lib/components/PaneToolbar.svelte`:

```css
.pane-toolbar {
	min-width: 250px; /* Wider toolbar */
	max-width: 300px;
}
```

## 💾 Save Your Layout

Add localStorage persistence to `src/routes/+page.svelte`:

```typescript
import { browser } from '$app/environment';

// Load saved layout on startup
function loadLayout(): LayoutNode {
	if (browser) {
		const saved = localStorage.getItem('my-layout');
		if (saved) {
			return ensureIds(JSON.parse(saved));
		}
	}
	return getDefaultLayout(); // Fallback
}

let layout = loadLayout();

// Auto-save whenever layout changes
$: if (browser) {
	localStorage.setItem('my-layout', JSON.stringify(layout));
}
```

Now your layout persists across page refreshes! 🎉

## 🐛 Troubleshooting

### "Nothing happens when I drop"

- Make sure you see a colored indicator (blue or purple) before dropping
- For moving panes, drag the **header bar**, not the content
- Check browser console for errors
- Try refreshing the page

### "Can't remove the last pane"

- This is by design - at least one pane must remain
- The layout root can't be deleted

### "Panes won't resize"

- Make sure you're dragging the gray **divider bars**, not the pane content
- Some very small panes might hit their minimum size

### "Can't move a pane"

- You can only drag the **header bar** (with the ⋮⋮ icon)
- You can't drop a pane onto itself
- You can't drop a pane onto its own children

### "Layout looks broken after refresh"

- Clear localStorage: `localStorage.removeItem('my-layout')`
- Or add better validation when loading saved layouts

## 📚 Learn More

- **`IMPLEMENTATION_SUMMARY.md`** - Complete technical overview
- **`DRAG_DROP_GUIDE.md`** - Advanced features and APIs for adding panes
- **`MOVE_PANES_GUIDE.md`** - Complete guide to moving panes around
- **`VISUAL_REFERENCE.md`** - ASCII diagrams of all operations
- **`PANE_LAYOUT.md`** - Layout structure concepts

## ✨ Pro Tips

1. **Try center drops** - They're the fastest way to split a pane
2. **Move instead of delete** - Reorganize by moving panes rather than removing and re-adding
3. **Watch indicator colors** - Blue = adding new, Purple = moving existing
4. **Remove and rebuild** - If layout gets messy, remove panes and start fresh
5. **Test edge cases** - Try dropping at different positions to understand the system
6. **Use keyboard + mouse** - Hold Shift while dragging for future enhancements
7. **Start simple** - Begin with 2-3 panes, then expand as needed

## 🎯 Common Patterns

### Sidebar Layout

```typescript
{
    type: 'horizontal',
    panes: [
        { type: 'leaf', defaultSize: 20 },    // Narrow sidebar
        { type: 'graph', defaultSize: 80 }    // Main content
    ]
}
```

### Dashboard Layout

```typescript
{
    type: 'vertical',
    panes: [
        { type: 'graph', defaultSize: 60 },   // Top chart
        {
            type: 'horizontal',
            defaultSize: 40,
            panes: [
                { type: 'map', defaultSize: 50 },
                { type: 'table', defaultSize: 50 }
            ]
        }
    ]
}
```

### Three-Column Layout

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

---

**Ready to build your perfect layout?** Start dragging! 🚀

For questions or issues, see the full documentation in `IMPLEMENTATION_SUMMARY.md`.
