<script>

    import { onMount } from 'svelte';
    import Playground from '$lib/threejs-playground.js';


	onMount(() => {
        const playGround = new Playground({
            dom: document.querySelector('.playground')
        });
    })
</script>


<div class="playground"></div>

<style>
    .playground {
        width: 100%;
        height: 100%;
    }
</style>