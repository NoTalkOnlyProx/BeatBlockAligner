<script lang="ts">
    import { BBTimeLine, type BBTimelineEvent } from './BBTimeLine';
    import { isScrollSpecial, mouseToRelNumeric, relToMouseNumeric } from './UXUtils';
    export let timeline : BBTimeLine;
    export let zoom : number;
    export let center : number;
    const angleHeight = 320;
    const marginHeight = 40;
    let lane : HTMLElement;

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
    function beatToRel(beat : number) {
        return timeline.timeToRel(timeline.beatToTime(beat));
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
        let time = timeline.relToTime(mouseToRelNumeric(mx, zoom, center));
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

        let leftx = timeline.timeToRel(leftTime);
        let rightx = timeline.timeToRel(rightTime);
        let topy = angToYPos(topAngle, false);
        let boty = angToYPos(botAngle, false);

        selectionTop = topy;
        selectionHeight = boty - topy;
        selectionLeft = leftx;
        selectionWidth = rightx - leftx;
    }

    /* Reactively recompute selection when we scroll */
    $: zoom, center, recomputeSelectEnd();
    let lmx : number = 0;
    let lmy : number = 0;
    function recomputeSelectEnd(x : number = lmx, y : number = lmy) {
        if (!selecting) {
            return;
        }
        lmx = x;
        lmy = y;
        let {time, angle} = mouseCoords(x, y);
        endSelectionAngle = angle;
        endSelectionTime = time;
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
            /* ... */
            selecting = false;
        }
    }
</script>
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div bind:this={lane} class="lane"
    on:mousedown={onSelectStart}
    on:mousemove={onSelectContinue}
    on:mouseup={onSelectFinish}
>
    <div class="sublane">
        {#each timeline.staticEvents as event}
            <div
                class="marker"
                class:chart={event.fromChart}
                style:left={`calc(${beatToRel(event.event.time)}cqw)`}
                style:top={`calc(${angToYPos(event.event.angle ?? 0)}px - 20px)`}
            >
                <div class="icon fill">
                    <img class="bbicon" src={getIcon(event)} alt={event.event.type}/>
                </div>
                <div class="line fill"></div>
            </div>
        {/each}

        {#if selecting}
            <div
                class="selectionbox"
                style:left={selectionLeft + "cqw"}
                style:width={selectionWidth + "cqw"}
                style:top={selectionTop + "px"}
                style:height={selectionHeight + "px"}
            ></div>
        {/if}
    </div>
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
        /* -1000cqw to +1100cqw is a hack to make selection work even when it starts outside
         * the song main area. In a "perfect" world, we'd use proper event bubbling to achieve
         * this, but that comes at the cost of much messier code. This hack will suffice in
         * 99.999% of cases, so why not?
         */
        left: -1000cqw;
        width: 2100cqw;
        height: 400px;
    }
    /* This exists just to restore us to sane coordinates in light of the above hack. */
    .sublane {
        position: absolute;
        left: 1000cqw;
        width: 100cqw;
        height: 100%;
    }
    .marker {
        position: absolute;
        width: 20px;
        height: 40px;
        background-color: rgba(0,0,0,0);
    }
    .marker:hover .fill, .marker.selected .fill {
        background-color: white;
    }
    .fill {
        background-color: yellow;
    }
    .chart > .fill{
        background-color: rgb(0, 204, 255);
    }
    .icon {
        position: absolute;
        width: 20px;
        height: 20px;
        top: 10px;
        left: 0px;
    }
    .line {
        position: absolute;
        left: 0px;
        width: 1px;
        height: 100%;
    }
</style>