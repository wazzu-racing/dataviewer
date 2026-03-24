import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

import { SvelteKitPWA } from '@vite-pwa/sveltekit';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit(),
		SvelteKitPWA({
			registerType: 'autoUpdate',
			includeAssets: [
				'favicon.svg',
				'icon-192.png',
				'icon-512.png',
				'icon-1024.png',
				'maskable-icon-192.png',
				'maskable-icon-512.png'
			],
			manifest: {
				name: 'Wazzu Racing Data Viewer',
				short_name: 'DataViewer',
				start_url: '/dataviewer/',
				scope: '/dataviewer/',
				display: 'standalone',
				background_color: '#bf2222',
				theme_color: '#bf2222',
				orientation: 'any',
				description: '2026 Wazzu Racing Car Data Viewer',
				icons: [
					{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
					{ src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
					{ src: 'icon-1024.png', sizes: '1024x1024', type: 'image/png' },
					{
						src: 'maskable-icon-192.png',
						sizes: '192x192',
						type: 'image/png',
						purpose: 'maskable'
					},
					{ src: 'maskable-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
				]
			},
			workbox: {
				maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
				runtimeCaching: [
					{
						urlPattern: /^https:\/\/raw\.githubusercontent\.com\/.*$/,
						handler: 'NetworkOnly'
					},
					{
						urlPattern: /^\/data\//,
						handler: 'CacheFirst'
					}
				]
			}
		})
	]
});
