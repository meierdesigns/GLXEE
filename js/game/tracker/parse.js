"use strict";

/**
 * VF Tracker (.vftrack) — JSON chiptune format for LLM / code authored BGM.
 * Canonical schema lives in assets/soundtracks/template.vftrack.json.
 */
const VFTrackerParse = {
    SEMITONE: { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 },

    noteToMidi(note) {
        if (!note || typeof note !== 'string') return null;
        const s = note.trim().toUpperCase();
        if (s === 'OFF' || s === '===' || s === 'CUT') return 'OFF';
        if (s === '.' || s === '---' || s === '...') return null;
        // Tracker naturals: C-4 / sharps: C#4 / flats: Db4
        const m = /^([A-G])([#B-]?)(-?\d+)$/.exec(s);
        if (!m) return null;
        const letter = m[1];
        let acc = m[2];
        const oct = Number(m[3]);
        if (acc === '-' || acc === '') acc = '';
        if (acc === 'B') acc = 'b';
        let semi = this.SEMITONE[letter];
        if (acc === '#') semi += 1;
        if (acc === 'b') semi -= 1;
        return (oct + 1) * 12 + semi;
    },

    midiToFreq(midi) {
        return 440 * Math.pow(2, (midi - 69) / 12);
    },

    noteToFreq(note) {
        const midi = this.noteToMidi(note);
        if (midi == null || midi === 'OFF') return midi;
        return this.midiToFreq(midi);
    },

    midiToNote(midi) {
        const n = Math.round(Number(midi));
        if (!Number.isFinite(n)) return null;
        const NOTES = ['C-', 'C#', 'D-', 'D#', 'E-', 'F-', 'F#', 'G-', 'G#', 'A-', 'A#', 'B-'];
        const oct = Math.floor(n / 12) - 1;
        const name = NOTES[((n % 12) + 12) % 12];
        return name + oct;
    },

    transposeToken(token, semitones) {
        const cell = this.parseCell(token);
        if (!cell || !cell.note || cell.note === 'OFF') return token;
        const midi = this.noteToMidi(cell.note);
        if (midi == null || midi === 'OFF') return token;
        const next = this.midiToNote(midi + (Number(semitones) || 0));
        if (!next) return token;
        let out = next + ':' + (cell.inst || 1);
        if (cell.vol != null) out += ':' + cell.vol;
        return out;
    },

    transposeChannelString(str, semitones) {
        if (!semitones) return str;
        return String(str || '').trim().split(/\s+/).filter(Boolean)
            .map((tok) => this.transposeToken(tok, semitones)).join(' ');
    },

    parseCell(raw) {
        if (raw == null || raw === '' || raw === '.' || raw === '---' || raw === '...') {
            return null;
        }
        if (typeof raw === 'string') {
            const t = raw.trim();
            if (!t || t === '.' || t === '---') return null;
            if (t.toUpperCase() === 'OFF' || t === '===') return { note: 'OFF' };
            const parts = t.split(':');
            const note = parts[0];
            const inst = parts[1] != null && parts[1] !== '' ? Number(parts[1]) : 1;
            const vol = parts[2] != null && parts[2] !== '' ? Number(parts[2]) : null;
            return {
                note,
                inst: Number.isFinite(inst) ? inst : 1,
                vol: Number.isFinite(vol) ? vol : null
            };
        }
        if (Array.isArray(raw)) {
            return {
                note: raw[0] != null ? String(raw[0]) : null,
                inst: raw[1] != null ? Number(raw[1]) : 1,
                vol: raw[2] != null ? Number(raw[2]) : null
            };
        }
        if (typeof raw === 'object') {
            return {
                note: raw.note != null ? String(raw.note) : null,
                inst: raw.inst != null ? Number(raw.inst) : (raw.instrument != null ? Number(raw.instrument) : 1),
                vol: raw.vol != null ? Number(raw.vol) : (raw.volume != null ? Number(raw.volume) : null)
            };
        }
        return null;
    },

    padChannelString(str, rows) {
        const n = Math.max(1, Number(rows) || 16);
        const tokens = String(str || '').trim().split(/\s+/).filter(Boolean);
        while (tokens.length < n) tokens.push('.');
        return tokens.slice(0, n).join(' ');
    },

    expandChannelString(str, rows) {
        const tokens = String(str || '').trim().split(/\s+/).filter(Boolean);
        const out = [];
        for (let i = 0; i < rows; i++) {
            out.push(this.parseCell(tokens[i] != null ? tokens[i] : '.'));
        }
        return out;
    },

    normalizeInstrument(raw, index) {
        const r = raw || {};
        const id = r.id != null ? Number(r.id) : (index + 1);
        const wave = String(r.wave || r.type || 'square').toLowerCase();
        const allowed = { sine: 1, square: 1, sawtooth: 1, triangle: 1, noise: 1 };
        return {
            id,
            name: String(r.name || ('inst' + id)),
            wave: allowed[wave] ? wave : 'square',
            volume: Math.max(0, Math.min(1, r.volume != null ? Number(r.volume) : 0.5)),
            attack: Math.max(0.001, Number(r.attack != null ? r.attack : 0.01)),
            decay: Math.max(0.001, Number(r.decay != null ? r.decay : 0.08)),
            sustain: Math.max(0, Math.min(1, r.sustain != null ? Number(r.sustain) : 0.45)),
            release: Math.max(0.001, Number(r.release != null ? r.release : 0.12)),
            filter: r.filter != null ? Number(r.filter) : null
        };
    },

    normalizePattern(raw, channels, rowsPerPattern) {
        const rowsN = Math.max(1, Number(raw.rowsPerPattern || raw.length || rowsPerPattern) || 16);
        const chN = Math.max(1, channels | 0);
        const grid = [];
        for (let r = 0; r < rowsN; r++) {
            const row = [];
            for (let c = 0; c < chN; c++) row.push(null);
            grid.push(row);
        }

        if (Array.isArray(raw.rows)) {
            raw.rows.forEach((row, ri) => {
                if (ri >= rowsN || !Array.isArray(row)) return;
                row.forEach((cell, ci) => {
                    if (ci < chN) grid[ri][ci] = this.parseCell(cell);
                });
            });
        } else if (Array.isArray(raw.channels)) {
            raw.channels.forEach((chStr, ci) => {
                if (ci >= chN) return;
                const cells = this.expandChannelString(chStr, rowsN);
                for (let ri = 0; ri < rowsN; ri++) grid[ri][ci] = cells[ri];
            });
        } else if (Array.isArray(raw)) {
            // bare rows array
            raw.forEach((row, ri) => {
                if (ri >= rowsN || !Array.isArray(row)) return;
                row.forEach((cell, ci) => {
                    if (ci < chN) grid[ri][ci] = this.parseCell(cell);
                });
            });
        }

        return {
            id: raw.id != null ? Number(raw.id) : 0,
            rows: grid
        };
    },

    /**
     * Accepts a full track object or a JSON string. Returns a playable track
     * or throws with a short reason.
     */
    normalize(input) {
        let data = input;
        if (typeof input === 'string') {
            const trimmed = input.trim();
            if (!trimmed) throw new Error('empty track');
            data = JSON.parse(trimmed);
        }
        if (!data || typeof data !== 'object') throw new Error('track must be an object');

        const bpm = Math.max(60, Math.min(240, Number(data.bpm) || 120));
        // Legacy banks mark 16-step / 16th grids as rowsPerBeat:1 (kick every 4 rows).
        // MUSIC BPM is quarter-note tempo (beats/minute) — use rpb=4 so display matches
        // tapped downbeats: rowDur=(60/bpm)/4, kick-every-4-rows → bpm.
        let rowsPerBeat = Math.max(1, Math.min(8, Number(data.rowsPerBeat) || 1));
        if (rowsPerBeat === 1) rowsPerBeat = 4;
        const rowsPerPattern = Math.max(4, Math.min(128, Number(data.rowsPerPattern) || 16));
        const channels = Math.max(1, Math.min(8, Number(data.channels) || 4));

        const instruments = (Array.isArray(data.instruments) ? data.instruments : [])
            .map((inst, i) => this.normalizeInstrument(inst, i));
        if (!instruments.length) {
            instruments.push(this.normalizeInstrument({ id: 1, name: 'lead', wave: 'square' }, 0));
        }
        const byId = {};
        instruments.forEach((inst) => { byId[inst.id] = inst; });

        const patternsIn = Array.isArray(data.patterns) ? data.patterns : [];
        const patterns = patternsIn.map((p, i) => {
            const n = this.normalizePattern(p, channels, rowsPerPattern);
            if (p && p.id == null) n.id = i;
            return n;
        });
        if (!patterns.length) throw new Error('track needs at least one pattern');

        const patternById = {};
        patterns.forEach((p) => { patternById[p.id] = p; });

        let order = Array.isArray(data.order) ? data.order.map(Number) : patterns.map((p) => p.id);
        if (!order.length) order = [patterns[0].id];
        order = order.filter((id) => patternById[id]);
        if (!order.length) throw new Error('order references no valid patterns');

        const meta = data.meta && typeof data.meta === 'object' ? data.meta : {};
        return {
            format: 'vftrack',
            version: Number(data.version) || 1,
            meta: {
                title: String(meta.title || data.title || 'Untitled'),
                author: String(meta.author || ''),
                planet: meta.planet != null ? String(meta.planet) : '',
                notes: String(meta.notes || '')
            },
            bpm,
            rowsPerBeat,
            rowsPerPattern,
            channels,
            instruments,
            instrumentById: byId,
            patterns,
            patternById,
            order,
            loop: data.loop !== false
        };
    },

    /**
     * Compact export (channel strings) — best for LLM round-trips.
     */
    toCompact(track) {
        const t = this.normalize(track);
        return {
            format: 'vftrack',
            version: 1,
            meta: t.meta,
            bpm: t.bpm,
            rowsPerBeat: t.rowsPerBeat,
            rowsPerPattern: t.rowsPerPattern,
            channels: t.channels,
            instruments: t.instruments.map((i) => ({
                id: i.id,
                name: i.name,
                wave: i.wave,
                volume: i.volume,
                attack: i.attack,
                decay: i.decay,
                sustain: i.sustain,
                release: i.release,
                filter: i.filter
            })),
            patterns: t.patterns.map((p) => {
                const chans = [];
                for (let c = 0; c < t.channels; c++) {
                    const toks = p.rows.map((row) => {
                        const cell = row[c];
                        if (!cell || !cell.note) return '.';
                        if (cell.note === 'OFF') return 'OFF';
                        let s = cell.note + ':' + (cell.inst || 1);
                        if (cell.vol != null) s += ':' + cell.vol;
                        return s;
                    });
                    chans.push(toks.join(' '));
                }
                return { id: p.id, channels: chans };
            }),
            order: t.order,
            loop: t.loop
        };
    },

    isTrack(data) {
        try {
            this.normalize(data);
            return true;
        } catch (e) {
            return false;
        }
    }
};
