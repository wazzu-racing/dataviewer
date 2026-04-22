# Repository Guidelines

This document provides essential information for autonomous agents and contributors working on the Wazzu Racing Data Viewer project.

## Project Overview

A high-performance telemetry visualization suite for Wazzu Racing's FSAE car, built with Svelte 5 and SvelteKit. It features a customizable pane-based layout for real-time and historical data analysis.

## Build, Test, and Development Commands

- `pnpm dev`: Start local Vite development server.
- `pnpm build`: Create production build (Static Site Generation).
- `pnpm preview`: Serve production build locally.
- `pnpm check`: Run `svelte-check` against `tsconfig.json` for type safety.
- `pnpm lint`: Run Prettier and ESLint checks.
- `pnpm format`: Apply Prettier formatting across the codebase.
- `pnpm test`: Run Vitest unit and component tests once.
- `pnpm test:watch`: Run Vitest in interactive watch mode.
- `pnpm test:e2e`: Run Playwright end-to-end tests.
- **Run a single test**: Use `pnpm vitest run path/to/test.test.ts` or `pnpm playwright test path/to/spec.spec.ts`.

## Project Structure

- `src/routes/`: SvelteKit application routes.
- `src/lib/`: Shared utilities and logic.
- `src/lib/components/`: Reusable Svelte components.
- `src/lib/components/widgets/`: Specific visualization implementations (Graph, Map, etc.).
- `src/lib/stores/`: Svelte state management (runes-based).
- `src/lib/types.ts`: Global TypeScript definitions.
- `src/tests/`: Test suites organized by `unit`, `components`, and `e2e`.
- `static/`: Static assets (icons, manifest).
- `docs/`: Project documentation (Markdown).

## Coding Style & Naming Conventions

### Formatting (Strict)

- **Indentation**: Use **Tabs**.
- **Quotes**: Single quotes `'`.
- **Commas**: No trailing commas.
- **Line Width**: 100 characters.
- These rules are enforced by `.prettierrc` and `.editorconfig`.

### Naming Conventions

- **Components**: PascalCase (e.g., `PaneLayout.svelte`).
- **Files/Modules**: camelCase (e.g., `layoutUtils.ts`).
- **Variables/Functions**: camelCase (e.g., `globalState`).
- **Types/Interfaces**: PascalCase (e.g., `DataLine`).
- **Constants**: UPPER_SNAKE_CASE for immutable primitives.

### Svelte 5 & TypeScript

- **Runes Only**: Use `$state`, `$derived`, `$props`, and `$effect`. Never use `export let` or reactive `$:` blocks.
- **Strict Types**: Always define types explicitly. Avoid `any`. Use `import type` where possible.
- **Browser Guards**: Wrap client-only logic (like Leaflet or Plotly) in `if (browser)` from `$app/environment`.
- **Cleanup**: Always destroy chart instances and remove event listeners in `$effect` cleanup functions.

## Testing Guidelines

- **Unit Tests**: Place logic tests in `src/tests/unit/`.
- **Component Tests**: Place Svelte component tests in `src/tests/components/` using `@testing-library/svelte`.
- **E2E Tests**: Place Playwright specs in `src/tests/e2e/`.
- **Requirements**: All new features must include corresponding tests. Run `pnpm check` and `pnpm test` before committing.

## Error Handling & Logging

- Use defensive programming, especially when parsing telemetry data that may be malformed.
- Prefer returning Result-like patterns or using `try/catch` with descriptive error messages.
- Avoid persistent `console.log` in production code; use a dedicated logger if available.

## Agent-Specific Instructions

- **Documentation**: All new documentation must go in `docs/`. Do NOT modify `README.md` unless explicitly asked.
- **Svelte MCP**: Always use `list-sections` then `get-documentation` when working with Svelte 5 logic to ensure adherence to the latest runes patterns.
- **Context7**: Use `resolve-library-id` for external libraries like `plotly.js` or `uPlot` to find correct documentation.
- **Security**: Never commit secrets or local telemetry files (`.wazzuracing`).
- **Commits**: Use short, imperative subjects (e.g., `Fix pane resize flicker.`, `Add unit tests for CSV parser.`).

## Tool Usage

- **Svelte-Autofixer**: Run `svelte-autofixer` on any Svelte component you create or modify.
- **Playground**: If creating a complex standalone component, offer a Svelte Playground link for review.
