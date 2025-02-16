import type { LODAudioData } from "src/utils/SoundUtils";
import type { BBTimelineEvent } from "./BBTimeLine";
import type { BBLevel, BBManifest, BBPlay, BBVariant } from "./BBTypes";
import { loadAudioFile, readFile, sanePath } from "src/utils/FileUtils";

const SupportedVersions = [14];
const SupportedEvents = [
    "play",
    "deco",
    "ease",
    "outline",
    "setColor",
    "setBgColor",
    "noise",
    "hom",
    "paddles",
    "showResults"
]


type ReasonHandler = (reason : string) => void;
export interface BBVariantFiles {
    name : string;
    levelFileName : string;
    chartFileName : string;
    levelFile : FileSystemEntry;
    chartFile : FileSystemEntry;
    level : BBLevel;
    chart : string;
    data : BBVariant;
    sounds : Map<string, BBSoundFile>;
}

export interface BBSoundFile {
    soundFile : FileSystemEntry;
    soundFileName : string;
    soundData : LODAudioData;
    clickTracks : LODAudioData[];
}

export class BBLevelLoader {
    manifest : BBManifest | undefined;
    variants : BBVariantFiles[] = [];
    constructor() {
    }

    validateLevel(level : BBLevel, reasonHandler : ReasonHandler) {
        let levelVersion = level?.properties?.formatversion ?? -1;
        if (!SupportedVersions.includes(levelVersion)) {
            reasonHandler(`Unsupported level format version ${levelVersion}`);
            return false;
        }

        /* Hacky way for me to quickly figure out standard properties, rather than read source code */
        let propertyReport : any = {};
        for (let event of level.events) {
            propertyReport[event.type] = {...(propertyReport?.[event.type] ?? {}), ...event}
        }
        console.log("PropertyReport:", propertyReport);

        for (let event of level.events) {
            if (!SupportedEvents.includes(event.type)) {
                reasonHandler(`Unsupported event ${event.type}`);
                return false;
            }
        }
        return true;
    }

    /* For my own sanity, I have decided not to support the legacy formats, I am sorry. */
    async load(files: FileSystemEntry[], loadFailed : ReasonHandler) : Promise<boolean> {
        /* Find manifest.json and its base path */
        let manifestFile = undefined;
        let basePath = "";
        for (let file of files) {
            console.log("Scanning file: ", file.fullPath);
            let sp = sanePath(file.fullPath);
            let matches = sp.match(/(.*)manifest\.json$/);
            if (matches) {
                basePath = matches[1];
                manifestFile = file;
                break;
            }
        }
        if (!manifestFile) {
            loadFailed("Could not find manifest.json");
            return false;
        }
        console.log("Level basepath: ", basePath);
        console.log("Manifest File: ", manifestFile.fullPath);
        this.manifest = JSON.parse(await readFile(manifestFile as FileSystemFileEntry) as string) as BBManifest;

        let levelFiles = files.filter(file => file.fullPath.startsWith(basePath));
        if (!this.manifest.variants) {
            loadFailed("Level has no variants?");
            return false;
        }

        for (let variant of this.manifest.variants) {
            console.log("Loading Variant:", variant);
            let levelFileName = variant.levelFile ?? `level.json`;
            let chartFileName = `chart-${variant.name}.json`;
            let levelFile = undefined;
            let chartFile = undefined;

            /* Find level.json */
            for (let file of levelFiles) {
                if (sanePath(file.fullPath) === basePath + levelFileName) {
                    levelFile = file;
                    break;
                }
            } 

            if (!levelFile) {
                loadFailed(`Could not find ${levelFileName} (level file for variant ${variant.name ?? "UNNAMED"})`);
                return false;
            }   
            console.log("Level File: ", levelFile.fullPath);

            /* Find chart.json */
            for (let file of levelFiles) {
                if (sanePath(file.fullPath) === basePath + chartFileName) {
                    chartFile = file;
                    break;
                }
            }

            if (!chartFile) {
                loadFailed(`Could not find ${chartFileName} (chart file for variant ${variant.name ?? "UNNAMED"})`);
                return false;
            }
            console.log("Chart File: ", chartFile.fullPath);

            let level = JSON.parse(await readFile(levelFile as FileSystemFileEntry) as string);
            let chart = await readFile(chartFile as FileSystemFileEntry) as string;

            if (!this.validateLevel(level, loadFailed)) {
                return false;
            }

            let sounds : Map<string, BBSoundFile> = new Map();
            for (let event of level.events) {
                if (event.type == "play") {
                    let soundFile = undefined;
                    let soundFileName = event.file;
                    for (let file of levelFiles) {
                        if (sanePath(file.fullPath) === basePath + soundFileName) {
                            soundFile = file;
                            break;
                        }
                    }
                    if (!soundFile) {
                        loadFailed(`Could not find ${soundFileName} (sound file for variant ${variant.name ?? "UNNAMED"})`);
                        return false;
                    }
                    console.log("Sound File: ", soundFile.fullPath);
                    
                    if (!soundFile.fullPath.endsWith(".ogg")) {
                        loadFailed(`Only .ogg audio files are supported by this tool for now`);
                        return false;
                    }

                    /* No need to load sounds we already have a second time */
                    if (sounds.has(soundFileName)) {
                        continue;
                    }

                    sounds.set(soundFileName, {
                        soundFileName,
                        soundFile,
                        soundData: await loadAudioFile(soundFile as FileSystemFileEntry),
                        clickTracks: []
                    });
                }
            }
            
            this.variants.push({
                name: variant.name ?? "UNNAMED",
                levelFileName, chartFileName,
                levelFile, chartFile,
                level, chart,
                sounds,
                data:variant
            });

        }

        return true;
    }

    getVariantNames() : string[] {
        return this.variants.map(variant => variant.name ?? "UNNAMED");
    }

    getVariantByName(name : string) {
        if (this.variants.length == 0 && name === "UNNAMED") {
            return this.variants[0];
        }
        return this.variants.filter(variant => variant.name == name)?.[0];
    }
}