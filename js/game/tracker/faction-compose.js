"use strict";

/**
 * Faction skins on top of VF-GB-style planet tracks.
 * Voices stay in the Game Boy palette (wave/pulse/noise) — no modern synth sludge.
 */
const VFTrackerFactionCompose = {
    FACTIONS: ['terran', 'kronax', 'voidborn', 'pirate', 'machine'],

    styles: {
        terran: {
            label: 'Terran',
            bpmDelta: 2,
            transpose: 2,
            drums: [
                'C-2:5:64 . A-4:4:16 . C-2:5:50 . A-4:4:12 C-2:5:60 . A-4:4:16 . C-2:5:44 A-4:4:10 . .',
                'C-2:5:60 . A-4:4:14 C-2:5:38 . C-2:5:54 . A-4:4:14 . C-2:5:58 A-4:4:12 . A-4:4:08 C-2:5:42 A-4:4:10 .',
                'C-2:5:68 A-4:4:18 . A-4:4:10 C-2:5:54 A-4:4:14 A-4:4:08 . C-2:5:64 A-4:4:16 . A-4:4:08 C-2:5:46 A-4:4:10 .',
                'C-2:5:44 . . A-4:4:10 . . C-2:5:34 . . . A-4:4:08 . . . . .'
            ],
            instruments: [
                { id: 1, name: 'wave', wave: 'triangle', volume: 0.68, attack: 0.001, decay: 0.04, sustain: 0.58, release: 0.06, filter: 1800 },
                { id: 2, name: 'pulse1', wave: 'square', volume: 0.26, attack: 0.001, decay: 0.05, sustain: 0.32, release: 0.08, filter: 2400 },
                { id: 3, name: 'pulse2', wave: 'square', volume: 0.38, attack: 0.001, decay: 0.03, sustain: 0.3, release: 0.05 },
                { id: 4, name: 'noise', wave: 'noise', volume: 0.3, attack: 0.001, decay: 0.025, sustain: 0.01, release: 0.02 },
                { id: 5, name: 'kick', wave: 'triangle', volume: 0.76, attack: 0.001, decay: 0.07, sustain: 0.05, release: 0.04, filter: 400 }
            ]
        },
        kronax: {
            label: 'Kronax',
            bpmDelta: 8,
            transpose: -2,
            drums: [
                'A-2:5:72 A-4:4:20 A-2:5:42 A-4:4:12 A-2:5:64 A-4:4:18 A-4:4:10 . A-2:5:70 A-4:4:18 A-2:5:40 A-4:4:12 A-2:5:58 A-4:4:14 .',
                'A-2:5:68 . A-4:4:16 A-2:5:46 . A-2:5:62 A-4:4:18 . A-4:4:10 A-2:5:66 A-4:4:16 . A-4:4:08 A-2:5:52 A-4:4:12 .',
                'A-2:5:76 A-4:4:22 A-2:5:48 A-4:4:14 A-2:5:68 A-4:4:18 A-4:4:10 A-4:4:06 A-2:5:72 A-4:4:20 A-2:5:44 A-4:4:12 A-2:5:60 A-4:4:14 A-4:4:08 .',
                'A-2:5:50 A-4:4:12 . . A-2:5:38 . A-4:4:08 . A-2:5:44 . . A-4:4:08 . . . .'
            ],
            instruments: [
                { id: 1, name: 'wave', wave: 'triangle', volume: 0.74, attack: 0.001, decay: 0.03, sustain: 0.62, release: 0.05, filter: 2200 },
                { id: 2, name: 'pulse1', wave: 'square', volume: 0.28, attack: 0.001, decay: 0.04, sustain: 0.32, release: 0.06, filter: 2400 },
                { id: 3, name: 'pulse2', wave: 'square', volume: 0.4, attack: 0.001, decay: 0.025, sustain: 0.28, release: 0.04 },
                { id: 4, name: 'noise', wave: 'noise', volume: 0.36, attack: 0.001, decay: 0.02, sustain: 0.01, release: 0.02 },
                { id: 5, name: 'kick', wave: 'triangle', volume: 0.8, attack: 0.001, decay: 0.06, sustain: 0.04, release: 0.04, filter: 350 }
            ]
        },
        voidborn: {
            label: 'Voidborn',
            bpmDelta: -4,
            transpose: 3,
            drums: [
                '. A-4:4:12 . . . A-4:4:08 . . . A-4:4:12 . . . A-4:4:06 . .',
                '. . A-4:4:10 . . . A-4:4:06 . . A-4:4:10 . . . . A-4:4:05 .',
                'B-1:5:44 . A-4:4:12 . . A-4:4:08 . B-1:5:36 . A-4:4:12 . . A-4:4:06 . . .',
                '. . . A-4:4:06 . . . . . . . A-4:4:05 . . . .'
            ],
            instruments: [
                { id: 1, name: 'wave', wave: 'triangle', volume: 0.58, attack: 0.004, decay: 0.08, sustain: 0.55, release: 0.12, filter: 900 },
                { id: 2, name: 'pulse1', wave: 'square', volume: 0.22, attack: 0.003, decay: 0.08, sustain: 0.3, release: 0.12, filter: 1800 },
                { id: 3, name: 'pulse2', wave: 'square', volume: 0.34, attack: 0.002, decay: 0.06, sustain: 0.3, release: 0.1 },
                { id: 4, name: 'noise', wave: 'noise', volume: 0.2, attack: 0.002, decay: 0.05, sustain: 0.01, release: 0.04 },
                { id: 5, name: 'kick', wave: 'triangle', volume: 0.62, attack: 0.002, decay: 0.1, sustain: 0.08, release: 0.08, filter: 500 }
            ]
        },
        pirate: {
            label: 'Pirate',
            bpmDelta: 4,
            transpose: -1,
            drums: [
                'C-2:5:66 A-4:4:18 . A-4:4:10 C-2:5:52 . A-4:4:14 A-4:4:08 C-2:5:64 A-4:4:16 . A-4:4:08 C-2:5:46 A-4:4:12 . .',
                'C-2:5:60 . A-4:4:14 . C-2:5:46 A-4:4:12 . A-4:4:08 C-2:5:58 . A-4:4:14 C-2:5:40 . A-4:4:10 A-4:4:06 .',
                'C-2:5:70 A-4:4:20 C-2:5:44 A-4:4:12 C-2:5:58 A-4:4:16 A-4:4:08 A-4:4:05 C-2:5:66 A-4:4:18 C-2:5:42 A-4:4:10 C-2:5:52 A-4:4:12 A-4:4:08 .',
                'C-2:5:46 . A-4:4:10 . . A-4:4:06 . C-2:5:36 . . A-4:4:08 . . . . .'
            ],
            instruments: [
                { id: 1, name: 'wave', wave: 'triangle', volume: 0.66, attack: 0.001, decay: 0.04, sustain: 0.55, release: 0.06, filter: 1600 },
                { id: 2, name: 'pulse1', wave: 'square', volume: 0.26, attack: 0.001, decay: 0.04, sustain: 0.28, release: 0.07, filter: 2400 },
                { id: 3, name: 'pulse2', wave: 'square', volume: 0.38, attack: 0.001, decay: 0.03, sustain: 0.28, release: 0.05 },
                { id: 4, name: 'noise', wave: 'noise', volume: 0.34, attack: 0.001, decay: 0.025, sustain: 0.01, release: 0.02 },
                { id: 5, name: 'kick', wave: 'triangle', volume: 0.78, attack: 0.001, decay: 0.07, sustain: 0.05, release: 0.04, filter: 380 }
            ]
        },
        machine: {
            label: 'Machine',
            bpmDelta: 6,
            transpose: 0,
            drums: [
                'C-2:5:62 A-4:4:14 C-2:5:34 A-4:4:10 C-2:5:62 A-4:4:14 C-2:5:34 A-4:4:10 C-2:5:62 A-4:4:14 C-2:5:34 A-4:4:10 C-2:5:54 A-4:4:12 A-4:4:08 .',
                'C-2:5:58 A-4:4:12 . A-4:4:08 C-2:5:58 A-4:4:12 . A-4:4:08 C-2:5:58 A-4:4:12 C-2:5:34 A-4:4:08 C-2:5:50 A-4:4:10 A-4:4:06 .',
                'C-2:5:68 A-4:4:18 C-2:5:40 A-4:4:12 C-2:5:62 A-4:4:14 A-4:4:08 A-4:4:05 C-2:5:66 A-4:4:16 C-2:5:38 A-4:4:10 C-2:5:56 A-4:4:12 A-4:4:08 .',
                'C-2:5:42 A-4:4:10 . . C-2:5:32 A-4:4:06 . . C-2:5:36 . A-4:4:08 . . . . .'
            ],
            instruments: [
                { id: 1, name: 'wave', wave: 'square', volume: 0.62, attack: 0.001, decay: 0.03, sustain: 0.58, release: 0.04, filter: 1200 },
                { id: 2, name: 'pulse1', wave: 'square', volume: 0.24, attack: 0.001, decay: 0.03, sustain: 0.3, release: 0.04, filter: 2200 },
                { id: 3, name: 'pulse2', wave: 'square', volume: 0.38, attack: 0.001, decay: 0.025, sustain: 0.28, release: 0.03 },
                { id: 4, name: 'noise', wave: 'noise', volume: 0.32, attack: 0.001, decay: 0.018, sustain: 0.01, release: 0.015 },
                { id: 5, name: 'kick', wave: 'triangle', volume: 0.78, attack: 0.001, decay: 0.05, sustain: 0.04, release: 0.03, filter: 400 }
            ]
        }
    },

    normalizeFaction(id) {
        const f = String(id || '').toLowerCase();
        return this.FACTIONS.indexOf(f) !== -1 ? f : '';
    },

    styleOf(factionId) {
        const f = this.normalizeFaction(factionId) || 'pirate';
        return this.styles[f] || this.styles.pirate;
    },

    /**
     * Planet arrangement (handcrafted or remix) + faction instruments.
     * Melodies stay planet-owned. Faction drums only on fill patterns so the
     * planet groove survives; light transpose for faction colour.
     */
    composeCombat(planetId, factionId, opts) {
        const planet = (typeof VFTrackerDefaults !== 'undefined' && VFTrackerDefaults.normalizePlanetKey)
            ? VFTrackerDefaults.normalizePlanetKey(planetId)
            : String(planetId || 'mars').toLowerCase().split('-')[0];
        const boss = !!(opts && opts.boss);
        const faction = this.normalizeFaction(factionId) || 'pirate';
        const style = this.styleOf(faction);
        const baseRaw = VFTrackerDefaults.forPlanet(boss ? (planet + '-boss') : planet);
        const compact = VFTrackerParse.toCompact(baseRaw);
        compact.bpm = Math.max(70, Math.min(160, Number(compact.bpm) + Math.round(style.bpmDelta * 0.35)));
        compact.instruments = style.instruments.map((i) => Object.assign({}, i));
        compact.meta = {
            title: ((compact.meta && compact.meta.title) || planet) + ' / ' + style.label + (boss ? ' BOSS' : ''),
            author: 'VF Tracker',
            planet: planet,
            faction: faction,
            notes: (boss ? 'boss ' : '') + 'combat vs ' + faction
        };
        const drumBank = Array.isArray(style.drums) ? style.drums : [style.drums];
        const pad = (s) => VFTrackerParse.padChannelString(s, 16);
        const transpose = Math.max(-2, Math.min(2, Math.round(style.transpose / 2)));
        compact.patterns = (compact.patterns || []).map((p, pi) => ({
            id: p.id,
            channels: (p.channels || []).map((ch, i) => {
                // Keep planet drums on A/B; faction drums on chorus/fill only.
                if (i === 3 && drumBank.length && ((pi % 4) === 2 || (pi % 4) === 3)) {
                    return pad(drumBank[pi % drumBank.length] || drumBank[0]);
                }
                const melodic = transpose
                    ? VFTrackerParse.transposeChannelString(ch, transpose)
                    : ch;
                if (i === 2 && (pi % 4) === 3) {
                    return pad(String(melodic).split(/\s+/).map((tok, ti) => (ti % 2 ? '.' : tok)).join(' '));
                }
                return pad(melodic);
            })
        }));
        return compact;
    },

    factionTheme(factionId) {
        const faction = this.normalizeFaction(factionId) || 'pirate';
        const style = this.styleOf(faction);
        const roots = {
            terran: { bass: 'G-1', lead: 'G-3', arp: 'G-4' },
            kronax: { bass: 'E-1', lead: 'E-3', arp: 'E-4' },
            voidborn: { bass: 'B-1', lead: 'B-3', arp: 'F#4' },
            pirate: { bass: 'D-1', lead: 'D-3', arp: 'A-3' },
            machine: { bass: 'C-2', lead: 'C-4', arp: 'G-4' }
        }[faction];
        const pad = (s) => VFTrackerParse.padChannelString(s, 16);
        const drums0 = Array.isArray(style.drums) ? style.drums[0] : style.drums;
        const drums1 = Array.isArray(style.drums) ? (style.drums[1] || style.drums[0]) : style.drums;
        return {
            format: 'vftrack',
            version: 1,
            meta: {
                title: style.label + ' Doctrine',
                author: 'VF Tracker',
                planet: '',
                faction: faction,
                notes: 'faction combat theme'
            },
            bpm: Math.max(80, Math.min(140, 100 + style.bpmDelta)),
            rowsPerBeat: 1,
            rowsPerPattern: 16,
            channels: 4,
            instruments: style.instruments.map((i) => Object.assign({}, i)),
            patterns: [{
                id: 0,
                channels: [
                    pad(roots.bass + ':1:64 . . . ' + roots.bass + ':1:48 . . . ' + roots.bass + ':1:56 . . . ' + roots.bass + ':1:40 . . .'),
                    pad(roots.lead + ':2:44 . . ' + roots.lead + ':2:36 . . ' + roots.lead + ':2:40 . . ' + roots.lead + ':2:32 . . .'),
                    pad(roots.arp + ':3:26 . ' + roots.arp + ':3:18 . ' + roots.arp + ':3:22 . ' + roots.arp + ':3:16 . ' + roots.arp + ':3:26 . ' + roots.arp + ':3:18 . ' + roots.arp + ':3:20 . .'),
                    pad(drums0)
                ]
            }, {
                id: 1,
                channels: [
                    pad(roots.bass + ':1:56 . ' + roots.bass + ':1:36 . ' + roots.bass + ':1:48 . . . ' + roots.bass + ':1:40 . ' + roots.bass + ':1:32 . . .'),
                    pad(roots.lead + ':2:40 . . ' + roots.lead + ':2:32 . . ' + roots.lead + ':2:36 . . ' + roots.lead + ':2:28 OFF . .'),
                    pad(roots.arp + ':3:20 . . ' + roots.arp + ':3:14 . ' + roots.arp + ':3:18 . . ' + roots.arp + ':3:12 . . ' + roots.arp + ':3:16 . .'),
                    pad(drums1)
                ]
            }, {
                id: 2,
                channels: [
                    pad(roots.bass + ':1:70 ' + roots.bass + ':1:40 . ' + roots.bass + ':1:52 ' + roots.bass + ':1:60 . . ' + roots.bass + ':1:48 . ' + roots.bass + ':1:36 . ' + roots.bass + ':1:44 . .'),
                    pad(roots.lead + ':2:52 . ' + roots.lead + ':2:40 . ' + roots.lead + ':2:48 . ' + roots.lead + ':2:36 ' + roots.lead + ':2:44 . ' + roots.lead + ':2:32 . OFF .'),
                    pad(roots.arp + ':3:28 ' + roots.arp + ':3:16 . ' + roots.arp + ':3:22 . ' + roots.arp + ':3:18 ' + roots.arp + ':3:26 . ' + roots.arp + ':3:14 . ' + roots.arp + ':3:20 .'),
                    pad(Array.isArray(style.drums) ? (style.drums[2] || drums0) : drums0)
                ]
            }],
            order: [0, 0, 1, 0, 2, 1, 0, 1],
            loop: true
        };
    },

    _endingTrack(kind, factionId, planetId) {
        const faction = this.normalizeFaction(factionId) || 'pirate';
        const style = this.styleOf(faction);
        const planet = planetId ? String(planetId).toLowerCase().split('-')[0] : '';
        const win = kind === 'victory';
        const bpm = win
            ? Math.max(90, Math.min(140, 112 + Math.floor(style.bpmDelta / 2)))
            : Math.max(70, Math.min(110, 84 + Math.floor(style.bpmDelta / 3)));
        const pad = (s) => VFTrackerParse.padChannelString(s, 16);
        const a = (win ? this._victoryPattern(faction) : this._losePattern(faction)).map(pad);
        const b = (win ? this._victoryBridge(faction) : this._loseBridge(faction)).map(pad);
        return {
            format: 'vftrack',
            version: 1,
            meta: {
                title: (win ? 'Victory' : 'Defeat') + ' — ' + style.label + (planet ? ' @ ' + planet : ''),
                author: 'VF Tracker',
                planet: planet,
                faction: faction,
                notes: kind + ' screen'
            },
            bpm,
            rowsPerBeat: 1,
            rowsPerPattern: 16,
            channels: 4,
            instruments: style.instruments.map((i) => Object.assign({}, i)),
            patterns: [
                { id: 0, channels: a },
                { id: 1, channels: b }
            ],
            order: win ? [0, 0, 1, 0] : [0, 1, 0, 0],
            loop: true
        };
    },

    _victoryPattern(faction) {
        const table = {
            terran: [
                'C-2:1:60 . E-2:1:48 . G-2:1:56 . . . C-3:1:52 . . . G-2:1:44 . . .',
                'E-4:2:48 . G-4:2:40 . C-5:2:52 . G-4:2:36 E-4:2:44 . D-4:2:36 . C-4:2:40 . . . .',
                'C-5:3:24 G-4:3:16 E-4:3:16 G-4:3:16 C-5:3:24 G-4:3:16 E-4:3:16 G-4:3:16 E-5:3:26 C-5:3:18 G-4:3:18 C-5:3:18 E-5:3:26 C-5:3:16 G-4:3:14 E-4:3:14',
                'C-2:5:68 . A-4:4:22 . C-2:5:52 . A-4:4:20 . C-2:5:68 . A-4:4:22 . C-2:5:48 A-4:4:16 . .'
            ],
            kronax: [
                'E-1:1:70 E-1:1:40 . G-1:1:56 B-1:1:64 . . E-2:1:60 . B-1:1:48 . G-1:1:44 . . . .',
                'E-3:2:52 . G-3:2:44 . B-3:2:56 . D-4:2:48 E-4:2:60 . B-3:2:44 . G-3:2:40 . . . .',
                'E-4:3:28 B-3:3:20 G-3:3:20 B-3:3:20 E-4:3:28 B-3:3:20 G-3:3:20 B-3:3:20 G-4:3:30 D-4:3:22 B-3:3:22 D-4:3:22 G-4:3:30 E-4:3:20 B-3:3:18 G-3:3:18',
                'E-1:5:82 A-4:4:34 E-1:5:50 A-4:4:24 E-1:5:74 A-4:4:30 A-4:4:18 . E-1:5:82 A-4:4:34 E-1:5:50 A-4:4:24 E-1:5:70 A-4:4:28 A-4:4:20 A-4:4:14'
            ],
            voidborn: [
                'B-1:1:48 . . . F#1:1:36 . . . A-1:1:44 . . . E-1:1:32 . . .',
                'B-3:2:36 . D#4:2:30 . F#4:2:40 . . A-3:2:32 . C#4:2:28 . E-4:2:36 . . . .',
                'B-4:3:20 F#4:3:12 D#4:3:12 F#4:3:12 B-4:3:22 F#4:3:12 D#4:3:12 F#4:3:12 A-4:3:18 E-4:3:12 C#4:3:12 E-4:3:12 A-4:3:18 F#4:3:10 D#4:3:10 B-3:3:10',
                '. A-4:4:14 . . . A-4:4:12 . . . A-4:4:16 . . . A-4:4:10 . .'
            ],
            pirate: [
                'D-1:1:64 . F-1:1:48 . A-1:1:56 . . . D-2:1:52 . C-2:1:44 . A-1:1:40 . . .',
                'D-4:2:46 . F-4:2:38 . A-4:2:50 . F-4:2:34 D-4:2:42 . C-4:2:36 . A-3:2:40 . . . .',
                'D-5:3:24 A-4:3:16 F-4:3:16 A-4:3:16 D-5:3:24 A-4:3:16 F-4:3:16 A-4:3:16 C-5:3:22 G-4:3:14 E-4:3:14 G-4:3:14 C-5:3:22 A-4:3:14 F-4:3:12 D-4:3:12',
                'D-1:5:74 A-4:4:30 . A-4:4:20 D-1:5:58 . A-4:4:26 . D-1:5:74 A-4:4:30 . A-4:4:20 D-1:5:52 A-4:4:22 A-4:4:16 .'
            ],
            machine: [
                'C-2:1:64 C-2:1:36 G-1:1:48 G-1:1:28 C-2:1:64 C-2:1:36 G-1:1:48 G-1:1:28 C-2:1:64 C-2:1:36 E-2:1:52 E-2:1:32 G-2:1:56 G-2:1:36 C-3:1:60 .',
                'C-4:2:40 E-4:2:34 G-4:2:40 E-4:2:30 C-4:2:40 E-4:2:34 G-4:2:40 E-4:2:30 C-4:2:42 E-4:2:36 G-4:2:44 B-4:2:38 C-5:2:48 . G-4:2:36 .',
                'C-5:3:22 G-4:3:14 E-4:3:14 G-4:3:14 C-5:3:22 G-4:3:14 E-4:3:14 G-4:3:14 E-5:3:24 C-5:3:16 G-4:3:16 C-5:3:16 E-5:3:24 C-5:3:14 G-4:3:12 E-4:3:12',
                'C-2:5:70 A-4:4:26 C-2:5:40 A-4:4:20 C-2:5:70 A-4:4:26 C-2:5:40 A-4:4:20 C-2:5:70 A-4:4:26 C-2:5:40 A-4:4:20 C-2:5:70 A-4:4:26 A-4:4:18 A-4:4:12'
            ]
        };
        return table[faction] || table.pirate;
    },

    _losePattern(faction) {
        const table = {
            terran: [
                'A-1:1:50 . . . E-1:1:36 . . . F-1:1:40 . . . E-1:1:30 . . .',
                'A-3:2:32 . . C-4:2:26 . . E-3:2:28 . . . C-3:2:22 . . . . .',
                'A-4:3:16 E-4:3:10 C-4:3:10 E-4:3:10 A-4:3:14 E-4:3:10 C-4:3:10 E-4:3:08 G-4:3:12 D-4:3:08 B-3:3:08 D-4:3:08 E-4:3:12 C-4:3:08 A-3:3:08 E-3:3:08',
                'A-1:5:48 . . A-4:4:12 . . A-1:5:36 . . . A-4:4:10 . . . . .'
            ],
            kronax: [
                'E-1:1:58 . E-1:1:30 . . G-1:1:40 . . B-0:1:36 . . . E-1:1:28 . . .',
                'E-3:2:36 . . G-3:2:28 . . B-2:2:30 . . . G-2:2:24 . . . . .',
                'E-4:3:18 B-3:3:12 G-3:3:12 B-3:3:12 E-4:3:16 B-3:3:10 G-3:3:10 B-3:3:08 D-4:3:14 A-3:3:08 F#3:3:08 A-3:3:08 B-3:3:12 G-3:3:08 E-3:3:08 B-2:3:08',
                'E-1:5:60 A-4:4:18 . . E-1:5:40 . A-4:4:14 . E-1:5:48 . . A-4:4:12 . . . .'
            ],
            voidborn: [
                'B-0:1:40 . . . . . F#0:1:28 . . . . . E-0:1:24 . . .',
                'B-2:2:24 . . . D#3:2:18 . . . F#3:2:20 . . . . . . .',
                'B-3:3:12 F#3:3:08 . F#3:3:08 B-3:3:10 . D#3:3:08 . A-3:3:10 E-3:3:08 . E-3:3:08 A-3:3:08 . C#3:3:06 .',
                '. . A-4:4:08 . . . . . . . A-4:4:06 . . . . .'
            ],
            pirate: [
                'D-1:1:52 . . F-1:1:34 . . A-0:1:30 . . . D-1:1:26 . . . . .',
                'D-3:2:30 . . F-3:2:24 . . A-2:2:26 . . . F-2:2:20 . . . . .',
                'D-4:3:16 A-3:3:10 F-3:3:10 A-3:3:10 D-4:3:14 A-3:3:08 F-3:3:08 A-3:3:08 C-4:3:12 G-3:3:08 E-3:3:08 G-3:3:08 A-3:3:10 F-3:3:06 D-3:3:06 A-2:3:06',
                'D-1:5:55 . A-4:4:16 . D-1:5:38 . A-4:4:12 . D-1:5:44 . . A-4:4:10 . . . .'
            ],
            machine: [
                'C-1:1:48 C-1:1:24 . . G-0:1:32 G-0:1:18 . . C-1:1:40 C-1:1:20 . . E-0:1:28 . . .',
                'C-3:2:28 . E-3:2:22 . G-3:2:26 . . . C-3:2:22 . . . G-2:2:18 . . .',
                'C-4:3:14 G-3:3:08 E-3:3:08 G-3:3:08 C-4:3:12 G-3:3:08 E-3:3:08 G-3:3:06 B-3:3:12 F#3:3:06 D#3:3:06 F#3:3:06 G-3:3:10 E-3:3:06 C-3:3:06 G-2:3:06',
                'C-1:5:52 A-4:4:16 C-1:5:28 A-4:4:12 C-1:5:44 A-4:4:14 . . C-1:5:40 A-4:4:12 . . C-1:5:32 . . .'
            ]
        };
        return table[faction] || table.pirate;
    },

    _victoryBridge(faction) {
        const table = {
            terran: [
                'G-1:1:52 . . B-1:1:40 . . C-2:1:48 . . . E-2:1:44 . . G-2:1:50 . .',
                'G-4:2:42 . B-4:2:36 . C-5:2:46 . . D-5:2:40 . C-5:2:36 . B-4:2:32 . . . .',
                'G-4:3:18 D-4:3:12 . D-4:3:12 G-4:3:18 . B-4:3:22 . D-4:3:12 G-4:3:16 . E-4:3:12 . D-4:3:10 . .',
                'C-2:5:60 . A-4:4:18 . C-2:5:44 . A-4:4:14 . C-2:5:56 . A-4:4:16 . A-4:4:12 . . .'
            ],
            kronax: [
                'G-1:1:60 . B-1:1:48 . D-2:1:56 . . E-2:1:52 . . B-1:1:40 . G-1:1:36 . . .',
                'G-3:2:48 . B-3:2:40 . D-4:2:52 . E-4:2:46 G-4:2:54 . D-4:2:40 . B-3:2:36 . . . .',
                'G-4:3:24 D-4:3:16 . D-4:3:16 G-4:3:24 . B-4:3:28 . D-4:3:16 G-4:3:20 . E-4:3:14 . D-4:3:12 . .',
                'E-1:5:70 A-4:4:26 . A-4:4:16 E-1:5:52 . A-4:4:20 . E-1:5:64 A-4:4:22 A-4:4:12 . . . . .'
            ],
            voidborn: [
                'F#1:1:40 . . . A-1:1:34 . . . C#2:1:38 . . . B-1:1:30 . . .',
                'F#3:2:30 . A-3:2:26 . C#4:2:34 . . E-4:2:28 . C#4:2:24 . A-3:2:22 . . . .',
                'F#4:3:16 C#4:3:10 . C#4:3:10 F#4:3:16 . A-4:3:18 . C#4:3:10 F#4:3:14 . E-4:3:10 . C#4:3:08 . .',
                '. A-4:4:12 . . . A-4:4:08 . . . A-4:4:10 . . . A-4:4:06 . .'
            ],
            pirate: [
                'A-1:1:56 . C-2:1:44 . E-2:1:52 . . F-2:1:48 . D-2:1:40 . A-1:1:36 . . . .',
                'A-3:2:42 . C-4:2:36 . E-4:2:46 . F-4:2:40 A-4:2:48 . E-4:2:36 . C-4:2:32 . . . .',
                'A-4:3:20 E-4:3:12 . E-4:3:12 A-4:3:20 . C-5:3:24 . E-4:3:12 A-4:3:16 . G-4:3:12 . E-4:3:10 . .',
                'D-1:5:64 A-4:4:24 . A-4:4:14 D-1:5:48 . A-4:4:18 . D-1:5:58 A-4:4:20 A-4:4:12 . . . . .'
            ],
            machine: [
                'E-2:1:56 E-2:1:30 G-2:1:44 G-2:1:26 E-2:1:56 E-2:1:30 G-2:1:44 G-2:1:26 C-3:1:60 C-3:1:34 E-3:1:48 E-3:1:30 G-3:1:54 . C-4:1:58 .',
                'E-4:2:38 G-4:2:32 B-4:2:40 G-4:2:28 E-4:2:38 G-4:2:32 B-4:2:40 G-4:2:28 C-5:2:44 E-5:2:36 G-5:2:42 . E-5:2:34 . C-5:2:30 .',
                'E-5:3:20 B-4:3:12 G-4:3:12 B-4:3:12 E-5:3:20 B-4:3:12 G-4:3:12 B-4:3:12 G-5:3:22 E-5:3:14 C-5:3:14 E-5:3:14 G-5:3:22 E-5:3:12 C-5:3:10 G-4:3:10',
                'C-2:5:66 A-4:4:22 C-2:5:36 A-4:4:16 C-2:5:66 A-4:4:22 C-2:5:36 A-4:4:16 C-2:5:62 A-4:4:20 A-4:4:12 . A-4:4:10 . . .'
            ]
        };
        return table[faction] || table.pirate;
    },

    _loseBridge(faction) {
        const table = {
            terran: [
                'F-1:1:40 . . . C-1:1:28 . . . D-1:1:32 . . . C-1:1:24 . . .',
                'F-3:2:26 . . A-3:2:20 . . C-3:2:22 . . . A-2:2:18 . . . . .',
                'F-4:3:12 C-4:3:08 . C-4:3:08 F-4:3:10 . A-3:3:08 . E-4:3:10 C-4:3:06 . C-4:3:06 E-4:3:08 . A-3:3:06 .',
                'A-1:5:36 . . A-4:4:08 . . A-1:5:28 . . . A-4:4:06 . . . . .'
            ],
            kronax: [
                'D-1:1:44 . . E-1:1:32 . . G-0:1:28 . . . D-1:1:24 . . . . .',
                'D-3:2:28 . . E-3:2:22 . . G-2:2:24 . . . E-2:2:18 . . . . .',
                'D-4:3:14 A-3:3:08 . A-3:3:08 D-4:3:12 . F#3:3:08 . B-3:3:10 G-3:3:06 . G-3:3:06 B-3:3:08 . E-3:3:06 .',
                'E-1:5:44 A-4:4:12 . . E-1:5:30 . A-4:4:08 . E-1:5:36 . . A-4:4:08 . . . .'
            ],
            voidborn: [
                'A-0:1:30 . . . . . E-0:1:22 . . . . . F#0:1:18 . . .',
                'A-2:2:18 . . . C#3:2:14 . . . E-3:2:16 . . . . . . .',
                'A-3:3:10 E-3:3:06 . E-3:3:06 A-3:3:08 . C#3:3:06 . G-3:3:08 E-3:3:06 . E-3:3:06 G-3:3:06 . B-2:3:04 .',
                '. . A-4:4:06 . . . . . . . A-4:4:04 . . . . .'
            ],
            pirate: [
                'C-1:1:40 . . D-1:1:28 . . F-0:1:24 . . . C-1:1:20 . . . . .',
                'C-3:2:24 . . D-3:2:18 . . F-2:2:20 . . . D-2:2:16 . . . . .',
                'C-4:3:12 G-3:3:06 . G-3:3:06 C-4:3:10 . E-3:3:06 . A-3:3:08 F-3:3:06 . F-3:3:06 A-3:3:06 . D-3:3:04 .',
                'D-1:5:40 . A-4:4:10 . D-1:5:28 . A-4:4:08 . D-1:5:32 . . A-4:4:06 . . . .'
            ],
            machine: [
                'G-0:1:36 G-0:1:18 . . E-0:1:28 E-0:1:14 . . G-0:1:32 G-0:1:16 . . C-0:1:24 . . .',
                'G-2:2:22 . B-2:2:16 . D-3:2:20 . . . G-2:2:18 . . . D-2:2:14 . . .',
                'G-3:3:12 D-3:3:06 . D-3:3:06 G-3:3:10 . B-2:3:06 . F#3:3:10 D-3:3:06 . D-3:3:06 F#3:3:08 . B-2:3:04 .',
                'C-1:5:40 A-4:4:12 C-1:5:22 A-4:4:08 C-1:5:34 A-4:4:10 . . C-1:5:30 A-4:4:08 . . . . . .'
            ]
        };
        return table[faction] || table.pirate;
    },

    victory(factionId, planetId) {
        return this._endingTrack('victory', factionId, planetId);
    },

    lose(factionId, planetId) {
        return this._endingTrack('lose', factionId, planetId);
    },

    /**
     * Resolve a library / playback key to a raw track object, or null.
     * Keys: victory[:faction][:planet], lose..., planet[:faction], planet-boss[:faction], faction:id
     */
    /**
     * Planet intro fanfare skinned with faction instruments/drums/transpose.
     */
    composeIntro(planetId, factionId) {
        const planet = (typeof VFTrackerDefaults !== 'undefined' && VFTrackerDefaults.normalizePlanetKey)
            ? VFTrackerDefaults.normalizePlanetKey(planetId)
            : String(planetId || 'mars').toLowerCase().split('-')[0];
        const faction = this.normalizeFaction(factionId);
        const base = VFTrackerDefaults.intro(planet);
        if (!faction) {
            return Object.assign({}, base, { loop: false });
        }
        const style = this.styleOf(faction);
        const compact = VFTrackerParse.toCompact(base);
        compact.loop = false;
        compact.bpm = Math.max(90, Math.min(150, Number(compact.bpm) + Math.floor(style.bpmDelta / 2)));
        compact.instruments = style.instruments.map((i) => Object.assign({}, i));
        compact.meta = Object.assign({}, compact.meta, {
            title: (compact.meta.title || 'Intro') + ' / ' + style.label,
            faction: faction,
            notes: 'mission intro vs ' + faction
        });
        const drumBank = Array.isArray(style.drums) ? style.drums : [style.drums];
        const pad = (s) => VFTrackerParse.padChannelString(s, 16);
        compact.patterns = (compact.patterns || []).map((p, pi) => ({
            id: p.id,
            channels: (p.channels || []).map((ch, i) => {
                if (i === 3 && drumBank.length) {
                    return pad(drumBank[pi % drumBank.length] || drumBank[0]);
                }
                return pad(VFTrackerParse.transposeChannelString(ch, style.transpose));
            })
        }));
        return compact;
    },

    resolveKey(key) {
        const k = String(key || '').toLowerCase().trim();
        if (!k) return null;

        let         m = /^intro(?::([a-z0-9_-]+))?(?::([a-z0-9_-]+))?$/.exec(k);
        if (m) {
            const a = m[1] || '';
            const b = m[2] || '';
            const planets = (VFTrackerDefaults && VFTrackerDefaults.PLANETS) ||
                ['mars', 'jupiter', 'saturn', 'neptune', 'pluto'];
            let planet = 'mars';
            let faction = '';
            if (a && planets.indexOf(a) !== -1) {
                planet = a;
                faction = this.normalizeFaction(b);
            } else if (a && this.normalizeFaction(a)) {
                faction = a;
                planet = (b && planets.indexOf(b) !== -1) ? b : 'mars';
            } else if (a) {
                planet = (VFTrackerDefaults && VFTrackerDefaults.normalizePlanetKey)
                    ? VFTrackerDefaults.normalizePlanetKey(a)
                    : a.split('-')[0];
            }
            return this.composeIntro(planet, faction);
        }

        m = /^(victory|lose)(?::([a-z0-9_-]+))?(?::([a-z0-9_-]+))?$/.exec(k);
        if (m) {
            const kind = m[1];
            const a = m[2] || '';
            const b = m[3] || '';
            let faction = this.normalizeFaction(a);
            let planet = '';
            if (faction && b) {
                planet = (VFTrackerDefaults && VFTrackerDefaults.normalizePlanetKey)
                    ? VFTrackerDefaults.normalizePlanetKey(b)
                    : b.split('-')[0];
            } else if (!faction && a) {
                // victory:mars or victory:pirate
                if (this.normalizeFaction(a)) faction = a;
                else {
                    planet = (VFTrackerDefaults && VFTrackerDefaults.normalizePlanetKey)
                        ? VFTrackerDefaults.normalizePlanetKey(a)
                        : a.split('-')[0];
                }
            }
            return kind === 'victory' ? this.victory(faction, planet) : this.lose(faction, planet);
        }

        m = /^faction:([a-z]+)$/.exec(k);
        if (m) return this.factionTheme(m[1]);

        // Any planet slug (mars, ambush_x, mil_pir_x1_ab12) ± boss ± faction.
        m = /^([a-z][a-z0-9_]*)(-boss)?(?::([a-z]+))?$/.exec(k);
        if (m) {
            const planet = m[1];
            const boss = !!m[2];
            const faction = this.normalizeFaction(m[3]);
            if (planet === 'menu' || planet === 'intro' || planet === 'victory' || planet === 'lose'
                || planet === 'faction' || planet === 'station' || planet === 'hub') {
                return null;
            }
            if (faction) return this.composeCombat(planet, faction, { boss: boss });
            return null; // plain planet / boss handled by VFTrackerDefaults
        }
        return null;
    }
};
