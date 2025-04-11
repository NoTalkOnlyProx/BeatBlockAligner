<script lang="ts">
    import { preventNavDrag } from "../utils/UXUtils";
    import { getEventDescription } from "../utils/BBUtils";
    import { onDestroy, onMount } from 'svelte';
    import { BBTimeLine, type BBTimelineEvent, type BBTimelinePreserveMode } from './BBTimeLine';
    import type {BBPlayEvent, BBSetBPMEvent, BBSetsBPMEvent} from './BBTypes';
    import OptionalNumber from './OptionalNumber.svelte';
    import { isScrollSpecial, pixelsToRel, relPixelsToRel, relToPixels, relToRelPixels } from '../utils/UXUtils';
    import { createEventDispatcher } from 'svelte';
    import BbEventTooltip from './BBEventTooltip.svelte';
    const dispatch = createEventDispatcher();

    /* any to shut up typescript complaining about us checking if undefined is in the array */
    const bpmSetters : any[] = ["play", "setBPM"];

    export let timeline : BBTimeLine;
    export let zoom : number;
    export let center : number;
    export let co : boolean;
    export let coTime : number;
    let clicksEnabled : boolean = true;
    export function setClicksEnabled(val : boolean) {
        console.log("clicks enabled?", val);
        clicksEnabled = val;
    }

    let selectedControl : (BBTimelineEvent | null) = null;
    let selectedTI : (number | null) = null;
    let tooltipVisible = false;
    let choosingEvent = false;
    let tooltipEvents : BBTimelineEvent[];
    
    export let preserveMode : BBTimelinePreserveMode = "KeepBeats";
    export let snapToBeat = false;
    export let beatGrid : number = 4;

    function selectControl(event : BBTimelineEvent) {
        if (event != selectedControl) {
            selectedTI = null;
        }
        selectedControl = event;
        choosingEvent = false;
        dispatch("interacted");
    }

    function deselectControl(e : MouseEvent) {
        if (clickCancelled || isScrollSpecial(e)) {
            return;
        }

        selectedControl = null;
        choosingEvent = false;
        selectedTI = null;
        e.stopPropagation();
        dispatch("interacted");
    }

    function deleteControl(e : MouseEvent) {
        if (clickCancelled || isScrollSpecial(e)) {
            return;
        }
        if (!selectedControl) {
            return;
        }
        console.log("Delete!");
        timeline.deleteEvent(selectedControl);
        timeline=timeline;
        selectedControl = null;
        choosingEvent = false;
        selectedTI = null;
        e.stopPropagation();
        dispatch("interacted");
    }

    export function onEscape() {
        if (draggingAny) {
            draggingAny = false;
            draggingBeat = false;
            draggingControl = false;
            return true;
        }
        if (selectedTI != null) {
            selectedTI = null;
            return true;
        }
        if (selectedControl != null) {
            selectedControl = null;
            return true;
        }
        if (choosingEvent) {
            choosingEvent = false;
            return true;
        }
        return false;
    }

    function selectTI(ti : number) {
        dispatch("interacted");
        selectedTI = ti;
        selectedControl = timeline.getLastBeforeBeat(timeline.timeControlEvents, tiToBeat(ti));
        return true;
    }

    function sanitizeTISel() {
        if (!selectedControl) {
            selectedTI = null;
            return;
        }
        
        if (!TISelectable(selectedTI ?? 0)) {
            selectedTI = null;
            return;
        }

        let prior = timeline.getLastBeforeBeat(timeline.timeControlEvents, tiToBeat(selectedTI ?? 0));
        if (prior != selectedControl) {
            selectedTI = null;
            return;
        }
    }

    function TISelectable(ti : number) {
        let firstBeat = timeline.timeControlEvents?.[0].event.time ?? Infinity;
        return tiToBeat(ti) > firstBeat;
    }

    function TIRecommended(ti : number) {
        return !draggingAny &&
            (selectedTI === null) &&
            TIIsValidRecommendation(ti, selectedControl, beatGrid);
    }

    function TIIsValidRecommendation(ti : number | null, selectedControl : BBTimelineEvent | null, beatGrid : number) {
        if (ti == null) {
            return false;
        }
        let nextControl = timeline.getControlAfter(selectedControl);
        let beat = tiToBeat(ti);
        return (selectedControl != null) &&
                beat > selectedControl?.event.time &&
            (!nextControl || beat < (nextControl.event.time - 0.5/beatGrid));
    }

    //NTOPHere
    function insertTI(e : MouseEvent) {
        if (clickCancelled || isScrollSpecial(e)) {
            return;
        }
        insertAtBeat(tiToBeat(selectedTI ?? 0));
        e.stopPropagation();
    }

    function deselectTI(e : MouseEvent) {
        if (clickCancelled || isScrollSpecial(e)) {
            return;
        }
        selectedTI = null;
        e.stopPropagation();
    }

    function mouseToTime(mx : number) {
        return timeline.relToTime(pixelsToRel(mx, zoom, center));
    }

    function startDrag(event : MouseEvent) {
        draggingAny = true;
        dragInitialTime = mouseToTime(event.clientX);
        co = true;
        event.preventDefault();
        event.stopPropagation();
        dispatch("interacted");
        console.log("START DRAG");
    }

    
    let cv : HTMLCanvasElement;
    let container : HTMLElement;
    /* We are forced to do this using canvas for performance reasons,
     * there is no way around it, to do anything else is incredibly slow!
     */
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

    $: timeline, beatGrid, computeTickSpace();
    let zeroBeat = 0;
    let rightmostTick = 0;
    let leftmostTick = 0;
    function computeTickSpace() {
        zeroBeat = timeline.startTimes?.trueFirstBeat ?? 0;
        let leftmostBeat = Math.floor(Math.min(zeroBeat, timeline.latestFirstBeat));
        let rightmostBeat = Math.ceil(Math.max(timeline.lastBeat, timeline.latestLastBeat));
        rightmostTick = Math.ceil((rightmostBeat - zeroBeat) * beatGrid);
        leftmostTick = Math.floor((leftmostBeat - zeroBeat) * beatGrid);
    }

    $: beatGrid, resnapTI();
    let oldBeatGrid : number = 4;
    function resnapTI() {
        if (selectedTI != null) {
            selectedTI = Math.round(selectedTI/oldBeatGrid * beatGrid);
        }
        oldBeatGrid = beatGrid;
    }


    function render() {
        let bounds = cv.getBoundingClientRect();
        cv.width = bounds.width;
        cv.height = bounds.height;

        const ctx = cv.getContext("2d");
        ctx!.clearRect(0, 0, cv.width, cv.height);

        renderBeatTicks(ctx!);
        renderControls(ctx!);
    }

    function renderBeatTicks(ctx : CanvasRenderingContext2D) {
        let nearTI = beatToTI(timeline.timeToBeat(mouseToTime(mouseX)));
        let canSelectTick = TISelectable(nearTI) && tooltipEvents.length == 0;


        let nextDrawableTick = -100;


        let leftTick = Math.max(getXTick(0) - 1, leftmostTick);
        let rightTick = Math.min(getXTick(window.innerWidth) + 1, rightmostTick);

        for (let ti = leftTick; ti <= rightTick; ti++) {
            /* For performance reasons, skip rendering ticks that are closer than 0.25 pixels
             * together */
            if (ti < nextDrawableTick && selectedTI !== ti) {
                continue;
            }

            let tickX = getTickX(ti, timeline, zoom, center);
            nextDrawableTick = getXTick(tickX + 0.25);

            renderTick(ctx, tickX, {
                color:"#ACACAC",
                hoverColor: "#FFFFFF",
                hover : mouseInside && canSelectTick && ti == nearTI,
                selected : (selectedTI === ti),
                recommended : TIRecommended(ti),
                prime: (ti % beatGrid) == 0
            });
        }

        if (timeline.startTimes?.performLoad) {
            let loadBeat = timeline.startTimes?.loadBeat ?? 0
            let loadBeatX = getBeatX(loadBeat);
            
            renderTick(ctx, loadBeatX, {color:"rgb(255, 123, 0)"});
        }

        let startX = getBeatX(timeline?.startTimes?.trueFirstBeat ?? 0);
        renderTick(ctx, startX, {color:"rgb(0, 255, 34)"});
    }

    function renderControls(ctx : CanvasRenderingContext2D)
    {
        for (let control of timeline.timeControlEvents) {
            let controlX = getControlX(control, timeline, zoom, center);
            renderTick(ctx, controlX, {
                color: "#FF0000",
                hover: mouseInside && tooltipEvents.includes(control),
                selected: selectedControl === control,
            });
        }
    }

    interface TickParams {
        selected? : boolean,
        hover? : boolean,
        color? : string,
        hoverColor? : string,
        recommended? : boolean,
        prime? : boolean,
    }

    function renderTick(ctx : CanvasRenderingContext2D, x : number, params : TickParams = {}) {
        let fullHeight = cv.height;
        let partialHeight = cv.height - 25;

        let normalcolor = params.color ?? "#FFF";
        let hoverColor = params.hoverColor ?? normalcolor;

        let highlighted = (params.hover) || params.selected;

        let height = (highlighted || !params.recommended) ? fullHeight : partialHeight;
        let color = highlighted ? hoverColor : normalcolor;
        let width = (highlighted) ? 5 : 1;
        let ofs = width/2;
        
        ctx.beginPath();
        ctx.lineWidth = width;
        ctx.strokeStyle = color;
        ctx.moveTo(x + ofs, 0);
        ctx.lineTo(x + ofs, height);
        ctx.stroke();

        if (params.prime) {
            ctx.beginPath();
            ctx.lineWidth = 8;
            ctx.strokeStyle = color;
            ctx.moveTo(x + 4, 0);
            ctx.lineTo(x + 4, 7);
            ctx.stroke();
        }
    }

    $: zoom, center, selectedTI, selectedControl, choosingEvent, recomputeTooltip();
    let mouseX = 0;
    let mouseY = 0;
    let mouseInside : boolean = false;
    let tooltipX : number = 0;
    let tooltipY : number = 0;
    function recomputeTooltip() {
        if (choosingEvent) {
            tooltipVisible = true;
            return;
        }

        tooltipX = mouseX;
        tooltipY = mouseY;
        
        let tooltipTime = timeline.relToTime(pixelsToRel(mouseX, zoom, center));

        /* Anything within 30 pixels */
        let threshold = timeline.relToTimeDelta(relPixelsToRel(30, zoom));
        tooltipEvents = timeline.getEventsNearTime(timeline.timeControlEvents, tooltipTime, threshold);
        tooltipVisible = tooltipEvents.length > 0;

        /* Don't show the tooltip if we're just hovering over the currently selected event,
         * and there are no other selectables in the region.
         */
        if (tooltipEvents.length == 1 &&  tooltipEvents[0] == selectedControl) {
            tooltipVisible = false;
        }

        /* Don't show the tooltip if mouse isn't inside this region */
        if (!mouseInside) {
            tooltipVisible = false;
        }
    }
    function handleMouseMove(event: MouseEvent) {
        mouseX = event.clientX;
        mouseY = event.clientY;
        mouseInside = true;
        recomputeTooltip();
    }
    function mouseOverControl(event: MouseEvent) {
        tooltipVisible = false;
        mouseInside = false;
    }
    function handleMouseExit(event: MouseEvent) {
        mouseInside = false;
        
        if (!choosingEvent) {
            tooltipVisible = false;
        }
    }

    function beatToTI(beat : number) {
        return Math.round((beat - zeroBeat) * beatGrid)
    }

    function tiToBeat(ti : number) {
        return ti/beatGrid + zeroBeat;
    }

    function getControlX(control : BBTimelineEvent, timeline : BBTimeLine, zoom : number, center : number) {
        let ret = relToPixels(timeline.timeToRel(timeline.beatToTime(control.event.time)), zoom, center);
        return ret;
    }

    function getTickX(ti : number, timeline : BBTimeLine, zoom : number, center : number) {
        return getBeatX(tiToBeat(ti));
    }

    function getXTick(x : number) {
        return beatToTI(getXBeat(x));
    }

    function getXBeat(x: number) {
        return timeline.timeToBeat(timeline.relToTime(pixelsToRel(x, zoom, center)));
    }

    function getBeatX(beat : number) {
        return relToPixels(timeline.timeToRel(timeline.beatToTime(beat)), zoom, center);
    }

    function getControlBPM(selectedControl : BBTimelineEvent, timeline : BBTimeLine) {
        return (selectedControl?.event as BBSetsBPMEvent)?.bpm ?? null;
    }

    function getControlOffset(selectedControl : BBTimelineEvent, timeline : BBTimeLine) {
        return (selectedControl?.event as BBPlayEvent)?.offset ?? null;
    }

    function handleSetBPM(event : CustomEvent) {
        if (!selectedControl) {
            return;
        }
        dispatch("interacted");
        if (["play", "setBPM"].includes(selectedControl.event.type)) {
            let nbpm = event.detail;
            timeline.setEventBPM(selectedControl, nbpm, preserveMode, snapToBeat, beatGrid);
            timeline=timeline;
        }
    }

    function handleSetOffset(event : CustomEvent) {
        if (!selectedControl) {
            return;
        }
        dispatch("interacted");
        if (selectedControl.event.type == "play") {
            let noffset = event.detail;
            timeline.setEventOffset(selectedControl, noffset);
            timeline=timeline;
        }
    }

    let draggingAny = false;
    let draggingControl = false;
    let draggingBeat = false;
    let dragInitialTime = 0;

    function startDragControl(event : MouseEvent, mustSave : boolean = false) {
        if (isScrollSpecial(event, true)) {
            return;
        }
        if (!selectedControl) {
            return;
        }
        draggingControl = true;
        coTime = timeline.beatToTime(selectedControl!.event.time);
        timeline.beginTSMoveOperation(selectedControl!, preserveMode, snapToBeat, beatGrid, mustSave);
        startDrag(event);
    }

    function startDragBeat(event : MouseEvent) {
        if (isScrollSpecial(event, true)) {
            return;
        }
        if (!selectedControl || selectedTI == null) {
            return;
        }
        draggingBeat = true;
        coTime = timeline.beatToTime(timeline.tickToBeat(selectedTI, beatGrid));
        timeline.beginTSStretchOperation(selectedControl!, preserveMode, snapToBeat, beatGrid, selectedTI);
        startDrag(event);
    }
    
    function startDragControlDup(event : MouseEvent) {
        if (isScrollSpecial(event, true)) {
            return;
        }
        if (!selectedControl) {
            return;
        }
        selectedControl = timeline.addEvent(selectedControl!.event, false);
        startDragControl(event, true);
    }

    function startDragControlSplit(event : MouseEvent) {
        if (isScrollSpecial(event, true)) {
            return;
        }
        if (!selectedControl) {
            return;
        }
        let nevent : BBSetBPMEvent = {
            type: "setBPM",
            angle: (selectedControl.event.angle ?? 0) + 1,
            bpm: (selectedControl.event as BBSetsBPMEvent).bpm ?? timeline.beatToBPM(selectedControl.event.time),
            time: selectedControl.event.time
        }
        selectedControl = timeline.addEvent(nevent, false);
        startDragControl(event, true);
    }

    export function onDragEnd(event : MouseEvent) {
        if (!draggingAny) {
            return;
        }

        if (draggingControl) {
            event.preventDefault();
            draggingControl = false;
            timeline.finishTSMoveOperation();
            dispatch("interacted");
        }
        if (draggingBeat) {
            event.preventDefault();
            draggingBeat = false;
            timeline.finishTSStretchOperation();
            dispatch("interacted");
        }

        sanitizeTISel();

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
            timeline.continueTSMoveOperation(dragTime - dragInitialTime, snapToBeat);
            coTime = timeline.beatToTime(selectedControl!.event.time);
        }
        if (draggingBeat) {
            timeline.continueTSStretchOperation(dragTime - dragInitialTime, snapToBeat);
            coTime = timeline.beatToTime(timeline.tickToBeat(selectedTI!, beatGrid));
        }
        timeline = timeline;
        event.preventDefault();
    }

    export function onUndo() {
        draggingAny = false;
        draggingControl = false;
        co = false;
        selectedControl = null;
        selectedTI = null;
        choosingEvent = false;
    }

    /* Basically, the parent needs the ability to cancel a click if the mouse interaction turns
     * out to be drag.
     * Cancelling natively requires us to either prevent onMouseDown or onMouseUp.
     * We cannot prevent onMouseDown, because at that point, it is not clear that we are dealing
     * with a drag.
     * We cannot prevent onMouseUp, because that event will always reach this child before it
     * reaches the parent.
     * So, this child needs to have the ability to cancel its own onMouseUp, essentially.
     * 
     * To prevent clicks that did NOT start within this element, we need to make that only
     * apply if a click is actively ongoing.
     * 
     * I am considering creating a dedicated UX utility for this pattern and using it everywhere,
     * but for now keeping it localized here.
     */
    let isClickInProgress = false;
    let clickCancelled = false;
    function handleClickStart() {
        isClickInProgress = true;
        clickCancelled = false;
    }

    export function cancelClick() {
        if (isClickInProgress) {
            clickCancelled = true;
        }
    }

    function handleMouseClick(e : MouseEvent) {
        isClickInProgress = false;
        
        /* Parent (or key combo) determined this click is from a drag start, so ignore it */
        if (clickCancelled || isScrollSpecial(e)) {
            return;
        }

        /* If there is at least one TSE we can select, prioritize doing that */
        if (tooltipEvents.length > 0) {
            if (tooltipEvents.length == 1) {
                selectControl(tooltipEvents[0]);
            }
            else {
                selectedTI = null;
                choosingEvent = true;
            }
            e.preventDefault();
            e.stopPropagation();
            return;
        }

        /* Otherwise, if there is a valid tick to select, do that, and select the TSE prior to it */
        let targetTI = beatToTI(timeline.timeToBeat(mouseToTime(e.clientX)));
        if (TISelectable(targetTI)) {
            if (selectTI(targetTI)) {
                e.stopPropagation();
                e.preventDefault();
            }
        }
    }

    function handleRightClick(e : MouseEvent) {
        e.preventDefault();
        e.stopPropagation();
        let mouseTime = mouseToTime(e.clientX);
        let mouseBeat = timeline.timeToBeat(mouseTime);
        if (snapToBeat) {
            mouseBeat = Math.round(mouseBeat * beatGrid)/beatGrid;
        }
        insertAtBeat(mouseBeat);
    }

    function insertAtBeat(beat : number) {
        let mouseBPM = timeline.beatToBPM(beat);
        let setBPM : BBSetBPMEvent = {
            type: "setBPM",
            time: beat,
            bpm: mouseBPM,
            angle: 0,
        };
        selectControl(timeline.addEvent(setBPM, true));
        timeline=timeline;
    }
</script>
<div class="tscontainer" bind:this={container}>
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <canvas
        class="editzone" bind:this={cv}
        on:mousemove={handleMouseMove}
        on:mouseleave={handleMouseExit}
        on:mousedown={handleClickStart}
        on:click={handleMouseClick}
        on:contextmenu={handleRightClick}
    ></canvas>
    {#if selectedControl!==null}
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <div
            class="controlzone"
            on:mousedown={preventNavDrag}
            on:mousemove={mouseOverControl}
            style:left={`calc(${getControlX(selectedControl, timeline, zoom, center)}px + 6px)`}
        >
            <div class="controlTitle">{getEventDescription(selectedControl)}</div>
            {#if ["play", "setBPM"].includes(selectedControl.event.type)}
                <div class="paramcont">
                    <OptionalNumber value={getControlBPM(selectedControl, timeline)} on:change={handleSetBPM}>BPM</OptionalNumber>
                </div>
            {/if}
            {#if selectedControl.event.type === "play"}
                <div class="paramcont">
                    <OptionalNumber value={getControlOffset(selectedControl, timeline)} on:change={handleSetOffset}>offset (s)</OptionalNumber>
                </div>
            {/if}
            <div class="buttonzone">
                <button class="move" on:mousedown={startDragControl}>Move</button>
                {#if bpmSetters.includes(selectedControl.event.type)}
                    <button class="del" on:click={deleteControl}>Delete</button>
                    {#if selectedControl.event.type === "play"}
                        <button class="dup" on:mousedown={startDragControlSplit}>Split</button>
                    {:else}
                        <button class="dup"  on:mousedown={startDragControlDup}>Dup</button>
                    {/if}
                {/if}
                <button class="desel" on:click={deselectControl}>Deselect</button>
            </div>
        </div>
    {/if}
    {#if selectedTI !== null}
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <div
            class="controlzone"
            on:mousedown={preventNavDrag}
            style:left={`calc(${getTickX(selectedTI, timeline, zoom, center)}px + 6px)`}
        >
            <div class="controlTitle">Tick {selectedTI}</div>
            <div class="buttonzone">
                
            {#if bpmSetters.includes(selectedControl?.event?.type)}
                <button class="stretch" on:mousedown={startDragBeat}>Stretch</button>
            {/if}

            <button class="dup" on:click={insertTI}>Insert</button>
            <button class="desel" on:click={deselectTI}>Deselect</button>
            </div>
        </div>
    {/if}
    {#if tooltipVisible}
        <BbEventTooltip
            eventSource={timeline.timeControlEvents}
            bind:choosing={choosingEvent} bind:tooltipEvents bind:x={tooltipX} bind:y={tooltipY}
            on:select={(e)=>{selectControl(e.detail)}}
        >
        </BbEventTooltip>
    {/if}
</div>
<style>
    @import "../global.css";


    .paramcont {
        padding: 3px;
        display:flex;
        background-color: var(--tooltip-color);
    }

    :global(.bpmcont input) {
        background-color: var(--main-input-bg);
        color : var(--main-text-color);
    }

    .tscontainer {
        overflow:hidden;
        height: 100%;
        width: 100%;
        position:relative;
    }


    .editzone {
        width: 100%;
        height: 100%;
    }

    .controlzone {
        z-index: 70;
        opacity: 0.9;
        min-width:2vw;
        top:0px;
        position:absolute;
        display: flex;
        align-items: flex-start;
        flex-direction: column;
        pointer-events: none;
    }

    .controlzone > * {
        pointer-events: auto;
    }

    .buttonzone {
        display:flex;
        flex-direction: column;
        min-width:0px;
        background-color: var(--tooltip-color);
    }

    .buttonzone button {
        border: none;
        display: block;
        color: black;
        pointer-events: auto;
    }

    .controlzone > * {
        opacity: 1.0;
    }
    .controlTitle {
        padding:3px;
        background-color: var(--tooltip-color-bright);
        width:100%;
        white-space: nowrap;
    }
</style>