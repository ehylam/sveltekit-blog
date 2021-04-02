<script context="module">
	export async function load({fetch}) {
		const res = await fetch(`https://eric-portfolio.ghost.io/ghost/api/v3/content/posts/?key=0c0619aa6637854338d7d12d14`,{mode: 'no-cors'})
		.then(res => {
				return res.json();
			}
		);

		try {
			return {
				props: {
					jsonPosts: res
				}
			}
		} catch(err) {
			console.log(err);
		}

	}


</script>

<script lang="ts">
	export let jsonPosts;
	const posts = jsonPosts.posts;
	import Animation from '$lib/animations.js';
	import { onMount } from 'svelte';

	onMount(() => {
		const ThreeJs = new Animation({
			dom: document.querySelector('.container')
		});
	})

</script>
<main>
	<div data-scroll>
		<section>
			<h1>Posts</h1>
			<ul>
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
