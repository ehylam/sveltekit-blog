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

	export const prerender = true;
	const slugRegex = /^(?:\d{3}-)([a-z-]+)(?:\.md)$/;

	// console.log(slugRegex);
    export async function load({ page, session }) {
        const { slug } = page.params;
        const pages = session.pages;

		// console.log(slug);

        const slugs = Object.fromEntries(
            pages.map((page) => [page.filename.match(slugRegex)[1], page])
        );



        if (slug in slugs) {
            const pages = Object.fromEntries(
                await Promise.all(
                    Object.entries(import.meta.glob('/src/pages/*.svx')).map(
                        async ([path, page]) => {
                            const filename = path.split('/').pop();
                            const slug = filename.match(slugRegex)[1];
                            return [slug, page];
                        }
                    )
                )
            );

            const { default: Rendered } = await pages[slug]();

            return {
                props: {
                    title: slugs[slug].title,
                    description: slugs[slug].description,
                    Rendered,
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
