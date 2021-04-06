<script context="module">
    export const prerender = true;

    export async function load({ page, session }) {
        const slug = page.params.slug;
        const postsSesson = session.posts;
        const post = postsSesson.find(post => post.slug === slug);


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
</script>

<svelte:head>
	<title>{title}</title>
</svelte:head>

<article>
    <img src="{featured_image}" alt="post">
    <h2>{title}</h2>
    <Rendered/>
</article>

<style lang="scss">

    img {
        width: 100%;
        max-height: 45vh;
        object-fit: cover;
    }
    :global(p) {
        margin-bottom: 5px;
    }
</style>