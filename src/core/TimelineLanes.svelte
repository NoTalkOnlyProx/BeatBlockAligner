<script lang="ts">

</script>
<div class="lanes" style={$$props.style}>
    <slot/>
</div>
<style>
    .lanes {
        left: 0%;
        width: 100%;
        display: flex;
        flex-direction: column;
    }
    :global(.lanes > *) {
        position: relative;
        display: block;
        box-sizing: border-box;
    }
</style>