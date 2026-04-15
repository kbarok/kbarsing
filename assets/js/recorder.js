/**
 * recorder.js - 简化录制器
 * 点击下载按钮 → 自动录制30秒 → 自动下载
 */
(function () {
    let recordState = null;
    let autoDownloadTimer = null;

    // ---------- 录制 ----------
    function startRecording(canvas, video, code, instrument, rhythm) {
        if (recordState) return;
        if (!canvas || !video?.src) {
            console.warn('[Recorder] 请先生成音乐');
            if (window.KbarokUI?.showToast) window.KbarokUI.showToast('请先生成音乐', 2500);
            return;
        }

        // 显示录制中提示
        if (window.KbarokUI?.showToast) {
            window.KbarokUI.showToast('⏺ 录制中... 30秒后自动保存', 3000);
        }

        const stream = canvas.captureStream(30);

        try {
            const audioStream = video.captureStream?.() || video.mozCaptureStream?.();
            if (audioStream) {
                audioStream.getAudioTracks().forEach(t => stream.addTrack(t));
            }
        } catch (e) {
            console.warn('[Recorder] 音频合并失败:', e);
        }

        const mime = MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : 'video/webm';
        const chunks = [];
        const recorder = new MediaRecorder(stream, {
            mimeType: mime,
            videoBitsPerSecond: 5000000
        });

        recorder.ondataavailable = e => {
            if (e.data?.size) chunks.push(e.data);
        };

        recorder.onstop = () => {
            const blob = new Blob(chunks, { type: mime });
            const url = URL.createObjectURL(blob);
            
            // 自动下载
            const a = document.createElement('a');
            a.href = url;
            a.download = `kbarok_${code || 'demo'}_${new Date().toISOString().slice(0, 10)}.mp4`;
            a.click();
            
            // 提示已保存
            if (window.KbarokUI?.showToast) {
                window.KbarokUI.showToast('✓ 已保存到下载文件夹', 3000);
            }
            
            // 清理
            setTimeout(() => URL.revokeObjectURL(url), 10000);
            stream.getTracks().forEach(t => t.stop());
            recordState = null;
        };

        recorder.start(1000);
        recordState = { recorder, stream };

        // 30秒后自动停止
        autoDownloadTimer = setTimeout(() => {
            stopRecording();
        }, 30000);
    }

    function stopRecording() {
        if (autoDownloadTimer) {
            clearTimeout(autoDownloadTimer);
            autoDownloadTimer = null;
        }
        if (recordState) {
            recordState.recorder?.stop();
            recordState.stream?.getTracks().forEach(t => t.stop());
            recordState = null;
        }
    }

    function isRecording() {
        return !!recordState;
    }

    // 点击下载按钮触发
    function download() {
        const canvas = document.getElementById('klineCanvas');
        const video = document.getElementById('mainVideo');
        const code = document.getElementById('codeInput')?.value || 'demo';
        const instrument = document.getElementById('instrumentSelect')?.value || '钢琴';
        const rhythm = document.getElementById('rhythmSelect')?.value || '4/4';
        
        startRecording(canvas, video, code, instrument, rhythm);
    }

    window.DraftRecorder = {
        startRecording,
        stopRecording,
        isRecording,
        download
    };
})();
