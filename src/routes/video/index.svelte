<script>
    import { onMount } from 'svelte';
    import Video from '$lib/threejs-video.js';


	onMount(() => {
        const video = new Video({
            dom: document.querySelector('.video')
        });
    })
</script>

<div class="image"></div>
<div class="video"></div>

<!-- <img class="jp" src="/images/texture.png" alt="jp"> -->
<style lang="scss">
    .video {
        position: fixed;
        top: 0%;
        left: 0%;
        width: 100%;
        height: 100%;
        z-index: 1;
    }

    .image {
        position: fixed;
        top: 50%;
        left: 50%;
        width: 40vh;
        height: 20vh;
        border: 1px solid red;
        transform: translate(-50%,-50%);
        z-index: 5;
    }


</style>