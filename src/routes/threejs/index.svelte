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


<!-- Todo watch "Text outline animation effect with three.js" -->
<section class="test">
    <h1>hero heading test + threejs effect</h1>
</section>

<style lang="scss">
    .playground {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
    }

    .test {
        position: relative;
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100vh;
        width: 100%;
        z-index: 5;
        margin: 0;

        h1 {
            font-size: 4em;
            color: white;
        }
    }
</style>