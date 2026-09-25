"use strict";

// ProfileManager methods, split from profile-manager.js.
extendClass(ProfileManager, {
    hasDiscoveredGalaxy(galaxyId, profile) {
        const p = profile || this.getActiveProfile();
        if (!p) return false;
        this.ensureDiscoveryDefaults(p);
        const gid = String(galaxyId || '').toLowerCase();
        if (!gid) return false;
        if (gid === 'milky_way') return true;
        return (p.discovered.galaxies || []).indexOf(gid) !== -1;
    },

    discoverGalaxy(galaxyId) {
        const gid = String(galaxyId || '').toLowerCase();
        if (!gid) return false;
        return this.discover('galaxies', gid);
    },

    hasDiscoveredFaction(factionId, profile) {
        const p = profile || this.getActiveProfile();
        if (!p) return false;
        this.ensureDiscoveryDefaults(p);
        const id = String(factionId || '').toLowerCase();
        if (!id) return false;
        if (id === 'terran') return true;
        return (p.discovered.factions || []).indexOf(id) !== -1;
    },

    getDiscoveredFactions(profile) {
        const p = profile || this.getActiveProfile();
        if (!p) return ['terran'];
        this.ensureDiscoveryDefaults(p);
        const list = (p.discovered.factions || []).slice();
        if (list.indexOf('terran') === -1) list.unshift('terran');
        return list;
    },

    discover(category, id) {
        const profile = this.getActiveProfile();
        if (!profile) return false;
        this.ensureEconomyDefaults(profile);
        const cat = String(category || '');
        const item = String(id || '');
        if (!cat || !item || !profile.discovered[cat]) return false;
        if (profile.discovered[cat].indexOf(item) !== -1) return false;
        profile.discovered[cat].push(item);
        this.save();
        return true;
    },

    undiscover(category, id) {
        const profile = this.getActiveProfile();
        if (!profile) return false;
        this.ensureEconomyDefaults(profile);
        const cat = String(category || '');
        const item = String(id || '');
        if (!cat || !item || !profile.discovered[cat]) return false;
        if (cat === 'ships' && item === this.getStarterShipId()) return false;
        const idx = profile.discovered[cat].indexOf(item);
        if (idx === -1) return false;
        profile.discovered[cat].splice(idx, 1);
        this.save();
        return true;
    },

    toggleDiscovered(category, id) {
        if (this.isDiscovered(category, id)) {
            this.undiscover(category, id);
            return false;
        }
        this.discover(category, id);
        return true;
    },

    hasDiscovered(category) {
        const profile = this.getActiveProfile();
        if (!profile) return false;
        this.ensureEconomyDefaults(profile);
        const list = profile.discovered[category];
        return Array.isArray(list) && list.length > 0;
    },

    isDiscovered(category, id) {
        const profile = this.getActiveProfile();
        if (!profile) return false;
        this.ensureEconomyDefaults(profile);
        const list = profile.discovered[category];
        const item = String(id || '');
        return !!item && Array.isArray(list) && list.indexOf(item) !== -1;
    },

    getDiscovered(category) {
        const profile = this.getActiveProfile();
        if (!profile) return [];
        this.ensureEconomyDefaults(profile);
        return (profile.discovered[category] || []).slice();
    },

    isDefenseAbilityId(abilityId) {
        const id = String(abilityId || '').toLowerCase();
        if (id === 'energy_core' || id.indexOf('energy_core') === 0) return false;
        return id.indexOf('shield') !== -1 ||
            id.indexOf('armor') !== -1 ||
            id === 'evasion_boost';
    },

    discoverLoadoutModules(loadout) {
        if (!loadout || typeof loadout !== 'object') return;
        (loadout.weapons || []).forEach((w) => this.discover('weapons', w));
        (loadout.abilities || []).forEach((a) => {
            if (typeof shipLoadoutManager !== 'undefined' && shipLoadoutManager.isEnergyId
                && shipLoadoutManager.isEnergyId(a)) {
                this.discover('energy', a);
            } else if (this.isDefenseAbilityId(a)) {
                this.discover('defenses', a);
            } else {
                this.discover('abilities', a);
            }
        });
        (loadout.defenses || []).forEach((d) => {
            this.discover('defenses', d);
            this.discover('abilities', d);
        });
        (loadout.energy || []).forEach((e) => this.discover('energy', e));
    },

    discoverShipContents(shipId) {
        const id = String(shipId || '');
        if (!id) return;
        this.discover('ships', id);
        // Starter hull alone does not reveal arsenal entries.
        if (id === this.getStarterShipId()) return;
        let loadout = null;
        const profile = this.getActiveProfile();
        if (profile && profile.shipLoadouts && profile.shipLoadouts[id]) {
            loadout = profile.shipLoadouts[id];
        } else if (typeof shipLoadoutManager !== 'undefined') {
            loadout = shipLoadoutManager.defaultLoadoutFromShip(id);
        }
        this.discoverLoadoutModules(loadout);
        if (typeof shipConfigManager !== 'undefined') {
            const cfg = shipConfigManager.getConfig(id);
            if (cfg) {
                if (cfg.defaultWeapon) this.discover('weapons', cfg.defaultWeapon);
                (cfg.availableWeapons || []).forEach((w) => this.discover('weapons', w));
            }
        }
    },

    discoverEnemyContents(enemyType) {
        const type = String(enemyType || '');
        if (!type) return;
        this.discover('enemies', type);
        if (typeof enemyConfigManager === 'undefined') return;
        const cfg = enemyConfigManager.getConfig(type);
        if (!cfg) return;
        const factions = (Array.isArray(cfg.factions) && cfg.factions.length)
            ? cfg.factions
            : (enemyConfigManager.getDefaultFaction
                ? [enemyConfigManager.getDefaultFaction(type)]
                : []);
        factions.forEach((fid) => this.discoverFaction(fid));
        const list = cfg.abilities || cfg.defenseMechanisms || [];
        list.forEach((a) => {
            this.discover('abilities', a);
            if (this.isDefenseAbilityId(a)) {
                this.discover('defenses', a);
            }
        });
    },

    load() {
        try {
            const raw = localStorage.getItem(this.storageKey);
            if (!raw) {
                this.profiles = [];
                this.activeProfileId = null;
                return;
            }
            const parsed = JSON.parse(raw);
            this.profiles = Array.isArray(parsed.profiles) ? parsed.profiles : [];
            this.profiles.forEach((p) => {
                this.ensureEconomyDefaults(p);
                if (!p.faction) p.faction = this.normalizeFactionId(null);
            });
            this.activeProfileId = parsed.activeProfileId || null;
            if (this.activeProfileId && !this.getProfile(this.activeProfileId)) {
                this.activeProfileId = this.profiles[0] ? this.profiles[0].id : null;
            }
            this.save();
        } catch (e) {
            this.profiles = [];
            this.activeProfileId = null;
        }
    },

    save() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify({
                activeProfileId: this.activeProfileId,
                profiles: this.profiles
            }));
        } catch (e) {
            console.warn('ProfileManager: save failed', e);
        }
    },

    getProfiles() {
        return this.profiles.slice();
    },

    getProfile(id) {
        const pid = String(id || '');
        return this.profiles.find(p => p.id === pid) || null;
    },

    getActiveProfile() {
        return this.getProfile(this.activeProfileId);
    },

    hasActiveProfile() {
        return !!this.getActiveProfile();
    },

    normalizeFactionId(factionId) {
        const id = String(factionId || '').toLowerCase();
        const ids = (typeof factionManager !== 'undefined' && factionManager.getFactionIds)
            ? factionManager.getFactionIds()
            : ['terran', 'kronax', 'voidborn', 'pirate', 'machine'];
        return ids.indexOf(id) !== -1 ? id : ids[0];
    },
});
