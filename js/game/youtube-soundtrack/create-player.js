"use strict";

// YouTubeSoundtrackManager methods, split from youtube-soundtrack.js.
extendClass(YouTubeSoundtrackManager, {
    _createPlayer(videoId) {
        this.ensureHost();
        const mount = document.getElementById('vfYtPlayer');
        if (!mount || typeof window.YT === 'undefined' || !window.YT.Player) return;

        if (this.player && typeof this.player.destroy === 'function') {
            try { this.player.destroy(); } catch (e) { /* ignore */ }
        }
        this.player = null;
        this.playerReady = false;
        mount.innerHTML = '';

        this.player = new window.YT.Player('vfYtPlayer', {
            height: '1',
            width: '1',
            videoId: videoId,
            playerVars: {
                autoplay: 1,
                controls: 0,
                disablekb: 1,
                fs: 0,
                modestbranding: 1,
                playsinline: 1,
                rel: 0,
                loop: 1,
                playlist: videoId,
                origin: window.location.origin
            },
            events: {
                onReady: (event) => {
                    this.playerReady = true;
                    this.applyVolume();
                    try {
                        if (this.enabled) event.target.playVideo();
                        else event.target.pauseVideo();
                    } catch (e) { /* ignore */ }
                },
                onStateChange: (event) => {
                    if (event.data === window.YT.PlayerState.PLAYING
                        && this.mode === 'planet'
                        && typeof beatSyncManager !== 'undefined') {
                        beatSyncManager.restartFromNow();
                    }
                    // Loop fallback if playlist loop fails
                    if (event.data === window.YT.PlayerState.ENDED && this.currentVideoId) {
                        try {
                            event.target.seekTo(0);
                            event.target.playVideo();
                        } catch (e) { /* ignore */ }
                    }
                },
                onError: () => {
                    console.warn('YouTube soundtrack failed to play:', this.currentVideoId);
                }
            }
        });
    },

    resume() {
        if (!this.enabled || !this.player || !this.playerReady) return;
        try {
            this.applyVolume();
            this.player.playVideo();
        } catch (e) { /* ignore */ }
    },

    pause() {
        if (!this.player || !this.playerReady) return;
        try {
            this.player.pauseVideo();
        } catch (e) { /* ignore */ }
    },

    stop() {
        this.pending = null;
        this.mode = null;
        this.currentKey = null;
        this.currentVideoId = null;
        if (!this.player || !this.playerReady) return;
        try {
            this.player.stopVideo();
        } catch (e) { /* ignore */ }
    },
});
