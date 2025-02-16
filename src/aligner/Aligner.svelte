<script lang="ts">
    import BBLevelEditor from "src/core/BBLevelEditor.svelte";
    import { BBLevelLoader } from "src/core/BBLevelLoader";
    import BBLevelSelector from "src/core/BBLevelSelector.svelte";

    let hasUploaded = false;
    let lastReason = "";
    let bbll : BBLevelLoader;
    let editor : BBLevelEditor;
    
    function loadFailed(reason : string) {
        console.log(reason);
        lastReason = reason;
    }

    async function onFilesDraggedSafe(e : CustomEvent) {
        try {
            await onFilesDragged(e.detail.files);
        } catch (error) {
            /* am lazy, sorry */
            loadFailed("Unknown error, see console.");
            throw error;
        }
    }

    async function onFilesDragged(files : FileSystemEntry[]) {
        bbll = new BBLevelLoader();
        if(await bbll.load(files, loadFailed)) {
            hasUploaded = true;
        }
    }

</script>
{#if !hasUploaded}
<div class="dragcenter">
    <BBLevelSelector on:filesDragged={onFilesDraggedSafe}></BBLevelSelector>
    <div class="reason">{lastReason}</div>
</div>
{:else}
    <BBLevelEditor bind:this={editor} bind:bbll></BBLevelEditor>
{/if}
<style>
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