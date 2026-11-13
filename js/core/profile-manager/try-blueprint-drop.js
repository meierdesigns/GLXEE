"use strict";

// ProfileManager methods, split from profile-manager.js.
extendClass(ProfileManager, {
    /**
     * Roll a blueprint schematic for a kill. Does not grant cargo — the world
     * pickup must be collected first (see pickupManager.spawnFromKill).
     */
    tryBlueprintDrop(killInfo) {
        const profile = this.getActiveProfile();
        if (!profile || typeof economyConfig === 'undefined') return null;
        this.ensureEconomyDefaults(profile);
        const stats = this.getStationStats(profile);
        const chance = Math.min(0.5, economyConfig.getBlueprintDropChance(killInfo) + (stats.dropBonus || 0));
        if (Math.random() > chance) return null;
        const pool = this.getBlueprintPool();
        if (!pool.length) return null;
        return pool[Math.floor(Math.random() * pool.length)];
    },

    /** Parts an enemy wreck can shed: its own weapons/abilities, else the global pool. */
    getEnemySalvagePool(killInfo) {
        const pool = [];
        const seen = {};
        const push = (kind, id) => {
            const k = String(kind || '');
            const pid = String(id || '');
            if (!pid || (k !== 'weapon' && k !== 'defense' && k !== 'ability' && k !== 'energy')) return;
            if (!this.getPartItem || !this.getPartItem(k, pid)) return;
            const key = k + ':' + pid;
            if (seen[key]) return;
            seen[key] = true;
            pool.push({ kind: k, id: pid, key: key });
        };
        const type = killInfo && killInfo.type;
        if (type && typeof enemyConfigManager !== 'undefined' && enemyConfigManager.getConfig) {
            const cfg = enemyConfigManager.getConfig(type);
            if (cfg) {
                if (cfg.defaultWeapon) push('weapon', cfg.defaultWeapon);
                (cfg.availableWeapons || []).forEach((w) => push('weapon', w));
                const list = cfg.abilities || cfg.defenseMechanisms || [];
                list.forEach((a) => {
                    if (typeof shipLoadoutManager !== 'undefined' && shipLoadoutManager.isEnergyId
                        && shipLoadoutManager.isEnergyId(a)) {
                        push('energy', a);
                    } else if (this.isDefenseAbilityId && this.isDefenseAbilityId(a)) {
                        push('defense', a);
                    } else {
                        push('ability', a);
                    }
                });
            }
        }
        if (!pool.length && this.getBlueprintPool) {
            this.getBlueprintPool().forEach((key) => {
                const bp = this.parseBlueprintKey(key);
                if (bp) push(bp.kind, bp.id);
            });
        }
        return pool;
    },

    /**
     * Roll a finished part drop. Rarer than blueprints. Returns {kind,id,key} or null.
     * Does not grant cargo — pickup collection does.
     */
    tryPartDrop(killInfo) {
        const profile = this.getActiveProfile();
        if (!profile || typeof economyConfig === 'undefined') return null;
        this.ensureEconomyDefaults(profile);
        const stats = this.getStationStats(profile);
        const base = economyConfig.getPartDropChance
            ? economyConfig.getPartDropChance(killInfo)
            : 0.012;
        const chance = Math.min(0.35, base + (stats.dropBonus || 0) * 0.5);
        if (Math.random() > chance) return null;
        const pool = this.getEnemySalvagePool(killInfo);
        if (!pool.length) return null;
        return pool[Math.floor(Math.random() * pool.length)];
    },

    hasCargo() {
        const profile = this.getActiveProfile();
        if (!profile) return false;
        this.ensureEconomyDefaults(profile);
        const hasRes = Object.keys(profile.cargo.resources).some((k) => profile.cargo.resources[k] > 0);
        const hasBp = Object.keys(profile.cargo.blueprints).some((k) => profile.cargo.blueprints[k] > 0);
        const hasParts = Object.keys(profile.cargo.parts || {}).some((k) => profile.cargo.parts[k] > 0);
        return hasRes || hasBp || hasParts;
    },

    teleportCargoToStation() {
        const profile = this.getActiveProfile();
        if (!profile) return false;
        this.ensureEconomyDefaults(profile);
        const stats = this.getStationStats(profile);
        let moved = false;
        Object.keys(profile.cargo.resources).forEach((id) => {
            const n = profile.cargo.resources[id] || 0;
            if (n <= 0) return;
            const applied = this.applyResourceCap(profile.resources[id], n, stats.resourceCap);
            if (applied.granted > 0) {
                profile.resources[id] = applied.next;
                moved = true;
            }
            if (applied.leftover > 0) {
                profile.cargo.resources[id] = applied.leftover;
            } else {
                delete profile.cargo.resources[id];
            }
        });
        Object.keys(profile.cargo.blueprints).forEach((id) => {
            const n = profile.cargo.blueprints[id] || 0;
            if (n > 0) {
                profile.blueprints[id] = (profile.blueprints[id] || 0) + n;
                delete profile.cargo.blueprints[id];
                moved = true;
            }
        });
        Object.keys(profile.cargo.parts || {}).forEach((key) => {
            const n = profile.cargo.parts[key] || 0;
            if (n <= 0) {
                delete profile.cargo.parts[key];
                return;
            }
            const bp = this.parseBlueprintKey(key);
            if (!bp) {
                delete profile.cargo.parts[key];
                return;
            }
            const bag = bp.kind === 'weapon' ? profile.parts.weapons
                : (bp.kind === 'defense' ? profile.parts.defenses
                    : (bp.kind === 'energy' ? profile.parts.energy : profile.parts.abilities));
            bag[bp.id] = (bag[bp.id] || 0) + n;
            const discoverCat = { weapon: 'weapons', defense: 'defenses', ability: 'abilities', energy: 'energy' }[bp.kind];
            if (discoverCat && this.discover) this.discover(discoverCat, bp.id);
            delete profile.cargo.parts[key];
            moved = true;
        });
        if (!Object.keys(profile.cargo.resources).length
            && !Object.keys(profile.cargo.blueprints).length
            && !Object.keys(profile.cargo.parts || {}).length) {
            profile.cargo = this.emptyCargo();
        }
        profile.homeStation.lastTeleportAt = Date.now();
        this.save();
        return moved;
    },

    /** Resources only: auto-collected into the station wallet at victory, capped same as
     *  teleportCargoToStation. Parts/blueprints are left in cargo — see sellCargoPart /
     *  takeCargoPartToShip / clearPendingCargo — so the victory screen's found-items grid
     *  reflects a real "take or sell" decision instead of displaying already-stored items. */
    teleportCargoResourcesToStation() {
        const profile = this.getActiveProfile();
        if (!profile) return false;
        this.ensureEconomyDefaults(profile);
        const stats = this.getStationStats(profile);
        let moved = false;
        Object.keys(profile.cargo.resources).forEach((id) => {
            const n = profile.cargo.resources[id] || 0;
            if (n <= 0) return;
            const applied = this.applyResourceCap(profile.resources[id], n, stats.resourceCap);
            if (applied.granted > 0) {
                profile.resources[id] = applied.next;
                moved = true;
            }
            if (applied.leftover > 0) {
                profile.cargo.resources[id] = applied.leftover;
            } else {
                delete profile.cargo.resources[id];
            }
        });
        this.save();
        return moved;
    },

    /** Credits a cargo part/blueprint would pay out (same rate as a stored one).
     *  A key that no longer resolves (part renamed/removed since it was picked up) still
     *  pays out a token amount — it must stay sellable or it gets stuck in cargo forever. */
    getCargoPartSellValue(key) {
        const bp = this.parseBlueprintKey(key);
        if (!bp || typeof economyConfig === 'undefined') return 1;
        return this.getSellValue(economyConfig.getPartCost(bp.kind, bp.item));
    },

    /** Sells still-pending cargo parts/blueprints directly — never touches station/ship
     *  storage. `asBlueprint` sells from profile.cargo.blueprints, otherwise from
     *  profile.cargo.parts. `amount` defaults to the full stack; pass 1 for one
     *  victory-grid cell (parts render one unit per cell). */
    sellCargoPart(key, asBlueprint, amount) {
        const profile = this.getActiveProfile();
        if (!profile) return { ok: false, reason: 'NO PROFILE' };
        this.ensureEconomyDefaults(profile);
        const bucket = asBlueprint ? profile.cargo.blueprints : (profile.cargo.parts || {});
        const available = bucket[key] || 0;
        if (available <= 0) return { ok: false, reason: 'NONE LEFT' };
        const n = amount == null
            ? available
            : Math.max(1, Math.min(available, Math.round(Number(amount) || 1)));
        const unitValue = this.getCargoPartSellValue(key);
        const credits = unitValue * n;
        const left = available - n;
        if (left > 0) bucket[key] = left;
        else delete bucket[key];
        if (credits > 0) this.addCredits(credits, true);
        this.save();
        return { ok: true, credits: credits, amount: n };
    },

    /** Files a pending cargo part onto `shipId`'s storage: grants real ownership (profile.parts)
     *  and marks it filed on that ship in one step, then clears it out of cargo. Blueprints
     *  stay craft-only (station), so only `profile.cargo.parts` entries can be taken this way.
     *  `amount` defaults to the full stack; pass 1 for one victory-grid cell. */
    takeCargoPartToShip(shipId, key, amount) {
        const profile = this.getActiveProfile();
        if (!profile || !shipId) return { ok: false, reason: 'NO PROFILE' };
        this.ensureEconomyDefaults(profile);
        const available = (profile.cargo.parts || {})[key] || 0;
        if (available <= 0) return { ok: false, reason: 'NONE LEFT' };
        const n = amount == null
            ? available
            : Math.max(1, Math.min(available, Math.round(Number(amount) || 1)));
        const bp = this.parseBlueprintKey(key);
        if (!bp) return { ok: false, reason: 'INVALID' };
        const bag = bp.kind === 'weapon' ? profile.parts.weapons
            : (bp.kind === 'defense' ? profile.parts.defenses
                : (bp.kind === 'energy' ? profile.parts.energy : profile.parts.abilities));
        bag[bp.id] = (bag[bp.id] || 0) + n;
        const shipBucket = { weapon: 'weapons', defense: 'defenses', ability: 'abilities', energy: 'energy' }[bp.kind];
        if (shipBucket && this.discover) this.discover(shipBucket === 'energy' ? 'energy' : shipBucket, bp.id);
        if (shipBucket && this.fileUnequippedPart) {
            for (let i = 0; i < n; i++) this.fileUnequippedPart(profile, shipId, shipBucket, bp.id);
        }
        const left = available - n;
        if (left > 0) profile.cargo.parts[key] = left;
        else delete profile.cargo.parts[key];
        this.save();
        return { ok: true, amount: n };
    },

    /** Drops whatever found parts/blueprints the player never took or sold — called when the
     *  victory screen closes (next stage / leave planet), so the decision can't be skipped. */
    clearPendingCargo() {
        const profile = this.getActiveProfile();
        if (!profile) return;
        this.ensureEconomyDefaults(profile);
        profile.cargo.parts = {};
        profile.cargo.blueprints = {};
        this.save();
    },

    spendResources(costMap) {
        const profile = this.getActiveProfile();
        if (!profile || typeof economyConfig === 'undefined') return false;
        this.ensureEconomyDefaults(profile);
        if (!economyConfig.canAfford(profile.resources, costMap)) return false;
        Object.keys(costMap || {}).forEach((id) => {
            profile.resources[id] = (profile.resources[id] || 0) - (costMap[id] || 0);
            if (profile.resources[id] <= 0) delete profile.resources[id];
        });
        this.save();
        return true;
    },

    getCredits(profile) {
        const p = profile || this.getActiveProfile();
        if (!p) return 0;
        this.ensureEconomyDefaults(p);
        return Math.max(0, Math.round(Number(p.credits) || 0));
    },

    canAffordCredits(amount, profile) {
        return this.getCredits(profile) >= Math.max(0, Math.round(Number(amount) || 0));
    },

    spendCredits(amount, skipSave) {
        const profile = this.getActiveProfile();
        if (!profile) return false;
        this.ensureEconomyDefaults(profile);
        const n = Math.max(0, Math.round(Number(amount) || 0));
        if (n <= 0) return true;
        if (profile.credits < n) return false;
        profile.credits -= n;
        if (!skipSave) this.save();
        return true;
    },

    addCredits(amount, skipSave) {
        const profile = this.getActiveProfile();
        if (!profile) return false;
        this.ensureEconomyDefaults(profile);
        const n = Math.max(0, Math.round(Number(amount) || 0));
        if (n <= 0) return true;
        profile.credits = Math.max(0, Math.round(Number(profile.credits) || 0) + n);
        if (!skipSave) this.save();
        return true;
    },

    getResourceBag(bag, profile) {
        const p = profile || this.getActiveProfile();
        if (!p) return null;
        this.ensureEconomyDefaults(p);
        const kind = String(bag || 'station').toLowerCase();
        if (kind === 'cargo') return p.cargo.resources;
        return p.resources;
    },

    getResourceBagCap(bag, profile) {
        const stats = this.getStationStats(profile);
        return String(bag || 'station').toLowerCase() === 'cargo'
            ? stats.cargoCap
            : stats.resourceCap;
    },

    /**
     * Buy resource into station or cargo. Paid from uncapped CREDITS.
     * bag: 'station' | 'cargo'
     */
    buyShopResource(resourceId, amount, bag) {
        const profile = this.getActiveProfile();
        if (!profile || typeof economyConfig === 'undefined') {
            return { ok: false, reason: 'NO PROFILE' };
        }
        this.ensureEconomyDefaults(profile);
        const id = String(resourceId || '').toLowerCase();
        const n = Math.max(1, Math.round(Number(amount) || 1));
        const bagKind = String(bag || 'station').toLowerCase() === 'cargo' ? 'cargo' : 'station';
        if (!economyConfig.isResourceTradeable(id)) {
            return { ok: false, reason: 'INVALID' };
        }
        const bagMap = this.getResourceBag(bagKind, profile);
        const cap = this.getResourceBagCap(bagKind, profile);
        const applied = this.applyResourceCap(bagMap[id], n, cap);
        if (applied.granted <= 0) {
            return { ok: false, reason: bagKind === 'cargo' ? 'CARGO FULL' : 'STATION FULL' };
        }
        const paid = economyConfig.getResourceBuyCost(id, applied.granted);
        if (!paid || !this.spendCredits(paid.credits, true)) {
            return { ok: false, reason: 'CREDITS' };
        }
        bagMap[id] = applied.next;
        this.save();
        return { ok: true, amount: applied.granted, bag: bagKind, cost: paid };
    },

    /**
     * Sell resource from station or cargo. Credits payout is uncapped.
     * bag: 'station' | 'cargo'
     */
    sellShopResource(resourceId, amount, bag) {
        const profile = this.getActiveProfile();
        if (!profile || typeof economyConfig === 'undefined') {
            return { ok: false, reason: 'NO PROFILE' };
        }
        this.ensureEconomyDefaults(profile);
        const id = String(resourceId || '').toLowerCase();
        const n = Math.max(1, Math.round(Number(amount) || 1));
        const bagKind = String(bag || 'station').toLowerCase() === 'cargo' ? 'cargo' : 'station';
        if (!economyConfig.isResourceTradeable(id)) {
            return { ok: false, reason: 'INVALID' };
        }
        const bagMap = this.getResourceBag(bagKind, profile);
        const have = Math.max(0, Math.round(Number(bagMap[id]) || 0));
        if (have < 1) return { ok: false, reason: 'EMPTY' };
        const sold = Math.min(n, have);
        const payout = economyConfig.getResourceSellPayout(id, sold);
        if (!payout) return { ok: false, reason: 'INVALID' };
        bagMap[id] = have - sold;
        if (bagMap[id] <= 0) delete bagMap[id];
        this.addCredits(payout.credits, true);
        this.save();
        return { ok: true, amount: sold, bag: bagKind, payout: payout };
    },

    getDiscountedCraftCost(shipConfig, profile) {
        const base = (typeof economyConfig !== 'undefined')
            ? economyConfig.getCraftCost(shipConfig)
            : { scrap: 80 };
        const stats = this.getStationStats(profile);
        const discount = Math.max(0, Math.min(0.5, Number(stats.craftDiscount) || 0));
        if (discount <= 0) return base;
        const out = {};
        Object.keys(base).forEach((id) => {
            out[id] = Math.max(1, Math.ceil(base[id] * (1 - discount)));
        });
        return out;
    },

    isShopUnlocked(shipId) {
        const profile = this.getActiveProfile();
        if (!profile) return false;
        this.ensureEconomyDefaults(profile);
        return profile.unlockedShopIds.indexOf(String(shipId || '')) !== -1;
    },

    buyShip(shipId) {
        const profile = this.getActiveProfile();
        if (!profile || typeof economyConfig === 'undefined' || typeof shipConfigManager === 'undefined') {
            return { ok: false, reason: 'NO PROFILE' };
        }
        this.ensureEconomyDefaults(profile);
        const id = String(shipId || '');
        if (!id || id === this.getStarterShipId()) {
            return { ok: false, reason: 'INVALID' };
        }
        if (profile.ownedShipIds.indexOf(id) !== -1) {
            return { ok: false, reason: 'OWNED' };
        }
        if (this.getFreeShipSlots(profile) < 1) {
            return { ok: false, reason: 'NO SHIP SLOTS' };
        }
        const cfg = shipConfigManager.getConfig(id);
        if (!cfg || cfg.custom) {
            return { ok: false, reason: 'INVALID' };
        }
        if (!this.isShipAvailableInShop(id, profile)) {
            return { ok: false, reason: 'WRONG GALAXY' };
        }
        const cost = economyConfig.getShopCost(cfg);
        const creditCost = Math.max(0, Math.round(Number(cost.credits) || 0));
        if (creditCost > 0) {
            if (!this.spendCredits(creditCost)) {
                return { ok: false, reason: 'CREDITS' };
            }
        } else if (!this.spendResources(cost)) {
            return { ok: false, reason: 'RESOURCES' };
        }
        profile.ownedShipIds.push(id);
        if (profile.unlockedShopIds.indexOf(id) === -1) {
            profile.unlockedShopIds.push(id);
        }
        this.discoverShipContents(id);
        this.save();
        return { ok: true };
    },
});
