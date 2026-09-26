"use strict";

// PlanetConfigManager methods: galaxy control. A galaxy is either HELD by
// its single faction or CONTESTED — its main faction (getGalaxyFaction)
// fights one or more rivals. Contested galaxies seed frontline planets
// that mix two factions, hit harder and pay out more.

// Built-in galaxies; any other galaxy gets a seeded default.
const GALAXY_CONTROL_DEFAULTS = {
    milky_way: { control: 'contested', rivals: ['pirate'] },
    andromeda: { control: 'contested', rivals: ['terran', 'machine'] },
    void_reach: { control: 'held', rivals: [] },
    scrap_belt: { control: 'contested', rivals: ['kronax', 'machine', 'voidborn'] },
    synth_grid: { control: 'held', rivals: [] }
};

extendClass(PlanetConfigManager, {
    /** Fills galaxy.control / galaxy.rivals (saved galaxies predate them). */
    ensureGalaxyControl(galaxy) {
        if (!galaxy || typeof galaxy !== 'object') return null;
        const main = this.ensureGalaxyFaction(galaxy);
        if (galaxy.control !== 'held' && galaxy.control !== 'contested') {
            const preset = GALAXY_CONTROL_DEFAULTS[galaxy.id];
            if (preset) {
                galaxy.control = preset.control;
                galaxy.rivals = preset.rivals.slice();
            } else {
                // Seeded: roughly half of all other galaxies are contested.
                const h = this.hashSeed('control|' + galaxy.id);
                const others = this.availableFactions.filter((f) => f !== main);
                galaxy.control = h % 2 ? 'contested' : 'held';
                galaxy.rivals = galaxy.control === 'contested'
                    ? [others[h % others.length], others[(h >> 3) % others.length]]
                        .filter((f, i, arr) => arr.indexOf(f) === i)
                    : [];
            }
        }
        galaxy.rivals = (Array.isArray(galaxy.rivals) ? galaxy.rivals : [])
            .map((f) => this.normalizeGalaxyFaction(f))
            .filter((f, i, arr) => f && f !== main && arr.indexOf(f) === i);
        if (!galaxy.rivals.length) galaxy.control = 'held';
        return galaxy.control;
    },

    /**
     * { control: 'held'|'contested', main, rivals, factions: [{ id, share }] }
     * The main faction holds half of a contested galaxy; rivals split the rest.
     */
    getGalaxyControl(galaxyId) {
        const g = this.getGalaxy(galaxyId);
        if (!g) return { control: 'held', main: 'pirate', rivals: [], factions: [{ id: 'pirate', share: 1 }] };
        const control = this.ensureGalaxyControl(g);
        const main = g.faction;
        if (control !== 'contested') {
            return { control: 'held', main: main, rivals: [], factions: [{ id: main, share: 1 }] };
        }
        const rivalShare = 0.5 / g.rivals.length;
        return {
            control: 'contested',
            main: main,
            rivals: g.rivals.slice(),
            factions: [{ id: main, share: 0.5 }].concat(g.rivals.map((id) => ({ id: id, share: rivalShare })))
        };
    },

    isGalaxyContested(galaxyId) {
        return this.getGalaxyControl(galaxyId).control === 'contested';
    },

    /** All factions present in a galaxy, main faction first. */
    getGalaxyFactionIds(galaxyId) {
        return this.getGalaxyControl(galaxyId).factions.map((f) => f.id);
    },

    /** Short label: "HELD · KRONAX" or "CONTESTED · KRONAX vs TERRAN · MACHINE". */
    getGalaxyControlLabel(galaxyId) {
        const c = this.getGalaxyControl(galaxyId);
        const up = (f) => String(f).toUpperCase();
        return c.control === 'contested'
            ? 'CONTESTED · ' + up(c.main) + ' vs ' + c.rivals.map(up).join(' · ')
            : 'HELD · ' + up(c.main);
    },

    /**
     * Frontline for a new planet: held galaxies give [main]; contested ones
     * pick an owner by share and an opposing faction from the rest.
     */
    pickPlanetFactions(galaxyId, rng) {
        const c = this.getGalaxyControl(galaxyId);
        if (c.control !== 'contested') return [c.main];
        let roll = rng();
        let owner = c.main;
        for (const f of c.factions) {
            if (roll < f.share) { owner = f.id; break; }
            roll -= f.share;
        }
        const opponents = c.factions.map((f) => f.id).filter((id) => id !== owner);
        return [owner, opponents[Math.floor(rng() * opponents.length) % opponents.length]];
    },
});
