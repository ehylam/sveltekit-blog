import posts from './_posts';


export function get({ params }) {
// params is the value in [slug]
	if (params.slug in posts) {
		return {
			// Find posts object by slug
			body: posts[params.slug]
		};
	}

	return {
		// else return 404
		status: 404
	};
}