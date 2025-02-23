<script lang="ts">
import { createEventDispatcher } from 'svelte';
const dispatch = createEventDispatcher();
export let value : null | number | string = "0";
let internalValue : string = "0";
let checked = false;

$: setValue(value);

function onChange() {
    value = checked ? parseFloat(internalValue) : null;
    dispatch("change", value);
}

export function setValue(nValue : (number | string | null)) {
    if (nValue != null) {
        nValue = parseFloat(nValue + "").toFixed(2).replace(".00","");
    }
    if (nValue === null) {
        checked = false;
    } else {
        checked = true;
        internalValue = nValue;
    }
    value = nValue;
}

</script>
<label class="rail">
    <slot/>
    <input type="checkbox" bind:checked={checked} on:change={onChange}/>
    {#if checked}
        <input type="number" bind:value={internalValue} style={$$props.style} on:change={onChange}/>
    {/if}
</label>

<style>
    .rail {
        display: flex;
    }
</style>