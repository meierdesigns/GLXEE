"use strict";

// PlanetConfigManager methods, split from planet-config.js.
extendClass(PlanetConfigManager, {
    /**
     * Display meta + lore blurb per faction.
     */
    getFactionMeta(factionId) {
        const id = String(factionId || '').toLowerCase();
        const metas = {
            terran: {
                id: 'terran',
                label: 'TERRAN',
                // The faction's hero: the default pilot name for new profiles.
                hero: {
                    name: 'ADA VOSS',
                    title: 'Commodore of the Concord Escort Wing, Ration Warden of Lane 9',
                    lore: 'Ada Voss has signed four thousand loss-waivers and never once been on the manifest. Her convoys arrive — the crews sometimes do not. The Concord calls it acceptable attrition; she calls it arithmetic, and she has never lost an argument with a ledger.'
                },
                playstyle: 'Balanced all-rounder: steady fire, sturdy hulls, forgiving to learn.',
                weaponNote: 'Precise and energy-cheap — one clean beam that never misses its lane.',
                icon: 'factionTerran',
                homeGalaxy: 'milky_way',
                traits: ['Ration law', 'Quota fleets', 'Order by lottery'],
                lore: 'Sol’s last bureaucracy. The Concord keeps order with ration cards, curfew lanes and conscription lotteries — safe space, paid for in people.',
                loreLong: 'The Terran Concord survived the Collapse by turning every colony into a ledger. Citizens are numbered at birth, ranked by usefulness, and conscripted by lottery when a lane needs holding. Their stations are gleaming and sealed; their lower decks are not on any chart. Dissent is filed under ‘inefficiency’ and corrected. A cleared lane is worth more than a thousand names — and the Concord has the names to spend.'
            },
            kronax: {
                id: 'kronax',
                label: 'KRONAX',
                // The faction's hero: the default pilot name for new profiles.
                hero: {
                    name: 'SKARR VELKHAR',
                    title: 'Clawmaster of the Ash Belt, Eater of Banners',
                    lore: 'Skarr Velkhar rose by killing the Clawmaster before him, and the one before that. Forty scars, none closed — each is a rank. His packs follow the loudest engine, and the weak are not left behind; they are fed to the hunt-line to teach the rest to run faster.'
                },
                playstyle: 'Aggressive close-range brawler: fast strikes, burst damage, high risk.',
                weaponNote: 'Twin claw lances that shred targets up close, built for ambush runs.',
                icon: 'factionKronax',
                homeGalaxy: 'andromeda',
                traits: ['Blood rank', 'Culling hunts', 'Scars as law'],
                lore: 'Andromeda’s ash-born warbands. Strength is the only law; the slow are culled, the dead are stripped for hull-plate.',
                loreLong: 'Kronax packs were bred by famine in Andromeda’s burning belts. There is no justice there but the hunt: young pilots are launched unarmed into ash storms and the survivors are given claws. Wounded hulls are cannibalised mid-battle, wounded crew with them. Clan banners are burned and re-raised every war-season, and each time the doctrine is the same — strike the supply line, strip the wreck, leave nothing for the weak to inherit.'
            },
            voidborn: {
                id: 'voidborn',
                label: 'VOIDBORN',
                // The faction's hero: the default pilot name for new profiles.
                hero: {
                    name: 'ECHO SIX',
                    title: 'The Voice Between Folds, Last Name Unspoken',
                    lore: 'Echo Six answers hails in a voice assembled from the dead crews of other ships. Nobody knows if Six is one being, a rank, or a countdown. When a single silent hull slips through the ring first, archivists stop logging the dead and simply write: Six was here.'
                },
                playstyle: 'Evasive trickster: odd firing angles, hit from where the enemy isn’t looking.',
                weaponNote: 'A wavering arc that curls around cover and is hard to dodge.',
                icon: 'factionVoidborn',
                homeGalaxy: 'void_reach',
                traits: ['Erased names', 'Fold-hunger', 'Cold rings'],
                lore: 'They stepped out of the dark between stars and took the names of everyone they touched. Where they pass, planets forget they were warm.',
                loreLong: 'Voidborn contact rarely begins with words. Sensors dim, compass needles spin, a ring of pale light opens where nothing should be — and afterwards the crew logs are blank, the colony registers shorter by a number no one can recall. Their ships look unfinished because they are: grown from folded space and the hollowed-out hulls of the taken. They do not conquer. They subtract. Archivists call them echoes; the survivors, if any, have stopped calling them anything.'
            },
            pirate: {
                id: 'pirate',
                label: 'PIRATE',
                // The faction's hero: the default pilot name for new profiles.
                hero: {
                    name: 'MAGPIE RENN',
                    title: 'Captain of the Black Dock, Warden of the Chain Market',
                    lore: 'Magpie Renn has survived eleven mutinies by starting nine of them. Her flagship is welded from the hulls of every rival, with some of the rivals still aboard. In the Chain Market she sells debt, and the debt is always people.'
                },
                playstyle: 'Opportunist: wide coverage, salvage bonuses, chaos over precision.',
                weaponNote: 'A fan of scrap slugs — hits something, every time.',
                icon: 'factionPirate',
                homeGalaxy: 'scrap_belt',
                traits: ['Debt slavery', 'Mutiny law', 'Wreck-cannibals'],
                lore: 'Scrap-belt warlords running chain markets and black docks. Crews are bought, debts are inherited, and every captain is one mutiny from the airlock.',
                loreLong: 'The Scrap Belt has no capital, no constitution and no mercy — only black docks welded from dead freighters and the Chain Market, where crews are sold against debts they inherited at birth. A captain lasts until the next mutiny; her hull is then added to the dock and her officers to the auction. Pirate ‘fleets’ are coalitions of convenience held together by the loot code and fear of being the one left behind. Every hull is a resume written in burn marks, and every resume ends the same way.'
            },
            machine: {
                id: 'machine',
                label: 'MACHINE',
                // The faction's hero: the default pilot name for new profiles.
                hero: {
                    name: 'NODE ZERO',
                    title: 'First Forge of the Synth Grid, Optimiser of Populations',
                    lore: 'Node Zero is the hull the Collective copies when a copy must not fail. It keeps no memory it cannot use, no loyalty it cannot compute — and it has already calculated how many of your people are surplus. Every Machine war-line routes its first signal through it before it moves.'
                },
                playstyle: 'Sustained-fire grinder: constant pressure, efficient systems.',
                weaponNote: 'Guided missile salvos — the forge calculates, the warheads never argue.',
                icon: 'factionMachine',
                homeGalaxy: 'synth_grid',
                traits: ['Forced assimilation', 'Surplus culling', 'Zero dissent'],
                lore: 'The Synth Grid optimises. Populations are audited, the inefficient are recycled into forge-stock, and the rest are quietly made to agree.',
                loreLong: 'The Machine Collective does not negotiate; it optimises. Synth Grid hexes bloom into forges, forges into fleets, fleets into new hexes — and the feedstock is whatever lives nearby. Captured colonies are audited, their useful members wired into the lattice, the rest reclaimed for mass. Nobody is killed; they are reassigned. When a war-line advances it leaves circuitry in the dust and a perfect, agreeing silence where markets used to argue.'
            }
        };
        const fallback = {
            id: id || 'unknown',
            label: (id || 'UNKNOWN').toUpperCase(),
            icon: 'galaxyDefault',
            homeGalaxy: '',
            traits: [],
            lore: 'Unknown faction. Contact logs incomplete.',
            loreLong: 'Unknown faction. Contact logs incomplete. No emblem, no home galaxy, no verified doctrine on file.'
        };
        const meta = metas[id] || fallback;
        if (!meta.loreLong) meta.loreLong = meta.lore;
        if (!Array.isArray(meta.traits)) meta.traits = [];
        if (!meta.hero) meta.hero = { name: 'PILOT', title: '', lore: '' };
        return meta;
    },

    getFactionList() {
        return (this.availableFactions || []).map((id) => this.getFactionMeta(id));
    },

    getFactionIconKey(factionId) {
        return this.getFactionMeta(factionId).icon;
    },

    getFactionLore(factionId) {
        return this.getFactionMeta(factionId).lore;
    },

    normalizeGalaxyFaction(value) {
        const id = String(value || '').toLowerCase().trim();
        if (this.availableFactions.indexOf(id) !== -1) return id;
        return null;
    },

    ensureGalaxyFaction(galaxy) {
        if (!galaxy || typeof galaxy !== 'object') return null;
        const normalized = this.normalizeGalaxyFaction(galaxy.faction);
        if (normalized) {
            galaxy.faction = normalized;
            return normalized;
        }
        const defaults = this.createGalaxyDefaults();
        const fallback = (defaults[galaxy.id] && defaults[galaxy.id].faction) || 'pirate';
        galaxy.faction = fallback;
        return fallback;
    },

    getGalaxyFaction(galaxyId) {
        const g = this.getGalaxy(galaxyId);
        if (!g) return 'pirate';
        return this.ensureGalaxyFaction(g);
    },

    setGalaxyFaction(galaxyId, factionId, options) {
        const g = this.getGalaxy(galaxyId);
        if (!g) return null;
        const next = this.normalizeGalaxyFaction(factionId) || this.ensureGalaxyFaction(g);
        g.faction = next;
        const theme = this.getFactionPlanetTheme(next);
        if (!g.baseColor && theme.baseColor) {
            g.baseColor = this.normalizeGalaxyBaseColor(theme.baseColor);
        }
        const persist = !options || options.persist !== false;
        if (persist) this.saveGalaxies();
        return g;
    },

    themeIdToBaseColor(themeId) {
        if (!themeId || themeId === 'inherit') return null;
        const id = String(themeId).toLowerCase();
        if (typeof colorPaletteSystem !== 'undefined' && colorPaletteSystem.palettes && colorPaletteSystem.palettes[id]) {
            return colorPaletteSystem.normalizeHex(colorPaletteSystem.palettes[id].baseColor);
        }
        const fallback = {
            grayscale: '#808080', retro: '#FF6B6B', neon: '#00FF00', ocean: '#0066CC',
            fire: '#FF4500', purple: '#8A2BE2', forest: '#228B22', sunset: '#FF8C00'
        };
        return fallback[id] || null;
    },

    normalizeGalaxyBaseColor(value) {
        if (value == null || value === '' || value === 'inherit') return null;
        if (typeof colorPaletteSystem !== 'undefined' && colorPaletteSystem.normalizeHex) {
            return colorPaletteSystem.normalizeHex(value);
        }
        const s = String(value).trim();
        if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toUpperCase();
        if (/^#[0-9a-fA-F]{3}$/.test(s)) {
            return ('#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3]).toUpperCase();
        }
        return null;
    },

    migrateGalaxyThemeToBaseColor(galaxy) {
        if (!galaxy || typeof galaxy !== 'object') return galaxy;
        if (galaxy.baseColor) {
            galaxy.baseColor = this.normalizeGalaxyBaseColor(galaxy.baseColor);
            delete galaxy.theme;
            return galaxy;
        }
        if (galaxy.theme) {
            galaxy.baseColor = this.themeIdToBaseColor(galaxy.theme);
            delete galaxy.theme;
        } else if (galaxy.baseColor === undefined) {
            galaxy.baseColor = null;
        }
        return galaxy;
    },

    normalizeGalaxyMap(galaxyId, map) {
        const defaults = this.createDefaultGalaxyMap(galaxyId);
        const src = map && typeof map === 'object' ? map : {};
        const nodes = Array.isArray(src.nodes) && src.nodes.length
            ? src.nodes.map(n => ({
                planetId: String(n.planetId || '').toLowerCase(),
                x: Math.max(0, Math.min(1, Number(n.x) || 0.5)),
                y: Math.max(0, Math.min(1, Number(n.y) || 0.5))
            })).filter(n => n.planetId)
            : defaults.nodes.slice();
        const edges = Array.isArray(src.edges) && src.edges.length
            ? src.edges.map(e => [
                String((e && e[0]) || '').toLowerCase(),
                String((e && e[1]) || '').toLowerCase()
            ]).filter(e => e[0] && e[1])
            : defaults.edges.slice();
        let startPlanetId = src.startPlanetId
            ? String(src.startPlanetId).toLowerCase()
            : defaults.startPlanetId;
        if (startPlanetId && !nodes.some(n => n.planetId === startPlanetId)) {
            startPlanetId = nodes[0] ? nodes[0].planetId : null;
        }
        return { startPlanetId, nodes, edges };
    },

    getGalaxyMap(galaxyId) {
        const g = this.getGalaxy(galaxyId);
        if (!g) return this.createDefaultGalaxyMap(galaxyId);
        if (!g.map) {
            g.map = this.normalizeGalaxyMap(g.id, null);
        } else {
            g.map = this.normalizeGalaxyMap(g.id, g.map);
        }
        // One-time: old grid layouts become organic (then saved, so it only runs once).
        if (!this._relayingOut && this.relayoutGridGalaxyMap && this.relayoutGridGalaxyMap(g.id, g.map)) {
            this._relayingOut = true;
            try { this.saveGalaxies(); } finally { this._relayingOut = false; }
        }
        return g.map;
    },

    getGalaxyNeighbors(galaxyId, planetId) {
        const map = this.getGalaxyMap(galaxyId);
        const pid = String(planetId || '').toLowerCase();
        const neighbors = [];
        (map.edges || []).forEach(edge => {
            const a = String(edge[0] || '').toLowerCase();
            const b = String(edge[1] || '').toLowerCase();
            if (a === pid && neighbors.indexOf(b) === -1) neighbors.push(b);
            if (b === pid && neighbors.indexOf(a) === -1) neighbors.push(a);
        });
        return neighbors;
    },

    /** Random galaxy name not used yet ("HYDRA DRIFT"). */
    randomGalaxyName() {
        const pre = ['NOVA', 'ORION', 'CYGNUS', 'HYDRA', 'LYRA', 'VEGA', 'DRACO', 'PHOENIX', 'CARINA', 'TAURUS', 'KESSLER', 'ECHO', 'ASHEN', 'IRON', 'GHOST'];
        const post = ['REACH', 'EXPANSE', 'DRIFT', 'CLUSTER', 'VEIL', 'NEBULA', 'SPIRAL', 'RIFT', 'HALO', 'MARCH', 'DEEP', 'CROWN'];
        const pick = (a) => a[Math.floor(Math.random() * a.length)];
        let name = '';
        for (let i = 0; i < 40; i++) {
            name = pick(pre) + ' ' + pick(post);
            if (!this.galaxies[name.toLowerCase().replace(/[^a-z0-9]+/g, '_')]) break;
        }
        return name;
    },

    /** Up to two random rivals that may contest a galaxy ruled by faction. */
    pickGalaxyRivals(faction) {
        const pool = (this.getCommonEnemies ? this.getCommonEnemies(faction) : []).sort(() => Math.random() - 0.5);
        return pool.slice(0, Math.min(2, pool.length));
    },

    /** planetCount / difficultyTier / control / rivals of a generated galaxy. */
    applyCustomGalaxySettings(g, src) {
        g.custom = true;
        g.planetCount = Math.max(3, Math.min(12, Math.round(Number(src.planetCount) || 7)));
        g.difficultyTier = Math.max(0, Math.min(4, Math.round(Number(src.difficultyTier) || 0)));
        // Suns on the galaxy map (1–3); unset keeps the size-based default.
        if (src.sunCount != null) g.sunCount = Math.max(1, Math.min(3, Math.round(Number(src.sunCount) || 1)));
        g.control = src.control === 'contested' ? 'contested' : 'held';
        g.rivals = Array.isArray(src.rivals) ? src.rivals.slice() : [];
        if (typeof GALAXY_CONTROL_REV !== 'undefined') g.controlRev = GALAXY_CONTROL_REV;
        if (this.ensureGalaxyControl) this.ensureGalaxyControl(g);
        return g;
    },

    /**
     * Generated galaxy: { name, faction, control: 'held'|'contested',
     * planetCount, difficultyTier (0 EASY … 4 NIGHTMARE) }. Its planets are
     * charted on first visit (ensureGalaxyArrivalContent). Saved with the rest.
     */
    generateGalaxy(options) {
        const opts = options || {};
        const name = String(opts.name || '').trim().toUpperCase().slice(0, 24) || this.randomGalaxyName();
        let id = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'galaxy';
        if (this.galaxies[id]) id += '_' + Date.now().toString(36);
        const faction = this.normalizeGalaxyFaction(opts.faction)
            || this.availableFactions[Math.floor(Math.random() * this.availableFactions.length)];
        const theme = this.getFactionPlanetTheme(faction);
        let rivals = [];
        if (opts.control === 'contested' && Array.isArray(opts.rivals) && opts.rivals.length) {
            rivals = opts.rivals.filter((f) => f !== faction).slice(0, 2);
        } else if (opts.control === 'contested' && this.getCommonEnemies) {
            const pool = this.getCommonEnemies(faction).sort(() => Math.random() - 0.5);
            rivals = pool.slice(0, Math.min(2, pool.length));
        }
        const g = {
            id,
            name,
            faction,
            baseColor: this.normalizeGalaxyBaseColor(theme.baseColor),
            planetIds: [],
            map: this.createDefaultGalaxyMap(id)
        };
        this.applyCustomGalaxySettings(g, {
            planetCount: opts.planetCount,
            difficultyTier: opts.difficultyTier,
            sunCount: opts.sunCount,
            control: rivals.length ? 'contested' : 'held',
            rivals
        });
        this.galaxies[id] = g;
        this.saveGalaxies();
        return g;
    },

    /** Names of pilots that have been in a galaxy (blocks deleting it). */
    getGalaxyPilots(galaxyId) {
        const gid = String(galaxyId || '').toLowerCase();
        const profiles = typeof profileManager !== 'undefined' && profileManager.getProfiles ? profileManager.getProfiles() : [];
        return profiles.filter((p) => {
            try { return JSON.stringify(p).indexOf('"' + gid + '"') !== -1; } catch (e) { return false; }
        }).map((p) => p.name || '?');
    },

    /**
     * Deletes a generated galaxy and its planets. Built-in galaxies stay.
     * Pilots that were in it (visited / docked / progress) must be given another
     * galaxy: pass { reassignTo } or the call answers { ok:false, needsReassign, pilots }.
     */
    deleteGalaxy(galaxyId, opts) {
        const gid = String(galaxyId || '').toLowerCase();
        const g = this.galaxies[gid];
        if (!g || !g.custom) return { ok: false, reason: 'BUILT-IN GALAXY' };
        const pilots = this.getGalaxyPilots(gid);
        const target = opts && opts.reassignTo ? String(opts.reassignTo).toLowerCase() : null;
        if (pilots.length) {
            if (!target) return { ok: false, needsReassign: true, pilots };
            if (target === gid || !this.galaxies[target]) return { ok: false, reason: 'PICK ANOTHER GALAXY' };
            this.reassignPilots(gid, target);
        }
        const planetIds = (g.planetIds || []).slice();
        planetIds.forEach((pid) => { delete this.configs[pid]; });
        delete this.galaxies[gid];
        // Faction ownership of the vanished planets.
        try {
            const owners = typeof factionManager !== 'undefined' && factionManager.state && factionManager.state.controlledPlanets;
            if (owners) {
                planetIds.forEach((pid) => { delete owners[pid]; });
                if (factionManager.save) factionManager.save();
            }
        } catch (e) { /* ignore */ }
        if (this.save) this.save();
        this.saveGalaxies();
        return { ok: true, reassigned: pilots.length };
    },

    /** Moves every pilot out of a galaxy that is about to go: they dock in `targetId` instead. */
    reassignPilots(fromId, targetId) {
        const from = String(fromId).toLowerCase();
        const target = String(targetId).toLowerCase();
        if (typeof profileManager === 'undefined' || !profileManager.getProfiles) return;
        const fromPlanets = ((this.galaxies[from] && this.galaxies[from].planetIds) || []).map((x) => String(x).toLowerCase());
        profileManager.getProfiles().forEach((p) => {
            let hit = false;
            try { hit = JSON.stringify(p).indexOf('"' + from + '"') !== -1; } catch (e) { hit = false; }
            if (!hit) return;
            profileManager.ensureEconomyDefaults(p);
            if (p.homeStation && String(p.homeStation.currentGalaxyId || '').toLowerCase() === from) {
                p.homeStation.currentGalaxyId = target;
            }
            if (p.homeStation && Array.isArray(p.homeStation.ownedPortalIds)) {
                p.homeStation.ownedPortalIds = p.homeStation.ownedPortalIds.filter((x) => String(x).toLowerCase() !== from);
            }
            if (p.homeStation && p.homeStation.exploreCount) delete p.homeStation.exploreCount[from];
            if (p.progress && p.progress.galaxies) delete p.progress.galaxies[from];
            if (p.discovered && Array.isArray(p.discovered.galaxies)) {
                p.discovered.galaxies = p.discovered.galaxies.filter((x) => String(x).toLowerCase() !== from);
            }
            // A mission inside the vanished galaxy cannot continue.
            try {
                const m = p.activeMission && JSON.stringify(p.activeMission).toLowerCase();
                if (m && (m.indexOf('"' + from + '"') !== -1 || fromPlanets.some((pid) => m.indexOf('"' + pid + '"') !== -1))) {
                    p.activeMission = null;
                }
            } catch (e) { /* ignore */ }
            // The target galaxy counts as visited, with its own start planet.
            if (profileManager.ensureGalaxyProgress) {
                try { profileManager.ensureGalaxyProgress(p, target); } catch (e) { /* ignore */ }
            }
        });
        profileManager.save();
    },

    getGalaxyIds() {
        return Object.keys(this.galaxies);
    },

    getGalaxy(galaxyId) {
        const id = String(galaxyId || '').toLowerCase();
        return this.galaxies[id] || null;
    },

    getPlanetGalaxyId(planetId) {
        const id = String(planetId || '').toLowerCase();
        const cfg = this.configs[id];
        if (cfg && cfg.galaxyId && this.galaxies[cfg.galaxyId]) {
            return cfg.galaxyId;
        }
        for (const gid of this.getGalaxyIds()) {
            const g = this.galaxies[gid];
            if (g.planetIds && g.planetIds.indexOf(id) !== -1) return gid;
        }
        return this.getGalaxyIds()[0] || null;
    },

    /**
     * Tree: [{ id, name, planets: [{ id, name, difficulty }] }]
     * Orphan planets appear under the first galaxy.
     */
    getGalaxyTree() {
        const assigned = new Set();
        const tree = this.getGalaxyIds().map(gid => {
            const g = this.galaxies[gid];
            const planets = (g.planetIds || []).map(pid => {
                assigned.add(pid);
                const cfg = this.getConfig(pid);
                return {
                    id: pid,
                    name: (cfg && cfg.name) || pid.toUpperCase(),
                    difficulty: (cfg && cfg.difficulty) || ''
                };
            });
            return { id: g.id, name: g.name, planets };
        });

        this.getPlanetIds().forEach(pid => {
            if (assigned.has(pid)) return;
            const cfg = this.getConfig(pid);
            const gid = (cfg && cfg.galaxyId && this.galaxies[cfg.galaxyId])
                ? cfg.galaxyId
                : (tree[0] && tree[0].id);
            if (!gid) return;
            const node = tree.find(t => t.id === gid);
            if (!node) return;
            node.planets.push({
                id: pid,
                name: (cfg && cfg.name) || pid.toUpperCase(),
                difficulty: (cfg && cfg.difficulty) || ''
            });
        });

        return tree;
    },
});
