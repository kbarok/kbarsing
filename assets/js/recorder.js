/**
 * recorder.js - 录制器 (纯前端版)
 * 点击下载 → 录制当前动画+音频 → 自动下载 WebM
 * 不依赖后端服务器
 */
(function () {
    let recordState = null;
    let autoDownloadTimer = null;

    function startRecording(canvas, code) {
        if (recordState) return;

        if (!canvas) {
            if (window.KbarokUI?.showToast) window.KbarokUI.showToast('请先生成音乐', 2500);
            return;
        }

        // 检查是否正在播放音乐
        const ctx = window._kbarokAudioCtx;
        if (!ctx || ctx.state === 'closed') {
            if (window.KbarokUI?.showToast) window.KbarokUI.showToast('请先生成音乐', 2500);
            return;
        }

        if (window.KbarokUI?.showToast) window.KbarokUI.showToast('⏺ 录制中... 再次点击下载按钮停止', 3000);

        const recordInfo = document.getElementById('recordInfo');
        const recordTime = document.getElementById('recordTime');
        if (recordInfo) recordInfo.style.display = 'inline-flex';

        // 抓画面
        const canvasStream = canvas.captureStream(30);

        // 抓声音：优先 Web Audio 录制流
        let audioTracks = [];
        if (window._kbarokMediaStream && window._kbarokMediaStream.getAudioTracks().length > 0) {
            audioTracks = window._kbarokMediaStream.getAudioTracks();
            console.log('[Recorder] 使用 Web Audio 录制流，轨道数:', audioTracks.length);
        } else {
            const audioEl = document.getElementById('kbarokAudio');
            if (audioEl && (audioEl.captureStream || audioEl.mozCaptureStream)) {
                try {
                    const audioStream = audioEl.captureStream ? audioEl.captureStream() : audioEl.mozCaptureStream();
                    audioTracks = audioStream.getAudioTracks();
                } catch (e) {
                    console.warn('[Recorder] audioEl.captureStream 失败:', e);
                }
            }
        }

        if (audioTracks.length === 0) {
            console.warn('[Recorder] 无音频轨道，录制纯视频');
            if (window.KbarokUI?.showToast) window.KbarokUI.showToast('⚠️ 无音频，录制纯视频', 3000);
        }

        const combined = new MediaStream([
            ...canvasStream.getVideoTracks(),
            ...audioTracks
        ]);

        // 选择编码格式
        let mime = 'video/webm;codecs=vp9,opus';
        if (!MediaRecorder.isTypeSupported(mime)) mime = 'video/webm;codecs=vp8,opus';
        if (!MediaRecorder.isTypeSupported(mime)) mime = 'video/webm';

        const chunks = [];
        const recorder = new MediaRecorder(combined, {
            mimeType: mime,
            videoBitsPerSecond: 5000000
        });

        recorder.ondataavailable = e => { if (e.data?.size) chunks.push(e.data); };

        recorder.onstop = () => {
            if (recordInfo) recordInfo.style.display = 'none';
            combined.getTracks().forEach(t => t.stop());

            // 直接下载
            const blob = new Blob(chunks, { type: mime });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const ts = new Date().toISOString().slice(0, 10);
            a.download = `kbarok_${code || 'demo'}_${ts}.webm`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 10000);

            if (window.KbarokUI?.showToast) window.KbarokUI.showToast('✓ 已保存到下载文件夹', 3000);
            recordState = null;
        };

        recorder.start(1000);
        recordState = { recorder, startTime: Date.now() };

        // 计时显示
        const timer = setInterval(() => {
            if (!recordState) { clearInterval(timer); return; }
            const s = Math.floor((Date.now() - recordState.startTime) / 1000);
            if (recordTime) recordTime.textContent = ` ${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')} `;
        }, 1000);
        recordState.timer = timer;

        // 最多60秒自动停止
        autoDownloadTimer = setTimeout(stopRecording, 60000);
    }

    function stopRecording() {
        if (autoDownloadTimer) { clearTimeout(autoDownloadTimer); autoDownloadTimer = null; }
        if (recordState) {
            clearInterval(recordState.timer);
            recordState.recorder?.stop();
        }
    }

    function isRecording() {
        return !!recordState;
    }

    // 点击下载按钮：如果正在录制→停止，否则→开始录制
    function download() {
        if (recordState) {
            stopRecording();
        } else {
            const canvas = document.getElementById('klineCanvas');
            const code = document.getElementById('codeInput')?.value || 'demo';
            startRecording(canvas, code);
        }
    }

    window.DraftRecorder = {
        startRecording,
        stopRecording,
        isRecording,
        download
    };
})();
