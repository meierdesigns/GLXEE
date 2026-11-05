"use strict";

/**
 * Built-in vftracks — oriented on Volley Fire (GB, 1990 / Akihiko Mori):
 * clear pulse hooks, wave bass ostinato, sparse harmony, noise hats.
 * Original melodies inspired by that era's Toei GB shooter feel (not a rip).
 * Role map ≈ GB OST: Title→intro, Planet Select→menu, Main BGM 1–3→planets,
 * Boss / Final Boss→boss keys.
 */
const VFTrackerDefaults = {
    /** Game Boy-ish voices: wave bass, two pulses, noise. */
    _baseInstruments() {
        return [
            { id: 1, name: 'wave', wave: 'triangle', volume: 0.7, attack: 0.001, decay: 0.04, sustain: 0.58, release: 0.06, filter: 1800 },
            { id: 2, name: 'pulse1', wave: 'square', volume: 0.28, attack: 0.001, decay: 0.05, sustain: 0.32, release: 0.08, filter: 2400 },
            { id: 3, name: 'pulse2', wave: 'square', volume: 0.4, attack: 0.001, decay: 0.03, sustain: 0.3, release: 0.05 },
            { id: 4, name: 'noise', wave: 'noise', volume: 0.32, attack: 0.001, decay: 0.025, sustain: 0.01, release: 0.02 },
            { id: 5, name: 'kick', wave: 'triangle', volume: 0.78, attack: 0.001, decay: 0.07, sustain: 0.05, release: 0.04, filter: 400 }
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

    // Motif: A C E D | C A G A  (A minor head)
    mars() {
        return this._track(
            { title: 'Main Orbit 1', planet: 'mars', notes: 'motif A-C-E-D · develop · return' },
            132,
            [
                this._pat(0,
                    'A-2:1:56 . A-2:1:40 . A-2:1:56 . E-2:1:44 . A-2:1:56 . A-2:1:40 . E-2:1:48 . E-2:1:36',
                    'A-4:2:48 . C-5:2:40 . E-5:2:52 . D-5:2:44 . C-5:2:46 . A-4:2:38 . G-4:2:40 . A-4:2:44',
                    'E-4:3:16 . . . A-4:3:14 . . . E-4:3:16 . . . A-4:3:14 . . .',
                    'A-2:5:64 . A-4:4:16 . A-2:5:50 . A-4:4:12 A-2:5:64 . A-4:4:16 . A-2:5:48 A-4:4:10 . .'
                ),
                this._pat(1,
                    'F-2:1:52 . F-2:1:36 . F-2:1:52 . C-2:1:40 . G-2:1:52 . G-2:1:36 . E-2:1:46 . G-2:1:34',
                    'F-4:2:44 . A-4:2:36 . C-5:2:48 . B-4:2:40 . A-4:2:42 . G-4:2:34 . E-4:2:36 . F-4:2:40',
                    'C-4:3:14 . . . F-4:3:12 . . . D-4:3:14 . . . G-4:3:12 . . .',
                    'F-2:5:58 . A-4:4:14 . F-2:5:46 . A-4:4:10 G-2:5:58 . A-4:4:14 . G-2:5:44 A-4:4:08 . .'
                ),
                this._pat(2,
                    'A-2:1:60 . A-2:1:42 . C-3:1:50 . E-2:1:46 . A-2:1:60 . A-2:1:42 . G-2:1:52 . E-2:1:40',
                    'A-5:2:52 . C-6:2:44 . E-6:2:56 . D-6:2:48 . C-6:2:50 . A-5:2:42 . G-5:2:44 . A-5:2:48',
                    'A-4:3:18 . E-4:3:12 . E-4:3:12 A-4:3:18 . C-5:3:20 . E-4:3:12 A-4:3:16 . G-4:3:12 . E-4:3:10 .',
                    'A-2:5:70 A-4:4:18 . A-4:4:12 A-2:5:54 . A-4:4:14 . A-2:5:66 A-4:4:16 . A-4:4:10 A-2:5:50 A-4:4:12 .'
                )
            ],
            [0, 0, 1, 0, 2, 1, 0, 0]
        );
    },

    // Motif: E G B A | G E D E  (E minor head)
    jupiter() {
        return this._track(
            { title: 'Main Orbit 2', planet: 'jupiter', notes: 'motif E-G-B-A · develop · return' },
            124,
            [
                this._pat(0,
                    'E-2:1:54 . E-2:1:38 . E-2:1:54 . B-1:1:42 . E-2:1:54 . E-2:1:38 . B-1:1:46 . B-1:1:34',
                    'E-4:2:46 . G-4:2:38 . B-4:2:50 . A-4:2:42 . G-4:2:44 . E-4:2:36 . D-4:2:38 . E-4:2:42',
                    'B-3:3:14 . . . E-4:3:12 . . . B-3:3:14 . . . E-4:3:12 . . .',
                    'E-2:5:60 . A-4:4:14 . E-2:5:48 . A-4:4:10 E-2:5:60 . A-4:4:14 . E-2:5:44 A-4:4:08 . .'
                ),
                this._pat(1,
                    'C-3:1:50 . C-3:1:34 . C-3:1:50 . G-2:1:38 . D-3:1:50 . D-3:1:34 . B-1:1:44 . D-2:1:32',
                    'C-5:2:42 . E-5:2:34 . G-5:2:46 . F#5:2:38 . E-5:2:40 . D-5:2:32 . B-4:2:34 . C-5:2:38',
                    'G-4:3:12 . . . C-5:3:10 . . . A-4:3:12 . . . D-5:3:10 . . .',
                    'C-3:5:56 . A-4:4:12 . C-3:5:44 . A-4:4:08 D-3:5:56 . A-4:4:12 . D-3:5:40 A-4:4:06 . .'
                ),
                this._pat(2,
                    'E-2:1:58 . E-2:1:40 . G-2:1:48 . B-1:1:44 . E-2:1:58 . E-2:1:40 . D-2:1:50 . B-1:1:38',
                    'E-5:2:50 . G-5:2:42 . B-5:2:54 . A-5:2:46 . G-5:2:48 . E-5:2:40 . D-5:2:42 . E-5:2:46',
                    'E-4:3:16 . B-3:3:10 . B-3:3:10 E-4:3:16 . G-4:3:18 . B-3:3:10 E-4:3:14 . D-4:3:10 . B-3:3:08 .',
                    'E-2:5:66 A-4:4:16 . A-4:4:10 E-2:5:52 . A-4:4:12 . E-2:5:62 A-4:4:14 . A-4:4:08 E-2:5:46 A-4:4:10 .'
                )
            ],
            [0, 0, 1, 0, 2, 0, 1, 0]
        );
    },

    // Motif: D F A G | F D C D  (D minor head, faster)
    saturn() {
        return this._track(
            { title: 'Main Orbit 3', planet: 'saturn', notes: 'motif D-F-A-G · develop · return' },
            140,
            [
                this._pat(0,
                    'D-2:1:56 D-2:1:36 . D-2:1:56 . A-1:1:42 . D-2:1:56 D-2:1:36 . A-1:1:46 . A-1:1:34',
                    'D-4:2:48 . F-4:2:40 . A-4:2:52 . G-4:2:44 . F-4:2:46 . D-4:2:38 . C-4:2:40 . D-4:2:44',
                    'A-3:3:16 . . . D-4:3:14 . . . A-3:3:16 . . . D-4:3:14 . . .',
                    'D-2:5:64 A-4:4:16 D-2:5:40 A-4:4:10 D-2:5:58 A-4:4:14 . D-2:5:64 A-4:4:16 D-2:5:38 A-4:4:10 D-2:5:50 A-4:4:12 .'
                ),
                this._pat(1,
                    'G-1:1:52 G-1:1:32 . G-1:1:52 . D-1:1:38 . A-1:1:52 A-1:1:32 . E-2:1:44 . A-1:1:30',
                    'G-3:2:44 . Bb3:2:36 . D-4:2:48 . C-4:2:40 . Bb3:2:42 . A-3:2:34 . G-3:2:36 . A-3:2:40',
                    'D-3:3:14 . . . G-3:3:12 . . . E-3:3:14 . . . A-3:3:12 . . .',
                    'G-1:5:60 A-4:4:14 G-1:5:38 A-4:4:08 A-1:5:56 A-4:4:12 . A-1:5:60 A-4:4:14 A-1:5:36 A-4:4:08 A-1:5:48 A-4:4:10 .'
                ),
                this._pat(2,
                    'D-2:1:60 . D-2:1:40 . F-2:1:50 . A-1:1:44 . D-2:1:60 . D-2:1:40 . C-2:1:52 . A-1:1:38',
                    'D-5:2:52 . F-5:2:44 . A-5:2:56 . G-5:2:48 . F-5:2:50 . D-5:2:42 . C-5:2:44 . D-5:2:48',
                    'D-4:3:18 . A-3:3:12 . A-3:3:12 D-4:3:18 . F-4:3:20 . A-3:3:12 D-4:3:16 . C-4:3:12 . A-3:3:10 .',
                    'D-2:5:70 A-4:4:18 . A-4:4:10 D-2:5:54 A-4:4:14 A-4:4:08 . D-2:5:66 A-4:4:16 . A-4:4:08 D-2:5:48 A-4:4:10 .'
                )
            ],
            [0, 0, 1, 0, 2, 1, 0, 0]
        );
    },

    // Motif: B D F# E | D B A B  (B minor, colder spacing)
    neptune() {
        return this._track(
            { title: 'Ice Lane', planet: 'neptune', notes: 'motif B-D-F#-E · develop · return' },
            118,
            [
                this._pat(0,
                    'B-1:1:50 . . B-1:1:36 . F#1:1:44 . . F#1:1:32 . B-1:1:50 . . F#1:1:40 . F#1:1:30 .',
                    'B-3:2:42 . D-4:2:34 . F#4:2:46 . E-4:2:38 . D-4:2:40 . B-3:2:32 . A-3:2:34 . B-3:2:38',
                    'F#3:3:12 . . . B-3:3:10 . . . F#3:3:12 . . . B-3:3:10 . . .',
                    '. A-4:4:12 . . B-1:5:48 . A-4:4:08 . . A-4:4:12 . B-1:5:42 . A-4:4:06 . .'
                ),
                this._pat(1,
                    'G-1:1:46 . . G-1:1:32 . D-1:1:40 . . D-1:1:28 . A-1:1:46 . . E-1:1:36 . E-1:1:26 .',
                    'G-3:2:38 . B-3:2:30 . D-4:2:42 . C#4:2:34 . B-3:2:36 . A-3:2:28 . G-3:2:30 . A-3:2:34',
                    'D-3:3:10 . . . G-3:3:08 . . . E-3:3:10 . . . A-3:3:08 . . .',
                    '. A-4:4:10 . . G-1:5:44 . A-4:4:06 . . A-4:4:10 . A-1:5:40 . A-4:4:05 . .'
                ),
                this._pat(2,
                    'B-1:1:54 . . B-1:1:38 . F#1:1:46 . . A-1:1:42 . B-1:1:54 . . F#1:1:40 . E-1:1:34 .',
                    'B-4:2:46 . D-5:2:38 . F#5:2:50 . E-5:2:42 . D-5:2:44 . B-4:2:36 . A-4:2:38 . B-4:2:42',
                    'B-3:3:14 . F#3:3:08 . F#3:3:08 B-3:3:14 . D-4:3:16 . F#3:3:08 B-3:3:12 . A-3:3:08 . F#3:3:06 .',
                    'B-1:5:54 . A-4:4:12 . B-1:5:42 . A-4:4:08 . B-1:5:50 A-4:4:10 . A-4:4:06 . . . .'
                )
            ],
            [0, 0, 1, 0, 2, 1, 0, 0]
        );
    },

    // Motif: C Eb G F | Eb C Bb C  (C minor, urgent)
    pluto() {
        return this._track(
            { title: 'Kuiper Rush', planet: 'pluto', notes: 'motif C-Eb-G-F · develop · return' },
            148,
            [
                this._pat(0,
                    'C-2:1:56 C-2:1:34 . C-2:1:56 . G-1:1:42 . C-2:1:56 C-2:1:34 . G-1:1:46 . G-1:1:32',
                    'C-4:2:48 . Eb4:2:40 . G-4:2:52 . F-4:2:44 . Eb4:2:46 . C-4:2:38 . Bb3:2:40 . C-4:2:44',
                    'G-3:3:16 . . . C-4:3:14 . . . G-3:3:16 . . . C-4:3:14 . . .',
                    'C-2:5:68 A-4:4:16 C-2:5:40 A-4:4:10 C-2:5:60 A-4:4:14 . C-2:5:68 A-4:4:16 C-2:5:38 A-4:4:10 C-2:5:52 A-4:4:12 .'
                ),
                this._pat(1,
                    'Ab1:1:52 Ab1:1:30 . Ab1:1:52 . Eb1:1:38 . Bb1:1:52 Bb1:1:30 . F-2:1:44 . Bb1:1:28',
                    'Ab3:2:44 . C-4:2:36 . Eb4:2:48 . D-4:2:40 . C-4:2:42 . Bb3:2:34 . Ab3:2:36 . Bb3:2:40',
                    'Eb3:3:14 . . . Ab3:3:12 . . . F-3:3:14 . . . Bb3:3:12 . . .',
                    'Ab1:5:62 A-4:4:14 Ab1:5:38 A-4:4:08 Bb1:5:58 A-4:4:12 . Bb1:5:62 A-4:4:14 Bb1:5:36 A-4:4:08 Bb1:5:48 A-4:4:10 .'
                ),
                this._pat(2,
                    'C-2:1:60 . C-2:1:38 . Eb2:1:50 . G-1:1:44 . C-2:1:60 . C-2:1:38 . Bb1:1:52 . G-1:1:36',
                    'C-5:2:52 . Eb5:2:44 . G-5:2:56 . F-5:2:48 . Eb5:2:50 . C-5:2:42 . Bb4:2:44 . C-5:2:48',
                    'C-4:3:18 . G-3:3:12 . G-3:3:12 C-4:3:18 . Eb4:3:20 . G-3:3:12 C-4:3:16 . Bb3:3:12 . G-3:3:10 .',
                    'C-2:5:74 A-4:4:18 . A-4:4:10 C-2:5:56 A-4:4:14 A-4:4:08 . C-2:5:70 A-4:4:16 . A-4:4:08 C-2:5:50 A-4:4:10 .'
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

    /** Planet Select — motif G B D E | D B A G, then sequenced. */
    menu() {
        return this._track(
            { title: 'Planet Select', planet: 'menu', notes: 'motif G-B-D-E · develop · return' },
            112,
            [
                this._pat(0,
                    'G-2:1:50 . G-2:1:36 . G-2:1:50 . D-2:1:40 . G-2:1:50 . G-2:1:36 . D-2:1:44 . D-2:1:32',
                    'G-4:2:44 . B-4:2:36 . D-5:2:48 . E-5:2:40 . D-5:2:42 . B-4:2:34 . A-4:2:36 . G-4:2:40',
                    'D-4:3:14 . . . G-4:3:12 . . . D-4:3:14 . . . G-4:3:12 . . .',
                    'G-2:5:56 . A-4:4:12 . G-2:5:44 . A-4:4:08 G-2:5:56 . A-4:4:12 . G-2:5:40 A-4:4:06 . .'
                ),
                this._pat(1,
                    'E-2:1:46 . E-2:1:32 . E-2:1:46 . B-1:1:36 . E-2:1:46 . E-2:1:32 . B-1:1:40 . B-1:1:28',
                    'E-4:2:40 . G-4:2:32 . B-4:2:44 . C-5:2:36 . B-4:2:38 . G-4:2:30 . F#4:2:32 . E-4:2:36',
                    'B-3:3:12 . . . E-4:3:10 . . . B-3:3:12 . . . E-4:3:10 . . .',
                    'E-2:5:52 . A-4:4:10 . E-2:5:40 . A-4:4:06 E-2:5:52 . A-4:4:10 . E-2:5:36 A-4:4:05 . .'
                ),
                this._pat(2,
                    'G-2:1:54 . G-2:1:38 . B-2:1:46 . D-2:1:42 . G-2:1:54 . G-2:1:38 . D-3:1:48 . B-2:1:36',
                    'G-5:2:48 . B-5:2:40 . D-6:2:52 . E-6:2:44 . D-6:2:46 . B-5:2:38 . A-5:2:40 . G-5:2:44',
                    'G-4:3:16 . D-4:3:10 . D-4:3:10 G-4:3:16 . B-4:3:18 . D-4:3:10 G-4:3:14 . E-4:3:10 . D-4:3:08 .',
                    'G-2:5:60 A-4:4:14 . A-4:4:08 G-2:5:48 . A-4:4:10 . G-2:5:56 A-4:4:12 . A-4:4:06 G-2:5:42 A-4:4:08 .'
                )
            ],
            [0, 0, 1, 0, 2, 1, 0, 0]
        );
    },

    /** Boss = planet motif doubled + denser drums (same head DNA). */
    _bossFor(planetId, bpm) {
        const id = String(planetId || 'mars').toLowerCase();
        const base = typeof this[id] === 'function' ? this[id]() : this.mars();
        const compact = (typeof VFTrackerParse !== 'undefined' && VFTrackerParse.toCompact)
            ? VFTrackerParse.toCompact(base)
            : base;
        const patterns = (compact.patterns || []).slice(0, 2).map((p, pi) => {
            const ch = (p.channels || []).slice();
            while (ch.length < 4) ch.push('.');
            // Keep lead motif; thicken drums.
            const drums = pi === 0
                ? ch[3]
                : String(ch[3]).replace(/:4:(\d+)/g, (m, v) => ':4:' + Math.min(28, Number(v) + 4));
            return this._pat(pi, ch[0], ch[1], ch[2], drums);
        });
        // Append a pressure variant: motif up a fifth if parse available, else repeat P0.
        let pressureLead = patterns[0].channels[1];
        if (typeof VFTrackerParse !== 'undefined') {
            pressureLead = VFTrackerParse.transposeChannelString(patterns[0].channels[1], 7);
        }
        patterns.push(this._pat(2,
            patterns[0].channels[0],
            pressureLead,
            patterns[0].channels[2],
            patterns[0].channels[3]
        ));
        return this._track(
            { title: id.toUpperCase() + ' Boss', planet: id, notes: 'boss = planet motif × pressure' },
            bpm || Math.min(156, (compact.bpm || 132) + 8),
            patterns,
            [0, 0, 1, 0, 2, 1, 0, 2]
        );
    },

    'mars-boss'() { return this._bossFor('mars', 128); },
    'jupiter-boss'() { return this._bossFor('jupiter', 120); },
    'saturn-boss'() { return this._bossFor('saturn', 134); },
    'neptune-boss'() { return this._bossFor('neptune', 126); },
    'pluto-boss'() { return this._bossFor('pluto', 142); },

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

    /** Stable primary + secondary handcrafted donors for any planet slug. */
    _donorPair(planetId) {
        const id = this.normalizePlanetKey(planetId);
        const h = this._hash32(id);
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

    /**
     * Explored planets: one donor motif track, musical key + small BPM nudge.
     * Never splice channels from two songs — that kills motif continuity.
     */
    remixPlanet(planetId, opts) {
        const id = this.normalizePlanetKey(planetId);
        const boss = !!(opts && opts.boss);
        const intro = !!(opts && opts.intro);
        const { primary, hash } = this._donorPair(id);
        const a = VFTrackerParse.toCompact(this._handcraftedRaw(primary, { boss, intro }));
        const keyPool = [0, 2, -2, 3, -3, 5, -5, 7];
        const key = keyPool[hash % keyPool.length];
        const bpm = Math.max(110, Math.min(152, Number(a.bpm) + ((hash % 5) - 2)));
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
                    pad(ch[3])
                ]
            };
        });
        let order = (a.order || []).slice();
        if (!order.length) order = intro ? [0, 1] : [0, 0, 1, 0, 2, 1, 0, 0];
        // Rotate form only — keep relative motif order (P0→P1→P2 development).
        if (order.length > 2) {
            const rot = (hash % 2) * 2; // 0 or 2 — stay on phrase boundaries
            order = order.slice(rot).concat(order.slice(0, rot));
            order = order.map((idx) => idx % Math.max(patterns.length, 1));
        }

        const labels = { mars: 'Dust', jupiter: 'Giant', saturn: 'Ring', neptune: 'Ice', pluto: 'Kuiper' };
        return {
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
    },

    forPlanet(planetId) {
        const raw = String(planetId || 'mars').toLowerCase();
        if (raw === 'intro' || raw.indexOf('intro:') === 0) {
            return this.intro(raw.split(':')[1] || 'mars');
        }
        if (typeof this[raw] === 'function') return this[raw]();
        const id = this.normalizePlanetKey(raw);
        const wantBoss = raw.indexOf('boss') !== -1 || /-(?:boss|b)$/.test(raw);
        if (this.isHandcraftedPlanet(id)) {
            if (wantBoss) {
                const key = id + '-boss';
                if (typeof this[key] === 'function') return this[key]();
                return this._bossFor(id, 128);
            }
            if (typeof this[id] === 'function') return this[id]();
        }
        return this.remixPlanet(id, { boss: wantBoss });
    },

    allKeys() {
        return [
            'menu', 'intro',
            'mars', 'jupiter', 'saturn', 'neptune', 'pluto',
            'mars-boss', 'jupiter-boss', 'saturn-boss', 'neptune-boss', 'pluto-boss'
        ];
    }
};
