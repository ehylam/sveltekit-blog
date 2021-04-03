// import posts from './_posts';

// export function get() {
//     return {
//         body: Object.keys(posts).map(slug => ({
//             slug,
//             ...posts[slug]
//         }))
//     }
// }

// import fs from "fs";
// import path from "path";
// import frontMatter from "@github-docs/frontmatter";

// const getAllPosts = () => fs.readdirSync("static/posts").map(fileName => {
// 	const post = fs.readFileSync(path.resolve("static/posts", fileName), "utf-8");

// 	return frontMatter(post).data;
// frontMatter
// });

// export function get(req, res) {
// 	res.writeHead(200, {
// 		"Content-Type": "application/json"
// 	});
// 	const posts = getAllPosts();

// 	console.log(posts);

// 	res.end(JSON.stringify(posts));

// }


