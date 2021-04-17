<script>
    import { onMount } from 'svelte';
    import { spring } from 'svelte/motion';

    let scrollY;
    let documentHeight = 0;
    let navBounds;
    // let holoBounds;
    let hovering;
    let menuOpen;
    let navX = 75;
    let navY = 45;

    let scrollPercentage = 0;

    $: scrollPercentage = (scrollY  / documentHeight) * 100;


    let coords = spring(
        {
            x: navX,
			y: -navY
        },
        {
            stiffness: 0.04,
            damping: 0.5
        }
    )




    function setCirclePos() {
        let navParent = document.querySelector('.nav');
        // let navHolo = document.querySelector('.nav__holo');
        navBounds = navParent.getBoundingClientRect();
        // holoBounds = navHolo.getBoundingClientRect();

        if(window.innerWidth < 1024) {
            navX = 30;
            navY = 30;
        } else {
            navX = 75;
            navY = 45;
        }

        coords.set({
			x: navBounds.width - navX - 20,
			y: navY
		})
    }

	function handleMousemove(e) {
		const {clientX, clientY} = e;
        let boundsX = clientX - window.innerWidth + navBounds.width - 10;
        let boundsY = clientY - 10;

		coords.set({
			x: boundsX,
			y: boundsY
		})

        hovering = true;
	}

    function handleMouseout(e) {
        setCirclePos()
        hovering = false;
    }

    function handleMenu() {
        menuOpen = !menuOpen;
    }

    // function handleCenterCircle() {
    //     coords.set({
	// 		x: navBounds.width - 30 - 20,
	// 		y: 30
	// 	})
    // }

    onMount(() => {
        window.addEventListener('resize', setCirclePos);

        documentHeight = document.documentElement.scrollHeight - window.innerHeight;

        setCirclePos();

    })

</script>

<svelte:window bind:scrollY/>


<a href="/" class="logo">Eric Lam<span>🗻</span></a>
<nav on:mousemove={handleMousemove} on:mouseout={handleMouseout} class="{hovering ? 'nav chomped' : 'nav'}">
    <div style="top: {$coords.y}px; left: {$coords.x}px" class="{menuOpen ? 'nav__circle active' : 'nav__circle' }">
        <span></span>
    </div>

    <div class="{menuOpen ? 'nav__holo active' : 'nav__holo'}" on:click={handleMenu}>

    </div>
</nav>

<div class="{menuOpen ? 'menu show' : 'menu'}">
    <ul on:click={handleMenu}>
        <li>
            <a href="/">Home</a>
        </li>
        <li>
            <a href="/about">About</a>
        </li>
        <li>
            <a href="/photos">Photos</a>
        </li>
    </ul>
</div>

<style lang="scss">
    .logo {
        position: fixed;
        top: 30px;
        left: 30px;
        z-index: 999;
        font-weight: bold;

        @media (min-width: 1024px) {
            top: 45px;
            left: 75px;
        }

        span {
            position: relative;
            z-index: 998;
            line-height: 0.8;
            font-size: 20px;
            transition: all 0.3s cubic-bezier(0.70, 0, 0.4, 1);
        }

    }
    .nav {
        position: fixed;
        top: 0;
        right: 0;
        z-index: 999;
        width: 20vw;
        height: 20vw;

        // &.chomped {

        // }
        a {
            color: black;
        }

        &__circle {
            position: absolute;
            width: 20px;
            height: 20px;
            border-radius: 100%;
            background-color: #d4a346;
            top: 45px;
            left: calc(100% - 75 - 20px);
            animation: fadeIn 2s ease;
            // transition: border-radius 0.5s ease, transform 0.3s ease;

            // &.chomped {
            //     border-radius: 0;
            //     transform: rotate(45deg);
            // }

            &.active {
                animation: borderAnimate 8s ease infinite;
            }
        }

        &__holo {
            position: absolute;
            width: 28px;
            height: 28px;
            border-radius: 100%;
            border: 2px solid #d4a346;
            top: 26px;
            left: calc(100% - 28px - 26px);
            transition: all 0.5s ease;
            transform: rotate(0deg);
            cursor: pointer;

            @media (min-width: 1024px) {
                top: 41px;
                left: calc(100% - 73px - 26px);
            }

            &:hover {
                border-radius: 0;
                transform: rotate(45deg);
            }

            &.active {
                animation: borderAnimate 8s ease infinite;

            }

        }
    }

.menu {
    position: fixed;
    top: 0;
    right: 30px;
    max-width: 30px;
    max-height: 30px;
    opacity: 0;
    width: 100%;
    height: 100%;
    background-color: #252533;
    display: flex;
    justify-content: center;
    align-items: center;

    ul {
        display: flex;
        justify-content: center;
        align-items: center;
        flex-direction: column;
        padding: 0;
        margin: 0;
        li {
            list-style: none;

            a {
                font-size: 32px;
                font-family: 'DM Serif Display';
                @media (min-width: 768px) {
                font-size: 48px;
                }
            }
        }
    }

    &.show {
        right: 0;
        max-width: 100%;
        max-height: 100%;
        opacity: 1;
        z-index: 888;
    }
}
    @keyframes fadeIn {
        0% {
            opacity: 0;
        }

        100% {
            opacity: 1;
        }
    }

    @keyframes borderAnimate {
        0% {
            border-radius: 100%;
        }

        25% {
            border-radius: 44% 56% 51% 49% / 56% 37% 63% 44%;
        }

        50% {
            border-radius: 51% 49% 55% 45% / 44% 55% 45% 56%;
        }

        75% {
            border-radius: 59% 41% 46% 54% / 56% 52% 48% 44%;
        }

        100% {
            border-radius: 100%;
        }
    }
</style>
