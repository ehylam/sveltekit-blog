
<script lang="ts">
	import Animation from '$lib/animations.js';
	import { onMount } from 'svelte';

	onMount(() => {
		const test = new Animation({
			dom: document.querySelector('.container')
		});


	})

</script>

<main>
	<div class="container"></div>
</main>

<style lang="scss">
	.container {
		width: 100%;
		height: 100vh;
	}
</style>
