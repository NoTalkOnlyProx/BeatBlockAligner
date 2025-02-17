<script lang="ts">
    import BBLevelEditor from "src/core/BBLevelEditor.svelte";
    import { BBLevelLoader } from "src/core/BBLevelLoader";
    import BBLevelSelector from "src/core/BBLevelSelector.svelte";

    let hasUploaded = false;
    let bbll : BBLevelLoader;

    function handleLoaded(event : CustomEvent) {
        bbll = event.detail;
        hasUploaded = true;
    }
</script>
{#if !hasUploaded}
<BBLevelSelector on:loaded={handleLoaded}></BBLevelSelector>
{:else}
    <BBLevelEditor bind:bbll></BBLevelEditor>
{/if}
<style>
</style>