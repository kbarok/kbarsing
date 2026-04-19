/**
 * kbarok v10 - config.js
 * Pure frontend config + stock data (Tencent Finance API)
 * Zero backend dependency
 */

const AppConfig = (function () {
    // ---- Hardcoded config (replaces /api/v2/config) ----
    const INSTRUMENTS = ['钢琴', '古筝', '小提琴', '电吉他', 'Future_Bass_Lead', 'KPop_Synth_Lead', 'Amapiano_Log_Drum'];
    const RHYTHM_STYLES = ['标准4拍', 'KPop_精准鼓组', 'Amapiano_非洲节奏', 'Synthwave_复古迪斯科'];

    // ---- Tencent Finance API (free, CORS supported) ----
    // URL pattern: https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param={market}{code},day,,,50,qfq
    // market: sz / sh   (A股前缀)
    // period: day / week / month
    // count: 50 (recent N bars)
    function buildTencentUrl(marketCode, count) {
        // marketCode: "sz300025" or "sh600519"
        return `https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${marketCode},day,,,${count || 50},qfq&_=${Date.now()}`;
    }

    // Normalize user input to "market + code" format
    function normalizeCode(code) {
        code = (code || '').trim().replace(/\s+/g, '');
        if (!code) return null;
        // Already has prefix
        if (/^(sz|sh)\d{6}$/.test(code)) return code;
        // Pure 6 digits -> auto detect market (3/0 = sz, 6 = sh)
        if (/^\d{6}$/.test(code)) {
            const first = code[0];
            return (first === '6' || first === '9') ? 'sh' + code : 'sz' + code;
        }
        return null;
    }

    // Parse Tencent API response to OHLCV arrays
    function parseTencentResponse(json, code) {
        try {
            const dayData = json.data[code];
            if (!dayData || !dayData.day || dayData.day.length === 0) {
                return null;
            }
            const raw = dayData.day; // array of "date,open,close,high,low,volume" strings
            const dates = [], opens = [], highs = [], lows = [], closes = [], volumes = [];
            for (const row of raw) {
                const parts = row.split(',');
                if (parts.length < 6) continue;
                dates.push(parts[0]);
                opens.push(parseFloat(parts[1]));
                closes.push(parseFloat(parts[2]));
                highs.push(parseFloat(parts[3]));
                lows.push(parseFloat(parts[4]));
                volumes.push(parseFloat(parts[5]));
            }
            return { dates, opens, highs, lows, closes, volumes };
        } catch (e) {
            console.error('[Config] Parse error:', e);
            return null;
        }
    }

    // ---- Technical indicators (calculated locally) ----
    function calcMA(closes, period) {
        const result = [];
        for (let i = 0; i < closes.length; i++) {
            if (i < period - 1) { result.push(null); continue; }
            let sum = 0;
            for (let j = i - period + 1; j <= i; j++) sum += closes[j];
            result.push(sum / period);
        }
        return result;
    }

    function calcEMA(values, period) {
        if (values.length === 0) return [];
        const k = 2 / (period + 1);
        const result = [values[0]];
        for (let i = 1; i < values.length; i++) {
            result.push(values[i] * k + result[i - 1] * (1 - k));
        }
        return result;
    }

    function calcMACD(closes, fast, slow, signal) {
        fast = fast || 12; slow = slow || 26; signal = signal || 9;
        const emaFast = calcEMA(closes, fast);
        const emaSlow = calcEMA(closes, slow);
        const dif = emaFast.map((v, i) => v - emaSlow[i]);
        const dea = calcEMA(dif, signal);
        const histogram = dif.map((v, i) => Math.round((v - dea[i]) * 100) / 100);
        return {
            dif: dif.map(v => Math.round(v * 100) / 100),
            dea: dea.map(v => Math.round(v * 100) / 100),
            histogram
        };
    }

    function calcKDJ(highs, lows, closes, n, m1, m2) {
        n = n || 9; m1 = m1 || 3; m2 = m2 || 3;
        const rsv = [], kArr = [], dArr = [], jArr = [];
        let prevK = 50, prevD = 50;
        for (let i = 0; i < closes.length; i++) {
            const start = Math.max(0, i - n + 1);
            let highest = -Infinity, lowest = Infinity;
            for (let j = start; j <= i; j++) {
                if (highs[j] > highest) highest = highs[j];
                if (lows[j] < lowest) lowest = lows[j];
            }
            const rsvVal = highest === lowest ? 50 : ((closes[i] - lowest) / (highest - lowest)) * 100;
            rsv.push(rsvVal);
            const k = (2 / m1) * prevK + (1 - 2 / m1) * rsvVal;
            const d = (2 / m2) * prevD + (1 - 2 / m2) * k;
            const j = 3 * k - 2 * d;
            kArr.push(Math.round(k * 100) / 100);
            dArr.push(Math.round(d * 100) / 100);
            jArr.push(Math.round(j * 100) / 100);
            prevK = k; prevD = d;
        }
        return { k: kArr, d: dArr, j: jArr };
    }

    // ---- Public API ----
    async function getConfig() {
        return {
            success: true,
            instruments: INSTRUMENTS,
            rhythm_styles: RHYTHM_STYLES
        };
    }

    async function getKlineData(code, startDate, endDate) {
        const normalized = normalizeCode(code);
        if (!normalized) return { success: false, error: 'Invalid code' };

        try {
            const url = buildTencentUrl(normalized, 60);
            console.log('[API] Fetching kline from Tencent:', url);
            const res = await fetch(url);
            const json = await res.json();

            const ohlcv = parseTencentResponse(json, normalized);
            if (!ohlcv || ohlcv.dates.length === 0) {
                return { success: false, error: 'No data returned' };
            }

            // Calculate technical indicators locally
            const ma5 = calcMA(ohlcv.closes, 5);
            const ma10 = calcMA(ohlcv.closes, 10);
            const macd = calcMACD(ohlcv.closes);
            const kdj = calcKDJ(ohlcv.highs, ohlcv.lows, ohlcv.closes);

            const n = ohlcv.dates.length;
            console.log('[API] Kline data loaded:', n, 'bars for', normalized);

            return {
                success: true,
                kline: {
                    code: normalized,
                    n_points: n,
                    dates: ohlcv.dates,
                    opens: ohlcv.opens,
                    highs: ohlcv.highs,
                    lows: ohlcv.lows,
                    closes: ohlcv.closes,
                    volumes: ohlcv.volumes,
                    ma5, ma10,
                    macd, kdj
                }
            };
        } catch (e) {
            console.error('[API] Kline fetch error:', e);
            return { success: false, error: e.message };
        }
    }

    return {
        getConfig,
        getKlineData,
        normalizeCode,
        INSTRUMENTS,
        RHYTHM_STYLES
    };
})();

window.AppConfig = AppConfig;
