import { generateAudioLODs, type LODAudioData } from "../utils/SoundUtils";
const audioCtx = new AudioContext();

export function sanePath(str : string) {
    return str.replace(/[^a-zA-Z0-9-_\/.]/g, '');
}

export async function handleDropEvent(e : DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    console.log(e);
    let entries = [...e.dataTransfer!.items].map(
        (item : any) => {
            return item.getAsEntry ? item.getAsEntry() : item.webkitGetAsEntry();
        }
    ).filter(entry => entry);
    return await enumerateFiles(entries);
}

export async function enumerateFiles(entries : FileSystemEntry[]) : Promise<FileSystemEntry[]> {
    console.log(entries);
    let result : FileSystemEntry[] = [...entries];
    for (let entry of entries) {
        if (entry.isDirectory) {
            let directoryReader = (entry as FileSystemDirectoryEntry).createReader();
            let subfiles : FileSystemEntry[] = await new Promise((resolve, reject) => {
                directoryReader.readEntries((entries : FileSystemEntry[]) => {
                    resolve(entries)
                });
            });
            result = result.concat(await enumerateFiles(subfiles));
        }
    }
    return result;
}

export async function readFile(entry : FileSystemFileEntry, data:boolean=false) : Promise<string|ArrayBuffer|null> {
    return await new Promise((resolve, reject) => {
        entry.file((file) => {
            let reader = new FileReader();
            reader.onload = () => {
                resolve(reader.result);
            }
            reader.onerror = reject;
            if (data) {
                reader.readAsArrayBuffer(file);
            } else {
                reader.readAsText(file);
            }
        }, reject);
    });
}

export async function loadAudioFile(entry: FileSystemFileEntry) : Promise<LODAudioData> {
    let soundDataRaw = await readFile(entry as FileSystemFileEntry, true);
    let soundData = await audioCtx.decodeAudioData(soundDataRaw as ArrayBuffer);
    return generateAudioLODs(soundData);
}
