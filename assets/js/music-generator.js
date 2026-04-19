/**
 * K-baroK 纯前端音乐生成器
 * 基于 Web Audio API，无需后端
 * 移植自 Python AdvancedMusicGenerator
 */

class MusicGenerator {
    constructor() {
        this.sampleRate = 48000;
        this.speed = 1.0;
        this.instrument = '钢琴';
        
        // 音频上下文（延迟初始化）
        this.audioContext = null;
        
        // 乐器配置
        this.instruments = this._getInstrumentConfigs();
        
        // 节奏配置
        this.rhythmStyles = this._getRhythmStyles();
        
        // 映射策略
        this.mappingStrategies = {
            priceToPitch: { minPitch: 45, maxPitch: 88, scale: 'pentatonic' },
            volumeToVelocity: { minVelocity: 35, maxVelocity: 115 },
            volatilityToDuration: { minDuration: 0.2, maxDuration: 1.2 }
        };
        
        console.log('[MusicGenerator] 初始化完成');
    }
    
    // ==================== 配置 ====================
    
    _getInstrumentConfigs() {
        return {
            "钢琴": {
                waveform: 'sine',
                harmonics: [1],
                adsr: { attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.2 },
                pan: 0.0
            },
            "古筝": {
                waveform: 'triangle',
                harmonics: [1, 3, 5],
                adsr: { attack: 0.01, decay: 0.3, sustain: 0.4, release: 0.4 },
                pan: 0.0
            },
            "小提琴": {
                waveform: 'sawtooth',
                harmonics: [1, 2, 3],
                adsr: { attack: 0.05, decay: 0.1, sustain: 0.8, release: 0.3 },
                pan: -0.2
            },
            "电吉他": {
                waveform: 'square',
                harmonics: [1, 3],
                adsr: { attack: 0.005, decay: 0.1, sustain: 0.6, release: 0.15 },
                pan: 0.2
            },
            // 潮流音色
            "Future_Bass_Lead": {
                waveform: 'sawtooth',
                harmonics: [1, 2, 3, 4, 5],
                adsr: { attack: 0.03, decay: 0.2, sustain: 0.85, release: 0.7 },
                filter: { type: 'lowpass', cutoff: 3600, resonance: 0.6 },
                pan: 0.0
            },
            "KPop_Synth_Lead": {
                waveform: 'square',
                harmonics: [1, 2, 3, 5],
                adsr: { attack: 0.01, decay: 0.12, sustain: 0.85, release: 0.25 },
                filter: { type: 'lowpass', cutoff: 4200, resonance: 0.6 },
                pan: 0.0
            },
            "Amapiano_Log_Drum": {
                waveform: 'sine',
                harmonics: [1, 0.5, 0.25],
                adsr: { attack: 0.002, decay: 0.35, sustain: 0.5, release: 0.6 },
                filter: { type: 'lowpass', cutoff: 220, resonance: 0.8 },
                pan: -0.6,
                octaveShift: -2
            }
        };
    }
    
    _getRhythmStyles() {
        return {
            "标准4拍": {
                kick: [1,0,0,0, 1,0,0,0],
                snare: [0,0,1,0, 0,0,1,0],
                hihat: [0,1,0,1, 0,1,0,1]
            },
            "KPop_精准鼓组": {
                kick: [1,0,0,1, 1,0,0,1],
                snare: [0,0,1,0, 0,0,1,1],
                hihat: [0,1,1,1, 0,1,1,1]
            },
            "Amapiano_非洲节奏": {
                kick: [1,0,1,0, 0,1,0,1],
                snare: [0,0,1,0, 0,1,0,0],
                hihat: [1,1,1,1, 1,1,1,1]
            },
            "Synthwave_复古迪斯科": {
                kick: [1,0,0,0, 1,0,1,0],
                snare: [0,0,1,0, 0,0,1,0],
                hihat: [0,1,1,1, 0,1,1,1]
            }
        };
    }
    
    // ==================== 初始化音频上下文 ====================
    
    _initAudioContext() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            console.log('[MusicGenerator] AudioContext 初始化, sampleRate:', this.audioContext.sampleRate);
        }
        return this.audioContext;
    }
    
    // ==================== 音阶量化 ====================
    
    _quantizeToScale(pitch, scaleIntervals) {
        const octave = Math.floor(pitch / 12);
        const noteInOctave = pitch % 12;
        
        let closest = scaleIntervals[0];
        let minDist = Math.abs(scaleIntervals[0] - noteInOctave);
        
        for (const interval of scaleIntervals) {
            const dist = Math.abs(interval - noteInOctave);
            if (dist < minDist) {
                minDist = dist;
                closest = interval;
            }
        }
        
        return octave * 12 + closest;
    }
    
    _applyPentatonicScale(pitches) {
        const pentatonic = [0, 2, 4, 7, 9];
        return pitches.map(p => this._quantizeToScale(p, pentatonic));
    }
    
    _applyMajorScale(pitches) {
        const major = [0, 2, 4, 5, 7, 9, 11];
        return pitches.map(p => this._quantizeToScale(p, major));
    }
    
    _applyMinorScale(pitches) {
        const minor = [0, 2, 3, 5, 7, 8, 10];
        return pitches.map(p => this._quantizeToScale(p, minor));
    }
    
    // ==================== 映射函数 ====================
    
    _mapPriceToPitch(prices) {
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        
        if (max === min) {
            return prices.map(() => 60);
        }
        
        const normalized = prices.map(p => (p - min) / (max - min));
        const { minPitch, maxPitch, scale } = this.mappingStrategies.priceToPitch;
        
        let pitches = normalized.map(n => minPitch + n * (maxPitch - minPitch));
        
        // 应用音阶
        if (scale === 'pentatonic') {
            pitches = this._applyPentatonicScale(pitches);
        } else if (scale === 'major') {
            pitches = this._applyMajorScale(pitches);
        } else if (scale === 'minor') {
            pitches = this._applyMinorScale(pitches);
        }
        
        // 八度偏移
        const instConfig = this.instruments[this.instrument] || {};
        const octaveShift = instConfig.octaveShift || 0;
        pitches = pitches.map(p => p + octaveShift);
        
        return pitches.map(p => Math.round(p));
    }
    
    _mapVolumeToVelocity(volumes) {
        const min = Math.min(...volumes);
        const max = Math.max(...volumes);
        
        if (max === min) {
            return volumes.map(() => 80);
        }
        
        const normalized = volumes.map(v => (v - min) / (max - min));
        const { minVelocity, maxVelocity } = this.mappingStrategies.volumeToVelocity;
        
        return normalized.map(n => Math.round(minVelocity + n * (maxVelocity - minVelocity)));
    }
    
    _mapVolatilityToDuration(volatilities) {
        const min = Math.min(...volatilities);
        const max = Math.max(...volatilities);
        
        const normalized = volatilities.map(v => 
            max === min ? 0.5 : (v - min) / (max - min)
        );
        
        const { minDuration, maxDuration } = this.mappingStrategies.volatilityToDuration;
        
        return normalized.map(n => (minDuration + (1 - n) * (maxDuration - minDuration)) / this.speed);
    }
    
    // ==================== 音符生成 ====================
    
    dataToNotes(df) {
        const notes = [];
        const n = df.close.length;
        
        // 计算映射
        const pitches = this._mapPriceToPitch(df.close);
        const velocities = this._mapVolumeToVelocity(df.volume);
        const durations = this._mapVolatilityToDuration(df.volatility || df.close.map(() => 0.02));
        
        // 涨跌幅 → 音色
        const timbres = df.pctChg.map(p => p > 0 ? 'bright' : 'dark');
        
        const baseInterval = 0.5 / this.speed;
        
        for (let i = 0; i < n; i++) {
            const pitch = pitches[i];
            const velocity = velocities[i];
            let duration = durations[i];
            const timbre = timbres[i];
            const pct = df.pctChg[i] || 0;
            
            const noteTime = i * baseInterval;
            
            // 主音符
            notes.push({
                time: noteTime,
                duration: duration,
                pitch: pitch,
                velocity: velocity,
                timbre: timbre,
                pct: pct
            });
            
            // 和弦音（大幅涨跌时添加）
            if (pct > 2.5) {
                notes.push({
                    time: noteTime + 0.05 / this.speed,
                    duration: duration * 0.5,
                    pitch: pitch + 4,
                    velocity: Math.round(velocity * 0.3),
                    timbre: 'bright',
                    pct: pct
                });
            } else if (pct < -2.5) {
                notes.push({
                    time: noteTime + 0.05 / this.speed,
                    duration: duration * 0.5,
                    pitch: pitch - 3,
                    velocity: Math.round(velocity * 0.3),
                    timbre: 'dark',
                    pct: pct
                });
            }
        }
        
        console.log(`[MusicGenerator] 生成 ${notes.length} 个音符`);
        return notes;
    }
    
    // ==================== 波形生成（Web Audio） ====================
    
    _pitchToFreq(pitch) {
        return 440 * Math.pow(2, (pitch - 69) / 12);
    }
    
    _createOscillator(ctx, freq, waveform, harmonics = [1]) {
        // 使用多个振荡器模拟谐波
        const oscillators = [];
        const gains = [];
        
        for (let i = 0; i < Math.min(harmonics.length, 5); i++) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.frequency.value = freq * harmonics[i];
            osc.type = waveform;
            
            // 谐波增益递减
            gain.gain.value = 1 / (i + 1);
            
            osc.connect(gain);
            oscillators.push(osc);
            gains.push(gain);
        }
        
        return { oscillators, gains };
    }
    
    _applyADSR(gainNode, startTime, duration, adsr, velocity) {
        const ctx = gainNode.context;
        const vel = (velocity / 127) * 0.5;
        
        const attackEnd = startTime + adsr.attack;
        const decayEnd = attackEnd + adsr.decay;
        const releaseStart = startTime + duration - adsr.release;
        
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(vel, attackEnd);
        gainNode.gain.linearRampToValueAtTime(vel * adsr.sustain, decayEnd);
        gainNode.gain.setValueAtTime(vel * adsr.sustain, releaseStart);
        gainNode.gain.linearRampToValueAtTime(0, startTime + duration);
    }
    
    // ==================== 音频生成 ====================
    
    async generateAudio(df, instrumentName = '钢琴', rhythmStyle = '标准4拍') {
        const ctx = this._initAudioContext();
        
        // 设置乐器
        this.instrument = instrumentName;
        const instConfig = this.instruments[instrumentName] || this.instruments['钢琴'];
        
        // 生成音符
        const notes = this.dataToNotes(df);
        
        if (notes.length === 0) {
            console.warn('[MusicGenerator] 没有生成任何音符');
            return null;
        }
        
        // 计算总时长
        const totalTime = Math.max(...notes.map(n => n.time + n.duration)) + 0.5;
        
        // 创建离线音频上下文（用于生成 AudioBuffer）
        const offlineCtx = new OfflineAudioContext(2, Math.ceil(totalTime * ctx.sampleRate), ctx.sampleRate);
        
        // 主音轨
        for (const note of notes) {
            const freq = this._pitchToFreq(note.pitch);
            const { oscillators, gains } = this._createOscillator(offlineCtx, freq, instConfig.waveform, instConfig.harmonics);
            
            // 创建主增益节点（ADSR）
            const masterGain = offlineCtx.createGain();
            
            // 连接所有谐波增益到主增益
            for (const gain of gains) {
                gain.connect(masterGain);
            }
            
            // 添加滤波器（如果配置）
            let lastNode = masterGain;
            if (instConfig.filter) {
                const filter = offlineCtx.createBiquadFilter();
                filter.type = instConfig.filter.type;
                filter.frequency.value = instConfig.filter.cutoff;
                filter.Q.value = instConfig.filter.resonance * 10;
                masterGain.connect(filter);
                lastNode = filter;
            }
            
            // 连接到输出
            lastNode.connect(offlineCtx.destination);
            
            // 应用 ADSR
            this._applyADSR(masterGain, note.time, note.duration, instConfig.adsr, note.velocity);
            
            // 启动和停止振荡器
            for (const osc of oscillators) {
                osc.start(note.time);
                osc.stop(note.time + note.duration);
            }
        }
        
        // 生成节奏层
        const rhythm = this.rhythmStyles[rhythmStyle] || this.rhythmStyles['标准4拍'];
        await this._addRhythmLayer(offlineCtx, rhythm, totalTime);
        
        // 渲染音频
        const audioBuffer = await offlineCtx.startRendering();
        
        console.log(`[MusicGenerator] 音频生成完成: ${totalTime.toFixed(2)}秒`);
        
        return {
            audioBuffer,
            duration: totalTime,
            sampleRate: ctx.sampleRate
        };
    }
    
    // ==================== 节奏层 ====================
    
    async _addRhythmLayer(ctx, rhythm, totalTime) {
        const bpm = 128;
        const beatDuration = 60.0 / bpm;
        const numBeats = Math.ceil(totalTime / beatDuration);
        
        for (let i = 0; i < numBeats; i++) {
            const beatTime = i * beatDuration;
            const beatIdx = i % rhythm.kick.length;
            
            // Kick
            if (rhythm.kick[beatIdx]) {
                this._createDrumHit(ctx, 'kick', beatTime, 0.4);
            }
            
            // Snare
            if (rhythm.snare[beatIdx]) {
                this._createDrumHit(ctx, 'snare', beatTime, 0.35);
            }
            
            // Hi-hat
            if (rhythm.hihat[beatIdx]) {
                this._createDrumHit(ctx, 'hihat', beatTime, 0.15);
            }
        }
    }
    
    _createDrumHit(ctx, type, time, volume) {
        const duration = type === 'hihat' ? 0.12 : 0.25;
        
        if (type === 'kick') {
            // 808 风格底鼓
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.frequency.setValueAtTime(55, time);
            osc.frequency.exponentialRampToValueAtTime(30, time + 0.1);
            
            gain.gain.setValueAtTime(volume * 0.7, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            osc.start(time);
            osc.stop(time + duration);
            
        } else if (type === 'snare') {
            // 军鼓（噪声 + 正弦）
            const bufferSize = Math.ceil(duration * ctx.sampleRate);
            const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const noiseData = noiseBuffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                noiseData[i] = Math.random() * 2 - 1;
            }
            
            const noise = ctx.createBufferSource();
            noise.buffer = noiseBuffer;
            
            const noiseGain = ctx.createGain();
            noiseGain.gain.setValueAtTime(volume * 0.3, time);
            noiseGain.gain.exponentialRampToValueAtTime(0.001, time + duration);
            
            noise.connect(noiseGain);
            noiseGain.connect(ctx.destination);
            noise.start(time);
            noise.stop(time + duration);
            
            // 正弦成分
            const osc = ctx.createOscillator();
            const oscGain = ctx.createGain();
            
            osc.frequency.value = 180;
            oscGain.gain.setValueAtTime(volume * 0.5, time);
            oscGain.gain.exponentialRampToValueAtTime(0.001, time + duration);
            
            osc.connect(oscGain);
            oscGain.connect(ctx.destination);
            osc.start(time);
            osc.stop(time + duration);
            
        } else if (type === 'hihat') {
            // 高频噪声
            const bufferSize = Math.ceil(duration * ctx.sampleRate);
            const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const noiseData = noiseBuffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                noiseData[i] = Math.random() * 2 - 1;
            }
            
            const noise = ctx.createBufferSource();
            noise.buffer = noiseBuffer;
            
            // 高通滤波
            const filter = ctx.createBiquadFilter();
            filter.type = 'highpass';
            filter.frequency.value = 8000;
            
            const gain = ctx.createGain();
            gain.gain.setValueAtTime(volume * 0.12, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
            
            noise.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);
            noise.start(time);
            noise.stop(time + duration);
        }
    }
    
    // ==================== 播放接口 ====================
    
    play(audioBuffer) {
        const ctx = this._initAudioContext();
        
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        source.start(0);
        
        return source;
    }
    
    // ==================== 配置接口 ====================
    
    setSpeed(speed) {
        this.speed = Math.max(0.5, Math.min(5.0, speed));
        console.log(`[MusicGenerator] 速度设置为: ${this.speed}x`);
    }
    
    setInstrument(instrument) {
        if (this.instruments[instrument]) {
            this.instrument = instrument;
            console.log(`[MusicGenerator] 乐器切换为: ${instrument}`);
            return true;
        }
        console.warn(`[MusicGenerator] 未知乐器: ${instrument}`);
        return false;
    }
    
    // ==================== 获取可用配置 ====================
    
    getInstruments() {
        return Object.keys(this.instruments);
    }
    
    getRhythmStyles() {
        return Object.keys(this.rhythmStyles);
    }
}

// 导出到全局
window.MusicGenerator = MusicGenerator;

console.log('[MusicGenerator] 模块加载完成');
