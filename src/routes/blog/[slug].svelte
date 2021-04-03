<script context="module">

	// export async function load({fetch, page}) {
	// 	let slug = page.params.slug;

	// 	const res = await fetch(`https://eric-portfolio.ghost.io/ghost/api/v3/content/posts/slug/${slug}/?key=0c0619aa6637854338d7d12d14`)
	// 	.then(res => {
	// 			return res.json();
	// 		}
	// 	);

	// 	try {
	// 		return {
	// 			props: {
	// 				post: res.posts[0]
	// 			}
	// 		}
	// 	} catch(err) {
	// 		console.log(err);
	// 	}

	// }
	// export const prerender = true;

	// export async function load({ page, fetch }) {
	// 	const res = await fetch(`/blog/${page.params.slug}.json`);
	// 	return {
	// 		props: {
	// 			post: await res.json()
	// 		}
	// 	};
	// }

</script>
<!--
<script>
	export let post;
</script>

<svelte:head>
	<title>{post.title}</title>
</svelte:head>

<h1>{post.title}</h1>
<div class="post">
	{@html post.html}
</div> -->
