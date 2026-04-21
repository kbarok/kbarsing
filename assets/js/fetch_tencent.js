/**
 * kbarsing - K线数据获取模块（纯前端化）
 * 数据源：腾讯财经K线API（东方财富API已不可用）
 */

const KlineFetcher = (function() {
    // ==================== API 端点 ====================
    const APIS = {
        // 腾讯K线历史数据（日K，前复权）
        tencentKline: 'https://web.ifzq.gtimg.cn/appstock/app/fqkline/get',
        // 腾讯实时行情
        tencentRealtime: 'https://qt.gtimg.cn/q='
    };

    // ==================== 代码格式转换 ====================
    function convertCode(code) {
        code = code.toUpperCase().trim();

        // A股：纯数字6位
        if (/^\d{6}$/.test(code)) {
            let prefix = 'sh';
            if (code.startsWith('00') || code.startsWith('30')) prefix = 'sz';
            if (code.startsWith('68')) prefix = 'sh';
            return { type: 'a', code: code, tencentCode: prefix + code, displayCode: code };
        }

        // A股带后缀 600519.SH
        if (/^(\d{6})\.(SH|SZ)$/i.test(code)) {
            const m = code.match(/^(\d{6})\.(SH|SZ)$/i);
            const c = m[1], market = m[2].toUpperCase();
            const prefix = market === 'SH' ? 'sh' : 'sz';
            return { type: 'a', code: c, tencentCode: prefix + c, displayCode: code };
        }

        // 美股 us.AAPL 或 us:AAPL
        if (/^US[:\.]?([A-Z]{1,5})$/i.test(code)) {
            const symbol = code.match(/^US[:\.]?([A-Z]{1,5})$/i)[1];
            return { type: 'us', code: symbol, tencentCode: 'us' + symbol, displayCode: 'US:' + symbol };
        }

        // 港股 hk.00700 或 hk:00700
        if (/^HK[:\.]?(\d{4,5})$/i.test(code)) {
            const num = code.match(/^HK[:\.]?(\d{4,5})$/i)[1].padStart(5, '0');
            return { type: 'hk', code: num, tencentCode: 'hk' + num, displayCode: 'HK:' + num };
        }

        return null;
    }

    // ==================== 腾讯K线数据 ====================
    async function fetchTencentKline(info, startDate, endDate) {
        const today = endDate || new Date().toISOString().split('T')[0];
        const halfYear = startDate || (() => {
            const d = new Date(); d.setMonth(d.getMonth() - 6);
            return d.toISOString().split('T')[0];
        })();

        const url = `${APIS.tencentKline}?param=${info.tencentCode},day,${halfYear},${today},300,qfq`;

        console.log('[Fetch] 请求腾讯K线:', url);

        try {
            const res = await fetch(url, {
                method: 'GET',
                headers: { 'Accept': 'application/json', 'Referer': 'https://gu.qq.com/' }
            });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();
            return parseTencentKline(data, info);
        } catch (e) {
            console.error('[Fetch] 腾讯K线获取失败:', e);
            return { success: false, error: e.message };
        }
    }

    function parseTencentKline(data, info) {
        const code = info.tencentCode;
        const stockData = data?.data?.[code];

        if (!stockData) {
            console.error('[Fetch] 腾讯返回数据为空:', data);
            return { success: false, error: '数据为空' };
        }

        let klines = stockData.qfqday || stockData.day || [];
        if (typeof klines === 'object' && !Array.isArray(klines)) {
            klines = klines.qfqday || klines.day || [];
        }

        if (!Array.isArray(klines) || klines.length === 0) {
            console.error('[Fetch] 无K线数据:', stockData);
            return { success: false, error: '无K线数据' };
        }

        console.log('[Fetch] 收到K线数据:', klines.length, '条');

        const dates = [], opens = [], highs = [], lows = [], closes = [], volumes = [];

        for (const line of klines) {
            let parts;
            if (Array.isArray(line)) {
                parts = line;
            } else if (typeof line === 'string') {
                parts = line.trim().split(/\s+/);
            } else {
                continue;
            }
            if (parts.length < 6) continue;

            dates.push(parts[0]);
            opens.push(parseFloat(parts[1]));
            closes.push(parseFloat(parts[2]));
            highs.push(parseFloat(parts[3]));
            lows.push(parseFloat(parts[4]));
            volumes.push(parseFloat(parts[5]));
        }

        return {
            success: true,
            kline: {
                code: info.displayCode || info.code,
                name: stockData.name || info.code,
                dates: dates,
                opens: opens,
                highs: highs,
                lows: lows,
                closes: closes,
                volumes: volumes,
                n_points: dates.length
            }
        };
    }

    // ==================== 腾讯实时行情 ====================
    async function fetchTencentRealtime(tencentCode) {
        const url = APIS.tencentRealtime + tencentCode;
        try {
            const res = await fetch(url, {
                method: 'GET',
                headers: { 'Accept': 'text/plain', 'Referer': 'https://gu.qq.com/' }
            });
            const text = await res.text();
            return parseTencentQuote(text, tencentCode);
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    function parseTencentQuote(text, code) {
        try {
            const match = text.match(/="([^"]+)"/);
            if (!match) return { success: false, error: '数据格式错误' };
            const parts = match[1].split('~');
            if (parts.length < 35) return { success: false, error: '数据不完整' };
            return {
                success: true,
                quote: {
                    code: code, name: parts[1], price: parseFloat(parts[3]),
                    change: parseFloat(parts[31]), changePct: parseFloat(parts[32]),
                    high: parseFloat(parts[33]), low: parseFloat(parts[34]),
                    volume: parseFloat(parts[36]), amount: parseFloat(parts[37])
                }
            };
        } catch (e) { return { success: false, error: '解析失败' }; }
    }

    // ==================== 主入口 ====================
    async function getKlineData(code, startDate, endDate) {
        const info = convertCode(code);
        if (!info) return { success: false, error: '无法识别的代码格式: ' + code };

        console.log('[Fetch] 解析代码:', info);

        // 使用腾讯K线API
        const result = await fetchTencentKline(info, startDate, endDate);

        if (result.success && result.kline.n_points > 0) {
            result.kline.code = code;
            console.log('[Fetch] K线获取成功:', result.kline.n_points, '条');

            // 计算技术指标
            if (window.KlineIndicators) {
                result.kline = window.KlineIndicators.calculateAll(result.kline);
                console.log('[Fetch] 指标计算完成');
            }
            return result;
        }

        // API失败，返回模拟数据
        console.warn('[Fetch] K线获取失败，使用模拟数据');
        return generateMockKline(code);
    }

    // ==================== 模拟数据（降级）====================
    function generateMockKline(code) {
        const n = 60;
        const basePrice = 100;
        const opens = [], highs = [], lows = [], closes = [], volumes = [], dates = [];
        let price = basePrice;
        const today = new Date();

        for (let i = 0; i < n; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() - (n - i - 1));
            dates.push(date.toISOString().split('T')[0]);
            const change = (Math.random() - 0.48) * 5;
            const open = price;
            const close = price + change;
            const high = Math.max(open, close) + Math.random() * 2;
            const low = Math.min(open, close) - Math.random() * 2;
            opens.push(open); closes.push(close);
            highs.push(high); lows.push(low);
            volumes.push(5000 + Math.random() * 10000);
            price = close;
        }

        const klineData = {
            code: code, name: '模拟数据', dates, opens, highs, lows, closes, volumes, n_points: n
        };
        if (window.KlineIndicators) {
            Object.assign(klineData, window.KlineIndicators.calculateAll(klineData));
        }
        return { success: true, kline: klineData };
    }

    return { getKlineData, convertCode, fetchTencentKline, fetchTencentRealtime, generateMockKline };
})();

window.KlineFetcher = KlineFetcher;
console.log('[Fetch] KlineFetcher 模块加载完成 (腾讯API版 v2)');
