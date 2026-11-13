"use strict";

/**
 * Built-in vftracks — oriented on Volley Fire (GB, 1990 / Akihiko Mori):
 * clear pulse hooks, wave bass ostinato, sparse harmony, noise hats.
 * Original melodies inspired by that era's Toei GB shooter feel (not a rip).
 * Role map ≈ GB OST: Title→intro, Planet Select→menu, Main BGM→ingame,
 * Map / Victory / Lose / Shop = per-planet Hauptmelodien (styles interpret them).
 * Boss keys (`mars-boss` …) own separate siege melodies — not combat remixes.
 */
const VFTrackerDefaults = {
    /** Playback roles that own a distinct Hauptmelodie per planet. */
    ROLES: ['ingame', 'map', 'victory', 'lose', 'shop', 'boss'],
    /** Game Boy-ish voices: wave bass, two pulses, noise. */
    _baseInstruments() {
        return [
            { id: 1, name: 'wave', wave: 'triangle', volume: 0.68, attack: 0.001, decay: 0.04, sustain: 0.58, release: 0.06, filter: 1800 },
            // Lead must read above arp — pulse1 was quieter than pulse2 and buried the hook.
            { id: 2, name: 'pulse1', wave: 'square', volume: 0.44, attack: 0.001, decay: 0.05, sustain: 0.36, release: 0.08, filter: 2600 },
            { id: 3, name: 'pulse2', wave: 'square', volume: 0.32, attack: 0.001, decay: 0.03, sustain: 0.28, release: 0.05, filter: 2200 },
            { id: 4, name: 'noise', wave: 'noise', volume: 0.28, attack: 0.001, decay: 0.025, sustain: 0.01, release: 0.02 },
            { id: 5, name: 'kick', wave: 'triangle', volume: 0.74, attack: 0.001, decay: 0.07, sustain: 0.05, release: 0.04, filter: 400 }
        ];
    },

    _track(meta, bpm, patterns, order, loop) {
        return {
            format: 'vftrack',
            version: 1,
            meta: Object.assign({ author: 'VF Tracker · GB-style' }, meta),
            bpm,
            rowsPerBeat: 1,
            rowsPerPattern: 16,
            channels: 4,
            instruments: this._baseInstruments(),
            patterns,
            order,
            loop: loop !== false
        };
    },

    _pat(id, bass, lead, arp, drums) {
        const pad = (s) => (typeof VFTrackerParse !== 'undefined' && VFTrackerParse.padChannelString
            ? VFTrackerParse.padChannelString(s, 16)
            : s);
        return { id: id, channels: [pad(bass), pad(lead), pad(arp), pad(drums)] };
    },

    /**
     * Motivic writing rules (all planet tracks):
     *   P0 = state the head motif (lead) over a locked bass ostinato
     *   P1 = same rhythm, motif sequenced to the relative / IV area
     *   P2 = motif climax (octave / extension) then cadence home
     * Lead answers itself — never random walks.
     */

    // Mars — A-minor call/answer hook (E-C-A | E-D-C | A). Combat workhorse.
    mars() {
        return this._track(
            { title: 'Main Orbit 1', planet: 'mars', notes: 'call E-C-A · answer E-D-C · land A' },
            128,
            [
                this._pat(0,
                    'A-2:1:60 . A-2:1:42 . A-2:1:56 . E-2:1:46 . A-2:1:60 . A-2:1:40 . G-2:1:50 . E-2:1:38',
                    'E-5:2:54 . C-5:2:40 . A-4:2:48 . E-5:2:56 . D-5:2:44 . C-5:2:40 . A-4:2:46 . A-4:2:52',
                    'A-3:3:14 . . . E-4:3:12 . . . A-3:3:14 . . . C-4:3:10 . . .',
                    'A-2:5:66 . A-4:4:16 . A-2:5:52 . A-4:4:12 A-2:5:64 . A-4:4:16 . A-2:5:48 A-4:4:10 . .'
                ),
                this._pat(1,
                    'F-2:1:54 . F-2:1:38 . F-2:1:52 . C-2:1:42 . G-2:1:54 . G-2:1:38 . E-2:1:48 . G-2:1:36',
                    'C-5:2:50 . A-4:2:36 . F-4:2:44 . C-5:2:52 . Bb4:2:40 . A-4:2:36 . G-4:2:38 . F-4:2:46',
                    'C-4:3:12 . . . F-4:3:10 . . . D-4:3:12 . . . G-4:3:10 . . .',
                    'F-2:5:60 . A-4:4:14 . F-2:5:46 . A-4:4:10 G-2:5:60 . A-4:4:14 . G-2:5:44 A-4:4:08 . .'
                ),
                this._pat(2,
                    'A-2:1:62 . A-2:1:44 . C-3:1:52 . E-2:1:48 . A-2:1:62 . A-2:1:42 . G-2:1:54 . E-2:1:40',
                    'A-5:2:56 . E-5:2:42 . C-5:2:48 . A-5:2:58 . G-5:2:46 . E-5:2:40 . C-5:2:44 . A-4:2:52',
                    'E-4:3:16 . A-4:3:10 . . E-4:3:14 . C-5:3:18 . A-4:3:10 . E-4:3:12 . A-4:3:08',
                    'A-2:5:72 A-4:4:18 . A-4:4:12 A-2:5:56 . A-4:4:14 . A-2:5:68 A-4:4:16 . A-4:4:10 A-2:5:50 A-4:4:12 .'
                )
            ],
            [0, 0, 1, 0, 2, 1, 0, 0]
        );
    },

    // Jupiter — E-minor bounce: offbeat lead leaps, sparse bass punches.
    jupiter() {
        return this._track(
            { title: 'Main Orbit 2', planet: 'jupiter', notes: 'bounce E-G-B · fall A-G-E · tag D-E' },
            120,
            [
                this._pat(0,
                    'E-2:1:56 . . E-2:1:40 . B-1:1:48 . E-2:1:54 . . B-1:1:42 . E-2:1:50 . B-1:1:36 .',
                    '. E-4:2:48 . G-4:2:38 . B-4:2:54 . A-4:2:42 . G-4:2:40 . E-4:2:44 . D-4:2:36 E-4:2:48',
                    '. . B-3:3:14 . . . E-4:3:12 . . . B-3:3:12 . . . E-4:3:10 .',
                    'E-2:5:60 . . A-4:4:12 . E-2:5:48 . A-4:4:10 . E-2:5:56 . . A-4:4:12 . E-2:5:44 .'
                ),
                this._pat(1,
                    'C-3:1:52 . . C-3:1:36 . G-2:1:44 . D-3:1:50 . . B-1:1:38 . C-3:1:46 . G-2:1:32 .',
                    '. C-5:2:44 . E-5:2:34 . G-5:2:50 . F-5:2:38 . E-5:2:36 . C-5:2:40 . B-4:2:32 C-5:2:44',
                    '. . G-4:3:12 . . . C-5:3:10 . . . A-4:3:12 . . . D-5:3:08 .',
                    'C-3:5:54 . . A-4:4:10 . C-3:5:42 . A-4:4:08 . D-3:5:50 . . A-4:4:10 . D-3:5:38 .'
                ),
                this._pat(2,
                    'E-2:1:60 . E-2:1:42 . G-2:1:50 . B-1:1:46 . E-2:1:60 . E-2:1:40 . D-2:1:52 . B-1:1:38',
                    'E-5:2:54 . G-5:2:42 . B-5:2:58 . A-5:2:46 . G-5:2:44 . E-5:2:38 . D-5:2:40 . E-5:2:50',
                    'E-4:3:16 . . B-3:3:10 E-4:3:14 . G-4:3:18 . . E-4:3:12 . D-4:3:10 . B-3:3:08',
                    'E-2:5:66 A-4:4:16 . A-4:4:10 E-2:5:52 . A-4:4:12 . E-2:5:62 A-4:4:14 . A-4:4:08 E-2:5:46 A-4:4:10 .'
                )
            ],
            [0, 0, 1, 0, 2, 0, 1, 0]
        );
    },

    // Saturn — D-minor gallop: short-short-long lead over driving bass.
    saturn() {
        return this._track(
            { title: 'Main Orbit 3', planet: 'saturn', notes: 'gallop D-F-A · snap G-F · home D' },
            136,
            [
                this._pat(0,
                    'D-2:1:58 D-2:1:36 . D-2:1:54 . A-1:1:44 . D-2:1:58 D-2:1:36 . A-1:1:48 . A-1:1:34',
                    'D-4:2:46 F-4:2:34 . A-4:2:54 . G-4:2:42 . F-4:2:40 D-4:2:32 . C-4:2:36 . D-4:2:48',
                    'A-3:3:14 . . . D-4:3:12 . . . A-3:3:14 . . . D-4:3:10 . . .',
                    'D-2:5:66 A-4:4:16 D-2:5:42 A-4:4:10 D-2:5:60 A-4:4:14 . D-2:5:66 A-4:4:16 D-2:5:40 A-4:4:10 D-2:5:52 A-4:4:12 .'
                ),
                this._pat(1,
                    'G-1:1:54 G-1:1:34 . G-1:1:50 . D-1:1:40 . Bb1:1:54 Bb1:1:34 . F-2:1:46 . Bb1:1:32',
                    'G-3:2:42 Bb3:2:30 . D-4:2:50 . C-4:2:38 . Bb3:2:36 G-3:2:28 . A-3:2:32 . G-3:2:44',
                    'D-3:3:12 . . . G-3:3:10 . . . F-3:3:12 . . . Bb3:3:10 . . .',
                    'G-1:5:62 A-4:4:14 G-1:5:40 A-4:4:08 Bb1:5:58 A-4:4:12 . Bb1:5:62 A-4:4:14 Bb1:5:38 A-4:4:08 Bb1:5:50 A-4:4:10 .'
                ),
                this._pat(2,
                    'D-2:1:62 . D-2:1:42 . F-2:1:52 . A-1:1:46 . D-2:1:62 . D-2:1:40 . C-2:1:54 . A-1:1:38',
                    'D-5:2:54 . F-5:2:42 . A-5:2:58 . G-5:2:46 . F-5:2:44 . D-5:2:38 . C-5:2:40 . D-5:2:50',
                    'D-4:3:16 . A-3:3:10 . . D-4:3:14 . F-4:3:18 . A-3:3:10 . D-4:3:12 . A-3:3:08',
                    'D-2:5:72 A-4:4:18 . A-4:4:10 D-2:5:56 A-4:4:14 A-4:4:08 . D-2:5:68 A-4:4:16 . A-4:4:08 D-2:5:50 A-4:4:10 .'
                )
            ],
            [0, 0, 1, 0, 2, 1, 0, 0]
        );
    },

    // Neptune — B-minor ice: long held tones, wide gaps, cold answer.
    neptune() {
        return this._track(
            { title: 'Ice Lane', planet: 'neptune', notes: 'hold B · rise D-F# · fall E-B' },
            108,
            [
                this._pat(0,
                    'B-1:1:52 . . . F#1:1:40 . . . B-1:1:48 . . . F#1:1:36 . . .',
                    'B-3:2:46 . . . D-4:2:36 . F#4:2:50 . E-4:2:38 . . B-3:2:42 . . .',
                    'F#3:3:12 . . . . . . . B-3:3:10 . . . . . . .',
                    '. . A-4:4:10 . . . B-1:5:46 . . . A-4:4:08 . . B-1:5:40 .'
                ),
                this._pat(1,
                    'G-1:1:46 . . . D-1:1:34 . . . A-1:1:44 . . . E-1:1:32 . . .',
                    'G-3:2:40 . . . B-3:2:30 . D-4:2:46 . C-4:2:34 . . G-3:2:38 . . .',
                    'D-3:3:10 . . . . . . . G-3:3:08 . . . . . . .',
                    '. . A-4:4:08 . . . G-1:5:40 . . . A-4:4:06 . . A-1:5:36 .'
                ),
                this._pat(2,
                    'B-1:1:56 . . F#1:1:42 . . A-1:1:46 . . B-1:1:54 . . F#1:1:38 . E-1:1:34 .',
                    'B-4:2:50 . . D-5:2:40 . F#5:2:56 . E-5:2:44 . D-5:2:42 . B-4:2:38 . B-4:2:48',
                    'B-3:3:14 . . F#3:3:10 . . B-3:3:12 . . D-4:3:16 . . F#3:3:08 . B-3:3:10 .',
                    'B-1:5:52 . . A-4:4:12 . B-1:5:42 . A-4:4:08 . B-1:5:48 . A-4:4:10 . . . .'
                )
            ],
            [0, 0, 1, 0, 2, 1, 0, 0]
        );
    },

    // Pluto — C-minor stab: three hits then silence, urgent return.
    pluto() {
        return this._track(
            { title: 'Kuiper Rush', planet: 'pluto', notes: 'stab C-Eb-G · gap · snap F-C' },
            144,
            [
                this._pat(0,
                    'C-2:1:60 C-2:1:40 . C-2:1:54 . G-1:1:46 . . C-2:1:58 C-2:1:38 . G-1:1:44 . . .',
                    'C-4:2:52 Eb4:2:40 G-4:2:56 . F-4:2:44 . . C-4:2:48 Bb3:2:36 C-4:2:50 . . .',
                    'G-3:3:16 C-4:3:10 . . C-4:3:12 . . . G-3:3:14 . C-4:3:10 . . . .',
                    'C-2:5:70 A-4:4:18 C-2:5:44 . C-2:5:62 A-4:4:14 . . C-2:5:68 A-4:4:16 C-2:5:40 . C-2:5:54 .'
                ),
                this._pat(1,
                    'Ab1:1:54 Ab1:1:36 . Ab1:1:50 . Eb1:1:40 . . Bb1:1:54 Bb1:1:34 . F-2:1:46 . . .',
                    'Ab3:2:46 C-4:2:34 Eb4:2:50 . D-4:2:38 . . Bb3:2:44 Ab3:2:30 Bb3:2:42 . . .',
                    'Eb3:3:14 Ab3:3:08 . . Ab3:3:10 . . . F-3:3:12 . Bb3:3:08 . . . .',
                    'Ab1:5:64 A-4:4:14 Ab1:5:40 . Bb1:5:60 A-4:4:12 . . Bb1:5:64 A-4:4:14 Bb1:5:38 . Bb1:5:50 .'
                ),
                this._pat(2,
                    'C-2:1:64 . C-2:1:44 . Eb2:1:54 . G-1:1:48 . C-2:1:64 . C-2:1:42 . Bb1:1:54 . G-1:1:40',
                    'C-5:2:56 . Eb5:2:44 . G-5:2:60 . F-5:2:48 . Eb5:2:46 . C-5:2:40 . Bb4:2:42 . C-5:2:52',
                    'C-4:3:18 . G-3:3:12 . . C-4:3:16 . Eb4:3:20 . G-3:3:10 . C-4:3:14 . G-3:3:08',
                    'C-2:5:76 A-4:4:20 . A-4:4:12 C-2:5:58 A-4:4:14 A-4:4:08 . C-2:5:72 A-4:4:18 . A-4:4:10 C-2:5:52 A-4:4:12 .'
                )
            ],
            [0, 0, 1, 0, 2, 1, 0, 0]
        );
    },

    /**
     * Title fanfare = planet head motif once, then cadence. Same DNA as combat.
     */
    intro(planetId) {
        const id = this.normalizePlanetKey
            ? this.normalizePlanetKey(planetId)
            : String(planetId || 'mars').toLowerCase().split('-')[0];
        if (this.isHandcraftedPlanet && !this.isHandcraftedPlanet(id)) {
            return this.remixPlanet(id, { intro: true });
        }
        // Combat track → take P0 lead motif as fanfare body.
        const combat = typeof this[id] === 'function' ? this[id]() : this.mars();
        const p0 = (combat.patterns && combat.patterns[0]) || { channels: [] };
        const ch = p0.channels || [];
        const bass = ch[0] || 'A-2:1:56 . A-2:1:40 . A-2:1:56 . E-2:1:44 . A-2:1:56 . A-2:1:40 . E-2:1:48 . E-2:1:36';
        const lead = ch[1] || 'A-4:2:48 . C-5:2:40 . E-5:2:52 . D-5:2:44 . C-5:2:46 . A-4:2:38 . G-4:2:40 . A-4:2:44';
        const arp = ch[2] || 'E-4:3:16 . . . A-4:3:14 . . . E-4:3:16 . . . A-4:3:14 . . .';
        const drums = ch[3] || 'A-2:5:64 . A-4:4:16 . A-2:5:50 . A-4:4:12 A-2:5:64 . A-4:4:16 . A-2:5:48 A-4:4:10 . .';
        // Cadence: hold tonic, resolve lead to root.
        const cadenceBass = {
            mars: 'A-2:1:60 . . A-2:1:44 . E-2:1:48 . . A-2:1:52 . . E-2:1:40 . A-2:1:56 . OFF .',
            jupiter: 'E-2:1:58 . . E-2:1:42 . B-1:1:46 . . E-2:1:50 . . B-1:1:38 . E-2:1:54 . OFF .',
            saturn: 'D-2:1:60 . . D-2:1:44 . A-1:1:48 . . D-2:1:52 . . A-1:1:40 . D-2:1:56 . OFF .',
            neptune: 'B-1:1:54 . . B-1:1:40 . F#1:1:44 . . B-1:1:48 . . F#1:1:36 . B-1:1:52 . OFF .',
            pluto: 'C-2:1:60 . . C-2:1:44 . G-1:1:48 . . C-2:1:52 . . G-1:1:40 . C-2:1:56 . OFF .'
        };
        const cadenceLead = {
            mars: 'A-5:2:52 . . E-5:2:44 . C-5:2:46 . . A-4:2:50 . . E-4:2:40 . A-4:2:54 . OFF .',
            jupiter: 'E-5:2:50 . . B-4:2:42 . G-4:2:44 . . E-4:2:48 . . B-3:2:38 . E-4:2:52 . OFF .',
            saturn: 'D-5:2:52 . . A-4:2:44 . F-4:2:46 . . D-4:2:50 . . A-3:2:40 . D-4:2:54 . OFF .',
            neptune: 'B-4:2:48 . . F#4:2:40 . D-4:2:42 . . B-3:2:46 . . F#3:2:36 . B-3:2:50 . OFF .',
            pluto: 'C-5:2:52 . . G-4:2:44 . Eb4:2:46 . . C-4:2:50 . . G-3:2:40 . C-4:2:54 . OFF .'
        };
        const cBass = cadenceBass[id] || cadenceBass.mars;
        const cLead = cadenceLead[id] || cadenceLead.mars;
        return this._track(
            { title: 'Title · ' + id, planet: id, notes: 'fanfare = combat motif + cadence' },
            Math.min(156, (combat.bpm || 132) + 12),
            [
                this._pat(0, bass, lead, arp, drums),
                this._pat(1, cBass, cLead, arp, drums)
            ],
            [0, 1],
            false
        );
    },

    /**
     * Start Screen / Planet Select hub — C-major call/answer (type `screen`).
     * Call C-E-G | answer A-G-E | home C. Bright dock motif, not a combat hook.
     */
    menu() {
        return this._track(
            { title: 'Start Screen', planet: 'menu', role: 'screen', notes: 'call C-E-G · answer A-G-E · home C' },
            118,
            [
                this._pat(0,
                    'C-2:1:54 . C-2:1:38 . C-2:1:52 . G-1:1:42 . C-2:1:54 . C-2:1:36 . G-1:1:46 . G-1:1:34',
                    'C-5:2:50 . E-5:2:38 . G-5:2:56 . E-5:2:44 . A-4:2:42 . G-4:2:36 . E-4:2:40 . C-5:2:48',
                    'G-4:3:14 . . . C-5:3:12 . . . G-4:3:14 . . . E-4:3:10 . . .',
                    'C-2:5:60 . A-4:4:12 . C-2:5:46 . A-4:4:08 C-2:5:58 . A-4:4:12 . C-2:5:42 A-4:4:06 . .'
                ),
                this._pat(1,
                    'A-1:1:50 . A-1:1:34 . A-1:1:48 . E-1:1:40 . A-1:1:50 . A-1:1:34 . E-1:1:42 . E-1:1:32',
                    'A-4:2:46 . C-5:2:34 . E-5:2:52 . C-5:2:40 . G-4:2:38 . E-4:2:32 . D-4:2:34 . A-4:2:44',
                    'E-4:3:12 . . . A-4:3:10 . . . E-4:3:12 . . . C-4:3:08 . . .',
                    'A-1:5:56 . A-4:4:10 . A-1:5:42 . A-4:4:06 A-1:5:54 . A-4:4:10 . A-1:5:38 A-4:4:05 . .'
                ),
                this._pat(2,
                    'C-2:1:58 . C-2:1:40 . E-2:1:50 . G-1:1:46 . C-2:1:58 . C-2:1:38 . G-2:1:52 . E-2:1:36',
                    'C-6:2:54 . E-6:2:42 . G-6:2:58 . A-5:2:46 . G-5:2:44 . E-5:2:38 . C-5:2:40 . C-5:2:50',
                    'C-5:3:16 . G-4:3:10 . . C-5:3:14 . E-5:3:18 . G-4:3:10 . C-5:3:12 . G-4:3:08',
                    'C-2:5:64 A-4:4:14 . A-4:4:08 C-2:5:50 . A-4:4:10 . C-2:5:60 A-4:4:12 . A-4:4:06 C-2:5:44 A-4:4:08 .'
                )
            ],
            [0, 0, 1, 0, 2, 1, 0, 0]
        );
    },

    /**
     * Global title-screen fanfare — one-shot cinematic open (type `screen`),
     * slower and broader than the Start Screen hub loop (`menu`).
     */
    titleIntro() {
        return this._track(
            { title: 'Title Fanfare', planet: 'menu', role: 'screen', notes: 'cinematic swell · held call · resolve home' },
            108,
            [
                this._pat(0,
                    'C-2:1:40 . . . . . G-1:1:36 . . . . . C-2:1:44 . . .',
                    'C-4:2:36 . . E-4:2:40 . . G-4:2:46 . . C-5:2:52 . . . E-5:2:48 .',
                    '. . . . E-4:3:10 . . . G-4:3:12 . . . C-5:3:14 . . .',
                    '. . . . . . . . . . . . . . . .'
                ),
                this._pat(1,
                    'C-2:1:58 . . C-2:1:42 . G-2:1:50 . . C-3:1:54 . . G-2:1:46 . C-2:1:60 . . .',
                    'G-5:2:54 . E-5:2:48 . C-5:2:52 . G-4:2:44 . C-6:2:62 . G-5:2:50 . E-5:2:46 . C-5:2:56',
                    'C-5:3:16 . . G-4:3:12 . . E-4:3:14 . . C-5:3:18 . . G-4:3:12 . . .',
                    '. . A-4:4:14 . . . A-4:4:16 . . . A-4:4:18 . . A-4:4:12 . .'
                ),
                this._pat(2,
                    'C-2:1:64 . . . G-1:1:48 . . C-2:1:70 . . . . G-1:1:40 . C-2:1:72 . OFF .',
                    'C-6:2:66 . . G-5:2:52 . E-5:2:48 . C-5:2:58 . . G-4:2:44 . C-4:2:64 . OFF .',
                    'G-4:3:18 . E-4:3:14 . C-4:3:16 . . . . . . . . . . .',
                    'C-2:5:70 . A-4:4:18 . . C-2:5:56 A-4:4:14 . . C-2:5:62 . . . . OFF .'
                )
            ],
            [0, 1, 2],
            false
        );
    },

    /** Lead-motif pitch names from planet combat P0 (Hauptmelodie DNA). */
    _motifPitches(planetId, galaxyId) {
        const id = this.normalizePlanetKey(planetId);
        let combat;
        if (this.isHandcraftedPlanet && this.isHandcraftedPlanet(id) && typeof this[id] === 'function') {
            combat = this[id]();
        } else if (typeof this.forPlanet === 'function') {
            combat = this.forPlanet(id, galaxyId);
        } else {
            combat = this.mars();
        }
        const lead = (((combat.patterns || [])[0] || {}).channels || [])[1] || '';
        const pitches = [];
        String(lead).trim().split(/\s+/).forEach((tok) => {
            if (!tok || tok === '.') return;
            const cell = (typeof VFTrackerParse !== 'undefined' && VFTrackerParse.parseCell)
                ? VFTrackerParse.parseCell(tok) : null;
            if (cell && cell.note && cell.note !== 'OFF') pitches.push(cell.note);
        });
        return pitches.length ? pitches : ['A-4', 'C-5', 'E-5', 'D-5'];
    },

    _rootBass(note) {
        if (!note || typeof VFTrackerParse === 'undefined') return 'A-2';
        const midi = VFTrackerParse.noteToMidi(note);
        if (midi == null || midi === 'OFF') return 'A-2';
        return VFTrackerParse.midiToNote(midi - 24) || 'A-2';
    },

    _shiftNote(note, semi) {
        if (!note || typeof VFTrackerParse === 'undefined') return note;
        const midi = VFTrackerParse.noteToMidi(note);
        if (midi == null || midi === 'OFF') return note;
        return VFTrackerParse.midiToNote(midi + (Number(semi) || 0)) || note;
    },

    /**
     * Rebuild role arrangements from planet motif pitches — not a thin combat remix.
     * map = ambient orbit · victory = call/answer fanfare · lose = descending fade ·
     * shop = mid-tempo bazaar groove.
     */
    _roleFromPlanet(planetId, role, galaxyId) {
        const id = this.normalizePlanetKey(planetId);
        const m = this._motifPitches(id, galaxyId);
        // Procedural planets can share donor+key (40 remix slots) — salt the
        // role arrangement so map/shop/victory hops never replay identical notes.
        const salt = (this.isHandcraftedPlanet && this.isHandcraftedPlanet(id))
            ? 0
            : (((this._hash32(String(galaxyId || '') + '|' + id + '|' + role) % 11) - 5) || 0);
        const sh = (n) => (salt ? this._shiftNote(n, salt) : n);
        const a = sh(m[0]); const b = sh(m[1] || m[0]); const c = sh(m[2] || m[0]);
        const d = sh(m[3] || m[1] || m[0]); const e = sh(m[4] || m[2] || m[0]);
        const f = sh(m[5] || m[1] || m[0]); const g = sh(m[6] || m[3] || m[0]);
        const h = sh(m[7] || m[0]);
        const root = this._rootBass(a);
        const fifth = this._shiftNote(root, 7);
        const tok = (note, inst, vol) => note + ':' + inst + ':' + vol;
        let patterns;
        let bpm;
        let order;
        if (role === 'map') {
            // Ambient: held bass, lead only on bar anchors, almost no kit.
            patterns = [
                this._pat(0,
                    [tok(root, 1, 48), '.', '.', '.', tok(root, 1, 36), '.', '.', '.',
                        tok(fifth, 1, 42), '.', '.', '.', tok(root, 1, 32), '.', '.', '.'].join(' '),
                    [tok(a, 2, 36), '.', '.', '.', '.', '.', '.', '.',
                        tok(c, 2, 30), '.', '.', '.', '.', '.', '.', '.'].join(' '),
                    [tok(this._shiftNote(a, 12) || a, 3, 12), '.', '.', '.', '.', '.', '.', '.',
                        tok(this._shiftNote(c, 12) || c, 3, 10), '.', '.', '.', '.', '.', '.', '.'].join(' '),
                    ['.', '.', tok('A-4', 4, 8), '.', '.', '.', '.', '.',
                        '.', '.', tok('A-4', 4, 6), '.', '.', '.', '.', '.'].join(' ')
                ),
                this._pat(1,
                    [tok(fifth, 1, 44), '.', '.', '.', tok(root, 1, 34), '.', '.', '.',
                        tok(this._shiftNote(root, 5) || fifth, 1, 40), '.', '.', '.', tok(root, 1, 30), '.', '.', '.'].join(' '),
                    [tok(e, 2, 32), '.', '.', '.', '.', '.', '.', '.',
                        tok(g, 2, 28), '.', '.', '.', '.', '.', '.', '.'].join(' '),
                    ['.', '.', '.', '.', tok(this._shiftNote(e, 12) || e, 3, 10), '.', '.', '.',
                        '.', '.', '.', '.', tok(this._shiftNote(a, 12) || a, 3, 8), '.', '.', '.'].join(' '),
                    ['.', '.', '.', '.', '.', '.', tok('A-4', 4, 6), '.',
                        '.', '.', '.', '.', '.', '.', '.', '.'].join(' ')
                )
            ];
            bpm = 96;
            order = [0, 0, 1, 0, 1, 0, 0, 1];
        } else if (role === 'victory') {
            // Fanfare: rising call / answer, dense kick, octave climax.
            const up = (n) => this._shiftNote(n, 12) || n;
            patterns = [
                this._pat(0,
                    [tok(root, 1, 64), '.', tok(root, 1, 48), '.', tok(fifth, 1, 56), '.', tok(root, 1, 44), '.',
                        tok(root, 1, 62), '.', tok(fifth, 1, 50), '.', tok(root, 1, 58), '.', tok(fifth, 1, 40), '.'].join(' '),
                    [tok(a, 2, 54), tok(b, 2, 46), tok(c, 2, 58), tok(d, 2, 50),
                        '.', tok(a, 2, 42), '.', '.',
                        tok(c, 2, 56), tok(d, 2, 48), tok(e, 2, 60), tok(f, 2, 52),
                        '.', tok(c, 2, 44), '.', '.'].join(' '),
                    [tok(c, 3, 22), '.', tok(a, 3, 16), '.', tok(e, 3, 20), '.', tok(c, 3, 14), '.',
                        tok(c, 3, 22), '.', tok(a, 3, 16), '.', tok(e, 3, 20), '.', tok(c, 3, 14), '.'].join(' '),
                    [tok(root, 5, 72), '.', tok('A-4', 4, 24), '.', tok(root, 5, 58), '.', tok('A-4', 4, 18), '.',
                        tok(root, 5, 72), '.', tok('A-4', 4, 24), '.', tok(root, 5, 54), tok('A-4', 4, 16), '.', '.'].join(' ')
                ),
                this._pat(1,
                    [tok(fifth, 1, 60), '.', tok(root, 1, 52), '.', tok(fifth, 1, 58), '.', tok(this._shiftNote(root, 12) || root, 1, 50), '.',
                        tok(root, 1, 64), '.', tok(fifth, 1, 54), '.', tok(root, 1, 60), '.', 'OFF', '.'].join(' '),
                    [tok(up(a), 2, 58), tok(up(b), 2, 50), tok(up(c), 2, 62), tok(up(d), 2, 54),
                        tok(up(e), 2, 60), tok(up(f), 2, 52), tok(up(g), 2, 56), tok(up(h), 2, 48),
                        tok(up(c), 2, 64), '.', tok(up(a), 2, 54), '.', tok(up(a), 2, 58), '.', 'OFF', '.'].join(' '),
                    [tok(up(c), 3, 24), tok(up(a), 3, 16), tok(up(e), 3, 22), tok(up(c), 3, 14),
                        tok(up(c), 3, 24), tok(up(a), 3, 16), tok(up(e), 3, 22), tok(up(c), 3, 14),
                        tok(up(a), 3, 26), '.', tok(up(c), 3, 18), '.', tok(up(a), 3, 20), '.', '.', '.'].join(' '),
                    [tok(root, 5, 76), tok('A-4', 4, 22), tok(root, 5, 50), tok('A-4', 4, 16),
                        tok(root, 5, 70), tok('A-4', 4, 20), tok(root, 5, 48), tok('A-4', 4, 14),
                        tok(root, 5, 78), '.', tok('A-4', 4, 26), '.', tok(root, 5, 60), tok('A-4', 4, 18), '.', '.'].join(' ')
                )
            ];
            bpm = 138;
            order = [0, 0, 1, 0, 1, 0];
        } else if (role === 'shop') {
            // Bazaar: mid-tempo swing, sparse kit, motif as trade call.
            patterns = [
                this._pat(0,
                    [tok(root, 1, 46), '.', tok(root, 1, 28), '.', tok(fifth, 1, 40), '.', tok(root, 1, 24), '.',
                        tok(root, 1, 44), '.', tok(fifth, 1, 30), '.', tok(root, 1, 36), '.', tok(fifth, 1, 22), '.'].join(' '),
                    [tok(a, 2, 36), '.', '.', tok(b, 2, 28), '.', tok(c, 2, 34), '.', '.',
                        tok(d, 2, 32), '.', '.', tok(c, 2, 26), '.', tok(a, 2, 30), '.', '.'].join(' '),
                    [tok(this._shiftNote(a, 12) || a, 3, 12), '.', tok(c, 3, 8), '.', '.', tok(a, 3, 10), '.', '.',
                        tok(e, 3, 12), '.', tok(c, 3, 8), '.', '.', tok(a, 3, 9), '.', '.'].join(' '),
                    [tok(root, 5, 42), '.', tok('A-4', 4, 10), '.', tok(root, 5, 28), '.', '.', tok('A-4', 4, 8),
                        tok(root, 5, 40), '.', tok('A-4', 4, 10), '.', tok(root, 5, 26), '.', '.', '.'].join(' ')
                ),
                this._pat(1,
                    [tok(fifth, 1, 42), '.', tok(root, 1, 26), '.', tok(fifth, 1, 38), '.', tok(this._shiftNote(root, 5) || fifth, 1, 24), '.',
                        tok(root, 1, 44), '.', tok(fifth, 1, 28), '.', tok(root, 1, 34), '.', 'OFF', '.'].join(' '),
                    [tok(e, 2, 34), '.', tok(f, 2, 26), '.', tok(g, 2, 32), '.', tok(h, 2, 24), '.',
                        tok(c, 2, 36), '.', tok(a, 2, 28), '.', tok(b, 2, 30), '.', '.', '.'].join(' '),
                    ['.', tok(this._shiftNote(e, 12) || e, 3, 10), '.', '.', tok(c, 3, 8), '.', '.', tok(a, 3, 9),
                        '.', tok(this._shiftNote(c, 12) || c, 3, 10), '.', '.', tok(a, 3, 8), '.', '.', '.'].join(' '),
                    ['.', tok(root, 5, 30), '.', tok('A-4', 4, 8), '.', tok(root, 5, 36), '.', tok('A-4', 4, 6),
                        '.', tok(root, 5, 28), '.', '.', tok('A-4', 4, 8), '.', '.', '.'].join(' ')
                )
            ];
            bpm = 108;
            order = [0, 0, 1, 0, 1, 0, 0, 1];
        } else {
            // Lose: descending, half-time, hollow kit.
            const down = (n, s) => this._shiftNote(n, s) || n;
            patterns = [
                this._pat(0,
                    [tok(root, 1, 44), '.', '.', '.', tok(root, 1, 30), '.', '.', '.',
                        tok(down(root, -2), 1, 36), '.', '.', '.', tok(down(root, -5), 1, 26), '.', '.', '.'].join(' '),
                    [tok(a, 2, 34), '.', '.', tok(down(a, -2), 2, 28), '.', '.', tok(down(a, -5), 2, 24), '.',
                        '.', tok(down(a, -7), 2, 20), '.', '.', '.', '.', '.', '.'].join(' '),
                    [tok(down(c, -12), 3, 12), '.', '.', '.', tok(down(a, -12), 3, 8), '.', '.', '.',
                        tok(down(e, -12), 3, 10), '.', '.', '.', '.', '.', '.', '.'].join(' '),
                    [tok(root, 5, 40), '.', '.', tok('A-4', 4, 8), '.', '.', '.', '.',
                        tok(root, 5, 30), '.', '.', '.', '.', '.', '.', '.'].join(' ')
                ),
                this._pat(1,
                    [tok(down(root, -5), 1, 38), '.', '.', '.', tok(down(root, -7), 1, 26), '.', '.', '.',
                        tok(down(root, -12), 1, 32), '.', '.', '.', tok(down(root, -12), 1, 20), '.', 'OFF', '.'].join(' '),
                    [tok(down(c, -5), 2, 28), '.', '.', '.', tok(down(a, -7), 2, 22), '.', '.', '.',
                        tok(down(a, -12), 2, 18), '.', '.', '.', '.', '.', 'OFF', '.'].join(' '),
                    ['.', '.', tok(down(a, -12), 3, 8), '.', '.', '.', '.', '.',
                        '.', '.', tok(down(e, -12), 3, 6), '.', '.', '.', '.', '.'].join(' '),
                    ['.', '.', '.', '.', tok(root, 5, 28), '.', tok('A-4', 4, 6), '.',
                        '.', '.', '.', '.', '.', '.', '.', '.'].join(' ')
                )
            ];
            bpm = 78;
            order = [0, 1, 0, 0, 1, 0];
        }
        const titles = {
            map: 'Map · ' + id,
            victory: 'Victory · ' + id,
            lose: 'Defeat · ' + id,
            shop: 'Shop · ' + id
        };
        const notes = {
            map: 'map role = ambient orbit from motif',
            victory: 'victory role = fanfare from motif',
            lose: 'lose role = descending fade from motif',
            shop: 'shop role = bazaar groove from motif'
        };
        return this._track(
            {
                title: titles[role] || (id + ' · ' + role),
                planet: id,
                role: role,
                notes: notes[role] || role
            },
            bpm,
            patterns,
            order
        );
    },

    /** Galaxy map BGM — per-planet Hauptmelodie, soft arrangement. */
    map(planetId, galaxyId) {
        return this._roleFromPlanet(planetId || 'mars', 'map', galaxyId);
    },

    /** Pure space / between-planets map ambience — no planet motif, galaxy-toned drone. */
    mapVoid(galaxyId) {
        const faction = (typeof VFTrackerFactionCompose !== 'undefined' && galaxyId
            && typeof planetConfigManager !== 'undefined' && planetConfigManager.getGalaxy
            && planetConfigManager.getGalaxy(galaxyId))
            ? planetConfigManager.getGalaxy(galaxyId).faction
            : '';
        const roots = {
            terran: 'G-1', kronax: 'E-1', voidborn: 'B-1', pirate: 'D-1', machine: 'C-2'
        };
        const root = roots[faction] || 'A-1';
        const fifth = this._shiftNote(root, 7) || root;
        const tok = (note, inst, vol) => note + ':' + inst + ':' + vol;
        return this._track(
            { title: 'Deep Space' + (faction ? ' · ' + faction : ''), planet: '', role: 'map-void',
                notes: 'pure space drone, no planet motif' },
            84,
            [
                this._pat(0,
                    [tok(root, 1, 30), '.', '.', '.', '.', '.', '.', '.',
                        tok(fifth, 1, 24), '.', '.', '.', '.', '.', '.', '.'].join(' '),
                    ['.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.'].join(' '),
                    [tok(this._shiftNote(root, 12) || root, 3, 8), '.', '.', '.', '.', '.', '.', '.',
                        '.', '.', '.', '.', '.', '.', '.', '.'].join(' '),
                    this._emptyRow()
                )
            ],
            [0, 0, 0, 0]
        );
    },

    /** Victory screen — per-planet Hauptmelodie, lifted. */
    victory(planetId, galaxyId) {
        return this._roleFromPlanet(planetId || 'mars', 'victory', galaxyId);
    },

    /** Lose screen — per-planet Hauptmelodie, sparse. */
    lose(planetId, galaxyId) {
        return this._roleFromPlanet(planetId || 'mars', 'lose', galaxyId);
    },

    /** Resolve planet + role → raw track (ingame = combat loop). */
    forRole(planetId, role, galaxyId) {
        const r = String(role || 'ingame').toLowerCase();
        if (r === 'map') return this.map(planetId, galaxyId);
        if (r === 'victory' || r === 'win') return this.victory(planetId, galaxyId);
        if (r === 'lose' || r === 'defeat') return this.lose(planetId, galaxyId);
        if (r === 'shop' || r === 'trade' || r === 'trader') return this.shop(planetId, galaxyId);
        if (r === 'corridor' || r === 'tunnel') return this.corridor(planetId, galaxyId);
        return this.forPlanet(planetId, galaxyId);
    },

    /** Victory / docked trader — per-planet bazaar Hauptmelodie. */
    shop(planetId, galaxyId) {
        return this._roleFromPlanet(planetId || 'mars', 'shop', galaxyId);
    },

    /**
     * Schlauchlevel / corridor stage — tense, claustrophobic variant of the
     * planet motif: locked single-note pulse, no climax, tight dynamic range.
     * Distinct mood from open combat (`ingame`) and boss (`boss`).
     */
    corridor(planetId, galaxyId) {
        const id = this.normalizePlanetKey(planetId || 'mars');
        const m = this._motifPitches(id, galaxyId);
        const a = m[0];
        const root = this._rootBass(a);
        const tok = (note, inst, vol) => note + ':' + inst + ':' + vol;
        const patterns = [
            this._pat(0,
                [tok(root, 1, 40), '.', tok(root, 1, 40), '.', tok(root, 1, 32), '.', tok(root, 1, 40), '.',
                    tok(root, 1, 40), '.', tok(root, 1, 32), '.', tok(root, 1, 40), '.', tok(root, 1, 28), '.'].join(' '),
                [tok(a, 2, 26), '.', '.', '.', '.', '.', tok(a, 2, 20), '.',
                    '.', '.', '.', '.', '.', '.', tok(a, 2, 24), '.'].join(' '),
                this._emptyRow(),
                [tok(root, 5, 36), '.', '.', tok('A-4', 4, 8), '.', '.', tok(root, 5, 30), '.',
                    '.', '.', tok('A-4', 4, 6), '.', '.', '.', tok(root, 5, 26), '.'].join(' ')
            )
        ];
        return this._track(
            { title: 'Corridor · ' + id, planet: id, role: 'corridor', notes: 'Schlauchlevel: locked pulse, no climax' },
            118,
            patterns,
            [0, 0, 0, 0]
        );
    },

    /**
     * Boss Hauptmelodien — own head DNA, not a combat remix.
     * Heavier kit, darker intervals, pressure P2. Planet colour stays via key/feel.
     */

    // Mars boss — chromatic menace (Ab→G→A) vs combat's even march.
    'mars-boss'() {
        return this._track(
            { title: 'Dust Siege', planet: 'mars', role: 'boss', notes: 'boss Ab-G-A-E · chromatic threat' },
            136,
            [
                this._pat(0,
                    'A-1:1:68 . Ab1:1:52 . A-1:1:64 . E-1:1:50 . A-1:1:66 . G-1:1:48 . E-1:1:56 . Ab1:1:42',
                    'A-4:2:56 Ab4:2:44 G-4:2:52 E-4:2:40 . A-4:2:54 G-4:2:42 Ab4:2:48 E-4:2:36',
                    'E-3:3:22 . Ab3:3:14 . E-3:3:18 . A-3:3:12 . E-3:3:20 . G-3:3:12 . Ab3:3:16 . E-3:3:10',
                    'A-1:5:78 A-4:4:24 A-1:5:52 A-4:4:16 A-1:5:72 A-4:4:22 A-4:4:12 . A-1:5:76 A-4:4:24 A-1:5:50 A-4:4:14 A-1:5:68 A-4:4:18 A-4:4:10 .'
                ),
                this._pat(1,
                    'F-1:1:62 . F-1:1:46 . Ab1:1:58 . C-2:1:44 . G-1:1:60 . E-1:1:42 . G-1:1:54 . Bb1:1:38',
                    'F-4:2:50 Ab4:2:38 C-5:2:56 Bb4:2:42 . F-4:2:48 E-4:2:36 G-4:2:44 Bb4:2:34',
                    'C-3:3:18 . F-3:3:12 . Ab3:3:16 . C-4:3:10 . D-3:3:16 . G-3:3:10 . Bb3:3:14 . D-4:3:08',
                    'F-1:5:70 A-4:4:20 F-1:5:46 A-4:4:12 G-1:5:68 A-4:4:18 A-4:4:10 . F-1:5:72 A-4:4:20 G-1:5:44 A-4:4:12 G-1:5:64 A-4:4:16 A-4:4:08 .'
                ),
                this._pat(2,
                    'A-1:1:74 A-1:1:50 Ab1:1:58 E-1:1:54 A-1:1:72 . G-1:1:60 . E-1:1:48 A-1:1:66 Ab1:1:46 E-1:1:56',
                    'A-5:2:64 Ab5:2:50 G-5:2:58 E-5:2:46 A-5:2:62 . G-5:2:52 Ab5:2:56 E-5:2:44 A-5:2:60 G-5:2:48',
                    'A-3:3:26 E-3:3:16 Ab3:3:22 E-3:3:14 A-3:3:24 . G-3:3:18 E-3:3:12 A-3:3:20 Ab3:3:14 E-3:3:10',
                    'A-1:5:84 A-4:4:28 A-1:5:56 A-4:4:18 A-1:5:78 A-4:4:24 A-4:4:14 A-4:4:08 A-1:5:82 A-4:4:26 A-1:5:54 A-4:4:16 A-1:5:74 A-4:4:20 A-4:4:12 A-4:4:08'
                )
            ],
            [0, 0, 1, 0, 2, 1, 0, 2]
        );
    },

    // Jupiter boss — crushing on-beat hits vs combat's offbeat syncop.
    'jupiter-boss'() {
        return this._track(
            { title: 'Giant Impact', planet: 'jupiter', role: 'boss', notes: 'boss E-Bb-B-F# · crushing hits' },
            124,
            [
                this._pat(0,
                    'E-1:1:70 . E-1:1:48 . Bb1:1:62 . B-1:1:50 . E-1:1:68 . F#1:1:44 . B-1:1:58 . Bb1:1:40',
                    'E-4:2:58 . Bb4:2:46 . B-4:2:60 . F#4:2:48 . E-4:2:54 . D-4:2:40 . B-3:2:46 . Bb3:2:36',
                    'B-2:3:24 . E-3:3:14 . Bb2:3:18 . B-2:3:12 . F#3:3:20 . B-2:3:12 . E-3:3:16 . Bb2:3:10',
                    'E-1:5:80 . A-4:4:22 E-1:5:54 . A-4:4:14 E-1:5:74 . A-4:4:20 A-4:4:10 E-1:5:78 . A-4:4:22 E-1:5:50 . A-4:4:14 E-1:5:70 . A-4:4:16'
                ),
                this._pat(1,
                    'C-2:1:64 . G-1:1:46 . C-2:1:58 . Eb2:1:44 . D-2:1:62 . A-1:1:42 . B-1:1:54 . F#1:1:38',
                    'C-5:2:52 . Eb5:2:40 . G-5:2:56 . F-5:2:44 . D-5:2:50 . C-5:2:38 . B-4:2:44 . A-4:2:34',
                    'G-3:3:20 . C-4:3:12 . Eb3:3:16 . G-3:3:10 . A-3:3:18 . D-4:3:10 . F#3:3:14 . B-3:3:08',
                    'C-2:5:72 . A-4:4:18 C-2:5:48 . A-4:4:12 D-2:5:70 . A-4:4:18 A-4:4:08 C-2:5:74 . A-4:4:18 D-2:5:46 . A-4:4:12 D-2:5:66 . A-4:4:14'
                ),
                this._pat(2,
                    'E-1:1:76 E-1:1:52 Bb1:1:60 B-1:1:56 E-1:1:74 . F#1:1:58 . B-1:1:50 E-1:1:70 Bb1:1:48 B-1:1:54',
                    'E-5:2:66 Bb5:2:52 B-5:2:70 F#5:2:54 E-5:2:62 . D-5:2:50 Bb4:2:56 B-4:2:48 E-5:2:64 F#5:2:52',
                    'E-3:3:28 B-2:3:16 Bb2:3:22 B-2:3:14 E-3:3:26 . F#3:3:18 B-2:3:12 E-3:3:22 Bb2:3:14 B-2:3:10',
                    'E-1:5:86 A-4:4:28 E-1:5:58 A-4:4:18 E-1:5:80 A-4:4:24 A-4:4:14 A-4:4:08 E-1:5:84 A-4:4:26 E-1:5:56 A-4:4:16 E-1:5:76 A-4:4:20 A-4:4:12 A-4:4:08'
                )
            ],
            [0, 0, 1, 0, 2, 1, 0, 2]
        );
    },

    // Saturn boss — broken-ring chase: dotted menace vs combat gallop.
    'saturn-boss'() {
        return this._track(
            { title: 'Ring Breaker', planet: 'saturn', role: 'boss', notes: 'boss D-C#-A-G · dotted chase' },
            150,
            [
                this._pat(0,
                    'D-1:1:70 . D-1:1:48 C#2:1:56 . A-1:1:62 . D-1:1:68 G-1:1:44 . D-1:1:60 . A-1:1:50 C#2:1:40 .',
                    'D-4:2:56 . C#5:2:44 A-4:2:58 . G-4:2:48 . D-4:2:52 F-4:2:38 . A-4:2:50 . G-4:2:42 C#4:2:34 .',
                    'A-2:3:22 . D-3:3:14 C#3:3:18 . A-2:3:16 . G-2:3:12 D-3:3:14 . A-2:3:18 . C#3:3:12 G-2:3:08 .',
                    'D-1:5:82 A-4:4:26 . A-4:4:14 D-1:5:70 A-4:4:20 . A-4:4:10 D-1:5:78 A-4:4:24 . A-4:4:14 D-1:5:66 A-4:4:18 A-4:4:10 .'
                ),
                this._pat(1,
                    'G-1:1:64 . Bb1:1:46 F-1:1:54 . C-2:1:58 . A-1:1:50 E-2:1:44 . G-1:1:60 . Bb1:1:42 F-1:1:36 .',
                    'G-3:2:50 . Bb3:2:38 D-4:2:54 . C-4:2:44 . A-3:2:46 E-4:2:36 . G-3:2:48 . Bb3:2:34 D-4:2:40 .',
                    'D-2:3:18 . G-2:3:10 Bb2:3:14 . D-3:3:16 . E-2:3:12 A-2:3:10 . D-2:3:16 . G-2:3:10 Bb2:3:08 .',
                    'G-1:5:74 A-4:4:22 . A-4:4:12 A-1:5:66 A-4:4:18 . A-4:4:08 G-1:5:72 A-4:4:20 . A-4:4:12 A-1:5:62 A-4:4:16 A-4:4:08 .'
                ),
                this._pat(2,
                    'D-1:1:78 D-1:1:54 C#2:1:62 A-1:1:58 D-1:1:76 . G-1:1:64 . A-1:1:52 D-1:1:72 C#2:1:48 A-1:1:56',
                    'D-5:2:64 C#6:2:50 A-5:2:68 G-5:2:52 D-5:2:60 . F-5:2:54 A-5:2:58 G-5:2:46 D-5:2:62 C#5:2:48',
                    'D-3:3:28 A-2:3:16 C#3:3:22 A-2:3:14 D-3:3:26 . G-2:3:18 A-2:3:12 D-3:3:22 C#3:3:14 A-2:3:10',
                    'D-1:5:88 A-4:4:30 D-1:5:60 A-4:4:20 D-1:5:82 A-4:4:26 A-4:4:16 A-4:4:10 D-1:5:86 A-4:4:28 D-1:5:58 A-4:4:18 D-1:5:78 A-4:4:22 A-4:4:14 A-4:4:08'
                )
            ],
            [0, 0, 1, 0, 2, 1, 0, 2]
        );
    },

    // Neptune boss — dread pulse under ice: rising minor vs combat half-time space.
    'neptune-boss'() {
        return this._track(
            { title: 'Ice Tyrant', planet: 'neptune', role: 'boss', notes: 'boss B-C-D#-F# · dread rise' },
            112,
            [
                this._pat(0,
                    'B-1:1:60 . . B-1:1:42 . C-2:1:52 . . D#2:1:46 . . F#1:1:50 . B-1:1:44 . .',
                    'B-3:2:50 . C-4:2:40 . D#4:2:54 . F#4:2:44 . B-4:2:56 . A-4:2:42 . F#4:2:46 . D#4:2:36',
                    'F#2:3:16 . . B-2:3:12 . . C-3:3:14 . . D#3:3:18 . . F#2:3:10 . B-2:3:12 .',
                    'B-1:5:64 . . A-4:4:14 . B-1:5:50 . A-4:4:10 . B-1:5:60 . A-4:4:14 . B-1:5:46 A-4:4:08 . .'
                ),
                this._pat(1,
                    'G-1:1:54 . . A-1:1:38 . Bb1:1:48 . . C-2:1:42 . . D-1:1:46 . G-1:1:40 . .',
                    'G-3:2:44 . Bb3:2:34 . C-4:2:48 . D-4:2:38 . Eb4:2:50 . D-4:2:36 . C-4:2:40 . Bb3:2:30',
                    'D-2:3:14 . . G-2:3:10 . . Bb2:3:12 . . C-3:3:16 . . D-2:3:08 . G-2:3:10 .',
                    'G-1:5:56 . . A-4:4:12 . G-1:5:44 . A-4:4:08 . A-1:5:54 . A-4:4:12 . G-1:5:40 A-4:4:06 . .'
                ),
                this._pat(2,
                    'B-1:1:66 . C-2:1:50 . D#2:1:58 . F#1:1:52 B-1:1:64 . A-1:1:48 . F#1:1:54 . D#2:1:46 B-1:1:58',
                    'B-4:2:58 C-5:2:46 D#5:2:62 F#5:2:50 B-5:2:66 . A-5:2:52 F#5:2:56 D#5:2:44 B-4:2:54 C-5:2:42',
                    'B-2:3:22 F#2:3:14 C-3:3:18 D#3:3:12 F#3:3:20 . B-2:3:16 F#2:3:10 B-2:3:18 C-3:3:12 D#2:3:08',
                    'B-1:5:72 A-4:4:20 . A-4:4:12 B-1:5:58 A-4:4:16 . A-4:4:08 B-1:5:68 A-4:4:18 . A-4:4:12 B-1:5:54 A-4:4:14 A-4:4:08 .'
                )
            ],
            [0, 0, 1, 0, 2, 0, 1, 2]
        );
    },

    // Pluto boss — siege siren: descending alarm vs combat stab clusters.
    'pluto-boss'() {
        return this._track(
            { title: 'Kuiper Siege', planet: 'pluto', role: 'boss', notes: 'boss C-Bb-Ab-G · descending alarm' },
            158,
            [
                this._pat(0,
                    'C-1:1:72 C-1:1:52 . Bb1:1:60 . Ab1:1:54 G-1:1:48 . C-1:1:70 C-1:1:50 . Bb1:1:56 . Ab1:1:44 . G-1:1:40',
                    'C-5:2:60 Bb4:2:48 Ab4:2:54 G-4:2:42 . C-5:2:56 Bb4:2:44 Ab4:2:50 G-4:2:38 C-4:2:46 Bb3:2:34 Ab3:2:40 G-3:2:30',
                    'G-2:3:24 C-3:3:16 Bb2:3:18 Ab2:3:12 G-2:3:20 . C-3:3:22 Bb2:3:14 Ab2:3:16 G-2:3:10 C-3:3:18 Bb2:3:12 Ab2:3:08',
                    'C-1:5:84 A-4:4:28 C-1:5:56 A-4:4:18 C-1:5:76 A-4:4:22 A-4:4:12 . C-1:5:82 A-4:4:26 C-1:5:54 A-4:4:16 C-1:5:72 A-4:4:20 A-4:4:10 .'
                ),
                this._pat(1,
                    'Ab1:1:66 Ab1:1:46 . Gb1:1:54 . Eb1:1:50 F-1:1:42 . Bb1:1:64 Bb1:1:46 . Ab1:1:52 . Gb1:1:40 . F-1:1:36',
                    'Ab4:2:54 Gb4:2:42 Eb4:2:48 D-4:2:36 . Bb4:2:52 Ab4:2:40 Gb4:2:46 F-4:2:34 Eb4:2:42 D-4:2:30 C-4:2:36 Bb3:2:28',
                    'Eb2:3:20 Ab2:3:14 Gb2:3:16 Eb2:3:10 F-2:3:18 . Bb2:3:20 Ab2:3:12 Gb2:3:14 F-2:3:08 Bb2:3:16 Ab2:3:10 Gb2:3:06',
                    'Ab1:5:76 A-4:4:24 Ab1:5:50 A-4:4:14 Bb1:5:72 A-4:4:20 A-4:4:10 . Ab1:5:78 A-4:4:24 Bb1:5:48 A-4:4:14 Bb1:5:68 A-4:4:18 A-4:4:08 .'
                ),
                this._pat(2,
                    'C-1:1:80 C-1:1:58 Bb1:1:66 Ab1:1:54 G-1:1:60 . C-1:1:76 Bb1:1:52 Ab1:1:58 G-1:1:46 C-1:1:72 Bb1:1:50 Ab1:1:56 G-1:1:44',
                    'C-6:2:68 Bb5:2:54 Ab5:2:60 G-5:2:48 C-6:2:64 . Bb5:2:56 Ab5:2:58 G-5:2:46 C-5:2:54 Bb4:2:42 Ab4:2:48 G-4:2:38',
                    'C-3:3:30 G-2:3:18 Bb2:3:24 Ab2:3:14 G-2:3:22 C-3:3:28 . Bb2:3:20 Ab2:3:16 G-2:3:12 C-3:3:24 Bb2:3:14 Ab2:3:10',
                    'C-1:5:90 A-4:4:32 C-1:5:62 A-4:4:22 C-1:5:84 A-4:4:28 A-4:4:16 A-4:4:10 C-1:5:88 A-4:4:30 C-1:5:60 A-4:4:20 C-1:5:80 A-4:4:24 A-4:4:14 A-4:4:08'
                )
            ],
            [0, 0, 1, 0, 2, 1, 0, 2]
        );
    },

    /**
     * Fallback boss for unknown / explored slugs: donor planet's boss Hauptmelodie
     * (keyed remix), never a combat-loop pressure clone.
     */
    _bossFor(planetId, bpm, galaxyId) {
        const id = this.normalizePlanetKey
            ? this.normalizePlanetKey(planetId)
            : String(planetId || 'mars').toLowerCase();
        if (this.isHandcraftedPlanet && this.isHandcraftedPlanet(id)) {
            const key = id + '-boss';
            if (typeof this[key] === 'function') {
                const track = this[key]();
                if (bpm && track) track.bpm = bpm;
                return track;
            }
        }
        const { primary } = this._donorPair ? this._donorPair(id, galaxyId) : { primary: 'mars' };
        const key = primary + '-boss';
        if (typeof this[key] === 'function' && typeof this.remixPlanet === 'function') {
            // remixPlanet with boss:true pulls handcrafted boss DNA via _handcraftedRaw.
            const remixed = this.remixPlanet(id, { boss: true, galaxyId: galaxyId });
            if (bpm && remixed) remixed.bpm = bpm;
            return remixed;
        }
        if (typeof this[key] === 'function') return this[key]();
        return this['mars-boss']();
    },

    PLANETS: ['mars', 'jupiter', 'saturn', 'neptune', 'pluto'],

    /**
     * Strip only stage suffixes (mars-2, pluto-boss). Keep explored / ambush ids.
     */
    normalizePlanetKey(planetId) {
        const raw = String(planetId || 'mars').toLowerCase().trim();
        if (!raw) return 'mars';
        const m = /^(.*)-(?:\d+|boss|b)$/.exec(raw);
        if (m && m[1]) return m[1];
        return raw.split(':')[0];
    },

    isHandcraftedPlanet(planetId) {
        const id = this.normalizePlanetKey(planetId);
        return this.PLANETS.indexOf(id) !== -1;
    },

    _hash32(str) {
        let h = 2166136261;
        const s = String(str || '');
        for (let i = 0; i < s.length; i++) {
            h ^= s.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        return h >>> 0;
    },

    _rng(seed) {
        let s = (seed >>> 0) || 1;
        return () => {
            s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
            return s / 4294967296;
        };
    },

    /**
     * Stable primary + secondary handcrafted donors for any planet slug.
     * `galaxyId` (optional) folds into the hash seed so procedurally remixed
     * planets sharing a galaxy tend toward a related donor/key/BPM family,
     * while two planets with the same id in different galaxies diverge.
     */
    _donorPair(planetId, galaxyId) {
        const id = this.normalizePlanetKey(planetId);
        const seed = galaxyId ? id + ':' + String(galaxyId).toLowerCase() : id;
        const h = this._hash32(seed);
        const primary = this.PLANETS[h % this.PLANETS.length];
        let secondary = this.PLANETS[(h >>> 8) % this.PLANETS.length];
        if (secondary === primary) {
            secondary = this.PLANETS[(h + 2) % this.PLANETS.length];
        }
        return { primary, secondary, hash: h };
    },

    _handcraftedRaw(planetKey, opts) {
        const boss = !!(opts && opts.boss);
        const intro = !!(opts && opts.intro);
        if (intro) return this.intro(planetKey);
        if (boss) {
            const key = planetKey + '-boss';
            if (typeof this[key] === 'function') return this[key]();
            return this._bossFor(planetKey, 128);
        }
        if (typeof this[planetKey] === 'function') return this[planetKey]();
        return this.mars();
    },

    _thinChannel(str, keepEvery) {
        const step = Math.max(1, keepEvery | 0);
        return String(str || '').trim().split(/\s+/).filter(Boolean)
            .map((tok, i) => (i % step === 0 ? tok : '.')).join(' ');
    },

    _shiftOctaveChannel(str, octaves) {
        if (!octaves || typeof VFTrackerParse === 'undefined') return str;
        return VFTrackerParse.transposeChannelString(str, octaves * 12);
    },

    _emptyRow() {
        return '. . . . . . . . . . . . . . . .';
    },

    _padRow(str) {
        const empty = this._emptyRow();
        if (typeof VFTrackerParse !== 'undefined' && VFTrackerParse.padChannelString) {
            return VFTrackerParse.padChannelString(str || empty, 16);
        }
        return String(str || empty);
    },

    /**
     * Stretch a short P0/P1/P2 combat loop into a longer form so the hamster
     * wheel (order like [0,0,1,0,2,1,0,0]) stops repeating every ~8 bars.
     * Derives breakdown + drop packs from the same DNA — no new melodies.
     */
    _withLongForm(raw, opts) {
        if (!raw || !raw.patterns || raw.patterns.length < 2) return raw;
        if (raw.meta && raw.meta.longForm) return raw;
        if (raw.patterns.length >= 5) return raw;

        const compact = (typeof VFTrackerParse !== 'undefined' && VFTrackerParse.toCompact)
            ? VFTrackerParse.toCompact(raw)
            : raw;
        const empty = this._emptyRow();
        const pats = (compact.patterns || []).map((p, i) => ({
            id: i,
            channels: (p.channels || []).slice()
        }));
        while (pats.length < 3) {
            const src = pats[0] || { channels: [empty, empty, empty, empty] };
            pats.push({ id: pats.length, channels: src.channels.slice() });
        }
        const ch = (pi, ci) => this._padRow((pats[pi].channels && pats[pi].channels[ci]) || empty);

        // P3 breakdown — bass stays, lead thinned, arp out, kit half-time.
        pats.push({
            id: 3,
            channels: [
                ch(0, 0),
                this._padRow(this._thinChannel(ch(0, 1), 2)),
                empty,
                this._padRow(this._thinChannel(ch(0, 3), 2))
            ]
        });
        // P4 drop / rebuild — bass+drums from P1, arp ticks, lead silent.
        pats.push({
            id: 4,
            channels: [
                ch(1, 0),
                empty,
                this._padRow(this._thinChannel(ch(1, 2), 2)),
                ch(1, 3)
            ]
        });

        const boss = !!(opts && opts.boss);
        // ~24 slots before loop (~3× old 8-bar cycle).
        const order = boss
            ? [
                0, 0, 1, 0,
                1, 2, 1, 2,
                0, 3, 4, 3,
                0, 1, 2, 2,
                4, 0, 1, 2,
                0, 2, 1, 3
            ]
            : [
                0, 0, 1, 0,
                1, 1, 2, 1,
                0, 3, 1, 3,
                0, 1, 2, 2,
                4, 0, 1, 2,
                0, 1, 0, 3
            ];

        return {
            format: 'vftrack',
            version: 1,
            meta: Object.assign({}, compact.meta || {}, {
                longForm: true,
                notes: ((compact.meta && compact.meta.notes) ? compact.meta.notes + ' · ' : '')
                    + 'long form A/B/C/break/drop'
            }),
            bpm: compact.bpm,
            rowsPerBeat: compact.rowsPerBeat || 1,
            rowsPerPattern: compact.rowsPerPattern || 16,
            channels: 4,
            instruments: (compact.instruments || this._baseInstruments()).map((inst) => Object.assign({}, inst)),
            patterns: pats,
            order: order,
            loop: compact.loop !== false
        };
    },

    /**
     * Explored planets: one donor motif track, musical key + small BPM nudge.
     * Never splice channels from two songs — that kills motif continuity.
     */
    remixPlanet(planetId, opts) {
        const id = this.normalizePlanetKey(planetId);
        const boss = !!(opts && opts.boss);
        const intro = !!(opts && opts.intro);
        const { primary, hash } = this._donorPair(id, opts && opts.galaxyId);
        const a = VFTrackerParse.toCompact(this._handcraftedRaw(primary, { boss, intro }));
        const keyPool = [0, 2, -2, 3, -3, 5, -5, 7];
        // Coarse key from low bits + micro salt from high bits so two planets
        // that land on the same donor/key still diverge in pitch (map hops).
        const key = keyPool[hash % keyPool.length] + (((hash >>> 16) % 11) - 5);
        const bpm = Math.max(110, Math.min(152, Number(a.bpm) + ((hash % 5) - 2) + (((hash >>> 24) % 3) - 1)));
        const pad = (s) => VFTrackerParse.padChannelString(s, 16);
        const tx = (s, semi) => (semi ? VFTrackerParse.transposeChannelString(s, semi) : s);

        const patterns = (a.patterns || []).map((p, pi) => {
            const ch = (p.channels || []).slice();
            while (ch.length < 4) ch.push('.');
            return {
                id: pi,
                channels: [
                    pad(tx(ch[0], key)),
                    pad(tx(ch[1], key)),
                    pad(tx(ch[2], key)),
                    pad(tx(ch[3], key))
                ]
            };
        });
        let order = (a.order || []).slice();
        if (!order.length) order = intro ? [0, 1] : [0, 0, 1, 0, 2, 1, 0, 0];
        // Rotate form only — keep relative motif order (P0→P1→P2 development).
        if (order.length > 2) {
            const steps = Math.max(1, Math.floor(order.length / 2));
            const rot = ((hash >>> 8) % steps) * 2; // phrase-boundary rotate
            order = order.slice(rot).concat(order.slice(0, rot));
            order = order.map((idx) => idx % Math.max(patterns.length, 1));
        }

        const labels = { mars: 'Dust', jupiter: 'Giant', saturn: 'Ring', neptune: 'Ice', pluto: 'Kuiper' };
        const built = {
            format: 'vftrack',
            version: 1,
            meta: {
                title: (intro ? 'Launch' : boss ? 'Siege' : 'Orbit')
                    + ' ' + (labels[primary] || primary) + ' · ' + id.slice(0, 12).toUpperCase(),
                author: 'VF Tracker · GB-style',
                planet: id,
                notes: 'keyed remix of ' + primary + ' motif' + (intro ? ' intro' : boss ? ' boss' : '')
            },
            bpm: bpm,
            rowsPerBeat: a.rowsPerBeat || 1,
            rowsPerPattern: a.rowsPerPattern || 16,
            channels: 4,
            instruments: (a.instruments || this._baseInstruments()).map((inst) => Object.assign({}, inst)),
            patterns: patterns,
            order: order,
            loop: !intro
        };
        if (intro) return built;
        return this._withLongForm(built, { boss: boss });
    },

    forPlanet(planetId, galaxyId) {
        const raw = String(planetId || 'mars').toLowerCase();
        if (raw === 'intro' || raw.indexOf('intro:') === 0) {
            return this.intro(raw.split(':')[1] || 'mars');
        }
        // Named role helpers (map/victory/…) — do not long-form those.
        if (raw.indexOf('-boss') === -1 && typeof this[raw] === 'function'
            && (raw === 'menu' || raw === 'map' || raw === 'victory' || raw === 'lose' || raw === 'shop')) {
            return this[raw]();
        }
        const id = this.normalizePlanetKey(raw);
        const wantBoss = raw.indexOf('boss') !== -1 || /-(?:boss|b)$/.test(raw);
        let built = null;
        if (typeof this[raw] === 'function') {
            built = this[raw]();
        } else if (this.isHandcraftedPlanet(id)) {
            if (wantBoss) {
                const key = id + '-boss';
                built = (typeof this[key] === 'function') ? this[key]() : this._bossFor(id, 128, galaxyId);
            } else if (typeof this[id] === 'function') {
                built = this[id]();
            }
        }
        if (!built) built = this.remixPlanet(id, { boss: wantBoss, galaxyId: galaxyId });
        // Combat / boss loops get the long form; roles already returned above.
        return this._withLongForm(built, { boss: wantBoss });
    },

    allKeys() {
        const planets = this.PLANETS || ['mars', 'jupiter', 'saturn', 'neptune', 'pluto'];
        const keys = [
            'menu', 'intro', 'title-intro', 'map', 'map-void', 'victory', 'lose', 'shop',
            'mars', 'jupiter', 'saturn', 'neptune', 'pluto',
            'mars-boss', 'jupiter-boss', 'saturn-boss', 'neptune-boss', 'pluto-boss'
        ];
        planets.forEach((p) => {
            keys.push('map:' + p);
            keys.push('victory:' + p);
            keys.push('lose:' + p);
            keys.push('shop:' + p);
            keys.push('ingame:' + p);
            keys.push('corridor:' + p);
        });
        return keys;
    }
};
