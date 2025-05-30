import type { LODAudioData } from "src/utils/SoundUtils";
import type { BBTimelineEvent } from "./BBTimeLine";
import type { BBChart, BBLevel, BBManifest, BBPlayEvent, BBShowResultsEvent, BBVariant } from "./BBTypes";
import { loadAudioFile, readFile } from "src/utils/FileUtils";
import { downloadTextFile, downloadZipContaining } from "../utils/UXUtils";

const SupportedVersions = [14];

type ReasonHandler = (reason : string) => void;
export interface BBVariantFiles {
    name : string;
    levelFileName : string;
    chartFileName : string;
    levelFile? : FileSystemEntry;
    chartFile? : FileSystemEntry;
    level : BBLevel;
    chart : BBChart;
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
    basename : string = "beatblock-level";
    
    // Is this an auto-generated chart?
    // If true, export will generate a manifest.json for it
    generated : boolean = false;
    constructor() {
    }

    validateLevel(level : BBLevel, reasonHandler : ReasonHandler) {
        let levelVersion = this.manifest?.properties.formatversion ?? (level?.properties?.formatversion ?? -1);
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

        return true;
    }

    /* For my own sanity, I have decided not to support the legacy formats, I am sorry. */
    async load(files: FileSystemEntry[], loadFailed : ReasonHandler) : Promise<boolean> {
        if (files.length == 1) {
            return await this.loadMusic(files[0], loadFailed);
        }
        return await this.loadFolder(files, loadFailed);
    }

    /*
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
    */

    async loadMusic(soundFile: FileSystemEntry, loadFailed : ReasonHandler) : Promise<boolean> {
        this.generated = true;
        let soundFileName = soundFile.name;
        this.basename = soundFileName.substr(0, soundFileName.lastIndexOf('.'));
        let variant = {
            name: "main",
            difficulty: 0,
            display: "main",
            charter: "",
        };
        this.manifest = {
            properties: {
                formatversion: 14
            },
            metadata: {
                bg: false,
                songName: soundFileName,
                description: "Timing scaffold created with the BeatBlock Aligner tool.",
                charter: "Charter",
                artist: "Artist",
                artistLink: "",
                difficulty: 0
            },
            defaultVariant : "main",
            variants: [variant]
        }
        if (!soundFileName.endsWith(".ogg")) {
            loadFailed(`Only .ogg audio files are supported by this tool for now`);
            return false;
        }
        let soundData = await loadAudioFile(soundFile as FileSystemFileEntry);
        let playEvent : BBPlayEvent = {
            type: "play",
            angle: 0,
            file: soundFileName,
            time: 0,
            volume: 1
        }
        let endSongEvent : BBShowResultsEvent = {
            type: "showResults",
            angle: 0,
            time: soundData.duration * (100/60),
        }
        let level : BBLevel = {
                properties: {
                    offset: 8,
                    formatversion: 14,
                    speed: 70
                },
                events: [playEvent, endSongEvent]
        };
        let chart : BBChart = [];
        
        let sounds : Map<string, BBSoundFile> = new Map();
        sounds.set(soundFileName, {
            soundFileName,
            soundFile,
            soundData,
            clickTracks: []
        });
        this.variants.push({
            name: "main",
            levelFileName: "level.json",
            chartFileName: "chart-main.json",
            level, chart,
            sounds,
            data:variant
        });
        return true;
    }

    async loadFolder(files: FileSystemEntry[], loadFailed : ReasonHandler) : Promise<boolean> {
        /* Find manifest.json and its base path */
        let manifestFile = undefined;
        let basePath = "";
        for (let file of files) {
            console.log("Scanning file: ", file.fullPath);
            let sp = file.fullPath;
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

        this.basename = basePath.slice(basePath.slice(0, -1).lastIndexOf("/") + 1).replace("/", "");

        console.log("Level basepath, basename: ", basePath, this.basename);
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

            console.log("hmm?");

            /* Find level.json */
            for (let file of levelFiles) {
                console.log("eh?", file.fullPath, basePath + levelFileName);
                if (file.fullPath === basePath + levelFileName) {
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
                if (file.fullPath === basePath + chartFileName) {
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
            let chart = JSON.parse(await readFile(chartFile as FileSystemFileEntry) as string);

            if (!this.validateLevel(level, loadFailed)) {
                return false;
            }

            let sounds : Map<string, BBSoundFile> = new Map();
            for (let event of level.events) {
                if (event.type == "play") {
                    let soundFile = undefined;
                    let soundFileName = event.file;
                    for (let file of levelFiles) {
                        if (file.fullPath === basePath + soundFileName) {
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

    downloadVariant(variant : BBVariantFiles) {
        /* Everything in this application is carefully crafed so that variant.chart and .level are
         * at all times the latest, up to date, stringifyable beatblock level/chart representations,
         * so saving is as simple as exporting them to json.
         */
        let files = [
            {name: variant.chartFileName, data: JSON.stringify(variant.chart)},
            {name: variant.levelFileName, data: JSON.stringify(variant.level)}
        ];

        if (this.generated) {
            files.push({name: "manifest.json", data: JSON.stringify(this.manifest)});
        }

        downloadZipContaining(this.basename + ".zip", files);
    }
}