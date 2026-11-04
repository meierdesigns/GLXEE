"use strict";

// ProfileManager methods, split from profile-manager.js.
// Per-ship "ship storage" is a purely organisational overlay on top of the
// existing owned-count ledgers (profile.parts / profile.blueprints) — it
// never changes what's owned or what can be equipped, it only tracks how
// many of each owned item the player has mentally filed as "on this ship"
// vs "still at the station". Equip checks (compute-power-budget.js) keep
// reading profile.parts directly and are unaffected.
extendClass(ProfileManager, {
    SHIP_STORAGE_BUCKETS: ['weapons', 'defenses', 'abilities', 'energy', 'blueprints'],

    _emptyShipStorageEntry() {
        return { weapons: {}, defenses: {}, abilities: {}, energy: {}, blueprints: {} };
    },

    /** The given ship's storage bucket map, created on first use. */
    getShipStorageEntry(profile, shipId) {
        if (!profile.shipStorage || typeof profile.shipStorage !== 'object') profile.shipStorage = {};
        if (!profile.shipStorage[shipId] || typeof profile.shipStorage[shipId] !== 'object') {
            profile.shipStorage[shipId] = this._emptyShipStorageEntry();
        }
        const entry = profile.shipStorage[shipId];
        this.SHIP_STORAGE_BUCKETS.forEach((b) => {
            if (!entry[b] || typeof entry[b] !== 'object') entry[b] = {};
        });
        return entry;
    },

    /** Total owned count for a bucket/id (bucket is one of SHIP_STORAGE_BUCKETS). */
    _ownedStorageCount(profile, bucket, id) {
        if (bucket === 'blueprints') return (profile.blueprints && profile.blueprints[id]) || 0;
        return (profile.parts && profile.parts[bucket] && profile.parts[bucket][id]) || 0;
    },

    /** How many of a bucket/id are already filed into ANY ship's storage. */
    _allocatedStorageCount(profile, bucket, id) {
        const map = profile.shipStorage || {};
        let n = 0;
        Object.keys(map).forEach((shipId) => {
            const entry = map[shipId] && map[shipId][bucket];
            if (entry) n += entry[id] || 0;
        });
        return n;
    },

    /** How many of a bucket/id are currently equipped on the given ship (blueprints can't be equipped). */
    _equippedStorageCount(profile, shipId, bucket, id) {
        if (bucket === 'blueprints' || typeof shipLoadoutManager === 'undefined') return 0;
        const L = shipLoadoutManager.getLoadout(shipId);
        if (!L) return 0;
        if (bucket === 'weapons') return (L.weaponSlots || []).filter((wid) => wid === id).length;
        return (L[bucket] || []).indexOf(id) !== -1 ? 1 : 0;
    },

    /** How many of a bucket/id are equipped across every ship the player owns. */
    _equippedStorageCountAll(profile, bucket, id) {
        if (bucket === 'blueprints') return 0;
        const ships = profile.ownedShipIds || [];
        let n = 0;
        ships.forEach((shipId) => { n += this._equippedStorageCount(profile, shipId, bucket, id); });
        return n;
    },

    /** How many of a bucket/id are sitting unfiled at the station (owned, not filed to a ship, not equipped anywhere). */
    getStationStorageQty(profile, bucket, id) {
        return Math.max(0, this._ownedStorageCount(profile, bucket, id)
            - this._allocatedStorageCount(profile, bucket, id)
            - this._equippedStorageCountAll(profile, bucket, id));
    },

    /** How many of a bucket/id are filed into the given ship's storage, plus any equipped on that ship. */
    getShipStorageQty(profile, shipId, bucket, id) {
        const entry = (profile.shipStorage || {})[shipId];
        const filed = (entry && entry[bucket] && entry[bucket][id]) || 0;
        return filed + this._equippedStorageCount(profile, shipId, bucket, id);
    },

    moveToShipStorage(profile, shipId, bucket, id, qty) {
        qty = Math.max(1, Math.floor(qty) || 1);
        const atStation = this.getStationStorageQty(profile, bucket, id);
        const move = Math.min(qty, atStation);
        if (move <= 0) return { ok: false, reason: 'NONE AT STATION' };
        const entry = this.getShipStorageEntry(profile, shipId);
        entry[bucket][id] = (entry[bucket][id] || 0) + move;
        this.save();
        return { ok: true, moved: move };
    },

    /** Clear up to `count` instances of bucket/id out of the ship's equipped loadout
     *  (not its filed storage) so they free up as station storage. Returns how many it cleared. */
    _unequipFromLoadout(shipId, bucket, id, count) {
        if (typeof shipLoadoutManager === 'undefined') return 0;
        const kindOf = { weapons: 'weapon', defenses: 'defense', abilities: 'ability', energy: 'energy' };
        const kind = kindOf[bucket];
        if (!kind) return 0;
        let removed = 0;
        while (removed < count) {
            const L = shipLoadoutManager.getLoadout(shipId);
            if (!L) break;
            const list = bucket === 'weapons' ? (L.weaponSlots || []) : (L[bucket] || []);
            const idx = list.indexOf(id);
            if (idx === -1) break;
            const res = shipLoadoutManager.setSlotModule(shipId, kind, idx, null);
            if (!res || !res.ok) break;
            removed++;
        }
        return removed;
    },

    /** Key into profile.storageOrder for a storage grid: 'station' or 'ship:<shipId>'. */
    _storageOrderKey(scope, shipId) {
        return scope === 'ship' ? ('ship:' + shipId) : 'station';
    },

    /** The manually-arranged order for a storage grid's current item keys ("bucket:id").
     *  Items no longer present are dropped; new items are appended at the end. Never auto-sorts
     *  — the order persists as the player arranges it, across renders and sessions. */
    getStorageOrderList(profile, scope, shipId, currentKeys) {
        if (!profile.storageOrder || typeof profile.storageOrder !== 'object') profile.storageOrder = {};
        const ok = this._storageOrderKey(scope, shipId);
        let order = Array.isArray(profile.storageOrder[ok]) ? profile.storageOrder[ok].slice() : [];
        const curSet = new Set(currentKeys);
        order = order.filter((k) => curSet.has(k));
        currentKeys.forEach((k) => { if (order.indexOf(k) === -1) order.push(k); });
        profile.storageOrder[ok] = order;
        return order;
    },

    /** Move `key` to just before `beforeKey` within one storage grid's manual order
     *  (beforeKey falsy = move to the end). Pure reordering, no quantity change. */
    reorderStorage(profile, scope, shipId, key, beforeKey) {
        const ok = this._storageOrderKey(scope, shipId);
        if (!profile.storageOrder || typeof profile.storageOrder !== 'object') profile.storageOrder = {};
        const order = Array.isArray(profile.storageOrder[ok]) ? profile.storageOrder[ok].slice() : [];
        const idx = order.indexOf(key);
        if (idx !== -1) order.splice(idx, 1);
        let insertAt = beforeKey ? order.indexOf(beforeKey) : -1;
        if (insertAt === -1) insertAt = order.length;
        order.splice(insertAt, 0, key);
        profile.storageOrder[ok] = order;
        this.save();
    },

    moveToStationStorage(profile, shipId, bucket, id, qty) {
        qty = Math.max(1, Math.floor(qty) || 1);
        const entry = this.getShipStorageEntry(profile, shipId);
        const onShip = entry[bucket][id] || 0;
        // The ship storage grid also shows currently-equipped items (so you can drag gear
        // straight off the ship); those aren't "filed" yet, so fall back to unequipping them.
        const equipped = bucket !== 'blueprints' ? this._equippedStorageCount(profile, shipId, bucket, id) : 0;
        const move = Math.min(qty, onShip + equipped);
        if (move <= 0) return { ok: false, reason: 'NONE ON SHIP' };
        // Bay capacity is the station's storageSlots (from vault upgrades). A move that would
        // push occupied cells past the budget is refused — the item stays filed on the ship.
        const stats = this.getStationStats(profile);
        const cap = Math.max(8, Math.round((stats && stats.storageSlots) || 12));
        let used = 0;
        const spanOf = (b, itemId) => {
            // Match HomeStationUI._storageItemSpan sizing when the UI is available.
            if (typeof homeStationUI !== 'undefined' && homeStationUI._storageItemSpan) {
                const s = homeStationUI._storageItemSpan(b, itemId);
                return (s[0] || 1) * (s[1] || 1);
            }
            return 1;
        };
        this.SHIP_STORAGE_BUCKETS.forEach((b) => {
            // Count every distinct item currently sitting at the station.
            const owned = b === 'blueprints'
                ? Object.keys(profile.blueprints || {})
                : Object.keys((profile.parts && profile.parts[b]) || {});
            owned.forEach((itemId) => {
                if (this.getStationStorageQty(profile, b, itemId) > 0) used += spanOf(b, itemId);
            });
        });
        const add = spanOf(bucket, id) * move;
        if (used + add > cap) return { ok: false, reason: 'BAY FULL' };
        const fromFiled = Math.min(move, onShip);
        const fromEquipped = move - fromFiled;
        if (fromEquipped > 0) this._unequipFromLoadout(shipId, bucket, id, fromEquipped);
        entry[bucket][id] = onShip - fromFiled;
        if (entry[bucket][id] <= 0) delete entry[bucket][id];
        this.save();
        return { ok: true, moved: move };
    }
});
