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

    /** Split `defId` / `defId#unit` so each owned copy can keep its own upgrades. */
    parsePartInstanceId(itemId) {
        const raw = String(itemId || '');
        const m = raw.match(/^(.*)#(\d+)$/);
        if (m) {
            return {
                defId: m[1],
                unit: Math.max(0, parseInt(m[2], 10) || 0),
                instanceId: raw
            };
        }
        return { defId: raw, unit: null, instanceId: raw };
    },

    partDefId(itemId) {
        return this.parsePartInstanceId(itemId).defId;
    },

    /** Canonical upgrade bag key for one owned copy (`defId#unit`). Bare defId → #0. */
    partInstanceKey(itemId) {
        const p = this.parsePartInstanceId(itemId);
        if (!p.defId) return '';
        const unit = p.unit != null ? p.unit : 0;
        return p.defId + '#' + unit;
    },

    /**
     * Stable unit indices 0..owned-1 packed by location: each ship's equipped copies,
     * then that ship's filed copies (ownedShipIds order), then station leftovers.
     */
    getPartInstanceLayout(profile, bucket, defId) {
        const p = profile || this.getActiveProfile();
        const id = String(defId || '');
        const out = { station: [], ships: {}, owned: 0 };
        if (!p || !id || bucket === 'blueprints') return out;
        let owned = Math.max(0, Math.round(Number(this._ownedStorageCount(p, bucket, id)) || 0));
        if (owned <= 0) {
            // Starter loadout parts can be visible with owned=0 (filed/equipped only).
            const ships = p.ownedShipIds || [];
            let visible = 0;
            ships.forEach((shipId) => {
                visible += this._equippedStorageCount(p, shipId, bucket, id);
                const entry = (p.shipStorage || {})[shipId];
                visible += (entry && entry[bucket] && entry[bucket][id]) || 0;
            });
            owned = Math.max(0, visible);
        }
        out.owned = owned;
        let cursor = 0;
        const take = (n) => {
            const slice = [];
            const count = Math.max(0, Math.round(Number(n) || 0));
            for (let i = 0; i < count && cursor < owned; i++) slice.push(cursor++);
            return slice;
        };
        (p.ownedShipIds || []).forEach((shipId) => {
            const eq = this._equippedStorageCount(p, shipId, bucket, id);
            const entry = (p.shipStorage || {})[shipId];
            const filed = (entry && entry[bucket] && entry[bucket][id]) || 0;
            out.ships[shipId] = take(eq).concat(take(filed));
        });
        while (cursor < owned) out.station.push(cursor++);
        return out;
    },

    /** Upgrade-bag key for the Nth equipped copy of defId on a ship (0-based). */
    getEquippedInstanceId(profile, shipId, bucket, defId, occurrence) {
        const id = String(defId || '');
        const occ = Math.max(0, Math.round(Number(occurrence) || 0));
        const layout = this.getPartInstanceLayout(profile, bucket, id);
        const shipUnits = (layout.ships && layout.ships[shipId]) || [];
        const eq = this._equippedStorageCount(profile, shipId, bucket, id);
        if (occ >= eq || occ >= shipUnits.length) return this.partInstanceKey(id);
        return id + '#' + shipUnits[occ];
    },

    /**
     * After a station↔ship move of one specific unit, slide upgrade bags so the
     * dragged copy keeps its levels under the new packed index.
     */
    remapPartInstanceUpgrades(profile, bucket, defId, fromUnit, toIndex) {
        const p = profile || this.getActiveProfile();
        if (!p || !defId || bucket === 'blueprints') return;
        this.ensureEconomyDefaults(p);
        const bag = p.itemUpgrades && p.itemUpgrades[bucket];
        if (!bag) return;
        const owned = Math.max(0, Math.round(Number(this._ownedStorageCount(p, bucket, defId)) || 0));
        if (owned <= 1) return;
        const from = Math.max(0, Math.round(Number(fromUnit) || 0));
        const to = Math.max(0, Math.round(Number(toIndex) || 0));
        if (from === to || from >= owned || to >= owned) return;
        const arr = [];
        for (let i = 0; i < owned; i++) {
            const k = defId + '#' + i;
            if (bag[k] && typeof bag[k] === 'object') arr.push(bag[k]);
            else if (i === 0 && bag[defId] && typeof bag[defId] === 'object') arr.push(bag[defId]);
            else arr.push(null);
        }
        const moved = arr.splice(from, 1)[0];
        arr.splice(to, 0, moved);
        if (bag[defId]) delete bag[defId];
        for (let i = 0; i < owned; i++) {
            const k = defId + '#' + i;
            if (arr[i]) bag[k] = arr[i];
            else delete bag[k];
        }
    },

    /** Raw per-item entry ({ tracks, mode, tune }), ensuring buckets exist first. */
    _itemUpgradeEntry(bucket, itemId, profile) {
        const p = profile || this.getActiveProfile();
        if (!p) return null;
        this.ensureEconomyDefaults(p);
        const b = String(bucket || '');
        const parsed = this.parsePartInstanceId(itemId);
        if (!parsed.defId) return null;
        const id = this.partInstanceKey(parsed.instanceId);
        const bag = p.itemUpgrades && p.itemUpgrades[b];
        if (!bag) return null;
        // Legacy saves keyed upgrades by bare defId — fold onto #0 once.
        if (!bag[id] && bag[parsed.defId] && typeof bag[parsed.defId] === 'object') {
            bag[id] = bag[parsed.defId];
            delete bag[parsed.defId];
        }
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

    /** Owned anywhere (station/ship storage) or currently equipped on any owned ship.
     *  Instance ids (`defId#unit`) resolve against the bare defId ledger. */
    _itemIsOwnedOrEquipped(profile, bucket, itemId) {
        const parsed = this.parsePartInstanceId(itemId);
        const defId = parsed.defId;
        if (!defId) return false;
        const owned = this._ownedStorageCount(profile, bucket, defId);
        if (parsed.unit != null) {
            if (owned > 0) return parsed.unit >= 0 && parsed.unit < owned;
            // owned=0 starter copies still upgradeable while filed/equipped
            const layout = this.getPartInstanceLayout(profile, bucket, defId);
            return parsed.unit >= 0 && parsed.unit < layout.owned;
        }
        if (owned > 0) return true;
        if (this._equippedStorageCountAll(profile, bucket, defId) > 0) return true;
        const map = profile.shipStorage || {};
        return Object.keys(map).some((shipId) => {
            const entry = map[shipId] && map[shipId][bucket];
            return !!(entry && (entry[defId] || 0) > 0);
        });
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
        if (economyConfig.itemTrackApplies && !economyConfig.itemTrackApplies(b, id, track)) {
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
    /** Vendor roll from planet shop (stored on the bought copy). */
    setShopVendorRoll(bucket, instanceId, mul, classKey) {
        const profile = this.getActiveProfile();
        if (!profile) return;
        this.ensureEconomyDefaults(profile);
        const entry = this._itemUpgradeEntry(bucket, instanceId, profile);
        if (!entry) return;
        entry.vendorRoll = Object.assign({}, mul || {});
        if (classKey) entry.vendorClass = String(classKey);
        this.save();
    },

    /** Shop-class key for a salvage/found part (same bands as planet shop). */
    salvageShopClassKey(kind, id) {
        const k = String(kind || '');
        if (k === 'weapon' && typeof balanceConfigManager !== 'undefined' && balanceConfigManager.getWeaponRole) {
            return balanceConfigManager.getWeaponRole(id) || 'sustained';
        }
        if (k === 'defense') return 'defense';
        if (k === 'energy') return 'energy';
        return 'ability';
    },

    /** Roll final salvage multipliers inside the class band (revealed on loot-to-ship). */
    rollSalvageVendorStats(kind, id) {
        const classKey = this.salvageShopClassKey(kind, id);
        const bcm = typeof balanceConfigManager !== 'undefined' ? balanceConfigManager : null;
        const def = (bcm && bcm.SHOP_ITEM_CLASSES && bcm.SHOP_ITEM_CLASSES[classKey])
            || { label: String(classKey).toUpperCase() };
        const pick = (pair) => {
            if (!pair || pair.length < 2) return 1;
            const t = Math.random();
            return Math.round((pair[0] + t * (pair[1] - pair[0])) * 1000) / 1000;
        };
        const mul = {};
        if (def.dmg) mul.dmgMul = pick(def.dmg);
        if (def.spd) mul.spdMul = pick(def.spd);
        if (def.cd) mul.cdMul = pick(def.cd);
        if (def.potency) mul.potencyMul = pick(def.potency);
        if (def.duration) mul.durationMul = pick(def.duration);
        if (def.ammo) mul.ammoMul = pick(def.ammo);
        return { classKey: classKey, classLabel: def.label || String(classKey).toUpperCase(), mul: mul };
    },

    _vendorRollMul(entry, key) {
        const vr = entry && entry.vendorRoll;
        const n = vr && vr[key] != null ? Number(vr[key]) : 1;
        return Number.isFinite(n) && n > 0 ? n : 1;
    },

    getItemUpgradeBonuses(bucket, itemId, profile) {
        const p = profile || this.getActiveProfile();
        const entry = p ? this._itemUpgradeEntry(bucket, itemId, p) : null;
        const ramp = (lv, base, accel) => {
            const n = Math.max(0, Math.round(Number(lv) || 0));
            if (n <= 0) return 0;
            let total = 0;
            for (let i = 1; i <= n; i++) total += base + (i - 1) * accel;
            return total;
        };
        const trackLevel = (track) => p ? this.getItemTrackLevel(bucket, itemId, track, p) : 0;
        if (bucket === 'weapons') {
            const bonuses = {
                damageMul: 1 + ramp(trackLevel('dmg'), 0.05, 0.02),
                cooldownMul: Math.max(0.6, 1 - ramp(trackLevel('rof'), 0.04, 0.015)),
                rangeMul: 1 + ramp(trackLevel('range'), 0.04, 0.015),
                reflectiveShots: trackLevel('reflect') > 0,
                chainSlow: trackLevel('chain') > 0
                    && (typeof economyConfig === 'undefined' || !economyConfig.itemTrackApplies
                        || economyConfig.itemTrackApplies('weapons', itemId, 'chain'))
            };
            bonuses.damageMul *= this._vendorRollMul(entry, 'dmgMul');
            bonuses.cooldownMul *= this._vendorRollMul(entry, 'cdMul');
            bonuses.rangeMul *= this._vendorRollMul(entry, 'spdMul');
            return bonuses;
        }
        if (bucket === 'defenses') {
            const bonuses = {
                capacityMul: 1 + ramp(trackLevel('capacity'), 0.055, 0.025),
                harden: Math.min(0.25, ramp(trackLevel('harden'), 0.025, 0.01)),
                regenMul: 1 + ramp(trackLevel('regen'), 0.07, 0.03)
            };
            const pot = this._vendorRollMul(entry, 'potencyMul');
            bonuses.capacityMul *= pot;
            bonuses.regenMul *= pot;
            return bonuses;
        }
        // abilities / energy
        const bonuses = {
            cooldownMul: Math.max(0.6, 1 - ramp(trackLevel('cooldown'), 0.04, 0.015)),
            potencyMul: 1 + ramp(trackLevel('potency'), 0.06, 0.025),
            durationMul: 1 + ramp(trackLevel('duration'), 0.055, 0.02)
        };
        const pot = this._vendorRollMul(entry, 'potencyMul');
        const dur = this._vendorRollMul(entry, 'durationMul');
        bonuses.potencyMul *= pot;
        bonuses.durationMul *= dur;
        bonuses.cooldownMul *= this._vendorRollMul(entry, 'cdMul');
        return bonuses;
    },
});
