/**
 * kbarok v3 - ui.js (优化版)
 * UI 交互工具函数
 * 职责：DOM操作、UI状态同步、用户交互反馈
 */

const KbarokUI = (function() {
    // ==================== DOM 元素缓存 ====================
    const elements = {};
    
    function cacheElement(id) {
        if (!elements[id]) {
            elements[id] = document.getElementById(id);
        }
        return elements[id];
    }
    
    // ==================== 辅助函数 ====================
    function t(key) {
        return KbarokCore ? KbarokCore.t(key) : key;
    }
    
    function getState() {
        return KbarokCore ? KbarokCore.state : { lang: 'zh', exploreOpen: false, isCreating: false, isPlaying: false, audioPlaying: false };
    }
    
    // ==================== Toast ====================
    let toastTimer = null;
    
    function showToast(msg, type = 'info') {
        const toast = cacheElement('toast');
        if (!toast) return;
        
        toast.textContent = msg;
        toast.classList.remove('error-toast');
        if (type === 'error') toast.classList.add('error-toast');
        toast.classList.add('show');
        
        if (toastTimer) clearTimeout(toastTimer);
        const duration = 3000; // 3秒
        toastTimer = setTimeout(() => toast.classList.remove('show'), duration);
    }
    
    // ==================== Loading ====================
    function showLoading(show) {
        const el = cacheElement('loadingOverlay');
        if (el) el.classList.toggle('show', show);
    }
    
    // ==================== 弹窗 ====================
    function showModal(modalId) {
        const modal = cacheElement(modalId);
        if (modal) modal.classList.add('show');
    }
    
    function hideModal(modalId) {
        const modal = cacheElement(modalId);
        if (modal) modal.classList.remove('show');
    }
    
    function showDevelopingModal() {
        showModal('developingModal');
    }
    
    // ==================== 探索面板 ====================
    function toggleExplore() {
        const wrapper = cacheElement('exploreWrapper');
        const panel = wrapper?.querySelector('.explore-panel');
        const btn = cacheElement('btnExplore');
        const state = getState();
        
        state.exploreOpen = !state.exploreOpen;
        
        if (wrapper) wrapper.classList.toggle('show', state.exploreOpen);
        if (panel) panel.classList.toggle('show', state.exploreOpen);
        if (btn) {
            btn.classList.toggle('active', state.exploreOpen);
            btn.textContent = t(state.exploreOpen ? 'btn.collapse' : 'btn.explore');
        }
    }
    
    function collapseExplore() {
        const state = getState();
        if (state.exploreOpen) toggleExplore();
    }
    
    // ==================== 创作按钮 ====================
    // btnCreate removed from HTML — keeping function for compatibility
    function toggleCreate() {
        showDevelopingModal();
    }

    // ==================== 开发按钮 ====================
    function toggleDevelop() {
        showModal('developModal');
    }
    
    // ==================== 控制栏同步 ====================
    function syncControlBar() {
        const state = getState();
        const isZh = state.lang === 'zh';

        // 下载按钮（英文显示⬇，中文显示下载）
        const btnDownload = cacheElement('btnDownload');
        if (btnDownload) {
            btnDownload.textContent = isZh ? '下载' : '⬇';
        }

        // 全屏
        const btnFullscreen = cacheElement('btnFullscreen');
        if (btnFullscreen) {
            btnFullscreen.textContent = isZh ? '全屏' : '⛶';
        }

        // 播放/停止
        const btnStop = cacheElement('btnStop');
        if (btnStop) {
            if (isZh) {
                btnStop.textContent = t(state.isPlaying ? 'btn.stop' : 'btn.play');
            } else {
                btnStop.textContent = state.isPlaying ? '■' : '▶';
            }
        }

        // 试听/静音
        const btnListen = cacheElement('btnListen');
        if (btnListen) {
            if (isZh) {
                btnListen.textContent = t(state.audioPlaying ? 'btn.mute' : 'btn.listen');
            } else {
                btnListen.textContent = state.audioPlaying ? '🔇' : '🎧';
            }
            btnListen.classList.toggle('playing', state.audioPlaying);
            btnListen.classList.toggle('muted', !state.audioPlaying && !state.isPlaying);
        }

        // 探索/收起
        const btnExplore = cacheElement('btnExplore');
        if (btnExplore) {
            if (isZh) {
                btnExplore.textContent = t(state.exploreOpen ? 'btn.collapse' : 'btn.explore');
            } else {
                btnExplore.textContent = state.exploreOpen ? '▲' : '☰';
            }
            btnExplore.classList.toggle('active', state.exploreOpen);
        }
    }
    
    // ==================== 欢迎语 ====================
    function syncWelcome() {
        const en = cacheElement('welcomeEn');
        const zh = cacheElement('welcomeZh');
        const line = cacheElement('welcomeLine');
        const isZh = getState().lang === 'zh';
        
        if (en) {
            en.textContent = t('welcome.title');
            en.style.display = '';
        }
        if (zh) {
            zh.textContent = '';
            zh.style.display = 'none';
        }
        if (line) {
            line.classList.remove('lang-zh', 'lang-en');
            line.classList.add(isZh ? 'lang-zh' : 'lang-en');
        }
    }
    
    // ==================== 语言切换按钮 ====================
    // 按钮固定显示"中/EN"，点击切换正文，无需同步文字
    function syncLangToggle() {}
    
    // ==================== 探索面板文字 ====================
    function syncExplorePanel() {
        const fields = [
            ['labelInstrument', 'label.instrument'],
            ['labelRhythm', 'label.rhythm'],
            ['labelSynthType', 'label.synth_type'],
            ['labelSpeed', 'label.speed'],
            ['labelCode', 'label.code'],
            ['speedMin', 'speed.min'],
            ['speedMax', 'speed.max'],
            ['btnInput', 'btn.input'],
            ['btnGenerate', 'btn.generate'],
            ['btnSave', 'btn.save'],
            ['btnShare', 'btn.share']
        ];
        
        fields.forEach(([id, key]) => {
            const el = cacheElement(id);
            if (el) el.textContent = t(key);
        });
        
        // 特殊处理：placeholder
        const codeInput = cacheElement('codeInput');
        if (codeInput) codeInput.placeholder = t('input.placeholder');
        
        // 速度值
        const speedSlider = cacheElement('speedSlider');
        const speedVal = cacheElement('speedVal');
        if (speedVal && speedSlider) {
            speedVal.textContent = (parseInt(speedSlider.value) / 10).toFixed(1);
        }
    }
    
    // ==================== 底部提示 ====================
    function syncFooterTip() {
        const el = cacheElement('footerTip');
        if (el) el.textContent = t('footer.tip');
    }
    
    // ==================== 弹窗文字 + 创作图/开发图切换 ====================
    function syncModal() {
        const isZh = getState().lang === 'zh';

        // 创作弹窗图片
        const imgZh = cacheElement('modalImgZh');
        const imgEn = cacheElement('modalImgEn');
        if (imgZh) imgZh.style.display = isZh ? '' : 'none';
        if (imgEn) imgEn.style.display = isZh ? 'none' : '';

        // 开发弹窗图片
        const devImgZh = cacheElement('modalDevImgZh');
        const devImgEn = cacheElement('modalDevImgEn');
        if (devImgZh) devImgZh.style.display = isZh ? '' : 'none';
        if (devImgEn) devImgEn.style.display = isZh ? 'none' : '';

        // 创作弹窗文字
        const fields = [
            ['devTitle', 'developing.title'],
            ['devDesc', 'developing.desc'],
            ['devCloseBtn', 'modal.close']
        ];

        // 开发弹窗文字
        const devFields = [
            ['devTitle2', 'developing.title2'],
            ['devDesc2', 'developing.desc2'],
            ['devCloseBtn2', 'modal.close']
        ];
        devFields.forEach(([id, key]) => {
            const el = cacheElement(id);
            if (el) el.textContent = t(key);
        });

        fields.forEach(([id, key]) => {
            const el = cacheElement(id);
            if (el) el.textContent = t(key);
        });
    }
    
    // ==================== 视频占位文字 ====================
    function syncVideoPlaceholder() {
        const el = cacheElement('videoPlaceholder');
        const span = el?.querySelector('span');
        if (span) span.textContent = t('video.loading');
    }
    
    // ==================== 全量同步 ====================
    function syncAll() {
        syncControlBar();
        syncWelcome();
        syncLangToggle();
        syncExplorePanel();
        syncFooterTip();
        syncModal();
        syncVideoPlaceholder();
    }
    
    // ==================== 事件绑定 ====================
    function bindEvents() {
        // 创作弹窗关闭
        const closeBtn = cacheElement('devCloseBtn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => hideModal('developingModal'));
        }

        // 开发弹窗关闭按钮
        const closeBtn2 = cacheElement('devCloseBtn2');
        if (closeBtn2) {
            closeBtn2.addEventListener('click', () => hideModal('developModal'));
        }

        // 开发按钮（已移除，保留事件绑定容错）
        const btnDevelop = cacheElement('btnDevelop');
        if (btnDevelop) {
            btnDevelop.addEventListener('click', () => toggleDevelop());
        }
        
        // 点击弹窗遮罩关闭
        const modal = cacheElement('developingModal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) hideModal('developingModal');
            });
        }
        
        // ESC 关闭弹窗
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                hideModal('developingModal');
            }
        });
    }
    
    // ==================== 初始化 ====================
    function init() {
        bindEvents();
        syncAll();
    }
    
    // ==================== 公开 API ====================
    return {
        init,
        toggleExplore,
        toggleCreate,
        toggleDevelop,
        collapseExplore,
        showToast,
        showLoading,
        showModal,
        hideModal,
        showDevelopingModal,
        syncAll,
        syncControlBar,
        syncWelcome,
        syncLangToggle,
        syncExplorePanel,
        syncFooterTip,
        syncModal
    };
})();

window.KbarokUI = KbarokUI;