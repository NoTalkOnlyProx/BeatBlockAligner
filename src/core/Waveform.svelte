<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { type LODAudioData } from '../utils/SoundUtils';
    import { handleDropEvent } from 'src/utils/FileUtils';

    import { createEventDispatcher } from "svelte";
    const dispatch = createEventDispatcher();

    export let data : LODAudioData;
    let cv : HTMLCanvasElement;
    let container : HTMLDivElement;
    export let start;
    export let length;
    export let bgcol: string = "#ffffff21";
    export let bgcolDrag: string = "#ffffff30";
    export let wavecol: string = "#ffffff";
    export let allowdrop = false;
    export let shown = true;

    let current_bgcol = bgcol;
    $: current_bgcol = dragging ? bgcolDrag : bgcol;

    let dirty = true;
    $: data, dirty = true;

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

    /* Doing this outside of svelte because it needs to be snappy and optimized. */
    let lastMinX = -1;
    let lastMaxX = -1;
    function render() {
        /* Set to zero for production */
        const test_margin = 0;

        /* Calculate visible subregion within container rect
         * Simplifying assumption: We are visible anywhere within the viewport.
         */
        let containerRect = container.getBoundingClientRect();
        let minX = Math.max(test_margin, containerRect.left);
        let maxX = Math.min(window.innerWidth - test_margin, containerRect.right);
        let width = maxX - minX;
        let height = containerRect.height;


        /* Don't redraw unless there are changes. */
        if (minX == lastMinX && maxX == lastMinX && !dirty) {
            return;
        }

        lastMinX = minX;
        lastMaxX = maxX;
        dirty = false;

        cv.style.width = (width) + "px";
        cv.style.left = (minX - containerRect.left) + "px";

        if (maxX - minX < 10) {
            cv.style.display = "none";
            return;
        } else {
            cv.style.display = "inline";
        }

        /* Set up canvas */
        const ctx = cv.getContext("2d");
        cv.width = width;
        cv.height = height;
        ctx!.clearRect(0, 0, cv.width, cv.height);

        if (!shown) {
            return;
        }

        /* Calculate time region (percentage) on display */
        let minP = (minX-containerRect.left)/containerRect.width;
        let maxP = (maxX-containerRect.left)/containerRect.width;
        let dP = maxP - minP;

        /* Calculate LOD to achieve 1 pixel per sample */
        let lod = 0;
        /* length - 1 because there is no point in checking the final LOD
         * if we eliminated all the lods before it.
         */
        for (; lod < data.channelLODs[0].length-1; lod++) {
            if (data.channelLODs[0][lod].length * dP < width * 4) {
                break;
            }
        }

        /* Select sample regions, draw. */
        let channels = data.channelLODs.map(channel => channel[lod]);
        let samples = channels[0].length;
        let startSample = Math.floor(minP * samples);
        let endSample   = Math.floor(maxP * samples);
        let samplesShown = endSample - startSample;

        ctx!.beginPath();
        ctx!.strokeStyle=wavecol;
        for (let i = startSample; i < endSample; i++) {
            let px = (i - startSample)/samplesShown;
            let py = 0;
            for (let j = 0; j < channels.length; j++) {
                py += channels[j][i]/(channels.length * data.peaks[j]);
            }
            let x = px * width;
            let y = (py * 0.5 * 0.95 + 0.5) * height;
            if (i == 0) {
                ctx!.moveTo(x, y);
            } else {
                ctx!.lineTo(x, y);
            }
        }
        ctx!.stroke();
    }

    let dragging = false;

    async function handleDrop(e : DragEvent) {
        if (allowdrop) {
            let files = await handleDropEvent(e);

            dispatch("filesDragged", {
                files
            });

            dragging = false;
        }
    }
    function handleDragover(e : Event) {
        if (allowdrop) {
            e.preventDefault();
        }
    }
    function handleDragEnter() {
        if (allowdrop) {
            dragging = true;
        }
    }
    function handleDragLeave() {
        if (allowdrop) {
            dragging = false;
        }
    }
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
    on:drop={handleDrop}
    on:dragover={handleDragover}
    on:dragenter={handleDragEnter}
    on:dragleave={handleDragLeave}
    bind:this={container} class="waveform" style={$$props.style} style:left={start + "px"} style:height={"100px"} style:width={length + "px"} >
    <canvas class="waverender" bind:this={cv} style:background-color={current_bgcol}>

    </canvas>
</div>
<style>
    .waverender {
        position:relative;
        height:100%;
    }
    .waveform {
        height:100%;
    }
</style>