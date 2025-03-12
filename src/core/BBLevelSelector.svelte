<script lang="ts">
    import { handleDropEvent } from "src/utils/FileUtils";
    import { createEventDispatcher } from "svelte";
    import { BBLevelLoader } from "./BBLevelLoader";
    const dispatch = createEventDispatcher();
    let dragging = false;
    let lastReason = "";
    let processing = false;

    function loadFailed(reason : string) {
        console.error(reason);
        lastReason = reason;
    }

    export async function handleDrop(e : DragEvent) {
        dragging = false;
        try {
            processing = true;
            let files = await handleDropEvent(e);
            await onFilesDragged(files);
            processing = false;
        } catch (error) {
            /* am lazy, sorry */
            loadFailed("Unknown error, see console.");
            throw error;
        }
    }

    async function onFilesDragged(files : FileSystemEntry[]) {
        let bbll = new BBLevelLoader();
        if(await bbll.load(files, loadFailed)) {
            dispatch("loaded", bbll);
        }
    }

    function cancelEvent(e : Event) {
        e.preventDefault();
        e.stopPropagation();
    }
    function handleDragEnter() {
        console.log("DENTER");
        dragging = true;
    }
    function handleDragLeave() {
        console.log("DEXIT");
        dragging = false;
    }
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
    class="dragcenter"
    on:drop={handleDrop}
    on:dragover={cancelEvent}
    on:dragenter={handleDragEnter}
    on:dragleave={handleDragLeave}
>
    <div class:dragging={dragging} class:processing={processing} class="dragbox">
        Drag a BeatBlock level folder or .ogg file here
    </div>
    <div class="reason">{lastReason}</div>
</div>
        

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
        font-size: 2vw;
        display: flex;
        justify-content: center;
        align-items: center;
        pointer-events: none;
    }
    .dragging {
        background-color: var(--highlight-bg-color-hover);
        color: var(--highlight-text-color-hover);
        outline-color: var(--highlight-text-color-hover);
    }
    .processing {
        pointer-events: none;
        background-color: var(--highlight-bg-color-disabled);
        color: var(--highlight-text-color-disabled);
        outline-color: var(--highlight-text-color-disabled);
    }
    .dragcenter {
        display: flex;
        justify-content: center;
        align-items: center;
        flex-direction: column;
        width: 100%;
        height: 100%;
    }
    .reason {
        margin-top:2vw;
    }
</style>