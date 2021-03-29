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

	const posts = jsonPosts.posts;
</script>

<main>

	<h1>Posts</h1>
	<ul>
		{#each posts as post}
		<li>
			<a href="/blog/{post.slug}">
				{post.title}
			</a>
		</li>
		{/each}
	</ul>
</main>
