import { wrapAngle } from "src/utils/BBUtils";
import type { BBVariantFiles } from "./BBLevelLoader";
import type { BBDurationEvent, BBEvent, BBPlayEvent, BBSetsBPMEvent } from "./BBTypes";
import {EventEmitter} from 'eventemitter3';

/* For whatever reason, no types created for this. */
//@ts-ignore
import lzjs from 'lzjs';

export interface BBTimelineEvent {
    event : BBEvent;
    fromChart : boolean;

    /* Careful! These are only set for time-control events! */
    realbeat? : number;
    skipped? : boolean;
}


/* ChangeOffset appears to be dev only, and I am happy to leave it as such for now. Sorry! */
const timeControlTypes = ["play", "setBPM", "showResults"];

const markerTypes = ["bookmark"];

function sortEvents(events : BBEvent[]) {
    events.sort((a, b) => (a?.time ?? 0) - (b?.time ?? 0));
}

function sortTimelineEventsRealBeat(events : BBTimelineEvent[]) {
    events.sort((a, b) => (a?.realbeat ?? 0) - (b?.realbeat ?? 0));
}

function sortTimelineEvents(events : BBTimelineEvent[]) {
    events.sort((a, b) => (a?.event.time ?? 0) - (b?.event.time ?? 0));
}

/* A point on a Time/Beat monotonic function */
export type TimeBeatPoint = {
    t: number;
    b: number;
    bpm: number;
}

export type BBTimelinePreserveMode = "KeepBeats" | "KeepTimes" | "KeepTimesAfter";
export interface BBTimelineEventInitialState {
    event : BBTimelineEvent;
    originalTime : number;
    originalBeat : number;
    originalBPM : number;
    originalDuration? : number;
}


export interface BBTimelineOperationParams {
    /* Settings */
    pmode : BBTimelinePreserveMode;
    snap? : boolean;
    leftDominant? : boolean;
    preserveLength? : boolean;
    snapGrid? : number;
    mustSave? : boolean;


    /* Possible Targets */
    targetControl?: BBTimelineEvent;
    targetTick?: number;
    targetTickOriginalTime?: number;
    staticSelection? : BBSelectionPoint[];
    leftTime? : number;
    rightTime? : number;
}

export interface BBTimelineOperationState extends  BBTimelineOperationParams {
    /* Individual initial event states */
    initialState : Map<BBTimelineEvent, BBTimelineEventInitialState>;

    /* Initial state of control and next control, if existing / relevant */
    controlInitialState?: BBTimelineEventInitialState;
    nextControlInitialState?: BBTimelineEventInitialState;

    /* The timespace mapping before attempting operation */
    initialMapping?: TimeBeatPoint[];

    /* A timespace mapping based on all time control events prior to the target control */
    entryMapping?: TimeBeatPoint[];

    /* Is the applied change significant enough to warrant an undo save? */
    changeSignificant?: boolean;
}


/* These are fully implicit from directly observable variables, but I want to change to having
 * them in these terms for easier reckoning with the timespace establishment.
 */
export interface BBStartData {
    trueFirstBeat : number;
    loadBeat : number;
    performLoad : boolean;
}

export interface BBTimelineUndoPoint {
    time: number;
    type: string;
    levelData: string;
    chartData: string;
}

export interface BBSelectionPoint {
    event : BBTimelineEvent;
    tail: boolean;
    other? : BBSelectionPoint;
}

/* These callbacks allow external modules to make event-like objects affected by timeline transforms.
 * Mainly this exists just for the Event Editor's event handles, since they aren't really events,
 * and the timeline has no business knowing what they are, but they need to update in response to
 * timeline alterations as if they were events.
 */
export type BBTimelineApplyOpTimeCallback = (time : number) => {time : number, beat : number};
export type BBTimelineApplyOpBeatCallback = (beat : number) => {time : number, beat : number};
export type BBTimelineApplyKeepBeatLogic = (otime : number, obeat : number) => boolean;

export class BBTimeLine  extends EventEmitter  {
    variant : BBVariantFiles;
    timeControlEvents : BBTimelineEvent[] = [];
    markerEvents : BBTimelineEvent[] = [];
    staticEvents : BBTimelineEvent[] = [];
    allEvents : BBTimelineEvent[] = [];
    lookup : Map<BBEvent, BBTimelineEvent> = new Map();
    mapping : TimeBeatPoint[] = [];
    undoHistory : BBTimelineUndoPoint[] = [];
    undoIndex : number = -1;
    canUndo = false;
    canRedo = false;

    startTimes : BBStartData | undefined = undefined;

    /* Dynamically updated version of firstBeat/lastBeat.
     * Not used for timespace establishment
     */
    latestLastBeat : number = 0;
    latestFirstBeat : number = 0;

    /* These are never updated after first load,
     * they just establish the baseline time transform, but users are free to move things well
     * outside this range.
     */
    firstBeat : number = 0;
    lastBeat : number = 0;
    firstTime : number = 0;
    lastTime : number = 0;

    constructor(variant : BBVariantFiles) {
        super();
        this.variant = variant;
        this.firstBeat = 0;
        this.lastBeat = 0;
        this.loadEvents(true);
        this.saveUndoPoint("initial", false);
        this.firstTime = this.beatToTime(this.firstBeat);
        this.lastTime = this.beatToTime(this.lastBeat);
    }

    loadEvents(computeBoundaries : boolean = false) {
        let level = this.variant.level;
        let chart = this.variant.chart;
        
        this.timeControlEvents = [];
        this.markerEvents = [];
        this.staticEvents = [];
        this.allEvents = [];
        this.lookup = new Map();

        /* Sort in place */
        sortEvents(level.events);
        sortEvents(chart);


        /* Aggregate / categorize events. */
        for (let event of level.events) {
            this.registerEvent(event, false, computeBoundaries);
        }
        for (let event of chart) {
            this.registerEvent(event, true, computeBoundaries);
        }

        this.recomputeTimeSpace();

        console.log("Finished loading BBTimeLine", this);
    }

    getControlAfter(event : BBTimelineEvent | undefined | null) {
        /* Typescript doesn't like it, but indexOfNull will give -1, and our nullish accessor will
         * handle that just fine.
         */
        return this.timeControlEvents?.[this.timeControlEvents.indexOf(event!) + 1];
    }

    /* Assumes events are sorted chronologically. */
    getLastBeforeBeat(events : BBTimelineEvent[], beat : number) : BBTimelineEvent | null {
        /* not sure why I bothered with binary search on the other impl, but I sure as hell won't be here... */
        let last : BBTimelineEvent | null = null;
        for (let event of events) {
            if (event.event.time > beat) {
                break;
            }
            last = event;
        }
        return last;
    }

    getEventsNearTimeAndAngle(events : BBTimelineEvent[], time : number, threshold : number,
                              angle: number, intersect = false, wrapDelta = false,
                              angthresh : number = 10) {
        let fevents = this.getEventsNearTime(events, time, threshold, intersect);
        return fevents.filter(ev => {
            let delta = (wrapAngle(ev.event.angle ?? 0)) - angle;
            if (wrapDelta) {
                delta = wrapAngle(delta)
            }
            return Math.abs(delta) < angthresh;
        });
    }

    /* Assumes events are sorted chronologically. */
    getEventsNearTime(events : BBTimelineEvent[], time : number, threshold : number, intersect = false) : BBTimelineEvent[] { 
        let earliestTime = time - threshold/2;
        let latestTime = time + threshold/2;     
        return this.getEventsInTimeRange(events, earliestTime, latestTime, intersect);
    }

    getEventsInTimeRange(events : BBTimelineEvent[], ta : number, tb: number, intersect = false) : BBTimelineEvent[] {
        let results : BBTimelineEvent[] = [];
        for (let event of events) {
            let eTimeA = this.beatToTime(event.event.time);
            let eTimeB = eTimeA;
            if (intersect && "duration" in event.event) {
                let dev = event.event as BBDurationEvent;
                eTimeB = this.beatToTime(dev.time + dev.duration);
            }

            if (eTimeB < ta) {
                continue;
            }
            if (eTimeA > tb) {
                break;
            }

            results.push(event);
        }
        return results;
    }


    /* Recompute the time mapping implied by current time-control events. */
    recomputeTimeSpace() {
        this.mapping = this.computeTimeSpace();
    }

    /* Compute true values for critical initial constants. */
    computeStartData() : BBStartData {
        let level = this.variant.level;
        let offset = level.properties.offset ?? 0;
        let trueFirstBeat = level.properties.startingBeat ?? -offset;
        let loadBeat = level.properties.loadBeat ?? 0;
        let performLoad = (!!level.properties.loadBeat) && (trueFirstBeat < 0);
        this.startTimes = {
            trueFirstBeat,
            loadBeat,
            performLoad
        }
        return this.startTimes;
    }

    computeTimeSpace(finalEvent : BBEvent | undefined = undefined, tces : BBTimelineEvent[] | undefined = undefined) : TimeBeatPoint[] {
        let startData = this.computeStartData();
        let currentBPM = 100;
        let controls : BBTimelineEvent[] = tces ?? this.timeControlEvents;

        let newLatestFirstBeat = startData.trueFirstBeat;
        let newLatestLastBeat = startData.trueFirstBeat;

        /* If we are not overriding the events array used, we are modifying the class state */
        let modifyInPlace = !tces;
        
        /* Sort events into those that are preloaded, and those that are not */
        let preloadEvents : BBTimelineEvent[] = [];
        let realEvents : BBTimelineEvent[] = [];
        for (let event of controls) {
            event.skipped = false;
            if (startData.performLoad && (event.event.time < startData.loadBeat)) {
                event.realbeat = startData.trueFirstBeat;
                preloadEvents.push(event);
            } else {
                event.realbeat = event.event.time;
                realEvents.push(event);
            }
        }

        if (modifyInPlace) {
            sortTimelineEventsRealBeat(this.timeControlEvents);
            for (let event of controls) {
                newLatestFirstBeat = Math.min(newLatestFirstBeat, event.realbeat ?? 0);
                newLatestFirstBeat = Math.min(newLatestFirstBeat, event.event.time);
                newLatestLastBeat = Math.max(newLatestLastBeat, event.realbeat ?? 0);
                newLatestLastBeat = Math.max(newLatestLastBeat, event.event.time);
            }
            this.latestLastBeat = newLatestLastBeat;
            this.latestFirstBeat = newLatestFirstBeat;
        }

        sortTimelineEventsRealBeat(preloadEvents);
        sortTimelineEventsRealBeat(realEvents);

        /* Preload events all execute immediately on the true initial beat */
        for (let event of preloadEvents) {
            currentBPM = (event.event as BBSetsBPMEvent).bpm ?? currentBPM;
        }

        /* Begin generating mapping */
        /* preAnchor establishes the BPM prior to all events. */
        let preAnchor : TimeBeatPoint = {b:(startData.trueFirstBeat-1), t:-60/currentBPM, bpm:currentBPM};
        let lastPoint : TimeBeatPoint  = {b:startData.trueFirstBeat, t:0, bpm:currentBPM};
        let nmapping = [preAnchor, lastPoint];
        for (let event of realEvents) {
            if (event.event === finalEvent) {
                break;
            }

            /* Anything which is neither preloaded nor after the true first beat simply doesn't have an effect */
            if ((event.realbeat ?? 0) < startData.trueFirstBeat) {
                event.skipped = true;
                continue;
            }
            
            if ((event.realbeat ?? 0) > lastPoint.b) {
                let bdelta = (event.realbeat ?? 0) - lastPoint.b;
                let tdelta = bdelta/currentBPM * 60.0;
                lastPoint = {
                    b: lastPoint.b + bdelta,
                    t: lastPoint.t + tdelta,
                    /* We will update this in the next step, don't worry. */
                    bpm: currentBPM,
                };
                nmapping.push(lastPoint);
            }

            /* All timeline-control events work by optionally setting BPM. */
            currentBPM = (event.event as BBSetsBPMEvent).bpm ?? currentBPM;
            lastPoint.bpm = currentBPM;
        }

        /* Add one final point to establish the last BPM determined. */
        let postAnchor = {b:(lastPoint.b+1), t:lastPoint.t+60/currentBPM, bpm:currentBPM};
        nmapping.push(postAnchor);

        if (modifyInPlace) {
            /* Accessors of staticEvents rely on the assumption it is always chrono-sorted.
             * Guarantee this at all times.
             */
            sortTimelineEvents(this.staticEvents);
        }

        return nmapping;
    }
    
    getStartBeat() {
        /* lol, the builtin levels accidentally use startBeat, but have it set to 0, whereas the
         * editor and game engine use startingBeat.
         * Took me a solid 20 minutes to figure out which one I should use xD
         */
        return this.variant.level.properties.startingBeat ?? null;
    }

    getOffset() {
        return this.variant.level.properties.offset ?? null;
    }

    getLoadBeat() {
        return this.variant.level.properties.loadBeat ?? null;
    }

    setStartBeat(nsb : number | null, save : boolean = true) {
        if (nsb == null) {
            delete this.variant.level.properties.startingBeat;
        } else {
            this.variant.level.properties.startingBeat = nsb;
        }
        this.recomputeTimeSpace();
        if (save) {
            this.saveUndoPoint("startBeat", true);
        }
    }

    setOffset(noff : number | null, save : boolean = true) {
        if (noff == null) {
            delete this.variant.level.properties.offset;
        } else {
            this.variant.level.properties.offset = noff;
        }
        this.recomputeTimeSpace();
        if (save) {
            this.saveUndoPoint("offset", true);
        }
    }

    setLoadBeat(nlb : number | null, save : boolean = false) {
        if (nlb == null) {
            delete this.variant.level.properties.loadBeat;
        } else {
            this.variant.level.properties.loadBeat = nlb;
        }
        this.recomputeTimeSpace();
        if (save) {
            this.saveUndoPoint("loadBeat", true);
        }
    }

    setEventBPM(ev : BBTimelineEvent, nbpm : number | null, pmode : BBTimelinePreserveMode,
           snap : boolean,  snapGrid : number) {
        this.beginTSBPMOperation(ev, pmode, snap, snapGrid);
        this.continueTSBPMOperation(nbpm, snap)
        this.finishTSBPMOperation();
    }


    /* I am not bothering to implement this as a true operation, since it cannot affect
     * anything but the targeted event
     */
    setEventOffset(ev : BBTimelineEvent, nofs : number | null) {
        if (ev.event.type === "play") {
            if (nofs == null) {
                delete (ev.event as BBPlayEvent).offset;
            } else {
                (ev.event as BBPlayEvent).offset = nofs;
            }    
            this.saveUndoPoint("setOffset", true);
        }
    }

    timeToBPM(time : number, mapping : TimeBeatPoint[] = this.mapping) {
        return this.beatToBPM(this.timeToBeat(time, mapping), mapping);
    }

    /* Not used for any timespace calculations, just a convenience function for finding the
     * BPM at a given beat.
     */
    beatToBPM(beat : number, mapping : TimeBeatPoint[] = this.mapping) {
        if (mapping.length == 0) {
            return 60;
        }
        if (mapping.length == 1) {
            /* Even though we have the .bpm property, it isn't used by beatToTime.
             * Return 60 to match beatTotime.
             */
            return 60;
        }
        /* Find index of last point prior to beat.
         * Default to first index if all points after beat.
         * Default to secont-to-last index if all points prior to beat.
         */
        let i = 0;
        for (;i < mapping.length-2; i++) {
            if (mapping[i+1].b > beat) {
                break;
            }
        }
        return mapping[i].bpm;
    }

    tickToBeat(tick : number, snapGrid : number) {
        return tick / snapGrid + (this.startTimes?.trueFirstBeat ?? 0);
    }

    beatToTime(beat : number, mapping : TimeBeatPoint[] = this.mapping) {
        if (mapping.length == 0) {
            return beat;
        }
        if (mapping.length == 1) {
            return (beat - mapping[0].b) + mapping[0].t;
        }
        /* Find index of last point prior to beat.
         * Default to first index if all points after beat.
         * Default to secont-to-last index if all points prior to beat.
         */
        let i = 0;
        for (;i < mapping.length-2; i++) {
            if (mapping[i+1].b > beat) {
                break;
            }
        }
        
        return this.interpolateBeat(mapping[i], mapping[i+1], beat);
    }

    timeToBeat(t : number, mapping : TimeBeatPoint[] = this.mapping) {
        if (mapping.length == 0) {
            return t;
        }
        if (mapping.length == 1) {
            return (t - mapping[0].t) + mapping[0].b;
        }
        /* Find index of last point prior to beat.
         * Default to first index if all points after beat.
         * Default to secont-to-last index if all points prior to beat.
         */
        let i = 0;
        for (;i < mapping.length-2; i++) {
            if (mapping[i+1].t > t) {
                break;
            }
        }
        
        return this.interpolateTime(mapping[i], mapping[i+1], t);
    }

    /* 0 to 100 where 0 is roughly the song start, and 100 is roughly the song end. */
    /* Editor starts out zoomed in on this. */
    timeToRel(t : number) {
        return this.timeToRelDelta(t - this.firstTime);
    }

    relToTime(rt : number) {
        return this.relToTimeDelta(rt) + this.firstTime;
    }

    relToTimeDelta(drt : number) {
        return drt/100 * (this.lastTime - this.firstTime);
    }

    timeToRelDelta(dt : number) {
        return dt/(this.lastTime - this.firstTime) * 100;
    }

    interpolateBeat(a : TimeBeatPoint, b : TimeBeatPoint, beat : number) {
        let p = (beat - a.b)/(b.b - a.b);
        let t = p * (b.t - a.t) + a.t;
        return t;
    }
    interpolateTime(a : TimeBeatPoint, b : TimeBeatPoint, t : number) {
        let p = (t - a.t)/(b.t - a.t);
        let beat = p * (b.b - a.b) + a.b;
        return beat;
    }

    getTimelineEvent(event : BBEvent) {
        return this.lookup.get(event);
    }

    operationState : BBTimelineOperationState | undefined;
    beginOperation(params : BBTimelineOperationParams) {
        /* Make sure we are dealing with up-to-date timespace */
        this.recomputeTimeSpace();

        /* Collect initial state of all events */
        let initialState : Map<BBTimelineEvent, BBTimelineEventInitialState> = new Map();
        for (let event of this.allEvents) {
            let evis : BBTimelineEventInitialState = {
                event,
                originalBeat: event.event.time,
                originalTime: this.beatToTime(event.event.time),
                originalBPM: (event.event as BBSetsBPMEvent).bpm ?? this.beatToBPM(event.event.time),
                originalDuration : (event.event as BBDurationEvent).duration
            }
            initialState.set(event, evis);
        }

        /* Collect time control info if relevant */
        let controlEvent = params.targetControl;
        let nextControlEvent = undefined;

        /* Find nextControlEvent if it exists */
        if (controlEvent) {
            let nextIndex = this.timeControlEvents.indexOf(controlEvent);
            if (nextIndex <= this.timeControlEvents.length - 2) {
                nextControlEvent = this.timeControlEvents[nextIndex + 1];
            }
        }

        /* Grab initial states for targeted special events */
        let controlInitialState = controlEvent ? initialState.get(controlEvent) : undefined;
        let nextControlInitialState = nextControlEvent ? initialState.get(nextControlEvent) : undefined;

        this.operationState = {
            initialState,
            controlInitialState,
            nextControlInitialState,
            entryMapping: this.computeTimeSpace(params.targetControl?.event),
            initialMapping: [...this.mapping],
            ...params
        }
    }

    beginTSStretchOperation(event : BBTimelineEvent, pmode : BBTimelinePreserveMode,
                          snap : boolean,  snapGrid : number, targetTick : number) {
        this.beginTSBPMOperation(event, pmode, snap, snapGrid, {
            targetTick,
            targetTickOriginalTime: this.beatToTime(this.tickToBeat(targetTick, snapGrid))
        });
    }

    beginTSBPMOperation(targetControl : BBTimelineEvent, pmode : BBTimelinePreserveMode,
                      snap : boolean, snapGrid : number, extraParams : Partial<BBTimelineOperationParams> = {}) {
        this.beginOperation({pmode, snap, snapGrid, targetControl, mustSave:true, ...extraParams});
        this.alertBeginOp();
    }

    beginTSMoveOperation(targetControl : BBTimelineEvent, pmode : BBTimelinePreserveMode,
                       snap : boolean, snapGrid : number, mustSave : boolean) {
        this.beginOperation({pmode, snap, snapGrid, targetControl, mustSave});
        this.alertBeginOp();
    }

    beginTSAlterEvents(pmode : BBTimelinePreserveMode = "KeepBeats") {
        this.beginOperation({pmode});
        this.alertBeginOp();
    }

    beginStaticTransformOperation(leftTime : number, rightTime: number,
                                  leftDominant : boolean, snap : boolean, 
                                  preserveLength : boolean,
                                  snapGrid : number, pmode : BBTimelinePreserveMode,
                                  staticSelection: BBSelectionPoint[]) {
        this.beginOperation({
            staticSelection,
            leftTime, rightTime,
            leftDominant, snap, snapGrid, preserveLength,
            /* pmode affects whether the transform is linear in beats or linear in time */
            pmode
        });
        this.alertBeginOp();
    }

    continueStaticTransformOperation(nltime : number, nrtime: number, currentlySnapping : boolean) {
        let opstate = this.operationState!;
        opstate.snap = currentlySnapping;

        opstate.changeSignificant = (nltime != opstate.leftTime) || (nrtime != opstate.rightTime);

        let ltime = opstate.leftTime!;
        let rtime = opstate.rightTime!;

        let lbeat = this.timeToBeat(ltime);
        let rbeat = this.timeToBeat(rtime);
        let nlbeat = this.timeToBeat(nltime);
        let nrbeat = this.timeToBeat(nrtime);

        let beatspace = opstate.pmode === "KeepBeats";

        /* Perform snapping -- kinda complicated */
        /* Ensure either left or right handle is snapped to beat.
         * If preserve the distance between L and R handle if that is enabled.
         * Preservation distance is based on beats if using beatspace, otherwise time.
         */
        let snapGrid = opstate.snapGrid ?? 1;

        if (opstate.leftDominant) {
            if (opstate.snap) {
                /* Snap beat and then recompute time */
                nlbeat = Math.round(nlbeat * snapGrid) / snapGrid;
                nltime = this.beatToTime(nlbeat);
            }
            
            /* Preserve length if desired */
            if (opstate.preserveLength) {
                if (beatspace) {
                    nrbeat = nlbeat + rbeat - lbeat;
                    nrtime = this.beatToTime(nrbeat);
                } else {
                    nrtime = nltime + rtime - ltime;
                    nrbeat = this.timeToBeat(nrtime);
                }
            }
        } else {
            if (opstate.snap) {
                /* Snap beat and then recompute time */
                nrbeat = Math.round(nrbeat * snapGrid) / snapGrid;
                nrtime = this.beatToTime(nrbeat);
            }

            /* Preserve length if desired */
            if (opstate.preserveLength) {
                if (beatspace) {
                    nlbeat = nrbeat + lbeat - rbeat;
                    nltime = this.beatToTime(nlbeat);
                } else {
                    nltime = nrtime + ltime - rtime;
                    nlbeat = this.timeToBeat(nltime);
                }
            }
        }

        /* Construct time remappers */
        let dbeat = rbeat - lbeat;
        let ndbeat = nrbeat - nlbeat;
        let dtime = rtime - ltime;
        let ndtime = nrtime - nltime;

        /* It is possible to select an infinitely thin working area, which if we do nothing about
         * it causes NaN during stretch compute.
         *
         * hypothetically the correct solution is to detect this in the event editor,
         * and then split this off as a special mode, but I kinda prefer just checking the
         * magnitude of the stretch factor denominator and clamping to 1 if we are in a
         * degenerate state, the code is just simpler.
         */
        let scaleFactorBeat = ndbeat/dbeat;
        let scaleFactorTime = ndtime/dtime;
        
        if (Math.abs(dtime) < 0.0000001) {
            scaleFactorBeat = 1;
            scaleFactorTime = 1;
        }

        let apply = (otime : number, obeat : number) => {
            let ntime;
            let nbeat;
            if (beatspace) {
                /* Beatwise linear (preserve beat ratios) */
                nbeat = (obeat - lbeat) * scaleFactorBeat + nlbeat;
                ntime = this.beatToTime(nbeat);
            } else {
                /* Timewise linear (preserve time ratios) */
                ntime = (otime - ltime) * scaleFactorTime + nltime;
                nbeat = this.timeToBeat(ntime);
            }
            return {time: ntime, beat: nbeat};
        }
        let applyTime : BBTimelineApplyOpTimeCallback = (otime : number) => {
            return apply(otime, this.timeToBeat(otime, opstate.initialMapping));
        }
        let applyBeat : BBTimelineApplyOpBeatCallback = (obeat : number) => {
            return apply(this.beatToTime(obeat, opstate.initialMapping), obeat);
        }

        this.remapStaticEvents(applyTime, applyBeat);
    }

    quantizeStaticEvents(snapGrid : number, staticSelection: BBSelectionPoint[]) {
        this.beginOperation({pmode:"KeepBeats", staticSelection})

        let opstate = this.operationState!;
        let apply = (otime : number, obeat : number) => {
            let nbeat = Math.round(obeat * snapGrid)/snapGrid
            let ntime = this.beatToTime(nbeat);
            return {time: ntime, beat: nbeat};
        }
        let applyTime : BBTimelineApplyOpTimeCallback = (otime : number) => {
            return apply(otime, this.timeToBeat(otime, opstate.initialMapping));
        }
        let applyBeat : BBTimelineApplyOpBeatCallback = (obeat : number) => {
            return apply(this.beatToTime(obeat, opstate.initialMapping), obeat);
        }
        
        this.remapStaticEvents(applyTime, applyBeat);

        this.saveUndoPoint("quantize", false);
    }

    remapStaticEvents(applyTime : BBTimelineApplyOpTimeCallback, applyBeat : BBTimelineApplyOpBeatCallback) { 
        let opstate = this.operationState!;

        /* perform time remapping on true events */
        let selection : BBSelectionPoint[] = opstate.staticSelection ?? [];
        for (let sp of selection) {
            let affectHead = true;
            if (sp.tail) {
                if (selection.includes(sp.other!)) {
                    /* The head is in our selection, we'll just skip the tail, and modify it as
                     * part of the head op.
                     */
                    continue;
                }
                /* The head is NOT in our selection, so we need to do a head-op on it,
                 * but without actually modifying the head.
                 */
                sp = sp.other!;
                affectHead = false;
            }
            let originalState = opstate.initialState.get(sp.event)!;
            let originalBeat = originalState.originalBeat;
            let headNewBeat = sp.event.event.time;
            
            if (affectHead) {
                headNewBeat = applyBeat(originalBeat).beat;
                sp.event.event.time = headNewBeat;
            }

            /* Adjust tail if it exists */
            if (sp.other) {
                let durationEvent : BBDurationEvent = sp.event.event as BBDurationEvent;
                let tailOriginalBeat = originalBeat + originalState.originalDuration!;
                let tailNewBeat = selection.includes(sp.other) ? applyBeat(tailOriginalBeat).beat : tailOriginalBeat;
                let newDuration = tailNewBeat - headNewBeat;
                durationEvent.duration = Math.max(newDuration, 0);
            }
        }

        /* Allow virtual events to perform remapping */
        this.emit("continueOperation", this.operationState, applyTime, applyBeat);
    }


    continueTSStretchOperation(deltaTime : number, currentlySnapping : boolean) {
        /* We implement this, essentially, as a wrapper for continueBPMOperation */
        let opstate = this.operationState!;
        opstate.changeSignificant = (deltaTime != 0);

        /* use proportional time to calculate new required BPM */
        let originalTimeDelta = opstate.targetTickOriginalTime! - opstate.controlInitialState!.originalTime;
        let newBeatTime = opstate.targetTickOriginalTime! + deltaTime;
        let newTimeDelta = newBeatTime - opstate.controlInitialState!.originalTime;
        let newBPM = originalTimeDelta/newTimeDelta * opstate.controlInitialState!.originalBPM!;

        this.continueTSBPMOperation(newBPM, currentlySnapping);
    }

    continueTSBPMOperation(newBPM : number | null, currentlySnapping : boolean) {
        let opstate = this.operationState!;
        opstate.snap = currentlySnapping;
        let snapGrid = opstate.snapGrid ?? 1;
        let nextEvent = opstate.nextControlInitialState;

        if (newBPM != null && (newBPM <= 0 || newBPM > 10000)) {
            newBPM = 10000;
        }

        /* First, we need to apply snap if applicable */
        if (opstate.snap && opstate.pmode == "KeepTimesAfter" && newBPM != null) {
            /* The goal is to pick a BPM that preserves the beat offset for the subsequent event. */
            if (nextEvent) {
                /* In essence, we want a BPM that phase-shifts the beat by 1/snapGrid over the
                 * duration of the period.
                 * Speaking mathematically, we seek:
                 *      ((dt * bpm/60) * snapGrid) - phaseshift = n (where n is some integer)
                 *
                 * Rounding that expression will give the closest n,
                 * then solve that for BPM.
                 * 
                 * bpm = ((n + phaseshift) / snapGrid * 60)/dt
                 * 
                 */
                let currentTime = opstate.controlInitialState!.originalTime;
                let nextTime = nextEvent.originalTime;
                let dt = nextTime - currentTime;
                let originalTickDelta = dt * opstate.controlInitialState!.originalBPM!/60 * snapGrid;
                let originalPhaseShift = originalTickDelta%1.0;
                let tickDelta = dt * newBPM/60 * snapGrid;
                let quantizedTickDelta = Math.round(tickDelta) + originalPhaseShift;
                let quantizedBPM = quantizedTickDelta * 60 / (snapGrid * dt);
                newBPM = quantizedBPM;
            }
        }

        /* No matter what, we set the BPM of the operation target. */
        if (newBPM == null) {
            delete (opstate.controlInitialState!.event.event as BBSetsBPMEvent).bpm;
        } else {
            (opstate.controlInitialState!.event.event as BBSetsBPMEvent).bpm = newBPM;
        }

        /* Now, update times or beats for all events */
        this.restitchEventsTS();
    }

    continueTSMoveOperation(deltaTime : number, currentlySnapping : boolean) {
        let opstate = this.operationState!;
        opstate.snap = currentlySnapping;

        opstate.changeSignificant = (deltaTime != 0);

        /* First, move the target. This is straightforward in both modes */
        let newTime = opstate.controlInitialState!.originalTime + deltaTime;
        let newBeat = this.timeToBeat(newTime, opstate.entryMapping);

        if (opstate.snap) {
            let snapGrid = opstate.snapGrid ?? 1
            newBeat = Math.round(newBeat * snapGrid)/snapGrid;
            newTime = this.beatToTime(newBeat, opstate.entryMapping);
        }
        
        opstate.controlInitialState!.event.event.time = newBeat;

        this.restitchEventsTS();
    }

    finishTSAlterEvents() {
        this.restitchEventsTS();
    }

    finishTSStretchOperation() {
        let opstate = this.operationState!;
        if (opstate.changeSignificant || opstate.mustSave) {
            this.saveUndoPoint("stretch", false);
        }
    }

    finishTSBPMOperation() {
        this.saveUndoPoint("setBPM", true);
    }

    finishTSMoveOperation() {
        let opstate = this.operationState!;
        if (opstate.changeSignificant || opstate.mustSave) {
            this.saveUndoPoint("moveControl", false);
        }
    }

    finishStaticTransformOperation() {
        let opstate = this.operationState!;
        if (opstate.changeSignificant || opstate.mustSave) {
            this.saveUndoPoint("transformStatic", false);
        }
    }

    restitchEventsTS() {
        let opstate = this.operationState!;
        let nextEvent = opstate.nextControlInitialState;

        
        this.recomputeTimeSpace();

        /* No time remapping */
        if (opstate.pmode == "KeepBeats" ||
            (opstate.pmode == "KeepTimesAfter" && !nextEvent)) {
            /* In this case, nothing! Just recompute timespace */
            this.alertContinueTSKeepBeats();
            return;
        }
        /* Everything is time-remapped */
        if (opstate.pmode == "KeepTimes") {
            this.restitchTimes();
            this.alertContinueTSKeepTimesAfterTime();
            return;
        }
        /* Partial time-remapping */
        if (opstate.pmode == "KeepTimesAfter" && nextEvent) {
            this.restitchTimes(nextEvent.originalTime);
            this.alertContinueTSKeepTimesAfterTime(nextEvent.originalTime);
            return;
        }
        throw new Error("Impossible state during restitch");
    }


    alertContinueTSKeepBeats() {
        this.alertContinueTimespaceOp(()=>true);
    }
    alertContinueTSKeepTimes() {
        this.alertContinueTimespaceOp(()=>false);
    }
    alertContinueTSKeepTimesAfterTime(afterTime : number = -99999) {
        this.alertContinueTimespaceOp((otime, obeat)=>{return otime < afterTime});
    }

    alertBeginOp() {
        this.emit("beginOperation", this.operationState);
    }

    /* if logic not provided, this assumes keep beats */
    alertContinueTimespaceOp(keepBeatLogic : BBTimelineApplyKeepBeatLogic = ()=>true) {
        let opstate = this.operationState!;
        let apply = (otime : number, obeat : number) => {
            if (keepBeatLogic(otime, obeat)) {
                /* Preserve Beat */
                let ntime = this.beatToTime(obeat);
                return {time: ntime, beat: obeat};
            } else {
                /* Preserve Time */
                let nbeat = this.timeToBeat(otime);
                return {time: otime, beat: nbeat};
            }
        }
        let applyTime : BBTimelineApplyOpTimeCallback = (otime : number) => {
            return apply(otime, this.timeToBeat(otime, opstate.initialMapping));
        }
        let applyBeat : BBTimelineApplyOpBeatCallback = (obeat : number) => {
            return apply(this.beatToTime(obeat, opstate.initialMapping), obeat);
        }
        this.emit("continueOperation", this.operationState, applyTime, applyBeat);
    }

    /* Compute new beat values for everything except the target, such that original times are
     * preserved.
     */
    restitchTimes(ignoreBefore : number = -9999) {
        let opstate = this.operationState!;
        /* We need to preserve the times of BPM change controls too,
         * so this is going to require a cascade of timespace recomputes.
         * We'll do this by first recomputing the timepoints for all time-control events,
         * recomputing timespace after each one. Then we will do a single-pass recompute
         * of non-time-control events.
         */

        /* Incrementally compute new timeControl beats to preserve the final time order.
         * To do this, we must first sort the time control beats by their final desired time. 
         */
        let fixedtcis : BBTimelineEventInitialState[] = this.timeControlEvents.map(tce => opstate.initialState.get(tce)!);
        let newTargetTime = this.beatToTime(opstate.targetControl?.event.time ?? 0, opstate.entryMapping);

        fixedtcis.sort((a, b) => {
            let atime = (a===opstate.controlInitialState) ? newTargetTime : a.originalTime;
            let btime = (b===opstate.controlInitialState) ? newTargetTime : b.originalTime;
            return atime - btime;
        })

        let fixedtce : BBTimelineEvent[] = fixedtcis.map(tcis => tcis.event);

        for (let tcis of fixedtcis) {
            let lts = this.computeTimeSpace(tcis.event.event, fixedtce);
            let targetTime = (tcis === opstate.controlInitialState) ? newTargetTime : tcis.originalTime;
            tcis.event.event.time = this.timeToBeat(targetTime, lts);
        }

        /* Now that time control events are remapped, recompute timespaces from scratch */
        this.recomputeTimeSpace();
        
        /* Finally, remap non-time-control-events */
        for (let event of this.staticEvents) {
            let evis = opstate.initialState.get(event)!;
            if (evis.originalTime < ignoreBefore) {
                event.event.time = evis.originalBeat;
            } else {
                event.event.time = this.timeToBeat(evis.originalTime);
            }
            if ((evis.event.event as BBDurationEvent).duration) {
                let originalEndTime = this.beatToTime(evis.originalBeat + evis.originalDuration!, opstate.initialMapping);
                if (originalEndTime < ignoreBefore) {
                    (evis.event.event as BBDurationEvent).duration = evis.originalDuration!;
                } else {
                    let newEndBeat = this.timeToBeat(originalEndTime);
                    (evis.event.event as BBDurationEvent).duration = newEndBeat - event.event.time;
                }
            }
        }
    }


    /* These functions are a tiny bit cursed.
     * They half-assume that we might add ***any*** type of event,
     * but also half-assume that all events added impact timespace.
     * In both cases, the assumption made is the more conservative, so these functions
     * work in both situations.
     * 
     * Right now, we only ever add timespace control events, so this could be simplified.
     * But I want to keep the option open to change my mind on that.
     */

    deleteEvent(event : BBTimelineEvent, keepBeats : boolean = true) {
        this.beginTSAlterEvents();

        if (this.timeControlEvents.includes(event)) {
            this.timeControlEvents = this.timeControlEvents.filter(e => e != event);
            this.recomputeTimeSpace();
        }

        /* It's more convenient than using splice, and I honestly expect it to be about as fast */
        this.markerEvents = this.markerEvents.filter(e => e != event);
        this.staticEvents = this.staticEvents.filter(e => e != event);
        this.allEvents = this.allEvents.filter(e => e != event);
        this.variant.level.events = this.variant.level.events.filter(e => e != event.event);
        this.lookup.delete(event.event);

        this.finishTSAlterEvents();

        this.saveUndoPoint("deleteEvent", false);
    }

    addEvent(event : BBEvent, saveUndo = true, toChart : boolean = false) : BBTimelineEvent {
        let level = this.variant.level;
        let chart = this.variant.chart;

        this.beginTSAlterEvents();

        /* For good measure */
        let clone : BBEvent = {...event};

        if (toChart) {
            chart.push(clone);
            sortEvents(chart);
        } else {
            level.events.push(clone);
            sortEvents(level.events);
        }

        let tlev = this.registerEvent(clone, toChart, false);

        this.finishTSAlterEvents();

        if (saveUndo) {
            this.saveUndoPoint("addEvent", false);
        }
        return tlev;
    }

    registerEvent(event : BBEvent, fromChart : boolean = false, computeBoundaries : boolean = false) : BBTimelineEvent {
        let tlev : BBTimelineEvent = {event, fromChart};
        this.lookup.set(event, tlev);
        this.allEvents.push(tlev);
        if (timeControlTypes.includes(event.type)) {
            this.timeControlEvents.push(tlev);
        } else {
            this.staticEvents.push(tlev);
            if (markerTypes.includes(event.type)) {
                this.markerEvents.push(tlev);
            }
        }

        /* We only want to compute the boundaries on the very first run, after that keep them consistent
             * soas not to mess with the user's zoom, etc. They don't actually matter, they just establish
             * the definition of `zoom=1`.
             */
        if (computeBoundaries) {
            if (event.time < this.firstBeat) {
                this.firstBeat = event.time;
            }
            if (event.time > this.lastBeat) {
                this.lastBeat = event.time;
            }
            let duration = (event as BBDurationEvent).duration;
            if (duration) {
                let finalTime = event.time + duration;
                if (finalTime < this.firstBeat) {
                    this.firstBeat = finalTime;
                }
                /* Yes, negative durations are possible. */
                if (finalTime > this.lastBeat) {
                    this.lastBeat = finalTime;
                }
            }
        }

        return tlev;
    }

    saveUndoPoint(undoType : string, replaceIfSame = false) {
        /* If this undo type is the same as the last two, optionally replace the previous undo
         * point. We check the last two, because we want to preserve the beginning and end of
         * series of consecutively same undo save types.
         * 
         * We also require the last two savepoints be less than 10 seconds old.
         */
        if (replaceIfSame &&
            this.undoHistory.length >= 2 &&
            this.undoHistory[this.undoIndex].type === undoType &&
            this.undoHistory[this.undoIndex - 1].type === undoType &&
            (Date.now() - this.undoHistory[this.undoIndex ].time) < 10000 &&
            (Date.now() - this.undoHistory[this.undoIndex - 1].time) < 10000) {
            this.undoIndex -= 1;
        }

        /* Drop all history after current index. */
        this.undoHistory = this.undoHistory.slice(0, this.undoIndex + 1);
        this.canRedo = false;


        /* We store undo history as string to guarantee we always deep copy when restoring.
         * Plus, beatblock levels are, by definition, JSON anyhow, and we want to be minimally
         * invasive, so this is a very natural API to use.
         * 
         * Compresssion saves around 80% of the memory cost, so very worth it!
         */
        let levelData =  lzjs.compress(JSON.stringify(this.variant.level));
        let chartData =  lzjs.compress(JSON.stringify(this.variant.chart));

        this.undoHistory.push({
            time: Date.now(),
            type: undoType,
            levelData, chartData
        });
        this.undoIndex += 1;
        this.canUndo = this.undoIndex > 0;
    }
    undo() {
        if (this.undoIndex > 0) {
            this.gotoSaveIndex(this.undoIndex - 1);
        }
    }
    redo() {
        if (this.undoIndex < this.undoHistory.length - 1) {
            this.gotoSaveIndex(this.undoIndex + 1);
        }
    }
    gotoSaveIndex(nindex : number) {        
        this.undoIndex = nindex;
        let {levelData, chartData} = this.undoHistory[this.undoIndex];
        this.variant.level      = JSON.parse(lzjs.decompress(levelData));
        this.variant.chart      = JSON.parse(lzjs.decompress(chartData));

        /* computeBoundaries set to false to avoid messing with zoom/position */
        this.loadEvents(false);

        this.canUndo = this.undoIndex > 0;
        this.canRedo = this.undoIndex < this.undoHistory.length - 1;
    }

}