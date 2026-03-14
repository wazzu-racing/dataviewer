# AGENTS.md - Wazzu Racing Data Viewer

## Project Overview

This repo is a SvelteKit-based data visualization platform for Wazzu Racing's 2026 FSAE car. It features an interactive, customizable pane layout for viewing telemetry and sensor data using graphs, maps, gauges, and other flexible visualization types.

**Tech Stack:**

- SvelteKit 2.x with Svelte 5 (runes-only syntax)
- TypeScript (strict mode, explicit typing)
- Tailwind CSS 4.x (utility-first responsive styling)
- Vite 7.x (build tooling)
- pnpm (package manager)
- ESLint + Prettier (linting/format)
- svelte-check for type validity

## Agentic Workflow: Svelte MCP & Context7 Usage

Agents MUST use Svelte MCP server and Context7 MCP for reference—never general internet/Google. These provide up-to-date, authoritative documentation for:

- Svelte 5 runes (reactivity, component structure)
- SvelteKit project structure, routing, build, and deployment
- TypeScript strict usage, advanced typing, JSDoc
- Tailwind CSS utility conventions
- Vite configuration
- Testing: vitest/unit, Playwright/e2e
- ESLint/Prettier style enforcement

## Development Commands

| Command            | Description                           |
| ------------------ | ------------------------------------- |
| `pnpm dev`         | Start development server              |
| `pnpm build`       | Build for production                  |
| `pnpm preview`     | Preview production build              |
| `pnpm check`       | Type check with svelte-check          |
| `pnpm check:watch` | Watch mode for type checking          |
| `pnpm lint`        | Run ESLint and Prettier checks        |
| `pnpm format`      | Format code with Prettier             |
| `pnpm test`        | Run all vitest tests (if implemented) |
| `pnpm test <file>` | Run a single test file (vitest CLI)   |

**How to run a single unit test (when tests exist):**

```bash
pnpm test src/lib/some-feature.test.ts
```

(Uses vitest CLI syntax; see Context7 MCP for advanced vitest docs.)

**If adding tests:**

- Use vitest for unit tests (`.test.ts` in `src`, organized by feature/component).
- Use Playwright for e2e tests (`tests/` folder).
- Reference Context7 MCP for test structure and advanced testing guidelines.

## Code Style Guidelines

### Imports & Grouping

- Use `$lib` alias: `import { foo } from '$lib/bar'`
- Use `$app/environment` for environment checks
- Group imports: external → $lib → relative

### TypeScript

- Strict mode: no implicit `any`, always explicit types
- Use **type imports**: `import type { Foo } from '$lib/types'`
- Place shared types in `src/lib/types.ts`, utilities in `src/lib/*.ts`
- Document complex types with JSDoc (`/** ... */`)

### Svelte 5 Runes (Exclusive)

- **Do NOT use old Svelte syntax** (e.g., `export let`, `$:`)
- Use ONLY runes:
  - `$state()`: Reactive state
  - `$derived()`: Computed values
  - `$effect()`: Side effects (not pure computation)
  - `$props()`: Component props typing/handling
  - `$bindable()`: Props with 2-way binding
- Prefer destructuring props: `let { propA, propB } = $props();`
- Use keyed each blocks: `{#each items as item (item.id)}`
- Use snippets/context: `{#snippet ...}` and `createContext` for shared state
- Use event attributes (e.g., `onclick`), not legacy event directives

### File Organization

```
src/lib/components/   # Svelte components (PascalCase)
src/lib/stores/       # Svelte reactive stores
src/lib/types.ts      # Shared types
src/lib/*.ts          # Utility functions (camelCase)
src/routes/           # SvelteKit routes
static/               # Assets
tests/                # Playwright e2e tests
```

### Styling

- Use Tailwind CSS utility classes only; avoid inline styles unless necessary
- Mobile-first, responsive by default
- Import Tailwind via `@import 'tailwindcss'` in app.css

### Naming Conventions

| Type           | Convention       | Example                       |
| -------------- | ---------------- | ----------------------------- |
| Components     | PascalCase       | `Graph.svelte`                |
| Files          | camelCase        | `layoutUtils.ts`              |
| Types          | PascalCase       | `DataLine`, `LayoutNode`      |
| Vars/functions | camelCase        | `processData`, `handleResize` |
| Constants      | UPPER_SNAKE_CASE | `MAX_ZOOM`                    |
| Svelte props   | camelCase        | `onClose`                     |

### Error Handling

- Use try/catch with meaningful error messages
- Defensive: guard browser-only code (`import { browser } from '$app/environment'; if (browser) ...`)
- Log errors with context for debugging

### Component Patterns

- Export callbacks as props (e.g., `onClose`, `onUpdate`, `onDataReceived`)
- Use `$bindable()` for two-way binding
- Clean up event listeners and chart instances properly
- Type all component props strictly

## Linting & Formatting

### Prettier (.prettierrc)

- Tabs, single quotes, no trailing commas, max width 100

### ESLint

- Extends: `@eslint/js`, `typescript-eslint/recommended`, `eslint-plugin-svelte/recommended`
- Integrates with `eslint-config-prettier`
- `no-undef` disabled (TypeScript handles this)

**Before commit, run:**

```bash
pnpm lint && pnpm check && pnpm format
```

**Always run `svelte-autofixer` and reference Svelte MCP docs before PRs.**

## Agent/Copilot Rules (Merged)

- Reference Context7 for advanced TypeScript, Tailwind, Vite, and vitest features/tests.
- Use JSDoc for complex type definitions.
- Cleanup all side effects and event listeners in Svelte components.
- Defensive browser checks (`browser` from `$app/environment`).
- Ensure data structures match shared types (`DataLine`, etc.).
- Document all non-trivial functions and types with JSDoc.
- Do not edit `README.md`; put docs in `docs/` folder only.
- Use Svelte MCP and Context7 for organization, test, and migration workflows.

## Important Notes

1. SvelteKit is configured with `@sveltejs/adapter-static` for static site generation
2. Svelte 5 runes exclusively; migrate old code using MCP migration tools
3. All documentation in markdown goes in `docs/`; never in README.md
4. Use Svelte MCP tools: `list-sections`, `get-documentation`, `svelte-autofixer`
5. Refer to Context7 MCP for library docs (Tailwind, TypeScript, vitest, etc.)
6. Organize files strictly—no types or utilities in routes.
7. Agents: always verify correctness using MCP checkers before commit or PR.

---

**For detailed code snippets or agent workflow examples, reference Svelte MCP and Context7 MCP documentation directly.**

---
