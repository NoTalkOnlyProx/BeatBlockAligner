export function isScrollSpecial(event : MouseEvent) {
    return event.button != 0 || event.ctrlKey;
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
