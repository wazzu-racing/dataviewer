# GitHub Copilot Instructions - Wazzu Racing Data Viewer

## Project Overview
This is a data visualization application for Wazzu Racing's 2026 FSAE Car. The project provides an interactive, customizable pane-based layout for viewing telemetry and sensor data through various visualization types (graphs, maps, gauges, etc.).

## Tech Stack
- **Framework**: SvelteKit 2.x with Svelte 5
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS 4.x
- **Build Tool**: Vite 7.x
- **Package Manager**: pnpm

## Code Standards

### TypeScript
- Use strict TypeScript with all compiler options enabled
- Always define types explicitly - no implicit `any`
- Use type imports: `import type { TypeName } from '...'`
- Place shared types in `src/lib/types.ts`
- Use JSDoc comments for complex type definitions

### Svelte 5 Patterns
- Use Svelte 5 runes syntax:
  - `$state()` for reactive state
  - `$derived()` for computed values
  - `$effect()` for side effects
  - `$props()` for component props
- Prefer `<script lang="ts">` over JavaScript
- Use module-level scripts `<script context="module">` for shared state/caching
- Component props should be typed with TypeScript

### File Organization
- Components go in `src/lib/components/`
- Utilities go in `src/lib/` with descriptive names
- Types go in `src/lib/types.ts`
- Stores go in `src/lib/stores/`
- Routes follow SvelteKit conventions in `src/routes/`

### Styling
- Use Tailwind CSS utility classes
- Follow mobile-first responsive design
- Use semantic color names from Tailwind palette
- Avoid inline styles unless absolutely necessary

### Component Patterns
- Export callback functions as props (e.g., `onClose`, `onUpdate`)
- Use defensive checks for browser-only code with `browser` from `$app/environment`
- Cleanup event listeners and chart instances properly
- Implement proper TypeScript types for all component props

### Naming Conventions
- Components: PascalCase (e.g., `Graph.svelte`, `PaneLayout.svelte`)
- Files: camelCase (e.g., `layoutUtils.ts`, `dragStore.ts`)
- Types: PascalCase (e.g., `LayoutNode`, `DropPosition`)
- Variables/functions: camelCase (e.g., `globalData`, `handleResize`)
- Constants: UPPER_SNAKE_CASE for true constants

### Data Management
- Data structure follows the `DataLine` type definition

## Key Features
- **Customizable Pane Layout**: Drag-and-drop interface for arranging visualization panes
- **Line Graphs**: Interactive charts with zoom and pan capabilities
- **Data Loading**: Support for loading telemetry data from various sources
- **Performance Optimized**: Lazy loading and efficient rendering for large datasets

## Development Commands
- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm preview` - Preview production build
- `pnpm check` - Type check the project
- `pnpm lint` - Run linter
- `pnpm format` - Format code with Prettier

## Important Notes
- This is a SvelteKit project configured for static site generation
- The project uses Svelte 5's new runes system - do not use old Svelte syntax

# Svelte MCP Server Integration
You are able to use the Svelte MCP server, where you have access to comprehensive Svelte 5 and SvelteKit documentation. Here’s how to use the available tools effectively:

Available Svelte MCP Tools:
1. list-sections
Use this FIRST to discover all available documentation sections. Returns a structured list with titles, use_cases, and paths. When asked about Svelte or SvelteKit topics, ALWAYS use this tool at the start of the chat to find relevant sections.

2. get-documentation
Retrieves full documentation content for specific sections. Accepts single or multiple sections. After calling the list-sections tool, you MUST analyze the returned documentation sections (especially the use_cases field) and then use the get-documentation tool to fetch ALL documentation sections that are relevant for the user’s task.

3. svelte-autofixer
Analyzes Svelte code and returns issues and suggestions. You MUST use this tool whenever writing Svelte code before sending it to the user. Keep calling it until no issues or suggestions are returned.

4. playground-link
Generates a Svelte Playground link with the provided code. After completing the code, ask the user if they want a playground link. Only call this tool after user confirmation and NEVER if code was written to files in their project.

If your MCP client supports it, we also recommend using the svelte-task prompt to instruct the LLM on the best way to use the MCP server.

## Documentation
Whenever you write documentation in markdown files, make sure to put them in the
`docs/` folder. Do not put them directly in the root folder. Also, do not edit
`README.md`; all documentation should be in separate markdown files in the
`docs/` folder.
