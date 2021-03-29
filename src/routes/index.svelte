<script context="module">

	export async function load({fetch}) {
		const res = await fetch(`https://eric-portfolio.ghost.io/ghost/api/v3/content/posts/?key=0c0619aa6637854338d7d12d14`)
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

</script>

<main>

	<h1>Posts</h1>
	<ul>
		{#each posts as post}
			{post.title}
		{/each}
	</ul>
</main>

<style lang="scss">
	:root {
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell,
			'Open Sans', 'Helvetica Neue', sans-serif;
	}

	main {
		text-align: center;
		padding: 1em;
		margin: 0 auto;
	}

	h1 {
		color: #ff3e00;
		text-transform: uppercase;
		font-size: 4rem;
		font-weight: 100;
		line-height: 1.1;
		margin: 4rem auto;
		max-width: 14rem;
	}

	p {
		max-width: 14rem;
		margin: 2rem auto;
		line-height: 1.35;
	}

	@media (min-width: 480px) {
		h1 {
			max-width: none;
		}

		p {
			max-width: none;
		}
	}
</style>
