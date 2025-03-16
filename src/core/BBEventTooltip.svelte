<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import type { BBTimelineEvent } from "./BBTimeLine";
    import { getEventDescription, preventNavDrag } from "./UXUtils";

    export let tooltipEvents : BBTimelineEvent[];
    export let x = 0;
    export let y = 0;
    export let choosing : boolean = false;
    
    const dispatch = createEventDispatcher();
    function selectControl(event : BBTimelineEvent) {
        dispatch("select", event);
    }
</script>
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
    class="tooltip"
    on:mousedown={preventNavDrag}
    style:left={(x + 20) + "px"} style:top={y + "px"}>
    {#each tooltipEvents as event,i}
        <button
            class="ttevent" class:bright={i%2==0} class:clickable={choosing}
            on:click={(e)=>selectControl(event)}
        >
            {getEventDescription(event)}
        </button>
    {/each}
</div>
<style>
    .tooltip {
        pointer-events: none;
        position:fixed;
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
        pointer-events: auto;
    }

    .ttevent.clickable:hover {
        background-color: var(--tooltip-color-hover)
    }
</style>