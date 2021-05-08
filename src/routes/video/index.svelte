<script>
    import { onMount } from 'svelte';
    import Video from '$lib/threejs-video.js';


	onMount(() => {
        const video = new Video({
            dom: document.querySelector('.video')
        });
    })
</script>


<div class="video"></div>

<style lang="scss">
    .video {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
    }


</style>