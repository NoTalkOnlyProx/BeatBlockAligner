
import type { BBSetsBPMEvent } from '../core/BBTypes';
import type { BBTimelineEvent } from '../core/BBTimeLine';

/* Wrap angle from -180 to 180 */
export function wrapAngle(ang : number) {
    /* This magic deals with negative inputs */
    ang = (360 + ang%360)%360;
    if (ang > 180) {
        ang -= 360;
    }
    return ang;
}

export function getUniquePropSet(events : BBTimelineEvent[]) {
    let propset = ["type", "time", "bpm"];
    let candidates = ["duration", "speedMult", "angle2", "endAngle", "tap"];

    /* Guarantee no more than the first 10 are unique. Sorry! */
    let uncleared = events.slice(0, 10);

    while(uncleared.length > 0) {
        let next = uncleared.shift();
        for (let other of uncleared) {
            if (checkEquality(next!, other, propset)) {
                /* Two elements are not distinct, find the first unique prop between them,
                 * chuck it in.
                 */
                let nextProp = findUniqueProp(next!, other, candidates);
                if (nextProp) {
                    propset.push(nextProp);
                    candidates = candidates.filter(prop => prop != nextProp);
                }
            }
        }
    }
    
    return propset;
}

/* I am getting weird performance issues with this,
 * might just be correlation, but I have started seeing long CC slices, and I suspect it is due
 * to how many random objects this creates during its operation.
 * 
 * I have rewritten it to be a bit more efficient, but I may remove altogether.
 */
function findUniqueProp(a : BBTimelineEvent, b : BBTimelineEvent, candidates : string[]) : string | undefined {
    for (let prop of candidates) {
        //@ts-ignore
        if (a.event[prop] != b.event[prop]) {
            return prop;
        }
    }
    for (let prop in a.event) {
        //@ts-ignore
        if (a.event[prop] != b.event[prop]) {
            return prop;
        }
    }
    for (let prop in b.event) {
        //@ts-ignore
        if (a.event[prop] != b.event[prop]) {
            return prop;
        }
    }
    return undefined;
}

function checkEquality(a : BBTimelineEvent, b : BBTimelineEvent, propset : string[]) {
    for (let prop of propset) {
        //@ts-ignore
        if (a.event[prop] != b.event[prop]) {
            return false;
        }
    }
    return true;
}

export function getEventDescription(event : BBTimelineEvent, index = -1, props=["type", "bpm"]) {
    let type = event.event.type;
    let bpmtext = "";

    if (props.includes("bpm") && "bpm" in event.event) {
        let bpm = (event.event as (BBSetsBPMEvent))?.bpm ?? null;
        if (bpm !== null) {
            bpmtext = `(bpm->${bpm.toFixed(2)}) `;
        }
    }

    let idxtext = (index===-1) ? "":`[${index}] `;

    /* Append any special conditional props that don't have builtin formatting */
    let extraText = "";
    for (let prop of props) {
        if (["bpm", "time", "type"].includes(prop)) {
            continue;
        }
        if (prop in event.event) {
            //@ts-ignore
            extraText += ` (${prop}:${event.event[prop]})`;
        }
    }
    return `${idxtext}${type}: ${bpmtext}(ang: ${event.event.angle?.toFixed(1)}) (beat: ${event.event.time})${extraText}`;
}