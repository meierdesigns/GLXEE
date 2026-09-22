"use strict";

/**
 * YouTube IFrame background soundtracks for menu + planets.
 * Stores menu URL in localStorage; planet URLs live on planet configs.
 */
class YouTubeSoundtrackManager {
    constructor() {
        this.storageKey = 'vf_youtube_soundtracks_v1';
        this.menuUrl = '';
        this.apiReady = false;
        this.apiLoading = false;
        this.player = null;
        this.playerReady = false;
        this.pending = null;
        this.currentKey = null;
        this.currentVideoId = null;
        this.mode = null; // 'menu' | 'planet' | null
        this.enabled = true;
        this.volume = 0.2;
        this.hostEl = null;
        this.load();
        this.ensureHost();
        this.loadApi();
    }

    load() {
        try {
            const raw = localStorage.getItem(this.storageKey);
            if (!raw) return;
            const data = JSON.parse(raw);
            this.menuUrl = (data && data.menuUrl) ? String(data.menuUrl) : '';
        } catch (e) {
            this.menuUrl = '';
        }
    }

    save() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify({
                menuUrl: this.menuUrl || ''
            }));
        } catch (e) {
            // ignore
        }
    }

    getMenuUrl() {
        return this.menuUrl || '';
    }

    setMenuUrl(url) {
        this.menuUrl = String(url || '').trim();
        this.save();
        if (this.mode === 'menu') {
            if (this.menuUrl) this.playMenu();
            else this.stop();
        }
    }

    extractVideoId(input) {
        const raw = String(input || '').trim();
        if (!raw) return null;
        if (/^[\w-]{11}$/.test(raw)) return raw;

        let url;
        try {
            url = new URL(raw);
        } catch (e) {
            return null;
        }

        const host = (url.hostname || '').replace(/^www\./, '').toLowerCase();
        if (host === 'youtu.be') {
            const id = url.pathname.split('/').filter(Boolean)[0] || '';
            return /^[\w-]{11}$/.test(id) ? id : null;
        }
        if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
            const v = url.searchParams.get('v');
            if (v && /^[\w-]{11}$/.test(v)) return v;
            const parts = url.pathname.split('/').filter(Boolean);
            if (parts[0] === 'embed' || parts[0] === 'shorts' || parts[0] === 'live') {
                const id = parts[1] || '';
                return /^[\w-]{11}$/.test(id) ? id : null;
            }
        }
        return null;
    }

    getPlanetUrl(planetId) {
        if (typeof planetConfigManager === 'undefined') return '';
        const cfg = planetConfigManager.getConfig(planetId);
        return (cfg && cfg.soundtrackUrl) ? String(cfg.soundtrackUrl) : '';
    }

    ensureHost() {
        if (this.hostEl && document.body.contains(this.hostEl)) return this.hostEl;
        let el = document.getElementById('vfYtSoundtrack');
        if (!el) {
            el = document.createElement('div');
            el.id = 'vfYtSoundtrack';
            el.setAttribute('aria-hidden', 'true');
            el.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden;z-index:-1;';
            const player = document.createElement('div');
            player.id = 'vfYtPlayer';
            el.appendChild(player);
            document.body.appendChild(el);
        }
        this.hostEl = el;
        return el;
    }

    loadApi() {
        if (this.apiReady || this.apiLoading) return;
        if (typeof window.YT !== 'undefined' && window.YT.Player) {
            this.apiReady = true;
            this.flushPending();
            return;
        }
        this.apiLoading = true;
        const prev = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
            this.apiReady = true;
            this.apiLoading = false;
            if (typeof prev === 'function') {
                try { prev(); } catch (e) { /* ignore */ }
            }
            this.flushPending();
        };
        if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
            const tag = document.createElement('script');
            tag.src = 'https://www.youtube.com/iframe_api';
            tag.async = true;
            document.head.appendChild(tag);
        }
    }

    flushPending() {
        if (!this.pending) return;
        const job = this.pending;
        this.pending = null;
        this._playVideo(job.key, job.videoId, job.mode);
    }

    setEnabled(enabled) {
        this.enabled = !!enabled;
        if (!this.enabled) {
            this.pause();
            return;
        }
        if (this.mode === 'menu') this.playMenu();
        else if (this.mode === 'planet' && this.currentKey) {
            this.playPlanet(this.currentKey);
        }
    }

    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, Number(volume) || 0));
        this.applyVolume();
    }

    applyVolume() {
        if (!this.player || !this.playerReady || typeof this.player.setVolume !== 'function') return;
        try {
            const pct = Math.round(this.volume * 100);
            this.player.setVolume(pct);
            if (pct <= 0 || !this.enabled) this.player.mute();
            else this.player.unMute();
        } catch (e) {
            // ignore
        }
    }

    playMenu() {
        const videoId = this.extractVideoId(this.menuUrl);
        if (!videoId) {
            if (this.mode === 'menu') this.stop();
            return false;
        }
        return this._playVideo('menu', videoId, 'menu');
    }

    playPlanet(planetId) {
        const id = String(planetId || '').toLowerCase().split('-')[0];
        const videoId = this.extractVideoId(this.getPlanetUrl(id));
        if (!videoId) {
            if (this.mode === 'planet' && this.currentKey === id) this.stop();
            return false;
        }
        return this._playVideo(id, videoId, 'planet');
    }

    hasPlanetTrack(planetId) {
        const id = String(planetId || '').toLowerCase().split('-')[0];
        return !!this.extractVideoId(this.getPlanetUrl(id));
    }

    hasMenuTrack() {
        return !!this.extractVideoId(this.menuUrl);
    }

    _playVideo(key, videoId, mode) {
        if (!this.enabled) {
            this.mode = mode;
            this.currentKey = key;
            this.currentVideoId = videoId;
            return false;
        }
        this.ensureHost();
        this.loadApi();

        if (this.playerReady && this.currentVideoId === videoId && this.mode === mode) {
            this.resume();
            return true;
        }

        if (!this.apiReady) {
            this.pending = { key, videoId, mode };
            this.mode = mode;
            this.currentKey = key;
            this.currentVideoId = videoId;
            return true;
        }

        this.mode = mode;
        this.currentKey = key;
        this.currentVideoId = videoId;

        if (this.player && this.playerReady && typeof this.player.loadVideoById === 'function') {
            try {
                this.player.loadVideoById({ videoId: videoId, startSeconds: 0 });
                this.applyVolume();
                this.player.playVideo();
            } catch (e) {
                this._createPlayer(videoId);
            }
            return true;
        }

        this._createPlayer(videoId);
        return true;
    }

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
    }

    resume() {
        if (!this.enabled || !this.player || !this.playerReady) return;
        try {
            this.applyVolume();
            this.player.playVideo();
        } catch (e) { /* ignore */ }
    }

    pause() {
        if (!this.player || !this.playerReady) return;
        try {
            this.player.pauseVideo();
        } catch (e) { /* ignore */ }
    }

    stop() {
        this.pending = null;
        this.mode = null;
        this.currentKey = null;
        this.currentVideoId = null;
        if (!this.player || !this.playerReady) return;
        try {
            this.player.stopVideo();
        } catch (e) { /* ignore */ }
    }
}

const youtubeSoundtrackManager = new YouTubeSoundtrackManager();
