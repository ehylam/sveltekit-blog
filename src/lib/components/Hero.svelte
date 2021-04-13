<script>
	import { onMount } from 'svelte';
	import gsap from 'gsap';

	let hovering;

	function enter() {
		hovering = true;
	}

	function leave() {
		hovering = false;
	}

	onMount(() => {
		gsap.to('.hero__heading span span', {
			rotate: '0deg',
			ease: 'expo.inOut',
			duration: 1.6,
			delay: 0.4
		})
	})

</script>

<section class="hero">
	<div class="hero__heading" on:mouseenter={enter} on:mouseleave={leave} class:hovering>
		<span><span>Heyoo,</span></span>
		<span><span>Lorem, ipsum.</span></span>
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
				font-size: 50px;
				transform-origin: bottom right;
				transform: rotate(-90deg);
				@media (min-width: 1024px) {
					font-size: 64px;
				}
			}
		}

	}
</style>