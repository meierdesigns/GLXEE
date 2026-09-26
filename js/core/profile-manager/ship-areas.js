"use strict";

// ProfileManager: per-ship hull area levels (see ship-loadout/ship-areas.js).
// Stored as profile.shipUpgrades[shipId].areaLevels = { front, center, back, wing }.
extendClass(ProfileManager, {
    getShipAreaLevels(shipId, profile) {
        const p = profile || this.getActiveProfile();
        const out = { front: 0, center: 0, back: 0, wing: 0 };
        if (!p) return out;
        this.ensureEconomyDefaults(p);
        const id = String(shipId || '');
        const entry = p.shipUpgrades && p.shipUpgrades[id];
        if (!entry) return out;
        if (!entry.areaLevels) {
            entry.areaLevels = this.migrateFrameLevelToAreas(entry.frameLevel);
        }
        const max = this.maxShipAreaLevel();
        Object.keys(out).forEach((k) => {
            out[k] = Math.max(0, Math.min(max, Math.round(Number(entry.areaLevels[k]) || 0)));
        });
        return out;
    },

    maxShipAreaLevel() {
        return (typeof shipLoadoutManager !== 'undefined' && shipLoadoutManager.getMaxAreaLevel)
            ? shipLoadoutManager.getMaxAreaLevel() : 2;
    },

    /**
     * Old frame levels added one slot per level (weapons → defenses →
     * abilities). Hand the same number of levels out to the matching areas
     * so an upgraded ship keeps roughly the slots it had.
     */
    migrateFrameLevelToAreas(frameLevel) {
        const levels = { front: 0, center: 0, back: 0, wing: 0 };
        const order = ['wing', 'center', 'back', 'front'];
        const max = this.maxShipAreaLevel();
        let left = Math.max(0, Math.round(Number(frameLevel) || 0));
        let i = 0;
        while (left > 0 && order.some((a) => levels[a] < max)) {
            const a = order[i % order.length];
            if (levels[a] < max) {
                levels[a] += 1;
                left -= 1;
            }
            i += 1;
        }
        return levels;
    },

    canPurchaseShipAreaUpgrade(shipId, areaId, profile) {
        const p = profile || this.getActiveProfile();
        if (!p || typeof economyConfig === 'undefined') {
            return { ok: false, reason: 'NO PROFILE' };
        }
        this.ensureEconomyDefaults(p);
        const id = String(shipId || '');
        if (!this.ownsShip(id, p)) return { ok: false, reason: 'NOT OWNED' };
        const level = this.getShipAreaLevels(id, p)[areaId];
        if (level == null) return { ok: false, reason: 'INVALID' };
        if (level >= this.maxShipAreaLevel()) return { ok: false, reason: 'MAX LEVEL' };
        const cost = economyConfig.getShipAreaUpgradeCost(areaId, level + 1);
        if (!cost) return { ok: false, reason: 'INVALID' };
        if (!economyConfig.canAfford(p.resources, cost)) {
            return { ok: false, reason: 'RESOURCES', cost: cost, nextLevel: level + 1 };
        }
        return { ok: true, cost: cost, nextLevel: level + 1 };
    },

    purchaseShipAreaUpgrade(shipId, areaId) {
        const profile = this.getActiveProfile();
        if (!profile || typeof economyConfig === 'undefined') {
            return { ok: false, reason: 'NO PROFILE' };
        }
        const id = String(shipId || '');
        const check = this.canPurchaseShipAreaUpgrade(id, areaId, profile);
        if (!check.ok) return check;
        if (!this.spendResources(check.cost)) {
            return { ok: false, reason: 'RESOURCES' };
        }
        if (!profile.shipUpgrades[id]) profile.shipUpgrades[id] = { frameLevel: 0 };
        const entry = profile.shipUpgrades[id];
        if (!entry.areaLevels) entry.areaLevels = this.migrateFrameLevelToAreas(entry.frameLevel);
        entry.areaLevels[areaId] = check.nextLevel;
        // Keep the legacy field in step for anything still reading it.
        entry.frameLevel = Object.values(entry.areaLevels).reduce((s, v) => s + (Number(v) || 0), 0);
        this.save();
        return { ok: true, level: check.nextLevel, area: areaId };
    },
});

// The frame level shown across the UI is now the sum of the area levels.
(function wrapFrameLevel() {
    const proto = ProfileManager.prototype;
    proto.getShipFrameLevel = function (shipId, profile) {
        const lv = this.getShipAreaLevels(shipId, profile);
        return Object.values(lv).reduce((s, v) => s + v, 0);
    };
})();
