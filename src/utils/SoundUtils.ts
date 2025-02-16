export interface LODAudioData {
    duration : number;
    channelLODs: Float32Array[][];
    peaks : number[];
}

export function generateAudioLODs(soundData : AudioBuffer) : LODAudioData {
    let channelLODs : Float32Array[][] = [];
    let peaks : number[] = [];
    for (let ch = 0; ch < soundData.numberOfChannels; ch++) {
        let LOD : Float32Array = soundData.getChannelData(ch);
        let LODs : Float32Array[] = [LOD];

        
        let peak = 0;   
        for (let i = 0; i < LOD.length; i++) {
            peak = Math.max(peak, Math.abs(LOD[i]));
        }


        while(LOD.length > 1000) {
            let nextLen = Math.floor(LOD.length/2);
            let nextLOD = new Float32Array(nextLen);

            /* This subsampling technique is a simple way to keep peaks visually obvious */
            for (let i = 0; i < nextLen; i++) {
                if (i%2 == 0) {
                    nextLOD[i] = Math.min(LOD[i*2], LOD[i*2 + 1]);
                } else {
                    nextLOD[i] = Math.max(LOD[i*2], LOD[i*2 + 1]);
                }
            }
            LODs.push(nextLOD);
            LOD = nextLOD;
        }
        channelLODs.push(LODs);
        peaks.push(peak);
    }
    return {
        duration: soundData.duration,
        channelLODs,
        peaks
    }
}