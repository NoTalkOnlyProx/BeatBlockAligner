<script lang="ts">
    import { BBTimeLine, type BBTimelineEvent, type BBTimelineOperationMode } from './BBTimeLine';
    import type { BBPlay, BBSetBPM, BBSetsBPMEvent } from './BBTypes';
    import OptionalNumber from './OptionalNumber.svelte';
    export let timeline : BBTimeLine;
    export let zoom : number;
    export let center : number;
    export let co : boolean;
    export let coTime : number;
    let selectedControl : (BBTimelineEvent | null) = null;


    
    /* This code is in need of a bit of a refactor -- `selectedBI` is really a ***tick***, 
     * which is the name I have chosen for the subdivisions of beats implied by the current
     * snapGrid value. Also there are now time conversions directly in timeline.
     */
    let selectedBI : (number | null) = null;
    let beats = 0;
    let tooltipX : string = "0px";
    let tooltipY : string = "0px";
    let tooltipTime = 0;
    let tooltipVisible = false;
    let mouseX = 0;
    let mouseY = 0;
    let lane: HTMLElement;
    let choosingEvent = false;
    let tooltipEvents : BBTimelineEvent[];
    let oldBeatGrid : number = 4;
    
    export let controlMoveMode : BBTimelineOperationMode = "MoveKeepBeats";
    export let beatStretchMode : BBTimelineOperationMode = "StretchKeepAllBeats";
    export let snapToBeat = false;
    export let beatGrid : number = 4;

    let indices = 0;
    let firstBeatIndex = 0;
    let trueFirstBeat = 0;
    let selectedBPM = 0;

    $: computeBeats(zoom, center, beatGrid, timeline)


    /* Disabling dynamic range display for now, it worsened performance.
     * I need to think about how to optimize this.
     * The real solution is probably to keep all elements visible, but use cached positions
     * and update just the cached positions within visible range.
     * Either that or just switch to canvas or otherwise stop using svelte at all for the
     * recompute.
     * But I don't wanna right now.
     */

    //$: computeBeatsGrid(zoom, center, beatGrid);
    //$: computeBeatsTimeline(timeline);

    //let lastLeftBeat = -99999;
    //let lastRightBeat = -99999;
    //let lastBeatGrid = -9999;
    //function computeBeatsGrid(zoom : number, center : number, beatGrid : number) {
    //    computeBeats(zoom, center, beatGrid, timeline);
    //}
    //function computeBeatsTimeline(timeline : BBTimeLine) {
    //    lastLeftBeat = lastRightBeat = -99999;
    //    computeBeats(zoom, center, beatGrid, timeline);
    //}
    
    function computeBeats(zoom : number, center : number, beatGrid : number, timeline : BBTimeLine) {
        //let leftTimeRel = center - 50/zoom;
        //let rightTimeRel = center + 50/zoom;
        //
        ///* Compromise: we quantize this to hectobeats to reduced updates during scroll */
        //let quantization = 100;
        //let leftBeat = Math.floor(Math.floor(timeline.timeToBeat(timeline.relToTime(leftTimeRel)) * quantization)/quantization);
        //let rightBeat = Math.ceil(Math.ceil(timeline.timeToBeat(timeline.relToTime(rightTimeRel)) * quantization)/quantization);

        ///* Same conditions, no need to redo layout */
        //if (leftBeat == lastLeftBeat && rightBeat == lastRightBeat && lastBeatGrid == beatGrid) {
        //    return;
        //}
        
        /* startTimes.trueFirstBeat is the beat BB will truly start on */
        /* timeline.firstBeat is the first beat with an event. */
        /* The minimum of these is the song's ultimate "first tick"
         * That tick has Beat Index = 0.
         */
        let trueStart = timeline.startTimes?.trueFirstBeat ?? 0;
        trueFirstBeat = Math.floor(Math.min(trueStart, timeline.firstBeat));
        let lastBeatIndex = Math.ceil((timeline.lastBeat - trueFirstBeat) * beatGrid);

        let leftBeatIndex  = 0;             //Math.min(lastBeatIndex, Math.max(0, (leftBeat -  trueFirstBeat) * beatGrid));
        let rightBeatIndex = lastBeatIndex; //Math.min(lastBeatIndex, Math.max(0, (rightBeat - trueFirstBeat) * beatGrid));

        firstBeatIndex = leftBeatIndex;
        indices = rightBeatIndex - leftBeatIndex;
    }

    $: zoom, center, lane, selectedBI, selectedControl, choosingEvent, recomputeTooltip();
    $: hasLoadBeat = timeline.startTimes?.performLoad ?? false;
    $: loadBeat = timeline.startTimes?.loadBeat ?? 0;
    $: beatGrid, resnapBI();

    function resnapBI() {
        if (selectedBI != null) {
            selectedBI = Math.round(selectedBI/oldBeatGrid * beatGrid);
        }
        oldBeatGrid = beatGrid;
    }

    function handleMouseMove(event: MouseEvent) {
        mouseX = event.clientX;
        mouseY = event.clientY;
        recomputeTooltip();
    }

    function handleMouseExit(event: MouseEvent) {
        if (choosingEvent) {
            return;
        }
        tooltipVisible = false;
    }

    function mouseToTime(mouseX : number) : number {
        let laneRect = lane.getBoundingClientRect();
        return timeline.relToTime((mouseX - laneRect.x)/laneRect.width * 100);
    }

    function recomputeTooltip() {
        if (!lane) {
            return;
        }
        if (choosingEvent) {
            tooltipVisible = true;
            return;
        }
        if (selectedControl == null) {
            let laneRect = lane.getBoundingClientRect();
            tooltipX = (mouseX - laneRect.x + 20) + "px";
            tooltipY = (mouseY - laneRect.y) + "px";
            tooltipTime = mouseToTime(mouseX);

            
            let leftTimeRel = center - 50/zoom;
            let rightTimeRel = center + 50/zoom;
            let leftVisibleTime = timeline.relToTime(leftTimeRel);
            let rightVisibleTime = timeline.relToTime(rightTimeRel);

            /* Anything within 30 pixels */
            let threshold = 30/window.innerWidth * (rightVisibleTime - leftVisibleTime);

            tooltipEvents = timeline.getEventsNearTime(timeline.timeControlEvents, tooltipTime, zoom, threshold);
            tooltipVisible = tooltipEvents.length > 0;
            return;
        }
        tooltipVisible = false;
    }

    function getDescription(event : BBTimelineEvent) {
        let type = event.event.type;
        let bpm = (event.event as (BBSetBPM | BBPlay))?.bpm ?? null;
        let bpmtext = (bpm===null) ? "":`(bpm->${bpm.toFixed(2)}) `
        return `${type}: ${bpmtext}(ang: ${event.event.angle?.toFixed(1)})`;
    }

    function biToBeat(bi : number, beatGrid : number) {
        return bi/beatGrid + trueFirstBeat;
    }

    function mapbi(bi : number, timeline : BBTimeLine, beatGrid : number) {
        if (bi == 25) {
            console.log("25 recomputed");
        }
        return timeline.timeToRel(timeline.beatToTime(biToBeat(bi, beatGrid)));
    }
    function mapBeat(beat : number, timeline : BBTimeLine) {
        return timeline.timeToRel(timeline.beatToTime(beat));
    }
    function selectControlNear(e : MouseEvent, event : BBTimelineEvent) {
        if (selectedControl || choosingEvent) {
            return;
        }
        if (tooltipEvents.length == 0) { 
            selectControl(event);
        }
        else if (tooltipEvents.length == 1) {
            selectControl(tooltipEvents[0]);
        }
        else {
            choosingEvent = true;
        }
        e.preventDefault();
    }
    function selectControlKeyboard(e : KeyboardEvent, event : BBTimelineEvent) {
        if (e.key != "Enter") {
            return;
        }
        if (selectedControl) {
            return;
        }
        selectControl(event);
        e.preventDefault();
    }
    function getControlBPM(selectedControl : BBTimelineEvent) {
        return (selectedControl?.event as BBSetsBPMEvent)?.bpm ?? null;
    }
    function handleSetBPM(event : CustomEvent) {
        if (!selectedControl) {
            return;
        }
        let nbpm = event.detail;
        timeline.setBPM(selectedControl, nbpm, beatStretchMode, snapToBeat, beatGrid);
        timeline=timeline;
    }
    function selectControl(event : BBTimelineEvent) {
        console.log("Selected!");
        selectedControl = event;
        choosingEvent = false;
    }
    function beatSelectable(bi : number,
                            selectedControl : BBTimelineEvent | null,
                            selectedBI : number | null,
                            draggingAny : boolean, beatGrid : number,
                            timeline : BBTimeLine) {
        return !draggingAny &&
               (selectedBI === null) &&
               beatIsValidSelection(bi, selectedControl, beatGrid);
    }
    function beatIsValidSelection(bi : number | null, selectedControl : BBTimelineEvent | null, beatGrid : number) {
        if (bi == null) {
            return false;
        }
        let nextControl = timeline.getControlAfter(selectedControl);
        let beat = biToBeat(bi, beatGrid);
        return (selectedControl != null) &&
                beat > selectedControl?.event.time &&
               (!nextControl || beat < (nextControl.event.time - 0.5/beatGrid));
    }
    function selectBeatMouse(e : MouseEvent, bi : number) {
        if (selectBeat(bi)) {
            e.preventDefault();
        }

    }
    function selectBeatKeyboard(e : KeyboardEvent, bi : number) {
        if (e.key != "Enter") {
            return;
        }
        if (selectBeat(bi)) {
            e.preventDefault();
        }
    }
    function selectBeat(bi : number) {
        if (!beatSelectable(bi, selectedControl, selectedBI, draggingAny, beatGrid, timeline)) {
            return false;
        }
        selectedBI = bi;
        return true;
    }

    function isSelected(selectedBI : number | null, bi : number)
    {
        return selectedBI === bi;
    }

    function deselectBeat(e : MouseEvent) {
        selectedBI = null;
        e.stopPropagation();
    }

    function deselectControl(e : MouseEvent) {
        console.log("Deselected!");
        selectedControl = null;
        choosingEvent = false;
        selectedBI = null;
        e.stopPropagation();
    }

    function deleteControl(e : MouseEvent) {
        if (!selectedControl) {
            return;
        }
        console.log("Delete!");
        timeline.deleteEvent(selectedControl);
        timeline=timeline;
        selectedControl = null;
        choosingEvent = false;
        selectedBI = null;
        e.stopPropagation();
    }

    export function onEscape() {
        if (choosingEvent) {
            choosingEvent = false;
            return true;
        }
        if (selectedBI != null) {
            selectedBI = null;
            return true;
        }
        if (selectedControl != null) {
            selectedControl = null;
            return true;
        }
        return false;
    }

    let draggingAny = false;
    let draggingControl = false;
    let draggingBeat = false;
    let dragInitialTime = 0;
    function startDragControl(event : MouseEvent) {
        if (!selectedControl) {
            return;
        }
        draggingControl = true;
        coTime = timeline.beatToTime(selectedControl!.event.time);
        timeline.beginMoveOperation(selectedControl!, controlMoveMode, snapToBeat, beatGrid);
        startDrag(event);
    }


    function startDragBeat(event : MouseEvent) {
        if (!selectedControl || selectedBI == null) {
            return;
        }
        draggingBeat = true;
        coTime = timeline.beatToTime(timeline.tickToBeat(selectedBI, beatGrid));
        timeline.beginStretchOperation(selectedControl!, beatStretchMode, snapToBeat, beatGrid, selectedBI);
        startDrag(event);
    }

    function startDrag(event : MouseEvent) {
        draggingAny = true;
        dragInitialTime = mouseToTime(event.clientX);
        co = true;
        event.preventDefault();
        console.log("START DRAG");
    }

    function startDragControlDup(event : MouseEvent) {
        if (!selectedControl) {
            return;
        }
        selectedControl = timeline.addEvent(selectedControl!.event, false);
        startDragControl(event);
    }

    function startDragControlSplit(event : MouseEvent) {
        if (!selectedControl) {
            return;
        }
        let nevent : BBSetBPM = {
            type: "setBPM",
            angle: (selectedControl.event.angle ?? 0) + 1,
            bpm: (selectedControl.event as BBSetsBPMEvent).bpm ?? timeline.beatToBPM(selectedControl.event.time),
            time: selectedControl.event.time
        }
        selectedControl = timeline.addEvent(nevent, false);
        startDragControl(event);
    }

    export function onDragEnd(event : MouseEvent) {
        if (!draggingAny) {
            return;
        }
        let dragTime = mouseToTime(event.clientX);

        if (draggingControl) {
            event.preventDefault();
            draggingControl = false;
            timeline.finishMoveOperation(dragTime - dragInitialTime);
        }
        if (draggingBeat) {
            event.preventDefault();
            draggingBeat = false;
            timeline.finishStretchOperation(dragTime - dragInitialTime);
        }

        if (!beatIsValidSelection(selectedBI, selectedControl, beatGrid)) {
            selectedBI = null;
        }

        timeline = timeline;
        draggingAny = false;
        co = false;
    }

    export function onDrag(event : MouseEvent) {
        if (!draggingAny) {
            return;
        }
        let dragTime = mouseToTime(event.clientX);
        if (draggingControl) {
            timeline.continueMoveOperation(dragTime - dragInitialTime);
            coTime = timeline.beatToTime(selectedControl!.event.time);
        }
        if (draggingBeat) {
            timeline.continueStretchOperation(dragTime - dragInitialTime);
            coTime = timeline.beatToTime(timeline.tickToBeat(selectedBI, beatGrid));
        }
        timeline = timeline;
        event.preventDefault();
    }

    export function onUndo() {
        draggingAny = false;
        draggingControl = false;
        co = false;
        selectedControl = null;
        selectedBI = null;
        choosingEvent = false;
    }

</script>
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="lane" bind:this={lane} on:mousemove={handleMouseMove} on:mouseleave={handleMouseExit}>
    {#each {length: indices} as _, bi_sub}
        <div
            class="marker"
            style:left={`calc(${mapbi(bi_sub + firstBeatIndex, timeline, beatGrid)}cqw - 10px)`}
            class:hoverable={beatSelectable(bi_sub + firstBeatIndex, selectedControl, selectedBI, draggingAny, beatGrid, timeline)}
            class:selected={isSelected(selectedBI, bi_sub + firstBeatIndex)}
            class:suppressed={selectedBI!==(bi_sub + firstBeatIndex) && selectedBI && selectedControl}

            role="button"
            tabindex="0"
            aria-label={`Beat ${bi_sub + firstBeatIndex}`}
            on:click={(e)=>selectBeatMouse(e, bi_sub + firstBeatIndex)}
            on:keydown={(e)=>selectBeatKeyboard(e, bi_sub + firstBeatIndex)}>
            <div class="line"></div>
            {#if isSelected(selectedBI, bi_sub + firstBeatIndex)}
                <div class="controlzone">
                    <div class="controlTitle">Tick {bi_sub + firstBeatIndex}</div>
                    <div class="buttonzone">
                        <button class="move" on:mousedown={startDragBeat}>Stretch</button>
                        <button class="dup">Insert</button>
                        <button class="desel" on:click={deselectBeat}>Deselect</button>
                    </div>
                </div>
            {/if}
        </div>
    {/each}
    <div
        class="start marker"
        style:left={`calc(${mapBeat(trueFirstBeat, timeline)}cqw - 10px)`}>
        <div class="line"></div>
    </div>
    {#if hasLoadBeat}
        <div
            class="load marker"
            style:left={`calc(${mapBeat(loadBeat, timeline)}cqw - 10px)`}>
            <div class="line"></div>
        </div>
    {/if}
    {#each timeline.timeControlEvents as event,i}
        <div
            class="ctrl marker"
            style:left={`calc(${mapBeat(event.event.time, timeline)}cqw - 10px)`}
            class:hoverable={(!selectedControl)}
            class:selected={event===selectedControl}

            role="button"
            tabindex="0"
            aria-label={`Timeline Control Event ${i}`}
            on:click={(e)=>selectControlNear(e, event)}
            on:keydown={(e)=>selectControlKeyboard(e, event)}>
            <div class="line"></div>
            {#if selectedControl===event}
                <div class="controlzone">
                    <div class="controlTitle">{getDescription(event)}</div>
                    <div class="bpmcont">
                        <OptionalNumber value={getControlBPM(selectedControl)} on:change={handleSetBPM}>BPM</OptionalNumber>
                    </div>
                    <div class="buttonzone">
                        <button class="move" on:mousedown={startDragControl}>Move</button>
                        <button class="del" on:click={deleteControl}>Delete</button>
                        {#if event.event.type === "play"}
                            <button class="dup" on:mousedown={startDragControlSplit}>Split</button>
                        {:else}
                            <button class="dup"  on:mousedown={startDragControlDup}>Dup</button>
                        {/if}
                        <button class="desel" on:click={deselectControl}>Deselect</button>
                    </div>
                </div>
            {/if}
        </div>
    {/each}
    {#if tooltipVisible}
        <div class="tooltip" style:left={tooltipX} style:top={tooltipY}>
            {#each tooltipEvents as event,i}
                <button on:click={(e)=>selectControl(event)} class="ttevent" class:bright={i%2==0} class:clickable={choosingEvent}>{getDescription(event)}</button>
            {/each}
        </div>
    {/if}
</div>
<style>
    @import "../global.css";

    .move {
        background-color: #28e6cb;
    }
    .move:hover {
        background-color: #c8fff7;
    }
    .del {
        background-color: #f00;
    }
    .del:hover {
        background-color: rgb(255, 114, 114);
    }
    .dup {
        background-color: #ff00a7;
    }
    .dup:hover {
        background-color: #ff94d9;
    }
    .desel {
        background-color: #ffae00;
    }
    .desel:hover {
        background-color: #ffd986;
    }

    .controlTitle {
        padding:3px;
        background-color: var(--tooltip-color-bright);
        width:100%;
        white-space: nowrap;
    }

    .controlzone {
        z-index: 70;
        opacity: 0.9;
        min-width:2vw;
        left:14px;
        top:0px;
        position:absolute;
        display: flex;
        align-items: flex-start;
        flex-direction: column;
    }

    .controlzone > * {
        opacity: 1.0;
    }

    .buttonzone {
        display:flex;
        flex-direction: column;
        min-width:0px;
        background-color: var(--tooltip-color);
    }

    .bpmcont {
        padding: 3px;
        display:flex;
        background-color: var(--tooltip-color);
    }

    :global(.bpmcont input) {
        background-color: var(--main-input-bg);
        color : var(--main-text-color);
    }


    .buttonzone button {
        border: none;
        display: block;
        color: black;
        pointer-events: all;
    }

    .tooltip {
        pointer-events: none;
        position:absolute;
        z-index: 70;
        background-color: var(--tooltip-color);
        border-color: var(--tooltip-border-color);
        border-style: solid;
        border-width: 1px;
        padding:3px;
    }
    .ttevent { 
        background-color: transparent;
        border: none;
        display: block;
    }
    .ttevent.bright {
        background-color: var(--tooltip-color-bright);
    }
    .ttevent.clickable {
        pointer-events: all;
    }

    .ttevent.clickable:hover {
        background-color: var(--tooltip-color-hover)
    }
    

    .lane {
        width: 100cqw;
        height: 150px;
    }
    .marker {
        position: absolute;
        width: 25px;
        height: 100%;
        background-color: rgba(0,0,0,0);
    }
    .line {
        position: absolute;
        left:10px;
        width: 1px;
        height: 100%;
    }

    .marker.suppressed {
        height: 90%;
    }
    .marker.suppressed > .line {
        background-color: rgb(172, 172, 172);
    }
   
    .marker > .line {
        background-color: rgb(255, 255, 255);
    }
    .ctrl.marker > .line {
        background-color: red;
    }
    .load.marker > .line {
        background-color: rgb(255, 123, 0);
    }
    .start.marker > .line {
        background-color: rgb(0, 255, 34);
    }
    
    .marker.hoverable,
    .marker.selected {
        height: 90%;
    }

    .marker.hoverable > .line,
    .marker.selected > .line {
        left:8px;
        width: 5px;
    }

    .marker.hoverable:hover,
    .marker.selected {
        height: 100%;
    }
    .marker.hoverable:hover > .line,
    .marker.selected > .line{
        background-color: rgb(255, 255, 255);
    }
    .ctrl.marker.hoverable:hover > .line,
    .ctrl.marker.selected > .line {
        background-color: rgb(255, 0, 0);
    }
    
</style>