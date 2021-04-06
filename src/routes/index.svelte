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
		<section class="hero">
			<h1>This is a hero heading..</h1>
		</section>
		<section class="projects">
			<h3 class="projects__heading">Personal projects</h3>
			<ul>
				{#if posts}
					{#each posts as post}
					<li>
						<a class="post" href="/work/{post.slug}">
							<img src="{post.featured_image}" alt="post">
							<h1>
								{post.title}
							</h1>
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

	.hero {
		display: flex;
		justify-content: center;
		align-items: center;
		// height: 100vh;

		h1 {
			text-align: center;
		}
	}

	.projects {
		margin: 0 30px;
		@media (min-width: 1024px) {
			margin: 0 75px;
		}
		 &__heading {
		 }
	}

	ul {
		padding: 0;

		li {
			position: relative;

			list-style: none;
			// margin: 0 15vw;

			// &:nth-child(even) {
			// 	margin-right: 0;
			// }


			&:nth-child(odd) {
				a.post {
					margin: 0 auto 0 0;
				}
			}

			&:nth-child(even) {
				a.post {
					margin: 0 0 0 auto;
				}
			}
		}
	}

	.post {
		display: block;
		background-size: cover;
		background-position:center;
		background-repeat: no-repeat;
		padding: 50px 0;
		max-width: calc(100% - 60px);

		@media (min-width: 1024px) {
			max-width: 65%;
		}
		@media (min-width: 1280px) {
			max-width: 55%;
		}


		img {
			width: 100%;
			object-fit: cover;
			opacity: 0;
			height: 500px;

		}
		a,p {
			color: white;
			text-decoration: none;
			&:hover {
				color: white;
			}
		}

		h1 {
			position: absolute;
			left: 50%;
			top: 50%;
			transform: translate(-50%,-50%);
			margin: 0;
			text-align: center;
			pointer-events: none;
		}

	}

	.test {
		height: 400px;
		width: 100%;
	}

</style>
