<script context="module">

	// export async function load({fetch}) {
	// 	const res = await fetch(`https://eric-portfolio.ghost.io/ghost/api/v3/content/posts/?key=0c0619aa6637854338d7d12d14`,{mode: 'no-cors'})
	// 	.then(res => {
	// 			return res.json();
	// 		}
	// 	);

	// 	try {
	// 		return {
	// 			props: {
	// 				jsonPosts: res
	// 			}
	// 		}
	// 	} catch(err) {
	// 		console.log(err);
	// 	}

	// }

	// export async function load({ fetch }) {
	// 	const res = await fetch('/blog.json');
	// 	console.log(res);
	// 	return {
	// 		props: {
	// 			posts: await res
	// 		}
	// 	};
	// }


	export const prerender = true;
	const slugRegex = /^(?:\d{3}-)([a-z-]+)(?:\.md)$/;

	// console.log(slugRegex);
    export async function load({ page, session }) {
        // const { slug } = page.params;
        const pages = session.pages;

		// console.log(slug);



		return {
			props: {
				posts: pages
			}
		}
        // const slugs = Object.fromEntries(
        //     pages.map((page) => [page.filename.match(slugRegex)[1], page])
        // );

        // if (slug in slugs) {
        //     const pages = Object.fromEntries(
        //         await Promise.all(
        //             Object.entries(import.meta.glob('/src/pages/*.svx')).map(
        //                 async ([path, page]) => {
        //                     const filename = path.split('/').pop();
        //                     const slug = filename.match(slugRegex)[1];
        //                     return [slug, page];
        //                 }
        //             )
        //         )
        //     );

        //     const { default: Rendered } = await pages[slug]();

        //     return {
        //         props: {
        //             title: slugs[slug].title,
        //             description: slugs[slug].description,
        //             Rendered,
        //         },
        //     };
        // } else {
        //     // not found
        //     return {
        //         status: 404,
        //         error: new Error('Not found'),
        //     };
        // }
    }

</script>

<script>

	import { onMount } from 'svelte';

	export let posts;

	console.log(posts);
	// import Animation from '$lib/animations.js';

	// onMount(() => {
	// 	const ThreeJs = new Animation({
	// 		dom: document.querySelector('.container')
	// 	});
	// })

</script>
<main>
	<div data-scroll>
		<section>
			<h1>Posts</h1>
			<ul>
				<!-- {#if posts}
					{#each posts as post}
					<li>
						<a class="post" href="/blog/{post.slug}">
							<img src="{post.feature_image}" crossorigin="anonymous">
							<p>
								{post.title}
							</p>
						</a>
					</li>
					{/each}
				{/if} -->
			</ul>
		</section>
	</div>
</main>
<div class="container"></div>
<style lang="scss">
    canvas {
        display: block;
    }

	.container {
		position: fixed;
		width: 100vw;
		height: 100vh;
		left: 0;
		top: 0;
		z-index: -1;

	}

	ul {
		margin: 0;
		padding: 0;

		li {
			list-style: none;
			max-width: 1280px;
			margin: 0 auto;

			&:last-child {
				margin-right: 0;
			}
		}
	}

	.post {
		display: block;
		background-size: cover;
		background-position:center;
		background-repeat: no-repeat;
		// height: auto;

		img {
			width: 100%;
			// height: 100%;
			object-fit: cover;
			max-height: 500px;
			opacity: 0;
		}

	}

</style>
