/**
 * kbarok v9 - app.js
 * 主应用逻辑（从原 index.html 内联拆出）
 */

(function() {
    // ==================== 微信环境检测 ====================
    const isWechat = /MicroMessenger/i.test(navigator.userAgent);
    if (isWechat) {
        console.log('[App] 微信内置浏览器 detected');
    }
    
    // ==================== DOM 元素 ====================
    const $ = id => document.getElementById(id);
    
    let elements = {};
    let klineCanvas = null;
    
    function cacheElements() {
        elements = {
            video: $('mainVideo'),
            canvas: $('klineCanvas'),
            codeInput: $('codeInput'),
            startDateInput: $('startDateInput'),
            endDateInput: $('endDateInput'),
            instrumentSelect: $('instrumentSelect'),
            rhythmSelect: $('rhythmSelect'),
            speedSelect: $('speedSelect'),
            infoBar: $('infoBar')
        };
    }
    
    function setDebug(text) {
        console.log('[App]', text);
    }
    
    // ==================== 工具函数 ====================
    function validateInput(raw) {
        const c = raw.toUpperCase().trim();
        if (/^(US\.)?[A-Z]{1,5}$/.test(c)) {
            return c.startsWith('US.') ? c : 'US.' + c;
        }
        if (/^(HK\.)?\d{4,5}$/.test(c)) {
            return c.startsWith('HK.') ? c : 'HK.' + c;
        }
        if (/^(FOREX\.)?[A-Z]{6}$/.test(c)) {
            return c.startsWith('FOREX.') ? c : 'FOREX.' + c;
        }
        if (/^[A-Z]{6}$/.test(c)) {
            const majorFx = {EURUSD:1,GBPUSD:1,USDJPY:1,AUDUSD:1,USDCAD:1,USDCHF:1,USDCNY:1,USDHKD:1};
            if (majorFx[c]) return 'FOREX.' + c;
        }
        if (/^(CRYPTO\.)?(BTC|ETH|SOL|XRP|BNB|ADA|DOGE|DOT|AVAX|MATIC|LINK|UNI|ATOM|LTC|XLM|ALGO)$/.test(c)) {
            return c.startsWith('CRYPTO.') ? c : 'CRYPTO.' + c;
        }
        if (/^\d{6}$/.test(c)) {
            if (c.startsWith('60') || c.startsWith('68')) return c + '.SH';
            if (c.startsWith('00') || c.startsWith('30') || c.startsWith('31')) return c + '.SZ';
            return c + '.SH';
        }
        if (/^\d{6}\.(SH|SZ)$/.test(c)) return c;
        return null;
    }
    
    function getMarketLabel(code) {
        if (!code) return '未知';
        const c = code.toUpperCase();
        if (c.startsWith('US.')) return '美股';
        if (c.startsWith('HK.')) return '港股';
        if (c.startsWith('FOREX.')) return '外汇';
        if (c.startsWith('CRYPTO.')) return '加密货币';
        return 'A 股';
    }
    
    function getFormatTips() {
        return '示例：A股 600519.SH | 美股 us.AAPL | 港股 hk.00700 | 外汇 forex.EURUSD | 加密 crypto.btc';
    }
    
    // ==================== 信息条 ====================
    function updateInfoBar(klineData, musicParams) {
        if (!elements.infoBar) return;
        
        // 显示信息条
        elements.infoBar.style.display = 'block';
        
        if (klineData) {
            const last = klineData.n_points - 1;
            const close = klineData.closes[last];
            const prevClose = klineData.closes[last - 1] || close;
            const change = close - prevClose;
            const changePct = prevClose !== 0 ? (change / prevClose * 100).toFixed(2) : '0.00';
            const isUp = change >= 0;
            
            const codeEl = $('stockCode');
            if (codeEl) codeEl.textContent = klineData.code;
            
            const priceEl = $('stockPrice');
            if (priceEl) priceEl.textContent = close !== null ? close.toFixed(2) : '--';
            
            const changeEl = $('stockChange');
            if (changeEl) {
                changeEl.textContent = `${isUp ? '+' : ''}${change.toFixed(2)} (${isUp ? '+' : ''}${changePct}%)`;
                changeEl.className = `stock-change ${isUp ? 'up' : 'down'}`;
            }
            
            if (klineData.dates && klineData.dates.length > 0) {
                const dates = klineData.dates;
                const rangeEl = $('stockRange');
                if (rangeEl) rangeEl.textContent = `${dates[0]} ~ ${dates[dates.length - 1]}，${dates.length}交易日`;
            }
        }
        
        if (musicParams) {
            const instEl = $('musicInstrument');
            if (instEl) instEl.textContent = '🎹 ' + (musicParams.instrument || '--');
            const rhythmEl = $('musicRhythm');
            if (rhythmEl) rhythmEl.textContent = '🥁 ' + (musicParams.rhythm_style || '--');
            const synthEl = $('musicSynth');
            if (synthEl) synthEl.textContent = '🔥 ' + (musicParams.synthesis_type || '--');
            const speedEl = $('musicSpeed');
            if (speedEl) speedEl.textContent = '⚡ ' + (musicParams.speed || 1.0) + 'x';
        }
    }
    
    function updateInfoBarDynamic(barIndex, klineData) {
        if (!klineData || barIndex < 0) return;
        
        const close = klineData.closes[barIndex];
        const prevClose = barIndex > 0 ? klineData.closes[barIndex - 1] : close;
        const change = close - prevClose;
        const changePct = prevClose !== 0 ? (change / prevClose * 100).toFixed(2) : '0.00';
        const isUp = change >= 0;
        
        // 更新股票代码
        if ($('stockCode')) $('stockCode').textContent = klineData.code || '--';
        
        // 更新股票价格
        if ($('stockPrice')) $('stockPrice').textContent = close !== null ? close.toFixed(2) : '--';
        
        // 更新涨跌幅
        const changeEl = $('stockChange');
        if (changeEl && close !== null && prevClose !== 0) {
            changeEl.textContent = `${isUp ? '+' : ''}${change.toFixed(2)} (${isUp ? '+' : ''}${changePct}%)`;
            changeEl.className = `stock-change ${isUp ? 'up' : 'down'}`;
        }
        
        // 更新成交量
        if ($('stockAmount') && klineData.volumes && klineData.volumes[barIndex] !== undefined) {
            const volume = klineData.volumes[barIndex];
            $('stockAmount').textContent = volume !== null ? (volume / 10000).toFixed(0) + '万' : '--';
        }
        
        // 更新日期范围（显示当前日期）
        if ($('stockRange') && klineData.dates && klineData.dates[barIndex]) {
            $('stockRange').textContent = klineData.dates[barIndex];
        }
    }
    
    // ==================== K线 Canvas ====================
    function initKlineCanvas() {
        if (!window.KlineCanvas) {
            console.warn('[App] KlineCanvas 未加载');
            return;
        }
        klineCanvas = new KlineCanvas('klineCanvas', {
            upColor: '#e74c3c',
            downColor: '#2ecc71',
            bgColor: '#0d1117'
        });
        window.klineCanvasObj = klineCanvas;
        setTimeout(() => klineCanvas?.resize(), 100);
    }
    
    function toggleKlineMode(showKline) {
        const canvas = elements.canvas;
        const video = elements.video;
        const placeholder = $('videoPlaceholder');
        
        if (showKline) {
            if (canvas) canvas.style.display = 'block';
            if (video) video.style.display = 'none';
            if (placeholder) placeholder.style.display = 'none';
        } else {
            if (canvas) canvas.style.display = 'none';
            if (video) video.style.display = 'block';
            if (placeholder) placeholder.style.display = 'flex';
        }
    }
    
    function loadDemoKlineData() {
        toggleKlineMode(true);
        const n = 50;
        const basePrice = 100;
        const closes = [], opens = [], highs = [], lows = [];
        let price = basePrice;
        for (let i = 0; i < n; i++) {
            const t = i / n * 4 * Math.PI;
            const change = Math.sin(t) * 5 + Math.sin(t * 2.3) * 2 + (Math.random() - 0.5) * 3;
            const open = price;
            const close = price + change;
            const high = Math.max(open, close) + Math.random() * 1.5;
            const low = Math.min(open, close) - Math.random() * 1.5;
            opens.push(open);
            closes.push(close);
            highs.push(high);
            lows.push(low);
            price = close;
        }
        const demoData = {
            code: 'demo', name: '演示数据',
            opens, highs, lows, closes,
            volumes: closes.map(() => Math.random() * 10000),
            n_points: n,
            dates: Array.from({length: n}, (_, i) => {
                const date = new Date();
                date.setDate(date.getDate() - (n - i - 1));
                return date.toISOString().split('T')[0];
            })
        };
        if (klineCanvas) {
            klineCanvas.setData(demoData);
            klineCanvas.startEntry();
        }
    }
    
    // ==================== K线缓存 ====================
    let klineCache = {
        code: null, startDate: null, endDate: null, data: null, lastUpdated: 0
    };
    
    async function checkKlineCache(code, startDate, endDate) {
        if (!klineCache.data ||
            klineCache.code !== code ||
            klineCache.startDate !== startDate ||
            klineCache.endDate !== endDate) {
            return { needRefresh: true, cachedData: null };
        }
        return { needRefresh: false, cachedData: klineCache.data };
    }
    
    function updateKlineCache(code, startDate, endDate, data) {
        klineCache = { code, startDate, endDate, data, lastUpdated: Date.now() };
    }
    
    // ==================== AudioBuffer → WAV Blob ====================
    function audioBufferToWavBlob(buffer) {
        const numChannels = buffer.numberOfChannels;
        const sampleRate = buffer.sampleRate;
        const bitDepth = 16;
        const bytesPerSample = bitDepth / 8;
        const blockAlign = numChannels * bytesPerSample;
        const dataLength = buffer.length * numChannels * bytesPerSample;
        const headerSize = 44;
        const totalSize = headerSize + dataLength;
        const ab = new ArrayBuffer(totalSize);
        const view = new DataView(ab);

        function writeStr(offset, str) {
            for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
        }
        writeStr(0,   'RIFF');   view.setUint32(4,  36 + dataLength, true);
        writeStr(8,   'WAVE');   view.setUint32(12, 16, true);
        view.setUint16(16, 1, true);
        view.setUint16(18, numChannels, true);
        view.setUint32(20, sampleRate, true);
        view.setUint32(24, sampleRate * blockAlign, true);
        view.setUint16(28, blockAlign, true);
        view.setUint16(30, bitDepth, true);
        writeStr(36,  'data');   view.setUint32(40, dataLength, true);

        const channels = [];
        for (let c = 0; c < numChannels; c++) channels.push(buffer.getChannelData(c));
        let idx = headerSize;
        for (let i = 0; i < buffer.length; i++) {
            for (let c = 0; c < numChannels; c++) {
                const s = Math.max(-1, Math.min(1, channels[c][i]));
                view.setInt16(idx, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
                idx += 2;
            }
        }
        return new Blob([ab], { type: 'audio/wav' });
    }

    // ==================== 音乐生成 ====================
    async function generateMusic() {
        console.log('[App] 开始生成音乐，klineCanvas:', klineCanvas);
        const code = elements.codeInput?.value || '';
        const startDate = elements.startDateInput?.value || '';
        const endDate = elements.endDateInput?.value || '';
        const instrument = elements.instrumentSelect?.value || '古筝';
        const rhythm = elements.rhythmSelect?.value || 'Amapiano_非洲节奏';
        // ✅ 修复1：读 speedSelect（不是 speedSlider）
        const speed = elements.speedSelect ? parseFloat(elements.speedSelect.value) : 1.0;
        
        // 验证标的代码
        let validCode = validateInput(code);
        let useDefaultCode = false;
        if (!validCode) {
            setDebug(getFormatTips());
            // 不直接返回，而是使用默认代码
            validCode = '300025.sz';
            useDefaultCode = true;
        }
        
        // 1. 停止预制视频播放进程
            const video = document.getElementById('mainVideo');
            if (video) {
                try {
                    video.pause();
                    video.currentTime = 0;
                    // 不要清除src，只需要隐藏
                } catch (e) {
                    console.warn('[App] 停止预制视频失败:', e);
                }
            }
        
        // 2. 清理之前的音频
        const prevAudio = document.getElementById('kbarokAudio');
        if (prevAudio) {
            try {
                prevAudio.pause();
                prevAudio.currentTime = 0;
                prevAudio.src = '';
                prevAudio.load();
            } catch (e) {}
            prevAudio.remove();
        }
        
        // 3. 创建新的音频元素
        let audioEl = document.createElement('audio');
        audioEl.id = 'kbarokAudio';
        audioEl.style.display = 'none';
        document.body.appendChild(audioEl);
        
        // 存储音频元素到elements
        elements.video = audioEl;
        
        // 4. 隐藏预制视频，显示K线画布
        const canvas = document.getElementById('klineCanvas');
        const placeholder = document.getElementById('videoPlaceholder');
        
        if (video) video.style.display = 'none';
        if (placeholder) placeholder.style.display = 'none';
        if (canvas) canvas.style.display = 'block';
        
        if (window.KbarokUI) window.KbarokUI.showLoading(true);
        setDebug('📊 获取K线数据...');
        
        let finalCode = validCode;
        let klineResult = null;
        let musicResult = null;
        
        try {
            // Step 1: 获取 K 线数据
            klineResult = await KbarokAPI.getKlineData(validCode, startDate, endDate);
            
            if (!klineResult.success) {
                setDebug('⚠️ K线获取失败，使用默认代码 300025');
                if (!useDefaultCode) {
                    window.KbarokUI?.showToast('❌ 代码无效，使用默认代码 300025\n正在为您生成音乐...', 'error');
                }
                finalCode = '300025.sz';
                klineResult = await KbarokAPI.getKlineData(finalCode, startDate, endDate);
                
                if (!klineResult.success) {
                    // 如果重试也失败，使用演示数据
                    loadDemoKlineData();
                    if (!useDefaultCode) {
                        window.KbarokUI?.showToast('⚠️ ' + (klineResult.error || 'K线获取失败，已使用演示数据\n正在生成音乐...'), 'warning');
                    }
                    // 确保音乐生成使用有效代码
                    finalCode = '300025.sz';
                } else {
                    // 重试成功，显示K线
                    toggleKlineMode(true);
                    const klineData = klineResult.kline || klineResult.data;
                    if (klineCanvas && klineData) {
                        console.log('[App] 设置K线数据（重试），数据点数:', klineData.n_points);
                        klineCanvas.setData(klineData);
                        console.log('[App] 开始K线动画（重试）');
                        klineCanvas.startEntry();
                    }
                }
            } else {
                // 第一次获取成功，显示K线
                toggleKlineMode(true);
                const klineData = klineResult.kline || klineResult.data;
                if (klineCanvas && klineData) {
                    console.log('[App] 设置K线数据，数据点数:', klineData.n_points);
                    klineCanvas.setData(klineData);
                    console.log('[App] 开始K线动画');
                    klineCanvas.startEntry();
                }
                setDebug('✅ K线数据已加载');
            }
            
            // Step 2: 前端生成音乐（使用 MusicGenerator）
            setDebug('🎵 前端生成音乐中...');
            
            // 检查 MusicGenerator 是否可用
            if (!window.MusicGenerator) {
                throw new Error('MusicGenerator 未加载');
            }
            
            const musicGen = new window.MusicGenerator();
            musicGen.setSpeed(speed);
            musicGen.setInstrument(instrument);
            
            // 准备 K 线数据用于音乐生成
            const klineData = klineCanvas?.data || klineResult?.kline || klineResult?.data;
            if (!klineData || !klineData.closes || klineData.closes.length === 0) {
                throw new Error('无有效 K 线数据');
            }
            
            // 构造音乐生成器需要的数据格式
            const df = {
                close: klineData.closes,
                volume: klineData.volumes || klineData.closes.map(() => 10000),
                volatility: klineData.closes.map((c, i) => {
                    if (i === 0) return 0.02;
                    return Math.abs(klineData.closes[i] - klineData.closes[i-1]) / klineData.closes[i-1];
                }),
                pctChg: klineData.closes.map((c, i) => {
                    if (i === 0) return 0;
                    return ((klineData.closes[i] - klineData.closes[i-1]) / klineData.closes[i-1]) * 100;
                })
            };
            
            // 生成音频
            const audioResult = await musicGen.generateAudio(df, instrument, rhythm);

            if (!audioResult || !audioResult.audioBuffer) {
                throw new Error('音频生成失败');
            }

            // ✅ 修复2：将 AudioBuffer 编码为 WAV blob，赋给 <audio> 元素
            const wavBlob = audioBufferToWavBlob(audioResult.audioBuffer);
            const audioUrl = URL.createObjectURL(wavBlob);
            audioEl.src = audioUrl;
            audioEl.loop = true;
            audioEl.play().catch(e => console.warn('[App] 音频播放失败:', e));

            // ✅ 修复3：绑定音频到 KlineCanvas（timeupdate 驱动播放进度）
            if (klineCanvas) {
                klineCanvas.bindAudio(audioEl);
            }

            // ✅ 修复4：保持 K线 Canvas 显示（不切视频模式）
            if (canvas) canvas.style.display = 'block';
            if (video) video.style.display = 'none';
            if (placeholder) placeholder.style.display = 'none';

            // 设置音频元素属性
            audioEl._code = finalCode;
            audioEl._instrument = instrument;
            audioEl._rhythm = rhythm;
            audioEl._duration = audioResult.duration;

            // 同步 Core 状态
            if (window.KbarokCore) {
                window.KbarokCore.state.isPlaying = true;
                window.KbarokCore.state.audioPlaying = true;
            }
            if (window.KbarokUI) window.KbarokUI.syncControlBar();

            // 根据是否使用默认代码显示成功提示
            if (useDefaultCode || finalCode === '300025.sz') {
                window.KbarokUI?.showToast('✅ 音乐生成成功！\n⚠️ 代码无效，已使用默认代码 300025\n正在播放音画同步动画...\n\n💡 正确格式：600234、300025、AAPL', 'success');
            } else {
                window.KbarokUI?.showToast('✅ 音乐生成成功！\n正在播放音画同步动画...', 'success');
            }
            setDebug('✅ 音乐播放中，时长: ' + audioResult.duration.toFixed(1) + '秒');
            
        } catch (e) {
            console.error('[App] 生成失败:', e);
            window.KbarokUI?.showToast('❌ 生成失败: ' + e.message + '\n请检查网络连接后重试', 'error');
            setDebug('❌ 错误: ' + e.message);

            // 异常时：保持 K线 Canvas 显示，恢复预制视频但不切换走
            if (video) video.style.display = 'none';
            if (canvas) canvas.style.display = 'block';
            if (placeholder) placeholder.style.display = 'none';
        } finally {
            // 无论成功还是失败，都执行以下操作
            if (window.KbarokUI) window.KbarokUI.showLoading(false);

            // 更新信息栏（updateInfoBar 会设置 display:block）
            const klineForInfo = klineCanvas?.data || klineResult?.kline;
            if (klineForInfo) {
                updateInfoBar(klineForInfo, {
                    instrument,
                    rhythm_style: rhythm,
                    speed,
                    synthesis_type: '潮流音色'
                });
            }

            // 收起探索面板
            if (window.KbarokUI?.collapseExplore) {
                window.KbarokUI.collapseExplore();
            }
        }
    }
    
    // ==================== 配置加载 ====================
    async function loadV2Config() {
        if (!window.KbarokAPI) return;
        
        try {
            const data = await KbarokAPI.getConfig();
            if (!data.success) {
                console.warn('[App] 配置加载失败:', data.error);
                return;
            }
            
            const instSel = elements.instrumentSelect;
            const rhythmSel = elements.rhythmSelect;
            
            if (instSel) {
                instSel.innerHTML = '';
                data.instruments.forEach(inst => {
                    const opt = document.createElement('option');
                    opt.value = inst;
                    opt.textContent = inst;
                    instSel.appendChild(opt);
                });
                instSel.value = '古筝';
            }
            
            if (rhythmSel) {
                rhythmSel.innerHTML = '';
                data.rhythm_styles.forEach(rhythm => {
                    const opt = document.createElement('option');
                    opt.value = rhythm;
                    opt.textContent = rhythm;
                    rhythmSel.appendChild(opt);
                });
                rhythmSel.value = 'Amapiano_非洲节奏';
            }
            
            if (elements.speedSelect) {
                elements.speedSelect.value = '1'; // 1x = 正常速度
            }
            
            console.log('[App] V2配置加载完成');
        } catch (e) {
            console.error('[App] 配置加载失败:', e);
        }
    }
    
    // ==================== 事件绑定 ====================
    function bindEvents() {
        $('btnStop')?.addEventListener('click', () => window.KbarokPlayer?.toggle());
        $('btnListen')?.addEventListener('click', () => window.KbarokPlayer?.toggleAudio());
        $('btnExplore')?.addEventListener('click', () => window.KbarokUI?.toggleExplore());
        $('btnGen')?.addEventListener('click', generateMusic);
        
        // 全屏按钮
        $('btnFullscreen')?.addEventListener('click', () => {
            const doc = document;
            const docEl = doc.documentElement;
            
            if (!doc.fullscreenElement && !doc.webkitFullscreenElement) {
                // 进入全屏
                const requestFullScreen = docEl.requestFullscreen || docEl.webkitRequestFullscreen || docEl.mozRequestFullScreen || docEl.msRequestFullscreen;
                if (requestFullScreen) {
                    requestFullScreen.call(docEl).catch(err => {
                        console.log('全屏失败:', err);
                    });
                }
            } else {
                // 退出全屏
                const exitFullScreen = doc.exitFullscreen || doc.webkitExitFullscreen || doc.mozCancelFullScreen || doc.msExitFullscreen;
                if (exitFullScreen) {
                    exitFullScreen.call(doc);
                }
            }
        });

        
        elements.speedSelect?.addEventListener('change', () => {
            const val = parseFloat(elements.speedSelect.value) || 1.0;
            if (window.KbarokCore) {
                window.KbarokCore.state.exploreParams.speed = val;
            }
        });
        
        $('langToggle')?.addEventListener('click', async () => {
            if (!window.KbarokCore) return;
            const next = window.KbarokCore.state.lang === 'zh' ? 'en' : 'zh';
            await window.KbarokCore.setLang(next);
            document.getElementById('htmlRoot').lang = window.KbarokCore.state.lang;
            window.KbarokUI?.syncAll();
        });
        
        const video = elements.video;
        const placeholder = $('videoPlaceholder');
        if (video && placeholder) {
            video.addEventListener('canplay', () => {
                placeholder.style.display = 'none';
            }, { once: true });
            video.addEventListener('error', () => {
                placeholder.style.display = 'flex';
                const span = placeholder.querySelector('span');
                if (span && window.KbarokCore) span.textContent = window.KbarokCore.t('video.error');
            });
        }
        
        $('btnDownload')?.addEventListener('click', () => {
            try {
                const dr = window.DraftRecorder;
                if (!dr) { window.KbarokUI?.showToast('⚠️ 录制组件未就绪', 2000); return; }
                // 检查详细错误
                if (dr._lastError) {
                    console.error('[下载] 上次错误:', dr._lastError);
                    dr._lastError = null;
                }
                dr.download();
            } catch (err) {
                console.error('[下载] 错误:', err);
                window.KbarokUI?.showToast('⚠️ 录制失败: ' + (err.message || err), 3000);
            }
        });
        
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.show').forEach(el => el.classList.remove('show'));
            }
        });
        
        const params = new URLSearchParams(window.location.search);
        if (params.has('code') && elements.codeInput) {
            setTimeout(() => {
                const code = params.get('code');
                elements.codeInput.value = code;
                if (window.KbarokCore) {
                    window.KbarokCore.state.exploreParams.code = code;
                }
                window.KbarokUI?.showToast('📥 已加载：' + code + '\n音画同步动画已准备就绪', 'info');
            }, 300);
        }
    }
    
    // ==================== 初始化 ====================
    async function init() {
        cacheElements();
        initKlineCanvas();
        
        // 默认显示K线Canvas动画（不是视频）
        loadDemoKlineData();
        
        // 初始化日期输入框默认值（5个月前到今天）
        const today = new Date();
        const fiveMonthsAgo = new Date();
        fiveMonthsAgo.setMonth(today.getMonth() - 5);
        
        const formatDate = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };
        
        const startDateInput = document.getElementById('startDateInput');
        const endDateInput = document.getElementById('endDateInput');
        
        if (startDateInput) {
            startDateInput.value = formatDate(fiveMonthsAgo);
        }
        if (endDateInput) {
            endDateInput.value = formatDate(today);
        }
        
        if (window.KbarokCore) {
            await window.KbarokCore.init();
            document.getElementById('htmlRoot').lang = window.KbarokCore.state.lang;
        }
        
        if (window.KbarokUI) {
            window.KbarokUI.init();
            window.KbarokUI.syncAll();
        }
        
        if (window.KbarokPlayer) {
            window.KbarokPlayer.init();
        }
        
        await loadV2Config();
        bindEvents();
        
        // 监听全屏变化，更新全屏按钮图标
        const fullscreenBtn = $('btnFullscreen');
        if (fullscreenBtn) {
            const updateFullscreenIcon = () => {
                const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement;
                fullscreenBtn.textContent = isFullscreen ? '⛶' : '⛶'; // 可以用不同图标，如⛶/⛉
            };
            document.addEventListener('fullscreenchange', updateFullscreenIcon);
            document.addEventListener('webkitfullscreenchange', updateFullscreenIcon);
        }
        
        console.log('[App] 初始化完成');
    }
    
    window.generateMusic = generateMusic;
    window.validateInput = validateInput;
    window.getMarketLabel = getMarketLabel;
    window.updateInfoBar = updateInfoBar;
    window.updateInfoBarDynamic = updateInfoBarDynamic;
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();