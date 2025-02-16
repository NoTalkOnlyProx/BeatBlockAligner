<script lang="ts">
    import BbLevelEditor from "./BBLevelEditor.svelte";
    import TimelineZone from "./TimelineZone.svelte";
    let dragging = false;
    let dragbase = 0;
    let centerbase = 0;
    export let zoom = 2;
    export let center = 50;
    let zone : HTMLElement;

    function globalToLocal(t : number) {
        return ((t - center)/100) * zoom + 0.5;
    }

    function localToGlobal(lt : number) {
        return (lt - 0.5) / zoom * 100 + center;
    }

    function mouseToGlobal(x : number) {
        let r = zone.getBoundingClientRect();
        return (x - r.x)/r.width * 100;
    }

    function onMouseWheel(e : WheelEvent) {
        zoomOn(-e.deltaY/240, mouseToGlobal(e.clientX));
    }

    function zoomOn(amount : number, zcenter : number) {
        let origin = globalToLocal(zcenter)
        let og = localToGlobal(origin);
        zoom *= Math.pow(2, amount);
        let ng = localToGlobal(origin);
        center -= ng - og;
    }

    export function onDragEnd(e : MouseEvent) {
        dragging = false;
        e.preventDefault();
    }

    function onDragStart(e : MouseEvent) {
        dragging = true;
        dragbase = mouseToGlobal(e.clientX);
        centerbase = center;
        e.preventDefault();
    }
    
    export function onDrag(e : MouseEvent) {
        if (dragging) {
            center = centerbase + (mouseToGlobal(e.clientX) - dragbase);
            e.preventDefault();
        }
    }

</script>
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
    bind:this={zone}
    on:wheel={onMouseWheel}
    on:mousedown={onDragStart}
    on:mouseup={onDragEnd}
    on:mousemove={onDrag}
    class="minimapcontainer"
    >
    <TimelineZone zoom={zoom} fixed style="width:100%; height:100%">
        <div style="background-color:yellow;width:10cqw;height:1px;left:10cqw;top:1px"></div>
        <div style="background-color:yellow;width:10cqw;height:1px;left:20cqw;top:2px"></div>
        <div style="background-color:yellow;width:10cqw;height:1px;left:10cqw;top:3px"></div>
        <div style="background-color:yellow;width:10cqw;height:1px;left:40cqw;top:4px"></div>
        <div style="background-color:yellow;width:10cqw;height:1px;left:10cqw;top:5px"></div>
        <div style="background-color:yellow;width:10cqw;height:1px;left:60cqw;top:6px"></div>
        <div style="background-color:yellow;width:10cqw;height:1px;left:10cqw;top:7px"></div>
        <div
            class="zoombox"
            style:width={(100/zoom)+"cqw"}
            style:left={(center - 50/zoom) + "cqw"}
        ></div>
    </TimelineZone>
</div>
<style>
    .zoombox {
        top:0px;
        height:100%;
        display:block;
        box-sizing: border-box;
        border-style: solid;
        border-width: 3px;
        border-color: white;
    }
    .minimapcontainer {
        background-color: #7e5180;
        width:100%;
        height:100%;
        display:block;
        box-sizing: border-box;
    }
</style>