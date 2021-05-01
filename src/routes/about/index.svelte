<!-- About me page - TODO -->
<!-- Portrait photo.. with 3D transition animation with three.js !!! -->

<script>
    import Hero from '$lib/components/Hero.svelte';
    import { spring } from 'svelte/motion';
    import { pannable } from '../../actions/pannable';

    const coords = spring({ x: 0, y: 0 }, {
		stiffness: 0.2,
		damping: 0.4
	});


    // From svelte docs.
	function handlePanStart() {
		coords.stiffness = coords.damping = 1;
	}

	function handlePanMove(event) {
		coords.update($coords => ({
			x: $coords.x + event.detail.dx,
			y: $coords.y + event.detail.dy
		}));

	}

	function handlePanEnd(event) {
		coords.stiffness = 0.2;
		coords.damping = 0.4;
		coords.set({ x: 0, y: 0 });
	}


</script>

<Hero titleArr={["About","Me"]}/>

<section class="about">
    <img src="" alt="" class="about__image">


    <div class="about__heading">
        <h2>Hello!</h2>
        <div class="handshake" use:pannable on:panstart={handlePanStart} on:panmove={handlePanMove} on:panend={handlePanEnd} 	style="transform:
        translate({$coords.x}px,{$coords.y}px)
        rotate({$coords.x * 0.2}deg)">👋</div>
    </div>
    <div class="about__content">
        <p>Lorem ipsum dolor sit amet, consectetur adipisicing elit. Eius maiores fuga consequatur quibusdam eaque qui ab quas quidem quod error!</p>
    </div>
</section>

<style lang="scss">
    .about {
        padding: 60px 0;
        &__heading {
            h2 {
                display: inline-block;
            }
            .handshake {
                display: inline-block;
                cursor: pointer;
                font-size: 1.8em;
            }
        }

    }
</style>