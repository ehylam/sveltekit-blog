<!-- Todo -->
<!-- Implement barba.js for seamless transiiton between index and {slug} page -->

<script context="module">
	export const prerender = true;

	export async function load({ page, session }) {
        const { slug } = page.params;
        const posts = session.posts;

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
	import Post from '$lib/components/Post.svelte';
	export let posts;

	let postsClone = JSON.parse(JSON.stringify(posts));

	for (let i = 0; i < postsClone.length; i++) {
		let post = postsClone[i];
		post.id = i;
		post.title = post.title.split('');
	}

	console.log(postsClone);


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
				{#if postsClone}
					{#each postsClone as post}
					<Post let:hovering={active} postId={post.id}>
						<a class='post post-{post.id}' href="/work/{post.slug}">
							<div class="post__wrap">
								<img src="{post.featured_image}" alt="post">
							</div>
							<div class="post__content">
								<h1>
									{#each post.title as letter}
									<span class:active>
										{#if letter == ' '}
											<span class="whitespace"></span>
										{:else}
											<span>{letter}</span>
										{/if}
									</span>
									{/each}
								</h1>
							</div>
						</a>
					</Post>
					{/each}
				{/if}
			</ul>
		</section>
		<footer>Eric Lam © 2021</footer>
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
		&__heading {
			padding-bottom: 0.5em;
			border-bottom: 1px solid #d4a346;
			margin-bottom: 1.5em;
		}
	}

	ul {
		padding: 0;
	}

	.post {
		display: flex;
		background-size: cover;
		background-position:center;
		background-repeat: no-repeat;

		@media (min-width: 768px) {
			justify-content: space-between;


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
			position: absolute;
			width: 100%;
			height: 100%;

			h1 {
				display: flex;
				position: absolute;
				top: 50%;
				left: 50%;
				transform: translate(-50%, -50%);
				pointer-events: none;
			}

			span {
				position: relative;
				overflow: hidden;
				display: inline-block;
				&.whitespace {
                    width: 2vw;
                }
			}
		}



		// a,p {
		// 	color: #d4a346;
		// 	text-decoration: none;
		// 	&:hover {
		// 		color: #d4a346;
		// 	}
		// }

		h1 {
			margin: 0;
		}

	}


footer {
        width: 100%;
        min-height: 200px;
        display: flex;
        justify-content: center;
        align-items: center;
    }
</style>
