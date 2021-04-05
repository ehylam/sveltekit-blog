<script context="module">
	export const prerender = true;

	export async function load({ page, session }) {
        const { slug } = page.params;
        const posts = session.posts;

		console.log(posts);

        if (posts.length) {
            return {
                props: {
                    posts: posts
                },
            };
        } else {
            return {
                status: 404,
                error: new Error('Not found'),
            };
        }

    }


</script>

<script>
	import { onMount } from 'svelte';
	import Animation from '$lib/animations.js';

	export let posts;

	onMount(() => {
		const ThreeJs = new Animation({
			dom: document.querySelector('.container')
		});
	})

</script>
<main>
	<div data-scroll>
		<section>
			<h1>Work</h1>
			<ul>
				{#if posts}
					{#each posts as post}
					<li>
						<a class="post" href="/work/{post.slug}">
							<img src="{post.featured_image}" alt="post">
							<p>
								{post.title}
							</p>
						</a>
					</li>
					{/each}
				{/if}
			</ul>
		</section>

		<section class="test">

		</section>
	</div>
</main>
<div class="container"></div>
<style lang="scss">
    canvas {
        display: block;
		height: 100%;
		width: 100%;
    }

	.container {
		position: fixed;
		width: 100vw;
		height: 100%;
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
			opacity: 0;
			height: 500px;

		}
		a,p {
			color: black;
			text-decoration: none;
			&:hover {
				color: black;
			}
		}

		p {
			margin: 20px 0 40px;;
		}

	}

	.test {
		height: 400px;
		width: 100%;
	}

</style>
