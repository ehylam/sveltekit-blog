<script>

</script>

<nav class="nav">
    <div class="nav__circle">
        <span></span>
    </div>
    <div class="nav__menu">
        <a href="/">Home</a>
    </div>
</nav>

<style lang="scss">
    .nav {
        position: fixed;
        top: 10px;
        right: 10px;
        z-index: 999;
        a {
            color: black;
        }

        &__circle {
            width: 20px;
            height: 20px;
            border-radius: 100%;
            background-color: rgb(219, 219, 219);
        }

        &__menu {
            display: none;
        }
    }
</style>
