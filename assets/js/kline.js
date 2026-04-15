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
            ...options
        };

        this.data = null;
        this.n_points = 0;
        this.clipProgress = 0;
        this.playProgress = 0;
        this.entryComplete = false;

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
            console.log('[Kline] 动画进度:', this.clipProgress);
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

    draw() {
        if (!this.data) return;
        const ctx = this.ctx;
        const progress = this.entryComplete ? this.playProgress : this.clipProgress;

        ctx.fillStyle = this.options.bgColor;
        ctx.fillRect(0, 0, this.width, this.height);

        ctx.save();
        ctx.beginPath();
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
        
        // 动态更新信息条 - 确保每次绘制都更新
        if (this.data && window.updateInfoBarDynamic) {
            const barIndex = Math.floor((this.data.n_points - 1) * progress);
            if (barIndex >= 0 && barIndex < this.data.n_points) {
                console.log('[Kline] 动态更新信息条，进度:', progress, '索引:', barIndex);
                window.updateInfoBarDynamic(barIndex, this.data);
            }
        }
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
        const maxVol = Math.max(...data.volumes.filter(v => v != null)) * 1.1;
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
        const allVals = [...macd, ...macdSig, ...macdHist].filter(v => v != null);
        if (allVals.length === 0) return;
        const macdMin = Math.min(...allVals) * 1.1;
        const macdMax = Math.max(...allVals) * 1.1;
        const macdRange = macdMax - macdMin || 1;
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
        this._drawKDJLine(data.kdj_k, this.options.kdjKColor, y0, h);
        this._drawKDJLine(data.kdj_d, this.options.kdjDColor, y0, h);
        this._drawKDJLine(data.kdj_j, this.options.kdjJColor, y0, h);

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
            if (!this.entryComplete) return;
            this.playProgress = audioElement.currentTime / (audioElement.duration || 1);
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

    reset() {
        if (this.entryAnimationId) cancelAnimationFrame(this.entryAnimationId);
        this.data = null; this.clipProgress = 0; this.playProgress = 0; this.entryComplete = false;
        this.ctx.fillStyle = this.options.bgColor;
        this.ctx.fillRect(0, 0, this.width, this.height);
    }
}

window.KlineCanvas = KlineCanvas;
