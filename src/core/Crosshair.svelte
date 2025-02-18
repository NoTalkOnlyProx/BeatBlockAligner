<script lang="ts">
    import {default as Timecode, type FRAMERATE} from 'smpte-timecode';
    import { onMount, onDestroy } from 'svelte';
    import type { BBTimeLine } from './BBTimeLine';
    import { pixelsToRel, relToPixels } from './UXUtils';
    let ch : HTMLElement;

    let msg = "HAI";
    
    export let timeline : BBTimeLine;
    export let zoom : number;
    export let center : number;

    /* Crosshair Override */
    export let coTime : number = 0;
    export let co : boolean = false;

    let mx = 0;

    $: updateTime(mx, zoom, center, co, coTime, timeline);

    onMount(() => {
        document.addEventListener('mousemove', handleMouseMove);
	});

    function handleMouseMove(event : MouseEvent) {
        mx = event.clientX;
    }

    function relToWindowRx(rel : number) {
        return ((rel - center)*zoom/100) + 0.5;
    }

    function updateTime(mx : number, zoom : number, center: number, co : boolean, coTime: number, timeline : BBTimeLine) {
        let crosshairTime = co ? coTime : timeline.relToTime(pixelsToRel(mx, zoom, center));
        let beat = timeline.timeToBeat(crosshairTime);
        let bpm = timeline.timeToBPM(crosshairTime);
        msg = `${beat.toFixed(4)}b (${crosshairTime.toFixed(4)}s / ${new Timecode(crosshairTime * 1000, 1000 as FRAMERATE)}) [${bpm} bpm]`;
        
        if (ch) {
            let rect = ch.parentElement!.getBoundingClientRect();
            let tmx = relToPixels(timeline.timeToRel(crosshairTime), zoom, center);
            ch.style.left = (tmx - rect.left) + "px";
        }
    }

    onDestroy(() => {
        document.removeEventListener('mousemove', handleMouseMove);
	});
</script>
<div bind:this={ch} class="crosshair">
    <div class="line"></div>
    <div class="code">{msg}</div>
</div>
<style>
    .crosshair {
        position: absolute;
        top:0px;
        height:100%;
        width:1px;
        left: 100px;
        pointer-events: none;
    }
    .line {
        position:absolute;
        left: 0px;
        top: 0px;
        height:100%;
        width:1px;
        pointer-events: none;
        background-color: rgba(255, 255, 255, 0.336);
    }
    .code {
        position:absolute;
        top: 0px;
        pointer-events: none;
        white-space: nowrap;
        background-color: black;
    }
</style>