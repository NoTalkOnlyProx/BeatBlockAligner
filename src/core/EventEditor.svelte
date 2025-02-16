<script lang="ts">
    import { BBTimeLine } from './BBTimeLine';
    export let timeline : BBTimeLine;
    let beats = 0;
    $: beats = Math.ceil(timeline.lastBeat-timeline.firstBeat) * 4;
    function mapBeat(beat : number) {
        return timeline.timeToRel(timeline.beatToTime(beat));
    }
    export function onEscape() {
        return false;
    }
</script>
<div class="lane">
    {#each timeline.staticEvents as event}
        <div class="marker" style:left={mapBeat(event.event.time) + "cqw"}></div>
    {/each}
</div>
<style>
    .lane {
        width: 100cqw;
        height: 100px;
    }
    .marker {
        position: absolute;
        width: 1px;
        height: 100px;
        background-color: yellow;
    }
</style>