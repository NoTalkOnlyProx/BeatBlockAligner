<script lang="ts">
    import { scale } from 'svelte/transition';
    import { BBTimeLine } from './BBTimeLine';
    import { tick } from 'svelte';
    import { relToRelPixels } from './UXUtils';
    export let timeline : BBTimeLine;
    export let zoom = 0;
    export let center = 0;

    let beatsShown = 0;
    let firstBeatShown = 0;
    let tickUnit = 0;

    $: computeBeats(zoom, center, timeline);
    function computeBeats(zoom : number, center : number, timeline : BBTimeLine) {
        let leftTimeRel = center - 50/zoom;
        let rightTimeRel = center + 50/zoom;
        let leftBeat = timeline.timeToBeat(timeline.relToTime(leftTimeRel));
        let rightBeat = timeline.timeToBeat(timeline.relToTime(rightTimeRel));

        /* Pick a power of two that results in 100 or fewer ticks visible. */
        let beatsVisible = rightBeat - leftBeat;
        /* Quantized to a power of two */
        tickUnit = Math.pow(2, -Math.ceil(Math.log2(100/beatsVisible)));
        tickUnit = Math.max(0.125, tickUnit);

        beatsShown = Math.ceil((rightBeat - leftBeat)/tickUnit);
        firstBeatShown = Math.floor((leftBeat/tickUnit)) * tickUnit;
    }

    function maprb(rb : number, firstBeatShown : number, tickUnit : number, zoom : number, timeline : BBTimeLine) {
        let rel = timeline.timeToRel(timeline.beatToTime(firstBeatShown + rb * tickUnit));
        return relToRelPixels(rel, zoom);
    }
</script>
<div class="lane">
    {#each {length: beatsShown} as _, rb}
        <div class="marker" style:left={maprb(rb, firstBeatShown, tickUnit, zoom, timeline) + "px"}></div>
    {/each}
</div>
<style>
    .lane {
        width: 100px;
        height: 100%;
        z-index: 0;
        position: absolute;
    }
    .marker {
        position: absolute;
        width: 1px;
        height: 100%;
        background-color: rgba(163, 163, 163, 0.432);
    }
</style>