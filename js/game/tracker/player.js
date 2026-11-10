"use strict";

/**
 * Schedules a normalized vftrack on a Web Audio context (lookahead sequencer).
 */
class VFTrackerPlayer {
    constructor() {
        this.ctx = null;
        this.track = null;
        this.playing = false;
        this.masterGain = null;
        this.volume = (typeof VFVolume !== 'undefined') ? VFVolume.busDefault() : 0.065;
        this._timer = null;
        this._raf = null;
        this._nextRowTime = 0;
        /** Absolute row counter since play() — tempo-stable scheduling. */
        this._rowAbs = 0;
        this._anchorTime = 0;
        this._anchorRow = 0;
        this._anchorRowDur = 0;
        this._orderIndex = 0;
        this._rowIndex = 0;
        this._channels = [];
        this._noiseBuffer = null;
        // Wilson-style lookahead: short wake + enough scheduleAhead to survive
        // combat-frame stalls. Tempo changes re-anchor via notifyTempoChanged.
        this.lookahead = 0.025;
        this.scheduleAhead = 0.5;
        /** Playback speed vs authored track BPM (>1 = faster). */
        this.tempoScale = 1;
        /** Heard tempo (MUSIC BPM slider) — beats/minute. */
        this.playbackBpm = null;
        /**
         * Per-channel mix (bass / lead / arp / drums).
         * PLANET base keeps the Hauptmelodie (lead) in front — arp supports, never buries.
         */
        // Mix targets stay near loudness-sum ~4 so STYLE swaps don't pump the bus.
        this.channelMixBase = [1.0, 1.28, 0.68, 1.05];
        /** Jungle mix: Amen kit dominant, chopped bass, thin lead/arp. */
        this.channelMixJungle = [1.2, 0.55, 0.45, 1.75];
        /** DnB mix: heavy Reese sub, two-step kit, sparse lead. */
        this.channelMixDnb = [1.55, 0.48, 0.4, 1.45];
        /** Jungle DnB hybrid: big sub + Amen kit pressure. */
        this.channelMixJungleDnb = [1.35, 0.5, 0.42, 1.65];
        /** Dark minimal techno: heavy sub+kick, clear delayed lead, present ticks. */
        this.channelMixElektro = [1.32, 0.78, 0.85, 1.28];
        /** Liquid: soft drums, floating lead/arp. */
        this.channelMixLiquid = [1.1, 0.95, 1.05, 1.0];
        /** NIGHTRUN (darksynth): lead + bass forward, driving kit. */
        this.channelMixNightrun = [1.25, 1.05, 0.8, 1.2];
        this.channelMix = this.channelMixBase.slice();
        /** User-facing fine-tune on top of channelMix (0 = mute, 1 = authored level). */
        this.channelUserMix = [1, 1, 1, 1];
        /**
         * Style intensity 0..1 (how far into the selected STYLE).
         * Deadzone near 0 has no effect.
         */
        this.jungleAmount = 0;
        /** Melody / style index — see VFTrackerThemes.list. */
        this.themeIndex = 0;
        /** Per-channel voice ids: bass / lead / arp / drums (`default` = authored). */
        this.channelVoices = ['default', 'default', 'default', 'default'];
        this._onEnded = null;
        this._endedFired = false;
        this._channelBus = [];
        this._fadeOutTimer = null;
        /** Fire-and-forget hits (drums/breaks) — cancelled on tempo re-anchor. */
        this._liveOneshots = [];
        this._lastCell = [];
        /** Default crossfade length when swapping tracks (seconds). */
        this.fadeSeconds = 1.4;
        /**
         * Amen-chop 16-step break (Jungle / right).
         * k=kick(inst5), s=snare/noise(inst4), h=hat(inst4 soft), r=half-row roll.
         */
        this._jungleBreak = [
            { k: 1 }, { h: 0.45 }, { s: 0.55, h: 0.5 }, { k: 0.75, h: 0.35 },
            { s: 1 }, { h: 0.4 }, { s: 0.7, r: 0.85 }, { k: 0.8, h: 0.3 },
            { h: 0.5 }, { k: 0.85, h: 0.35 }, { s: 1, r: 0.7 }, { h: 0.55, s: 0.3 },
            { k: 1 }, { s: 0.9, r: 0.95 }, { k: 0.55, h: 0.6 }, { s: 1 }
        ];
        /**
         * Two-step DnB: kick on 1+3, snare on 2+4, rolling hats, sparse ghosts.
         */
        this._dnbBreak = [
            { k: 1 }, { h: 0.55 }, { h: 0.4 }, { h: 0.5 },
            { s: 1 }, { h: 0.45 }, { h: 0.35, s: 0.22 }, { h: 0.5 },
            { k: 0.95 }, { h: 0.5 }, { h: 0.38 }, { h: 0.48 },
            { s: 1 }, { h: 0.45 }, { h: 0.35, s: 0.2 }, { h: 0.42 }
        ];
        /** NIGHTRUN 4/4 drive kit. */
        this._driveBreak = [
            { k: 1 }, { h: 0.45 }, { s: 0.9, h: 0.3 }, { h: 0.4 },
            { k: 1 }, { h: 0.45 }, { s: 0.95, h: 0.3 }, { h: 0.4 },
            { k: 1 }, { h: 0.45 }, { s: 0.9, h: 0.3 }, { h: 0.4 },
            { k: 1 }, { h: 0.5 }, { s: 1, h: 0.35 }, { h: 0.45 }
        ];
    }

    setThemeIndex(index) {
        const max = (typeof VFTrackerThemes !== 'undefined' && VFTrackerThemes.count)
            ? VFTrackerThemes.count() - 1
            : 8;
        this.themeIndex = Math.max(0, Math.min(max, Math.round(Number(index) || 0)));
        // Re-apply mix target for the newly selected style at current intensity.
        this.setJungleAmount(this.jungleAmount);
        return this.themeIndex;
    }

    _mixTargetForStyle() {
        const base = this.channelMixBase || [1.0, 1.28, 0.68, 1.05];
        const meta = (typeof VFTrackerThemes !== 'undefined' && VFTrackerThemes.metaOf)
            ? VFTrackerThemes.metaOf(this.themeIndex)
            : { mix: 'base' };
        const key = meta.mix || 'base';
        if (key === 'jungle') return this.channelMixJungle || [1.2, 0.55, 0.45, 1.75];
        if (key === 'dnb') return this.channelMixDnb || [1.55, 0.48, 0.4, 1.45];
        if (key === 'jungle_dnb') return this.channelMixJungleDnb || [1.35, 0.5, 0.42, 1.65];
        if (key === 'elektro') return this.channelMixElektro || [1.32, 0.78, 0.85, 1.28];
        if (key === 'liquid') return this.channelMixLiquid || [1.1, 0.95, 1.05, 1.0];
        if (key === 'nightrun') return this.channelMixNightrun || [1.25, 1.05, 0.8, 1.2];
        return base;
    }

    /** Style intensity morph: 0 off · 1 full selected STYLE. */
    setJungleAmount(amount) {
        let t = Math.max(0, Math.min(1, Number(amount) || 0));
        if (t < 0.03) t = 0;
        this.jungleAmount = t;
        // Mix follows AMOUNT only (no forced floor) — avoids sudden bus pumps.
        // PLANET (theme 0): keep authored Hauptmelodie balance — don't morph.
        const themeIdx = Number(this.themeIndex) || 0;
        const mag = themeIdx > 0 ? t : 0;
        const base = this.channelMixBase || [1.0, 1.28, 0.68, 1.05];
        const target = mag > 0 ? this._mixTargetForStyle() : base;
        this.channelMix = base.map((b, i) => {
            let v = b + ((target[i] != null ? target[i] : b) - b) * mag;
            // Never let STYLE duck the hook below a readable floor.
            if (i === 1) v = Math.max(b * 0.72, v);
            return v;
        });
        this.applyChannelBusGains();
        return t;
    }

    /** Absolute style pressure 0..1. */
    _styleMag() {
        return Math.max(0, Math.min(1, Number(this.jungleAmount) || 0));
    }

    /** 'jungle' | 'dnb' | 'elektro' | 'hybrid' | 'drive' | 'off' */
    _styleSide() {
        const meta = (typeof VFTrackerThemes !== 'undefined' && VFTrackerThemes.metaOf)
            ? VFTrackerThemes.metaOf(this.themeIndex)
            : null;
        const side = meta && meta.breakSide ? meta.breakSide : 'off';
        // Style colour only when AMOUNT is up — picking a STYLE alone must not
        // flood every section with the same break kit.
        if (this._styleMag() < 0.03) return 'off';
        if (Number(this.themeIndex) > 0 && side && side !== 'off') return side;
        return side === 'off' ? 'off' : side;
    }

    _busGain(ch) {
        const base = (this.channelMix && this.channelMix[ch] != null) ? Number(this.channelMix[ch]) : 1;
        const user = (this.channelUserMix && this.channelUserMix[ch] != null) ? Number(this.channelUserMix[ch]) : 1;
        const b = Number.isFinite(base) && base > 0 ? base : 1;
        const u = Number.isFinite(user) && user >= 0 ? user : 1;
        // Allow voice faders up to 300% (user × style mix); soft ceiling still tames peaks.
        return Math.max(0.0001, Math.min(5.5, b * u));
    }

    /**
     * Channel buses → masterGain (user volume) → fadeGain (crossfade) →
     * soft ceiling → destination.
     *
     * Volume and fade stay on separate nodes so dragging MUSIC / channel
     * sliders during a crossfade does not yank the envelope (or let one
     * overlapping track punch through while the other stays ducked).
     * No bus compressor — that used to duck sibling voices when one
     * channel was turned up, then squash the whole mix flat ("stumpf").
     */
    _ensureMasterChain() {
        if (!this.ctx) return;
        if (!this.masterGain) {
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = Math.max(0.0001, this.volume);
        }
        if (!this._fadeGain) {
            this._fadeGain = this.ctx.createGain();
            this._fadeGain.gain.value = 1;
        }
        if (this._masterChained) return;
        try {
            this.masterGain.disconnect();
        } catch (e) { /* first wire */ }
        try {
            this._fadeGain.disconnect();
        } catch (e2) { /* first wire */ }
        // Soft peak ceiling only — transparent until actual overs.
        if (!this._limiter) {
            const lim = this.ctx.createDynamicsCompressor();
            lim.threshold.value = -2.5;
            lim.knee.value = 6;
            lim.ratio.value = 8;
            lim.attack.value = 0.002;
            lim.release.value = 0.12;
            this._limiter = lim;
        }
        try {
            this._limiter.disconnect();
        } catch (e3) { /* first wire */ }
        this.masterGain.connect(this._fadeGain);
        this._fadeGain.connect(this._limiter);
        this._limiter.connect(this.ctx.destination);
        this._masterChained = true;
    }

    _disconnectChannelBuses() {
        const buses = this._channelBus || [];
        for (let i = 0; i < buses.length; i++) {
            const bus = buses[i];
            if (!bus) continue;
            try { bus.disconnect(); } catch (e) { /* ignore */ }
        }
        this._channelBus = [];
    }

    _ensureChannelBus(ch) {
        if (!this.ctx || !this.masterGain) return null;
        this._ensureMasterChain();
        if (!this._channelBus[ch]) {
            const bus = this.ctx.createGain();
            bus.gain.value = this._busGain(ch);
            bus.connect(this.masterGain);
            this._channelBus[ch] = bus;
        }
        return this._channelBus[ch];
    }

    /** Live per-channel volume fine-tune. ch: 0=bass,1=lead,2=arp,3=drums. v: 0-3 (300%). */
    setChannelVolume(ch, v) {
        const idx = Number(ch);
        if (!Number.isFinite(idx) || idx < 0) return;
        const vol = Math.max(0, Math.min(3, Number(v)));
        if (!this.channelUserMix) this.channelUserMix = [1, 1, 1, 1];
        this.channelUserMix[idx] = Number.isFinite(vol) ? vol : 1;
        // Create the bus immediately so fader moves bite before the next note.
        const bus = this._ensureChannelBus(idx);
        if (bus && this.ctx) {
            const now = this.ctx.currentTime;
            try {
                bus.gain.cancelScheduledValues(now);
                const cur = Math.max(0.0001, Number(bus.gain.value) || 0.0001);
                bus.gain.setValueAtTime(cur, now);
                bus.gain.linearRampToValueAtTime(this._busGain(idx), now + 0.04);
            } catch (e) { /* ignore */ }
        }
    }

    /** Ensure all channel buses exist at the current mix × user fader levels. */
    applyChannelBusGains() {
        if (!this.ctx || !this.masterGain) return;
        const n = Math.max(4, (this.track && this.track.channels) || 4);
        const now = this.ctx.currentTime;
        for (let i = 0; i < n; i++) {
            const bus = this._ensureChannelBus(i);
            if (!bus) continue;
            try {
                bus.gain.cancelScheduledValues(now);
                bus.gain.setValueAtTime(this._busGain(i), now);
            } catch (e) { /* ignore */ }
        }
    }

    /** Live per-channel instrument voice. ch: 0=bass,1=lead,2=arp,3=drums. */
    setChannelVoice(ch, voiceId) {
        const idx = Number(ch);
        if (!Number.isFinite(idx) || idx < 0 || idx > 3) return 'default';
        if (!this.channelVoices) this.channelVoices = ['default', 'default', 'default', 'default'];
        const id = String(voiceId || 'default');
        const opts = (typeof VFTrackerVoices !== 'undefined' && VFTrackerVoices.optionsFor)
            ? VFTrackerVoices.optionsFor(idx)
            : [{ id: 'default' }];
        let ok = false;
        for (let i = 0; i < opts.length; i++) {
            if (opts[i].id === id) { ok = true; break; }
        }
        const next = ok ? id : 'default';
        const prev = this.channelVoices[idx];
        this.channelVoices[idx] = next;
        // Swap timbre on the sounding note immediately (don't wait for next row).
        if (next !== prev && this.playing) this._revoiceChannel(idx);
        return next;
    }

    /** Retrigger current note / kit preview so voice fader changes are audible now. */
    _revoiceChannel(ch) {
        if (!this.ctx || !this.playing) return;
        const now = this.ctx.currentTime + 0.015;
        if (ch === 3) {
            // Drums are oneshots — fire a short kick+snare so the new kit speaks.
            this._oneshot(3, { note: 'A-2', inst: 5, vol: 52 }, now, 0.14);
            this._oneshot(3, { note: 'A-4', inst: 4, vol: 42 }, now + 0.05, 0.09);
            return;
        }
        const last = this._lastCell && this._lastCell[ch];
        if (!last || !last.note || last.note === 'OFF') return;
        this._stopChannel(ch, now);
        this._trigger(ch, last, now);
    }

    _resolveInstrument(ch, cellInst) {
        const track = this.track;
        const base = (track && track.instrumentById && track.instrumentById[cellInst])
            || (track && track.instruments && track.instruments[0])
            || null;
        const voiceId = (this.channelVoices && this.channelVoices[ch]) || 'default';
        // Drum noise/snare/metal voices must not rewrite kick (inst 5) into hiss.
        if (ch === 3 && Number(cellInst) === 5) {
            const keepKick = voiceId === 'default' || voiceId === 'kit'
                || voiceId === 'kick' || voiceId === 'tight';
            if (!keepKick) return base;
        }
        if (typeof VFTrackerVoices !== 'undefined' && VFTrackerVoices.resolve) {
            return VFTrackerVoices.resolve(ch, voiceId, base) || base;
        }
        return base;
    }

    ensureContext(externalCtx) {
        if (externalCtx) {
            this.ctx = externalCtx;
        } else if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
        if (!this.masterGain) {
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = Math.max(0.0001, this.volume);
        }
        this._ensureMasterChain();
        if (!this._noiseBuffer) this._noiseBuffer = this._makeNoiseBuffer();
        return this.ctx;
    }

    _makeNoiseBuffer() {
        const len = this.ctx.sampleRate * 1;
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        return buf;
    }

    setVolume(v) {
        this.volume = Math.max(0, Math.min(1, Number(v) || 0));
        if (!this.masterGain || !this.ctx) return;
        const now = this.ctx.currentTime;
        const target = Math.max(0.0001, this.volume);
        // Volume lives on masterGain — fade envelope is on _fadeGain, so
        // slider moves stay linear even mid-crossfade.
        try {
            const cur = Math.max(0.0001, this.masterGain.gain.value);
            this.masterGain.gain.cancelScheduledValues(now);
            this.masterGain.gain.setValueAtTime(cur, now);
            this.masterGain.gain.linearRampToValueAtTime(target, now + 0.05);
        } catch (e) { /* ignore */ }
    }

    effectiveBpm() {
        // MUSIC BPM slider is the heard tempo (beats/minute). Prefer it so the
        // UI value matches row timing: seconds/beat = 60 / bpm.
        const abs = Number(this.playbackBpm);
        if (Number.isFinite(abs) && abs > 0) {
            return Math.max(60, Math.min(960, abs));
        }
        const scale = Number(this.tempoScale);
        const mul = Number.isFinite(scale) && scale > 0 ? scale : 1;
        if (this.track && Number.isFinite(Number(this.track.bpm))) {
            return Math.max(60, Math.min(960, Number(this.track.bpm) * mul));
        }
        return 0;
    }

    rowDuration() {
        const bpm = this.effectiveBpm();
        const rpb = this.track.rowsPerBeat;
        return (60 / bpm) / rpb;
    }

    play(track, opts) {
        if (this._fadeOutTimer) {
            clearTimeout(this._fadeOutTimer);
            this._fadeOutTimer = null;
        }
        const normalized = VFTrackerParse.normalize(track);
        // Soft stop channels/timer but keep the master bus; hard-mute made
        // immediate restarts come back silent when setVolume raced the ramp.
        this.stop(false);
        const ctx = this.ensureContext(opts && opts.context);
        if (!this.masterGain) {
            this.masterGain = ctx.createGain();
        }
        this._ensureMasterChain();
        this.track = normalized;
        this.playing = true;
        this._endedFired = false;
        this._onEnded = (opts && typeof opts.onEnded === 'function') ? opts.onEnded : null;
        this._orderIndex = 0;
        this._rowIndex = 0;
        this._rowAbs = 0;
        this._channels = [];
        // Drop orphaned channel buses — leaving them connected stacked silent
        // GainNodes on masterGain across every in-place play().
        this._disconnectChannelBuses();
        this._channelBus = [];
        this._liveOneshots = [];
        this._lastCell = [];
        for (let i = 0; i < normalized.channels; i++) {
            this._channels.push({ gain: null, source: null, release: 0.1 });
        }
        const vol = opts && opts.volume != null ? opts.volume : this.volume;
        const fallback = (typeof VFVolume !== 'undefined') ? VFVolume.busDefault() : 0.065;
        this.volume = Math.max(0, Math.min(1, Number.isFinite(Number(vol)) ? Number(vol) : fallback));
        if (this.volume <= 0) this.volume = 0.0001;
        const fadeIn = opts && opts.fadeIn != null
            ? Math.max(0, Number(opts.fadeIn) || 0)
            : 0;
        this._fadeInUntil = fadeIn > 0 ? (ctx.currentTime + fadeIn) : 0;
        try {
            // User volume on masterGain; crossfade envelope on _fadeGain.
            this.masterGain.gain.cancelScheduledValues(ctx.currentTime);
            this.masterGain.gain.setValueAtTime(this.volume, ctx.currentTime);
            if (this._fadeGain) {
                this._fadeGain.gain.cancelScheduledValues(ctx.currentTime);
                if (fadeIn > 0) {
                    // Equal-power (sine) fade-in: paired with the equal-power
                    // fade-out so outgoing + incoming sum to constant loudness.
                    this._fadeGain.gain.setValueCurveAtTime(
                        this._equalPowerCurve(1, true), ctx.currentTime, fadeIn
                    );
                } else {
                    this._fadeGain.gain.setValueAtTime(1, ctx.currentTime);
                }
            }
        } catch (e) { /* ignore */ }
        const t0 = ctx.currentTime + 0.02;
        this._anchorTime = t0;
        this._anchorRow = 0;
        this._anchorRowDur = this.rowDuration();
        this._nextRowTime = t0;
        // Warm buses at current fader levels so live volume works before first hit.
        this.applyChannelBusGains();
        this._startScheduler();
        return normalized;
    }

    /**
     * Re-anchor musical time after a live BPM change. Drop the stale schedule
     * pocket (notes already queued at the old row duration) so cranking speed
     * does not tangle old+new timing — then keep the hook sounding.
     */
    notifyTempoChanged() {
        if (!this.playing || !this.ctx || !this.track) return;
        const newDur = this.rowDuration();
        const oldDur = Math.max(1e-4, this._anchorRowDur || newDur);
        // Unchanged tempo (theme/style reassert, play() follow-up) — keep pocket.
        if (Math.abs(newDur - oldDur) / oldDur < 0.002) {
            this._anchorRowDur = newDur;
            return;
        }
        const now = this.ctx.currentTime;
        const audible = this._anchorRow + Math.max(0, (now - this._anchorTime) / oldDur);
        const keep = (this._lastCell || []).map((c) => (c ? {
            note: c.note, inst: c.inst, vol: c.vol
        } : null));
        // Kill only not-yet-heard oneshots from the old pocket (drums/breaks).
        this._cancelFutureOneshots(now);
        // Soft cut melodic slots — never snap gain to peak on BPM drag.
        for (let i = 0; i < this._channels.length; i++) {
            this._stopChannel(i, now, { silent: true });
        }
        // Reschedule from the audible head at the new tempo (old future pocket dropped).
        const nextAbs = Math.ceil(audible - 1e-6);
        const pos = this._absRowToPos(nextAbs);
        this._orderIndex = pos.order;
        this._rowIndex = pos.row;
        this._rowAbs = nextAbs;
        this._anchorRow = audible;
        this._anchorTime = now;
        this._anchorRowDur = newDur;
        this._nextRowTime = this._rowWhen(this._rowAbs);
        // Revoice last melodic notes so speeding up does not swallow the hook.
        const tVoice = now + 0.018;
        for (let c = 0; c < 3; c++) {
            const cell = keep[c];
            if (cell && cell.note && cell.note !== 'OFF') {
                this._trigger(c, cell, tVoice);
            }
        }
    }

    /** Drop oneshots that were scheduled ahead at the previous tempo. */
    _cancelFutureOneshots(now) {
        const list = this._liveOneshots || [];
        const keep = [];
        const t = Number(now) || (this.ctx ? this.ctx.currentTime : 0);
        for (let i = 0; i < list.length; i++) {
            const e = list[i];
            if (!e || !e.source) continue;
            if (e.start > t + 0.008) {
                try {
                    if (e.gain && e.gain.gain) {
                        e.gain.gain.cancelScheduledValues(t);
                        e.gain.gain.setValueAtTime(0.0001, t);
                    }
                } catch (err) { /* ignore */ }
                try { e.source.stop(t); } catch (err2) { /* ignore */ }
            } else {
                keep.push(e);
            }
        }
        this._liveOneshots = keep;
    }

    /** Compress ADSR when rows get short so fast BPM still has body, not choke. */
    _tempoEnvScale() {
        const rowDur = this.track ? this.rowDuration() : 0.1;
        // ~0.11s ≈ 132 BPM @ 4 rows/beat. Below that, shrink envelopes.
        return Math.max(0.42, Math.min(1, rowDur / 0.1));
    }

    _rowWhen(absRow) {
        const dur = Math.max(1e-4, this._anchorRowDur || this.rowDuration());
        return this._anchorTime + (Number(absRow) - this._anchorRow) * dur;
    }

    _startScheduler() {
        if (this._timer) {
            clearInterval(this._timer);
            this._timer = null;
        }
        if (this._raf) {
            cancelAnimationFrame(this._raf);
            this._raf = null;
        }
        this._timer = setInterval(() => this._tick(), this.lookahead * 1000);
        const pump = () => {
            if (!this.playing) {
                this._raf = null;
                return;
            }
            this._tick();
            this._raf = requestAnimationFrame(pump);
        };
        this._raf = requestAnimationFrame(pump);
        this._tick();
    }

    /** Equal-power fade curve (cos for fade-out, sin for fade-in), peak..0.0001 or reverse. */
    _equalPowerCurve(peak, fadeIn) {
        const steps = 32;
        const curve = new Float32Array(steps + 1);
        const p = Math.max(0.0001, Number(peak) || 0.0001);
        for (let i = 0; i <= steps; i++) {
            const t = (i / steps) * (Math.PI / 2);
            curve[i] = Math.max(0.0001, p * (fadeIn ? Math.sin(t) : Math.cos(t)));
        }
        return curve;
    }

    /**
     * Ramp master bus to silence while the sequence keeps running, then stop.
     * Used as the outgoing leg of a track crossfade.
     */
    fadeOut(seconds) {
        const dur = Math.max(0.05, Number(seconds) || this.fadeSeconds || 1.4);
        if (!this.ctx || (!this._fadeGain && !this.masterGain)) {
            this.stop(true);
            return dur;
        }
        const now = this.ctx.currentTime;
        try {
            // Fade on the envelope node so setVolume can still retarget loudness.
            const g = (this._fadeGain || this.masterGain).gain;
            const start = Math.max(0.0001, g.value);
            g.cancelScheduledValues(now);
            // Equal-power (cosine) fade-out — see fade-in above.
            g.setValueCurveAtTime(this._equalPowerCurve(start, false), now, dur);
        } catch (e) { /* ignore */ }
        if (this._fadeOutTimer) clearTimeout(this._fadeOutTimer);
        this._fadeOutTimer = setTimeout(() => {
            this._fadeOutTimer = null;
            this.stop(true);
        }, dur * 1000 + 40);
        return dur;
    }

    _stopChannel(ch, when, opts) {
        const slot = this._channels[ch];
        if (!slot || !slot.gain) return;
        const now = this.ctx ? this.ctx.currentTime : 0;
        const t = Math.max(when, now);
        const rowDur = this.track ? this.rowDuration() : 0.1;
        // Keep a usable release floor at high BPM so note→note does not click-swallow.
        const rel = Math.max(0.02, Math.min(0.18, (slot.release || 0.1) * 1.15, rowDur * 0.7));
        const peak = Math.max(0.0001, slot.peak || 0.2);
        const sustain = Math.max(0.0001, peak * 0.55);
        try {
            const g = slot.gain.gain;
            g.cancelScheduledValues(t);
            if (opts && opts.silent) {
                // Tempo re-anchor: fade from the live level — never jump to peak.
                const cur = Math.max(0.0001, Math.min(peak, Number(g.value) || 0.0001));
                g.setValueAtTime(cur, now);
                g.linearRampToValueAtTime(0.0001, now + 0.03);
                if (slot.source) {
                    try { slot.source.stop(now + 0.045); } catch (e) { /* already stopped */ }
                }
            } else {
                // Soft cut for note→note — release from sustain, not a peak jump
                // (peak jumps at high BPM sounded like the note was swallowed).
                g.setValueAtTime(sustain, t);
                g.exponentialRampToValueAtTime(0.0001, t + rel);
                if (slot.source) {
                    try { slot.source.stop(t + rel + 0.03); } catch (e2) { /* already stopped */ }
                }
            }
        } catch (e) { /* ignore */ }
        slot.gain = null;
        slot.source = null;
        slot.peak = 0;
    }

    /**
     * Fire-and-forget hit (jungle breaks) — does NOT steal monophonic channel slots,
     * so authored drums/bass keep sustaining without hard cuts.
     */
    _oneshot(ch, cell, when, gateSec) {
        const track = this.track;
        if (!cell || !cell.note || cell.note === 'OFF' || !this.ctx) return;
        const freq = VFTrackerParse.noteToFreq(cell.note);
        if (!freq || freq === 'OFF') return;
        const inst = this._resolveInstrument(ch, cell.inst);
        if (!inst) return;

        const ctx = this.ctx;
        if (!this._noiseBuffer) this._noiseBuffer = this._makeNoiseBuffer();
        const styleSide = this._styleSide();
        const heavyBreak = styleSide === 'jungle' || styleSide === 'dnb' || styleSide === 'hybrid';
        const envScale = this._tempoEnvScale();
        const isKick = cell.inst === 5 || (typeof freq === 'number' && freq < 120 && inst.wave !== 'noise');
        const isHat = inst.wave === 'noise' && typeof freq === 'number' && freq >= 700;
        const isSnare = inst.wave === 'noise' && !isHat;
        const gain = ctx.createGain();
        let filter = null;
        if (inst.filter && inst.wave !== 'noise') {
            filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(
                isKick && heavyBreak
                    ? (styleSide === 'dnb' ? 520 : 620)
                    : inst.filter,
                when);
            filter.Q.setValueAtTime(isKick && heavyBreak ? 1.1 : 0.7, when);
        } else if (isSnare && heavyBreak) {
            filter = ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(styleSide === 'jungle' ? 1800 : 2200, when);
            filter.Q.setValueAtTime(0.9, when);
        } else if (isHat && heavyBreak) {
            filter = ctx.createBiquadFilter();
            filter.type = 'highpass';
            filter.frequency.setValueAtTime(styleSide === 'dnb' ? 6200 : 5200, when);
            filter.Q.setValueAtTime(0.6, when);
        }
        let source;
        if (inst.wave === 'noise') {
            source = ctx.createBufferSource();
            source.buffer = this._noiseBuffer;
            source.loop = true;
        } else {
            source = ctx.createOscillator();
            source.type = isKick && heavyBreak
                ? (styleSide === 'dnb' ? 'sine' : 'triangle')
                : inst.wave;
            // Classic jungle/DnB kick: fast pitch drop into the thud.
            if (isKick && heavyBreak && typeof freq === 'number') {
                const startF = styleSide === 'dnb' ? freq * 5.2 : freq * 3.6;
                const drop = Math.max(0.018, (styleSide === 'dnb' ? 0.055 : 0.032) * envScale);
                source.frequency.setValueAtTime(Math.max(40, startF), when);
                source.frequency.exponentialRampToValueAtTime(Math.max(20, freq), when + drop);
            } else {
                source.frequency.setValueAtTime(Math.max(20, freq), when);
            }
        }
        const vol64 = cell.vol != null ? Math.max(0, Math.min(64, cell.vol)) / 64 : 1;
        // Jungle/DnB break hits need to read as the kit, not a soft tick under the song.
        const breakBoost = styleSide === 'jungle' || styleSide === 'hybrid' ? 0.98
            : styleSide === 'dnb' ? 0.9
                : 0.72;
        const peakCap = heavyBreak ? 0.5 : 0.38;
        const peak = Math.max(0.0001, Math.min(peakCap, inst.volume * vol64 * breakBoost
            * (isSnare && heavyBreak ? 1.15 : isHat && styleSide === 'dnb' ? 1.08 : 1)));
        const a = Math.max(0.001, inst.attack * envScale);
        const dRaw = isHat && heavyBreak ? Math.min(0.018, inst.decay)
            : isSnare && styleSide === 'jungle' ? Math.max(0.035, inst.decay)
                : isKick && styleSide === 'dnb' ? Math.max(0.08, inst.decay)
                    : inst.decay;
        const d = Math.max(0.001, dRaw * envScale);
        const s = Math.max(0.0001, peak * (isKick && styleSide === 'dnb'
            ? Math.max(0.08, inst.sustain)
            : inst.sustain));
        const r = Math.max(0.02, (isHat && heavyBreak ? 0.03 : (inst.release || 0.08)) * envScale);
        // Floor the gate so fast BPM still has body (was vanishing under ~0.05s).
        const gate = Math.max(a + d + 0.028, Math.max(isKick ? 0.055 : 0.04, Number(gateSec) || 0.09));

        gain.gain.setValueAtTime(0.0001, when);
        gain.gain.exponentialRampToValueAtTime(peak, when + a);
        gain.gain.exponentialRampToValueAtTime(s, when + a + d);
        gain.gain.setValueAtTime(s, when + Math.max(a + d, gate - r));
        gain.gain.exponentialRampToValueAtTime(0.0001, when + gate);

        if (filter) {
            source.connect(filter);
            filter.connect(gain);
        } else {
            source.connect(gain);
        }
        const bus = this._ensureChannelBus(ch) || this.masterGain;
        gain.connect(bus);
        source.start(when);
        try { source.stop(when + gate + 0.04); } catch (e) { /* ignore */ }
        if (!this._liveOneshots) this._liveOneshots = [];
        const entry = { source, gain, start: when };
        this._liveOneshots.push(entry);
        // Prune finished entries so tempo cancels stay cheap.
        if (this._liveOneshots.length > 64) {
            const tNow = ctx.currentTime;
            this._liveOneshots = this._liveOneshots.filter((e) => e && e.start + 0.4 > tNow);
        }
    }

    _trigger(ch, cell, when) {
        const track = this.track;
        if (!cell || !cell.note) return;
        if (cell.note === 'OFF') {
            this._stopChannel(ch, when);
            return;
        }
        const freq = VFTrackerParse.noteToFreq(cell.note);
        if (!freq || freq === 'OFF') return;

        let inst = this._resolveInstrument(ch, cell.inst);
        if (!inst) return;

        // Morph authored voices into jungle chops / Reese / ragga lead without moving pitches.
        // Honour an explicit VOICE pick: never overwrite its wave (fader must stay audible).
        const styleSide = this._styleSide();
        const styleMag = this._styleMag();
        const voiceId = (this.channelVoices && this.channelVoices[ch]) || 'default';
        const userVoice = voiceId !== 'default';
        if (styleMag > 0.03 && inst.wave !== 'noise'
            && (styleSide === 'jungle' || styleSide === 'dnb' || styleSide === 'hybrid')) {
            if (ch === 0) {
                if (styleSide === 'dnb' || styleSide === 'hybrid') {
                    // Half-time Reese sub: long saw, dark filter, high sustain.
                    const morph = {
                        attack: Math.max(0.004, 0.002 + styleMag * 0.006),
                        decay: Math.max(0.12, 0.1 + styleMag * 0.08),
                        sustain: Math.min(0.92, 0.72 + styleMag * 0.18),
                        release: Math.max(0.22, 0.16 + styleMag * 0.18),
                        filter: Math.max(180, Math.min(480, 380 - styleMag * 160)),
                        volume: Math.min(0.98, (Number(inst.volume) || 0.7) * (1.08 + styleMag * 0.18))
                    };
                    if (!userVoice) morph.wave = 'sawtooth';
                    else if (inst.filter != null) {
                        morph.filter = Math.round((Number(inst.filter) + morph.filter) * 0.5);
                    }
                    inst = Object.assign({}, inst, morph);
                } else {
                    // Jungle: short square chops, mid growl.
                    const morph = {
                        attack: 0.001,
                        decay: Math.min(0.035, 0.045 - styleMag * 0.015),
                        sustain: Math.min(0.42, Math.max(0.18, 0.45 - styleMag * 0.28)),
                        release: Math.min(0.05, Math.max(0.02, 0.06 - styleMag * 0.03)),
                        filter: Math.min(1100, 750 + (1 - styleMag) * 250),
                        volume: Math.min(0.94, (Number(inst.volume) || 0.7) * (1.05 + styleMag * 0.1))
                    };
                    if (!userVoice) morph.wave = 'square';
                    inst = Object.assign({}, inst, morph);
                }
            } else if (ch === 1) {
                // Lead: ragga stabs (jungle) or thin pads (dnb) — don't fight the kit.
                if (styleSide === 'jungle') {
                    const morph = {
                        attack: 0.001,
                        decay: Math.min(0.04, 0.05 - styleMag * 0.02),
                        sustain: Math.max(0.12, 0.32 - styleMag * 0.18),
                        release: Math.max(0.03, 0.07 - styleMag * 0.035),
                        filter: Math.min(3200, 2200 + styleMag * 800),
                        volume: Math.min(0.5, (Number(inst.volume) || 0.4) * (0.85 - styleMag * 0.15))
                    };
                    if (!userVoice) morph.wave = 'square';
                    inst = Object.assign({}, inst, morph);
                } else {
                    const morph = {
                        attack: 0.002,
                        decay: 0.06,
                        sustain: Math.max(0.18, 0.36 - styleMag * 0.12),
                        release: Math.max(0.06, 0.1 - styleMag * 0.03),
                        filter: Math.min(2400, 1800 - styleMag * 400),
                        volume: Math.min(0.42, (Number(inst.volume) || 0.4) * (0.75 - styleMag * 0.2))
                    };
                    if (!userVoice) morph.wave = styleMag > 0.5 ? 'sawtooth' : (inst.wave || 'square');
                    inst = Object.assign({}, inst, morph);
                }
            }
        }

        if (!this._lastCell) this._lastCell = [];
        this._lastCell[ch] = { note: cell.note, inst: cell.inst, vol: cell.vol };
        this._stopChannel(ch, when);

        const ctx = this.ctx;
        const gain = ctx.createGain();
        let filter = null;
        if (inst.filter && inst.wave !== 'noise') {
            filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(inst.filter, when);
            filter.Q.setValueAtTime(
                ch === 0 && (styleSide === 'dnb' || styleSide === 'hybrid') ? 1.25 : 0.7,
                when);
        }

        let source;
        if (inst.wave === 'noise') {
            source = ctx.createBufferSource();
            source.buffer = this._noiseBuffer;
            source.loop = true;
        } else {
            source = ctx.createOscillator();
            source.type = inst.wave;
            source.frequency.setValueAtTime(Math.max(20, freq), when);
        }

        const vol64 = cell.vol != null ? Math.max(0, Math.min(64, cell.vol)) / 64 : 1;
        // Cap note peaks so dense patterns (Saturn) don't blow past sparse ones.
        const peak = Math.max(0.0001, Math.min(0.52, inst.volume * vol64));
        const envScale = this._tempoEnvScale();
        const a = Math.max(0.001, Math.min(0.04, inst.attack * envScale));
        const d = Math.max(0.001, Math.min(0.12, inst.decay * envScale));
        const s = Math.max(0.0001, peak * inst.sustain);
        const r = Math.max(0.03, Math.min(0.16, (inst.release || 0.1) * envScale));

        gain.gain.setValueAtTime(0.0001, when);
        gain.gain.exponentialRampToValueAtTime(peak, when + a);
        gain.gain.exponentialRampToValueAtTime(s, when + a + d);

        if (filter) {
            source.connect(filter);
            filter.connect(gain);
        } else {
            source.connect(gain);
        }
        const bus = this._ensureChannelBus(ch) || this.masterGain;
        gain.connect(bus);
        source.start(when);

        // Twin osc: light STYLE colour on the authored note (AMOUNT-scaled, no floor).
        const themeId = (typeof VFTrackerThemes !== 'undefined' && VFTrackerThemes.idOf)
            ? VFTrackerThemes.idOf(this.themeIndex)
            : '';
        const wantTwin = ch === 0 && inst.wave !== 'noise' && styleMag > 0.03
            && (themeId === 'reese' || themeId === 'amen' || themeId === 'neuro'
                || themeId === 'jungle_dnb' || themeId === 'dnb' || themeId === 'nightrun'
                || themeId === 'minimal_elektro'
                || styleSide === 'dnb' || styleSide === 'jungle' || styleSide === 'hybrid'
                || styleSide === 'drive');
        // Lead octave twin for NIGHTRUN cinematic weight.
        const wantLeadTwin = ch === 1 && themeId === 'nightrun' && inst.wave !== 'noise'
            && styleMag > 0.03;
        if ((wantTwin || wantLeadTwin) && typeof freq === 'number') {
            try {
                const osc2 = ctx.createOscillator();
                const g2 = ctx.createGain();
                osc2.type = styleSide === 'drive' || themeId === 'nightrun'
                    ? 'sawtooth'
                    : styleSide === 'dnb' || styleSide === 'hybrid'
                        || themeId === 'reese' || themeId === 'neuro' || themeId === 'dnb'
                        ? 'sawtooth'
                        : styleSide === 'jungle' || themeId === 'jungle_dnb' || themeId === 'amen'
                            ? 'square'
                            : styleSide === 'elektro'
                                ? 'square'
                                : (inst.wave === 'triangle' ? 'sawtooth' : inst.wave);
                const detune = styleSide === 'drive' || themeId === 'nightrun' ? 0.988
                    : styleSide === 'dnb' || styleSide === 'hybrid' || themeId === 'dnb' ? 0.985
                        : styleSide === 'jungle' || themeId === 'jungle_dnb' || themeId === 'amen' ? 0.997
                            : styleSide === 'elektro' ? 0.998 : 0.995;
                const f2 = wantLeadTwin ? freq * 0.5 : freq * detune;
                osc2.frequency.setValueAtTime(Math.max(20, f2), when);
                const twinScale = Math.min(0.36, (styleSide === 'drive' || themeId === 'nightrun'
                    ? (wantLeadTwin ? 0.12 + styleMag * 0.14 : 0.14 + styleMag * 0.16)
                    : styleSide === 'dnb' || styleSide === 'hybrid' || themeId === 'dnb'
                        ? (0.18 + styleMag * 0.2)
                        : styleSide === 'jungle' || themeId === 'jungle_dnb' || themeId === 'amen'
                            ? (0.12 + styleMag * 0.14)
                            : styleSide === 'elektro'
                                ? (0.06 + styleMag * 0.08)
                                : (0.08 + styleMag * 0.1)) * styleMag);
                const twinPeak = Math.max(0.0001, Math.min(0.26, peak * twinScale));
                const gate = Math.max(0.18, a + d + r
                    + (styleSide === 'drive' || themeId === 'nightrun' ? 0.3
                        : styleSide === 'dnb' || styleSide === 'hybrid' || themeId === 'dnb' ? 0.38
                            : styleSide === 'jungle' || themeId === 'jungle_dnb' || themeId === 'amen' ? 0.08
                                : styleSide === 'elektro' ? 0.28 : 0.12));
                g2.gain.setValueAtTime(0.0001, when);
                g2.gain.exponentialRampToValueAtTime(twinPeak, when + a);
                g2.gain.exponentialRampToValueAtTime(Math.max(0.0001, twinPeak * inst.sustain), when + a + d);
                g2.gain.setValueAtTime(Math.max(0.0001, twinPeak * inst.sustain), when + Math.max(a + d, gate - r));
                g2.gain.exponentialRampToValueAtTime(0.0001, when + gate);
                osc2.connect(g2);
                g2.connect(bus);
                osc2.start(when);
                try { osc2.stop(when + gate + 0.04); } catch (e2) { /* ignore */ }
            } catch (e) { /* ignore */ }
        }

        this._channels[ch] = { gain, source, release: r, filter, peak };
    }

    /** Advance song position by one row without scheduling audio. */
    _advanceRowIndex() {
        const track = this.track;
        if (!track) return false;
        const patId = track.order[this._orderIndex];
        const pat = track.patternById[patId];
        if (!pat) return false;
        this._rowIndex += 1;
        if (this._rowIndex >= pat.rows.length) {
            this._rowIndex = 0;
            this._orderIndex += 1;
            if (this._orderIndex >= track.order.length) {
                if (track.loop) {
                    this._orderIndex = 0;
                } else {
                    this.playing = false;
                    this._finishNonLoop();
                    return false;
                }
            }
        }
        return true;
    }

    _scheduleRow(when) {
        const track = this.track;
        const patId = track.order[this._orderIndex];
        const pat = track.patternById[patId];
        if (!pat) return;
        const rowIndex = this._rowIndex;
        const row = pat.rows[rowIndex];
        const styleMag = this._styleMag();
        const styleSide = this._styleSide();
        const themeIdx = Number(this.themeIndex) || 0;
        const themeMeta = (typeof VFTrackerThemes !== 'undefined' && VFTrackerThemes.metaOf)
            ? VFTrackerThemes.metaOf(themeIdx)
            : { themeBreak: 0 };
        const themeBreak = Number(themeMeta.themeBreak) || 0;
        // STYLE interprets authored Hauptmelodien (rhythm/drums/articulation);
        // pitches stay on the planet/role motif. Theme 0 = authored as written.
        if (row) {
            const pools = [];
            if (themeIdx > 0 && styleMag >= 0.03
                && typeof VFTrackerThemes !== 'undefined'
                && VFTrackerThemes.pitchPoolFromPattern) {
                for (let c = 0; c < 3; c++) {
                    pools[c] = VFTrackerThemes.pitchPoolFromPattern(pat, c);
                }
            }
            // Jungle / DnB push the Amen / two-step layer hard; other styles stay mild.
            const breakHeavy = styleSide === 'jungle' || styleSide === 'dnb' || styleSide === 'hybrid';
            const breakAmtPre = styleMag < 0.03 ? 0
                : styleMag * (themeIdx > 0
                    ? (breakHeavy
                        ? (0.42 + Math.min(1, themeBreak) * 0.52)
                        : (0.22 + Math.min(0.55, themeBreak) * 0.28))
                    : 0.35);
            for (let c = 0; c < track.channels; c++) {
                let cell = row[c];
                if (c <= 3 && themeIdx > 0
                    && typeof VFTrackerThemes !== 'undefined'
                    && VFTrackerThemes.interpretCell) {
                    cell = VFTrackerThemes.interpretCell(
                        themeIdx, this._orderIndex, rowIndex, c,
                        row[c], pools[c] || null, styleMag);
                }
                // Jungle/DnB: silence authored GB kit when break owns the groove.
                if (c === 3 && cell && breakHeavy && breakAmtPre > 0.28) {
                    cell = null;
                } else if (c === 3 && cell && breakAmtPre > 0.2) {
                    const duck = Math.max(0.3, 1 - breakAmtPre * 0.55);
                    if (cell.note !== 'OFF') {
                        cell = {
                            note: cell.note,
                            inst: cell.inst,
                            vol: Math.max(8, Math.round((cell.vol != null ? cell.vol : 40) * duck))
                        };
                    }
                }
                if (cell) {
                    // Drums are polyphonic (kick+hat same step) — oneshot, don't cut.
                    if (c === 3) {
                        const rowDur = this.rowDuration();
                        const isKick = cell.inst === 5;
                        // Floor gate length so high BPM drums keep body.
                        this._oneshot(c, cell, when, Math.max(
                            isKick ? 0.055 : 0.04,
                            rowDur * (isKick ? 0.95 : 0.65)));
                    } else {
                        this._trigger(c, cell, when);
                    }
                }
            }
        }
        // Break overlay: STYLE kit colour as spice, not a second song.
        const breakHeavy = styleSide === 'jungle' || styleSide === 'dnb' || styleSide === 'hybrid';
        const breakAmt = styleMag < 0.03 ? 0
            : styleMag * (themeIdx > 0
                ? (breakHeavy
                    ? (0.42 + Math.min(1, themeBreak) * 0.52)
                    : (0.22 + Math.min(0.55, themeBreak) * 0.28))
                : 0.35);
        const breakSide = (styleSide !== 'off' ? styleSide : null)
            || (themeMeta.breakSide && themeMeta.breakSide !== 'off' ? themeMeta.breakSide : null)
            || 'jungle';
        if (breakAmt > 0.02) this._scheduleJungleHits(when, rowIndex, breakAmt, breakSide);
        this._advanceRowIndex();
    }

    /**
     * Extra breakbeat pressure — Jungle / DnB / hybrid / minimal / NIGHTRUN drive.
     * @param {number} [amountOverride]
     * @param {'jungle'|'dnb'|'hybrid'|'elektro'|'drive'} [sideOverride]
     */
    _scheduleJungleHits(when, rowIndex, amountOverride, sideOverride) {
        const amt = Math.max(0, Math.min(1, amountOverride != null
            ? Number(amountOverride)
            : this._styleMag()));
        if (!(amt > 0)) return;
        const side = sideOverride || this._styleSide() || 'jungle';
        let bank;
        if (side === 'dnb') {
            bank = (typeof VFTrackerThemes !== 'undefined' && VFTrackerThemes.dnbBreak)
                ? VFTrackerThemes.dnbBreak
                : this._dnbBreak;
        } else if (side === 'hybrid') {
            bank = (typeof VFTrackerThemes !== 'undefined' && VFTrackerThemes.jungleDnbBreak)
                ? VFTrackerThemes.jungleDnbBreak
                : this._jungleBreak;
        } else if (side === 'elektro') {
            bank = (typeof VFTrackerThemes !== 'undefined' && VFTrackerThemes.elektroBreak)
                ? VFTrackerThemes.elektroBreak
                : this._dnbBreak;
        } else if (side === 'drive') {
            bank = (typeof VFTrackerThemes !== 'undefined' && VFTrackerThemes.driveBreak)
                ? VFTrackerThemes.driveBreak
                : this._driveBreak;
        } else {
            bank = (typeof VFTrackerThemes !== 'undefined' && VFTrackerThemes.amenBreak)
                ? VFTrackerThemes.amenBreak
                : this._jungleBreak;
        }
        const step = (bank || [])[rowIndex % 16];
        if (!step) return;
        const volScale = Math.min(1.15, side === 'jungle' || side === 'hybrid'
            ? (0.62 + amt * 0.5)
            : side === 'dnb'
                ? (0.55 + amt * 0.48)
                : side === 'drive'
                    ? (0.34 + amt * 0.4)
                    : side === 'elektro'
                        ? (0.36 + amt * 0.38)
                        : (0.3 + amt * 0.4));
        const rowDur = this.rowDuration();
        // Prefer body over ultra-short ticks when BPM is cranked.
        const gate = Math.max(0.045, Math.min(
            side === 'jungle' || side === 'hybrid' ? 0.1
                : side === 'dnb' ? 0.22
                    : side === 'drive' ? 0.16
                        : side === 'elektro' ? 0.18 : 0.18,
            Math.max(rowDur * 0.95, 0.05)));
        // Oneshots on drum bus — never call _trigger(3) (that cut authored notes).
        const fire = (note, inst, vel, at, gateMul) => {
            if (!(vel > 0.05)) return;
            this._oneshot(3, {
                note,
                inst,
                vol: Math.max(1, Math.min(64, Math.round(64 * vel * volScale)))
            }, at, gate * (gateMul || 1));
        };
        if (step.k) {
            fire('A-2', 5, step.k, when,
                side === 'dnb' ? 1.7
                    : side === 'elektro' || side === 'drive' ? 1.35
                        : side === 'jungle' || side === 'hybrid' ? 0.9 : 1);
        }
        if (step.s) {
            fire('A-4', 4, step.s * (side === 'elektro' ? 0.85
                : side === 'drive' ? 1.05
                    : side === 'jungle' || side === 'hybrid' ? 1.18
                        : side === 'dnb' ? 1.15 : 1), when,
                side === 'jungle' || side === 'hybrid' ? 0.7
                    : side === 'dnb' ? 1.1 : 1);
        }
        if (step.h) {
            fire('A-5', 4, step.h * (side === 'elektro' ? 0.9
                : side === 'dnb' ? 0.85
                    : side === 'drive' ? 0.75
                        : side === 'jungle' || side === 'hybrid' ? 0.8 : 0.85), when,
                side === 'dnb' ? 0.7 : 0.55);
        }

        // Jungle: Amen rolls only on marked steps (not every subdivision).
        // DnB: light mid-hat only — keep two-step space.
        if ((side === 'jungle' || side === 'hybrid') && step.r && amt > 0.18) {
            const mid = when + rowDur * 0.5;
            const rollVel = step.r * (0.7 + amt * 0.7);
            fire('A-4', 4, rollVel, mid, 0.5);
            if (amt > 0.45) {
                fire('A-4', 4, rollVel * 0.7, when + rowDur * 0.75, 0.42);
            }
            if (amt > 0.7) {
                fire('A-5', 4, rollVel * 0.45, when + rowDur * 0.25, 0.32);
            }
        } else if (side === 'dnb' && amt > 0.25) {
            fire('A-5', 4, 0.22 + amt * 0.2, when + rowDur * 0.5, 0.55);
            if (step.s && amt > 0.55) {
                fire('A-4', 4, 0.16 + amt * 0.14, when + rowDur * 0.75, 0.45);
            }
        } else if (side === 'elektro' && amt > 0.15) {
            fire('A-5', 4, 0.28 + amt * 0.28, when + rowDur * 0.5, 0.5);
            if (amt > 0.55 && step.k) {
                fire('A-2', 5, 0.35 + amt * 0.2, when + rowDur * 0.5, 0.85);
            }
        } else if (side === 'drive' && amt > 0.2) {
            fire('A-5', 4, 0.2 + amt * 0.2, when + rowDur * 0.5, 0.5);
        }
    }

    _finishNonLoop() {
        if (this._timer) {
            clearInterval(this._timer);
            this._timer = null;
        }
        if (this._endedFired) return;
        this._endedFired = true;
        const cb = this._onEnded;
        this._onEnded = null;
        if (cb) {
            try { cb(); } catch (e) { /* ignore listener errors */ }
        }
    }

    _tick() {
        if (!this.playing || !this.track || !this.ctx) return;
        const rowDur = this.rowDuration();
        if (!(rowDur > 0)) return;
        if (!(this._anchorRowDur > 0)) this._anchorRowDur = rowDur;
        const now = this.ctx.currentTime;
        // ~0.5s / ~12 rows ahead so combat-frame stalls rarely go late.
        const ahead = Math.max(this.scheduleAhead, Math.min(0.55, rowDur * 12));
        const horizon = now + ahead;
        while (this.playing) {
            const ideal = this._rowWhen(this._rowAbs);
            if (ideal >= horizon) break;
            let when = ideal;
            if (ideal < now + 0.001) {
                // Play this musical row, then re-anchor — never skip pattern
                // content to catch wall-clock (that jumped inside the tracks).
                when = now + 0.003;
                this._scheduleRow(when);
                this._rowAbs += 1;
                this._anchorTime = when;
                this._anchorRow = this._rowAbs - 1;
                this._anchorRowDur = rowDur;
                this._nextRowTime = this._rowWhen(this._rowAbs);
                continue;
            }
            this._scheduleRow(when);
            this._rowAbs += 1;
            this._nextRowTime = this._rowWhen(this._rowAbs);
        }
    }

    stop(immediate) {
        if (this._fadeOutTimer) {
            clearTimeout(this._fadeOutTimer);
            this._fadeOutTimer = null;
        }
        if (this._timer) {
            clearInterval(this._timer);
            this._timer = null;
        }
        if (this._raf) {
            cancelAnimationFrame(this._raf);
            this._raf = null;
        }
        this.playing = false;
        this._onEnded = null;
        const when = this.ctx ? this.ctx.currentTime : 0;
        for (let i = 0; i < this._channels.length; i++) {
            this._stopChannel(i, when);
        }
        this._channels = [];
        this.track = null;
        // Never hard-mute the bus on soft stop — a following play() would race
        // the mute and leave planet music silent. Channels are already silenced.
        if (immediate && this.ctx) {
            try {
                if (this.masterGain) this.masterGain.gain.cancelScheduledValues(when);
                if (this._fadeGain) {
                    this._fadeGain.gain.cancelScheduledValues(when);
                    this._fadeGain.gain.setValueAtTime(0.0001, when);
                }
            } catch (e) { /* ignore */ }
            // Tear the output chain off destination so faded-out crossfade
            // legs cannot accumulate zombie limiters on the shared context.
            this._disconnectChannelBuses();
            try { if (this._limiter) this._limiter.disconnect(); } catch (e2) { /* ignore */ }
            try { if (this._fadeGain) this._fadeGain.disconnect(); } catch (e3) { /* ignore */ }
            try { if (this.masterGain) this.masterGain.disconnect(); } catch (e4) { /* ignore */ }
            this._masterChained = false;
        }
    }

    get bpm() {
        return this.effectiveBpm();
    }

    isPlaying() {
        return !!this.playing;
    }

    /**
     * Audible playhead for UI (Music Editor score). Uses musical time, not the
     * lookahead schedule cursor, so the highlight matches what you hear.
     */
    getPlayhead() {
        if (!this.playing || !this.track || !this.ctx) {
            return { playing: false, orderIndex: 0, rowIndex: 0, pattern: 0, frac: 0, absRow: 0 };
        }
        const now = this.ctx.currentTime;
        const dur = Math.max(1e-4, this._anchorRowDur || this.rowDuration());
        let abs = this._anchorRow + (now - this._anchorTime) / dur;
        if (!(abs > 0)) abs = 0;
        const floor = Math.floor(abs);
        const frac = Math.max(0, Math.min(1, abs - floor));
        const pos = this._absRowToPos(floor);
        // Pattern id from the order slot (not orderIndex%3 — that mapped the
        // wrong pack whenever order repeated P0/P1 before P2).
        const patId = (this.track.order && this.track.order[pos.order] != null)
            ? Number(this.track.order[pos.order])
            : 0;
        return {
            playing: true,
            orderIndex: pos.order,
            rowIndex: pos.row,
            pattern: Number.isFinite(patId) ? patId : 0,
            frac,
            absRow: abs
        };
    }

    _absRowToPos(absRow) {
        const track = this.track;
        if (!track || !track.order || !track.order.length) return { order: 0, row: 0 };
        let left = Math.max(0, Math.floor(Number(absRow) || 0));
        let oi = 0;
        for (let g = 0; g < 100000; g++) {
            const pat = track.patternById[track.order[oi]];
            const rows = (pat && pat.rows && pat.rows.length) ? pat.rows.length : 16;
            if (left < rows) return { order: oi, row: left };
            left -= rows;
            oi += 1;
            if (oi >= track.order.length) {
                if (!track.loop) {
                    const last = track.order.length - 1;
                    const lp = track.patternById[track.order[last]];
                    const lr = (lp && lp.rows && lp.rows.length) ? lp.rows.length : 16;
                    return { order: last, row: Math.max(0, lr - 1) };
                }
                oi = 0;
            }
        }
        return { order: 0, row: 0 };
    }
}
