/**
 * recorder.js - K线动画录制（修复版：每次下载独立 AudioContext）
 * 策略：视频轨道来自 Canvas，音频来自 AudioContext
 * 下载为 .mp4（扩展名伪装，格式仍是 WebM，微信/浏览器均可播）
 */
(function () {
    if (window.DraftRecorder) return;

    const canvasId = 'klineCanvas';
    const audioId  = 'kbarokAudio';

    // ── 工具 ────────────────────────────────────────────────
    function bestMime() {
        const candidates = [
            'video/webm;codecs=vp9,opus',
            'video/webm;codecs=vp8,opus',
            'video/webm;codecs=vp9',
            'video/webm',
        ];
        for (const m of candidates) {
            if (MediaRecorder.isTypeSupported(m)) return m;
        }
        return 'video/webm';
    }

    // ── 每次下载独立构建音频流（避免 AudioContext 状态污染）───
    function buildAudioStream() {
        const audioEl = document.getElementById(audioId);
        if (!audioEl || !audioEl.src || audioEl.src === window.location.href) {
            console.log('[Recorder] 音频元素无效或无 src');
            return null;
        }
        if (audioEl.readyState < 2) {
            console.log('[Recorder] 音频未就绪 (readyState=' + audioEl.readyState + ')，跳过');
            return null;
        }

        try {
            // 每次下载都创建全新的 AudioContext
            const audioCtx    = new (window.AudioContext || window.webkitAudioContext)();
            const mediaDest   = audioCtx.createMediaStreamDestination();

            // 如果 AudioContext 被自动播放策略挂起，先恢复
            if (audioCtx.state === 'suspended') {
                audioCtx.resume().catch(() => {});
            }

            // 创建 MediaElementSource 并连接
            const source = audioCtx.createMediaElementSource(audioEl);
            source.connect(audioCtx.destination);   // 能听到
            source.connect(mediaDest);              // 能录制

            const track = mediaDest.stream.getAudioTracks()[0];
            if (!track) {
                console.warn('[Recorder] MediaStreamDestination 没有音频轨道');
                return null;
            }

            console.log('[Recorder] 音频轨道已连接 (AudioContext: ' + audioCtx.state + ')');
            return track;
        } catch (err) {
            console.warn('[Recorder] 音频捕获失败:', err.name, err.message);
            return null;
        }
    }

    // ── 合成录制流（视频 + 音频）──────────────────────────
    function buildMixedStream() {
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.warn('[Recorder] Canvas 不存在');
            return null;
        }

        const videoStream = canvas.captureStream(30);
        const videoTracks = videoStream.getVideoTracks();
        console.log('[Recorder] 视频流 ID:', videoStream.id, '| 视频轨道数:', videoTracks.length);
        if (!videoTracks.length) {
            console.warn('[Recorder] 无视频轨道');
            return null;
        }

        // 用轨道数组构造 MediaStream（避免传整个 MediaStream 对象）
        const mixed = new MediaStream(videoTracks);

        const audioTrack = buildAudioStream();
        if (audioTrack) {
            mixed.addTrack(audioTrack);
        } else {
            console.warn('[Recorder] 无音频轨道，录制纯视频');
        }

        console.log('[Recorder] 混合流: 视频', mixed.getVideoTracks().length, '轨 | 音频', mixed.getAudioTracks().length, '轨');
        return mixed;
    }

    // ── 下载 blob ───────────────────────────────────────────
    function saveBlob(blob) {
        const url      = URL.createObjectURL(blob);
        const a        = document.createElement('a');
        a.href         = url;
        a.download     = 'kbarok_' + Date.now() + '.mp4';
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 20000);
    }

    // ── 核心下载函数（30 秒自动停止）────────────────────────
    function download() {
        console.log('[Recorder] 下载开始');

        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            window.KbarokUI?.showToast('⚠️ 请先生成音乐', 2500);
            return;
        }

        const stream = buildMixedStream();
        if (!stream || !stream.getVideoTracks().length) {
            window.KbarokUI?.showToast('⚠️ Canvas 未就绪，请先生成', 2500);
            return;
        }

        const mimeType = bestMime();
        let recorder;
        try {
            recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4_000_000 });
        } catch (e) {
            console.warn('[Recorder] 指定格式失败，降级:', e.message);
            recorder = new MediaRecorder(stream);
        }

        const chunks = [];
        let totalSize = 0;
        recorder.ondataavailable = e => {
            console.log('[Recorder] chunk, size:', e.data?.size);
            if (e.data?.size) {
                chunks.push(e.data);
                totalSize += e.data.size;
            }
        };
        recorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'video/webm' });
            console.log('[Recorder] 录制完成，总大小:', Math.round(totalSize / 1024), 'KB, chunks:', chunks.length);
            saveBlob(blob);
            window.KbarokUI?.showToast('✅ 视频已保存', 2500);
        };
        recorder.onerror = e => {
            console.error('[Recorder] 录制错误:', e);
            window.KbarokUI?.showToast('⚠️ 录制出错', 2500);
        };

        recorder.start(1000); // 每秒一个片段
        
        // 按钮显示录制中状态
        const btnDownload = document.getElementById('btnDownload');
        if (btnDownload) {
            btnDownload.classList.add('recording');
            btnDownload.textContent = '⏺';
        }
        
        window.KbarokUI?.showToast('⏺ 录制中，15秒后自动保存…', 3000);
        console.log('[Recorder] 录制中…');

        // 15 秒自动停止（简化版）
        setTimeout(() => {
            if (recorder.state === 'recording') {
                recorder.stop();
                console.log('[Recorder] 自动停止');
            }
            if (btnDownload) {
                btnDownload.classList.remove('recording');
                btnDownload.textContent = '⬇';
            }
        }, 15000);
    }

    // ── 暴露全局 ────────────────────────────────────────────
    window.DraftRecorder = { download };
    console.log('[Recorder] 已就绪');
})();
