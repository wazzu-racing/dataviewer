# AGENTS.md - Wazzu Racing Data Viewer

## Project Overview

This is a SvelteKit-based data visualization application for Wazzu Racing's 2026 FSAE Car. It provides an interactive, customizable pane-based layout for viewing telemetry and sensor data through various visualization types (graphs, maps, gauges, etc.).

## Tech Stack

- **Framework**: SvelteKit 2.x with Svelte 5 (runes)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS 4.x
- **Build Tool**: Vite 7.x
- **Package Manager**: pnpm
- **Linting**: ESLint + Prettier
- **Type Checking**: svelte-check

## Development Commands

| Command            | Description                           |
| ------------------ | ------------------------------------- |
| `pnpm dev`         | Start development server              |
| `pnpm build`       | Build for production                  |
| `pnpm preview`     | Preview production build              |
| `pnpm check`       | Type check the project (svelte-check) |
| `pnpm check:watch` | Watch mode for type checking          |
| `pnpm lint`        | Run ESLint and Prettier checks        |
| `pnpm format`      | Format code with Prettier             |

**Note**: There are currently no tests. If adding tests, use `vitest`.

## Code Style Guidelines

### TypeScript

- Use strict TypeScript - all compiler options enabled
- Never use implicit `any` - always define types explicitly
- Use type imports: `import type { TypeName } from '...'`
- Place shared types in `src/lib/types.ts`

```typescript
// Good
import type { DataLine } from '$lib/types';
const processData = (line: DataLine): number => { ... }
// Avoid: import { DataLine } from '$lib/types'; // Don't use value imports for types
```

### Svelte 5 Runes (Exclusive)

Use the new Svelte 5 runes syntax only:

- `$state()` for reactive state
- `$derived()` for computed values
- `$effect()` for side effects
- `$props()` for component props

```svelte
<script lang="ts">
	let { count = $bindable(0), onIncrement }: { count?: number; onIncrement: () => void } = $props();
	let doubled = $derived(count * 2);
	$effect(() => {
		console.log('Count:', count);
	});
</script>
```

**Do NOT use** old Svelte syntax (`export let`, `$:`, `$$props`, etc.).

### File Organization

```
src/lib/components/   # Svelte components (PascalCase)
src/lib/stores/       # Svelte stores/state
src/lib/types.ts      # Shared TypeScript types
src/lib/*.ts          # Utility functions (camelCase)
src/routes/           # SvelteKit routes
```

### Styling

- Use Tailwind CSS utility classes exclusively
- Follow mobile-first responsive design
- Avoid inline styles unless absolutely necessary
- Import Tailwind via `@import "tailwindcss"` in app.css

### Component Patterns

- Export callbacks as props: `onClose`, `onUpdate`, `onDataReceived`
- Guard browser-only code: `import { browser } from '$app/environment'; if (browser) { ... }`
- Use `$bindable()` for two-way binding on props

### Naming Conventions

| Type                | Convention       | Example                  |
| ------------------- | ---------------- | ------------------------ |
| Components          | PascalCase       | `Graph.svelte`           |
| Files               | camelCase        | `layoutUtils.ts`         |
| Types               | PascalCase       | `LayoutNode`, `DataLine` |
| Variables/functions | camelCase        | `handleResize`           |
| Constants           | UPPER_SNAKE_CASE | `MAX_ZOOM`               |
| Svelte props        | camelCase        | `onClose`                |

### Imports

- Use `$lib` alias: `import { something } from '$lib/utils'`
- Use `$app/environment` for environment checks
- Group: external → $lib → relative

### Error Handling

- Use try/catch with meaningful error messages
- Guard browser-only code with `$app/environment`
- Log errors with context for debugging

## Linting & Formatting

### Prettier (.prettierrc)

- Use tabs, single quotes, no trailing commas, 100 char width

### ESLint

- Extends: `@eslint/js`, `typescript-eslint/recommended`, `eslint-plugin-svelte/recommended`
- Uses `eslint-config-prettier`
- `no-undef` disabled (handled by TypeScript)

Run before committing:

```bash
pnpm lint && pnpm check
```

## Key Features

- **Customizable Pane Layout**: Drag-and-drop interface for arranging visualization panes
- **Line Graphs**: Interactive charts with zoom and pan
- **Data Loading**: Support for loading telemetry data
- **Performance**: Lazy loading and efficient rendering for large datasets

## Important Notes

1. SvelteKit with `adapter-auto` (static site generation)
2. Svelte 5 runes exclusively - no old Svelte syntax
3. Documentation goes in `docs/`, not root
4. Do not edit `README.md`
5. Use Svelte MCP tools: `list-sections`, `get-documentation`, `svelte-autofixer`
6. Use Context7 MCP for library docs (Tailwind, TypeScript, etc.)
