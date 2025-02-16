<script lang="ts">
import { createEventDispatcher } from 'svelte';
const dispatch = createEventDispatcher();
export let value : number | null = 0;
let internalValue = 0;
let checked = false;

setValue(value);

function onChange() {
    value = checked ? internalValue : null;
    dispatch("change", value);
}

export function setValue(nValue : (number | null)) {
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