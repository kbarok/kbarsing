/**
 * kbarok v9 - api.js
 * 统一 API 层
 */

const KbarokAPI = (function() {
    async function request(url, options = {}) {
        const config = {
            headers: { 'Content-Type': 'application/json' },
            ...options
        };
        try {
            const res = await fetch(url, config);
            const data = await res.json();
            if (!res.ok) {
                return { success: false, error: data.error || `HTTP ${res.status}` };
            }
            return data;
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    function post(url, body) {
        return request(url, { method: 'POST', body: JSON.stringify(body) });
    }

    function get(url) {
        return request(url, { method: 'GET' });
    }

    // K线数据
    async function getKlineData(code, startDate, endDate) {
        return post('/api/v2/kline', {
            code,
            start_date: startDate,
            end_date: endDate
        });
    }

    // 获取配置（音色/节奏列表）
    async function getConfig() {
        return get('/api/v2/config');
    }

    // 生成音乐
    async function generateMusic(code, params) {
        return post('/api/v2/generate', {
            code,
            ...params
        });
    }

    return {
        request,
        get,
        post,
        getKlineData,
        getConfig,
        generateMusic
    };
})();

window.KbarokAPI = KbarokAPI;