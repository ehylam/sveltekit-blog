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
	import Hero from '$lib/components/Hero.svelte';

	export let posts;

	onMount(() => {
		const ThreeJs = new Animation({
			dom: document.querySelector('.container')
		});
	})

</script>
<main>
	<div data-scroll>
		<Hero/>
		<section class="projects">
			<h3 class="projects__heading">Personal projects</h3>
			<ul>
				{#if posts}
					{#each posts as post}
					<li>
						<a class="post" href="/work/{post.slug}">
							<div class="post__wrap">
								<img src="{post.featured_image}" alt="post">
							</div>
							<div class="post__content">
								<h1>
									{post.title}
								</h1>
							</div>
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

			&:first-child {
				a.post {
					padding-top: 15px;
				}
			}

			&:nth-child(odd) {
				a.post {
					flex-direction: row;
				}
			}

			&:nth-child(even) {
				a.post {
					flex-direction: row-reverse;
				}
			}
		}
	}

	.post {
		display: flex;
		background-size: cover;
		background-position:center;
		background-repeat: no-repeat;
		padding: 50px 0;
		@media (min-width: 768px) {
			justify-content: space-between;


		}

		@media (min-width: 1024px) {
			// max-width: 65%;
		}
		@media (min-width: 1280px) {
			// max-width: 350px;
		}

		&__wrap {
			flex-basis: calc(50% - 2.5vw);
			img {
				width: 100%;
				object-fit: cover;
				opacity: 0;
				height: 100%;
				max-height: 450px;
			}
		}

		&__content {
			flex-basis: calc(50% - 2.5vw);
		}



		a,p {
			color: white;
			text-decoration: none;
			&:hover {
				color: white;
			}
		}

		h1 {
			margin: 0;
		}

	}

	.test {
		height: 400px;
		width: 100%;
	}

</style>
