import type { BBVariantFiles } from "./BBLevelLoader";
import type { BBDurationEvent, BBEvent, BBSetsBPMEvent } from "./BBTypes";

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
const timeControlTypes = ["play", "setBPM"];

/* For now, I am assuming that tags cannot contain setBPM events. */
const markerTypes = ["tag", "bookmark", "showResults"];

function sortEvents(events : BBEvent[]) {
    events.sort((a, b) => (a?.time ?? 0) - (b?.time ?? 0));
}

function sortTimelineEvents(events : BBTimelineEvent[]) {
    events.sort((a, b) => (a?.realbeat ?? 0) - (b?.realbeat ?? 0));
}

/* A point on a Time/Beat monotonic function */
export type TimeBeatPoint = {
    t: number;
    b: number;
    bpm: number;
}

export type BBTimelineOperationMode = "MoveKeepBeats" | "MoveKeepTimes" | "StretchKeepAllBeats" | "StretchKeepAllTimes" | "StretchKeepAfter";
export interface BBTimelineEventInitialState {
    event : BBTimelineEvent;
    originalTime : number;
    originalBeat : number;
    originalBPM : number;
}

export interface BBTimelineOperationState {
    mode : BBTimelineOperationMode;
    snap : boolean;
    snapGrid : number;
    initialState : Map<BBTimelineEvent, BBTimelineEventInitialState>;
    controlTarget?: BBTimelineEventInitialState;
    nextControl?: BBTimelineEventInitialState;
    targetTick?: number;
    targetTickOriginalTime?: number;
    entryMapping?: TimeBeatPoint[];
    mustSave : boolean;
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

export class BBTimeLine {
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

    /* These are never updated after first load,
     * they just establish the baseline time transform, but users are free to move things well
     * outside this range.
     */
    firstBeat : number = 0;
    lastBeat : number = 0;
    firstTime : number = 0;
    lastTime : number = 0;
    startTimes : BBStartData | undefined = undefined;

    constructor(variant : BBVariantFiles) {
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

    getEventsNearTime(events : BBTimelineEvent[], time : number, zoom : number, threshold : number) : BBTimelineEvent[] { 
        let earliestTime = time - threshold/2;
        let latestTime = time + threshold/2;        
        let lower = 0;
        let upper = events.length-1;

        if (events.length == 0) {
            return [];
        }

        while (upper != lower) {
            let next = Math.ceil((upper + lower)/2);
            let nextTime = this.beatToTime(events[next].event.time);
            if (nextTime > earliestTime) {
                upper = next - 1;
            } else {
                lower = next;
            }
        }


        let results : BBTimelineEvent[] = [];
        for (let i = lower; i < events.length; i++) {
            let etime = this.beatToTime(events[i].event.time);
            if (etime < earliestTime) {
                continue;
            }
            if (etime > latestTime) {
                break;
            }
            results.push(events[i]);
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

        /* If we are not overriding the events array used, we are modifying the class state,
         * apply sorting.
         */
        if (tces) {
            sortTimelineEvents(this.timeControlEvents);
        }

        sortTimelineEvents(preloadEvents);
        sortTimelineEvents(realEvents);

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
        //TODO
        this.recomputeTimeSpace();
        if (save) {
            this.saveUndoPoint("loadBeat", true);
        }
    }

    setBPM(ev : BBTimelineEvent, nbpm : number | null, mode : BBTimelineOperationMode,
           snap : boolean,  snapGrid : number) {
        this.beginBPMOperation(ev, mode, snap, snapGrid);
        this.finishBPMOperation(nbpm);
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
        return (t - this.firstTime)/(this.lastTime - this.firstTime) * 100;
    }

    relToTime(rt : number) {
        return rt/100 * (this.lastTime - this.firstTime) + this.firstTime;
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
    beginOperation(mode : BBTimelineOperationMode, snap : boolean = false, snapGrid : number,
                   targetEvent : BBTimelineEvent | undefined = undefined, mustSave : boolean) {
        let initialState : Map<BBTimelineEvent, BBTimelineEventInitialState> = new Map();
        let targetEventInitial = undefined;
        let nextEventInitial = undefined;
        this.recomputeTimeSpace();
        for (let event of this.allEvents) {
            let evis : BBTimelineEventInitialState = {
                event,
                originalBeat: event.event.time,
                originalTime: this.beatToTime(event.event.time),
                originalBPM: (event.event as BBSetsBPMEvent).bpm ?? this.beatToBPM(event.event.time)
            }
            initialState.set(event, evis);
            if (event === targetEvent) {
                targetEventInitial = evis;
                continue;
            }
            if (targetEventInitial && !nextEventInitial) {
                nextEventInitial = evis;
            }
        }
        this.operationState = {
            mode,
            snap,
            snapGrid,
            initialState,
            controlTarget: targetEventInitial,
            nextControl: nextEventInitial,
            entryMapping: this.computeTimeSpace(targetEvent?.event),
            mustSave
        }
    }

    beginStretchOperation(event : BBTimelineEvent, mode : BBTimelineOperationMode,
                          snap : boolean,  snapGrid : number, targetTick : number) {
        this.beginBPMOperation(event, mode, snap, snapGrid);
        /* This is a bit hacky, but modify the initial state with some extra info */
        this.operationState!.targetTick = targetTick;
        this.operationState!.targetTickOriginalTime = this.beatToTime(this.tickToBeat(targetTick, snapGrid));
    }

    beginBPMOperation(event : BBTimelineEvent, mode : BBTimelineOperationMode,
                      snap : boolean, snapGrid : number) {
        if (!["StretchKeepAllBeats", "StretchKeepAllTimes", "StretchKeepAfter"].includes(mode)) {
            throw new Error("Invalid BPM/stretch mode");
        }
        this.beginOperation(mode, snap, snapGrid, event, true);
    }

    beginMoveOperation(event : BBTimelineEvent, mode : BBTimelineOperationMode,
                       snap : boolean, snapGrid : number, mustSave : boolean) {
        if (!["MoveKeepBeats","MoveKeepTimes"].includes(mode)) {
            throw new Error("Invalid move mode");
        }
        this.beginOperation(mode, snap, snapGrid, event, mustSave);
    }

    continueStretchOperation(deltaTime : number) {
        /* We implement this, essentially, as a wrapper for continueBPMOperation */
        let opstate = this.operationState!;

        /* use proportional time to calculate new required BPM */
        let originalTimeDelta = opstate.targetTickOriginalTime! - opstate.controlTarget!.originalTime;
        let newBeatTime = opstate.targetTickOriginalTime! + deltaTime;
        let newTimeDelta = newBeatTime - opstate.controlTarget!.originalTime;
        let newBPM = originalTimeDelta/newTimeDelta * opstate.controlTarget!.originalBPM!;

        this.continueBPMOperation(newBPM);
    }

    continueBPMOperation(newBPM : number | null) {
        let opstate = this.operationState!;
        let nextEvent = opstate.initialState.get(this.getControlAfter(opstate.controlTarget?.event));

        if (newBPM != null && (newBPM <= 0 || newBPM > 10000)) {
            newBPM = 10000;
        }

        /* First, we need to apply snap if applicable */
        if (opstate.snap && opstate.mode == "StretchKeepAfter" && newBPM != null) {
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
                let currentTime = opstate.controlTarget!.originalTime;
                let nextTime = nextEvent.originalTime;
                let dt = nextTime - currentTime;
                let originalTickDelta = dt * opstate.controlTarget!.originalBPM!/60 * opstate.snapGrid;
                let originalPhaseShift = originalTickDelta%1.0;
                let tickDelta = dt * newBPM/60 * opstate.snapGrid;
                let quantizedTickDelta = Math.round(tickDelta) + originalPhaseShift;
                let quantizedBPM = quantizedTickDelta * 60 / (opstate.snapGrid * dt);
                newBPM = quantizedBPM;
            }
        }

        /* No matter what, we set the BPM of the operation target. */
        if (newBPM == null) {
            delete (opstate.controlTarget!.event.event as BBSetsBPMEvent).bpm;
        } else {
            (opstate.controlTarget!.event.event as BBSetsBPMEvent).bpm = newBPM;
        }

        /* Now, the tricky part. What happens to everything afterwards? */

        /* No time remapping */
        if (opstate.mode == "StretchKeepAllBeats" ||
            (opstate.mode == "StretchKeepAfter" && !nextEvent)) {
            /* In this case, nothing! Just recompute timespace */
            this.recomputeTimeSpace();
            return;
        }
        /* Everything is time-remapped */
        if (opstate.mode == "StretchKeepAllTimes") {
            this.restitchTimes(opstate.controlTarget!.originalTime);
            return;
        }
        /* Partial time-remapping */
        if (opstate.mode == "StretchKeepAfter" && nextEvent) {
            console.log("Partial remap!!");
            this.restitchTimes(opstate.controlTarget!.originalTime, nextEvent.originalTime);
            return;
        }
        throw new Error("Impossible state during BPM op continue");
    }

    continueMoveOperation(deltaTime : number) {
        let opstate = this.operationState!;

        /* First, move the target. This is straightforward in both modes */
        let newTime = opstate.controlTarget!.originalTime + deltaTime;
        let newBeat = this.timeToBeat(newTime, opstate.entryMapping);

        if (opstate.snap) {
            newBeat = Math.round(newBeat * opstate.snapGrid)/opstate.snapGrid;
            newTime = this.beatToTime(newBeat, opstate.entryMapping);
        }

        opstate.controlTarget!.event.event.time = newBeat;
        
        if (opstate.mode == "MoveKeepBeats") {
            /* We ONLY needed to move the target and update timespace in this mode. */
            /* So, just  recompute the timespace and exit! */
            this.recomputeTimeSpace();
            return;
        } else if (opstate.mode == "MoveKeepTimes") {
            /* In this mode, we must compute new beat values for everything except the target,
             * to preserve original times.
             */
            this.restitchTimes(newTime);
        }
    }

    finishStretchOperation(deltaTime : number) {
        let opstate = this.operationState!;
        this.continueStretchOperation(deltaTime);
        if (deltaTime != 0 || opstate.mustSave) {
            this.saveUndoPoint("stretch", false);
        }
    }

    finishBPMOperation(finalBPM : number | null) {
        this.continueBPMOperation(finalBPM);
        this.saveUndoPoint("setBPM", true);
    }

    finishMoveOperation(deltaTime : number) {
        let opstate = this.operationState!;
        this.continueMoveOperation(deltaTime);
        if (deltaTime != 0 || opstate.mustSave) {
            this.saveUndoPoint("moveControl", false);
        }
    }

    /* Compute new beat values for everything except the target, such that original times are
     * preserved.
     */
    restitchTimes(newTargetTime : number, ignoreBefore : number = -9999) {
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

        fixedtcis.sort((a, b) => {
            let atime = (a===opstate.controlTarget) ? newTargetTime : a.originalTime;
            let btime = (b===opstate.controlTarget) ? newTargetTime : b.originalTime;
            return atime - btime;
        })

        let fixedtce : BBTimelineEvent[] = fixedtcis.map(tcis => tcis.event);

        for (let tcis of fixedtcis) {
            let lts = this.computeTimeSpace(tcis.event.event, fixedtce);
            let targetTime = (tcis === opstate.controlTarget) ? newTargetTime : tcis.originalTime;
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
        }
    }

    deleteEvent(event : BBTimelineEvent) {
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
        this.saveUndoPoint("deleteEvent", false);
    }

    addEvent(event : BBEvent, saveUndo = true, toChart : boolean = false) : BBTimelineEvent {
        let level = this.variant.level;
        let chart = this.variant.chart;

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

        /* This is kinda bodgey, but I don't want to deal with direct detection pathways for this,
         * and adding an event is pretty rare.
         */
        if (this.timeControlEvents.includes(tlev)) {
            this.recomputeTimeSpace();
        }

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