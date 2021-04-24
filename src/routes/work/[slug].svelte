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
    <div class="wrapper">
        <div class="heading">
            <h1>{title}</h1>
        </div>
        <div class="content">
            <Rendered/>
        </div>
    </div>
</article>

<style lang="scss">
    article {
        width: 70vw;
        margin: 0 auto;

        .wrapper {
            display: flex;
            flex-wrap: wrap;
            margin: 3vw 0;

            .heading,.content {
                @media (min-width: 768px) {
                flex-basis: 50%;
                }
            }

            .heading {
                h1 {
                    margin-bottom: 1em;
                }
            }
        }
    }
    :global(article img) {
        width: 100%;
        max-height: 45vh;
        object-fit: cover;
    }
    :global(article p) {
        margin-bottom: 2em;
    }

    :global(article ul) {
        margin: 0;
        padding: 0;
        &:first-child {
            margin-bottom: 2vw;
        }

        :global(li) {
            list-style: none;
            display: flex;
            flex-wrap: wrap;
            @media (max-width: 768px) {
                flex-direction: column;
            }

            :global(h4) {
                flex-basis: 50%;
            }
        }
    }

</style>