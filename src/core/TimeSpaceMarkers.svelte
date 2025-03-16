<script lang="ts">
    import { onDestroy, onMount } from 'svelte';
    import { BBTimeLine } from './BBTimeLine';
    import { relToPixels, relToRelPixels } from '../utils/UXUtils';
    export let timeline : BBTimeLine;
    export let zoom = 0;
    export let center = 0;

    let cv : HTMLCanvasElement;
    onMount(() => {
        animate();
	});
    let lastID : number = 0;
    function animate() {
        render();
        lastID = requestAnimationFrame(animate);
    }
    onDestroy(() => {
        cancelAnimationFrame(lastID);
	});

    function render() {
        let leftTimeRel = center - 50/zoom;
        let rightTimeRel = center + 50/zoom;
        let leftBeat = timeline.timeToBeat(timeline.relToTime(leftTimeRel));
        let rightBeat = timeline.timeToBeat(timeline.relToTime(rightTimeRel));

        /* Pick a power of two that results in 100 or fewer ticks visible. */
        let beatsVisible = rightBeat - leftBeat;
        /* Quantized to a power of two */
        let tickUnit = Math.pow(2, -Math.ceil(Math.log2(100/beatsVisible)));
        tickUnit = Math.max(0.125, tickUnit);

        let beatsShown = Math.ceil((rightBeat - leftBeat)/tickUnit);
        let firstBeatShown = Math.floor((leftBeat/tickUnit)) * tickUnit;

        let bounds = cv.getBoundingClientRect();
        cv.width = bounds.width;
        cv.height = bounds.height;

        const ctx = cv.getContext("2d")!;
        ctx.clearRect(0, 0, cv.width, cv.height);

        for (let i = 0; i < beatsShown; i++) {
            let beat = firstBeatShown + i * tickUnit;
            let beatX = relToPixels(timeline.timeToRel(timeline.beatToTime(beat)), zoom, center);
            ctx.beginPath();
            ctx.strokeStyle = "rgba(163, 163, 163, 0.432)";
            ctx.moveTo(beatX, 0);
            ctx.lineTo(beatX, cv.height);
            ctx.stroke();
        }
    }
</script>
<div class="container">
    <canvas class="drawzone" bind:this={cv}></canvas>
</div>
<style>
     .container {
        overflow:hidden;
        top: 0px;
        left: 0px;
        position:absolute;
        height: 100%;
        width: 100%;
    }
    .drawzone {
        width: 100%;
        height: 100%;
    }
</style>