<script lang="ts">
    import { Pane, Splitpanes } from 'svelte-splitpanes';
    import BBMiniMap from './BBMiniMap.svelte';
    import { BBLevelLoader, type BBVariantFiles } from './BBLevelLoader';
    import { onMount, onDestroy } from 'svelte';
    import { BBTimeLine, type BBTimelinePreserveMode } from './BBTimeLine';
    import TimeSpaceEditor from './TimeSpaceEditor.svelte';
    import EventEditor from './EventEditor.svelte';
    import Crosshair from './Crosshair.svelte';
    import TimeSpaceMarkers from './TimeSpaceMarkers.svelte';
    import OptionalNumber from './OptionalNumber.svelte';
    import { relPixelsToRel, pixelsToRel } from '../utils/UXUtils';
    import WaveformZone from './WaveformZone.svelte';
    export let bbll : BBLevelLoader;
    let maxzoom = 4000;
    let zoom = 0.75;
    let center = 50;
    let variants : string[] = bbll.getVariantNames();
    let selectedVariant = variants[0];
    let variant : BBVariantFiles;
    let minimap : BBMiniMap;
    let timeline : BBTimeLine;
    let eventEditor : EventEditor;
    let tsEditor : TimeSpaceEditor;
    let co : boolean = false;
    let coTime : number = 0;
    let showSettings = false;
    let hasEnteredSettings = false;
    let beatGrid = 4;
    let preserveMode : BBTimelinePreserveMode = "KeepBeats";
    let snapToBeatSetting = false;
    let snapInvert = false;
    let startBeatControl : OptionalNumber;
    let offsetControl : OptionalNumber;
    let lbControl : OptionalNumber;
    let showChartEvents : boolean = true;
    let showLevelEvents : boolean = true;

    $: snapToBeat = snapToBeatSetting != snapInvert;

    function handleVariantChanged() {
        console.log("Switching to variant ", selectedVariant);
        variant = bbll.getVariantByName(selectedVariant);
        timeline = new BBTimeLine(variant);
        startBeatControl?.setValue(timeline.getStartBeat());
        offsetControl?.setValue(timeline.getOffset());
        lbControl?.setValue(timeline.getLoadBeat());
    }
    handleVariantChanged();

    function handleSBChange(event : CustomEvent) {
        timeline.setStartBeat(event.detail as number | null);
        timeline = timeline;
    }
    function handleOFSChange(event : CustomEvent) {
        timeline.setOffset(event.detail as number | null);
        timeline = timeline;
    }
    function handleLBChange(event : CustomEvent) {
        timeline.setLoadBeat(event.detail as number | null);
        timeline = timeline;
    }

    /* Clamp zoom - This is a limitation of the waveform renderer. 
     * We could get around this maybe with tighter math, but my capacity to care is not sufficient.
     */
    $: zoom = zoom > maxzoom ? maxzoom : zoom;
    function onKeyDown(event : KeyboardEvent) {
        checkCtrl(event);

        if (event.key === 'Escape') {
            handleEscape();
            return;
        }
        
        if (event.code === 'KeyZ' && (event.ctrlKey || event.metaKey) && !event.shiftKey) {
            handleUndo();
            return;
        }
        
        if (event.code === 'KeyY' && (event.ctrlKey || event.metaKey)) {
            handleRedo();
            return;
        }
        
        if (event.code === 'KeyZ' && (event.ctrlKey || event.metaKey) && event.shiftKey) {
            handleRedo();
            return;
        }
    }

    function checkCtrl(event : KeyboardEvent) {
        snapInvert = event.ctrlKey != event.metaKey;
    }

    function onKeyPressed(event : KeyboardEvent) {
        if (event.code === 'KeyT') {
            preserveMode = "KeepTimes";
            return;
        }
        
        if (event.code === 'KeyG') {
            preserveMode = "KeepTimesAfter";
            return;
        }
        
        if (event.code === 'KeyB') {
            preserveMode = "KeepBeats";
            return;
        }

        if (event.code === 'KeyS') {
            snapToBeatSetting = !snapToBeatSetting;
            return;
        }
    }


    let tsEscapeFirst = false;
    function handleEscape() {
        if (tsEscapeFirst && tsEditor?.onEscape()) {
            return;
        }
        if (eventEditor?.onEscape()) {
            return;
        }
        if (tsEditor?.onEscape()) {
            return;
        }
    }

    function onTimespaceInteraction() {
        tsEscapeFirst = true;
    }
    function onEventEditorInteraction() {
        tsEscapeFirst = false;
    }

    /* This lets us detect mouse up if it occurs while outside the window, essentially
     * Technically, the user could swap the exact button pressed, and we'd not detect this,
     * but at that point it is beyond the scope of what I am willing to write edge cases for.
     */
    function onMouseReenterWindow(e : MouseEvent) {
        if (e.buttons == 0) {
            onDragEnd(e);
        }
    }

    onMount(() => {
        document.body.addEventListener('mouseenter', onMouseReenterWindow);
        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('keypress', onKeyPressed);
        document.addEventListener('keyup', checkCtrl);
	});

    onDestroy(() => {
        document.body.removeEventListener('mouseenter', onMouseReenterWindow);
        document.removeEventListener('keydown', onKeyDown);
        document.removeEventListener('keypress', onKeyPressed);
        document.removeEventListener('keyup', checkCtrl);
	});

    let isDragging = false;
    let dragStart = 0;
    let dragStartCenter = 0;

    function onDragStart(e : MouseEvent) {
        isDragging = true;
        dragStart = e.clientX;
        dragStartCenter = center;
        e.preventDefault();
    }
    
    /* Cascade these events to the minimap so that drags don't have to stay within it */
    function onDragEnd(e : MouseEvent) {
        if (!isDragging) {
            minimap?.onDragEnd(e);
            tsEditor?.onDragEnd(e);
            eventEditor?.onDragEnd(e);
            eventEditor?.onSelectFinish(e);
        }
        if (isDragging) {
            isDragging = false;
            e.preventDefault();
        }
    }

    function onDrag(e : MouseEvent) {
        if (!isDragging) {
            minimap?.onDrag(e);
            tsEditor?.onDrag(e);
            eventEditor?.onDrag(e);
        }
        if (isDragging)
        {
            let dx = e.clientX - dragStart;
            /* Dragged by more than a little bit, do not count as a click in timespace editor */
            if (Math.abs(dx) > 2) {
                tsEditor.cancelClick();
            }
            let drel = relPixelsToRel(dx, zoom);
            center = dragStartCenter - drel;
        }
    }

    function handleUndo() {
        timeline.undo();
        timeline=timeline;
        tsEditor.onUndo();
        eventEditor.onUndo();
        startBeatControl?.setValue(timeline.getStartBeat());
        offsetControl?.setValue(timeline.getOffset());
        lbControl?.setValue(timeline.getLoadBeat());
    }

    function handleRedo() {
        timeline.redo();
        timeline=timeline;
        tsEditor.onUndo();
        eventEditor.onUndo();
        startBeatControl?.setValue(timeline.getStartBeat());
        offsetControl?.setValue(timeline.getOffset());
        lbControl?.setValue(timeline.getLoadBeat());
    }

    function openSettings() {
        showSettings = !showSettings;
        hasEnteredSettings = false;
    }

    function onEnterSettings() {
        if (showSettings) {
            hasEnteredSettings = true;
        }
    }

    function onExitSettings() {
        if (hasEnteredSettings) {
            hasEnteredSettings = false;
            showSettings = false;
        }
    }

    function save() {
        bbll.downloadVariant(variant);
    }

    function home() {
        zoom = 0.75;
        center = 50;
    }


    /* Zoom functions */
    function zoomOnMouse(amount : number, mx : number) {
        let og = pixelsToRel(mx, zoom, center);
        zoom *= Math.pow(2, amount);
        let ng = pixelsToRel(mx, zoom, center);
        center -= ng - og;
    }
    function onMouseWheelZoom(e : WheelEvent) {
        if(e.ctrlKey || e.shiftKey)
        {
            zoomOnMouse(-e.deltaY/240, e.clientX);
            e.preventDefault();
            e.stopPropagation();
        }
        center += (e.deltaX/20)/zoom;
    }
    function onMouseWheelPreventDefault(e : WheelEvent) {
        /* I originally wanted to allow ctrl-zoom to still work as page zoom in non-timeline
         * regions of the webpage, but alpha-testing has proven to me this was a bad idea.
         */
        e.preventDefault();
        e.stopPropagation();
    }

    function handleDropPrevent(e : DragEvent) {
        e.preventDefault();
        e.stopPropagation();
    }
</script>
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="vflow"
    on:mouseup={onDragEnd}
    on:mousemove={onDrag}
    on:drop={handleDropPrevent}
    on:dragover={handleDropPrevent}
>
    <div class="menubar" on:wheel={onMouseWheelPreventDefault}>
        <div class="menu">
            <select class="variantselect" bind:value={selectedVariant} on:change={handleVariantChanged}>
                {#each variants as vname}<option value={vname}>{"variant: " + vname}</option>{/each}
            </select>
            <button class="mmbutton" class:enabled={timeline.canUndo} on:click={handleUndo}>Undo</button>
            <button class="mmbutton" class:enabled={timeline.canRedo} on:click={handleRedo}>Redo</button>
            <button class="mmbutton enabled" on:click={openSettings}>Settings</button>
            <button class="mmbutton enabled" on:click={save}>Save</button>
            <button class="mmbutton enabled" on:click={home}>Home</button>
            <div class="modezone">
                <div class="moderadio">
                    <button
                        Title={"Edits preserve times"}
                        class="moderadiobutton timer"
                        class:active={preserveMode==="KeepTimes"}
                        on:click={()=>{preserveMode="KeepTimes"}}
                    >
                    </button>
                    <button
                        Title={"Edits preserve times after next marker"}
                        class="moderadiobutton timerbeat"
                        class:active={preserveMode==="KeepTimesAfter"}
                        on:click={()=>{preserveMode="KeepTimesAfter"}}
                    >
                    </button>
                    <button
                        Title={"Edits preserve beats"}
                        class="moderadiobutton beat"
                        class:active={preserveMode==="KeepBeats"}
                        on:click={()=>{preserveMode="KeepBeats"}}
                    >
                </button>
                </div>
                
                <div class="moderadio">
                    <button
                        Title={snapToBeatSetting?"Disable snapping":"Enable Snapping"}
                        class="snapbutton" class:active={snapToBeat}
                        on:click={()=>{snapToBeatSetting = !snapToBeatSetting}}
                    >
                    </button>
                </div>
            </div>
            <div class="settingszone" class:hidden={!showSettings}  on:mouseenter={onEnterSettings} on:mouseleave={onExitSettings}>
                <div>
                    Beat grid:
                    <select bind:value={beatGrid}>
                        <option value={1}>beat</option>
                        <option value={2}>1/2 beat</option>
                        <option value={3}>1/3 beat</option>
                        <option value={4}>1/4 beat</option>
                        <option value={5}>1/5 beat</option>
                        <option value={6}>1/6 beat</option>
                        <option value={7}>1/7 beat</option>
                        <option value={8}>1/8 beat</option>
                        <option value={9}>1/9 beat</option>
                        <option value={10}>1/10 beat</option>
                        <option value={11}>1/11 beat</option>
                        <option value={12}>1/12 beat</option>
                        <option value={16}>1/16 beat</option>
                    </select>
                </div>
                <div>
                    <label>
                        <input type="checkbox" bind:checked={snapToBeatSetting} />
                        Snap to beat?
                    </label>
                </div>
                <div>
                    Operation Mode:
                    <select bind:value={preserveMode}>
                        <option value={"KeepTimes"}>Preserve All Times</option>
                        <option value={"KeepTimesAfter"}>Preserve Times After Next</option>
                        <option value={"KeepBeats"}>Preserve All Beats</option>
                    </select>
                </div>
                <div class="info">These settings behave strangely! This is accurate to BeatBlock's behavior. If the song's true start beat is greater than zero, the load beat has no effect!</div>
                <div>
                    <OptionalNumber value={timeline.getStartBeat()} bind:this={startBeatControl} on:change={handleSBChange}>Song start beat</OptionalNumber>
                </div>
                <div>
                    <OptionalNumber always value={timeline.getOffset()} bind:this={offsetControl} on:change={handleOFSChange}>Beat load offset</OptionalNumber>
                </div>
                <div>
                    <OptionalNumber value={timeline.getLoadBeat()} bind:this={lbControl} on:change={handleLBChange}>Song load beat</OptionalNumber>
                </div>
                <div>
                    <label>
                        Show chart events:
                        <input type="checkbox" bind:checked={showChartEvents}/>
                    </label>
                </div>
                <div>
                    <label>
                        Show level events:
                        <input type="checkbox" bind:checked={showLevelEvents}/>
                    </label>
                </div>
            </div>
        </div>
        <div class="minimapsection">
            <BBMiniMap bind:this={minimap} bind:center bind:zoom></BBMiniMap>
        </div>
    </div>
    <div class="mainarea" on:wheel={onMouseWheelZoom}>
        <div class="topmargin"></div>
        <Splitpanes class="panes" horizontal theme="bba-theme" style="flex-grow:1;min-height:0px">
            <Pane size={20}>
                <div style="width:100%; height:100%"
                    on:mousedown={onDragStart}
                >
                    <WaveformZone bind:beatGrid bind:timeline bind:center bind:zoom></WaveformZone>
                </div>
                <div class="lanetitle">waveforms</div>
            </Pane>
            <Pane size={20}>
                <div style="width:100%; height:100%"
                    on:mousedown={onDragStart}
                >
                    <TimeSpaceEditor
                        bind:snapToBeat bind:preserveMode bind:beatGrid
                        bind:co bind:coTime bind:zoom bind:center
                        bind:this={tsEditor}
                        bind:timeline
                        on:interacted={onTimespaceInteraction}>
                    </TimeSpaceEditor>
                    <div class="lanetitle">timespace editor</div>
                </div>
            </Pane>
            <Pane>
                <div style="width:100%; height:100%"
                    on:mousedown={onDragStart}
                >
                    <TimeSpaceMarkers bind:beatGrid bind:zoom bind:center bind:timeline></TimeSpaceMarkers>
                    <EventEditor
                        bind:beatGrid bind:preserveMode bind:snapToBeat
                        bind:co bind:coTime bind:showLevelEvents bind:showChartEvents
                        bind:this={eventEditor} bind:zoom bind:center bind:timeline
                        on:interacted={onEventEditorInteraction}
                        >
                    </EventEditor>
                    <div class="lanetitle">event editor</div>
                </div>
            </Pane>
        </Splitpanes>
        <Crosshair bind:co bind:coTime bind:zoom bind:center bind:timeline></Crosshair>
    </div>
</div>

<style global lang="scss">
    @use "bba-theme.scss";
    @import "global.css";
    .nopointer {
        pointer-events: none;
    }
    .topmargin {
        height:20px;
    }
    .mmbutton {
        height:100%;
        background-color: var(--main-input-bg-disabled);
        color : var(--main-input-text-disabled);
        display:block;
        min-width:75px;
    }
    .mmbutton.enabled {
        background-color: var(--main-input-bg);
        color : var(--main-text-color);
    }
    .mmbutton.enabled:hover {
        background-color: var(--main-input-bg-highlight);
    }
    .mmbutton.enabled:active {
        background-color: var(--main-input-bg-active);
    }
    .variantselect {
        height:100%;
        background-color: var(--main-input-bg);
    }
    .menu {
        display:flex;
        overflow:visible;
        position:relative;
    }
    .minimapsection {
        flex-grow: 1;
        min-width: 0;
    }
    .menubar {
        display: flex;
        height:56px;
        overflow:visible;
    }
    .mainarea {
        min-height: 0;
        flex-grow:1;
        position:relative;
        overflow-x: hidden;
        display:flex;
        flex-direction: column;
    }
    .vflow {
        display: flex;
        flex-direction: column;
        height:100%;
    }
    .settingszone.hidden {
        display: none;
    }
    .settingszone {
        padding:20px;
        background-color: var(--highlight-bg-color);
        border-color :  var(--highlight-text-color);
        color: var(--highlight-text-color);
        border-width:3px;
        border-style:solid;
        box-sizing: border-box;
        position:absolute;
        left:0px;
        top:100%;
        min-width:100%;
        min-height:100px;
        z-index: 400;
    }
    .settingszone > div.info {
        white-space: normal;
        color: var(--info-text-color);
    }
    .settingszone > div {
        display: flex;
        white-space: nowrap;
    }
    .settingszone input {
        background-color: var(--main-input-bg);
        color : var(--main-text-color);
    }
    .settingszone select {
        background-color: var(--main-input-bg);
    }
    
    .modezone {
        padding:2px;
        display:flex;
    }
    .moderadiobutton:hover {
        background-color: rgba(255, 255, 255, 0.486);
    }
    .moderadiobutton:active {
        background-color: rgba(255, 255, 255, 0.671);
    }
    .snapbutton, .moderadiobutton {
        padding: 0px;
        margin: 0px;
        display: block;
        border: none;
        background-color: transparent;
    }
    .snapbutton {
        width: 48px;
        height: 48px;
        background-image: url("assets/magnet_inactive.png");
        margin-left: 2px;
    }
    .snapbutton.active {
        background-image: url("assets/magnet_active.png");
    }
    .moderadiobutton.timer {
        background-image: url("assets/keeptime_inactive.png")
    }
    .moderadiobutton.timerbeat {
        background-image: url("assets/keepboth_inactive.png")
    }
    .moderadiobutton.beat {
        background-image: url("assets/keepbeat_inactive.png")
    }
    .moderadiobutton.timer.active {
        background-image: url("assets/keeptime_active.png")
    }
    .moderadiobutton.timerbeat.active {
        /* trust me, this makes sense if you were there */
        background-image: url("assets/IDONTEVENKNOWANYMORE.png")
    }
    .moderadiobutton.beat.active {
        background-image: url("assets/keepbeat_active.png")
    }
    .moderadiobutton {
        width: 16px;
        height: 16px;
    }
    .moderadio {
        display: flex;
        flex-direction: column;
        justify-content: space-around;
    }
    .lanetitle {
        writing-mode: sideways-lr;
        pointer-events: none;
        z-index: 200;
        background-color: rgba(0, 0, 0, 0.425);
        position: absolute;
        top: 0px;
        left: 0px;
        padding : 3px;
        height: 100%;
        text-wrap: nowrap;
        text-align: center;
    }
    .tzcontainer {
        overflow: auto;
        display: block;
        overflow-x: hidden;
        box-sizing: border-box;
    }
    .tzdomain {
        transform-origin: top left;
        position: relative;
        display: block;
        container-name: timeline;
        container-type: inline-size;
        box-sizing: border-box;
    }
</style>