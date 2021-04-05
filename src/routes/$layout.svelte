<script>
    import Nav from '$lib/Nav.svelte';
    import Footer from '$lib/Footer.svelte';

</script>
	<Nav/>
		<slot></slot>
	<Footer/>
<style lang="scss">
	@import '../lib/typography';
    :global(*) {
		margin: 0;
		padding: 0;
        box-sizing: border-box;
    }
    :global(body) {
        margin: 0;
        padding: 0;
		background-color: rgb(12, 8, 10);
		font-family: 'Rikiarregular';
		color: rgb(226, 226, 226);
    }

	:global(h1,h2,h3,h4,h5,a,p,span,input) {
    color: rgb(226, 226, 226);
}

	:global(h1,h2,h3,h4,h5) {
		font-family: 'Rikiarregular';
		font-weight: 400;
	}


	:global(h1) {
		font-size: 36px;
		line-height: 1.2;
		margin-bottom: 0.3em;
		@media (min-width: 1024px) {
			font-size: 52px;
		}
	}

	:global(h2) {
		font-size: 24px;
		line-height: 1.2;
		margin-bottom: 0.5em;
		@media (min-width: 1024px) {
			font-size: 32px;
		}
	}

	:global(h3) {
		font-size: 20px;
		line-height: 1.2;
		margin-bottom: 0.5em;
		@media (min-width: 1024px) {
			font-size: 26px;
		}
	}

	:global(h4) {
		font-size: 18px;
		line-height: 1.2;
		margin-bottom: 0.5em;
		@media (min-width: 1024px) {
			font-size: 22px;
		}
	}

	:global(p,a) {
		font-size: 14px;
		text-decoration: none;
		margin-bottom: 1em;
		@media (min-width: 1024px) {
			font-size: 16px;
		}
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