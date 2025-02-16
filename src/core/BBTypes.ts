export interface BBManifest {
    metadata : BBMetadata;
    defaultVariant? : string;
    variants?: BBVariant[];
}

export interface BBMetadata {
    songName?: string;
    artist?: string;
    bpm? : number;
    bgData: BBBGData;
    bg? : boolean;
    description? : string;
    artistLink? : string;
}

export interface BBColor {
    r : number,
    g : number,
    b : number
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

export interface BBVariant {
    name?: string;
    display?: string;
    charter?: string;
    levelFile?: string;
    difficulty?: number;
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


/* This is not an exhaustive implementation. */
export interface BBEvent {
    type: string;
    angle?: number;
    time: number; //VOI
}

export interface BBSetsBPMEvent extends BBEvent {
    bpm?: number;
}

export interface BBDurationEvent extends BBEvent {
    duration: number; //VOI
}

export interface BBDeco extends BBDurationEvent {
    type: "deco";
    id?: string;
    x?: number;
    y?: number;
    r?: number;
    sx?: number;
    sy?: number;
    ox?: number;
    oy?: number;
    ease?: string;
    hide?: boolean;
    drawLayer?: string;
    drawOrder?: number;
    kx?: number;
    ky?: number;
    orbit?: boolean;
    outline?: boolean;
    sprite?: string;
    recolor?: number;
    parentid?: string;
}


export interface BBPlay extends BBSetsBPMEvent {
    type: "play";
    file: string;
    volume: number;
}


export interface BBEase extends BBDurationEvent {
    type: "ease",
    ease: string,
    value: number,
    var: string,
    start: number, //VOI
}

export interface BBOutline extends BBEvent {
    type: "outline",
    enable: boolean,
    color: number
}

export interface BBSetColor extends BBDurationEvent {
    type: "setColor",
    color: number,
    r: number,
    b: number,
    g: number,
    ease: string
}

export interface BBSetBGCol extends BBEvent {
    type: "setBgColor",
    color: number
}

export interface BBNoise extends BBEvent {
    type: "noise",
    chance: number,
    color: number,
    order: number
}

export interface BBHom extends BBEvent {
    type: "hom";
    enable: boolean;
}

export interface BBPaddles extends BBDurationEvent {
    type: "paddles",
    newAngle: number,
    ease: string,
    enabled: boolean,
    paddle: number
}

export interface BBShowResults extends BBEvent {
    type: "showResults",
}

export interface BBSetBPM extends BBSetsBPMEvent {
    time: number,
}