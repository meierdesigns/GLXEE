"use strict";

class FactionManager {
    constructor() {
        this.factions = {
            terran: {
                goal: 'Sichere die Handelsrouten und halte die Kernwelten.',
                objectives: ['Erobere 3 Planeten', 'Schließe 5 Missionen ab', 'Halte die Terran-Kernwelt'],
                pactCost: 0
            },
            kronax: {
                goal: 'Zerschlage rivalisierende Flotten und errichte ein Kriegsreich.',
                objectives: ['Erobere 4 Planeten', 'Besiege 10 Elite-Schiffe', 'Schließe einen Kriegspakt'],
                pactCost: 100
            },
            voidborn: {
                goal: 'Öffne die Faltenräume und bringe die Randwelten zum Schweigen.',
                objectives: ['Erobere 3 Planeten', 'Besiege 3 Schlachtschiffe', 'Halte eine Void-Pforte'],
                pactCost: 150
            },
            pirate: {
                goal: 'Sammle Beute, kontrolliere die Sprungpunkte und bleibe frei.',
                objectives: ['Erobere 2 Planeten', 'Sammle 500 Ressourcen', 'Schließe zwei Pakte'],
                pactCost: 75
            },
            machine: {
                goal: 'Verbinde alle Knoten zu einem einzigen optimierten Netz.',
                objectives: ['Erobere 5 Planeten', 'Baue 3 Schiffe aus', 'Halte zwei Nachbarwelten'],
                pactCost: 200
            }
        };
        this.storageKey = 'vf_faction_state_v1';
        this.state = { allegiance: null, pacts: {}, controlledPlanets: {}, progress: {} };
        this.load();
    }

    load() {
        try {
            const saved = JSON.parse(localStorage.getItem(this.storageKey) || '{}');
            this.state = Object.assign(this.state, saved);
            if (!this.state.pacts) this.state.pacts = {};
            if (!this.state.controlledPlanets) this.state.controlledPlanets = {};
            if (!this.state.progress) this.state.progress = {};
        } catch (e) { /* defaults */ }
    }

    save() {
        try { localStorage.setItem(this.storageKey, JSON.stringify(this.state)); } catch (e) { /* optional */ }
    }

    getFactionIds() {
        return Object.keys(this.factions);
    }

    getFaction(id) {
        const key = String(id || '').toLowerCase();
        const meta = (typeof planetConfigManager !== 'undefined' && planetConfigManager.getFactionMeta)
            ? planetConfigManager.getFactionMeta(key) : { id: key, label: key.toUpperCase(), lore: '', loreLong: '' };
        return Object.assign({}, meta, this.factions[key] || {});
    }

    getAllegiance() {
        return this.state.allegiance;
    }

    join(id) {
        const key = String(id || '').toLowerCase();
        if (!this.factions[key]) return false;
        this.state.allegiance = key;
        if (typeof profileManager !== 'undefined' && profileManager.discoverFaction) {
            profileManager.discoverFaction(key);
        }
        this.save();
        return true;
    }

    getPacts() {
        return Object.assign({}, this.state.pacts);
    }

    hasPact(id) {
        return this.state.pacts[String(id || '').toLowerCase()] === 'active';
    }

    togglePact(id) {
        const key = String(id || '').toLowerCase();
        if (!this.factions[key] || key === this.state.allegiance) return false;
        this.state.pacts[key] = this.hasPact(key) ? 'proposed' : 'active';
        this.save();
        return this.state.pacts[key] === 'active';
    }

    getControlledPlanets() {
        const owner = this.state.allegiance;
        return Object.keys(this.state.controlledPlanets)
            .filter((id) => this.state.controlledPlanets[id] === owner);
    }

    getPlanetOwner(planetId) {
        return this.state.controlledPlanets[String(planetId || '').toLowerCase()] || null;
    }

    claimPlanet(planetId) {
        const owner = this.state.allegiance;
        const id = String(planetId || '').toLowerCase();
        if (!owner || !id) return false;
        this.state.controlledPlanets[id] = owner;
        this.state.progress[owner] = (this.state.progress[owner] || 0) + 1;
        this.save();
        return true;
    }

    recordMissionVictory(planetId) {
        return this.claimPlanet(planetId);
    }
}

const factionManager = new FactionManager();
window.factionManager = factionManager;
