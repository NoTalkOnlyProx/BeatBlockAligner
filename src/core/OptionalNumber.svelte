<script lang="ts">
import { createEventDispatcher } from 'svelte';
const dispatch = createEventDispatcher();
export let value : null | number | string = "0";

/* if "always" is true, then this is NOT an optional number.
 * Yes, I ought to use just a normal input, then,
 * but that would require refactoring some other areas I am not keen on refactoring ATM.
 * This is an acceptable level of spaghetti code for the time it saves (for now).
 */
export let always : boolean = false;
let internalValue : string = "0";
let checked = false;

$: setValue(value);

function onChange() {
    value = checked ? parseFloat(internalValue) : null;
    dispatch("change", value);
}

export function setValue(nValue : (number | string | null)) {
    if (always) {
        nValue ??= 0;
    }

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
    {#if !always}
    <input type="checkbox" bind:checked={checked} on:change={onChange}/>
    {/if}
    {#if checked || always}
        <input class:always={always} type="number" bind:value={internalValue} style={$$props.style} on:change={onChange}/>
    {/if}
</label>

<style>
    .rail {
        display: flex;
    }
    input.always {
        margin-left: 5px;
    }
</style>