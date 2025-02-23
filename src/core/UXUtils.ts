import type { BBTimelineEvent } from "./BBTimeLine";

export function isScrollSpecial(event : MouseEvent, ignoreCtrl = false) {
    return event.button != 0 || (event.ctrlKey && !ignoreCtrl);
}

export function pixelsToRel(px : number, zoom : number, center : number) {
    return (px / window.innerWidth - 0.5) * 100/zoom + center;
}

export function relToPixels(rel : number, zoom : number, center : number) {
    return (((rel - center) * zoom/100) + 0.5) * window.innerWidth;
}

/* newly intrudced "relPixels" is just rel, but measured in pixels deviation from rel = 0 */
export function relToRelPixels(rel : number, zoom : number) {
    return rel * (zoom/100) * window.innerWidth;
}

export function relPixelsToRel(rpx : number, zoom : number) {
    return (rpx/window.innerWidth) * (100/zoom);
}


export const eventIcons : {[index: string] : string} = {
    play                : "assets/play.png",
    width               : "assets/width.png",
    showresults         : "assets/showresults.png",
    setColor            : "assets/setcolor.png",
    setBgColor          : "assets/setbgcolor.png",
    outline             : "assets/outline.png",
    tag                 : "assets/tag.png",
    deco                : "assets/deco.png",
    extratap            : "assets/extratap.png",
    paddlecount         : "assets/paddlecount.png",
    hom                 : "assets/mirror.png",
    ease                : "assets/ease.png",
    noise               : "assets/noise.png",
    bookmark            : "assets/bookmark.png",
    setbpm              : "assets/setbpm.png",
    forcePlayerSprite   : "assets/forceplay.png",
    setBoolean          : "assets/setboolean.png",
    paddle              : "assets/paddle.png",
    playSound           : "assets/playsound.png",
    toggleParticles     : "assets/particles.png",

    block               : "assets/square.png",
    extraTap            : "assets/extratap.png",
    hold                : "assets/hold.png",
    inverse             : "assets/inverse.png",
    mine                : "assets/mine.png",
    mineHold            : "assets/mineHold.png",
    side                : "assets/side.png",
    trace               : "assets/trace.png",

    /* This forces me to handle invalid icons */
    BADBAD               : "baaaad",

    genericEvent        : "assets/genericevent.png"
}

const iconCache : Map<string, HTMLImageElement> = new Map();
export async function preloadIcons() {
    await Promise.all(Object.keys(eventIcons).map(icon => {
        let img = new Image();
        return new Promise<void>((resolve) => {
            img.addEventListener('load', ()=> {
                resolve();
                iconCache.set(icon, img);
            });
            img.addEventListener('error', (event)=> {
                resolve();
            });
            img.src = eventIcons[icon];
        });
    }));
}

export function getIcon(icon : string) {
    return iconCache.get(icon) ?? iconCache.get("genericEvent");
}

export function getEventIconName(event : BBTimelineEvent) {
    if (iconCache.has(event.event.type)) {
        return event.event.type;
    }
    return "genericEvent";
}
