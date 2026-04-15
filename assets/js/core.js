/**
 * Kbarok Core v9 - 全局状态、语言、工具
 */

const KbarokCore = {
    state: {
        lang: 'zh',
        exploreOpen: false,
        isCreating: false,
        isPlaying: true,
        audioPlaying: false,
        exploreParams: {
            code: '600519.sh',
            instrument: '古筝',
            rhythm: 'Amapiano_非洲节奏',
            speed: 1.0
        },
        currentVideo: 1
    },

    // 切换锁，防止快速连击导致乱码
    _switching: false,

    async init() {
        await this.loadLang(this.state.lang);
        console.log('[KbarokCore] 初始化完成');
    },

    async loadLang(lang) {
        try {
            const res = await fetch(`/lang/${lang}.json`);
            if (!res.ok) throw new Error('语言文件加载失败');
            this.langData = await res.json();
            this.state.lang = lang;
            console.log(`[KbarokCore] 语言切换为: ${lang}`);
        } catch (e) {
            console.error('[KbarokCore] 语言加载失败:', e);
            this.langData = {};
        }
    },

    async setLang(lang) {
        // 防止切换中再次点击
        if (this._switching) {
            console.log('[KbarokCore] 切换中，忽略重复点击');
            return;
        }
        this._switching = true;
        try {
            await this.loadLang(lang);
            // 触发UI同步
            if (window.KbarokUI) window.KbarokUI.syncAll();
            if (window.AppEvents) window.AppEvents.emit('lang:changed', { lang });
        } finally {
            this._switching = false;
        }
    },
    
    // 支持嵌套 key，如 'btn.play'
    t(key) {
        if (!this.langData) return key;
        const keys = key.split('.');
        let value = this.langData;
        for (const k of keys) {
            if (value[k] === undefined) return key;
            value = value[k];
        }
        return value;
    },
    
    // 工具方法
    debounce(func, wait) {
        let timeout;
        return function() {
            const context = this;
            const args = arguments;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), wait);
        };
    },
    
    throttle(func, limit) {
        let inThrottle;
        return function() {
            const context = this;
            const args = arguments;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
};

window.KbarokCore = KbarokCore;