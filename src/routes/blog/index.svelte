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
	// Setup post feed

	// export const prerender = true;
    // export async function load({ page, session }) {
    //     const { slug } = page.params;
    //     const posts = session.posts;

	// 	console.log(posts);

    //     if (posts.length) {
    //         return {
    //             props: {
    //                 posts: posts
    //             },
    //         };
    //     } else {
    //         return {
    //             status: 404,
    //             error: new Error('Not found'),
    //         };
    //     }

    // }


</script>

<script>
	// import { onMount } from 'svelte';

	// export let posts;

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
							<img src="static{post.featured_image}" alt="post">
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
			min-height: 500px;
			opacity: 0;
		}

		a,p {
			color: black;
			text-decoration: none;
			&:hover {
				color: black;
			}
		}

	}

</style>
