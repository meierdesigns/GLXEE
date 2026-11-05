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
        this.volume = 0.2;
        this._timer = null;
        this._nextRowTime = 0;
        this._orderIndex = 0;
        this._rowIndex = 0;
        this._channels = [];
        this._noiseBuffer = null;
        this.lookahead = 0.08;
        this.scheduleAhead = 0.25;
        /** Playback speed vs authored BPM (>1 = faster). */
        this.tempoScale = 3.5;
        /**
         * Per-channel mix (bass / lead / arp / drums).
         * Lead (ch1) is ducked so square pulse doesn't bury the rest.
         */
        this.channelMix = [1.1, 0.42, 1.45, 1.25];
        this._onEnded = null;
        this._endedFired = false;
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
            this.masterGain.connect(this.ctx.destination);
        }
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
        if (this.masterGain && this.ctx) {
            const now = this.ctx.currentTime;
            this.masterGain.gain.cancelScheduledValues(now);
            this.masterGain.gain.linearRampToValueAtTime(Math.max(0.0001, this.volume), now + 0.05);
        }
    }

    effectiveBpm() {
        if (!this.track) return 0;
        const scale = Number(this.tempoScale);
        const mul = Number.isFinite(scale) && scale > 0 ? scale : 1;
        return Math.max(60, Math.min(960, Number(this.track.bpm) * mul));
    }

    rowDuration() {
        const bpm = this.effectiveBpm();
        const rpb = this.track.rowsPerBeat;
        return (60 / bpm) / rpb;
    }

    play(track, opts) {
        const normalized = VFTrackerParse.normalize(track);
        // Soft stop channels/timer but keep the master bus; hard-mute made
        // immediate restarts come back silent when setVolume raced the ramp.
        this.stop(false);
        const ctx = this.ensureContext(opts && opts.context);
        if (!this.masterGain) {
            this.masterGain = ctx.createGain();
            this.masterGain.connect(ctx.destination);
        }
        this.track = normalized;
        this.playing = true;
        this._endedFired = false;
        this._onEnded = (opts && typeof opts.onEnded === 'function') ? opts.onEnded : null;
        this._orderIndex = 0;
        this._rowIndex = 0;
        this._channels = [];
        for (let i = 0; i < normalized.channels; i++) {
            this._channels.push({ gain: null, source: null, release: 0.1 });
        }
        const vol = opts && opts.volume != null ? opts.volume : this.volume;
        this.volume = Math.max(0.0001, Math.min(1, Number(vol) || 0.2));
        try {
            this.masterGain.gain.cancelScheduledValues(ctx.currentTime);
            this.masterGain.gain.setValueAtTime(this.volume, ctx.currentTime);
        } catch (e) { /* ignore */ }
        this._nextRowTime = ctx.currentTime + 0.02;
        this._timer = setInterval(() => this._tick(), this.lookahead * 1000);
        this._tick();
        return normalized;
    }

    _stopChannel(ch, when) {
        const slot = this._channels[ch];
        if (!slot) return;
        try {
            if (slot.gain) {
                const t = when;
                const rel = slot.release || 0.08;
                slot.gain.gain.cancelScheduledValues(t);
                slot.gain.gain.setValueAtTime(Math.max(0.0001, slot.gain.gain.value), t);
                slot.gain.gain.exponentialRampToValueAtTime(0.0001, t + rel);
                if (slot.source) {
                    try { slot.source.stop(t + rel + 0.02); } catch (e) { /* already stopped */ }
                }
            }
        } catch (e) { /* ignore */ }
        slot.gain = null;
        slot.source = null;
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

        const inst = track.instrumentById[cell.inst] || track.instruments[0];
        if (!inst) return;

        this._stopChannel(ch, when);

        const ctx = this.ctx;
        const gain = ctx.createGain();
        let filter = null;
        if (inst.filter && inst.wave !== 'noise') {
            filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(inst.filter, when);
            filter.Q.setValueAtTime(0.7, when);
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
        const mix = (this.channelMix && this.channelMix[ch] != null) ? Number(this.channelMix[ch]) : 1;
        const chMul = Number.isFinite(mix) && mix > 0 ? mix : 1;
        const peak = Math.max(0.0001, inst.volume * vol64 * chMul);
        const a = inst.attack;
        const d = inst.decay;
        const s = Math.max(0.0001, peak * inst.sustain);
        const r = inst.release;

        gain.gain.setValueAtTime(0.0001, when);
        gain.gain.exponentialRampToValueAtTime(peak, when + a);
        gain.gain.exponentialRampToValueAtTime(s, when + a + d);

        if (filter) {
            source.connect(filter);
            filter.connect(gain);
        } else {
            source.connect(gain);
        }
        gain.connect(this.masterGain);
        source.start(when);

        this._channels[ch] = { gain, source, release: r, filter };
    }

    _scheduleRow(when) {
        const track = this.track;
        const patId = track.order[this._orderIndex];
        const pat = track.patternById[patId];
        if (!pat) return;
        const row = pat.rows[this._rowIndex];
        if (row) {
            for (let c = 0; c < track.channels; c++) {
                if (row[c]) this._trigger(c, row[c], when);
            }
        }
        this._rowIndex += 1;
        if (this._rowIndex >= pat.rows.length) {
            this._rowIndex = 0;
            this._orderIndex += 1;
            if (this._orderIndex >= track.order.length) {
                if (track.loop) this._orderIndex = 0;
                else {
                    this.playing = false;
                    this._finishNonLoop();
                    return;
                }
            }
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
        const horizon = this.ctx.currentTime + this.scheduleAhead;
        while (this.playing && this._nextRowTime < horizon) {
            this._scheduleRow(this._nextRowTime);
            this._nextRowTime += rowDur;
        }
    }

    stop(immediate) {
        if (this._timer) {
            clearInterval(this._timer);
            this._timer = null;
        }
        this.playing = false;
        this._onEnded = null;
        const when = this.ctx ? this.ctx.currentTime : 0;
        for (let i = 0; i < this._channels.length; i++) {
            this._stopChannel(i, when);
        }
        this._channels = [];
        this.track = null;
        // Never hard-mute the bus on stop — a following play() would race the
        // mute and leave planet music silent. Channels are already silenced.
        if (immediate && this.masterGain && this.ctx) {
            try {
                this.masterGain.gain.cancelScheduledValues(when);
            } catch (e) { /* ignore */ }
        }
    }

    get bpm() {
        return this.effectiveBpm();
    }

    isPlaying() {
        return !!this.playing;
    }
}
