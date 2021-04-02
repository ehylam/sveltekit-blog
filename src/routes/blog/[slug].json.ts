// import posts from './_posts';


// export function get({ params }) {
// // params is the value in [slug]
// 	if (params.slug in posts) {
// 		return {
// 			// Find posts object by slug
// 			body: posts[params.slug]
// 		};
// 	}

// 	return {
// 		// else return 404
// 		status: 404
// 	};
// }

import path from "path";
import fs from "fs";
import grayMatter from "gray-matter";
import marked from "marked";

const getPost = (fileName) => {
	return fs.readFileSync(
	  path.resolve("static/posts/", `${fileName}.md`),
	  "utf-8"
	);
};



export function get(req, res, _) {
	const { slug } = req.params;

	const post = getPost(slug);
	const renderer = new marked.Renderer();

	const { data, content } = grayMatter(post);
	const html = marked(content, { renderer });

	if (html) {
		res.writeHead(200, {
			"Content-Type": "application/json",
		});

		res.end(JSON.stringify({ html, ...data }));
	} else {
		res.writeHead(404, {
		"Content-Type": "application/json",
		});

		res.end(
		JSON.stringify({
			message: `Not found`,
		})
		);
	}
}