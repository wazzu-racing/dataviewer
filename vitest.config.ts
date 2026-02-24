import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [sveltekit()],
	resolve: {
		conditions: ['browser']
	},
	test: {
		// Use jsdom for browser-like environment in component tests
		environment: 'jsdom',
		// Setup file runs before each test file
		setupFiles: ['src/tests/setup.ts'],
		// Include test files
		include: ['src/tests/**/*.test.ts'],
		// Exclude E2E tests (those use Playwright)
		exclude: ['src/tests/e2e/**'],
		globals: true,
		coverage: {
			provider: 'v8',
			reporter: ['text', 'html', 'lcov'],
			include: ['src/lib/**/*.ts', 'src/lib/**/*.svelte'],
			exclude: ['src/lib/index.ts']
		}
	}
});
