<script>
	import Heading from './Heading.svelte';
	let i = 0;
	export let heading = 'This is a hero heading..';
	let textArr = heading.split('');

	const splitHeading = splitText(textArr);

	function splitText(textArr) {
		let splitArr = textArr;
		splitArr.forEach(letter => {
			if(letter.indexOf(' ') >= 0) {
				splitArr[i] = null;
			}
        i++;
    	});

		return splitArr;
    }
</script>

<section class="hero" data-scroll-section>
	<Heading let:hovering={active}>
		{#each splitHeading as letter}
			<span class:active>
				{#if letter == null}
					<span class="whitespace"></span>
				{:else}
					<span>{letter}</span>
				{/if}
			</span>
		{/each}
	</Heading>
</section>

<style lang="scss">
    .hero {
		display: flex;
		justify-content: center;
		align-items: center;
		// position: relative;
		height: 100vh;
		span {
                display: inline-block;
                position: relative;

				&.active {
					overflow: hidden;
				}
                &.whitespace {
                    width: 1.2vw;
                }
			}

	}
</style>