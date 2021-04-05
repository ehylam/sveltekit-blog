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

    export const prerender = true;

    const slugRegex = /^(?:\d{3}-)([a-z-]+)(?:\.md)$/;

    export async function load({ page, session }) {
        const slug = page.params.slug;


        const postsSesson = session.posts;

        const post = postsSesson.find(post => post.slug === slug);

        // const slugs = Object.fromEntries(
        //     pages.map((page) => [slug.match(slugRegex)[1], page])
        // );

        if (post) {
            const posts = Object.fromEntries(
                await Promise.all(
                    Object.entries(import.meta.glob('/src/posts/*.md')).map(
                        async ([path, page]) => {
                            const { metadata } = await page();
                            const filename = path.split('/').pop();
                            const slug = filename.slice(0, -3);
                            return [slug, page, metadata];
                        }
                    )
                )
            );

            const { default: Rendered } = await posts[post.slug]();

            return {
                props: {
                    title: post.title,
                    featured_image: post.featured_image,
                    Rendered
                },
            };
        } else {
            // not found
            return {
                status: 404,
                error: new Error('Not found'),
            };
        }
    }

</script>

<script>
    export let title;
    export let featured_image;
    export let Rendered;

	console.log(Rendered);
</script>
<!--
<svelte:head>
	<title>{post.title}</title>
</svelte:head>

<h1>{post.title}</h1>
<div class="post">
	{@html post.html}
</div> -->

<article>
    <h2>{title}</h2>
    <img src="{featured_image}" alt="post">
    <Rendered/>
</article>