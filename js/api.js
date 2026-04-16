/**
 * kbarok v9 - api.js
 * 统一 API 层
 */

const KbarokAPI = (function() {
    // 自动判断后端地址：本地/服务器直接用相对路径，Vercel 等外部域名用腾讯服务器
    const BACKEND_URL = (function() {
        const host = window.location.hostname;
        // 本地开发 或 腾讯服务器自身访问 → 相对路径
        if (host === 'localhost' || host === '127.0.0.1' || host === '101.35.217.113') {
            return '';
        }
        // Vercel / 其他外部域名 → 指向腾讯服务器
        return 'http://101.35.217.113';
    })();

    async function request(url, options = {}) {
        const config = {
            headers: { 'Content-Type': 'application/json' },
            ...options
        };
        try {
            const res = await fetch(BACKEND_URL + url, config);
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

    // 获取配置（颜色/乐器列表）
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
