"use strict";

// Procedural startup sound: a few synthesized notes (no samples), editable in
// Settings → Startup Sound. Params persist in localStorage; the boot intro plays them.
const startupSound = {
    storageKey: 'vf_startup_sound_v1',
    waves: ['square', 'triangle', 'sawtooth', 'sine'],
    presets: {
        CLASSIC: { wave: 'square', volume: 0.06, glide: 1, vibrato: 0, cutoff: 12000,
            notes: [{ f: 1046.5, at: 0, len: 0.09 }, { f: 2093, at: 0.09, len: 0.5 }] },
        ARCADE: { wave: 'square', volume: 0.06, glide: 1, vibrato: 0, cutoff: 9000,
            notes: [{ f: 523.25, at: 0, len: 0.08 }, { f: 659.25, at: 0.08, len: 0.08 },
                { f: 783.99, at: 0.16, len: 0.08 }, { f: 1046.5, at: 0.24, len: 0.45 }] },
        POWERUP: { wave: 'sawtooth', volume: 0.05, glide: 2, vibrato: 0, cutoff: 6000,
            notes: [{ f: 220, at: 0, len: 0.25 }, { f: 440, at: 0.2, len: 0.5 }] },
        DEEP: { wave: 'triangle', volume: 0.12, glide: 0.5, vibrato: 6, cutoff: 1800,
            notes: [{ f: 130.8, at: 0, len: 0.4 }, { f: 196, at: 0.3, len: 0.7 }] }
    },

    load() {
        try {
            const raw = JSON.parse(localStorage.getItem(this.storageKey) || 'null');
            if (raw && Array.isArray(raw.notes) && raw.notes.length) return this.sanitize(raw);
        } catch (e) { /* storage unavailable */ }
        return this.clone(this.presets.CLASSIC);
    },

    save(p) {
        try { localStorage.setItem(this.storageKey, JSON.stringify(this.sanitize(p))); } catch (e) { /* ignore */ }
    },

    clone(p) { return JSON.parse(JSON.stringify(p)); },

    sanitize(p) {
        const c = (v, lo, hi, d) => Number.isFinite(+v) ? Math.min(hi, Math.max(lo, +v)) : d;
        return {
            wave: this.waves.includes(p.wave) ? p.wave : 'square',
            volume: c(p.volume, 0, 0.3, 0.06),
            glide: c(p.glide, 0.25, 4, 1),
            vibrato: c(p.vibrato, 0, 20, 0),
            cutoff: c(p.cutoff, 200, 16000, 12000),
            notes: p.notes.slice(0, 6).map((n) => ({
                f: c(n.f, 40, 6000, 880), at: c(n.at, 0, 2, 0), len: c(n.len, 0.02, 2, 0.2)
            }))
        };
    },

    /** Random jingle on a pentatonic scale — rising, ending on a held note. */
    randomize() {
        const r = (a, b) => a + Math.random() * (b - a);
        const pick = (a) => a[Math.floor(Math.random() * a.length)];
        const scale = [0, 2, 4, 7, 9];
        const root = pick([130.8, 196, 261.6, 329.6, 440, 523.25]);
        const count = 2 + Math.floor(Math.random() * 4);
        const step = r(0.06, 0.14);
        let deg = Math.floor(Math.random() * 3);
        const notes = [];
        for (let i = 0; i < count; i++) {
            const semis = scale[deg % 5] + 12 * Math.floor(deg / 5);
            notes.push({ f: Math.round(root * Math.pow(2, semis / 12) * 10) / 10, at: +(i * step).toFixed(3),
                len: i === count - 1 ? +r(0.3, 0.8).toFixed(2) : +(step * 1.1).toFixed(3) });
            deg += pick([1, 1, 2, 3]);
        }
        return this.sanitize({
            wave: pick(this.waves), volume: r(0.05, 0.1), glide: pick([1, 1, 1, 0.5, 2]),
            vibrato: pick([0, 0, 4, 8]), cutoff: r(2000, 12000), notes
        });
    },

    /** Plays params on an AudioContext; returns the total length in seconds. */
    render(ctx, p) {
        const t0 = ctx.currentTime + 0.01;
        let end = 0;
        p.notes.forEach((n) => {
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            const lp = ctx.createBiquadFilter();
            lp.type = 'lowpass';
            lp.frequency.value = p.cutoff;
            o.type = p.wave;
            o.frequency.setValueAtTime(n.f, t0 + n.at);
            if (p.glide !== 1) o.frequency.exponentialRampToValueAtTime(Math.max(20, n.f * p.glide), t0 + n.at + n.len);
            if (p.vibrato > 0) {
                const l = ctx.createOscillator();
                const lg = ctx.createGain();
                l.frequency.value = p.vibrato;
                lg.gain.value = n.f * 0.02;
                l.connect(lg).connect(o.frequency);
                l.start(t0 + n.at);
                l.stop(t0 + n.at + n.len + 0.05);
            }
            g.gain.setValueAtTime(p.volume, t0 + n.at);
            g.gain.exponentialRampToValueAtTime(0.0001, t0 + n.at + n.len);
            o.connect(lp).connect(g).connect(ctx.destination);
            o.start(t0 + n.at);
            o.stop(t0 + n.at + n.len + 0.05);
            end = Math.max(end, n.at + n.len + 0.1);
        });
        return end;
    },

    /** Plays the saved sound (or the given params). `force` skips the user-gesture check (preview). */
    play(params, force) {
        try {
            if (!force && navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
            const p = this.sanitize(params || this.load());
            if (typeof soundManager !== 'undefined' && soundManager.ensureContext) {
                const ctx = soundManager.ensureContext();
                if (ctx) { if (ctx.state === 'suspended') ctx.resume(); this.render(ctx, p); return; }
            }
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return;
            const ac = new AC();
            if (ac.state === 'suspended') ac.resume();
            const len = this.render(ac, p);
            setTimeout(() => ac.close(), len * 1000 + 300);
        } catch (e) { /* audio blocked */ }
    }
};

class StartupSoundEditorUI {
    constructor() {
        this.params = startupSound.load();
        this.ensureOverlay();
    }

    ensureOverlay() {
        if (document.getElementById('startupSoundOverlay')) return;
        const overlay = document.createElement('div');
        overlay.id = 'startupSoundOverlay';
        overlay.className = 'difficulty-editor-overlay hidden';
        overlay.innerHTML = `
            <div class="difficulty-editor-panel">
                <header class="difficulty-editor-header">
                    <h2>STARTUP SOUND</h2>
                    <button type="button" class="de-close" id="ssClose">×</button>
                </header>
                <div class="difficulty-editor-body">
                    <aside class="difficulty-editor-nav">
                        <div class="de-section-title">PRESET</div>
                        <div id="ssPresets"></div>
                        <div class="de-section-title">PROCEDURAL</div>
                        <button type="button" class="de-profile-btn" id="ssRandom">RANDOMIZE</button>
                    </aside>
                    <main class="difficulty-editor-controls" id="ssControls"></main>
                </div>
                <footer class="difficulty-editor-footer">
                    <button type="button" class="pe-btn" id="ssBack">BACK</button>
                    <button type="button" class="pe-btn" id="ssPlay">PLAY</button>
                    <button type="button" class="pe-btn pe-primary" id="ssSave">SAVE</button>
                </footer>
            </div>`;
        document.body.appendChild(overlay);
        const q = (s) => overlay.querySelector(s);
        q('#ssClose').addEventListener('click', () => this.hide());
        q('#ssBack').addEventListener('click', () => this.hide());
        q('#ssPlay').addEventListener('click', () => startupSound.play(this.params, true));
        q('#ssSave').addEventListener('click', () => { startupSound.save(this.params); this.hide(); });
        q('#ssRandom').addEventListener('click', () => {
            this.params = startupSound.randomize();
            this.render();
            startupSound.play(this.params, true);
        });
        const box = q('#ssPresets');
        Object.keys(startupSound.presets).forEach((name) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'de-profile-btn';
            b.textContent = name;
            b.addEventListener('click', () => {
                this.params = startupSound.clone(startupSound.presets[name]);
                this.render();
                startupSound.play(this.params, true);
            });
            box.appendChild(b);
        });
        overlay.addEventListener('keydown', (e) => {
            e.stopPropagation();
            if (e.key === 'Escape') this.hide();
        });
    }

    show() {
        this.ensureOverlay();
        this.params = startupSound.load();
        this._returnToSettings = !!(typeof startScreenManager !== 'undefined' && startScreenManager
            && (startScreenManager.showSettings || startScreenManager.overlayMode || startScreenManager.embeddedMode));
        if (typeof startScreenManager !== 'undefined' && startScreenManager) {
            if (startScreenManager.overlayMode) startScreenManager.hideOverlay();
            if (startScreenManager.embeddedMode) startScreenManager.hideEmbedded();
        }
        if (typeof settingsManager !== 'undefined' && settingsManager.hideSettings) settingsManager.hideSettings();
        const overlay = document.getElementById('startupSoundOverlay');
        if (overlay.parentNode !== document.body) document.body.appendChild(overlay);
        overlay.classList.remove('hidden');
        this.render();
    }

    hide() {
        const overlay = document.getElementById('startupSoundOverlay');
        if (overlay) overlay.classList.add('hidden');
        if (this._returnToSettings && typeof startScreenManager !== 'undefined' && startScreenManager) {
            this._returnToSettings = false;
            startScreenManager.showSettings = true;
            startScreenManager.showCredits = false;
            if (startScreenManager.hasActiveProfile && startScreenManager.hasActiveProfile()
                && typeof homeStationUI !== 'undefined') {
                if (!homeStationUI.isVisible) homeStationUI.show({ skipPersist: true });
                startScreenManager.show({ asOverlay: true, showSettings: true });
            } else {
                startScreenManager.show({ forceMenu: true });
            }
        }
    }

    slider(parent, label, min, max, step, value, onInput, digits) {
        const row = document.createElement('div');
        row.className = 'de-slider-row';
        const title = document.createElement('label');
        title.textContent = label;
        const out = document.createElement('output');
        const input = document.createElement('input');
        input.type = 'range';
        input.min = min; input.max = max; input.step = step; input.value = value;
        const fmt = (v) => Number(v).toFixed(digits === undefined ? 2 : digits);
        out.textContent = fmt(value);
        input.addEventListener('input', () => { out.textContent = fmt(input.value); onInput(+input.value); });
        row.append(title, input, out);
        parent.appendChild(row);
    }

    render() {
        const host = document.getElementById('ssControls');
        host.innerHTML = '';
        const p = this.params;
        const title = (t) => {
            const d = document.createElement('div');
            d.className = 'de-section-title';
            d.textContent = t;
            host.appendChild(d);
        };
        title('VOICE');
        const wrap = document.createElement('div');
        wrap.className = 'de-slider-row';
        const wl = document.createElement('label');
        wl.textContent = 'WAVE';
        const sel = document.createElement('select');
        startupSound.waves.forEach((w) => {
            const o = document.createElement('option');
            o.value = w; o.textContent = w.toUpperCase(); o.selected = w === p.wave;
            sel.appendChild(o);
        });
        sel.addEventListener('change', () => { p.wave = sel.value; });
        wrap.append(wl, sel);
        host.appendChild(wrap);
        this.slider(host, 'VOLUME', 0, 0.3, 0.005, p.volume, (v) => { p.volume = v; }, 3);
        this.slider(host, 'GLIDE ×', 0.25, 4, 0.05, p.glide, (v) => { p.glide = v; });
        this.slider(host, 'VIBRATO Hz', 0, 20, 0.5, p.vibrato, (v) => { p.vibrato = v; }, 1);
        this.slider(host, 'LOWPASS Hz', 200, 16000, 100, p.cutoff, (v) => { p.cutoff = v; }, 0);
        title('NOTES');
        this.slider(host, 'COUNT', 1, 6, 1, p.notes.length, (v) => {
            while (p.notes.length < v) {
                const last = p.notes[p.notes.length - 1] || { f: 880, at: 0, len: 0.1 };
                p.notes.push({ f: last.f, at: +(last.at + 0.1).toFixed(2), len: last.len });
            }
            p.notes.length = v;
            this.render();
        }, 0);
        p.notes.forEach((n, i) => {
            title('NOTE ' + (i + 1));
            this.slider(host, 'PITCH Hz', 40, 4000, 1, n.f, (v) => { n.f = v; }, 0);
            this.slider(host, 'START s', 0, 2, 0.01, n.at, (v) => { n.at = v; });
            this.slider(host, 'LENGTH s', 0.02, 2, 0.01, n.len, (v) => { n.len = v; });
        });
    }
}

const startupSoundEditorUI = new StartupSoundEditorUI();
