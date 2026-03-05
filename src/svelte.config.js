import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({
			runtime: 'nodejs20.x',
			// Regions are auto-detected by Vercel, no need to specify
		}),
		alias: {
			$components: 'src/lib/components',
			$utils: 'src/lib/utils',
			$store: 'src/lib/store',
			$types: 'src/lib/types'
		}
	}
};

export default config;
