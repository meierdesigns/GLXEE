"use strict";

// ProfileManager methods, split from profile-manager.js.
extendClass(ProfileManager, {
    tryBlueprintDrop(killInfo) {
        const profile = this.getActiveProfile();
        if (!profile || typeof economyConfig === 'undefined') return null;
        this.ensureEconomyDefaults(profile);
        const stats = this.getStationStats(profile);
        const chance = Math.min(0.5, economyConfig.getBlueprintDropChance(killInfo) + (stats.dropBonus || 0));
        if (Math.random() > chance) return null;
        const shipId = economyConfig.pickBlueprintShipId(profile.ownedShipIds);
        if (!shipId) return null;
        this.addCargoBlueprint(shipId, 1);
        return shipId;
    },

    hasCargo() {
        const profile = this.getActiveProfile();
        if (!profile) return false;
        this.ensureEconomyDefaults(profile);
        const hasRes = Object.keys(profile.cargo.resources).some((k) => profile.cargo.resources[k] > 0);
        const hasBp = Object.keys(profile.cargo.blueprints).some((k) => profile.cargo.blueprints[k] > 0);
        return hasRes || hasBp;
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
        if (!Object.keys(profile.cargo.resources).length && !Object.keys(profile.cargo.blueprints).length) {
            profile.cargo = this.emptyCargo();
        }
        profile.homeStation.lastTeleportAt = Date.now();
        this.save();
        return moved;
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

    unlockShopItem(shipId) {
        const profile = this.getActiveProfile();
        if (!profile) return { ok: false, reason: 'NO PROFILE' };
        this.ensureEconomyDefaults(profile);
        const id = String(shipId || '');
        if (!id || id === this.getStarterShipId()) {
            return { ok: false, reason: 'INVALID' };
        }
        if (profile.unlockedShopIds.indexOf(id) !== -1) {
            return { ok: false, reason: 'ALREADY UNLOCKED' };
        }
        const count = profile.blueprints[id] || 0;
        if (count < 1) return { ok: false, reason: 'NO BLUEPRINT' };
        profile.blueprints[id] = count - 1;
        if (profile.blueprints[id] <= 0) delete profile.blueprints[id];
        profile.unlockedShopIds.push(id);
        this.discover('ships', id);
        this.save();
        return { ok: true };
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
