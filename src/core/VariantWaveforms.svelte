<script lang="ts">
    import { handleDropEvent, loadAudioFile } from "src/utils/FileUtils";
    import type { BBSoundFile } from "./BBLevelLoader";
    import type { BBTimeLine, BBTimelineEvent } from "./BBTimeLine";
    import type { LODAudioData } from "../utils/SoundUtils";
    import TimelineLanes from "./TimelineLanes.svelte";
    import Waveform from "./Waveform.svelte";
    import type { BBPlayEvent } from "./BBTypes";
    import { relToRelPixels } from "../utils/UXUtils";

    export let timeline : BBTimeLine;
    export let zoom : number;

    /* not incredibly efficient, but it hardly matters, and it's functional so svelte handles it
     * nicely.
     */
    function startTime(timeline : BBTimeLine, tle : BBTimelineEvent) : number {
        let scheduledTime = timeline.beatToTime(tle.realbeat ?? (tle.event.time ?? 0));
        /* This offset setting is measured actually a playback time offset, go figure!  */
        let trueTime = scheduledTime - ((tle.event as BBPlayEvent).offset ?? 0);
        return trueTime;
    }
    function mapStart(timeline : BBTimeLine, tle : BBTimelineEvent, zoom : number) : number {
        return relToRelPixels(timeline.timeToRel(startTime(timeline, tle)), zoom);
    }
    function soundInfo(timeline : BBTimeLine, tle : BBTimelineEvent) : BBSoundFile {
        return timeline.variant.sounds.get((tle.event as BBPlayEvent).file)!;
    }
    function mapLength(timeline : BBTimeLine, tle : BBTimelineEvent, zoom : number) : number {
        let start = startTime(timeline, tle);
        let sound = soundInfo(timeline, tle);
        let end = start + sound.soundData.duration;
        let startRel = timeline.timeToRel(start);
        let endRel = timeline.timeToRel(end);
        let drel = endRel - startRel;
        return relToRelPixels(drel, zoom);
    }

    function mapRelativeLength(timeline : BBTimeLine, tle : BBTimelineEvent, ct : LODAudioData, zoom : number) {
        let sound = soundInfo(timeline, tle);
        return ct.duration/sound.soundData.duration * mapLength(timeline, tle, zoom);
    }

    async function onFilesDragged(e : CustomEvent, tle : BBTimelineEvent, i : number = -1) {
        await addFilesToPlay(e.detail.files, tle, i)
    }

    async function addFilesToPlay(files : FileSystemEntry[], tle : BBTimelineEvent, i : number = -1) {
        let sound = soundInfo(timeline, tle);

        if (i == -1) {
            i = sound.clickTracks.length;
        }

        let soundFiles = files.filter(file=>file.fullPath.endsWith(".ogg"));

        for (let soundFile of soundFiles) {
            let newSound = await loadAudioFile(soundFile as FileSystemFileEntry);
            sound.clickTracks.splice(i++, 0, newSound);
        }

        timeline=timeline;
    }

    function deleteClickTrack(e : MouseEvent, tle : BBTimelineEvent, i : number = 0) {
        let sound = soundInfo(timeline, tle);
        sound.clickTracks.splice(i, 1);
        timeline=timeline;
        e.stopPropagation();
        e.preventDefault();
    }

    export async function handleClickTrackDrop(e : DragEvent) {
        let playEvents = timeline.timeControlEvents.filter(tle => tle.event.type === "play");
        if (playEvents.length === 1) {
            let files = await handleDropEvent(e);
            await addFilesToPlay(files, playEvents[0]);
        }
    }


    //timeline.variant.sounds
</script>
<TimelineLanes style={$$props.style}>
    {#each timeline.timeControlEvents as tle}
        {#if tle.event.type === "play"}
            <Waveform
                allowdrop on:filesDragged={(e)=>onFilesDragged(e,tle, 0)}
                start={mapStart(timeline, tle, zoom)}
                length={mapLength(timeline, tle, zoom)}
                data={soundInfo(timeline, tle).soundData}
                shown={!(tle.skipped)}
            >
                <div class="wavetitle"><div class="titletext">{soundInfo(timeline, tle).soundFileName}</div></div>
            </Waveform>
            {#if soundInfo(timeline, tle).clickTracks.length > 0}
                {#each soundInfo(timeline, tle).clickTracks as ct, i}
                    <Waveform allowdrop on:filesDragged={(e)=>onFilesDragged(e, tle, i+1)}
                        start={mapStart(timeline, tle, zoom)}
                        length={mapRelativeLength(timeline, tle, ct, zoom)}
                        data={ct}>
                        <div class="wavetitle">
                            <div class="titletext">{ct.filename}</div>
                            <button
                                class="wavebutton del"
                                on:click={(e)=>deleteClickTrack(e, tle, i)}
                            >
                                Delete
                            </button>
                        </div>
                    </Waveform>
                {/each}
            {/if}
        {/if}
    {/each}
</TimelineLanes>

<style>
    .wavetitle {
        position: absolute;
        top: 0px;
        left: 0px;
        background-color: rgba(0, 0, 0, 0.425);
        display: flex;
        gap: 10px;
        text-wrap: nowrap;
    }

    .wavebutton {
        border: none;
        display: block;
        color: black;
        pointer-events: auto;
    }
    .wavebutton:hover {
        border: none;
        display: block;
        pointer-events: auto;
    }
    .titletext {
        max-width: 50vw;
    }
</style>