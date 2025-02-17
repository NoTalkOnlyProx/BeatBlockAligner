export function isScrollSpecial(event : MouseEvent) {
    return event.button != 0 || event.ctrlKey;
}

export function mouseToRel(mouseX : number, lane: HTMLElement) : number {
    let laneRect = lane.getBoundingClientRect();
    return (mouseX - laneRect.x)/laneRect.width * 100;
}

export function mouseDeltaToRel(dx : number, zoom: number) {
    return (dx / window.innerWidth) * 100/zoom;
}

/* I could base this on mouseDeltaToRel but that makes it less readable */
export function mouseToRelNumeric(mouseX : number, zoom : number, center : number) {
    return (mouseX / window.innerWidth - 0.5) * 100/zoom + center;
}

export function relToMouseNumeric(rel : number, zoom : number, center : number) {
    return (((rel - center) * zoom/100) + 0.5) * window.innerWidth;
}