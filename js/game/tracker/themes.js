"use strict";

/**
 * Selectable melody / bass Grundthemen for VF Tracker.
 * Theme 0 = keep planet-authored channels. 1+ replace bass/lead/arp with
 * style heads; break layer + mix morph are driven by STYLE AMOUNT (0..1).
 *
 * Indices 0–6 stay stable (renames only). New styles append at the end.
 */
const VFTrackerThemes = {
    REF_BPM: 174,

    /** UI / storage order — indices 0–6 must stay stable once shipped. */
    list: [
        { id: 'planet', label: 'PLANET' },
        { id: 'jungle_dnb', label: 'JUNGLE' },
        { id: 'minimal_elektro', label: 'MINIMAL' }, // dark minimal techno (Max Minimal–style)
        { id: 'amen', label: 'AMEN' },
        { id: 'reese', label: 'REESE' },
        { id: 'neuro', label: 'NEURO' },
        { id: 'liquid', label: 'LIQUID' },
        { id: 'dnb', label: 'DNB' },
        { id: 'nightrun', label: 'NIGHTRUN' }
    ],

    /**
     * Per-style playback hints used by the tracker player / tempo morph.
     * breakSide: 'jungle' | 'dnb' | 'elektro' | 'hybrid' | 'drive' | 'off'
     */
    _meta: {
        planet: { breakSide: 'off', mix: 'base', tempoBoost: 0, themeBreak: 0 },
        jungle_dnb: { breakSide: 'jungle', mix: 'jungle', tempoBoost: 0.42, themeBreak: 0.95 },
        // Dark minimal techno: heavy 4/4 + sub — ref https://www.youtube.com/watch?v=mv8vJQaUpDU
        minimal_elektro: { breakSide: 'elektro', mix: 'elektro', tempoBoost: 0.14, themeBreak: 0.92 },
        amen: { breakSide: 'jungle', mix: 'jungle', tempoBoost: 0.32, themeBreak: 0.9 },
        reese: { breakSide: 'dnb', mix: 'dnb', tempoBoost: 0.26, themeBreak: 0.78 },
        neuro: { breakSide: 'dnb', mix: 'dnb', tempoBoost: 0.22, themeBreak: 0.68 },
        liquid: { breakSide: 'dnb', mix: 'liquid', tempoBoost: 0.14, themeBreak: 0.45 },
        dnb: { breakSide: 'dnb', mix: 'dnb', tempoBoost: 0.28, themeBreak: 0.92 },
        nightrun: { breakSide: 'drive', mix: 'nightrun', tempoBoost: 0.18, themeBreak: 0.88 }
    },

    count() {
        return this.list.length;
    },

    labelOf(index) {
        const i = Math.max(0, Math.min(this.list.length - 1, Math.round(Number(index) || 0)));
        return this.list[i].label;
    },

    idOf(index) {
        const i = Math.max(0, Math.min(this.list.length - 1, Math.round(Number(index) || 0)));
        return this.list[i].id;
    },

    indexOfId(id) {
        const key = String(id || '');
        for (let i = 0; i < this.list.length; i++) {
            if (this.list[i].id === key) return i;
        }
        return 0;
    },

    metaOf(indexOrId) {
        const id = typeof indexOrId === 'string'
            ? indexOrId
            : this.idOf(indexOrId);
        return this._meta[id] || this._meta.planet;
    },

    /** Three development patterns (P0 state / P1 sequence / P2 climax), 16 rows. */
    _banks: {
        // Classic jungle: chopped Amen bass, ragga hooks, open space for breaks.
        jungle_dnb: [
            {
                bass: 'A-1:1:70 A-1:1:36 . E-1:1:52 A-1:1:28 . A-1:1:64 . E-1:1:44 . A-1:1:68 A-1:1:32 . E-1:1:48 . A-1:1:56 .',
                lead: 'A-4:2:46 . . . C-5:2:34 . . . E-5:2:52 . . D-5:2:38 . . C-5:2:32 . A-4:2:40 .',
                arp: 'E-3:3:20 . A-3:3:10 . . E-3:3:14 . . A-3:3:16 . E-3:3:12 . . A-3:3:10 . E-3:3:08 .'
            },
            {
                bass: 'F-1:1:66 F-1:1:34 . C-1:1:48 F-1:1:26 . G-1:1:60 . D-1:1:42 . F-1:1:62 F-1:1:30 . C-1:1:44 . G-1:1:52 .',
                lead: 'F-4:2:42 . . . A-4:2:30 . . . C-5:2:48 . . B-4:2:34 . . A-4:2:28 . G-4:2:36 .',
                arp: 'C-3:3:18 . F-3:3:10 . . C-3:3:12 . . G-3:3:14 . D-3:3:10 . . F-3:3:08 . C-3:3:06 .'
            },
            {
                bass: 'A-1:1:74 A-1:1:40 . E-1:1:56 A-1:1:66 . E-1:1:36 G-1:1:54 . A-1:1:72 A-1:1:38 . E-1:1:50 A-1:1:60 . E-1:1:42',
                lead: 'A-5:2:54 . C-6:2:42 . . E-6:2:58 . D-6:2:46 . . C-6:2:44 . A-5:2:40 . G-5:2:38 . A-5:2:48',
                arp: 'A-3:3:22 . E-3:3:14 A-3:3:18 . C-4:3:24 . E-3:3:12 . A-3:3:16 G-3:3:12 . E-3:3:10 . A-3:3:14'
            }
        ],
        // Dark minimal techno (Max Minimal / dark techno set vibe):
        // pumping 4/4 sub, delayed minor stabs, muted offbeat ticks — hypnotic, not empty.
        minimal_elektro: [
            {
                bass: 'A-1:1:72 A-1:1:34 . A-1:1:50 A-1:1:68 A-1:1:30 . A-1:1:46 A-1:1:70 A-1:1:32 . A-1:1:48 A-1:1:66 A-1:1:28 . A-1:1:44',
                lead: '. . A-3:2:38 . . . . E-3:2:28 . . . A-3:2:34 . . . E-3:2:24',
                arp: 'E-4:3:18 . . E-4:3:10 . E-4:3:14 . . A-4:3:12 . E-4:3:10 . . E-4:3:12 . E-4:3:08'
            },
            {
                bass: 'F-1:1:68 F-1:1:32 . F-1:1:46 F-1:1:64 F-1:1:28 . F-1:1:42 G-1:1:66 G-1:1:30 . G-1:1:44 C-1:1:58 C-1:1:26 . C-1:1:40',
                lead: '. . F-3:2:34 . . . . C-3:2:24 . . . F-3:2:30 . . . Ab3:2:22',
                arp: 'C-4:3:16 . . C-4:3:08 . C-4:3:12 . . F-4:3:10 . C-4:3:08 . . D-4:3:10 . C-4:3:06'
            },
            {
                bass: 'A-1:1:76 A-1:1:36 A-1:1:52 . A-1:1:70 A-1:1:32 . E-1:1:60 E-1:1:34 . A-1:1:72 A-1:1:38 A-1:1:54 . A-1:1:66 A-1:1:30',
                lead: '. A-3:2:42 . . E-3:2:30 . . A-3:2:36 . . C-4:2:40 . . A-3:2:32 . . E-3:2:26 .',
                arp: 'A-4:3:20 . E-4:3:12 . A-4:3:16 . E-4:3:10 . A-4:3:18 . E-4:3:12 . C-5:3:14 . E-4:3:08'
            }
        ],
        // Amen head (classic jungle hook bank).
        amen: [
            {
                bass: 'A-1:1:62 A-1:1:40 . E-1:1:48 . A-1:1:58 A-1:1:36 . E-1:1:44 . A-1:1:60 . E-1:1:42 . A-1:1:50 . E-1:1:38',
                lead: 'A-4:2:44 . . C-5:2:36 . . E-5:2:48 . D-5:2:40 . . C-5:2:38 . A-4:2:34 . . G-4:2:32 . A-4:2:40',
                arp: 'E-3:3:18 . . . A-3:3:14 . . . E-3:3:16 . . . A-3:3:12 . . .'
            },
            {
                bass: 'F-1:1:58 F-1:1:36 . C-1:1:44 . G-1:1:56 G-1:1:34 . D-1:1:42 . F-1:1:54 . C-1:1:40 . G-1:1:48 . D-1:1:36',
                lead: 'F-4:2:40 . . A-4:2:32 . . C-5:2:44 . B-4:2:36 . . A-4:2:34 . G-4:2:30 . . E-4:2:28 . F-4:2:36',
                arp: 'C-3:3:16 . . . F-3:3:12 . . . D-3:3:14 . . . G-3:3:10 . . .'
            },
            {
                bass: 'A-1:1:66 A-1:1:44 . E-1:1:52 . A-1:1:62 A-1:1:40 . G-1:1:50 . A-1:1:64 . E-1:1:46 . A-1:1:54 . E-1:1:40',
                lead: 'A-5:2:50 . C-6:2:40 . E-6:2:54 . D-6:2:46 . C-6:2:44 . A-5:2:38 . G-5:2:36 . A-5:2:42',
                arp: 'A-3:3:20 . E-3:3:12 . E-3:3:12 A-3:3:18 . C-4:3:22 . E-3:3:12 A-3:3:16 . G-3:3:12 . E-3:3:10 .'
            }
        ],
        // Dark Reese: long sub drones, almost no lead — pressure from bass + breaks.
        reese: [
            {
                bass: 'A-1:1:70 . . . A-1:1:58 . . . A-1:1:66 . . . E-1:1:50 . . .',
                lead: 'A-4:2:28 . . . . . E-4:2:22 . . . . . A-4:2:26 . . .',
                arp: 'E-2:3:10 . . . . . . . A-2:3:08 . . . . . . .'
            },
            {
                bass: 'F-1:1:66 . . . F-1:1:54 . . . G-1:1:62 . . . D-1:1:48 . . .',
                lead: 'F-4:2:24 . . . . . C-4:2:20 . . . . . G-4:2:22 . . .',
                arp: 'C-2:3:08 . . . . . . . D-2:3:06 . . . . . . .'
            },
            {
                bass: 'A-1:1:74 . . A-1:1:50 . A-1:1:68 . . E-1:1:56 . A-1:1:72 . . A-1:1:52 . E-1:1:48 . .',
                lead: 'A-5:2:36 . . E-5:2:28 . . C-5:2:30 . . A-4:2:32 . . E-4:2:24 . . A-4:2:34 .',
                arp: 'A-2:3:14 . . . E-2:3:10 . . . A-2:3:12 . . . E-2:3:08 . . .'
            }
        ],
        // Neuro: syncopated stabs, dissonant leaps, choppy bass.
        neuro: [
            {
                bass: 'A-1:1:64 . A-1:1:30 A-1:1:48 . E-1:1:40 A-1:1:58 . A-1:1:28 . E-1:1:52 A-1:1:36 . A-1:1:44 . E-1:1:32',
                lead: 'A-4:2:52 . . Eb5:2:40 . . A-4:2:46 . G-4:2:34 . . C-5:2:48 . . Bb4:2:36 . A-4:2:42 .',
                arp: 'E-4:3:22 . . A-4:3:16 . . E-4:3:18 . . Bb3:3:14 . . E-4:3:16 . . A-4:3:12 .'
            },
            {
                bass: 'Bb0:1:60 . Bb0:1:28 F-1:1:46 . Bb0:1:54 . F-1:1:26 . C-1:1:50 Bb0:1:34 . F-1:1:42 . C-1:1:30',
                lead: 'Bb4:2:48 . . F-5:2:38 . . Eb5:2:42 . D-5:2:32 . . F-5:2:44 . . Eb5:2:34 . Bb4:2:40 .',
                arp: 'F-4:3:20 . . Bb4:3:14 . . F-4:3:16 . . D-4:3:12 . . F-4:3:14 . . Bb4:3:10 .'
            },
            {
                bass: 'A-1:1:68 A-1:1:34 . E-1:1:50 A-1:1:62 . E-1:1:32 A-1:1:56 . G-1:1:46 A-1:1:64 . E-1:1:38 A-1:1:52 .',
                lead: 'A-5:2:56 . Eb6:2:44 . A-5:2:50 . G-5:2:40 . Eb6:2:52 . C-6:2:42 . Bb5:2:38 . A-5:2:46',
                arp: 'A-4:3:24 . E-4:3:14 . Bb4:3:18 . E-4:3:12 A-4:3:20 . Eb4:3:16 . A-4:3:18 . E-4:3:10 .'
            }
        ],
        // Liquid: smoother 7ths / floating arp, still break-friendly.
        liquid: [
            {
                bass: 'A-1:1:54 . . E-1:1:42 . A-1:1:50 . . E-1:1:38 . A-1:1:52 . . E-1:1:40 . A-1:1:46 .',
                lead: 'A-4:2:40 . C-5:2:34 . E-5:2:44 . G-5:2:36 . E-5:2:38 . C-5:2:32 . B-4:2:30 . A-4:2:36',
                arp: 'E-4:3:14 C-4:3:10 . A-3:3:12 . E-4:3:12 C-4:3:08 . A-3:3:10 . E-4:3:12 C-4:3:08 . A-3:3:10 .'
            },
            {
                bass: 'F-1:1:50 . . C-1:1:38 . G-1:1:48 . . D-1:1:36 . F-1:1:46 . . C-1:1:34 . G-1:1:42 .',
                lead: 'F-4:2:36 . A-4:2:30 . C-5:2:40 . E-5:2:32 . D-5:2:34 . C-5:2:28 . A-4:2:26 . G-4:2:32',
                arp: 'C-4:3:12 A-3:3:08 . F-3:3:10 . D-4:3:12 B-3:3:08 . G-3:3:10 . C-4:3:12 A-3:3:08 . F-3:3:10 .'
            },
            {
                bass: 'A-1:1:58 . . E-1:1:44 . A-1:1:54 . . G-1:1:46 . A-1:1:56 . . E-1:1:42 . A-1:1:50 .',
                lead: 'A-5:2:44 . C-6:2:38 . E-6:2:48 . G-6:2:40 . E-6:2:42 . C-6:2:36 . B-5:2:34 . A-5:2:40',
                arp: 'A-4:3:16 E-4:3:12 . C-4:3:14 . A-4:3:14 E-4:3:10 . C-4:3:12 . A-4:3:14 E-4:3:10 . C-4:3:12 .'
            }
        ],
        // Proper DnB: half-time sub, two-step space, sparse neuro stabs.
        dnb: [
            {
                bass: 'A-1:1:72 . . . A-1:1:48 . . . A-1:1:68 . . E-1:1:52 . A-1:1:58 . . .',
                lead: 'A-4:2:36 . . . . . . C-5:2:28 . . . . . E-4:2:32 . . .',
                arp: 'E-3:3:14 . . . . . A-3:3:10 . . . . . E-3:3:12 . . .'
            },
            {
                bass: 'F-1:1:68 . . . F-1:1:44 . . . G-1:1:64 . . D-1:1:48 . F-1:1:54 . . .',
                lead: 'F-4:2:32 . . . . . . A-4:2:24 . . . . . C-4:2:28 . . .',
                arp: 'C-3:3:12 . . . . . F-3:3:08 . . . . . D-3:3:10 . . .'
            },
            {
                bass: 'A-1:1:76 . . A-1:1:42 . A-1:1:70 . . E-1:1:56 . A-1:1:74 . . A-1:1:46 . E-1:1:50 . .',
                lead: 'A-5:2:44 . . Eb5:2:34 . . . A-4:2:38 . . G-4:2:30 . . C-5:2:36 . . A-4:2:40',
                arp: 'A-3:3:16 . . E-3:3:10 . . A-3:3:14 . . E-3:3:08 . Bb3:3:12 . . E-3:3:08 .'
            }
        ],
        // NIGHTRUN — darksynth / neon-highway (Carpenter Brut–adjacent, original name).
        // Driving minor riffs, heavy octaves, cinematic lead, relentless pulse.
        nightrun: [
            {
                bass: 'A-1:1:74 A-1:1:50 A-1:1:58 A-1:1:42 A-1:1:70 A-1:1:48 A-1:1:56 A-1:1:40 A-1:1:72 A-1:1:46 A-1:1:54 A-1:1:38 E-1:1:62 E-1:1:44 E-1:1:52 E-1:1:36',
                lead: 'A-3:2:58 . C-4:2:48 . E-4:2:62 . D-4:2:52 . C-4:2:50 . A-3:2:44 . G-3:2:42 . A-3:2:54',
                arp: 'A-4:3:28 E-4:3:18 . C-5:3:24 . A-4:3:22 E-4:3:14 . C-5:3:20 . A-4:3:18 E-4:3:12 . G-4:3:16'
            },
            {
                bass: 'F-1:1:70 F-1:1:46 F-1:1:54 F-1:1:38 F-1:1:66 F-1:1:44 F-1:1:52 F-1:1:36 G-1:1:68 G-1:1:42 G-1:1:50 G-1:1:34 D-1:1:58 D-1:1:40 D-1:1:48 D-1:1:32',
                lead: 'F-3:2:54 . Ab3:2:44 . C-4:2:58 . Bb3:2:48 . Ab3:2:46 . F-3:2:40 . Eb3:2:38 . F-3:2:50',
                arp: 'F-4:3:26 C-4:3:16 . Ab4:3:22 . F-4:3:20 C-4:3:12 . Ab4:3:18 . F-4:3:16 C-4:3:10 . Eb4:3:14'
            },
            {
                bass: 'A-1:1:78 A-1:1:54 A-1:1:62 A-1:1:46 A-1:1:74 A-1:1:52 E-1:1:66 E-1:1:44 A-1:1:76 A-1:1:50 A-1:1:60 A-1:1:42 G-1:1:64 G-1:1:46 E-1:1:58 E-1:1:40',
                lead: 'A-4:2:64 . C-5:2:52 . E-5:2:68 . G-5:2:56 . E-5:2:58 . C-5:2:48 . B-4:2:46 . A-4:2:60',
                arp: 'A-5:3:32 E-5:3:22 . C-6:3:28 . A-5:3:26 E-5:3:18 . C-6:3:24 . A-5:3:22 E-5:3:16 . G-5:3:20'
            }
        ]
    },

    /**
     * Amen-chop 16-step break (Jungle) — denser ragga chops.
     * k=kick, s=snare, h=hat, r=half-row roll.
     */
    amenBreak: [
        { k: 1 }, { h: 0.5, r: 0.65 }, { h: 0.8 }, { k: 0.6, h: 0.35 },
        { s: 1 }, { h: 0.45 }, { s: 0.7, r: 0.85 }, { k: 0.75 },
        { h: 0.6 }, { k: 0.65, h: 0.3 }, { s: 1, r: 0.75 }, { h: 0.65 },
        { k: 1 }, { s: 0.85, r: 0.95 }, { h: 0.8, r: 0.4 }, { s: 1 }
    ],

    /** Two-step / rolling DnB break — clear kick-snare, rolling hats. */
    dnbBreak: [
        { k: 1 }, { h: 0.55 }, { h: 0.4 }, { h: 0.5 },
        { s: 1 }, { h: 0.45 }, { k: 0.6, h: 0.35 }, { h: 0.55 },
        { h: 0.4 }, { h: 0.6 }, { s: 0.95 }, { h: 0.45 },
        { k: 1 }, { h: 0.5 }, { h: 0.4, r: 0.25 }, { s: 0.8 }
    ],

    /** Legacy hybrid map (kept for older callers). */
    jungleDnbBreak: [
        { k: 1 }, { h: 0.45, r: 0.5 }, { h: 0.65 }, { k: 0.5 },
        { s: 1 }, { h: 0.4 }, { k: 0.55, r: 0.4 }, { h: 0.5 },
        { h: 0.45 }, { k: 0.6 }, { s: 1, r: 0.6 }, { h: 0.55 },
        { k: 0.95 }, { h: 0.45 }, { s: 0.75, r: 0.55 }, { s: 0.9 }
    ],

    /**
     * Dark minimal techno kit: hard 4/4 kick, clap/snare on 2+4,
     * rolling closed hats — club pressure, not sparse ticks.
     */
    elektroBreak: [
        { k: 1 }, { h: 0.48 }, { h: 0.62 }, { h: 0.4 },
        { k: 1, s: 0.78 }, { h: 0.45 }, { h: 0.58 }, { h: 0.38 },
        { k: 1 }, { h: 0.5 }, { h: 0.65 }, { h: 0.42 },
        { k: 0.98, s: 0.85 }, { h: 0.48 }, { h: 0.55 }, { h: 0.36 }
    ],

    /** NIGHTRUN drive: pounding 4/4, snare on 2/4, tight hats. */
    driveBreak: [
        { k: 1 }, { h: 0.45 }, { s: 0.9, h: 0.3 }, { h: 0.4 },
        { k: 1 }, { h: 0.45 }, { s: 0.95, h: 0.3 }, { h: 0.4 },
        { k: 1 }, { h: 0.45 }, { s: 0.9, h: 0.3 }, { h: 0.4 },
        { k: 1 }, { h: 0.5 }, { s: 1, h: 0.35 }, { h: 0.45 }
    ],

    /**
     * Resolve theme channel cell for patternIndex / row / channel (0 bass,1 lead,2 arp).
     * Returns null to keep planet-authored cell (theme 0 / unknown).
     */
    cellAt(themeIndex, patternIndex, rowIndex, channel) {
        const id = this.idOf(themeIndex);
        if (!id || id === 'planet') return null;
        const bank = this._banks[id];
        if (!bank || !bank.length) return null;
        const pat = bank[Math.abs(patternIndex | 0) % bank.length];
        if (!pat) return null;
        const key = channel === 0 ? 'bass' : channel === 1 ? 'lead' : channel === 2 ? 'arp' : null;
        if (!key || !pat[key]) return null;
        if (typeof VFTrackerParse === 'undefined' || !VFTrackerParse.expandChannelString) return null;
        const padded = VFTrackerParse.padChannelString
            ? VFTrackerParse.padChannelString(pat[key], 16)
            : pat[key];
        const cells = VFTrackerParse.expandChannelString(padded, 16);
        return cells[rowIndex % 16] || null;
    }
};
