# Nested Pane Layout System

This project implements a flexible, arbitrarily nested pane layout system using [Paneforge](https://paneforge.com/) and Svelte.

## Overview

The layout system allows you to create complex, resizable pane arrangements by defining a nested tree structure. Each node in the tree can be:

- **`horizontal`** - A horizontal group that splits panes left-to-right
- **`vertical`** - A vertical group that splits panes top-to-bottom
- **`leaf`** - A basic content pane
- **`graph`**, **`map`**, or any custom type - Special pane types for specific content

## Architecture

### Files

- **`src/lib/types.ts`** - Shared TypeScript type definitions
- **`src/routes/PaneLayout.svelte`** - Recursive component that renders the layout tree
- **`src/routes/+page.svelte`** - Main page that defines the layout structure

### Type Definition

```typescript
export type LayoutNode = {
	type: 'horizontal' | 'vertical' | 'leaf' | 'graph' | 'map' | string;
	panes?: LayoutNode[];      // Child panes (for horizontal/vertical groups)
	defaultSize?: number;       // Initial size percentage (0-100)
	minSize?: number;           // Minimum size percentage (0-100)
};
```

## Usage Examples

### Simple Two-Pane Layout

```typescript
let layout: LayoutNode = {
	type: 'horizontal',
	panes: [
		{ type: 'leaf', defaultSize: 50 },
		{ type: 'leaf', defaultSize: 50 }
	]
};
```

### Nested Layout with Three Panes

```typescript
let layout: LayoutNode = {
	type: 'horizontal',
	panes: [
		{
			type: 'vertical',
			defaultSize: 50,
			panes: [
				{ type: 'leaf', defaultSize: 50 },
				{ type: 'leaf', defaultSize: 50 }
			]
		},
		{ type: 'leaf', defaultSize: 50 }
	]
};
```

This creates:
```
┌─────────┬─────────┐
│  Leaf   │         │
├─────────┤  Leaf   │
│  Leaf   │         │
└─────────┴─────────┘
```

### Complex Multi-Level Layout

```typescript
let layout: LayoutNode = {
	type: 'horizontal',
	panes: [
		{
			type: 'vertical',
			defaultSize: 50,
			panes: [
				{ type: 'leaf', defaultSize: 50 },
				{ type: 'leaf', defaultSize: 50 }
			]
		},
		{
			type: 'vertical',
			defaultSize: 50,
			panes: [
				{ type: 'graph', defaultSize: 60 },
				{ type: 'map', defaultSize: 40 }
			]
		}
	]
};
```

This creates:
```
┌─────────┬─────────┐
│  Leaf   │  Graph  │
├─────────┼─────────┤
│  Leaf   │   Map   │
└─────────┴─────────┘
```

### Deeply Nested Layout

You can nest as deeply as needed:

```typescript
let layout: LayoutNode = {
	type: 'horizontal',
	panes: [
		{
			type: 'vertical',
			defaultSize: 33,
			panes: [
				{ type: 'leaf', defaultSize: 50 },
				{
					type: 'horizontal',
					defaultSize: 50,
					panes: [
						{ type: 'graph', defaultSize: 50 },
						{ type: 'map', defaultSize: 50 }
					]
				}
			]
		},
		{ type: 'leaf', defaultSize: 33 },
		{ type: 'leaf', defaultSize: 34 }
	]
};
```

## How It Works

### Recursive Rendering

The `PaneLayout.svelte` component uses Svelte's `<svelte:self>` to recursively render nested layouts:

1. If the node is `horizontal` or `vertical`, it creates a `PaneGroup` and recursively renders each child pane
2. If the node is `leaf`, it renders the leaf content directly
3. If the node is a custom type (e.g., `graph`, `map`), it renders custom content

### Resizers

Between each pane in a group, a `PaneResizer` component is automatically inserted:
- Horizontal groups get vertical drag handles (cursor-col-resize)
- Vertical groups get horizontal drag handles (cursor-row-resize)

### Sizing

- **`defaultSize`** - The initial size percentage of the pane (defaults to 50)
- **`minSize`** - The minimum size percentage the pane can be resized to (defaults to 20)

The sum of `defaultSize` values in a group should equal 100, though Paneforge will normalize if needed.

## Customization

### Adding Custom Pane Types

To add a new pane type, simply use a new `type` value and handle it in `PaneLayout.svelte`:

```typescript
// In your layout definition
{ type: 'video', defaultSize: 50 }
```

```svelte
<!-- In PaneLayout.svelte -->
{:else if layout.type === 'video'}
	<div class="h-full w-full">
		<VideoPlayer />
	</div>
{:else}
	<!-- Fallback for unknown types -->
```

### Styling Resizers

Customize the resizer appearance by modifying the classes in `PaneLayout.svelte`:

```svelte
<PaneResizer
	class={layout.type === 'horizontal'
		? 'w-1 bg-gray-300 hover:bg-blue-500 transition-colors'
		: 'h-1 bg-gray-300 hover:bg-blue-500 transition-colors'}
/>
```

## Dynamic Layouts

You can dynamically update the layout by modifying the `layout` object. Svelte's reactivity will automatically re-render the panes:

```typescript
function addPane() {
	layout.panes = [
		...(layout.panes || []),
		{ type: 'leaf', defaultSize: 50 }
	];
}
```

## Benefits

- **Flexible** - Support any level of nesting
- **Type-safe** - Full TypeScript support
- **Resizable** - Users can drag to resize panes
- **Declarative** - Define complex layouts with simple JSON-like structures
- **Extensible** - Easy to add new pane types

## Future Enhancements

- Persist layout state to localStorage
- Drag-and-drop to rearrange panes
- Collapsible panes
- Maximum size constraints
- Tabs within panes
- Layout presets/templates