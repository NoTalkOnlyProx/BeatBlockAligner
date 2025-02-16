<script lang="ts">
    import { handleDropEvent } from "src/utils/FileUtils";
    import { createEventDispatcher } from "svelte";
    const dispatch = createEventDispatcher();
    let dragging = false;

    async function handleDrop(e : DragEvent) {
        let files = await handleDropEvent(e);

        dispatch("filesDragged", {
            files
        });

        dragging = false;
    }
    function handleDragover(e : Event) {
        e.preventDefault();
    }
    function handleDragEnter() {
        dragging = true;
    }
    function handleDragLeave() {
        dragging = false;
    }
</script>

<!-- I genuinely can't figure out what I am supposed to add for this. -->
<!-- I am open to a contribution -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div 
    on:drop={handleDrop}
    on:dragover={handleDragover}
    on:dragenter={handleDragEnter}
    on:dragleave={handleDragLeave}
    class:dragging={dragging}
    class="dragbox">Drag a BeatBlock level folder here</div>
<style>
    @import "../global.css";
    .dragbox {
        width: 30vw;
        height: 15vw;
        background-color: var(--highlight-bg-color);
        color: var(--highlight-text-color);
        padding: 2vw;
        outline-color: var(--highlight-text-color);
        outline-width: 5px;
        outline-style: solid;
        text-align: center;
        line-height: 15vw;
        font-size: 2vw;
    }
    .dragbox:hover, .dragging {
        background-color: var(--highlight-bg-color-hover);
        color: var(--highlight-text-color-hover);
        outline-color: var(--highlight-text-color-hover);
    }
</style>