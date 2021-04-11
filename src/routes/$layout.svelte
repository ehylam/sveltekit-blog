<script>
	import { onMount } from 'svelte';
    import Nav from '$lib/components/Nav.svelte';
    import Footer from '$lib/components/Footer.svelte';


</script>
	<Nav/>
		<slot></slot>
	<Footer/>
<style lang="scss">


	@font-face {
		font-family: 'Source Sans Pro';
		src: url('../fonts/SourceSansPro-Bold.woff2') format('woff2'),
			url('../fonts/SourceSansPro-Bold.woff') format('woff');
		font-weight: bold;
		font-style: normal;
		font-display: swap;
	}

	@font-face {
		font-family: 'Source Sans Pro';
		src: url('../fonts/SourceSansPro-Regular.woff2') format('woff2'),
			url('../fonts/SourceSansPro-Regular.woff') format('woff');
		font-weight: normal;
		font-style: normal;
		font-display: swap;
	}

	@font-face {
    font-family: 'DM Serif Display';
    src: url('../fonts/DMSerifDisplay-Regular.woff2') format('woff2'),
        url('../fonts/DMSerifDisplay-Regular.woff') format('woff');
    font-weight: normal;
    font-style: normal;
    font-display: swap;
}


    :global(*) {
		margin: 0;
		padding: 0;
        box-sizing: border-box;
    }
    :global(body) {
        margin: 0;
        padding: 0;
		background-color: rgb(212, 212, 212);
		font-family: 'Source Sans Pro';
		color: #d4a346;
    }

	:global(h1,h2,h3,h4,h5,a,p,span,input) {
		color: #d4a346;
		font-weight: 400;
	}

	:global(h1,h2,h3,h4,h5) {
		// font-family: 'DM Serif Display';
		font-family: 'DM Serif Display';
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