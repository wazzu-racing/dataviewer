import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		// adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
		// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
		// See https://svelte.dev/docs/kit/adapters for more information about adapters.
		adapter: adapter(),
		paths: {
			// Replace 'your-repo-name' with the name of your GitHub repository
			base: 'dataviewer'
		},
		appDir: 'app' // Optional: Customize the app directory name if needed
	}
};

export default config;
