<script lang="ts">
    export let fixed = false;
    export let zoom = 0;
    export let center = 0;
    export let control = false;
    let container : HTMLElement;

    /* These are NOT duplicates of the same functions in BBMiniMap. */

    
    function globalToLocal(t : number) {
        return ((t - center)/100) * zoom + 0.5;
    }

    function localToGlobal(lt : number) {
        return (lt - 0.5) / zoom * 100 + center;
    }

    
    function mouseToLocal(x : number) {
        let r = container.getBoundingClientRect();
        return (x - r.x)/r.width;
    }
    
    
    function onMouseWheel(e : WheelEvent) {
        if (!control) {
            return;
        }
        
        if(e.ctrlKey || e.shiftKey)
        {
            zoomOn(-e.deltaY/240, mouseToLocal(e.clientX));
            e.preventDefault();
        }
        center += (e.deltaX/20)/zoom;
    }

    function zoomOn(amount : number, zcenter : number) {
        let og = localToGlobal(zcenter);
        zoom *= Math.pow(2, amount);
        let ng = localToGlobal(zcenter);
        center -= ng - og;
    }
</script>
<div bind:this={container} style={$$props.style} class="tzcontainer" on:wheel={onMouseWheel}>
    <div class="tzdomain"
        style:width={fixed ? "100%" : ((zoom * 100) + "vw")}
        style:left={fixed ? "0px" : ((50 - center * zoom) + "vw")}>
        <slot />
    </div>
</div>
<style>
    .tzcontainer {
        overflow: auto;
        display: block;
        overflow-x: hidden;
        box-sizing: border-box;
    }
    .tzdomain {
        height:100%;
        transform-origin: top left;
        position: relative;
        display: block;
        container-name: timeline;
        container-type: inline-size;
        box-sizing: border-box;
    }
    :global(.tzdomain > *) {
        position: absolute;
        display: block;
        box-sizing: border-box;
    }
</style>