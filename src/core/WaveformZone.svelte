<script lang="ts">
    import type { BBTimeLine } from "./BBTimeLine";
    import VariantWaveforms from "./VariantWaveforms.svelte";
    import TimeSpaceMarkers from "./TimeSpaceMarkers.svelte";

    export let zoom = 0;
    export let center = 0;
    export let timeline : BBTimeLine;
    export let beatGrid : number;
    
    let vwavs : VariantWaveforms;

    function handleClickTrackDrop(e : DragEvent) {
        console.log('huh?');
        vwavs.handleClickTrackDrop(e);
    }
    function cancelEvent(e : Event) {
        console.log('wtf?');
        e.preventDefault();
    }
</script>
<TimeSpaceMarkers bind:beatGrid bind:zoom bind:center bind:timeline></TimeSpaceMarkers>
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
    class="tzcontainer"
    on:drop={handleClickTrackDrop}
    on:dragover={cancelEvent}
    on:dragenter={cancelEvent}
>
    <div class="tzdomain"
        style:left={((50 - center * zoom) + "vw")}
        style:width={"100px"}
        >
        <VariantWaveforms bind:zoom bind:this={vwavs} bind:timeline style="z-index:50"></VariantWaveforms>
    </div>
</div>
<style>
    .tzcontainer {
        overflow: auto;
        display: block;
        overflow-x: hidden;
        box-sizing: border-box;
        width:100%;
        height:100%;
        position: absolute;
    }
    .tzdomain {
        position: relative;
        display: block;
        box-sizing: border-box;
    }
</style>