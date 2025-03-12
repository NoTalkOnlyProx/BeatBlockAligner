<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import type { BBTimeLine } from './BBTimeLine';
    import { pixelsToRel, relToPixels } from './UXUtils';
    let ch : HTMLElement;

    let msg_b = "HAI";
    let msg_s = "HAI";
    let msg_a = "HAI";
    let msg_bpm = "HAI";
    
    export let timeline : BBTimeLine;
    export let zoom : number;
    export let center : number;

    /* Crosshair Override */
    export let coTime : number = 0;
    export let co : boolean = false;

    function abletonTimecode(time : number) : string {
        if (time < 0) {
            return "-" + abletonTimecode(-time);
        }
        let millis = Math.floor((time % 1.0) * 1000);
        time = Math.floor(time);
        let seconds = time % 60;
        time = Math.floor(time/60);
        let minutes = time;
       
        return `${minutes.toFixed(0)}:${seconds.toFixed(0).padStart(2, "0")}:${millis.toFixed(0).padStart(3, "0")}`;
    }

    let mx = 0;

    $: updateTime(mx, zoom, center, co, coTime, timeline);

    onMount(() => {
        document.addEventListener('mousemove', handleMouseMove);
	});

    function handleMouseMove(event : MouseEvent) {
        mx = event.clientX;
    }

    function updateTime(mx : number, zoom : number, center: number, co : boolean, coTime: number, timeline : BBTimeLine) {
        let crosshairTime = co ? coTime : timeline.relToTime(pixelsToRel(mx, zoom, center));
        let beat = timeline.timeToBeat(crosshairTime);
        let bpm = timeline.timeToBPM(crosshairTime);
        msg_b = `${beat.toFixed(4)}b`
        msg_s = `${crosshairTime.toFixed(4)}s`
        msg_a = `${abletonTimecode(crosshairTime)}`
        msg_bpm = `[${bpm} bpm]`;
        
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
    <div class="code">
        <span>{msg_b}</span> <span class="msgs">({msg_s} / <span class="msga">{msg_a}</span>)</span> <span>{msg_bpm}</span>
        
    </div>
</div>
<style>
    .msgs {
        color: rgb(255, 30, 178);
    }
    .msga {
        color: rgb(0, 231, 255);
    }
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