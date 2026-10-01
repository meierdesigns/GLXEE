"use strict";

// PlanetConfigManager methods: galaxy control. A galaxy is either HELD by
// its single faction or CONTESTED — its main faction (getGalaxyFaction)
// fights one or more rivals. Contested galaxies seed frontline planets
// that mix two factions, hit harder and pay out more.

// Built-in galaxies; any other galaxy gets a seeded default. Rivals are
// never allies of the ruler: a faction with allies is attacked by their
// common enemies, so the allies can come to defend it.
const GALAXY_CONTROL_DEFAULTS = {
    milky_way: { control: 'contested', rivals: ['pirate'] },
    andromeda: { control: 'contested', rivals: ['terran', 'voidborn'] },
    void_reach: { control: 'contested', rivals: ['machine'] },
    scrap_belt: { control: 'contested', rivals: ['kronax', 'machine'] },
    synth_grid: { control: 'contested', rivals: ['terran', 'pirate'] }
};
// Bump when the presets change so saved galaxies pick them up again.
const GALAXY_CONTROL_REV = 2;

// Factions that fight side by side. Only allies share a planet against the
// player; enemies of each other never spawn together.
const FACTION_ALLIANCES = [
    ['kronax', 'machine'],
    ['voidborn', 'pirate']
];

extendClass(PlanetConfigManager, {
    /** Partner factions of a faction (from FACTION_ALLIANCES), without itself. */
    getFactionAllies(id) {
        const key = String(id || '').toLowerCase();
        const out = [];
        FACTION_ALLIANCES.forEach((pair) => {
            if (pair.indexOf(key) === -1) return;
            pair.forEach((f) => { if (f !== key && out.indexOf(f) === -1) out.push(f); });
        });
        return out;
    },

    areFactionsAllied(a, b) {
        if (!a || !b) return false;
        if (a === b) return true;
        return FACTION_ALLIANCES.some((pair) => pair.indexOf(a) !== -1 && pair.indexOf(b) !== -1);
    },

    /** Factions hostile to a faction and to all of its allies. */
    getCommonEnemies(id) {
        const key = String(id || '').toLowerCase();
        const side = [key].concat(this.getFactionAllies(key));
        return (this.availableFactions || [])
            .filter((f) => side.every((s) => !this.areFactionsAllied(s, f)));
    },


    /** Fills galaxy.control / galaxy.rivals (saved galaxies predate them). */
    ensureGalaxyControl(galaxy) {
        if (!galaxy || typeof galaxy !== 'object') return null;
        const main = this.ensureGalaxyFaction(galaxy);
        const preset = GALAXY_CONTROL_DEFAULTS[galaxy.id];
        if (preset && galaxy.controlRev !== GALAXY_CONTROL_REV) galaxy.control = null;
        if (galaxy.control !== 'held' && galaxy.control !== 'contested') {
            galaxy.controlRev = GALAXY_CONTROL_REV;
            if (preset) {
                galaxy.control = preset.control;
                galaxy.rivals = preset.rivals.slice();
            } else {
                // Seeded: roughly half of all other galaxies are contested —
                // always those of a faction with allies — and only by
                // common enemies of the ruler and its allies.
                const h = this.hashSeed('control|' + galaxy.id);
                const others = this.getCommonEnemies(main);
                const hasAllies = this.getFactionAllies(main).length > 0;
                galaxy.control = others.length && (hasAllies || h % 2) ? 'contested' : 'held';
                galaxy.rivals = galaxy.control === 'contested'
                    ? [others[h % others.length], others[(h >> 3) % others.length]]
                        .filter((f, i, arr) => arr.indexOf(f) === i)
                    : [];
            }
        }
        galaxy.rivals = (Array.isArray(galaxy.rivals) ? galaxy.rivals : [])
            .map((f) => this.normalizeGalaxyFaction(f))
            .filter((f, i, arr) => f && f !== main && arr.indexOf(f) === i && !this.areFactionsAllied(main, f));
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
        // A planet is held by one side; an allied faction in the galaxy may
        // fight alongside it, never an enemy of the owner.
        const allies = c.factions.map((f) => f.id)
            .filter((id) => id !== owner && this.areFactionsAllied(owner, id));
        return allies.length && rng() < 0.5
            ? [owner, allies[Math.floor(rng() * allies.length) % allies.length]]
            : [owner];
    },
});
