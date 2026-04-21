/**
 * kbarsing - 配置文件（纯前端化）
 * 音色、节奏、映射策略 - 从 settings.py 搬迁
 */

window.KbarokConfig = {
    // ==================== 音乐参数 ====================
    music: {
        sampleRate: 48000,
        baseInterval: 0.5,  // 2拍/秒 = 60BPM（慢速，适合K线节奏感）
        pitchRange: 36,
        velocityMin: 35,
        velocityMax: 115,
        defaultSpeed: 1.0,
        minSpeed: 0.5,
        maxSpeed: 5.0
    },

    // ==================== 音色列表（16种）====================
    instruments: [
        "Future_Bass_Lead",
        "Future_Bass_Pad", 
        "Amapiano_Log_Drum",
        "Afro_Conga",
        "DnB_Bass",
        "Synthwave_Juno",
        "Synthwave_Lead",
        "Retro_Pad",
        "KPop_Double_Bass",
        "KPop_Synth_Lead",
        "KPop_Vocal_Pad",
        "钢琴",
        "小提琴",
        "电吉他",
        "古筝",
        "二胡"
    ],

    // ==================== 节奏风格（8种）====================
    rhythmStyles: [
        "标准4拍",
        "KPop_精准鼓组",
        "Amapiano_非洲节奏",
        "Synthwave_复古迪斯科",
        "DnB_快节奏碎拍",
        "Afrobeats_世界风",
        "极简留白_缓拍",
        "史诗电影_慢板"
    ],

    // ==================== 合成预设 ====================
    synthPresets: {
        "合成1_Future_Bass": "Future_Bass_Lead",
        "合成2_KPop_Lead": "KPop_Synth_Lead",
        "合成3_Synthwave_复古": "Synthwave_Juno",
        "合成4_Amapiano_非洲底鼓": "Amapiano_Log_Drum",
        "合成5_DnB_电子贝斯": "DnB_Bass",
        "合成6_史诗垫音": "Retro_Pad",
        "合成7_KPop双低音": "KPop_Double_Bass",
        "合成8_空灵人声垫": "KPop_Vocal_Pad"
    },

    // ==================== 节奏模式定义 ====================
    rhythms: {
        "标准4拍": {
            kick:  [1,0,0,0, 1,0,0,0],
            snare: [0,0,1,0, 0,0,1,0],
            hihat: [0,1,0,1, 0,1,0,1],
            perc:  [0,0,0,0, 0,0,0,0]
        },
        "KPop_精准鼓组": {
            kick:  [1,0,0,1, 1,0,0,1],
            snare: [0,0,1,0, 0,0,1,1],
            hihat: [0,1,1,1, 0,1,1,1],
            perc:  [0,1,0,1, 1,0,1,0]
        },
        "Amapiano_非洲节奏": {
            kick:  [1,0,1,0, 0,1,0,1],
            snare: [0,0,1,0, 0,1,0,0],
            hihat: [1,1,1,1, 1,1,1,1],
            perc:  [1,0,1,0, 1,0,1,0]
        },
        "Synthwave_复古迪斯科": {
            kick:  [1,0,0,0, 1,0,1,0],
            snare: [0,0,1,0, 0,0,1,0],
            hihat: [0,1,1,1, 0,1,1,1],
            perc:  [0,0,1,0, 0,0,1,0]
        },
        "DnB_快节奏碎拍": {
            kick:  [1,0,0,1, 0,1,0,1],
            snare: [0,0,1,0, 1,0,0,1],
            hihat: [1,1,1,1, 1,1,1,1],
            perc:  [1,1,1,1, 1,1,1,1]
        },
        "Afrobeats_世界风": {
            kick:  [1,0,1,0, 1,0,0,1],
            snare: [0,0,1,0, 0,1,0,0],
            hihat: [1,1,0,1, 1,1,0,1],
            perc:  [1,0,1,1, 1,0,1,1]
        },
        "极简留白_缓拍": {
            kick:  [1,0,0,0, 0,0,1,0],
            snare: [0,0,0,0, 0,0,1,0],
            hihat: [0,1,0,1, 0,0,0,1],
            perc:  [0,0,0,0, 0,1,0,0]
        },
        "史诗电影_慢板": {
            kick:  [1,0,0,0, 0,0,0,0],
            snare: [0,0,0,0, 1,0,0,0],
            hihat: [0,0,1,0, 0,0,1,0],
            perc:  [0,0,0,0, 0,0,0,0]
        }
    },

    // ==================== 乐器音色定义 ====================
    instrumentConfigs: {
        // === Future Bass ===
        "Future_Bass_Lead": {
            waveform: "saw",
            harmonics: [1, 2, 3, 4, 5],
            adsr: { attack: 0.03, decay: 0.2, sustain: 0.85, release: 0.7 },
            filter: { type: "lowpass", cutoff: 3600, resonance: 0.6 },
            chorus: 1.0, reverb: 1.0, delay: 0.4,
            pan: 0.0, stereo: 0.9
        },
        "Future_Bass_Pad": {
            waveform: "sine",
            harmonics: [1, 1.5, 2, 3],
            adsr: { attack: 0.4, decay: 0.4, sustain: 0.9, release: 1.2 },
            filter: { type: "lowpass", cutoff: 1600, resonance: 0.4 },
            chorus: 1.0, reverb: 1.0, delay: 0.2,
            pan: 0.0, stereo: 1.0
        },
        // === Amapiano ===
        "Amapiano_Log_Drum": {
            waveform: "sine",
            harmonics: [1, 0.5, 0.25],
            adsr: { attack: 0.002, decay: 0.35, sustain: 0.5, release: 0.6 },
            filter: { type: "lowpass", cutoff: 220, resonance: 0.8 },
            subBass: 1.4, reverb: 0.3,
            pan: -0.6, octaveShift: -2
        },
        "Afro_Conga": {
            waveform: "triangle",
            harmonics: [1, 2],
            adsr: { attack: 0.001, decay: 0.06, sustain: 0.2, release: 0.08 },
            filter: { type: "bandpass", cutoff: 800, resonance: 0.5 },
            pan: 0.4
        },
        // === DnB ===
        "DnB_Bass": {
            waveform: "saw",
            harmonics: [1, 2, 3, 4, 5],
            adsr: { attack: 0.002, decay: 0.08, sustain: 0.8, release: 0.12 },
            filter: { type: "lowpass", cutoff: 900, resonance: 0.7 },
            distortion: 0.25, stereo: 0.7,
            pan: -0.3, octaveShift: -1
        },
        // === Synthwave ===
        "Synthwave_Juno": {
            waveform: "saw",
            harmonics: [1, 2, 3],
            adsr: { attack: 0.08, decay: 0.25, sustain: 0.75, release: 0.4 },
            filter: { type: "lowpass", cutoff: 2400, resonance: 0.5 },
            chorus: 1.0, stereo: 0.8,
            pan: 0.0
        },
        "Synthwave_Lead": {
            waveform: "square",
            harmonics: [1, 2, 3, 4],
            adsr: { attack: 0.02, decay: 0.15, sustain: 0.8, release: 0.3 },
            filter: { type: "lowpass", cutoff: 3800, resonance: 0.6 },
            chorus: 0.8, delay: 0.3,
            pan: 0.0, stereo: 0.85
        },
        "Retro_Pad": {
            waveform: "sine",
            harmonics: [1, 1.25, 1.5, 2],
            adsr: { attack: 0.5, decay: 0.4, sustain: 0.9, release: 1.4 },
            filter: { type: "lowpass", cutoff: 1400, resonance: 0.3 },
            chorus: 1.0, reverb: 1.0,
            pan: 0.0, stereo: 1.0
        },
        // === K-POP ===
        "KPop_Double_Bass": {
            waveform: "saw",
            harmonics: [1, 0.5, 2, 3],
            adsr: { attack: 0.003, decay: 0.07, sustain: 0.92, release: 0.15 },
            filter: { type: "lowpass", cutoff: 750, resonance: 0.7 },
            subBass: 1.3, distortion: 0.15,
            pan: -0.4, octaveShift: -1
        },
        "KPop_Synth_Lead": {
            waveform: "square",
            harmonics: [1, 2, 3, 5],
            adsr: { attack: 0.01, decay: 0.12, sustain: 0.85, release: 0.25 },
            filter: { type: "lowpass", cutoff: 4200, resonance: 0.6 },
            chorus: 0.6, reverb: 0.6,
            pan: 0.0, stereo: 0.9
        },
        "KPop_Vocal_Pad": {
            waveform: "sine",
            harmonics: [1, 1.5],
            adsr: { attack: 0.25, decay: 0.25, sustain: 0.9, release: 0.9 },
            filter: { type: "lowpass", cutoff: 1100, resonance: 0.3 },
            chorus: 1.0, reverb: 1.0,
            pan: 0.0, stereo: 1.0
        },
        // === 传统乐器 ===
        "钢琴": {
            waveform: "triangle",
            harmonics: [1, 2, 4],
            adsr: { attack: 0.005, decay: 0.15, sustain: 0.75, release: 0.4 },
            reverb: { roomSize: 0.3 },
            pan: 0.0
        },
        "小提琴": {
            waveform: "saw",
            harmonics: [1, 2, 3],
            adsr: { attack: 0.05, decay: 0.1, sustain: 0.8, release: 0.3 },
            pan: -0.2
        },
        "电吉他": {
            waveform: "square",
            harmonics: [1, 3],
            adsr: { attack: 0.005, decay: 0.1, sustain: 0.6, release: 0.15 },
            pan: 0.2
        },
        "古筝": {
            waveform: "triangle",
            harmonics: [1, 2, 3, 5],
            adsr: { attack: 0.008, decay: 0.4, sustain: 0.5, release: 0.6 },
            reverb: { roomSize: 0.5 },
            pan: 0.0
        },
        "二胡": {
            waveform: "saw",
            harmonics: [1, 2, 3],
            adsr: { attack: 0.02, decay: 0.15, sustain: 0.8, release: 0.3 },
            vibrato: { rate: 5, depth: 0.02 },
            pan: -0.1
        }
    },

    // ==================== 映射策略 ====================
    mapping: {
        priceToPitch: {
            minPitch: 45,
            maxPitch: 88,
            scale: "pentatonic"  // pentatonic | major | minor
        },
        volumeToVelocity: {
            minVelocity: 35,
            maxVelocity: 115
        },
        volatilityToDuration: {
            minDuration: 0.3,
            maxDuration: 1.5
        }
    },

    // ==================== 音阶定义 ====================
    scales: {
        pentatonic: [0, 2, 4, 7, 9],      // 五声音阶
        major: [0, 2, 4, 5, 7, 9, 11],    // 大调
        minor: [0, 2, 3, 5, 7, 8, 10]     // 小调
    },

    // ==================== 动态映射 ====================
    dynamics: {
        pp: { velocityMult: 0.35, harmonicMult: 0.65 },
        p:  { velocityMult: 0.55, harmonicMult: 0.80 },
        mp: { velocityMult: 0.70, harmonicMult: 0.90 },
        mf: { velocityMult: 0.85, harmonicMult: 1.00 },
        f:  { velocityMult: 0.95, harmonicMult: 1.10 },
        ff: { velocityMult: 1.00, harmonicMult: 1.15 }
    },

    // ==================== 音色映射（涨跌）====================
    timbreMappings: {
        bright: {
            filterCutoffMult: 1.45,
            resonanceMult: 1.2,
            reverbMult: 1.2,
            chorusMult: 1.2
        },
        dark: {
            filterCutoffMult: 0.65,
            resonanceMult: 0.85,
            reverbMult: 0.8,
            chorusMult: 0.7
        },
        normal: {
            filterCutoffMult: 1.0,
            resonanceMult: 1.0,
            reverbMult: 1.0,
            chorusMult: 1.0
        }
    }
};

console.log('[Config] KbarokConfig loaded, instruments:', KbarokConfig.instruments.length);
