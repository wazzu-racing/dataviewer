# Repository Guidelines

## Project Structure & Module Organization

This repository is a SvelteKit 2 + Svelte 5 telemetry viewer. Application routes live in `src/routes`, shared UI in `src/lib/components`, widget implementations in `src/lib/components/widgets`, stores in `src/lib/stores`, and shared utilities such as parsing and layout helpers in `src/lib/*.ts`. Static assets belong in `static/`. Tests are kept under `src/tests/` with `unit`, `components`, and `e2e` coverage areas.

## Build, Test, and Development Commands

- `pnpm dev`: start the local Vite dev server.
- `pnpm build`: create the production build.
- `pnpm preview`: serve the production build locally.
- `pnpm check`: run `svelte-check` against `tsconfig.json`.
- `pnpm lint`: run Prettier checks and ESLint.
- `pnpm format`: apply Prettier formatting.
- `pnpm test`: run Vitest suites.
- `pnpm test:coverage`: run Vitest with coverage output.
- `pnpm test:e2e`: run Playwright end-to-end tests.

## Coding Style & Naming Conventions

Use tabs, single quotes, no trailing commas, and a 100-character print width as defined in `.prettierrc`. Follow Svelte 5 runes-only patterns; do not introduce legacy syntax such as `export let` or reactive `$:` blocks. Use explicit TypeScript types, prefer `import type`, and keep imports grouped as external, `$lib`, then relative. Components use PascalCase filenames such as `PaneLayout.svelte`; utilities and stores use camelCase names such as `layoutUtils.ts` and `dataStore.ts`.

## Testing Guidelines

Vitest covers unit and component tests in `src/tests/**/*.test.ts`; Playwright specs live in `src/tests/e2e/*.spec.ts`. Add tests close to the feature area they validate and use descriptive names like `GraphWidget.test.ts`. Run `pnpm test` before opening a PR, and use `pnpm test:e2e` for UI or routing changes.

## Commit & Pull Request Guidelines

Recent history favors short, imperative commit subjects such as `Add units to all the fields.` and `Fix bug with stuff not rendering.` Keep commits focused and specific. Pull requests should summarize behavior changes, list verification steps (`pnpm lint`, `pnpm check`, `pnpm test`), link the related issue when available, and include screenshots or short recordings for UI changes.

## Agent-Specific Notes

Use Svelte MCP and Context7 references when available for Svelte, SvelteKit, TypeScript, Tailwind, and testing guidance. Prefer browser guards for client-only code, clean up listeners and chart instances, and keep documentation changes in `docs/` rather than `README.md`.
