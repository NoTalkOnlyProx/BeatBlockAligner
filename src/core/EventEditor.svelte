<script lang="ts">
    import { BBTimeLine, type BBTimelineEvent } from './BBTimeLine';
    import { isScrollSpecial, mouseToRelNumeric } from './UXUtils';
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
    function angToYPos(ang : number) {
        /* Wrap angle from -180 to 180 */
        if (ang < 0) {
            ang = (360 - ang%360);
        }
        ang %= 360;
        if (ang > 180) {
            ang -= 360;
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
</script>
<div bind:this={lane} class="lane">
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
</div>
<style>
    .bbicon {
        background-color: white;
        width: 16px;
        height: 16px;
    }
    .lane {
        width: 100cqw;
        height: 400px;
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