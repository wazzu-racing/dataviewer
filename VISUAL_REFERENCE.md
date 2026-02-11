# Visual Reference Guide - Drag-and-Drop Pane Layouts

This guide provides visual examples of how the drag-and-drop pane layout system works.

## 🎨 Add vs Move Operations

### Adding New Panes (Blue Indicators)

When dragging from the **toolbar sidebar**, you're **adding** a new pane:

- **Indicator Color**: 🔵 Blue
- **Effect**: Creates a new pane
- **Source**: Toolbar buttons

### Moving Existing Panes (Purple Indicators)

When dragging a **pane header**, you're **moving** an existing pane:

- **Indicator Color**: 🟣 Purple
- **Effect**: Repositions existing pane
- **Source**: Pane header bar (⋮⋮ icon)

## 🎯 Drop Zones Explained

When you drag a pane type over an existing pane, different zones are detected based on mouse position:

```
┌─────────────────────────────────────┐
│          ⬆️ TOP ZONE                │
│  ┌───────────────────────────────┐  │
│  │                               │  │
│◀ │                               │ ▶│
│L │        CENTER ZONE            │ R│
│E │         (Split)               │ I│
│F │                               │ G│
│T │                               │ H│
│  │                               │ T│
│  └───────────────────────────────┘  │
│         ⬇️ BOTTOM ZONE               │
└─────────────────────────────────────┘
```

### Zone Detection Rules

- **Center Zone**: Within 25% of pane center
- **Edge Zones**: Closest to that edge (outer 75% of pane)

## 📊 Drop Position Examples

### 1. Top Drop

**Action:** Drag Graph pane to TOP of Leaf pane

**Before:**

```
┌─────────────────┐
│      Leaf       │
│                 │
│                 │
└─────────────────┘
```

**Visual Indicator:**

```
████████████████████  ← Blue bar
┌─────────────────┐
│      Leaf       │
│                 │
│                 │
└─────────────────┘
```

**After:**

```
┌─────────────────┐
│      Graph      │
├─────────────────┤
│      Leaf       │
└─────────────────┘
```

### 2. Bottom Drop

**Action:** Drag Map pane to BOTTOM of Leaf pane

**Before:**

```
┌─────────────────┐
│      Leaf       │
│                 │
└─────────────────┘
```

**Visual Indicator:**

```
┌─────────────────┐
│      Leaf       │
│                 │
└─────────────────┘
████████████████████  ← Blue bar
```

**After:**

```
┌─────────────────┐
│      Leaf       │
├─────────────────┤
│       Map       │
└─────────────────┘
```

### 3. Left Drop

**Action:** Drag Graph pane to LEFT of Leaf pane

**Before:**

```
┌─────────────────┐
│      Leaf       │
│                 │
└─────────────────┘
```

**Visual Indicator:**

```
█ ┌───────────────┐
█ │     Leaf      │
█ │               │
█ └───────────────┘
↑ Blue bar
```

**After:**

```
┌────────┬────────┐
│ Graph  │  Leaf  │
│        │        │
└────────┴────────┘
```

### 4. Right Drop

**Action:** Drag Table pane to RIGHT of Leaf pane

**Before:**

```
┌─────────────────┐
│      Leaf       │
│                 │
└─────────────────┘
```

**Visual Indicator:**

```
┌───────────────┐ █
│     Leaf      │ █
│               │ █
└───────────────┘ █
              ↑ Blue bar
```

**After:**

```
┌────────┬────────┐
│  Leaf  │ Table  │
│        │        │
└────────┴────────┘
```

### 5. Center Drop (Split)

**Action:** Drag Graph pane to CENTER of Leaf pane

**Before:**

```
┌─────────────────┐
│      Leaf       │
│                 │
└─────────────────┘
```

**Visual Indicator:**

```
╔═════════════════╗
║  ┌───────────┐  ║
║  │   Drop    │  ║
║  │   to      │  ║
║  │   Split   │  ║
║  └───────────┘  ║
╚═════════════════╝
↑ Dashed blue overlay
```

**After (randomly horizontal or vertical):**

```
Option A (Horizontal):
┌────────┬────────┐
│  Leaf  │ Graph  │
│        │        │
└────────┴────────┘

Option B (Vertical):
┌─────────────────┐
│      Leaf       │
├─────────────────┤
│      Graph      │
└─────────────────┘
```

## 🔄 Move Operations Examples

### Move Operation 1: Swap Adjacent Panes

**Before:**

```
┌──────┬──────┐
│  A   │  B   │
└──────┴──────┘
```

**Action:** Drag A's header to RIGHT edge of B (purple indicator)

**After:**

```
┌──────┬──────┐
│  B   │  A   │
└──────┴──────┘
```

### Move Operation 2: Move to Different Section

**Before:**

```
┌──────┬──────┐
│  A   │  C   │
├──────┤      │
│  B   │      │
└──────┴──────┘
```

**Action:** Drag B's header to BOTTOM edge of C (purple indicator)

**During Drag:**

```
┌──────┬──────┐
│  A   │  C   │
│      ├──────┤
│      │ 🟣🟣🟣 │ ← Purple bar
└──────┴──────┘

B is being dragged (ghosted)
```

**After:**

```
┌──────┬──────┐
│      │  C   │
│  A   ├──────┤
│      │  B   │
└──────┴──────┘
```

### Move Operation 3: Extract from Nested Group

**Before:**

```
┌──────┬──────┐
│  A   │  B   │
│      ├──────┤
│      │  C   │
└──────┴──────┘
```

**Action:** Drag B's header to RIGHT edge of A (purple indicator)

**After:**

```
┌────┬────┬────┐
│ A  │ B  │ C  │
└────┴────┴────┘

(Vertical group collapsed, all panes now at same level)
```

### Move Operation 4: Center Drop (Split with Target)

**Before:**

```
┌─────────────────┐
│        A        │
│                 │
└─────────────────┘

┌─────────────────┐
│        B        │
└─────────────────┘
```

**Action:** Drag B's header to CENTER of A (purple "Move here" overlay)

**After:**

```
┌────────┬────────┐
│   A    │   B    │
│        │        │
└────────┴────────┘

(B moved into same group as A)
```

### Invalid Move: Can't Drop on Self

**Attempt:** Drag A to A

```
┌─────────────────┐
│   Dragging A    │  ❌ No indicator appears
│                 │     Cursor shows ⛔
└─────────────────┘
```

### Invalid Move: Can't Drop on Descendant

**Before:**

```
A (parent)
└── vertical
    ├── B (child)
    └── C (child)
```

**Attempt:** Drag A to B or C

```
❌ No purple indicator appears
❌ Can't drop parent onto its own children
```

## 🏗️ Complex Layout Building

### Starting Point

```
┌─────────────────┐
│      Leaf       │
│                 │
└─────────────────┘
```

### Step 1: Drop Graph to RIGHT

```
┌────────┬────────┐
│  Leaf  │ Graph  │
│        │        │
└────────┴────────┘
```

### Step 2: Drop Map to BOTTOM of Graph

```
┌────────┬────────┐
│        │ Graph  │
│  Leaf  ├────────┤
│        │  Map   │
└────────┴────────┘
```

### Step 3: Drop Table to BOTTOM of Leaf

```
┌────────┬────────┐
│  Leaf  │ Graph  │
├────────┼────────┤
│ Table  │  Map   │
└────────┴────────┘
```

### Final Layout Tree Structure

```
horizontal (root)
├── vertical (left column)
│   ├── Leaf (top-left)
│   └── Table (bottom-left)
└── vertical (right column)
    ├── Graph (top-right)
    └── Map (bottom-right)
```

## 🎨 Tree Structure Visualization

### Simple Horizontal Split

```
Layout Object:
{
  type: 'horizontal',
  panes: [
    { type: 'leaf' },
    { type: 'graph' }
  ]
}

Visual:
┌──────┬──────┐
│ Leaf │Graph │
└──────┴──────┘
```

### Simple Vertical Split

```
Layout Object:
{
  type: 'vertical',
  panes: [
    { type: 'map' },
    { type: 'table' }
  ]
}

Visual:
┌────────────┐
│    Map     │
├────────────┤
│   Table    │
└────────────┘
```

### Nested Layout (3 levels deep)

```
Layout Object:
{
  type: 'horizontal',
  panes: [
    {
      type: 'vertical',
      panes: [
        { type: 'leaf' },
        { type: 'graph' }
      ]
    },
    {
      type: 'vertical',
      panes: [
        { type: 'map' },
        { type: 'table' }
      ]
    }
  ]
}

Visual:
┌──────┬──────┐
│ Leaf │ Map  │
├──────┼──────┤
│Graph │Table │
└──────┴──────┘

Tree:
horizontal
├── vertical
│   ├── leaf
│   └── graph
└── vertical
    ├── map
    └── table
```

### Complex Dashboard Layout

```
Layout Object:
{
  type: 'vertical',
  panes: [
    { type: 'graph', defaultSize: 60 },
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

Visual:
┌─────────────────────────────────┐
│                                 │
│            Graph (60%)          │
│                                 │
├─────────┬─────────┬─────────────┤
│   Map   │  Table  │    Video    │
│  (33%)  │  (33%)  │    (34%)    │
└─────────┴─────────┴─────────────┘
```

## 🔄 Remove Operation Examples

### Remove from Group of 3

**Before:**

```
┌────┬────┬────┐
│ A  │ B  │ C  │
└────┴────┴────┘

Tree:
horizontal
├── A
├── B  ← Remove this
└── C
```

**After removing B:**

```
┌──────┬──────┐
│  A   │  C   │
└──────┴──────┘

Tree:
horizontal
├── A
└── C
```

### Remove from Group of 2 (Collapse)

**Before:**

```
┌──────────┐
│    A     │
├──────────┤
│    B     │  ← Remove this
└──────────┘

Tree:
vertical
├── A
└── B
```

**After removing B:**

```
┌──────────┐
│          │
│    A     │
│          │
└──────────┘

Tree:
A (promoted to root, vertical group collapsed)
```

### Remove from Nested Structure

**Before:**

```
┌──────┬──────┐
│  A   │  B   │
│      ├──────┤
│      │  C   │  ← Remove this
└──────┴──────┘

Tree:
horizontal
├── A
└── vertical
    ├── B
    └── C
```

**After removing C:**

```
┌──────┬──────┐
│  A   │  B   │
│      │      │
│      │      │
└──────┴──────┘

Tree:
horizontal
├── A
└── B (vertical group collapsed)
```

## 🎭 Edge Cases

### Scenario: Parent Has Correct Direction

Dropping RIGHT on pane B, parent is horizontal:

**Before:**

```
┌───┬───┬───┐
│ A │ B │ C │
└───┴───┴───┘
```

**Action:** Drop D to RIGHT of B

**After:**

```
┌───┬───┬───┬───┐
│ A │ B │ D │ C │
└───┴───┴───┴───┘
```

Result: D inserted into parent's panes array.

### Scenario: Parent Has Wrong Direction

Dropping TOP on pane B, parent is horizontal:

**Before:**

```
┌───┬───┬───┐
│ A │ B │ C │
└───┴───┴───┘
```

**Action:** Drop D to TOP of B

**After:**

```
┌───┬───────┬───┐
│   │   D   │   │
│ A ├───────┤ C │
│   │   B   │   │
└───┴───────┴───┘

Tree:
horizontal
├── A
├── vertical (new group wrapping B)
│   ├── D
│   └── B
└── C
```

Result: B wrapped in vertical group with D.

## 📱 Toolbar Layout

```
╔══════════════════╗
║  Pane Toolbar    ║
╟──────────────────╢
║ 📄 Blank         ║
║ 📊 Graph         ║
║ 🗺️  Map          ║
║ 📋 Table         ║
║ 🎥 Video         ║
╟──────────────────╢
║ 💡 Tip:          ║
║ Drop on edges    ║
║ to split, or     ║
║ center to        ║
║ replace          ║
╚══════════════════╝
```

## 🎨 Visual States

### Normal State

```
┌─────────────────┐
│      Leaf       │
│                 │
│      [×]        │ ← Remove button
└─────────────────┘
```

### Hover State (Drop Zone Active)

```
╔═════════════════╗ ← Blue glow
║      Leaf       ║
║                 ║
║      [×]        ║
╚═════════════════╝
  ▲ Position indicator
```

### Active Drop State

```
████████████████████ ← Position bar
┌─────────────────┐
│      Leaf       │   OR   Dashed overlay
│                 │        for center drop
│      [×]        ║
└─────────────────┘
```

## 🔢 Size Distribution Examples

### Equal Distribution

```
┌────────┬────────┬────────┐
│   33%  │   33%  │   34%  │
└────────┴────────┴────────┘
```

### Custom Distribution

```
┌──────┬────────────────┬──────┐
│ 20%  │      60%       │ 20%  │
└──────┴────────────────┴──────┘
```

### Nested Size Calculation

```
┌──────────────┬──────────────┐
│     50%      │     50%      │
│              │              │
│              ├──────────────┤
│              │     50%      │
│              │  (25% total) │
└──────────────┴──────────────┘
```

## 🎯 Quick Reference

| Action       | Result                                 |
| ------------ | -------------------------------------- |
| Drop TOP     | Insert above (vertical group)          |
| Drop BOTTOM  | Insert below (vertical group)          |
| Drop LEFT    | Insert left (horizontal group)         |
| Drop RIGHT   | Insert right (horizontal group)        |
| Drop CENTER  | Split pane (random direction)          |
| Click [×]    | Remove pane (collapse if needed)       |
| Drag divider | Resize adjacent panes                  |
| Drag header  | Move existing pane (purple indicators) |

---

**Legend:**

- `█` = Visual indicator (blue highlight)
- `┌─┐` = Pane border
- `├─┤` = Resizer/divider
- `[×]` = Remove button
- `╔═╗` = Active drop zone
- `🔵` = Blue (add operation)
- `🟣` = Purple (move operation)
- `⋮⋮` = Drag handle (pane header)

## 🎭 Visual Comparison: Add vs Move

### Adding a New Graph Pane (Blue)

```
Toolbar                Layout
╔════════╗            ┌──────────┐
║ 📊 Graph║──drag──>  │   Leaf   │
╚════════╝            └──────────┘
                           ↓
                      (Blue indicator)
                           ↓
                      ┌──────┬──────┐
                      │ Leaf │Graph │
                      └──────┴──────┘
```

### Moving an Existing Graph Pane (Purple)

```
┌──────┬──────┐      ┌──────┬──────┐
│Graph │ Leaf │      │Graph │ Leaf │
└──────┴──────┘      └──────┴──────┘
   ⋮⋮ (drag)              ↓
       ↓            (Purple indicator)
       └──────────────────┘
              ↓
       ┌──────┬──────┐
       │ Leaf │Graph │
       └──────┴──────┘
```

### Key Differences

| Aspect          | Add Operation    | Move Operation        |
| --------------- | ---------------- | --------------------- |
| **Source**      | Toolbar sidebar  | Pane header (⋮⋮)      |
| **Indicator**   | 🔵 Blue          | 🟣 Purple             |
| **Effect**      | Creates new pane | Repositions existing  |
| **Original**    | N/A              | Removed from old spot |
| **Center text** | "Drop to split"  | "Move here"           |
| **Icon**        | +                | ↔                     |

This visual guide should help you understand how the drag-and-drop system works at a glance!
