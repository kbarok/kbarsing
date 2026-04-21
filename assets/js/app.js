/**
 * kbarok v9 - app.js
 * 主应用逻辑（从原 index.html 内联拆出）
 */

(function() {
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
            speedSlider: $('speedSlider'),
            speedVal: $('speedVal'),
            genDebug: $('genDebug'),
            infoBar: $('infoBar')
        };
    }
    
    function setDebug(text) {
        if (elements.genDebug) elements.genDebug.textContent = text;
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
            
            $('stockCode').textContent = klineData.code;
            $('stockPrice').textContent = close !== null ? close.toFixed(2) : '--';
            
            const changeEl = $('stockChange');
            changeEl.textContent = `${isUp ? '+' : ''}${change.toFixed(2)} (${isUp ? '+' : ''}${changePct}%)`;
            changeEl.className = `stock-change ${isUp ? 'up' : 'down'}`;
            
            if (klineData.dates && klineData.dates.length > 0) {
                const dates = klineData.dates;
                $('stockRange').textContent = `${dates[0]} ~ ${dates[dates.length - 1]}，${dates.length}交易日`;
            }
        }
        
        if (musicParams) {
            $('musicInstrument').textContent = '🎹 ' + (musicParams.instrument || '--');
            $('musicRhythm').textContent = '🥁 ' + (musicParams.rhythm_style || '--');
            $('musicSynth').textContent = '🔥 ' + (musicParams.synthesis_type || '--');
            $('musicSpeed').textContent = '⚡ ' + (musicParams.speed || 1.0) + 'x';
        }
        
        elements.infoBar.style.display = 'block';
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
            // 动画统一在 generateMusic finally 里触发，这里只 setData
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
    
    // ==================== 音乐生成 ====================
    async function generateMusic() {
        console.log('[App] ========== 生成音乐按钮被点击 ==========');
        console.log('[App] klineCanvas:', klineCanvas);
        console.log('[App] KbarokAPI:', typeof window.KbarokAPI);
        console.log('[App] MusicGenerator:', typeof window.MusicGenerator);
        console.log('[App] KlineFetcher:', typeof window.KlineFetcher);
        
        const code = elements.codeInput?.value || '';
        const startDate = elements.startDateInput?.value || '';
        const endDate = elements.endDateInput?.value || '';
        const instrument = elements.instrumentSelect?.value || '古筝';
        const rhythm = elements.rhythmSelect?.value || 'Amapiano_非洲节奏';
        const speed = elements.speedSlider ? parseFloat(elements.speedSlider.value) / 10 : 1.0;
        
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
                        // 不立即开始动画，等音乐生成后同步播放
                        // console.log('[App] 开始K线动画（重试）');
                        // klineCanvas.startEntry();
                    }
                }
            } else {
                // 第一次获取成功，显示K线
                toggleKlineMode(true);
                const klineData = klineResult.kline || klineResult.data;
                if (klineCanvas && klineData) {
                    console.log('[App] 设置K线数据，数据点数:', klineData.n_points);
                    klineCanvas.setData(klineData);
                    // 不立即开始动画，等音乐生成后同步播放
                    // klineCanvas.startEntry();
                }
                setDebug('✅ K线数据已加载');
            }
            
            // Step 2: 缓存K线数据供音乐生成使用
            const klineData = klineResult?.kline || klineResult?.data;
            if (klineData) {
                window._klineData = klineData;
            }
            
            // Step 3: 生成音乐（纯前端 Web Audio API）
            setDebug('🎵 生成音乐中...');
            console.log('[App] 开始生成音乐，参数:', { instrument, rhythm, speed });
            
            let musicResult;
            try {
                musicResult = await KbarokAPI.generateMusic(finalCode, {
                    instrument,
                    rhythm_style: rhythm,
                    speed
                });
                console.log('[App] 音乐生成结果:', musicResult);
            } catch (e) {
                console.error('[App] 音乐生成异常:', e);
                musicResult = { success: false, error: e.message };
            }
            
            if (musicResult.success) {
                // 音乐已通过 Web Audio API 开始播放
                const musicDur = musicResult.duration || 60;
                const audioCtx = musicResult.audioContext || window._kbarokAudioCtx;
                console.log('[App] 音乐播放中，时长:', musicDur, '秒');

                // 启动K线动画，由 Web Audio 时间驱动（V1.0 核心逻辑）
                if (klineCanvas && audioCtx) {
                    // 设置回调：K线循环时重新生成音乐（复用AudioContext，无间隙）
                    klineCanvas.onLoop = () => {
                        console.log('[App] K线循环，重新生成音乐（复用AudioContext）');
                        console.log('[App] _klineData存在?', !!window._klineData, 'MusicGenerator存在?', !!window.MusicGenerator);
                        if (window._klineData && window.MusicGenerator) {
                            const opts = {
                                instrument: elements.instrumentSelect?.value || '钢琴',
                                rhythmStyle: elements.rhythmSelect?.value || '标准4拍',
                                speed: parseFloat(elements.speedSlider?.value || '10') / 10,
                                reuseContext: true  // 关键：循环时复用AudioContext
                            };
                            console.log('[App] 调用generate，参数:', opts);
                            window.MusicGenerator.generate(window._klineData, opts).then(result => {
                                console.log('[App] 音乐重新生成完成, result:', !!result);
                                if (klineCanvas.bindWebAudio && result) {
                                    klineCanvas.bindWebAudio(result.ctx, result.startTime, result.duration);
                                }
                            }).catch(e => console.error('[App] 音乐重新生成失败:', e));
                        } else {
                            console.error('[App] 无法重新生成：_klineData或MusicGenerator缺失');
                        }
                    };
                    // Web Audio 驱动 K线动画
                    klineCanvas.bindWebAudio(audioCtx, musicResult.startTime, musicDur);
                }
                
                // 根据是否使用默认代码显示不同的成功提示
                const isUsingDefaultCode = useDefaultCode || finalCode === '300025.sz';
                if (isUsingDefaultCode) {
                    window.KbarokUI?.showToast('✅ 音乐生成成功！\n⚠️ 输入代码无效，已自动使用默认代码 300025\n正在播放音画同步动画...\n\n💡 正确格式示例：600234、300025、AAPL', 'success');
                } else {
                    window.KbarokUI?.showToast('✅ 音乐生成成功！\n正在播放音画同步动画...', 'success');
                }
            } else {
                // 音乐生成失败，但继续播放动画（无声模式）
                console.warn('[App] 音乐生成失败:', musicResult.error);
                window.KbarokUI?.showToast('⚠️ 音乐生成失败，播放无声动画\n错误: ' + (musicResult.error || '未知错误'), 'warning');
            }
            
            // K线动画已在 musicResult.success 里启动（与音乐同步）
            // 这里不再重复启动，避免冲突
            
        } catch (e) {
            console.error('[App] 生成失败:', e);
            window.KbarokUI?.showToast('❌ 生成失败: ' + e.message + '\n请检查网络连接后重试', 'error');
            setDebug('❌ 错误: ' + e.message);
            
            // 异常时恢复预制视频
            if (video) {
                video.style.display = 'block';
                const videos = ['assets/video/video1.mp4', 'assets/video/video2.mp4', 'assets/video/video3.mp4'];
                video.src = videos[Math.floor(Math.random() * videos.length)];
                video.loop = true;
                video.muted = false;
                video.autoplay = true;
                video.playsInline = true;
                video.play().catch(e => console.warn('[App] 恢复预制视频失败:', e));
            }
            if (canvas) canvas.style.display = 'none';
            if (placeholder) placeholder.style.display = 'flex';
        } finally {
            // 无论成功还是失败，都执行以下操作
            if (window.KbarokUI) window.KbarokUI.showLoading(false);
            
            // 更新信息栏
            updateInfoBar(klineCanvas?.data || klineResult?.kline, {
                instrument,
                rhythm_style: rhythm,
                speed,
                synthesis_type: '潮流音色'
            });
            
            // 收起探索面板
            if (window.KbarokUI?.collapseExplore) {
                window.KbarokUI.collapseExplore();
            }
            
            setDebug('');

            // K线动画已在前面与音乐同步启动
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
            
            if (elements.speedSlider) {
                elements.speedSlider.value = 20;
                if (elements.speedVal) elements.speedVal.textContent = '2.0';
            }
            
            console.log('[App] V2配置加载完成');
        } catch (e) {
            console.error('[App] 配置加载失败:', e);
        }
    }
    
    // ==================== 事件绑定 ====================
    function bindEvents() {
        $('btnStop')?.addEventListener('click', async () => {
            const kbarokAudio = document.getElementById('kbarokAudio');
            const video = document.getElementById('mainVideo');
            
            if (kbarokAudio || window._kbarokAudioCtx) {
                // 音画生成模式：控制 Web Audio
                const ctx = window._kbarokAudioCtx;
                if (!ctx) return;
                
                if (ctx.state === 'running') {
                    await ctx.suspend();
                    if (klineCanvas && klineCanvas.webAudioAnimId) {
                        cancelAnimationFrame(klineCanvas.webAudioAnimId);
                    }
                    $('btnStop').textContent = '播放';
                } else if (ctx.state === 'suspended') {
                    await ctx.resume();
                    if (klineCanvas && klineCanvas.audioContext) {
                        klineCanvas.bindWebAudio(klineCanvas.audioContext, klineCanvas.audioStartTime, klineCanvas.musicDuration);
                    }
                    $('btnStop').textContent = '停止';
                }
            } else if (video && !video.paused) {
                // 视频模式：暂停/恢复视频
                video.pause();
                $('btnStop').textContent = '播放';
            } else if (video) {
                video.play().catch(() => {});
                $('btnStop').textContent = '停止';
            }
        });
        $('btnListen')?.addEventListener('click', async () => {
            const kbarokAudio = document.getElementById('kbarokAudio');
            const video = document.getElementById('mainVideo');
            
            if (kbarokAudio) {
                // 音画生成模式：控制 Web Audio
                const masterGain = window._kbarokMasterGain;
                if (!masterGain) return;
                if (masterGain.gain.value > 0) {
                    masterGain._prevVolume = masterGain.gain.value;
                    masterGain.gain.setValueAtTime(0, window._kbarokAudioCtx?.currentTime || 0);
                    $('btnListen').textContent = '🔇';
                    $('btnListen').classList.add('listen-active');
                } else {
                    masterGain.gain.setValueAtTime(masterGain._prevVolume || 0.7, window._kbarokAudioCtx?.currentTime || 0);
                    $('btnListen').textContent = '试听';
                    $('btnListen').classList.remove('listen-active');
                }
            } else if (video) {
                // 视频模式：控制视频静音
                video.muted = !video.muted;
                if (video.muted) {
                    $('btnListen').textContent = '试听';
                    $('btnListen').classList.remove('listen-active');
                } else {
                    $('btnListen').textContent = '🔇';
                    $('btnListen').classList.add('listen-active');
                }
            }
        });
        $('btnExplore')?.addEventListener('click', () => window.KbarokUI?.toggleExplore());
        $('btnCreate')?.addEventListener('click', () => window.KbarokUI?.toggleCreate());
        // 音乐生成按钮 - 使用多种方式绑定确保可靠
        const btnGen = $('btnGenerate');
        console.log('[App] btnGenerate element:', btnGen);
        if (btnGen) {
            // 方式1: addEventListener
            btnGen.addEventListener('click', async function(e) {
                console.log('[App] btnGenerate clicked via addEventListener!');
                e.preventDefault();
                e.stopPropagation();
                
                // 立即恢复 AudioContext（解决浏览器自动播放策略）
                const ctx = window._kbarokAudioCtx;
                if (ctx && ctx.state === 'suspended') {
                    console.log('[App] Resuming AudioContext...');
                    await ctx.resume();
                    console.log('[App] AudioContext resumed:', ctx.state);
                }
                
                generateMusic();
            });
            
            // 添加视觉反馈
            btnGen.style.cursor = 'pointer';
            console.log('[App] btnGenerate 事件绑定完成');
} else {
            console.error('[App] btnGenerate not found!');
        }

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

        
        elements.speedSlider?.addEventListener('input', () => {
            const val = parseInt(elements.speedSlider.value) || 10;
            if (elements.speedVal) elements.speedVal.textContent = (val / 10).toFixed(1);
            if (window.KbarokCore) {
                window.KbarokCore.state.exploreParams.speed = val / 10;
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
            const dr = window.DraftRecorder;
            if (!dr) return;
            dr.download();
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