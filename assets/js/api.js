/**
 * kbarok v10 - api.js
 * Pure frontend API layer (zero backend dependency)
 * Delegates to AppConfig for config + Tencent Finance for K-line data
 */

const KbarokAPI = (function () {
    console.log('[API] Pure frontend mode (zero backend)');

    // Config: from local hardcoded data
    async function getConfig() {
        return window.AppConfig.getConfig();
    }

    // K-line: from Tencent Finance public API
    async function getKlineData(code, startDate, endDate) {
        return window.AppConfig.getKlineData(code, startDate, endDate);
    }

    // Music generation: handled entirely by frontend MusicGenerator
    // This function is kept for API compatibility but does nothing
    async function generateMusic(code, params) {
        console.warn('[API] generateMusic() is now handled by MusicGenerator in app.js');
        return { success: false, error: 'Use MusicGenerator.generateAudio() directly' };
    }

    // Resolve URL: passthrough (no backend audio server)
    function resolveUrl(relativeUrl) {
        return relativeUrl; // audio is now generated locally as blob
    }

    return {
        getConfig,
        getKlineData,
        generateMusic,
        resolveUrl
    };
})();

window.KbarokAPI = KbarokAPI;
