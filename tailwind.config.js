/** @type {import('tailwindcss').Config} */
/**
 * Tailwind CSS Configuration for Wazzu Racing Data Viewer
 *
 * This config extends Tailwind CSS v4.x with custom design tokens for the application.
 *
 * Dark Mode: Uses 'media' strategy, which automatically follows system theme preference.
 * Changes take effect on page reload when the user switches their OS theme.
 *
 * Custom Colors:
 * - primary: Wazzu Racing brand color (#a60f2d)
 * - background/card/border: Light/dark variants for consistent theming
 * - accent: Orange accent for highlights
 * - muted: Text colors for secondary content
 *
 * Usage: Import this automatically via @tailwindcss/vite plugin in vite.config.ts
 */
module.exports = {
	darkMode: 'class', // enable runtime theme switching via .dark class
	content: ['./src/**/*.{html,js,svelte,ts}', './src/app.html'],
	theme: {
		extend: {
			colors: {
				primary: {
					DEFAULT: '#a60f2d',
					700: '#8b0d25'
				},
				// light/dark-neutral palette, can expand
				background: {
					DEFAULT: '#f8fafc', // light bg
					dark: '#1d1f23' // dark bg
				},
				card: {
					DEFAULT: '#ffffff',
					dark: '#23272f'
				},
				border: {
					DEFAULT: '#e2e8f0',
					dark: '#30333b'
				},
				accent: {
					DEFAULT: '#f47521', // orange accent
					dark: '#fa983a'
				},
				muted: {
					DEFAULT: '#6b7280',
					dark: '#a3a3a3'
				}
				// You can expand with more tokens (success, warning, etc.)
			},
			fontFamily: {
				sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif']
			},
			borderRadius: {
				md: '0.6rem',
				lg: '1rem',
				xl: '2rem'
			},
			boxShadow: {
				card: '0 1px 6px 0 rgba(16,30,54,.08), 0 0.5px 1.5px 0 rgba(16,30,54,.04)'
			}
		}
	},
	plugins: []
};
