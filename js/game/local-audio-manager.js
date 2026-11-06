"use strict";

/**
 * Plays a local (base64 data-URL) audio file on loop, as the counterpart to
 * youtubeSoundtrackManager for soundtrack overrides that aren't a YouTube link.
 */
class LocalAudioManager {
    constructor() {
        this.el = null;
        this.currentKey = null;
        this.volume = (typeof VFVolume !== 'undefined') ? VFVolume.busDefault() : 0.065;
        this.playbackRate = 1;
        this.crossfadeSeconds = 1.4;
        try {
            const xf = localStorage.getItem('vf_musicCrossfade');
            if (xf != null && Number.isFinite(parseFloat(xf))) {
                this.crossfadeSeconds = Math.max(0.2, Math.min(3, parseFloat(xf)));
            }
        } catch (e) { /* ignore */ }
        this._currentDataUrl = null;
        this._fadeTimer = null;
        this._outgoing = [];
    }

    ensureEl() {
        if (this.el) return this.el;
        const el = document.createElement('audio');
        el.loop = true;
        el.preload = 'auto';
        el.id = 'vfLocalAudioTrack';
        el.style.display = 'none';
        document.body.appendChild(el);
        this.el = el;
        return el;
    }

    _makeEl() {
        const el = document.createElement('audio');
        el.loop = true;
        el.preload = 'auto';
        el.style.display = 'none';
        document.body.appendChild(el);
        return el;
    }

    _rampVolume(el, from, to, seconds, onDone) {
        if (!el) {
            if (onDone) onDone();
            return;
        }
        const dur = Math.max(0.05, Number(seconds) || this.crossfadeSeconds);
        const start = Math.max(0, Math.min(1, from));
        const end = Math.max(0, Math.min(1, to));
        const t0 = performance.now();
        el.volume = start;
        const step = () => {
            const u = Math.min(1, (performance.now() - t0) / (dur * 1000));
            el.volume = start + (end - start) * u;
            if (u < 1) {
                requestAnimationFrame(step);
            } else if (onDone) {
                onDone();
            }
        };
        requestAnimationFrame(step);
    }

    _retireEl(el, fadeSec) {
        if (!el) return;
        // Cap stacked fades — rapid play() hops used to leave several
        // still-audible <audio> elements under the new track.
        if (this._outgoing && this._outgoing.length) {
            this._outgoing.forEach((old) => {
                try {
                    old.pause();
                    old.removeAttribute('src');
                    old.load();
                    if (old.parentNode) old.parentNode.removeChild(old);
                } catch (e) { /* ignore */ }
            });
            this._outgoing = [];
        }
        this._outgoing.push(el);
        this._rampVolume(el, el.volume, 0, fadeSec, () => {
            try {
                el.pause();
                el.removeAttribute('src');
                el.load();
                if (el.parentNode) el.parentNode.removeChild(el);
            } catch (e) { /* ignore */ }
            this._outgoing = this._outgoing.filter((x) => x !== el);
        });
    }

    /** True if current or still-fading outgoing audio is audible. */
    isAudible() {
        if (this.el && !this.el.paused && this.el.src) return true;
        const out = this._outgoing || [];
        for (let i = 0; i < out.length; i++) {
            const el = out[i];
            if (el && !el.paused && el.src) return true;
        }
        return false;
    }

    play(key, dataUrl) {
        if (!dataUrl) return false;
        const fade = this.crossfadeSeconds;
        // Same audio payload already looping — keep position even if the logical key changed.
        if (this.el && !this.el.paused && this._currentDataUrl === dataUrl) {
            this.currentKey = key;
            return true;
        }
        if (this.currentKey === key && this.el && !this.el.paused) return true;

        const wasPlaying = !!(this.el && !this.el.paused && this.el.src);
        if (wasPlaying && fade > 0) {
            const old = this.el;
            this.el = null;
            this._retireEl(old, fade);
        } else if (this.el) {
            try {
                this.el.pause();
                this.el.removeAttribute('src');
                this.el.load();
            } catch (e) { /* ignore */ }
        }

        const el = this.ensureEl();
        this.currentKey = key;
        this._currentDataUrl = dataUrl;
        el.src = dataUrl;
        el.playbackRate = Math.max(0.5, Math.min(4, Number(this.playbackRate) || 1));
        if (wasPlaying && fade > 0) {
            el.volume = 0;
            el.play().then(() => this._rampVolume(el, 0, this.volume, fade)).catch(() => {});
        } else {
            el.volume = Math.max(0, Math.min(1, this.volume));
            el.play().catch(() => { /* needs a user gesture first — fine, next interaction retries */ });
        }
        return true;
    }

    setPlaybackRate(rate) {
        this.playbackRate = Math.max(0.5, Math.min(4, Number(rate) || 1));
        if (this.el) this.el.playbackRate = this.playbackRate;
    }

    stop(opts) {
        const fade = opts && opts.fade != null ? Number(opts.fade) : 0;
        if (this._fadeTimer) {
            clearTimeout(this._fadeTimer);
            this._fadeTimer = null;
        }
        if (fade > 0 && this.el && !this.el.paused) {
            const old = this.el;
            this.el = null;
            this.currentKey = null;
            this._currentDataUrl = null;
            this._retireEl(old, fade);
            return;
        }
        if (!this.el) return;
        this.el.pause();
        this.el.removeAttribute('src');
        this.el.load();
        this.currentKey = null;
        this._currentDataUrl = null;
    }

    fadeOut(seconds) {
        this.stop({ fade: seconds != null ? seconds : this.crossfadeSeconds });
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
