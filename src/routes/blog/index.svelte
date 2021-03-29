<script context="module">
    export async function load({ fetch }) {
        const res = await fetch('/blog.json');

        return {
            props: {
                posts: await res.json()
            }
        }
    }
</script>

<script>
	export let posts;

    console.log(posts);
</script>

<h1>blog</h1>

<ul>
	{#each posts as post}
		<li><a href="/blog/{post.slug}">{post.title}</a></li>
	{/each}
</ul>