<script>
    import { onMount } from 'svelte';
    import gsap from 'gsap';

	let hovering;
    const headingEnter = gsap.timeline({paused:true});
    const headingLeave = gsap.timeline({paused:true});

    onMount(() => {
        headingEnter.to('h1 span span', {
            duration: 0,
            left: "200%",
        }).to('h1 span span', {
            duration: 0.2,
            left: 0,
        })

        headingLeave.from('h1 span span', {
            duration: 0,
            left: "0",
        }).to('h1 span span', {
            duration: 0.2,
            left: 0,
        })
    })

	function enter() {
		hovering = true;
        headingLeave.progress(0);
        headingEnter.play();
	}

	function leave() {
		hovering = false;
        headingEnter.progress(0);
        headingLeave.play();
	}
</script>

<h1 on:mouseenter={enter} on:mouseleave={leave} class:hovering>
	<slot hovering={hovering}></slot>
</h1>

<style lang="scss">
    h1 {


    }
</style>