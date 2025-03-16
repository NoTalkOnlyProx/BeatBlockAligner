<script lang="ts">
    import { onDestroy, onMount } from 'svelte';
    import { BBTimeLine, type BBSelectionPoint, type BBTimelineApplyOpBeatCallback, type BBTimelineApplyOpTimeCallback, type BBTimelineEvent, type BBTimelinePreserveMode } from './BBTimeLine';
    import { isScrollSpecial, relPixelsToRel, pixelsToRel, relToRelPixels, relToPixels, preloadIcons, eventIcons, getIcon, getEventIconName } from './UXUtils';
    import type { BBDurationEvent } from './BBTypes';
    import { createEventDispatcher } from 'svelte';
    const dispatch = createEventDispatcher();

    export let timeline : BBTimeLine;
    export let zoom : number;
    export let center : number;
    export let co : boolean;
    export let coTime : number;
    const angleHeight = 320;
    const marginHeight = 60;
    let lane : HTMLElement;

    export let showChartEvents : boolean = true;
    export let showLevelEvents : boolean = true;

    export let preserveMode : BBTimelinePreserveMode = "KeepBeats";
    export let snapToBeat = false;
    export let beatGrid : number = 4;


    /* selectableCache helps us not create brand new Selectables for selectable events that
     * that were already in previous version of the timeline
     */

    let selectableCache : Map<BBTimelineEvent, BBSelectionPoint[]> = new Map();
    let allSelectables : BBSelectionPoint[];
    let visibleSelectables : BBSelectionPoint[] = [];
    let selectedSelectables : BBSelectionPoint[] = [];

    /* I am pushing the limits of what might be considered an anti-pattern here... */
    $: timeline, registerCallbacks();
    let lastTimeline : BBTimeLine | undefined = undefined;
    function registerCallbacks() {
        if (timeline == lastTimeline) {
            return;
        }
        /* timelines are never reused after new one is generated, so it is safe
         * to not bother with unregisterring callbacks.
         */
        timeline.on("continueOperation", handleContinueOperation);
        timeline.on("beginOperation", handleBeginOperation);
    }

    let lHandleStartTime : number = 0;
    let rHandleStartTime : number = 0;   
    let ignoreStaticUpdates : boolean = false;
    function handleBeginOperation(opstate : BBTimelineApplyOpBeatCallback) {
        if (ignoreStaticUpdates) {
            return;
        }
        lHandleStartTime = lHandleTime;
        rHandleStartTime = rHandleTime;
    }
    function handleContinueOperation(
        opstate : BBTimelineApplyOpBeatCallback,
        applyTime : BBTimelineApplyOpTimeCallback,
        applyBeat : BBTimelineApplyOpBeatCallback) {
        if (ignoreStaticUpdates) {
            return;
        }
        lHandleTime = applyTime(lHandleStartTime).time;
        rHandleTime = applyTime(rHandleStartTime).time;
    }

    $: timeline, computeSelectables();
    function computeSelectables() {
        let newAllSelectables : BBSelectionPoint[] = [];
        let newCache : Map<BBTimelineEvent, BBSelectionPoint[]> = new Map();
        for (let event of timeline.staticEvents) {
            let selectables : BBSelectionPoint[] = [];
            if (selectableCache.has(event)) {
                selectables = selectableCache.get(event)!;
            }
            else {
                selectables = [{
                    event,
                    tail: false
                }];
                if ('duration' in event.event) {
                    selectables.push({
                        event,
                        tail: true
                    });
                    selectables[0].other = selectables[1];
                    selectables[1].other = selectables[0];
                }
            }
            newAllSelectables.push(...selectables);
            newCache.set(event, selectables);
        }
        allSelectables = newAllSelectables;
        selectableCache = newCache;

        /* Now, update selection to make sure it stays valid.
         * take advantage of the map cache we just created, we might as well.
         */
        selectedSelectables = selectedSelectables.filter(sev => {
            return selectableCache.has(sev.event);
        });
    }

    $: showChartEvents, showLevelEvents, allSelectables, recomputeVisibleEvents();
    function recomputeVisibleEvents() {
        let newVisibleEvents = allSelectables.filter(se => {
            return se.event.fromChart && showChartEvents ||
                   !se.event.fromChart && showLevelEvents;
        });
        visibleSelectables = newVisibleEvents;
    }

    function isShownAsSelected(event : BBSelectionPoint) {
        if (selecting && selectionCandidates.includes(event)) {
            return true;
        }
        if (!selecting && selectedSelectables.includes(event)) {
            return true;
        }
        return false;
    }

    let shiftHeld = false;
    function onKeyDown(event : KeyboardEvent) {
        shiftHeld = event.shiftKey;
    }

    function onKeyUp(event : KeyboardEvent) {
        shiftHeld = event.shiftKey;
    }

    onMount(() => {
        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('keyup', onKeyUp);
        animate();
	});

    onDestroy(() => {
        document.removeEventListener('keydown', onKeyDown);
        document.removeEventListener('keyup', onKeyUp);
	});

    let cv : HTMLCanvasElement;
    let lastID : number = 0;
    function animate() {
        render();
        lastID = requestAnimationFrame(animate);
    }
    onDestroy(() => {
        cancelAnimationFrame(lastID);
	});


    const chartColor = "rgb(0, 204, 255)";
    const levelColor = "yellow";

    function render() {
        let bounds = cv.getBoundingClientRect();
        cv.width = bounds.width;
        cv.height = bounds.height;

        const ctx = cv.getContext("2d")!;
        ctx.clearRect(0, 0, cv.width, cv.height);

        let iw = window.innerWidth;

        for (let sp of visibleSelectables) {
            if (sp.tail) {
                continue;
            }
            let time = timeline.beatToTime(spToBeat(sp));
            let beatX = relToPixels(timeline.timeToRel(time), zoom, center);
            let beatY = angToYPos(sp.event.event.angle ?? 0, true);
            let beatInRange = (beatX > -30) && (beatX < iw + 30);

            if (sp.other) {
                let otime = timeline.beatToTime(spToBeat(sp.other));
                let obeatX = relToPixels(timeline.timeToRel(otime), zoom, center);
                let oBeatInRange = (obeatX > -30) && (beatX < iw + 30);
                if (oBeatInRange || beatInRange) {
                    drawBridge(ctx, sp, beatX, obeatX, beatY);
                }
                if (oBeatInRange) {
                    renderSP(ctx, sp.other, obeatX, beatY);
                }
            }
            if (beatInRange) {
                renderSP(ctx, sp, beatX, beatY);
            }
        } 
    }

    /* Prerender all possible types of marker so that we can render them as a single drawImage call */
    let markerCache : Map<string, HTMLCanvasElement> = new Map();
    async function preRenderMarkers() {
        const sx = 25;
        const sy = 30;
        await preloadIcons();
        for (let i = 0; i < 2; i++) {
            for (let j = 0; j < 2; j++) {
                for (let k = 0; k < 2; k++) {
                    let selected = ((i%2) == 0);
                    let isChart = ((j%2) == 0);
                    let isTail = ((k%2) == 0);
                    for (let icon in eventIcons) {
                        let ccv = document.createElement("canvas");
                        ccv.width = sx;
                        ccv.height = sy;
                        await preRenderMarker(ccv, selected, isChart, isTail, icon);
                        let id = getMarkerID(icon, selected, isChart, isTail);
                        markerCache.set(id, ccv);
                    }
                }
            }
        }
    }
    preRenderMarkers();

    function getMarkerID(icon : string, selected : boolean, isChart : boolean, isTail : boolean) {
        return icon + (selected?"S":"") + (isChart?"C":"") + (isTail?"T":"");
    }

    /* Markers are 30 px tall, unknown width */
    async function preRenderMarker(
        ccv : HTMLCanvasElement,
        selected : boolean,
        isChart : boolean,
        isTail : boolean,
        icon : string,
    ) {
        /* cx / cy represent the true location of the represented event within this prerender */
        let cx = 0;
        let cy = 15;
        if (isTail) {
            /* I haven't done the math to confirm this is correct, but its good enough */
            cx = 25;
        }

        let ctx = ccv.getContext("2d")!;
        let color = selected ? "white" : (isChart ? chartColor : levelColor);

        let tickWidth = selected ? 3 : 1;
        let extraOutline = selected ? 2 : 0;
        
        ctx.fillStyle = color;
        ctx.strokeStyle = color;
        ctx.lineWidth = 0;

        /* Fill marker BG */
        ctx.beginPath();
        if (isTail) {
            ctx.rect(
                cx - 20 - extraOutline,
                cy - 10 - extraOutline,
                20 + extraOutline,
                20 + extraOutline * 2
            );
        } else {
            ctx.rect(
                cx,
                cy - 10 - extraOutline,
                20 + extraOutline,
                20  + extraOutline * 2
            );
        }
        ctx.fill();

        /* Fill tick */
        ctx.lineWidth = tickWidth;
        ctx.beginPath();
        if (isTail) {
            ctx.moveTo(cx - tickWidth/2, cy - 15);
            ctx.lineTo(cx - tickWidth/2, cy + 15);
        } else {
            ctx.moveTo(cx + tickWidth/2, cy - 15);
            ctx.lineTo(cx + tickWidth/2, cy + 15);
        }
        ctx.stroke();

        /* Fill icon */ 
        ctx.fillStyle = "white";
        let iconX = isTail ? (cx - 2 - 16) : cx + 2;
        ctx.beginPath();
        ctx.rect(iconX, cy - 10 + 2, 16, 16);
        ctx.fill();
        let img = getIcon(icon);
        if (img) {
            ctx.drawImage(img, iconX, cy - 10 + 2, 16, 16);
        }
    }


    function renderSP(ctx : CanvasRenderingContext2D, sp : BBSelectionPoint, beatX : number, beatY : number) {
        let selected = isShownAsSelected(sp);
        let isTail = sp.tail;
        let isChart = sp.event.fromChart;
        let icon = getEventIconName(sp.event);

        let prid = getMarkerID(icon, selected, isChart, isTail);
        let prerender = markerCache.get(prid);

        /* Prerenders might not be done yet. */
        if (prerender) {
            ctx.drawImage(prerender!, Math.floor(beatX + (isTail?-25:0)), Math.floor(beatY - 15));
        }
    }

    function drawBridge(ctx : CanvasRenderingContext2D, sp : BBSelectionPoint, beatX : number, obeatX : number, beatY : number) {
        let lsel = isShownAsSelected(sp);
        let rsel = isShownAsSelected(sp.other!);
        let lcol = lsel ? "white" : (sp.event.fromChart ? chartColor : levelColor);
        let rcol = rsel ? "white" : (sp.event.fromChart ? chartColor : levelColor);

        let grad=ctx.createLinearGradient(beatX,0,obeatX,0);
        grad.addColorStop(0, lcol);
        grad.addColorStop(1, rcol); 

        ctx.fillStyle = grad;
        ctx.fillRect(Math.floor(beatX), Math.floor(beatY - 5), Math.floor(obeatX - beatX), 10);
    }

    function spToBeat(sp : BBSelectionPoint) {
        let beat = sp.event.event.time;
        if (sp.tail) {
            beat += (sp.event.event as BBDurationEvent).duration;
        }
        return beat;
    }

    /* Wrap angle from -180 to 180 */
    function wrapAngle(ang : number) {
        /* This magic deals with negative inputs */
        ang = (360 + ang%360)%360;
        if (ang > 180) {
            ang -= 360;
        }
        return ang;
    }

    function angToYPos(ang : number, wrap = true) {
        if (wrap) {
            ang = wrapAngle(ang);
        }
        return ((ang/360) * angleHeight) + (angleHeight/2) + marginHeight;
    }
    
    function yPosToAng(ypos : number) {
        return ((ypos - marginHeight) - angleHeight/2)/angleHeight * 360;
    }

    export function onEscape() {
        if (draggingAny) {
            draggingAny = false;
            moving = false;
            adjusting = false;
            stretching = false;
            return true;
        }

        if (selectedSelectables.length > 0 || selecting) {
            selecting = false;
            selectedSelectables = [];
            return true;
        }

        return false;
    }

    let selecting = false;
    let startSelectionAngle = 0;
    let startSelectionTime = 0;
    let endSelectionAngle = 0;
    let endSelectionTime = 0;
    let selectionLeft = 0;
    let selectionWidth = 0;
    let selectionTop = 0;
    let selectionHeight = 0;

    function mouseCoords(mx : number, my : number) {
        let laneRect = lane.getBoundingClientRect();
        let angle = yPosToAng(my - laneRect.top);
        let time = timeline.relToTime(pixelsToRel(mx, zoom, center));
        return {angle, time}
    }

    function onSelectStart(event : MouseEvent) {
        if (isScrollSpecial(event)) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        selecting = true;
        let {time, angle} = mouseCoords(event.clientX, event.clientY);
        startSelectionAngle = angle;
        startSelectionTime = time;
        recomputeSelectEnd(event.clientX, event.clientY);
        dispatch("interacted");
    }

    function redrawBox() {
        let leftTime  = Math.min(startSelectionTime, endSelectionTime);
        let rightTime = Math.max(startSelectionTime, endSelectionTime);
        let topAngle = Math.min(startSelectionAngle, endSelectionAngle);
        let botAngle = Math.max(startSelectionAngle, endSelectionAngle);

        let leftx = relToPixels(timeline.timeToRel(leftTime), zoom, center);
        let rightx = relToPixels(timeline.timeToRel(rightTime), zoom, center);
        let topy = angToYPos(topAngle, false);
        let boty = angToYPos(botAngle, false);

        selectionTop = topy;
        selectionHeight = boty - topy;
        selectionLeft = leftx;
        selectionWidth = rightx - leftx;
    }

    /* Reactively recompute selection when we scroll */
    $: zoom, center, shiftHeld, recomputeSelectEnd();
    let lmx : number = 0;
    let lmy : number = 0;
    let selectionCandidates : BBSelectionPoint[] = [];
    function recomputeSelectEnd(x : number = lmx, y : number = lmy) {
        if (!selecting) {
            return;
        }
        lmx = x;
        lmy = y;
        let {time, angle} = mouseCoords(x, y);
        endSelectionAngle = angle;
        endSelectionTime = time;

        let minSelectionTime = Math.min(startSelectionTime, endSelectionTime);
        let maxSelectionTime = Math.max(startSelectionTime, endSelectionTime);
        let minSelectionAngle = Math.min(startSelectionAngle, endSelectionAngle);
        let maxSelectionAngle = Math.max(startSelectionAngle, endSelectionAngle);

        let minSelectionBeat = timeline.timeToBeat(minSelectionTime);
        let maxSelectionBeat = timeline.timeToBeat(maxSelectionTime);

        let originalIntersection : BBSelectionPoint[] = [];
        let newCandidates = visibleSelectables.filter(sp => {
            let beat = spToBeat(sp);

            /* Fudge factor to make selection a little more intuitive */
            if (sp.tail) {
                /* Not amazingly efficient.... reconsider? */
                let fudgedRel = timeline.timeToRel(timeline.beatToTime(beat)) - relPixelsToRel(2, zoom);
                beat = timeline.timeToBeat(timeline.relToTime(fudgedRel));
            }

            if (beat > maxSelectionBeat || beat < minSelectionBeat) {
                return false;
            }
            let wrapped = wrapAngle(sp.event.event.angle ?? 0);
            if (wrapped < minSelectionAngle || wrapped > maxSelectionAngle) {
                return false;
            }
            if (selectedSelectables.includes(sp)) {
                originalIntersection.push(sp);
                return false;
            }
            return true;
        });

        if (shiftHeld) {
            if (newCandidates.length == 0) {
                /* No new candidates, treat selection as subtractive */
                selectionCandidates = selectedSelectables.filter(ev => !originalIntersection.includes(ev));
            } else {
                /* Some new elements, treat selection as additive */
                selectionCandidates = [...selectedSelectables, ...newCandidates];
            }
            
        } else {
            /* Treat selection as replacement */
            selectionCandidates = [...newCandidates, ...originalIntersection];
        }

        redrawBox();
    }


    export function onSelectContinue(event : MouseEvent) {
        if (selecting) { 
            event.preventDefault();
            event.stopPropagation();
            recomputeSelectEnd(event.clientX, event.clientY);
        }
    }

    let lHandleTime = 0;
    let rHandleTime = 0;
    export function onSelectFinish(event : MouseEvent) {
        if (!selecting) {
            return;
        }
        selecting = false;

        dispatch("interacted");

        /* Do nothing if the selection wasn't changed */
        if (selectedSelectables.length === selectionCandidates.length) {
            let allSame = true;
            for (let sp of selectedSelectables) {
                if (!selectionCandidates.includes(sp)) {
                    allSame = false;
                    break;
                }
            }
            if (allSame) {
                return;
            }
        }

        /* Selection DID change */
        selectedSelectables = selectionCandidates;

        /* Therefore, recompute the handles */
        let lHandleBeat = 99999;
        let rHandleBeat = -99999;

        for (let sp of selectedSelectables) {
            let beat = spToBeat(sp);
            lHandleBeat = Math.min(beat, lHandleBeat);
            rHandleBeat = Math.max(beat, rHandleBeat);
        }

        lHandleTime = timeline.beatToTime(lHandleBeat);
        rHandleTime = timeline.beatToTime(rHandleBeat);
    }

    function preventNavDrag(event : MouseEvent) {
        if (!isScrollSpecial(event)) {   
            event.stopPropagation();
        }
    }

    function timeToHandleX(time : number, timeline : BBTimeLine, zoom : number, center : number) {
        return relToPixels(timeline.timeToRel(time), zoom, center);
    }

    function mouseToTime(mx : number) {
        return timeline.relToTime(pixelsToRel(mx, zoom, center));
    }

    let draggingAny = false;
    let dragInitialTime : number = 0;
    let draggingLeft = false;
    
    
    function startDrag(event : MouseEvent, left : boolean) {
        draggingAny = true;
        dragInitialTime = mouseToTime(event.clientX);

        /* l/rHandleStartTime is set via handleBeginOperation handler
         * for transform ops, but non-transform op (stretch), still needs it set here.
         */
        lHandleStartTime = lHandleTime;
        rHandleStartTime = rHandleTime;
        
        draggingLeft = left;
        co = true;
        coTime = (draggingLeft ? lHandleTime : rHandleTime);
        event.preventDefault();
        dispatch("interacted");
        console.log("START DRAG");
    }

    let stretching = false;
    function startStretchLeft(event : MouseEvent) {
        startStretch(event, true);
    }
    function startStretchRight(event : MouseEvent) {
        startStretch(event, false);
    }
    function startStretch(event : MouseEvent, left : boolean) {
        if (isScrollSpecial(event, true)) {
            return;
        }
        if (selectedSelectables.length == 0) {
            return;
        }


        /* If all selected events have the same timestamp, and if the stretch region is zero, treat
         * stretch as if it were simply a move. This is to avoid weird behavior that, although
         * is technically correct, might confuse users.
         */
        if (lHandleTime === rHandleTime) {
            let allSameBeat = true;
            let first = true;
            let beat = 0;
            for (let sp of selectedSelectables) {
                if (first) {
                    beat = spToBeat(sp);
                    continue;
                }
                if (spToBeat(sp) != beat) {
                    allSameBeat = false;
                    break;
                }
            }

            if (allSameBeat) {
                startMove(event, left);
                return;
            }
        }
        
        stretching = true;
        timeline.beginStaticTransformOperation(
            lHandleTime, rHandleTime,
            left, snapToBeat, false, beatGrid,
            preserveMode, [...selectedSelectables]
        );
        startDrag(event, left);
    }

    let moving = false;
    function startMoveLeft(event : MouseEvent) {
        startMove(event, true);
    }
    function startMoveRight(event : MouseEvent) {
        startMove(event, false);
    }
    function startMove(event : MouseEvent, left : boolean) {
        if (isScrollSpecial(event, true)) {
            return;
        }
        if (selectedSelectables.length == 0) {
            return;
        }
        moving = true;
        timeline.beginStaticTransformOperation(
            lHandleTime, rHandleTime,
            left, snapToBeat, true, beatGrid,
            preserveMode, [...selectedSelectables]
        );
        startDrag(event, left);
    }


    let adjusting = false;
    function startAdjustLeft(event : MouseEvent) {
        startAdjust(event, true);
    }
    function startAdjustRight(event : MouseEvent) {
        startAdjust(event, false);
    }
    function startAdjust(event : MouseEvent, left : boolean) {
        if (isScrollSpecial(event, true)) {
            return;
        }
        if (selectedSelectables.length == 0) {
            return;
        }
        adjusting = true;
        startDrag(event, left);
    }

    function continueAdjust(delta : number) {
        if (draggingLeft) {
            lHandleTime = lHandleStartTime + delta;
            if (snapToBeat) {
                let snappedBeat = Math.round(timeline.timeToBeat(lHandleTime) * beatGrid)/beatGrid;
                lHandleTime = timeline.beatToTime(snappedBeat);
            }
            coTime = lHandleTime;
        } else {
            rHandleTime = rHandleStartTime + delta;
            if (snapToBeat) {
                let snappedBeat = Math.round(timeline.timeToBeat(rHandleTime) * beatGrid)/beatGrid;
                rHandleTime = timeline.beatToTime(snappedBeat);
            }
            coTime = rHandleTime;
        }
    }

    export function onDrag(event : MouseEvent) {
        if (selecting) {
            onSelectContinue(event);
            return;
        }

        if (!draggingAny) {
            return;
        }

        let dragTime = mouseToTime(event.clientX);
        let delta = dragTime - dragInitialTime;


        if (stretching || moving) {
            coTime = (draggingLeft ? lHandleStartTime : rHandleStartTime) + delta;
        }
        
        if (stretching) {
            let nltime = lHandleStartTime + (draggingLeft ? delta : 0);
            let nrtime = rHandleStartTime + (draggingLeft ? 0 : delta);
            timeline.continueStaticTransformOperation(nltime, nrtime, snapToBeat);
        }
        if (moving) {
            /* When performing move, we set the `preserve length` option,
             * so continueStaticTransformOperation will automatically disregard
             * one of these in order to preserve either time-linear or beat-linear length!
             */
            let nltime = lHandleStartTime + delta;
            let nrtime = rHandleStartTime + delta;
            timeline.continueStaticTransformOperation(nltime, nrtime, snapToBeat);
        }
        if (adjusting) {
            continueAdjust(delta);
        }
        timeline = timeline;
        event.preventDefault();
    }

    export function onUndo() {
        draggingAny = false;
        co = false;
    }

    export function onDragEnd(event : MouseEvent) {
        if (!draggingAny) {
            return;
        }

        if (stretching || moving) {
            event.preventDefault();
            stretching = false;
            moving = false;
            timeline.finishStaticTransformOperation();
        }

        if (adjusting) {
            event.preventDefault();
            adjusting = false;
        }

        timeline = timeline;
        draggingAny = false;
        co = false;
    }

    function selectAllBetween(event : MouseEvent) {
        event.stopPropagation();
        
        let minSelectionBeat = timeline.timeToBeat(lHandleTime);
        let maxSelectionBeat = timeline.timeToBeat(rHandleTime);

        selectedSelectables = visibleSelectables.filter(sp => {
            let beat = spToBeat(sp);

            if (beat > maxSelectionBeat || beat < minSelectionBeat) {
                return false;
            }

            return true;
        });
    }

    function quantizeSelected(event : MouseEvent) {
        event.stopPropagation();
        ignoreStaticUpdates = true;
        timeline.quantizeStaticEvents(beatGrid, selectedSelectables);
        ignoreStaticUpdates = false;
    }
</script>
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div bind:this={lane} class="container"
    on:mousedown={onSelectStart}
    on:mousemove={onSelectContinue}
    on:mouseup={onSelectFinish}
>
    <canvas class="drawzone" bind:this={cv}></canvas>
    {#if selecting}
        <div
            class="selectionbox"
            style:left={selectionLeft + "px"}
            style:width={selectionWidth + "px"}
            style:top={selectionTop + "px"}
            style:height={selectionHeight + "px"}
        ></div>
    {/if}
    {#if !selecting && selectedSelectables.length > 0}
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <div
            class="bracket"
            on:mousedown={preventNavDrag}
            style:left={timeToHandleX(lHandleTime, timeline, zoom, center) + "px"}
        >
            <div class="buttonzone left">
                <button on:mousedown={startMoveLeft}>Move</button>
                <button on:mousedown={startStretchLeft}>Stretch</button>
            </div>
            <div class="buttonzone bottom left">
                <button  on:mousedown={startAdjustLeft}>Adjust</button>
                <button on:click={selectAllBetween}>All</button>
            </div>
            <div class = "line"></div>
        </div>
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <div
            class="bracket"
            on:mousedown={preventNavDrag}
            style:left={timeToHandleX(rHandleTime, timeline, zoom, center) + "px"}
        >
            <div class="buttonzone">
                <button on:mousedown={startMoveRight}>Move</button>
                <button on:mousedown={startStretchRight} >Stretch</button>
            </div>
            <div class="buttonzone bottom">
                <button  on:mousedown={startAdjustRight}>Adjust</button>
                <button on:click={quantizeSelected}>Quantize</button>
            </div>
            <div class = "line"></div>
        </div>
    {/if}
</div>
<style>
    .bracket {
        position: absolute;
        height: 440px;
    }

    .bracket > .line {
        position: absolute;
        height: 100%;
        width: 1px;
        left: 0px;
        background-color: white;
    }

    .buttonzone {
        position: absolute;
        top: 0px;
        left: 0px;
        display:flex;
        flex-direction: column;
        min-width:0px;
        background-color: var(--tooltip-color);
    }
    .buttonzone.left {
        right:0px;
        left:auto;
    }
    .buttonzone.bottom {
        bottom:0px;
        top:auto;
    }

    .buttonzone button {
        border: none;
        display: block;
        color: black;
        pointer-events: auto;
    }

    .container {
        width: 100px;
        height: 440px;
    }
    .drawzone {
        width: 100%;
        height: 100%;
        position: absolute;
    }
    .selectionbox {
        position: absolute;
        pointer-events: none;
        background-color: rgba(255, 255, 255, 0.089);
        outline-color: white;
        outline-width: 1px;
        outline-style: dashed;
    }
</style>