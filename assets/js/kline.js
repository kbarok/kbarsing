/**
 * kbarok v9 - kline-canvas.js
 * K线画布动画：绳子拉出效果 + 音画同步
 */
class KlineCanvas {
    constructor(canvasId, options = {}) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.dpr = window.devicePixelRatio || 1;

        this.options = {
            upColor: '#e74c3c',
            downColor: '#2ecc71',
            ma5Color: '#f1c40f',
            ma10Color: '#1abc9c',
            volumeUpColor: '#e67e22',
            volumeDownColor: '#3498db',
            kdjKColor: '#ff79c6',
            kdjDColor: '#8be9fd',
            kdjJColor: '#f1fa8c',
            bgColor: '#0d1117',
            gridColor: '#21262d',
            textColor: '#c9d1d9',
            playLineColor: '#ff6b6b',
            entryDuration: 2500,
            defaultMusicDuration: 60, // 默认音乐循环60秒
            ...options
        };

        this.data = null;
        this.n_points = 0;
        this.clipProgress = 0;
        this.playProgress = 0;
        this.entryComplete = false;
        this.streamAnimId = null;   // 循环播放 RAF ID
        this.streamStartTime = 0; // 循环播放开始时间
        this.musicDuration = 60;   // 音乐总时长（秒）

        this.layout = {
            kline:  { y: 0,    h: 0.50 },
            volume: { y: 0.50, h: 0.18 },
            macd:   { y: 0.68, h: 0.16 },
            kdj:    { y: 0.84, h: 0.16 }
        };

        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        // 使用window.innerHeight获取更可靠的视口高度（特别是移动端）
        const parent = this.canvas.parentElement;
        const rect = parent.getBoundingClientRect();
        
        // 确保高度不小于宽度的一半（防止手机上高度计算错误）
        let height = Math.max(rect.height, window.innerHeight * 0.5);
        let width = rect.width;
        
        // 如果父元素高度为0或太小，使用视口高度
        if (height < 100) {
            height = window.innerHeight - 200; // 减去顶部栏和底部控制栏
        }
        
        this.canvas.width = width * this.dpr;
        this.canvas.height = height * this.dpr;
        this.canvas.style.width = width + 'px';
        this.canvas.style.height = height + 'px';
        this.width = width;
        this.height = height;
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.scale(this.dpr, this.dpr);
        if (this.data) this.draw();
    }

    setData(data) {
        this.data = data;
        this.n_points = data.opens.length;
        this.clipProgress = 0;
        this.playProgress = 0;
        this.entryComplete = false;

        const prices = [];
        for (let i = 0; i < this.n_points; i++) {
            prices.push(data.highs[i], data.lows[i]);
        }
        this.minPrice = Math.min(...prices) * 0.98;
        this.maxPrice = Math.max(...prices) * 1.02;
        this.priceRange = this.maxPrice - this.minPrice;

        // 预计算各区域最大值，避免每帧重算
        this._volMax = Math.max(...data.volumes.filter(v => v != null)) * 1.1;
        const macdHist = data.macd_hist || [];
        const mVals = macdHist.filter(v => v != null);
        if (mVals.length) {
            this._macdMin = Math.min(...mVals) * 1.1;
            this._macdMax = Math.max(...mVals) * 1.1;
            this._macdRange = this._macdMax - this._macdMin || 1;
            const macd = data.macd || [], macdSig = data.macd_signal || [];
            this._macdAllVals = [...macd, ...macdSig, ...mVals].filter(v => v != null);
            this._macdAllMin = this._macdAllVals.length ? Math.min(...this._macdAllVals) * 1.1 : 0;
            this._macdAllMax = this._macdAllVals.length ? Math.max(...this._macdAllVals) * 1.1 : 0;
        }
        const kdjVals = [...(data.k||[]), ...(data.d||[]), ...(data.j||[])].filter(v => v != null);
        if (kdjVals.length) {
            this._kdjMin = Math.min(...kdjVals) * 1.1;
            this._kdjMax = Math.max(...kdjVals) * 1.1;
            this._kdjRange = this._kdjMax - this._kdjMin || 1;
        }

        // also cache for _drawKDJLine
        this._kdjK = data.k || [];
        this._kdjD = data.d || [];
        this._kdjJ = data.j || [];

        this.ctx.fillStyle = this.options.bgColor;
        this.ctx.fillRect(0, 0, this.width, this.height);
        this._drawLabels();
    }

    startEntry() {
        if (!this.data) return;
        console.log('[Kline] 开始动画播放，数据点数:', this.data.n_points);
        this.clipProgress = 0;
        this.playProgress = 0;
        this.entryComplete = false;
        this._startEntryAnimation();
    }

    _startEntryAnimation() {
        if (!this.data) return;
        this.entryStartTime = performance.now();
        console.log('[Kline] 开始进入动画，持续时间:', this.options.entryDuration);
        const animate = (now) => {
            const elapsed = now - this.entryStartTime;
            this.clipProgress = Math.min(1, elapsed / this.options.entryDuration);
            this.draw();
            if (this.clipProgress < 1) {
                this.entryAnimationId = requestAnimationFrame(animate);
            } else {
                this.entryComplete = true;
                console.log('[Kline] 进入动画完成');
            }
        };
        this.entryAnimationId = requestAnimationFrame(animate);
    }



    reset() {
        if (this.entryAnimationId) cancelAnimationFrame(this.entryAnimationId);
        this.data = null; this.clipProgress = 0; this.playProgress = 0; this.entryComplete = false;
        this.ctx.fillStyle = this.options.bgColor;
        this.ctx.fillRect(0, 0, this.width, this.height);
    }

    draw() {
        if (!this.data) return;
        const ctx = this.ctx;
        const progress = this.entryComplete ? this.playProgress : this.clipProgress;

        ctx.fillStyle = this.options.bgColor;
        ctx.fillRect(0, 0, this.width, this.height);

        ctx.save();
        ctx.beginPath();
        // 拉出效果：clip 从左到右，progress 0→1
        ctx.rect(0, 0, this.width * progress, this.height);
        ctx.clip();

        this._drawGrid();
        this._drawMALine(this.data.ma5, this.options.ma5Color);
        this._drawMALine(this.data.ma10, this.options.ma10Color);
        this._drawKline();
        this._drawVolume();
        this._drawMACD();
        this._drawKDJ();
        ctx.restore();

        if (progress > 0) this._drawPlayLine(progress);
        this._drawLabels();
    }

    _drawGrid() {
        const ctx = this.ctx;
        ctx.strokeStyle = this.options.gridColor;
        ctx.lineWidth = 0.5;
        for (let i = 0; i <= 5; i++) {
            const y = (this.height / 5) * i;
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.width, y); ctx.stroke();
        }
        for (let i = 0; i <= 10; i++) {
            const x = (this.width / 10) * i;
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, this.height); ctx.stroke();
        }
    }

    _drawMALine(maData, color) {
        if (!maData) return;
        const ctx = this.ctx;
        const y0 = this.height * this.layout.kline.y;
        const h = this.height * this.layout.kline.h;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        let started = false;
        for (let i = 0; i < this.n_points; i++) {
            const val = maData[i];
            if (val == null) continue;
            const x = (i / (this.n_points - 1)) * this.width;
            const y = y0 + h - (val - this.minPrice) / this.priceRange * h;
            if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
        }
        ctx.stroke();
    }

    _drawKline() {
        const ctx = this.ctx, data = this.data;
        const y0 = this.height * this.layout.kline.y;
        const h = this.height * this.layout.kline.h;
        const candleWidth = Math.max(2, (this.width / this.n_points) * 0.7);

        for (let i = 0; i < this.n_points; i++) {
            const x = (i / (this.n_points - 1)) * this.width;
            const o = data.opens[i], c = data.closes[i];
            const high = data.highs[i], low = data.lows[i];
            if (o == null || c == null) continue;
            const isUp = c >= o;
            const color = isUp ? this.options.upColor : this.options.downColor;

            const yHigh = y0 + h - (high - this.minPrice) / this.priceRange * h;
            const yLow = y0 + h - (low - this.minPrice) / this.priceRange * h;
            ctx.strokeStyle = color; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(x, yHigh); ctx.lineTo(x, yLow); ctx.stroke();

            const yOpen = y0 + h - (Math.max(o, c) - this.minPrice) / this.priceRange * h;
            const yClose = y0 + h - (Math.min(o, c) - this.minPrice) / this.priceRange * h;
            const bodyHeight = Math.max(1, yOpen - yClose);
            ctx.fillStyle = color;
            ctx.fillRect(x - candleWidth / 2, yClose, candleWidth, bodyHeight);
        }
    }

    _drawVolume() {
        const ctx = this.ctx, data = this.data;
        const y0 = this.height * this.layout.volume.y;
        const h = this.height * this.layout.volume.h;
        const maxVol = this._volMax || (Math.max(...data.volumes.filter(v => v != null)) * 1.1);
        const barWidth = Math.max(2, (this.width / this.n_points) * 0.7);

        for (let i = 0; i < this.n_points; i++) {
            const vol = data.volumes[i];
            if (vol == null) continue;
            const x = (i / (this.n_points - 1)) * this.width;
            const isUp = data.closes[i] >= data.opens[i];
            const barH = (vol / maxVol) * h;
            ctx.fillStyle = isUp ? this.options.volumeUpColor : this.options.volumeDownColor;
            ctx.globalAlpha = 0.7;
            ctx.fillRect(x - barWidth / 2, y0 + h - barH, barWidth, barH);
        }
        ctx.globalAlpha = 1;
    }

    _drawMACD() {
        const ctx = this.ctx, data = this.data;
        const y0 = this.height * this.layout.macd.y;
        const h = this.height * this.layout.macd.h;
        const macd     = data.macd     || [];
        const macdSig  = data.macd_signal  || [];
        const macdHist = data.macd_hist    || [];
        const macdMin  = this._macdMin  || 0;
        const macdMax  = this._macdMax  || 1;
        const macdRange = this._macdRange || 1;
        const zeroY = y0 + h - (0 - macdMin) / macdRange * h;
        const barW2 = Math.max(2, (this.width / this.n_points) * 0.65);

        for (let i = 0; i < this.n_points; i++) {
            const val = macdHist[i];
            if (val == null) continue;
            const x = (i / (this.n_points - 1)) * this.width;
            const y = y0 + h - (val - macdMin) / macdRange * h;
            ctx.fillStyle = val >= 0 ? '#27ae60' : '#e74c3c';
            ctx.globalAlpha = 0.85;
            if (val >= 0) ctx.fillRect(x - barW2 / 2, y, barW2, Math.max(1, zeroY - y));
            else ctx.fillRect(x - barW2 / 2, zeroY, barW2, Math.max(1, y - zeroY));
        }
        ctx.globalAlpha = 1;

        // DIF线
        ctx.strokeStyle = '#f1c40f'; ctx.lineWidth = 1.5; ctx.beginPath();
        let started = false;
        for (let i = 0; i < this.n_points; i++) {
            const val = macd[i];
            if (val == null) continue;
            const x = (i / (this.n_points - 1)) * this.width;
            const y = y0 + h - (val - macdMin) / macdRange * h;
            if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // DEA线
        ctx.strokeStyle = '#bd93f9'; ctx.lineWidth = 1.5; ctx.beginPath();
        started = false;
        for (let i = 0; i < this.n_points; i++) {
            const val = macdSig[i];
            if (val == null) continue;
            const x = (i / (this.n_points - 1)) * this.width;
            const y = y0 + h - (val - macdMin) / macdRange * h;
            if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
        }
        ctx.stroke();
    }

    _drawKDJ() {
        const ctx = this.ctx, data = this.data;
        const y0 = this.height * this.layout.kdj.y;
        const h = this.height * this.layout.kdj.h;
        this._drawKDJLine(this._kdjK, this.options.kdjKColor, y0, h);
        this._drawKDJLine(this._kdjD, this.options.kdjDColor, y0, h);
        this._drawKDJLine(this._kdjJ, this.options.kdjJColor, y0, h);

        ctx.strokeStyle = '#44475a'; ctx.lineWidth = 0.5; ctx.setLineDash([3, 3]);
        [20, 50, 80].forEach(level => {
            const ly = y0 + h - (level / 100) * h;
            ctx.beginPath(); ctx.moveTo(0, ly); ctx.lineTo(this.width, ly); ctx.stroke();
        });
        ctx.setLineDash([]);

        ctx.fillStyle = this.options.kdjKColor; ctx.font = '10px Arial'; ctx.fillText('K', 5, y0 + 12);
        ctx.fillStyle = this.options.kdjDColor; ctx.fillText('D', 20, y0 + 12);
        ctx.fillStyle = this.options.kdjJColor; ctx.fillText('J', 35, y0 + 12);
    }

    _drawKDJLine(kdjData, color, y0, h) {
        if (!kdjData) return;
        const ctx = this.ctx;
        ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.beginPath();
        let started = false;
        for (let i = 0; i < this.n_points; i++) {
            const val = kdjData[i];
            if (val == null) continue;
            const x = (i / (this.n_points - 1)) * this.width;
            const y = y0 + h - (val / 100) * h;
            if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
        }
        ctx.stroke();
    }

    _drawPlayLine(progress) {
        const ctx = this.ctx;
        const x = progress * this.width;
        ctx.shadowColor = this.options.playLineColor; ctx.shadowBlur = 15;
        ctx.strokeStyle = this.options.playLineColor; ctx.lineWidth = 2.5;
        ctx.setLineDash([6, 4]);
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, this.height); ctx.stroke();
        ctx.setLineDash([]); ctx.shadowBlur = 0;

        // kbarok 文字
        const text = 'kbarok', fontSize = 13;
        ctx.font = `bold ${fontSize}px Arial`;
        const lineIndex = Math.round(progress * (this.n_points - 1));
        let ty = 18;
        if (this.data?.ma5) {
            const ma5Val = this.data.ma5[lineIndex];
            if (ma5Val != null) {
                const y0 = this.height * this.layout.kline.y;
                const h = this.height * this.layout.kline.h;
                ty = y0 + h - (ma5Val - this.minPrice) / this.priceRange * h;
            }
        }
        ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 12;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(text, x + 10, ty);
        ctx.shadowBlur = 0;
    }

    _drawLabels() {
        const ctx = this.ctx;
        ctx.fillStyle = this.options.textColor; ctx.font = '11px Arial'; ctx.textAlign = 'left';
        const y0 = this.height * this.layout.kline.y;
        const h = this.height * this.layout.kline.h;
        for (let i = 0; i <= 4; i++) {
            const price = this.minPrice + (this.priceRange / 4) * i;
            const y = y0 + h - (i / 4) * h;
            ctx.fillText(price.toFixed(2), 5, y + 4);
        }
        ctx.font = '10px Arial';
        ctx.fillStyle = this.options.ma5Color; ctx.fillText('MA5', 60, 15);
        ctx.fillStyle = this.options.ma10Color; ctx.fillText('MA10', 100, 15);
    }

    bindAudio(audioElement) {
        this.audioElement = audioElement;
        const onTimeUpdate = () => {
            // 音频时间更新始终驱动K线播放进度（不管入场动画是否完成）
            this.playProgress = audioElement.currentTime / (audioElement.duration || 1);
            // 如果入场动画未完成，先完成它（让音频接管）
            if (!this.entryComplete) {
                this.entryComplete = true;
                this.clipProgress = 1;
                if (this.entryAnimationId) {
                    cancelAnimationFrame(this.entryAnimationId);
                    this.entryAnimationId = null;
                }
            }
            this.draw();
        };
        audioElement.addEventListener('timeupdate', onTimeUpdate);
        audioElement.addEventListener('ended', () => { 
            this.playProgress = 1; 
            this.draw();
            // 音频结束后重新开始循环
            setTimeout(() => {
                this.playProgress = 0;
                if (this.audioElement && this.audioElement.currentTime === this.audioElement.duration) {
                    this.audioElement.currentTime = 0;
                    this.audioElement.play().catch(e => console.warn('[Kline] 音频循环失败:', e));
                }
            }, 1000);
        });
    }

    // Web Audio API 版本：用 AudioContext.currentTime 驱动
    bindWebAudio(audioContext, startTime, duration) {
        this.audioContext = audioContext;
        this.audioStartTime = startTime;
        this.musicDuration = duration || 60;

        // 取消旧动画帧
        if (this.webAudioAnimId) {
            cancelAnimationFrame(this.webAudioAnimId);
            this.webAudioAnimId = null;
        }
        if (this.entryAnimationId) {
            cancelAnimationFrame(this.entryAnimationId);
            this.entryAnimationId = null;
        }
        this.entryComplete = true;
        this.clipProgress = 1;
        this.playProgress = 0;

        // 缓存info bar DOM引用，避免每帧查询
        const domCache = {
            stockCode: document.getElementById('stockCode'),
            stockPrice: document.getElementById('stockPrice'),
            stockChange: document.getElementById('stockChange'),
            stockAmount: document.getElementById('stockAmount'),
            stockRange: document.getElementById('stockRange'),
        };

        // 预计算各区域最大值（每帧重新算太贵）
        let _volMaxCache = 0;
        let _macdMinCache = 0, _macdMaxCache = 0, _macdRangeCache = 0;
        let _kdjMinCache = 0, _kdjMaxCache = 0, _kdjRangeCache = 0;

        const recomputeStats = () => {
            if (!this.data) return;
            _volMaxCache = Math.max(...this.data.volumes.filter(v => v != null)) * 1.1;
            const macdHist = this.data.macd_hist || [];
            const mVals = macdHist.filter(v => v != null);
            if (mVals.length) { _macdMinCache = Math.min(...mVals) * 1.1; _macdMaxCache = Math.max(...mVals) * 1.1; _macdRangeCache = _macdMaxCache - _macdMinCache || 1; }
            const kdjVals = [...(this.data.k || []), ...(this.data.d || []), ...(this.data.j || [])].filter(v => v != null);
            if (kdjVals.length) { _kdjMinCache = Math.min(...kdjVals) * 1.1; _kdjMaxCache = Math.max(...kdjVals) * 1.1; _kdjRangeCache = _kdjMaxCache - _kdjMinCache || 1; }
        };
        recomputeStats();

        // info bar 更新限速：每5%进度更新一次
        let lastBarIndex = -1;
        const updateInfoBar = (barIndex) => {
            if (!this.data || barIndex === lastBarIndex || barIndex < 0) return;
            lastBarIndex = barIndex;
            const close = this.data.closes[barIndex];
            const prevClose = barIndex > 0 ? this.data.closes[barIndex - 1] : close;
            const change = close - prevClose;
            const changePct = prevClose !== 0 ? (change / prevClose * 100).toFixed(2) : '0.00';
            const isUp = change >= 0;
            const upCls = isUp ? 'up' : 'down';
            const pctStr = `${isUp ? '+' : ''}${change.toFixed(2)} (${isUp ? '+' : ''}${changePct}%)`;
            if (domCache.stockCode) domCache.stockCode.textContent = this.data.code || '--';
            if (domCache.stockPrice) domCache.stockPrice.textContent = close != null ? close.toFixed(2) : '--';
            if (domCache.stockChange && close != null && prevClose !== 0) {
                domCache.stockChange.textContent = pctStr;
                domCache.stockChange.className = `stock-change ${upCls}`;
            }
            if (domCache.stockAmount && this.data.volumes && this.data.volumes[barIndex] != null) {
                domCache.stockAmount.textContent = (this.data.volumes[barIndex] / 10000).toFixed(0) + '万';
            }
            if (domCache.stockRange && this.data.dates && this.data.dates[barIndex]) {
                domCache.stockRange.textContent = this.data.dates[barIndex];
            }
        };

        // RAF 循环驱动进度
        const animate = () => {
            if (!this.audioContext) return;
            const elapsed = this.audioContext.currentTime - this.audioStartTime;
            const newProgress = Math.max(0, Math.min(1, elapsed / this.musicDuration));
            this.playProgress = newProgress;

            // info bar 限速更新（每5%进度更新一次）
            const barIndex = Math.floor((this.data?.n_points - 1 || 1) * newProgress);
            if (Math.abs(newProgress - (lastBarIndex / (this.data?.n_points - 1 || 1))) > 0.04) {
                updateInfoBar(barIndex);
            }

            this.draw();

            if (newProgress >= 1) {
                this.playProgress = 0;
                lastBarIndex = -1;
                if (this.onLoop) this.onLoop();
            } else {
                this.webAudioAnimId = requestAnimationFrame(animate);
            }
        };
        this.webAudioAnimId = requestAnimationFrame(animate);
    }

    stopWebAudio() {
        if (this.webAudioAnimId) {
            cancelAnimationFrame(this.webAudioAnimId);
            this.webAudioAnimId = null;
        }
        if (this.audioContext && this.audioContext.state === 'running') {
            this.audioContext.suspend();
        }
    }

    reset() {
        if (this.entryAnimationId) cancelAnimationFrame(this.entryAnimationId);
        this.data = null; this.clipProgress = 0; this.playProgress = 0; this.entryComplete = false;
        this.ctx.fillStyle = this.options.bgColor;
        this.ctx.fillRect(0, 0, this.width, this.height);
    }
}

window.KlineCanvas = KlineCanvas;
