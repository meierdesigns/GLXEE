"use strict";

// ProfileManager methods, split from profile-manager.js.
// Per-item upgrades (EQUIPMENT tab): one specific weapon/defense/ability/
// energy item id, independent of the category-wide MODULES levels
// (moduleUpgrades). Each item holds several independently leveled stat
// tracks (economyConfig.itemUpgradeTrackDefs), a free-to-switch fire mode
// (weapons only, economyConfig.itemFireModes, unlocked by a track level),
// and a free numeric fine-tune slider (0..1) biasing two of its stats.
extendClass(ProfileManager, {
    ITEM_UPGRADE_BUCKETS: ['weapons', 'defenses', 'abilities', 'energy'],

    /** Raw per-item entry ({ tracks, mode, tune }), ensuring buckets exist first. */
    _itemUpgradeEntry(bucket, itemId, profile) {
        const p = profile || this.getActiveProfile();
        if (!p) return null;
        this.ensureEconomyDefaults(p);
        const b = String(bucket || '');
        const id = String(itemId || '');
        const bag = p.itemUpgrades && p.itemUpgrades[b];
        if (!bag) return null;
        if (!bag[id] || typeof bag[id] !== 'object') {
            bag[id] = { tracks: {}, mode: 'single', tune: 0.5, tuneUnlocked: false };
        }
        return bag[id];
    },

    getItemTrackLevel(bucket, itemId, track, profile) {
        const entry = this._itemUpgradeEntry(bucket, itemId, profile);
        if (!entry) return 0;
        return Math.max(0, Math.round(Number(entry.tracks[track]) || 0));
    },

    /** Combined level across all tracks — used where a single display number is wanted. */
    getItemUpgradeLevel(bucket, itemId, profile) {
        const entry = this._itemUpgradeEntry(bucket, itemId, profile);
        if (!entry) return 0;
        return Object.keys(entry.tracks).reduce((sum, t) => sum + Math.max(0, Math.round(Number(entry.tracks[t]) || 0)), 0);
    },

    /** Owned anywhere (station/ship storage) or currently equipped on any owned ship. */
    _itemIsOwnedOrEquipped(profile, bucket, itemId) {
        if (this._ownedStorageCount(profile, bucket, itemId) > 0) return true;
        return this._equippedStorageCountAll(profile, bucket, itemId) > 0;
    },

    canPurchaseItemTrackUpgrade(bucket, itemId, track, profile) {
        const p = profile || this.getActiveProfile();
        if (!p || typeof economyConfig === 'undefined') {
            return { ok: false, reason: 'NO PROFILE' };
        }
        this.ensureEconomyDefaults(p);
        const b = String(bucket || '');
        const id = String(itemId || '');
        const trackDefs = economyConfig.itemUpgradeTrackDefs[b];
        if (this.ITEM_UPGRADE_BUCKETS.indexOf(b) === -1 || !id || !trackDefs || !trackDefs[track]) {
            return { ok: false, reason: 'INVALID' };
        }
        if (!this._itemIsOwnedOrEquipped(p, b, id)) {
            return { ok: false, reason: 'NOT_OWNED' };
        }
        const level = this.getItemTrackLevel(b, id, track, p);
        const max = trackDefs[track].maxLevel || 5;
        if (level >= max) return { ok: false, reason: 'MAX LEVEL' };
        const cost = economyConfig.getItemTrackUpgradeCost(b, id, track, level + 1);
        if (!cost) return { ok: false, reason: 'INVALID' };
        if (!economyConfig.canAfford(p.resources, cost)) {
            return { ok: false, reason: 'RESOURCES', cost: cost, nextLevel: level + 1 };
        }
        return { ok: true, cost: cost, nextLevel: level + 1 };
    },

    purchaseItemTrackUpgrade(bucket, itemId, track) {
        const profile = this.getActiveProfile();
        if (!profile || typeof economyConfig === 'undefined') {
            return { ok: false, reason: 'NO PROFILE' };
        }
        this.ensureEconomyDefaults(profile);
        const check = this.canPurchaseItemTrackUpgrade(bucket, itemId, track, profile);
        if (!check.ok) return check;
        if (!this.spendResources(check.cost)) {
            return { ok: false, reason: 'RESOURCES' };
        }
        const entry = this._itemUpgradeEntry(bucket, itemId, profile);
        entry.tracks[track] = check.nextLevel;
        this.save();
        return { ok: true, level: check.nextLevel };
    },

    /** Fire modes unlocked so far for this item (weapons only; other buckets have none yet). */
    getAvailableItemModes(bucket, itemId, profile) {
        if (bucket !== 'weapons' || typeof economyConfig === 'undefined' || !economyConfig.itemFireModes) return [];
        return Object.keys(economyConfig.itemFireModes).filter((modeId) => {
            const def = economyConfig.itemFireModes[modeId];
            if (!def.unlockTrack) return true;
            return this.getItemTrackLevel(bucket, itemId, def.unlockTrack, profile) >= (def.unlockLevel || 1);
        });
    },

    getItemMode(bucket, itemId, profile) {
        const entry = this._itemUpgradeEntry(bucket, itemId, profile);
        return (entry && entry.mode) || 'single';
    },

    /** Free to switch once unlocked — no resource cost. */
    setItemMode(bucket, itemId, mode) {
        const profile = this.getActiveProfile();
        const entry = this._itemUpgradeEntry(bucket, itemId, profile);
        if (!entry) return { ok: false, reason: 'NO PROFILE' };
        if (this.getAvailableItemModes(bucket, itemId, profile).indexOf(mode) === -1) {
            return { ok: false, reason: 'LOCKED' };
        }
        entry.mode = mode;
        this.save();
        return { ok: true, mode: mode };
    },

    /** Fine-tune unlocked via one-time purchase on that item. */
    isItemTuneUnlocked(bucket, itemId, profile) {
        const entry = this._itemUpgradeEntry(bucket, itemId, profile);
        return !!(entry && entry.tuneUnlocked);
    },

    canPurchaseItemTuneUnlock(bucket, itemId, profile) {
        const p = profile || this.getActiveProfile();
        if (!p || typeof economyConfig === 'undefined') {
            return { ok: false, reason: 'NO PROFILE' };
        }
        this.ensureEconomyDefaults(p);
        const b = String(bucket || '');
        const id = String(itemId || '');
        if (this.ITEM_UPGRADE_BUCKETS.indexOf(b) === -1 || !id || !economyConfig.itemTuneUnlock[b]) {
            return { ok: false, reason: 'INVALID' };
        }
        if (!this._itemIsOwnedOrEquipped(p, b, id)) {
            return { ok: false, reason: 'NOT_OWNED' };
        }
        if (this.isItemTuneUnlocked(b, id, p)) {
            return { ok: false, reason: 'OWNED' };
        }
        const cost = economyConfig.getItemTuneUnlockCost(b);
        if (!cost) return { ok: false, reason: 'INVALID' };
        if (!economyConfig.canAfford(p.resources, cost)) {
            return { ok: false, reason: 'RESOURCES', cost: cost };
        }
        return { ok: true, cost: cost };
    },

    purchaseItemTuneUnlock(bucket, itemId) {
        const profile = this.getActiveProfile();
        if (!profile || typeof economyConfig === 'undefined') {
            return { ok: false, reason: 'NO PROFILE' };
        }
        this.ensureEconomyDefaults(profile);
        const check = this.canPurchaseItemTuneUnlock(bucket, itemId, profile);
        if (!check.ok) return check;
        if (!this.spendResources(check.cost)) {
            return { ok: false, reason: 'RESOURCES' };
        }
        const entry = this._itemUpgradeEntry(bucket, itemId, profile);
        entry.tuneUnlocked = true;
        this.save();
        return { ok: true };
    },

    getItemTune(bucket, itemId, profile) {
        if (!this.isItemTuneUnlocked(bucket, itemId, profile)) return 0.5;
        const entry = this._itemUpgradeEntry(bucket, itemId, profile);
        return entry ? Math.max(0, Math.min(1, Number(entry.tune))) : 0.5;
    },

    /** Free fine-tune slider (0..1) once unlocked — biases two of the item's stats against each other. */
    setItemTune(bucket, itemId, value) {
        const profile = this.getActiveProfile();
        const entry = this._itemUpgradeEntry(bucket, itemId, profile);
        if (!entry) return { ok: false, reason: 'NO PROFILE' };
        if (!this.isItemTuneUnlocked(bucket, itemId, profile)) {
            return { ok: false, reason: 'LOCKED' };
        }
        entry.tune = Math.max(0, Math.min(1, Number(value)));
        this.save();
        return { ok: true, tune: entry.tune };
    },

    /** Same progressive ramp as getModuleUpgradeBonuses, scoped to one item's own track levels. */
    getItemUpgradeBonuses(bucket, itemId, profile) {
        const p = profile || this.getActiveProfile();
        const ramp = (lv, base, accel) => {
            const n = Math.max(0, Math.round(Number(lv) || 0));
            if (n <= 0) return 0;
            let total = 0;
            for (let i = 1; i <= n; i++) total += base + (i - 1) * accel;
            return total;
        };
        const trackLevel = (track) => p ? this.getItemTrackLevel(bucket, itemId, track, p) : 0;
        if (bucket === 'weapons') {
            return {
                damageMul: 1 + ramp(trackLevel('dmg'), 0.05, 0.02),
                cooldownMul: Math.max(0.6, 1 - ramp(trackLevel('rof'), 0.04, 0.015)),
                rangeMul: 1 + ramp(trackLevel('range'), 0.04, 0.015)
            };
        }
        if (bucket === 'defenses') {
            return {
                capacityMul: 1 + ramp(trackLevel('capacity'), 0.055, 0.025),
                harden: Math.min(0.25, ramp(trackLevel('harden'), 0.025, 0.01)),
                regenMul: 1 + ramp(trackLevel('regen'), 0.07, 0.03)
            };
        }
        // abilities / energy
        return {
            cooldownMul: Math.max(0.6, 1 - ramp(trackLevel('cooldown'), 0.04, 0.015)),
            potencyMul: 1 + ramp(trackLevel('potency'), 0.06, 0.025),
            durationMul: 1 + ramp(trackLevel('duration'), 0.055, 0.02)
        };
    },
});
