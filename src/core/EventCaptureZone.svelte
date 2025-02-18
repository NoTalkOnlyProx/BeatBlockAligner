<script lang="ts">
    import { onDestroy, onMount } from "svelte";
    let zone : HTMLElement;

    /* This is just a dumb little invention that lives inside a lane, and always scrolls with the
     * view rect. It exists to fix event bubbling. I used to make container lanes span the whole
     * song, but it turns out that dynamically resizing container elements triggers a re-flow for
     * all children, so this is actually really laggy. So instead we have to do this.
     */

    /* Doing this with event listeners so that it is blisteringly fast */
    onMount(() => {
        animate();
	});
    let lastID : number = 0;
    function animate() {
        position();
        lastID = requestAnimationFrame(animate);
    }
    onDestroy(() => {
        cancelAnimationFrame(lastID);
	});

    function position() {
        let containerRect = zone.parentElement!.getBoundingClientRect();
        zone.style.left = -containerRect.x + "px";
        zone.style.width = window.innerWidth + "px";
    }
</script>
<div class="zone" bind:this={zone} style={$$props.style}>
    <slot/>
</div>
<style>
    .zone {
        position: absolute;
    }
</style>