<script lang="ts">
    import BBLevelEditor from "src/core/BBLevelEditor.svelte";
    import { BBLevelLoader } from "src/core/BBLevelLoader";
    import BBLevelSelector from "src/core/BBLevelSelector.svelte";

    let warning = parseInt(localStorage.getItem('warningSnooze') ?? "0") < Date.now();
    let hasUploaded = false;
    let bbll : BBLevelLoader;
    let credits = false;

    function handleLoaded(event : CustomEvent) {
        bbll = event.detail;
        hasUploaded = true;
    }

    function clearWarning() {
        warning = false;
        /* Snooze it for 3 days */
        localStorage.setItem('warningSnooze', `${Date.now() + 3 * 24 * 60 * 60 * 1000}`);
    }

    function clearCredits() {
        credits = false;
    }

    function showWarning() {
        warning = true;
        credits = false;
    }

    function reportBug() {
        window.open("https://github.com/NoTalkOnlyProx/BeatBlockAligner/issues/new?template=bug_report.md", '_blank')?.focus();
    }
    
    function showCredits() {
        credits = true;
        warning = false;
    }

    function showCreditsSC() {
        showCredits();
        window.open("https://soundcloud.com/notalkonlyprox", '_blank')?.focus();
    }

    function showCreditsSource() {
        showCredits();
        window.open("https://github.com/NoTalkOnlyProx/BeatBlockAligner", '_blank')?.focus();
    }

</script>
{#if credits}
    <div class="center">
        <div class="box">
            <div class="creditline">
                <div class="credhead">Source Code:</div> <div class="credend"><a href="https://github.com/NoTalkOnlyProx/BeatBlockAligner">On github</a></div>
            </div>
            <div class="creditline">
                <div class="credhead">Programming:</div><div class="credend">NTOP: (<a href="https://bsky.app/profile/notalkonlyprox.bsky.social">BlueSky</a>, <a href="https://soundcloud.com/notalkonlyprox"><span class="sc">soundcloud</span></a>)</div> 
            </div>
            <div class="creditline">
                <div class="credhead">Testing & Custom Icons:</div><div class="credend">Monkeygogobeans</div>
            </div>
            <button class="acknowledge" on:click={clearCredits}>
                Close
            </button>
        </div>
    </div>
{/if}
{#if warning}
    <div class="center">
        <div class="box">
            <h1>Heads up!</h1>
            This is a public beta -- I haven't had a chance to fully test everything.
            <br/>
            If you encounter bugs, please use the bug report button!
            <br/>
            <h1><a href="https://www.youtube.com/watch?v=dQw4w9WgXcQ" target="_blank">Tutorial here</a></h1>
            <button class="acknowledge" on:click={clearWarning}>
                OK
            </button>
        </div>
    </div>
{:else}
    {#if !hasUploaded}
    <BBLevelSelector on:loaded={handleLoaded}></BBLevelSelector>
    {:else}
        <BBLevelEditor bind:bbll></BBLevelEditor>
    {/if}
{/if}

<div class="footer">
    <button on:click={showWarning}>
        Show Help
    </button>
    <button on:click={reportBug}>
        Report a bug
    </button>
    <button on:click={showCredits}>
        Credits
    </button>
    <button on:click={showCreditsSource}>
        Source Code
    </button>
    <button on:click={showCreditsSC}>
        <div>Want to support me? Check out my <span class="sc">soundcloud</span></div>
    </button>
</div>

<style>
    @import "../global.css";
    .box {
        background-color: var(--highlight-bg-color);
        color: var(--highlight-text-color);
        padding: 2vw;
        outline-color: var(--highlight-text-color);
        outline-width: 5px;
        outline-style: solid;
        text-align: center;
        font-size: 2vw;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
    }
    .creditline {
        display: flex;
        justify-content: space-between;
        gap: 20vw;
        width: 100%;
    }
    .credhead {
        text-align: left;
    }
    .credend {
        text-align: left;
    }
    .footer {
        z-index: 1000;
        width: 100%;
        position: absolute;
        bottom: 0px;
        box-sizing: border-box;
        pointer-events: none;
    }
    .center {
        display: flex;
        justify-content: center;
        align-items: center;
        flex-direction: column;
        width: 100%;
        height: 100%;
    }
    .footer > * {
        text-wrap: nowrap;
        pointer-events: auto;
    }
    a:hover {
        color: var(--highlight-text-color-hover);
    }
    a > .sc {
        background-color: var(--main-text-color);
    }
    a > .sc:hover {
        background-color: var(--highlight-text-color-hover);
    }
    .acknowledge {
        font-size: 2vw;
        padding: 0.5vw;
        min-width: 20vw;
    }
    button {
        background-color: var(--main-input-bg);
    }
    button:hover {
        background-color: var(--main-input-bg-highlight);
    }
    button:active {
        background-color: var(--main-input-bg-active);
    }
    .sc {
        height: 1em;
        width: 8.888em;
        mask-image: url(/dist/assets/soundcloud5.svg);
        color: transparent;
        background-color: white;
        display:inline-block;
        position:relative;
        top:0.07em;
    }

    </style>