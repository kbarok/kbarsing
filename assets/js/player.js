/**
 * kbarok v9 - player.js
 * 视频单曲循环 + 音频播放控制
 */

const KbarokPlayer = (function() {
    let isPlaying = false;
    let isMuted = false;
    let initDone = false;

    const VIDEO_SRC = 'assets/video/video2.mp4';

    function getVideo() {
        return document.getElementById('mainVideo');
    }

    function init() {
        if (initDone) return;
        initDone = true;

        const video = getVideo();
        if (!video) return;

        video.src = VIDEO_SRC;
        video.muted = true;
        video.loop = true;
        video.autoplay = true;
        video.playsInline = true;
        isPlaying = true;
        isMuted = true;

        video.addEventListener('error', () => {
            console.warn('[Player] 视频加载失败:', VIDEO_SRC);
        });

        if (window.KbarokCore) {
            window.KbarokCore.state.isPlaying = true;
            window.KbarokCore.state.audioPlaying = false;
        }
    }

    function getCurrentAudio() {
        const kbarokAudio = document.getElementById('kbarokAudio');
        return kbarokAudio || getVideo();
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
            toggle();
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
            kbarokAudio.muted = !kbarokAudio.muted;
            if (window.KbarokCore) window.KbarokCore.state.audioPlaying = !kbarokAudio.muted;
        } else {
            setMuted(!isMuted);
        }
        syncButtons();
    }

    function syncButtons() {
        const btnStop = document.getElementById('btnStop');
        const btnListen = document.getElementById('btnListen');

        if (btnStop && window.KbarokCore) {
            btnStop.textContent = window.KbarokCore.t(isPlaying ? 'btn.stop' : 'btn.play');
        }

        if (btnListen && window.KbarokCore) {
            btnListen.textContent = window.KbarokCore.t(isMuted ? 'btn.listen' : 'btn.mute');
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
