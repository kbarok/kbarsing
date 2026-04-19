/**
 * kbarok v9 - player.js
 * 视频/音频播放控制
 * 支持多视频轮播、音量控制
 */

const KbarokPlayer = (function() {
    let currentVideoIndex = 0;
    let isPlaying = false;
    let isMuted = false;
    let initDone = false;
    
    // 检测微信环境
    const isWechat = /MicroMessenger/i.test(navigator.userAgent);
    if (isWechat) {
        console.log('[Player] 微信环境：禁用自动播放');
    }

    const videos = [
        'assets/video/video1_h264.mp4'
    ];

    function getVideo() {
        return document.getElementById('mainVideo');
    }

    function init() {
        if (initDone) return;
        initDone = true;

        const video = getVideo();
        if (!video) return;

        // 微信环境：不自动播放，等待用户点击
        if (isWechat) {
            video.src = videos[currentVideoIndex];
            video.muted = true;
            video.loop = true;
            video.playsInline = true;
            isPlaying = false;
            isMuted = true;
            console.log('[Player] 微信环境初始化完成，等待用户交互');
        } else {
            // 默认静音播放背景视频
            video.src = videos[currentVideoIndex];
            video.muted = true;
            video.loop = true;
            video.autoplay = true;
            video.playsInline = true;
            isPlaying = true;
            isMuted = true;
        }

        // ended 事件已被清空，不再监听
        // loop=true 由浏览器自动处理循环，不走 ended 事件

        video.addEventListener('error', () => {
            console.warn('[Player] 视频加载失败，尝试下一个');
            next();
        });

        // 同步核心状态
        if (window.KbarokCore) {
            window.KbarokCore.state.isPlaying = true;
            window.KbarokCore.state.audioPlaying = false;
        }
    }

    function getCurrentAudio() {
        // 优先返回正在播放的音频元素
        const kbarokAudio = document.getElementById('kbarokAudio');
        if (kbarokAudio) {
            return kbarokAudio;
        }
        return getVideo();
    }

    function play() {
        const audio = getCurrentAudio();
        if (!audio) return;
        audio.play().catch(() => {});
        isPlaying = true;
        if (window.KbarokCore) window.KbarokCore.state.isPlaying = true;
        syncButtons();
    }

    function pause() {
        const audio = getCurrentAudio();
        if (!audio) return;
        audio.pause();
        isPlaying = false;
        if (window.KbarokCore) window.KbarokCore.state.isPlaying = false;
        syncButtons();
    }

    function toggle() {
        const audio = getCurrentAudio();
        if (!audio) return;
        if (!audio.paused) {
            audio.pause();
            isPlaying = false;
        } else {
            audio.play().catch(() => {});
            isPlaying = true;
        }
        if (window.KbarokCore) window.KbarokCore.state.isPlaying = isPlaying;
        syncButtons();
    }

    function next() {
        const kbarokAudio = document.getElementById('kbarokAudio');
        if (kbarokAudio) {
            // 音画播放时，next按钮也作为暂停/继续按钮
            toggle();
        } else {
            // 预制视频时，切换到下一个视频
            currentVideoIndex = (currentVideoIndex + 1) % videos.length;
            const video = getVideo();
            if (!video) return;
            const wasPlaying = !video.paused && !isMuted;
            video.src = videos[currentVideoIndex];
            video.muted = isMuted;
            if (wasPlaying || (isPlaying && !isMuted)) {
                video.play().catch(() => {});
            }
            if (window.KbarokCore) {
                window.KbarokCore.state.currentVideo = currentVideoIndex + 1;
            }
            if (window.AppEvents) window.AppEvents.emit('player:next', { index: currentVideoIndex });
        }
    }

    function setMuted(muted) {
        const video = getVideo();
        if (!video) return;
        video.muted = muted;
        isMuted = muted;
        if (window.KbarokCore) window.KbarokCore.state.audioPlaying = !muted;
        syncButtons();
    }

    function toggleAudio() {
        const kbarokAudio = document.getElementById('kbarokAudio');
        if (kbarokAudio) {
            // 控制生成的音频
            kbarokAudio.muted = !kbarokAudio.muted;
            if (window.KbarokCore) window.KbarokCore.state.audioPlaying = !kbarokAudio.muted;
        } else {
            // 控制预制视频的静音状态
            setMuted(!isMuted);
        }
        syncButtons();
    }

    function syncButtons() {
        const btnStop = document.getElementById('btnStop');
        const btnListen = document.getElementById('btnListen');

        if (btnStop && window.KbarokCore) {
            const label = window.KbarokCore.t(isPlaying ? 'btn.stop' : 'btn.play');
            btnStop.textContent = label;
        }

        if (btnListen && window.KbarokCore) {
            const label = window.KbarokCore.t(isMuted ? 'btn.listen' : 'btn.mute');
            btnListen.textContent = label;
            btnListen.classList.toggle('listen-active', !isMuted);
        }
    }

    function setVolume(vol) {
        const video = getVideo();
        if (video) video.volume = Math.max(0, Math.min(1, vol));
    }

    function getVolume() {
        const video = getVideo();
        return video ? video.volume : 1;
    }

    // 外部暴露：绑定由 K线Canvas 调用
    function getCurrentTime() {
        const video = getVideo();
        return video ? video.currentTime : 0;
    }

    function getDuration() {
        const video = getVideo();
        return video ? video.duration : 0;
    }

    return {
        init,
        play,
        pause,
        toggle,
        next,
        toggleAudio,
        setMuted,
        syncButtons,
        setVolume,
        getVolume,
        getCurrentTime,
        getDuration
    };
})();

window.KbarokPlayer = KbarokPlayer;
