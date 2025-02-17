/* Top level structure types */
export interface BBManifest {
    metadata : BBMetadata;
    defaultVariant? : string;
    variants?: BBVariant[];
}

export interface BBMetadata {
    songName?: string;
    artist?: string;
    bpm? : number;
    bgData?: BBBGData;
    bg? : boolean;
    description? : string;
    artistLink? : string;
}

export interface BBVariant {
    name?: string;
    display?: string;
    charter?: string;
    levelFile?: string;
    difficulty?: number;
}

export interface BBBGData {
    image: string;
    redChannel?: BBColor;
    blueChannel?: BBColor;
    greenChannel?: BBColor;
    yellowChannel?: BBColor;
    magentaChannel?: BBColor;
    cyanChannel?: BBColor;
}

export interface BBLevel {
    properties: {
        formatversion: number,
        offset?: number,         //VOI
        speed?: number,          
        startingBeat?: number,   //VOI
        loadBeat?: number,       //VOI
    },
    events: BBEvent[]
}

export interface BBColor {
    r : number,
    g : number,
    b : number
}

export type BBEaseType = 
    "linear"    |
	"inSine"    | "outSine"     | "inOutSine"   |
	"inQuad"    | "outQuad"     | "inOutQuad"   | 
	"inCubic"   | "outCubic"    | "inOutCubic"  |
	"inQuart"   | "outQuart"    | "inOutQuart"  |
	"inQuint"   | "outQuint"    | "inOutQuint"  |
	"inExpo"    | "outExpo"     | "inOutExpo"   |
	"inCirc"    | "outCirc"     | "inOutCirc"   |
	"inElastic" | "outElastic"  | "inOutElastic"|
	"inBack"    | "outBack"     | "inOutBack";

/* Root Event Types */
export interface BBEvent {
    type: string;
    angle?: number;
    order?: number;
    time: number;
}

export interface BBSetsBPMEvent extends BBEvent {
    bpm?: number;
}

export interface BBDurationEvent extends BBEvent {
    duration: number;
}

/* Events */
export interface BBDecoEvent extends BBDurationEvent {
    type: "deco";
    id?: string;
    x?: number;
    y?: number;
    r?: number;
    sx?: number;
    sy?: number;
    ox?: number;
    oy?: number;
    kx?: number;
    ky?: number;
    ease?: BBEaseType;
    hide?: boolean;
    drawLayer?: string;
    drawOrder?: number;
    orbit?: boolean;
    outline?: boolean;
    sprite?: string;
    recolor?: number;
    parentid?: string;
    rotationinfluence?: number; 
    effectCanvas?: boolean;
    effectCanvasRaw?: boolean;
}

export interface BBEaseEvent extends BBDurationEvent {
    type: "ease",
    var: string,
    start?: number,
    value: number,
    ease?: BBEaseType,
    repeats?: number,
    repeatDelay?: number
}

export interface BBForcePlayerSprite extends BBEvent {
    type: "forcePlayerSprite";
    spriteName: string;
}

export interface BBHomEvent extends BBEvent {
    type: "hom";
    enable: boolean;
}

export interface BBNoiseEvent extends BBEvent {
    type: "noise",
    chance: number,
    color: number
}

export interface BBOutlineEvent extends BBEvent {
    type: "outline",
    enable: boolean,
    color: number
}

export interface BBPlaySoundEvent extends BBEvent {
    type: "playSound",
    sound: string,
    volume?: number,
    pitch?: number
}

export interface BBSetBGColorEvent extends BBEvent {
    type: "setBgColor",
    color?: number,
    voidColor?: number
}

export interface BBSetBooleanEvent extends BBEvent {
    type: "setBoolean",
    var: string,
    enable?: boolean
}

export interface BBSetColorEvent extends BBDurationEvent {
    type: "setColor",
    color: number,
    r: number,
    b: number,
    g: number,
    ease?: BBEaseType
}

export interface BBToggleParticlesEvent extends BBEvent {
    type: "toggleParticles",
    block?: boolean,
    miss?: boolean,
    mine?: boolean,
    mineHold?: boolean,
    side?: boolean
}

export interface BBBlockEvent extends BBEvent {
    type: "block",
    endAngle?: number,
    spinEase?: BBEaseType,
    speedMult?: number,
    tap?: boolean,
}

export interface BBExtraTapEvent extends BBEvent {
    type: "extraTap",
    speedMult?: number,
}


export interface BBHoldEvent extends BBDurationEvent {
    type: "hold",
    angle2: number;
    segments?: number;
    holdEase?: number;
    endAngle?: number;
    spinEase?: BBEaseType;
    speedMult?: number;
    startTap?: boolean;
    endTap?: boolean;
}

export interface BBInverseEvent extends BBEvent {
    type: "inverse",
    endAngle?: number;
    spinEase?: BBEaseType;
    speedMult?: number;
    tap?: boolean;
}

export interface BBMineEvent extends BBEvent {
    type: "mine",
    endAngle?: number;
    spinEase?: BBEaseType;
    speedMult?: number;
}

export interface BBMineHoldEvent extends BBDurationEvent {
    type: "mineHold",
    angle2: number;
    segments?: number;
    holdEase?: number;
    endAngle?: number;
    spinEase?: BBEaseType;
    speedMult?: number;
    tickRate?: number;
}

export interface BBTraceEvent extends BBDurationEvent {
    type: "side",
    angle2: number;
    segments?: number;
    holdEase?: number;
    endAngle?: number;
    spinEase?: BBEaseType;
    speedMult?: number;
    tickRate?: number;
}

export interface BBPaddlesEvent extends BBDurationEvent {
    type: "paddles",
    enabled?: boolean,
    paddle: number,
    newWidth?: number,
    newAngle?: number,
    ease?: BBEaseType,
}

export interface BBPlayEvent extends BBSetsBPMEvent {
    type: "play";
    file: string;
    volume?: number;
    offset?: number;
}

export interface BBSetBPMEvent extends BBSetsBPMEvent {
    type: "setBPM",
    time: number,
}

export interface BBShowResultsEvent extends BBEvent {
    type: "showResults",
}

