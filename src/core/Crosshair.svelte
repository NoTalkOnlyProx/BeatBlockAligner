<script lang="ts">
    import {default as Timecode, type FRAMERATE} from 'smpte-timecode';
    import { onMount, onDestroy } from 'svelte';
    import type { BBTimeLine } from './BBTimeLine';
    let mx : number;
    let ch : HTMLElement;

    let msg = "HAI";
    
    export let timeline : BBTimeLine;
    export let zoom : number;
    export let center : number;

    /* Crosshair Override */
    export let coTime : number = 0;
    export let co : boolean = false;

    let rx = 0;

    $: updateTime(rx, zoom, center, co, coTime, timeline);

    onMount(() => {
        document.addEventListener('mousemove', handleMouseMove);
	});

    function handleMouseMove(event : MouseEvent) {
        rx = event.clientX/window.innerWidth;
    }

    function relToWindowRx(rel : number) {
        return ((rel - center)*zoom/100) + 0.5;
    }

    function windowRxToRel(rx : number) {
        return ((rx - 0.5)*100)/zoom + center;
    }

    function updateTime(rx : number, zoom : number, center: number, co : boolean, coTime: number, timeline : BBTimeLine) {
        let crosshairTime = co ? coTime : timeline.relToTime(windowRxToRel(rx));
        let beat = timeline.timeToBeat(crosshairTime);
        let bpm = timeline.timeToBPM(crosshairTime);
        msg = `${beat.toFixed(4)}b (${crosshairTime.toFixed(4)}s / ${new Timecode(crosshairTime * 1000, 1000 as FRAMERATE)}) [${bpm} bpm]`;
        
        let trx = relToWindowRx(timeline.timeToRel(crosshairTime));
        if (ch) {
            let rect = ch.parentElement!.getBoundingClientRect();
            ch.style.left = (trx * window.innerWidth - rect.left) + "px";
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