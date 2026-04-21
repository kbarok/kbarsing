/**
 * kbarsing - 技术指标计算模块
 * 计算MA、MACD、KDJ等技术指标
 */

const KlineIndicators = (function() {
    
    /**
     * 计算简单移动平均线 (SMA/MA)
     * @param {Array} data - 价格数据
     * @param {number} period - 周期
     * @returns {Array} MA数组
     */
    function calculateMA(data, period) {
        const result = [];
        for (let i = 0; i < data.length; i++) {
            if (i < period - 1) {
                result.push(null);
                continue;
            }
            let sum = 0;
            for (let j = 0; j < period; j++) {
                sum += data[i - j];
            }
            result.push(sum / period);
        }
        return result;
    }
    
    /**
     * 计算指数移动平均线 (EMA)
     * @param {Array} data - 价格数据
     * @param {number} period - 周期
     * @returns {Array} EMA数组
     */
    function calculateEMA(data, period) {
        const result = [];
        const multiplier = 2 / (period + 1);
        
        for (let i = 0; i < data.length; i++) {
            if (i === 0) {
                result.push(data[0]);
            } else {
                const ema = (data[i] - result[i - 1]) * multiplier + result[i - 1];
                result.push(ema);
            }
        }
        return result;
    }
    
    /**
     * 计算MACD指标
     * @param {Array} closes - 收盘价数组
     * @param {number} fastPeriod - 快线周期 (默认12)
     * @param {number} slowPeriod - 慢线周期 (默认26)
     * @param {number} signalPeriod - 信号线周期 (默认9)
     * @returns {Object} {macd, macd_signal, macd_hist}
     */
    function calculateMACD(closes, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
        const ema12 = calculateEMA(closes, fastPeriod);
        const ema26 = calculateEMA(closes, slowPeriod);
        
        const macd = [];
        for (let i = 0; i < closes.length; i++) {
            macd.push(ema12[i] - ema26[i]);
        }
        
        const macdSignal = calculateEMA(macd, signalPeriod);
        
        const macdHist = [];
        for (let i = 0; i < closes.length; i++) {
            macdHist.push(macd[i] - macdSignal[i]);
        }
        
        return {
            macd: macd,
            macd_signal: macdSignal,
            macd_hist: macdHist
        };
    }
    
    /**
     * 计算KDJ指标
     * @param {Array} highs - 最高价数组
     * @param {Array} lows - 最低价数组
     * @param {Array} closes - 收盘价数组
     * @param {number} period - 周期 (默认9)
     * @returns {Object} {kdj_k, kdj_d, kdj_j}
     */
    function calculateKDJ(highs, lows, closes, period = 9) {
        const k = [];
        const d = [];
        const j = [];
        
        let prevK = 50;
        let prevD = 50;
        
        for (let i = 0; i < closes.length; i++) {
            if (i < period - 1) {
                k.push(null);
                d.push(null);
                j.push(null);
                continue;
            }
            
            // 计算周期内的最高价和最低价
            let highest = highs[i];
            let lowest = lows[i];
            for (let j = i - period + 1; j < i; j++) {
                if (highs[j] > highest) highest = highs[j];
                if (lows[j] < lowest) lowest = lows[j];
            }
            
            const range = highest - lowest;
            if (range === 0) {
                k.push(prevK);
                d.push(prevD);
                j.push(3 * prevK - 2 * prevD);
                continue;
            }
            
            const rsv = (closes[i] - lowest) / range * 100;
            
            const currK = (2 / 3) * prevK + (1 / 3) * rsv;
            const currD = (2 / 3) * prevD + (1 / 3) * currK;
            const currJ = 3 * currK - 2 * currD;
            
            k.push(currK);
            d.push(currD);
            j.push(currJ);
            
            prevK = currK;
            prevD = currD;
        }
        
        return {
            kdj_k: k,
            kdj_d: d,
            kdj_j: j
        };
    }
    
    /**
     * 为K线数据计算所有指标
     * @param {Object} klineData - K线数据 {opens, highs, lows, closes, volumes}
     * @returns {Object} 添加了指标的K线数据
     */
    function calculateAll(klineData) {
        const { opens, highs, lows, closes, volumes } = klineData;
        
        // 计算MA
        const ma5 = calculateMA(closes, 5);
        const ma10 = calculateMA(closes, 10);
        
        // 计算MACD
        const macdData = calculateMACD(closes);
        
        // 计算KDJ
        const kdjData = calculateKDJ(highs, lows, closes);
        
        return {
            ...klineData,
            ma5,
            ma10,
            ...macdData,
            ...kdjData
        };
    }
    
    // ==================== 导出 ====================
    return {
        calculateMA,
        calculateEMA,
        calculateMACD,
        calculateKDJ,
        calculateAll
    };
})();

// 挂载到全局
window.KlineIndicators = KlineIndicators;

console.log('[Indicators] KlineIndicators 模块加载完成');
