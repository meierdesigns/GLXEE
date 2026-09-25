"use strict";

// ProfileManager methods, split from profile-manager.js.
extendClass(ProfileManager, {
    ownsPortal(galaxyId, profile) {
        const p = profile || this.getActiveProfile();
        if (!p) return false;
        this.ensureEconomyDefaults(p);
        const gid = String(galaxyId || '').toLowerCase();
        return (p.homeStation.ownedPortalIds || []).indexOf(gid) !== -1;
    },

    getShopFaction(profile) {
        const gid = this.getCurrentGalaxyId(profile);
        if (typeof planetConfigManager !== 'undefined' && planetConfigManager.getGalaxyFaction) {
            return String(planetConfigManager.getGalaxyFaction(gid) || 'terran').toLowerCase();
        }
        return 'terran';
    },

    isShopFactionMatch(itemFaction, shopFaction) {
        const f = itemFaction ? String(itemFaction).toLowerCase() : '';
        if (!f) return true;
        return f === String(shopFaction || '').toLowerCase();
    },

    isShipAvailableInShop(shipId, profile) {
        if (typeof shipConfigManager === 'undefined') return true;
        const cfg = shipConfigManager.getConfig(shipId);
        if (!cfg || cfg.custom) return false;
        return this.isShopFactionMatch(cfg.faction, this.getShopFaction(profile));
    },

    isPartAvailableInShop(kind, partId, profile) {
        const k = String(kind || '');
        const id = String(partId || '');
        let item = null;
        if (k === 'weapon') {
            if (typeof weaponConfigManager === 'undefined') return false;
            item = weaponConfigManager.getWeapon(id);
        } else if (k === 'defense' || k === 'ability' || k === 'energy') {
            if (typeof abilityConfigManager === 'undefined') return false;
            item = abilityConfigManager.getAbility(id);
        } else {
            return false;
        }
        if (!item) return false;
        return this.isShopFactionMatch(item.faction, this.getShopFaction(profile));
    },

    canTravelToGalaxy(galaxyId, profile) {
        const p = profile || this.getActiveProfile();
        if (!p || typeof economyConfig === 'undefined') {
            return { ok: false, reason: 'NO PROFILE' };
        }
        this.ensureEconomyDefaults(p);
        const levels = this.getStationUpgradeLevels(p);
        const gid = String(galaxyId || '').toLowerCase();
        if (typeof startScreenManager !== 'undefined' && startScreenManager.devMode) {
            return { ok: true };
        }
        if (this.ownsPortal(gid, p)) {
            return { ok: true, via: 'portal' };
        }
        if (!economyConfig.canTravelToGalaxy(gid, levels)) {
            const req = economyConfig.getGalaxyWarpRequirement(gid);
            return { ok: false, reason: 'DRIVE', requireWarp: req };
        }
        return { ok: true, via: 'warp' };
    },

    buyPortal(galaxyId) {
        const profile = this.getActiveProfile();
        if (!profile || typeof economyConfig === 'undefined') {
            return { ok: false, reason: 'NO PROFILE' };
        }
        this.ensureEconomyDefaults(profile);
        const gid = String(galaxyId || '').toLowerCase();
        if (!gid || gid === 'milky_way') {
            return { ok: false, reason: 'INVALID' };
        }
        if (typeof planetConfigManager !== 'undefined' && !planetConfigManager.getGalaxy(gid)) {
            return { ok: false, reason: 'INVALID' };
        }
        if (this.ownsPortal(gid, profile)) {
            return { ok: false, reason: 'OWNED' };
        }
        const faction = (typeof planetConfigManager !== 'undefined' && planetConfigManager.getGalaxyFaction)
            ? planetConfigManager.getGalaxyFaction(gid)
            : null;
        if (faction && !this.hasDiscoveredFaction(faction, profile)) {
            return { ok: false, reason: 'UNKNOWN FACTION' };
        }
        const cost = economyConfig.getPortalCost(gid);
        if (!cost) {
            return { ok: false, reason: 'INVALID' };
        }
        const creditCost = Math.max(0, Math.round(Number(cost.credits) || 0));
        if (creditCost > 0) {
            if (!this.spendCredits(creditCost)) {
                return { ok: false, reason: 'CREDITS' };
            }
        } else if (!this.spendResources(cost)) {
            return { ok: false, reason: 'RESOURCES' };
        }
        profile.homeStation.ownedPortalIds.push(gid);
        if (faction) this.discoverFaction(faction);
        this.save();
        return { ok: true, galaxyId: gid };
    },

    travelToGalaxy(galaxyId) {
        const profile = this.getActiveProfile();
        if (!profile) return { ok: false, reason: 'NO PROFILE' };
        this.ensureEconomyDefaults(profile);
        const gid = String(galaxyId || '').toLowerCase();
        const check = this.canTravelToGalaxy(gid, profile);
        if (!check.ok) return check;
        if (typeof planetConfigManager !== 'undefined' && !planetConfigManager.getGalaxy(gid)) {
            return { ok: false, reason: 'INVALID' };
        }
        profile.homeStation.currentGalaxyId = gid;

        const firstVisit = !this.hasDiscoveredGalaxy(gid, profile);

        let arrival = null;
        if (typeof planetConfigManager !== 'undefined' && planetConfigManager.ensureGalaxyArrivalContent) {
            arrival = planetConfigManager.ensureGalaxyArrivalContent(
                gid,
                String(profile.id) + '|' + gid,
                { firstVisit: firstVisit }
            );
            if (arrival && arrival.faction) {
                this.discoverFaction(arrival.faction);
            }
            if (arrival && arrival.ok && arrival.startPlanetId) {
                this.ensureGalaxyProgress(profile, gid);
                if (this.unlockPlanet) {
                    this.unlockPlanet(arrival.startPlanetId);
                } else {
                    const gProg = profile.progress.galaxies[gid];
                    if (gProg && gProg.unlockedPlanetIds.indexOf(arrival.startPlanetId) === -1) {
                        gProg.unlockedPlanetIds.push(arrival.startPlanetId);
                    }
                }
            }
        }

        this.discoverGalaxy(gid);
        this.save();
        return {
            ok: true,
            galaxyId: gid,
            faction: arrival && arrival.faction,
            seeded: !!(arrival && arrival.seeded),
            firstVisit: firstVisit,
            planetIds: (arrival && arrival.planetIds) || [],
            startPlanetId: (arrival && arrival.startPlanetId) || null
        };
    },

    getShipFrameLevel(shipId, profile) {
        const p = profile || this.getActiveProfile();
        if (!p) return 0;
        this.ensureEconomyDefaults(p);
        const id = String(shipId || '');
        const entry = p.shipUpgrades && p.shipUpgrades[id];
        return Math.max(0, Math.round(Number(entry && entry.frameLevel) || 0));
    },

    canPurchaseShipFrameUpgrade(shipId, profile) {
        const p = profile || this.getActiveProfile();
        if (!p || typeof economyConfig === 'undefined') {
            return { ok: false, reason: 'NO PROFILE' };
        }
        this.ensureEconomyDefaults(p);
        const id = String(shipId || '');
        if (!this.ownsShip(id, p)) return { ok: false, reason: 'NOT OWNED' };
        const level = this.getShipFrameLevel(id, p);
        const max = economyConfig.maxShipFrameLevel || 9;
        if (level >= max) return { ok: false, reason: 'MAX LEVEL' };
        const cost = economyConfig.getShipFrameUpgradeCost(level + 1);
        if (!cost) return { ok: false, reason: 'INVALID' };
        if (!economyConfig.canAfford(p.resources, cost)) {
            return { ok: false, reason: 'RESOURCES', cost: cost, nextLevel: level + 1 };
        }
        return { ok: true, cost: cost, nextLevel: level + 1 };
    },

    purchaseShipFrameUpgrade(shipId) {
        const profile = this.getActiveProfile();
        if (!profile || typeof economyConfig === 'undefined') {
            return { ok: false, reason: 'NO PROFILE' };
        }
        this.ensureEconomyDefaults(profile);
        const id = String(shipId || '');
        const check = this.canPurchaseShipFrameUpgrade(id, profile);
        if (!check.ok) return check;
        if (!this.spendResources(check.cost)) {
            return { ok: false, reason: 'RESOURCES' };
        }
        if (!profile.shipUpgrades[id]) profile.shipUpgrades[id] = { frameLevel: 0 };
        profile.shipUpgrades[id].frameLevel = check.nextLevel;
        this.save();
        return { ok: true, level: check.nextLevel };
    },

    getModuleUpgradeLevel(category, track, profile) {
        const p = profile || this.getActiveProfile();
        if (!p) return 0;
        this.ensureEconomyDefaults(p);
        const cat = String(category || '');
        const t = String(track || '');
        const bag = p.moduleUpgrades && p.moduleUpgrades[cat];
        return Math.max(0, Math.round(Number(bag && bag[t]) || 0));
    },

    canPurchaseModuleUpgrade(category, track, profile) {
        const p = profile || this.getActiveProfile();
        if (!p || typeof economyConfig === 'undefined') {
            return { ok: false, reason: 'NO PROFILE' };
        }
        this.ensureEconomyDefaults(p);
        const defs = economyConfig.moduleUpgradeDefs;
        const cat = String(category || '');
        const t = String(track || '');
        if (!defs || !defs[cat] || !defs[cat][t]) return { ok: false, reason: 'INVALID' };
        const level = this.getModuleUpgradeLevel(cat, t, p);
        const max = defs[cat][t].maxLevel;
        if (level >= max) return { ok: false, reason: 'MAX LEVEL' };
        const cost = economyConfig.getModuleUpgradeCost(cat, t, level + 1);
        if (!cost) return { ok: false, reason: 'INVALID' };
        if (!economyConfig.canAfford(p.resources, cost)) {
            return { ok: false, reason: 'RESOURCES', cost: cost, nextLevel: level + 1 };
        }
        return { ok: true, cost: cost, nextLevel: level + 1 };
    },

    purchaseModuleUpgrade(category, track) {
        const profile = this.getActiveProfile();
        if (!profile || typeof economyConfig === 'undefined') {
            return { ok: false, reason: 'NO PROFILE' };
        }
        this.ensureEconomyDefaults(profile);
        const check = this.canPurchaseModuleUpgrade(category, track, profile);
        if (!check.ok) return check;
        if (!this.spendResources(check.cost)) {
            return { ok: false, reason: 'RESOURCES' };
        }
        const cat = String(category || '');
        const t = String(track || '');
        if (!profile.moduleUpgrades[cat]) profile.moduleUpgrades[cat] = {};
        profile.moduleUpgrades[cat][t] = check.nextLevel;
        this.save();
        return { ok: true, level: check.nextLevel };
    },
});
