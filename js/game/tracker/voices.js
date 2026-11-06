"use strict";

/**
 * Per-channel voice presets for BASS / LEAD / ARP / DRUMS sliders.
 * `default` keeps the track's authored instrument for that hit.
 */
const VFTrackerVoices = {
    channels: [
        {
            id: 'bass',
            label: 'BASS',
            options: [
                { id: 'default', label: 'DEFAULT' },
                { id: 'wave', label: 'WAVE' },
                { id: 'reese', label: 'REESE' },
                { id: 'square', label: 'SQUARE' },
                { id: 'sine', label: 'SINE' },
                { id: 'sub', label: 'SUB' },
                { id: 'saw', label: 'SAW' },
                { id: 'grit', label: 'GRIT' },
                { id: 'growl', label: 'GROWL' },
                { id: 'deep', label: 'DEEP' }
            ]
        },
        {
            id: 'lead',
            label: 'LEAD',
            options: [
                { id: 'default', label: 'DEFAULT' },
                { id: 'pulse', label: 'PULSE' },
                { id: 'square', label: 'SQUARE' },
                { id: 'saw', label: 'SAW' },
                { id: 'tri', label: 'TRI' },
                { id: 'bell', label: 'BELL' },
                { id: 'sine', label: 'SINE' },
                { id: 'chip', label: 'CHIP' },
                { id: 'soft', label: 'SOFT' },
                { id: 'growl', label: 'GROWL' }
            ]
        },
        {
            id: 'arp',
            label: 'ARP',
            options: [
                { id: 'default', label: 'DEFAULT' },
                { id: 'pulse', label: 'PULSE' },
                { id: 'square', label: 'SQUARE' },
                { id: 'tri', label: 'TRI' },
                { id: 'pluck', label: 'PLUCK' },
                { id: 'soft', label: 'SOFT' },
                { id: 'saw', label: 'SAW' },
                { id: 'sine', label: 'SINE' },
                { id: 'bell', label: 'BELL' },
                { id: 'chirp', label: 'CHIRP' }
            ]
        },
        {
            id: 'drums',
            label: 'DRUMS',
            options: [
                { id: 'default', label: 'DEFAULT' },
                { id: 'kit', label: 'KIT' },
                { id: 'noise', label: 'NOISE' },
                { id: 'kick', label: 'KICK' },
                { id: 'metal', label: 'METAL' },
                { id: 'soft', label: 'SOFT' },
                { id: 'click', label: 'CLICK' },
                { id: 'snare', label: 'SNARE' },
                { id: 'crunch', label: 'CRUNCH' },
                { id: 'tight', label: 'TIGHT' }
            ]
        }
    ],

    _presets: {
        bass: {
            wave: { wave: 'triangle', volume: 0.72, attack: 0.001, decay: 0.04, sustain: 0.6, release: 0.08, filter: 1800 },
            reese: { wave: 'sawtooth', volume: 0.62, attack: 0.002, decay: 0.08, sustain: 0.7, release: 0.14, filter: 520 },
            square: { wave: 'square', volume: 0.5, attack: 0.001, decay: 0.05, sustain: 0.55, release: 0.08, filter: 900 },
            sine: { wave: 'sine', volume: 0.85, attack: 0.001, decay: 0.05, sustain: 0.75, release: 0.1, filter: 1200 },
            sub: { wave: 'sine', volume: 0.95, attack: 0.002, decay: 0.06, sustain: 0.85, release: 0.16, filter: 280 },
            saw: { wave: 'sawtooth', volume: 0.58, attack: 0.001, decay: 0.06, sustain: 0.62, release: 0.1, filter: 700 },
            grit: { wave: 'square', volume: 0.48, attack: 0.001, decay: 0.07, sustain: 0.5, release: 0.09, filter: 640 },
            growl: { wave: 'sawtooth', volume: 0.55, attack: 0.003, decay: 0.1, sustain: 0.68, release: 0.18, filter: 420 },
            deep: { wave: 'triangle', volume: 0.9, attack: 0.002, decay: 0.08, sustain: 0.8, release: 0.2, filter: 360 }
        },
        lead: {
            pulse: { wave: 'square', volume: 0.3, attack: 0.001, decay: 0.05, sustain: 0.32, release: 0.08, filter: 2400 },
            square: { wave: 'square', volume: 0.34, attack: 0.001, decay: 0.04, sustain: 0.36, release: 0.07, filter: 2800 },
            saw: { wave: 'sawtooth', volume: 0.28, attack: 0.001, decay: 0.06, sustain: 0.3, release: 0.09, filter: 2200 },
            tri: { wave: 'triangle', volume: 0.4, attack: 0.001, decay: 0.05, sustain: 0.4, release: 0.1, filter: 2600 },
            bell: { wave: 'sine', volume: 0.45, attack: 0.001, decay: 0.12, sustain: 0.15, release: 0.18, filter: 3200 },
            sine: { wave: 'sine', volume: 0.42, attack: 0.002, decay: 0.06, sustain: 0.38, release: 0.12, filter: 2800 },
            chip: { wave: 'square', volume: 0.32, attack: 0.001, decay: 0.02, sustain: 0.28, release: 0.04, filter: 4000 },
            soft: { wave: 'triangle', volume: 0.36, attack: 0.004, decay: 0.08, sustain: 0.34, release: 0.14, filter: 1800 },
            growl: { wave: 'sawtooth', volume: 0.3, attack: 0.002, decay: 0.1, sustain: 0.28, release: 0.12, filter: 1400 }
        },
        arp: {
            pulse: { wave: 'square', volume: 0.58, attack: 0.001, decay: 0.03, sustain: 0.4, release: 0.05 },
            square: { wave: 'square', volume: 0.62, attack: 0.001, decay: 0.03, sustain: 0.42, release: 0.05, filter: 3600 },
            tri: { wave: 'triangle', volume: 0.6, attack: 0.001, decay: 0.03, sustain: 0.4, release: 0.06, filter: 2800 },
            pluck: { wave: 'square', volume: 0.58, attack: 0.001, decay: 0.08, sustain: 0.12, release: 0.04, filter: 3000 },
            soft: { wave: 'sine', volume: 0.5, attack: 0.002, decay: 0.05, sustain: 0.32, release: 0.08, filter: 2200 },
            saw: { wave: 'sawtooth', volume: 0.52, attack: 0.001, decay: 0.04, sustain: 0.34, release: 0.05, filter: 3200 },
            sine: { wave: 'sine', volume: 0.48, attack: 0.001, decay: 0.04, sustain: 0.3, release: 0.07, filter: 2600 },
            bell: { wave: 'sine', volume: 0.54, attack: 0.001, decay: 0.1, sustain: 0.1, release: 0.12, filter: 3800 },
            chirp: { wave: 'square', volume: 0.5, attack: 0.001, decay: 0.015, sustain: 0.08, release: 0.03, filter: 4500 }
        },
        drums: {
            kit: null,
            noise: { wave: 'noise', volume: 0.36, attack: 0.001, decay: 0.025, sustain: 0.01, release: 0.02 },
            kick: { wave: 'triangle', volume: 0.82, attack: 0.001, decay: 0.07, sustain: 0.05, release: 0.04, filter: 380 },
            metal: { wave: 'noise', volume: 0.4, attack: 0.001, decay: 0.015, sustain: 0.02, release: 0.03, filter: 5000 },
            soft: { wave: 'noise', volume: 0.22, attack: 0.002, decay: 0.04, sustain: 0.01, release: 0.05 },
            click: { wave: 'noise', volume: 0.28, attack: 0.001, decay: 0.008, sustain: 0.01, release: 0.015, filter: 6000 },
            snare: { wave: 'noise', volume: 0.42, attack: 0.001, decay: 0.04, sustain: 0.02, release: 0.04, filter: 3200 },
            crunch: { wave: 'noise', volume: 0.38, attack: 0.001, decay: 0.05, sustain: 0.03, release: 0.05, filter: 2200 },
            tight: { wave: 'triangle', volume: 0.7, attack: 0.001, decay: 0.03, sustain: 0.02, release: 0.02, filter: 520 }
        }
    },

    optionsFor(ch) {
        const row = this.channels[ch];
        return row ? row.options : [{ id: 'default', label: 'DEFAULT' }];
    },

    labelOf(ch, voiceId) {
        const opts = this.optionsFor(ch);
        for (let i = 0; i < opts.length; i++) {
            if (opts[i].id === voiceId) return opts[i].label;
        }
        return 'DEFAULT';
    },

    indexOf(ch, voiceId) {
        const opts = this.optionsFor(ch);
        const id = String(voiceId || 'default');
        for (let i = 0; i < opts.length; i++) {
            if (opts[i].id === id) return i;
        }
        return 0;
    },

    /**
     * Resolve instrument for a channel voice. Returns authored `base` for default/kit.
     */
    resolve(ch, voiceId, base) {
        const key = ch === 0 ? 'bass' : ch === 1 ? 'lead' : ch === 2 ? 'arp' : 'drums';
        const id = String(voiceId || 'default');
        if (id === 'default' || id === 'kit') return base || null;
        const bank = this._presets[key];
        const preset = bank && bank[id];
        if (!preset) return base || null;
        const out = Object.assign({ id: (base && base.id) || (ch + 1), name: id }, preset);
        return out;
    }
};
