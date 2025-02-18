<script lang="ts">
    export let fixed = false;
    export let zoom = 0;
    export let center = 0;
</script>
<div style={$$props.style} class="tzcontainer">
    <div class="tzdomain"
        style:left={fixed ? "0px" : ((50 - center * zoom) + "vw")}
        style:width={fixed ? "100%" : "100px"}
        >
        <slot />
    </div>
</div>
<style>
    .tzcontainer {
        overflow: auto;
        display: block;
        overflow-x: hidden;
        box-sizing: border-box;
    }
    .tzdomain {
        height:100%;
        transform-origin: top left;
        position: relative;
        display: block;
        container-name: timeline;
        container-type: inline-size;
        box-sizing: border-box;
    }
    :global(.tzdomain > *) {
        position: absolute;
        display: block;
        box-sizing: border-box;
    }
</style>