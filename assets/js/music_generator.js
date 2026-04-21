/**
 * kbarsing - 音乐生成模块（纯前端化）
 * NumPy/SciPy → Web Audio API
 * 
 * 核心功能：
 * - 价格 → 音高（五声音阶量化）
 * - 成交量 → 力度
 * - 波动率 → 音符时长
 * - 波形合成（sine/saw/square/triangle）
 * - ADSR包络
 * - 滤波器（lowpass/bandpass）
 * - 节奏层（kick/snare/hihat）
 */

const MusicGenerator = (function() {
    // ==================== 常量 ====================
    const SAMPLE_RATE = 48000;
    const MIDI_A4 = 69;
    const FREQ_A4 = 440;

    // ==================== 工具函数 ====================
    
    // MIDI音符号 → 频率
    function midiToFreq(midi) {
        return FREQ_A4 * Math.pow(2, (midi - MIDI_A4) / 12);
    }

    // 量化到音阶
    function quantizeToScale(pitch, scale) {
        const octave = Math.floor(pitch / 12);
        const noteInOctave = pitch % 12;
        let closest = scale[0];
        let minDist = 12;
        
        for (const note of scale) {
            const dist = Math.abs(note - noteInOctave);
            if (dist < minDist) {
                minDist = dist;
                closest = note;
            }
        }
        
        return octave * 12 + closest;
    }

    // 五声音阶
    const SCALES = {
        pentatonic: [0, 2, 4, 7, 9],
        major: [0, 2, 4, 5, 7, 9, 11],
        minor: [0, 2, 3, 5, 7, 8, 10]
    };

    // ==================== 数据映射 ====================
    
    /**
     * 价格 → 音高映射
     */
    function mapPriceToPitch(closes, config) {
        const minPitch = config.minPitch || 45;
        const maxPitch = config.maxPitch || 88;
        const scaleName = config.scale || 'pentatonic';
        const scale = SCALES[scaleName] || SCALES.pentatonic;
        
        const min = Math.min(...closes);
        const max = Math.max(...closes);
        const range = max - min || 1;
        
        return closes.map(c => {
            const normalized = (c - min) / range;
            const rawPitch = minPitch + normalized * (maxPitch - minPitch);
            return quantizeToScale(Math.round(rawPitch), scale);
        });
    }

    /**
     * 成交量 → 力度映射
     */
    function mapVolumeToVelocity(volumes, config) {
        const minVel = config.minVelocity || 35;
        const maxVel = config.maxVelocity || 115;
        
        const min = Math.min(...volumes);
        const max = Math.max(...volumes);
        const range = max - min || 1;
        
        return volumes.map(v => {
            const normalized = (v - min) / range;
            return Math.round(minVel + normalized * (maxVel - minVel));
        });
    }

    /**
     * 波动率 → 音符时长映射
     */
    function mapVolatilityToDuration(closes, config, speed) {
        const minDur = config.minDuration || 0.1;
        const maxDur = config.maxDuration || 0.4;
        
        // 计算波动率（收盘价变化率）
        const volatilities = closes.map((c, i) => {
            if (i === 0) return 0;
            const prev = closes[i - 1];
            return Math.abs((c - prev) / prev);
        });
        
        const min = Math.min(...volatilities.slice(1));
        const max = Math.max(...volatilities.slice(1));
        const range = max - min || 1;
        
        return volatilities.map((v, i) => {
            if (i === 0) return maxDur / speed;
            const normalized = (v - min) / range;
            // 波动大 → 音符短，波动小 → 音符长（但总体更短，更连贯）
            return (minDur + (1 - normalized) * (maxDur - minDur)) / speed;
        });
    }

    /**
     * 涨跌 → 音色（bright/dark）
     */
    function mapChangeToTimbre(closes) {
        return closes.map((c, i) => {
            if (i === 0) return 'normal';
            return c >= closes[i - 1] ? 'bright' : 'dark';
        });
    }

    // ==================== Web Audio 波形合成 ====================
    
    /**
     * 创建振荡器
     */
    function createOscillator(ctx, type, freq) {
        const osc = ctx.createOscillator();
        osc.type = type; // 'sine', 'sawtooth', 'square', 'triangle'
        osc.frequency.value = freq;
        return osc;
    }

    /**
     * 创建 ADSR 包络
     */
    function createADSR(ctx, attack, decay, sustain, release, duration, startTime) {
        const gain = ctx.createGain();
        const now = startTime || ctx.currentTime;
        
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(1, now + attack);
        gain.gain.linearRampToValueAtTime(sustain, now + attack + decay);
        gain.gain.setValueAtTime(sustain, now + attack + decay + duration);
        gain.gain.linearRampToValueAtTime(0, now + attack + decay + duration + release);
        
        return gain;
    }

    /**
     * 创建滤波器
     */
    function createFilter(ctx, type, cutoff, resonance) {
        const filter = ctx.createBiquadFilter();
        filter.type = type; // 'lowpass', 'highpass', 'bandpass'
        filter.frequency.value = cutoff;
        filter.Q.value = resonance;
        return filter;
    }

    /**
     * 播放单个音符
     */
    function playNote(ctx, pitch, duration, velocity, instConfig, startTime, timbre) {
        const freq = midiToFreq(pitch);
        const velocityGain = velocity / 127;
        
        // 八度偏移
        const octaveShift = instConfig.octaveShift || 0;
        const shiftedFreq = freq * Math.pow(2, octaveShift);
        
        // 创建主振荡器
        const oscType = instConfig.waveform || 'sine';
        const osc = createOscillator(ctx, oscType, shiftedFreq);
        
        // ADSR
        const adsr = instConfig.adsr || { attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.2 };
        const envelope = createADSR(ctx, adsr.attack, adsr.decay, adsr.sustain * velocityGain, adsr.release, duration, startTime);
        
        // 滤波器
        let filterConfig = instConfig.filter || { type: 'lowpass', cutoff: 5000, resonance: 1 };
        
        // 根据涨跌调整音色
        if (timbre === 'bright' && instConfig.filter) {
            filterConfig = {
                ...filterConfig,
                cutoff: filterConfig.cutoff * 1.45
            };
        } else if (timbre === 'dark' && instConfig.filter) {
            filterConfig = {
                ...filterConfig,
                cutoff: filterConfig.cutoff * 0.65
            };
        }
        
        const filter = createFilter(ctx, filterConfig.type || 'lowpass', filterConfig.cutoff, filterConfig.resonance || 1);
        
        // 主增益（柔和，避免削波）
        const masterGain = ctx.createGain();
        masterGain.gain.value = 0.5;
        
        // 声像
        const panner = ctx.createStereoPanner();
        panner.pan.value = instConfig.pan || 0;
        
        // 连接节点
        osc.connect(filter);
        filter.connect(envelope);
        envelope.connect(masterGain);
        masterGain.connect(panner);
        panner.connect(window._kbarokMasterGain);
        
        // 调度播放：音符持续时间至少 = baseInterval（一个节拍），确保ADSR的sustain阶段生效
        // 原来 duration 很短导致音符在 attack/decay 就结束了，听起来像敲击声
        // baseInterval 从 config 读取
        const beatInterval = KbarokConfig.music.baseInterval || 0.25;
        const noteDuration = Math.max(beatInterval, duration);
        osc.start(startTime);
        osc.stop(startTime + noteDuration + adsr.attack + adsr.decay + adsr.release);
        
        return { osc, envelope, filter, masterGain, panner };
    }

    // ==================== 节奏层 ====================
    
    /**
     * 生成鼓点
     */
    function playDrumHit(ctx, type, startTime, volume) {
        const now = startTime || ctx.currentTime;
        const vol = volume || 0.3;
        
        if (type === 'kick') {
            // 808 风格底鼓
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.exponentialRampToValueAtTime(40, now + 0.1);
            
            gain.gain.setValueAtTime(vol, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
            
            osc.connect(gain);
            gain.connect(window._kbarokMasterGain);
            
            osc.start(now);
            osc.stop(now + 0.3);
            
        } else if (type === 'snare') {
            // 军鼓（噪声 + 音调）
            const noise = ctx.createBufferSource();
            const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
            const noiseData = noiseBuffer.getChannelData(0);
            for (let i = 0; i < noiseData.length; i++) {
                noiseData[i] = Math.random() * 2 - 1;
            }
            noise.buffer = noiseBuffer;
            
            const noiseGain = ctx.createGain();
            noiseGain.gain.setValueAtTime(vol * 0.5, now);
            noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
            
            const noiseFilter = ctx.createBiquadFilter();
            noiseFilter.type = 'highpass';
            noiseFilter.frequency.value = 1000;
            
            noise.connect(noiseFilter);
            noiseFilter.connect(noiseGain);
            noiseGain.connect(window._kbarokMasterGain);
            
            noise.start(now);
            noise.stop(now + 0.2);
            
        } else if (type === 'hihat') {
            // 踩镲（高频噪声）
            const noise = ctx.createBufferSource();
            const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
            const noiseData = noiseBuffer.getChannelData(0);
            for (let i = 0; i < noiseData.length; i++) {
                noiseData[i] = Math.random() * 2 - 1;
            }
            noise.buffer = noiseBuffer;
            
            const gain = ctx.createGain();
            gain.gain.setValueAtTime(vol * 0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.03);
            
            const filter = ctx.createBiquadFilter();
            filter.type = 'highpass';
            filter.frequency.value = 7000;
            
            noise.connect(filter);
            filter.connect(gain);
            gain.connect(window._kbarokMasterGain);
            
            noise.start(now);
            noise.stop(now + 0.05);
            
        } else if (type === 'perc') {
            // 打击乐（短促噪声）
            const noise = ctx.createBufferSource();
            const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate);
            const noiseData = noiseBuffer.getChannelData(0);
            for (let i = 0; i < noiseData.length; i++) {
                noiseData[i] = Math.random() * 2 - 1;
            }
            noise.buffer = noiseBuffer;
            
            const gain = ctx.createGain();
            gain.gain.setValueAtTime(vol * 0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);
            
            const filter = ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = 2000;
            filter.Q.value = 2;
            
            noise.connect(filter);
            filter.connect(gain);
            gain.connect(window._kbarokMasterGain);
            
            noise.start(now);
            noise.stop(now + 0.08);
        }
    }

    /**
     * 播放节奏层
     */
    function playRhythmLayer(ctx, rhythmName, totalBars, baseBeatDuration, startTime) {
        const rhythm = KbarokConfig.rhythms[rhythmName] || KbarokConfig.rhythms['标准4拍'];
        const now = startTime || ctx.currentTime;
        
        // 每小节8拍
        const beatsPerBar = 8;
        const beatDuration = baseBeatDuration / (beatsPerBar / 4); // 四分音符为基准
        
        // 节奏稀疏化：只保留部分强拍，避免过度拥挤
        // 密度降低到原来的 40%，让旋律有呼吸空间
        for (let bar = 0; bar < totalBars; bar++) {
            for (let beat = 0; beat < beatsPerBar; beat++) {
                const beatTime = now + (bar * beatsPerBar + beat) * beatDuration;
                const idx = beat % beatsPerBar;
                
                // 只在强拍触发（kick 在 1/3拍，snare 在 2/4拍，hihat 只在奇数拍）
                if (rhythm.kick[idx] && (idx === 0 || idx === 2)) {
                    playDrumHit(ctx, 'kick', beatTime, 0.25);
                }
                if (rhythm.snare[idx] && (idx === 2 || idx === 6)) {
                    playDrumHit(ctx, 'snare', beatTime, 0.2);
                }
                if (rhythm.hihat[idx] && (idx % 2 === 0)) {
                    playDrumHit(ctx, 'hihat', beatTime, 0.1);
                }
                if (rhythm.perc[idx] && (idx === 1 || idx === 5)) {
                    playDrumHit(ctx, 'perc', beatTime, 0.08);
                }
            }
        }
    }

    // ==================== 缓存（循环复用） ====================
    let _cachedBuffer = null;   // AudioBuffer，预渲染结果
    let _cachedDuration = 0;    // 音乐时长（秒）

    // ==================== 内部：用 OfflineAudioContext 渲染音符到 buffer ====================
    async function _renderToBuffer(klineData, options = {}) {
        const {
            instrument = '钢琴',
            rhythmStyle = '标准4拍',
            speed = 1.0,
        } = options;

        const instConfig = KbarokConfig.instrumentConfigs[instrument] || KbarokConfig.instrumentConfigs['钢琴'];
        const mappingConfig = KbarokConfig.mapping;
        const baseInterval = KbarokConfig.music.baseInterval / speed;

        const pitches    = mapPriceToPitch(klineData.closes, mappingConfig.priceToPitch);
        const rawVel     = mapVolumeToVelocity(klineData.volumes, mappingConfig.volumeToVelocity);
        const velocities = rawVel.map(v => Math.max(0.2, Math.min(0.65, v * 0.7)));
        const durations  = mapVolatilityToDuration(klineData.closes, mappingConfig.volatilityToDuration, speed);
        const timbres    = mapChangeToTimbre(klineData.closes);
        const totalBars  = Math.ceil(pitches.length / 8);

        // 估算总时长
        const totalDuration = pitches.length * baseInterval + 2.0;
        const SR = 48000;

        console.log('[Music] OfflineAudioContext 渲染，时长:', totalDuration.toFixed(1), 's，音符数:', pitches.length);

        const offCtx = new OfflineAudioContext(2, Math.ceil(totalDuration * SR), SR);

        // offline masterGain
        const masterGain = offCtx.createGain();
        masterGain.gain.value = 0.7;
        masterGain.connect(offCtx.destination);
        window._kbarokMasterGain = masterGain; // 临时挂载供 playNote/playDrumHit 使用

        const startTime = 0.05;
        let currentTime = startTime;
        for (let i = 0; i < pitches.length; i++) {
            playNote(offCtx, pitches[i], baseInterval, velocities[i], instConfig, currentTime, timbres[i]);
            currentTime += baseInterval;
        }
        playRhythmLayer(offCtx, rhythmStyle, totalBars, baseInterval * 8, startTime);

        const buffer = await offCtx.startRendering();
        console.log('[Music] 渲染完成，buffer时长:', buffer.duration.toFixed(2), 's');
        return { buffer, duration: buffer.duration };
    }

    // ==================== 主生成函数 ====================
    /**
     * 从K线数据生成音乐，首次渲染buffer，之后循环复用
     * @returns {Object} { ctx, duration, startTime, stop() }
     */
    async function generate(klineData, options = {}) {
        const { reuseContext = false } = options;

        if (!klineData || !klineData.closes || klineData.closes.length === 0) {
            console.error('[Music] 无效的K线数据');
            return null;
        }

        // ---- 首次：渲染 buffer；循环：直接复用 ----
        if (!reuseContext || !_cachedBuffer) {
            const rendered = await _renderToBuffer(klineData, options);
            _cachedBuffer  = rendered.buffer;
            _cachedDuration = rendered.duration;
        } else {
            console.log('[Music] 循环复用 buffer，跳过渲染');
        }

        // ---- AudioContext 管理 ----
        let ctx;
        if (reuseContext && window._kbarokAudioCtx && window._kbarokAudioCtx.state !== 'closed') {
            ctx = window._kbarokAudioCtx;
            if (ctx.state === 'suspended') await ctx.resume();
        } else {
            if (window._kbarokAudioCtx && window._kbarokAudioCtx.state !== 'closed') {
                try { await window._kbarokAudioCtx.close(); } catch(e) {}
            }
            ctx = new (window.AudioContext || window.webkitAudioContext)();
            window._kbarokAudioCtx = ctx;
        }

        // ---- 停止旧 source（在任何操作之前先停止） ----
        if (window._kbarokBufferSource) {
            try { window._kbarokBufferSource.stop(); } catch(e) {}
            window._kbarokBufferSource = null;
        }

        // masterGain + 录制流（复用时不重建）
        let masterGain;
        if (reuseContext && window._kbarokMasterGain) {
            masterGain = window._kbarokMasterGain;
            console.log('[Music] 复用现有 masterGain');
        } else {
            if (window._kbarokMasterGain) {
                try { window._kbarokMasterGain.disconnect(); } catch(e) {}
            }
            masterGain = ctx.createGain();
            masterGain.gain.value = 0.7;
            masterGain.connect(ctx.destination);
            const mediaStreamDest = ctx.createMediaStreamDestination();
            window._kbarokMediaStream = mediaStreamDest.stream;
            masterGain.connect(mediaStreamDest);
            window._kbarokMasterGain = masterGain;
            console.log('[Music] 创建新 masterGain');
        }

        // 确保 running
        if (ctx.state === 'suspended') { try { await ctx.resume(); } catch(e) {} }
        let w = 0;
        while (ctx.state !== 'running' && w++ < 50) await new Promise(r => setTimeout(r, 10));
        console.log('[Music] AudioContext ready:', ctx.state);

        // ---- 播放 buffer（单次，不loop；由 kline.js onLoop 控制循环） ----
        const source = ctx.createBufferSource();
        source.buffer = _cachedBuffer;
        source.loop   = false;   // kline.js 的 onLoop 负责循环，保持K线同步
        source.connect(masterGain);

        const startTime = ctx.currentTime + 0.05;
        source.start(startTime);
        window._kbarokBufferSource = source;

        console.log('[Music] buffer 播放开始，时长:', _cachedDuration.toFixed(2), 's');

        return {
            ctx,
            duration: _cachedDuration,
            startTime,
            stop: () => {
                try { source.stop(); } catch(e) {}
                try { ctx.suspend(); } catch(e) {}
            }
        };
    }

    /**
     * 从K线数据生成并返回 AudioBuffer（供录制/导出使用）
     */
    async function generateBuffer(klineData, options = {}) {
        const rendered = await _renderToBuffer(klineData, options);
        return rendered.buffer;
    }

    // ==================== 导出 ====================
    return {
        generate,
        generateBuffer,
        mapPriceToPitch,
        mapVolumeToVelocity,
        mapVolatilityToDuration,
        playNote,
        playDrumHit,
        playRhythmLayer,
        midiToFreq,
        quantizeToScale
    };
})();

// 挂载到全局
window.MusicGenerator = MusicGenerator;

console.log('[Music] MusicGenerator 模块加载完成');
