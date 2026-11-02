"use strict";

/**
 * Plays a local (base64 data-URL) audio file on loop, as the counterpart to
 * youtubeSoundtrackManager for soundtrack overrides that aren't a YouTube link.
 */
class LocalAudioManager {
    constructor() {
        this.el = null;
        this.currentKey = null;
        this.volume = 0.2;
    }

    ensureEl() {
        if (this.el) return this.el;
        const el = document.createElement('audio');
        el.loop = true;
        el.id = 'vfLocalAudioTrack';
        el.style.display = 'none';
        document.body.appendChild(el);
        this.el = el;
        return el;
    }

    play(key, dataUrl) {
        if (!dataUrl) return false;
        const el = this.ensureEl();
        if (this.currentKey === key && !el.paused) return true;
        this.currentKey = key;
        el.src = dataUrl;
        el.volume = Math.max(0, Math.min(1, this.volume));
        el.play().catch(() => { /* needs a user gesture first — fine, next interaction retries */ });
        return true;
    }

    stop() {
        if (!this.el) return;
        this.el.pause();
        this.el.removeAttribute('src');
        this.el.load();
        this.currentKey = null;
    }

    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, Number(volume) || 0));
        if (this.el) this.el.volume = this.volume;
    }

    isPlaying(key) {
        return this.currentKey === key && !!this.el && !this.el.paused;
    }
}

const localAudioManager = new LocalAudioManager();
