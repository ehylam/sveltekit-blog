<script>
	import { onMount } from 'svelte';
	import gsap from 'gsap';

	export let titleArr = ['This is a','default title.'];
	let hovering;

	function enter() {
		hovering = true;
	}

	function leave() {
		hovering = false;
	}

	// TODO: split text and append inline style with css variable containing the index of the loop

	// Hello don't mind just practicing with a split keyboard and playing around with github copilot!

	//ME: hello Github Copilot!
	//Github Copilot: hello ME!
	//ME: hello Github Copilot!
	//Github Copilot: hello ME!
	//ME: hello Github Copilot!
	//Github Copilot: hello ME!



	onMount(() => {
		gsap.to('.hero__heading span span', {
			rotate: '0deg',
			ease: 'expo.inOut',
			duration: 1.6,
			delay: 0.4,
			stagger: 0.07
		})
	})

</script>

<section class="hero">
	<div class="hero__heading" on:mouseenter={enter} on:mouseleave={leave} class:hovering>
		{#if titleArr.length}
			{#each titleArr as title}
				<span><span>{title}</span></span>
			{/each}
		{/if}
	</div>
</section>

<style lang="scss">
    .hero {
		position: relative;
		height: 100vh;
		display: flex;
		justify-content: flex-start;
		align-items: center;

		&__heading {

		}

		span {
			display: block;
			overflow: hidden;
			span {
				position: relative;
				font-family: 'DM Serif Display';
				font-size: 4.5em;
				transform-origin: bottom right;
				transform: rotate(-90deg);
			}
		}

	}
</style>