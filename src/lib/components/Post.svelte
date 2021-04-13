<script>
    import { onMount } from 'svelte';
    import gsap from 'gsap';

    export let postId;
    let hovering;

    const headingEnter = gsap.timeline({paused:true});
    const headingLeave = gsap.timeline({paused:true});

    onMount(() => {
        setTimeline();
    })

    const setTimeline = () => {
        if(postId == undefined) {
            setTimeout(setTimeline, 100);
        } else {

            headingEnter.to(`.post-${postId} span span`, {
                duration: 0.2,
                left: (postId % 2 == 0) ? '100%' : '-100%',
                ease: 'linear'
            }).to(`.post-${postId} span span`, {
                duration: 0,
                left: (postId % 2 == 0) ? '-100%' : '100%',
            }).to(`.post-${postId} h1`, {
                left: (postId % 2 == 0) ? '65%' : '35%',
                duration: 0,
            }).to(`.post-${postId} span span`, {
                duration: 0.2,
                left: "0%",
                ease: 'linear'
            },0.3)

            headingLeave.to(`.post-${postId} span span`, {
                duration: 0.2,
                left: (postId % 2 == 0) ? '-100%' : '100%',
                ease: 'linear'
            }).to(`.post-${postId} span span`, {
                duration: 0,
                left: (postId % 2 == 0) ? '100%' : '-100%',
            }).to(`.post-${postId} h1`, {
                left: "50%",
                duration: 0,
            }).to(`.post-${postId} span span`, {
                duration: 0.2,
                left: "0%",
                ease: 'linear'
            },0.3)
        }

    }

	function enter() {
		hovering = true;
        headingLeave.progress(0);
        headingEnter.pause();
        headingEnter.progress(0);
        headingLeave.pause();
        headingEnter.play();
	}

	function leave() {
		hovering = false;
        headingLeave.progress(0);
        headingLeave.pause();
        headingLeave.play();
	}
</script>

<li on:mouseenter={enter} on:mouseleave={leave} class:hovering>
	<slot hovering={hovering}></slot>
</li>

<style lang="scss">
	li {
		position: relative;
		list-style: none;
        margin: 80px 0;


		&:first-child {
			margin-top: 15px;
		}

		&:nth-child(odd) {
			:global(a.post) {
				flex-direction: row;
			}
		}

		&:nth-child(even) {
			:global(a.post) {
				flex-direction: row-reverse;
			}
		}
	}
</style>