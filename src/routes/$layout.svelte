<script>
    import Nav from '$lib/Nav.svelte';
    import Footer from '$lib/Footer.svelte';

</script>
	<Nav/>
		<slot></slot>
	<Footer/>
<style lang="scss">
	@import '../lib/typography';
    * {
        box-sizing: border-box;
    }
    :global(body) {
        margin: 0;
        padding: 0;
		background-color: rgb(12, 8, 10);
		font-family: 'Cavian';
    }

    :root {
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell,
			'Open Sans', 'Helvetica Neue', sans-serif;
	}

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


	.container {
		position: fixed;
		width: 100vw;
		height: 100vh;
		left: 0;
		top: 0;
		z-index: -1;

	}

</style>