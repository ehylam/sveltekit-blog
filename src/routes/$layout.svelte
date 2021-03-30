<script>
    import Nav from '$lib/Nav.svelte';
    import Footer from '$lib/Footer.svelte';

</script>

<Nav/>
<slot></slot>
<Footer/>

<style>

    * {
        box-sizing: border-box;
    }
    :global(body) {
        margin: 0;
        padding: 0;

    }

    :root {
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell,
			'Open Sans', 'Helvetica Neue', sans-serif;
	}



	:global(h1) {
		color: #ff3e00;
		text-transform: uppercase;
		font-size: 4rem;
		font-weight: 100;
		line-height: 1.1;
	}

	:global(p) {
		margin: 2rem auto;
		line-height: 1.35;
	}

</style>