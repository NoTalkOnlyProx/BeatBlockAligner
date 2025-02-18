<script lang="ts">
    import { onDestroy, onMount } from 'svelte';
    import { BBTimeLine, type BBSelectionPoint, type BBTimelineEvent } from './BBTimeLine';
    import { isScrollSpecial, relPixelsToRel, pixelsToRel, relToRelPixels } from './UXUtils';
    import type { BBDurationEvent } from './BBTypes';
    import EventCaptureZone from './EventCaptureZone.svelte';
    export let timeline : BBTimeLine;
    export let zoom : number;
    export let center : number;
    const angleHeight = 320;
    const marginHeight = 40;
    let lane : HTMLElement;

    export let showChartEvents : boolean = true;
    export let showLevelEvents : boolean = true;

    /* selectableCache helps us not create brand new Selectables for selectable events that
     * that were already in previous version of the timeline
     */

    let selectableCache : Map<BBTimelineEvent, BBSelectionPoint[]> = new Map();
    let allSelectables : BBSelectionPoint[];
    let visibleSelectables : BBSelectionPoint[] = [];
    let selectedSelectables : BBSelectionPoint[] = [];

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
        let filteredSelected = selectedSelectables.filter(sev => {
            return selectableCache.has(sev.event);
        });

        /* Update selection if it actually changed. */
        if (!arraysContainSameFast(selectedSelectables, filteredSelected)) {
            selectedSelectables = filteredSelected;
        }
    }

    $: showChartEvents, showLevelEvents, timeline, recomputeVisibleEvents();
    function recomputeVisibleEvents() {
        let newVisibleEvents = allSelectables.filter(se => {
            return se.event.fromChart && showChartEvents ||
                   !se.event.fromChart && showLevelEvents;
        });
        if (!arraysContainSameFast(newVisibleEvents, visibleSelectables)) {
            visibleSelectables = newVisibleEvents;
        }
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
	});

    onDestroy(() => {
        document.removeEventListener('keydown', onKeyDown);
        document.removeEventListener('keyup', onKeyUp);
	});

    /* O(n) if elements shared between a,b are in the same relative order,
     * but guaranteed to work (slowly) even if not.
     */
    function arraysContainSameFast(a : any[], b : any[]) {
        if (a.length != b.length) {
            return false;
        }
        let offset = 0;
        /* Check that every member of a is also a member of b at least once */
        for (let i = 0; i < a.length; i++) {

            /* Check the index after the previous matching element index */
            let guessidx = (i + offset)%b.length;
            if (b[guessidx] == a[i]) {
                continue;
            }

            /* Search entire array */
            let bidx = b.indexOf(a[i]);
            if (bidx == -1) {
                return false;
            }
            /* not -1, it was found! use the new index as the offset for future iterations */
            offset = bidx - i;
        }
        /* If a and b are the same length, and every element of a is in b, they have to be the
         * same.
         */
        return true;
    }

    const iconMapping : {[index: string] : string} = {
        play                : "assets/play.png",
        width               : "assets/width.png",
        showresults         : "assets/showresults.png",
        setColor            : "assets/setcolor.png",
        setBgColor          : "assets/setbgcolor.png",
        outline             : "assets/outline.png",
        tag                 : "assets/tag.png",
        deco                : "assets/deco.png",
        extratap            : "assets/extratap.png",
        paddlecount         : "assets/paddlecount.png",
        hom                 : "assets/mirror.png",
        ease                : "assets/ease.png",
        noise               : "assets/noise.png",
        bookmark            : "assets/bookmark.png",
        setbpm              : "assets/setbpm.png",
        forcePlayerSprite   : "assets/forceplay",
        setBoolean          : "assets/setboolean.png",
        paddle              : "assets/paddle.png",
        playSound           : "assets/playsound.png",
        toggleParticles     : "assets/particles.png",

        block               : "assets/square.png",
        extraTap            : "assets/extratap.png",
        hold                : "assets/hold.png",
        inverse             : "assets/inverse.png",
        mine                : "assets/mine.png",
        mineHold            : "assets/mineHold.png",
        side                : "assets/side.png",
        trace               : "assets/trace.png",
    }


    let beats = 0;
    $: beats = Math.ceil(timeline.lastBeat-timeline.firstBeat) * 4;

    function spToBeat(sp : BBSelectionPoint) {
        let beat = sp.event.event.time;
        if (sp.tail) {
            beat += (sp.event.event as BBDurationEvent).duration;
        }
        return beat;
    }
    function spToRelPx(sp : BBSelectionPoint, timeline : BBTimeLine, zoom : number) {
        return relToRelPixels(timeline.timeToRel(timeline.beatToTime(spToBeat(sp))), zoom);
    }
    function spToBridge(sp : BBSelectionPoint, timeline: BBTimeLine, zoom : number) {
        let ret = spToRelPx(sp.other!, timeline, zoom) - spToRelPx(sp, timeline, zoom);
        return ret;
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
        return false;
    }
    function getIcon(event : BBTimelineEvent) {
        return iconMapping[event.event.type] ?? "assets/genericevent.png";
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
    }

    function redrawBox() {
        let leftTime  = Math.min(startSelectionTime, endSelectionTime);
        let rightTime = Math.max(startSelectionTime, endSelectionTime);
        let topAngle = Math.min(startSelectionAngle, endSelectionAngle);
        let botAngle = Math.max(startSelectionAngle, endSelectionAngle);

        let leftx = relToRelPixels(timeline.timeToRel(leftTime), zoom);
        let rightx = relToRelPixels(timeline.timeToRel(rightTime), zoom);
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
    export function onSelectFinish(event : MouseEvent) {
        if (selecting) {
            selectedSelectables = selectionCandidates;
            selectionCandidates = [];
            selecting = false;
        }
    }

    function isShownAsSelected(event : BBSelectionPoint, selectionCandidates : BBSelectionPoint[], selectedEvents : BBSelectionPoint[]) {
        if (selecting && selectionCandidates.includes(event)) {
            return true;
        }
        if (!selecting && selectedEvents.includes(event)) {
            return true;
        }
        return false;
    }
</script>
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div bind:this={lane} class="lane"
    on:mousedown={onSelectStart}
    on:mousemove={onSelectContinue}
    on:mouseup={onSelectFinish}
>
    <EventCaptureZone style="height:100%"></EventCaptureZone>
    {#each visibleSelectables as sp}
        <div
            class="marker"
            class:chart={sp.event.fromChart}
            class:selected={isShownAsSelected(sp, selectionCandidates, selectedSelectables)}
            style:left={`${spToRelPx(sp, timeline, zoom)}px`}
            style:top={`calc(${angToYPos(sp.event.event.angle ?? 0)}px - 20px)`}
        >
            <div class="line fill"></div>
            <div class="square fill" class:tail={sp.tail}>
                <img class="bbicon" src={getIcon(sp.event)} alt={sp.event.event.type}/>
            </div>
            {#if sp?.other?.tail}
                <div class="bridge"
                    class:lsel={isShownAsSelected(sp, selectionCandidates, selectedSelectables)}
                    class:rsel={isShownAsSelected(sp.other, selectionCandidates, selectedSelectables)}
                    style:width={spToBridge(sp, timeline, zoom) + "px"}>
                </div>
            {/if}
        </div>
    {/each}

    {#if selecting}
        <div
            class="selectionbox"
            style:left={selectionLeft + "px"}
            style:width={selectionWidth + "px"}
            style:top={selectionTop + "px"}
            style:height={selectionHeight + "px"}
        ></div>
    {/if}
</div>
<style>
    .selectionbox {
        position: absolute;
        pointer-events: none;
        background-color: rgba(255, 255, 255, 0.089);
        outline-color: white;
        outline-width: 1px;
        outline-style: dashed;
    }
    .bbicon {
        background-color: white;
        width: 16px;
        height: 16px;
    }
    .lane {
        width: 100px;
        height: 400px;
    }
    .marker {
        position: absolute;
        width: 20px;
        height: 40px;
        background-color: rgba(0,0,0,0);
    }
    .marker.selected .fill, .bridge.lsel.rsel, .chart > .bridge.lsel.rsel {
        background-color: white;
        outline-color:  white;
        outline-width: 3px;
        outline-style: solid; 
        background-image: none;
    }
    .fill, .bridge {
        background-color: yellow;
    }
    .chart > .fill, .chart > .bridge {
        background-color: rgb(0, 204, 255);
    }
    .bridge.lsel {
        background-image: linear-gradient(to right, white, rgb(0, 204, 255));
    }
    .bridge.rsel {
        background-image: linear-gradient(to right, rgb(0, 204, 255), white);
    }

    
    .chart > .bridge.lsel {
        background-image: linear-gradient(to right, white, rgb(0, 204, 255));
    }
    .chart >  .bridge.rsel {
        background-image: linear-gradient(to right, rgb(0, 204, 255), white);
    }

    .square {
        position: absolute;
        width: 20px;
        height: 20px;
        top: 10px;
        left: 0px;
        z-index : 20;
    }

    
    .bridge {
        position: absolute;
        height: 4px;
        top: 18px;
        left: 0px;
    }
    .square.tail {
        left: -20px;
    }
    .line {
        position: absolute;
        left: 0px;
        width: 1px;
        height: 100%;
    }
</style>