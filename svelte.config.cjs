const sveltePreprocess = require('svelte-preprocess');
const adapter = require('@sveltejs/adapter-vercel');
const pkg = require('./package.json');

/** @type {import('@sveltejs/kit').Config} */
module.exports = {
	preprocess: sveltePreprocess(),
	kit: {
		adapter: adapter(),
		target: '#svelte',
		vite: {
			ssr: {
				noExternal: Object.keys(pkg.dependencies || {})
			}
		}
	}
};
