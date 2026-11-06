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
        this._repairShipFiledCount(profile, shipId, bucket, id);
        const entry = (profile.shipStorage || {})[shipId];
        const filed = (entry && entry[bucket] && entry[bucket][id]) || 0;
        const eq = this._equippedStorageCount(profile, shipId, bucket, id);
        const owned = this._ownedStorageCount(profile, bucket, id);
        // Starter loadout parts often have owned=0: after unequip they live only as
        // filed. Never add filed+eq for those (legacy overlap looked like ×2), and
        // never let repair wipe them — that made right-click unequip delete the part.
        if (owned <= 0) return Math.max(filed, eq);
        return filed + eq;
    },

    /**
     * filed + equipped on this ship cannot exceed owned minus claims on other ships.
     * Older equip/unequip cycles forgot to consume filed on equip, so ×2/×3 badges
     * appeared for a single instance — clamp the ledger when read.
     * Skip owned<=0: those are starter-loadout parts kept visible via fileUnequippedPart.
     */
    _repairShipFiledCount(profile, shipId, bucket, id) {
        if (!profile || !shipId || !bucket || bucket === 'blueprints' || !id) return;
        const entry = (profile.shipStorage || {})[shipId];
        if (!entry || !entry[bucket]) return;
        let filed = entry[bucket][id] || 0;
        if (filed <= 0) return;
        const owned = this._ownedStorageCount(profile, bucket, id);
        if (owned <= 0) return;
        const eq = this._equippedStorageCount(profile, shipId, bucket, id);
        const otherFiled = this._allocatedStorageCount(profile, bucket, id) - filed;
        const otherEq = this._equippedStorageCountAll(profile, bucket, id) - eq;
        const maxFiled = Math.max(0, owned - otherFiled - otherEq - eq);
        if (filed <= maxFiled) return;
        if (maxFiled <= 0) delete entry[bucket][id];
        else entry[bucket][id] = maxFiled;
        try { this.save(); } catch (e) { /* ignore */ }
    },

    /** Unequipping a part must never make it vanish: the "filed on this ship" count is normally
     *  what keeps it visible (getShipStorageQty = filed + equipped), but a part equipped straight
     *  from a purchase/craft flow — or from station storage, never routed through
     *  moveToShipStorage — can reach a slot with filed=0. Clearing that slot alone then drops
     *  filed+equipped to 0 and the part disappears from every storage grid. Call this right
     *  after clearing a slot (moduleId '') to file the part the unequip just freed up, so it
     *  stays visible on this ship — deactivated, not gone. */
    fileUnequippedPart(profile, shipId, bucket, id) {
        if (!bucket || bucket === 'blueprints' || !id) return;
        const entry = this.getShipStorageEntry(profile, shipId);
        entry[bucket][id] = (entry[bucket][id] || 0) + 1;
        this.save();
    },

    /** Equipping a filed cargo instance into a slot: leave cargo (filed−1). No-op if filed is 0
     *  (part came from station / craft / purchase straight into the slot). */
    consumeFiledPart(profile, shipId, bucket, id) {
        if (!bucket || bucket === 'blueprints' || !id) return;
        const entry = this.getShipStorageEntry(profile, shipId);
        const n = entry[bucket][id] || 0;
        if (n <= 0) return;
        entry[bucket][id] = n - 1;
        if (entry[bucket][id] <= 0) delete entry[bucket][id];
        this.save();
    },

    moveToShipStorage(profile, shipId, bucket, id, qty) {
        qty = Math.max(1, Math.floor(qty) || 1);
        const defId = this.partDefId ? this.partDefId(id) : String(id || '');
        const atStation = this.getStationStorageQty(profile, bucket, defId);
        const move = Math.min(qty, atStation);
        if (move <= 0) return { ok: false, reason: 'NONE AT STATION' };
        const entry = this.getShipStorageEntry(profile, shipId);
        entry[bucket][defId] = (entry[bucket][defId] || 0) + move;
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

    /** Key into profile.storageOrder / profile.storagePos for a storage grid: 'station' or
     *  'ship:<shipId>'. The hangar bay-inventory grid (physical-item.js) is scope 'ship' too —
     *  it renders through HomeStationUI.renderShipStorage, the same SHIP STORAGE grid shown on
     *  the station tab, so it shares this exact position map rather than keeping its own. */
    _storageOrderKey(scope, shipId) {
        if (scope === 'ship') return 'ship:' + shipId;
        return 'station';
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

    /** The player's pinned (col, row) per item key ("bucket:id") for one storage grid.
     *  Unlike storageOrder (a replay list), this is an absolute CSS grid position: items the
     *  player hasn't dragged have no entry and simply auto-pack into the first free cell. */
    getStoragePosMap(profile, scope, shipId) {
        if (!profile.storagePos || typeof profile.storagePos !== 'object') profile.storagePos = {};
        const ok = this._storageOrderKey(scope, shipId);
        const map = profile.storagePos[ok];
        return (map && typeof map === 'object') ? map : {};
    },

    /** Pin `key` at (col, row) in one storage grid — the exact tile it was dropped on, not just
     *  a position in the replay order. */
    setStoragePos(profile, scope, shipId, key, col, row) {
        if (!profile.storagePos || typeof profile.storagePos !== 'object') profile.storagePos = {};
        const ok = this._storageOrderKey(scope, shipId);
        if (!profile.storagePos[ok] || typeof profile.storagePos[ok] !== 'object') profile.storagePos[ok] = {};
        profile.storagePos[ok][key] = [col, row];
    },

    /** Replace a storage grid's whole pinned-position map at once (every item currently shown
     *  pins to its current tile) — used right after a drop so the other items don't silently
     *  reflow around the one that just moved. */
    freezeStoragePositions(profile, scope, shipId, posByKey) {
        if (!profile.storagePos || typeof profile.storagePos !== 'object') profile.storagePos = {};
        const ok = this._storageOrderKey(scope, shipId);
        profile.storagePos[ok] = Object.assign({}, posByKey);
        this.save();
    },

    moveToStationStorage(profile, shipId, bucket, id, qty) {
        qty = Math.max(1, Math.floor(qty) || 1);
        const defId = this.partDefId ? this.partDefId(id) : String(id || '');
        const entry = this.getShipStorageEntry(profile, shipId);
        const onShip = entry[bucket][defId] || 0;
        // The ship storage grid also shows currently-equipped items (so you can drag gear
        // straight off the ship); those aren't "filed" yet, so fall back to unequipping them.
        const equipped = bucket !== 'blueprints' ? this._equippedStorageCount(profile, shipId, bucket, defId) : 0;
        const move = Math.min(qty, onShip + equipped);
        if (move <= 0) return { ok: false, reason: 'NONE ON SHIP' };
        // Starter-loadout parts with owned<=0 have no real backing count in profile.parts:
        // getStationStorageQty always clamps to 0 for owned<=0 (it's owned minus filed minus
        // equipped, and owned<=0 makes that expression <=0 no matter what), so station storage
        // can never display them. Moving one there would unequip/unfile it on the ship with
        // nowhere for it to land — filed+equipped both drop to 0 and it vanishes from every
        // storage grid (see the fileUnequippedPart doc above for the same failure mode).
        // Refuse instead of deleting it.
        if (bucket !== 'blueprints' && this._ownedStorageCount(profile, bucket, defId) <= 0) {
            return { ok: false, reason: 'CANNOT STORE AT STATION' };
        }
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
            // Count every station-filed copy (parts no longer stack into one cell).
            const owned = b === 'blueprints'
                ? Object.keys(profile.blueprints || {})
                : Object.keys((profile.parts && profile.parts[b]) || {});
            owned.forEach((itemId) => {
                const q = this.getStationStorageQty(profile, b, itemId);
                if (q <= 0) return;
                const span = spanOf(b, itemId);
                used += b === 'blueprints' ? span : span * q;
            });
        });
        const add = spanOf(bucket, defId) * move;
        if (used + add > cap) return { ok: false, reason: 'BAY FULL' };
        const fromFiled = Math.min(move, onShip);
        const fromEquipped = move - fromFiled;
        if (fromEquipped > 0) this._unequipFromLoadout(shipId, bucket, defId, fromEquipped);
        entry[bucket][defId] = onShip - fromFiled;
        if (entry[bucket][defId] <= 0) delete entry[bucket][defId];
        this.save();
        return { ok: true, moved: move };
    }
});
