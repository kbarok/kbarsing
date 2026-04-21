/**
 * kbarsing - API层（纯前端化）
 * 原Flask后端 → 前端模块调用
 */

const KbarokAPI = (function() {
    
    /**
     * 获取配置（音色/节奏列表）
     * 原: GET /api/v2/config
     * 现: 直接返回 window.KbarokConfig
     */
    async function getConfig() {
        if (!window.KbarokConfig) {
            console.error('[API] KbarokConfig 未加载');
            return { success: false, error: '配置未加载' };
        }
        
        return {
            success: true,
            instruments: KbarokConfig.instruments,
            rhythm_styles: KbarokConfig.rhythmStyles,
            synth_presets: KbarokConfig.synthPresets,
            speed_range: {
                min: KbarokConfig.music.minSpeed,
                max: KbarokConfig.music.maxSpeed,
                default: KbarokConfig.music.defaultSpeed
            }
        };
    }

    /**
     * 获取K线数据
     * 原: POST /api/v2/kline
     * 现: 调用 KlineFetcher.getKlineData
     */
    async function getKlineData(code, startDate, endDate) {
        if (!window.KlineFetcher) {
            console.error('[API] KlineFetcher 未加载');
            return { success: false, error: '数据模块未加载' };
        }
        
        console.log('[API] 获取K线:', code, startDate, endDate);
        return await KlineFetcher.getKlineData(code, startDate, endDate);
    }

    /**
     * 生成音乐
     * 原: POST /api/v2/generate → 返回 audio_url
     * 现: 调用 MusicGenerator.generate → 返回 AudioContext
     */
    async function generateMusic(code, params) {
        if (!window.MusicGenerator) {
            console.error('[API] MusicGenerator 未加载');
            return { success: false, error: '音乐模块未加载' };
        }
        
        if (!window._klineData) {
            console.error('[API] 无K线数据缓存');
            return { success: false, error: '请先获取K线数据' };
        }
        
        const {
            instrument = '钢琴',
            rhythm_style = '标准4拍',
            speed = 1.0
        } = params;
        
        console.log('[API] 生成音乐:', { instrument, rhythm_style, speed });
        
        // 确保 AudioContext 已恢复（解决浏览器自动播放策略）
        let ctx = window._kbarokAudioCtx;
        if (ctx && ctx.state === 'suspended') {
            console.log('[API] AudioContext suspended, resuming...');
            await ctx.resume();
            console.log('[API] AudioContext resumed:', ctx.state);
        }
        
        try {
            const result = await MusicGenerator.generate(window._klineData, {
                instrument,
                rhythmStyle: rhythm_style,
                speed
            });
            
            if (result) {
                // 保存 AudioContext 供外部控制
                window._musicContext = result;
                
                return {
                    success: true,
                    audioContext: result.ctx,
                    duration: result.duration,
                    startTime: result.startTime
                };
            } else {
                return { success: false, error: '音乐生成失败' };
            }
        } catch (e) {
            console.error('[API] 音乐生成异常:', e);
            return { success: false, error: e.message };
        }
    }

    /**
     * 停止音乐播放
     */
    function stopMusic() {
        if (window._musicContext) {
            try {
                window._musicContext.stop();
            } catch (e) {}
            window._musicContext = null;
        }
        // 同时暂停 AudioContext
        if (window._kbarokAudioCtx && window._kbarokAudioCtx.state === 'running') {
            try {
                window._kbarokAudioCtx.suspend();
            } catch (e) {}
        }
    }

    /**
     * 缓存K线数据（供音乐生成使用）
     */
    function cacheKlineData(data) {
        window._klineData = data;
    }

    // ==================== 导出 ====================
    return {
        getConfig,
        getKlineData,
        generateMusic,
        stopMusic,
        cacheKlineData
    };
})();

// 挂载到全局
window.KbarokAPI = KbarokAPI;

console.log('[API] KbarokAPI 模块加载完成（纯前端版）');
