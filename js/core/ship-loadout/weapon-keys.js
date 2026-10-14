"use strict";

// ShipLoadoutManager: which key fires each weapon slot.
//
//   weaponKeys[slot] = 'a' | 's' | 'd'
//
// No entry = SPACE only. Space always fires every weapon; A / S / D fire just
// the slots assigned to them, so single guns can be triggered on their own.
(function weaponKeys() {
    const proto = ShipLoadoutManager.prototype;
    const KEYS = ['space', 'a', 's', 'd'];

    proto.WEAPON_FIRE_KEYS = KEYS;

    proto.normalizeWeaponKeys = function (raw) {
        const out = {};
        if (!raw || typeof raw !== 'object') return out;
        Object.keys(raw).forEach((k) => {
            const v = String(raw[k] || '').toLowerCase();
            if (v === 'a' || v === 's' || v === 'd') {
                out[String(Math.max(0, Math.round(Number(k) || 0)))] = v;
            }
        });
        return out;
    };

    // weaponKeySets[slot] = ['space', 'a', ...]: every key that fires this slot (any combination). No entry =
    // the legacy single key from weaponKeys (A / S / D), else SPACE only.
    proto.normalizeWeaponKeySets = function (raw) {
        const out = {};
        if (!raw || typeof raw !== 'object') return out;
        Object.keys(raw).forEach((k) => {
            if (!Array.isArray(raw[k])) return;
            const set = KEYS.filter((key) => raw[k].map((v) => String(v).toLowerCase()).indexOf(key) !== -1);
            out[String(Math.max(0, Math.round(Number(k) || 0)))] = set;
        });
        return out;
    };

    const baseNormalize = proto.normalizeLoadout;
    proto.normalizeLoadout = function (src) {
        const L = baseNormalize.call(this, src);
        L.weaponKeys = this.normalizeWeaponKeys(src && src.weaponKeys);
        L.weaponKeySets = this.normalizeWeaponKeySets(src && src.weaponKeySets);
        const all = String((src && src.allFireKey) || 'space').toLowerCase();
        L.allFireKey = KEYS.indexOf(all) !== -1 ? all : 'space';
        // Heal saved loadouts where a slot shares the ALL key.
        Object.keys(L.weaponKeys).forEach((slot) => {
            if (L.weaponKeys[slot] === L.allFireKey) delete L.weaponKeys[slot];
        });
        return L;
    };

    /** Key that fires every weapon at once (the ALL tile): default SPACE. */
    proto.getAllFireKey = function (L) {
        return (L && L.allFireKey) || 'space';
    };

    proto.cycleAllFireKey = function (shipId) {
        const L = this.getLoadout(shipId);
        const cur = this.getAllFireKey(L);
        const next = KEYS[(KEYS.indexOf(cur) + 1) % KEYS.length];
        L.allFireKey = next;
        // Keys stay unique: a slot holding the new ALL key takes the old one.
        L.weaponKeys = this.normalizeWeaponKeys(L.weaponKeys);
        Object.keys(L.weaponKeys).forEach((slot) => {
            if (L.weaponKeys[slot] !== next) return;
            if (cur === 'space') delete L.weaponKeys[slot];
            else L.weaponKeys[slot] = cur;
        });
        this.setLoadout(shipId, L);
        return L.allFireKey;
    };

    /** Fire key of a weapon slot: 'space' | 'a' | 's' | 'd'. */
    proto.getWeaponFireKey = function (L, index) {
        const m = L && L.weaponKeys && L.weaponKeys[String(Math.max(0, Math.round(Number(index) || 0)))];
        return m || 'space';
    };

    /** Every key that fires a weapon slot. */
    proto.getWeaponKeySet = function (L, index) {
        const slot = String(Math.max(0, Math.round(Number(index) || 0)));
        const set = L && L.weaponKeySets && L.weaponKeySets[slot];
        if (Array.isArray(set)) return set.slice();
        const legacy = L && L.weaponKeys && L.weaponKeys[slot];
        return [legacy || 'space'];
    };

    proto.setWeaponKeySet = function (shipId, index, keys) {
        const L = this.getLoadout(shipId);
        const slot = String(Math.max(0, Math.round(Number(index) || 0)));
        L.weaponKeySets = this.normalizeWeaponKeySets(L.weaponKeySets);
        L.weaponKeySets[slot] = KEYS.filter((k) => (keys || []).indexOf(k) !== -1);
        // Keep the single-key field in step (slot badge, older readers): the first A / S / D key, else none.
        L.weaponKeys = this.normalizeWeaponKeys(L.weaponKeys);
        const solo = L.weaponKeySets[slot].find((k) => k !== 'space');
        if (solo) L.weaponKeys[slot] = solo; else delete L.weaponKeys[slot];
        this.setLoadout(shipId, L);
        return L.weaponKeySets[slot].slice();
    };

    proto.toggleWeaponKey = function (shipId, index, key) {
        const set = this.getWeaponKeySet(this.getLoadout(shipId), index);
        const k = String(key || '').toLowerCase();
        const at = set.indexOf(k);
        if (at === -1) set.push(k); else set.splice(at, 1);
        return this.setWeaponKeySet(shipId, index, set);
    };

    proto.setWeaponFireKey = function (shipId, index, key) {
        const L = this.getLoadout(shipId);
        const k = String(key || 'space').toLowerCase();
        const slot = String(Math.max(0, Math.round(Number(index) || 0)));
        L.weaponKeys = this.normalizeWeaponKeys(L.weaponKeys);
        if (k === 'a' || k === 's' || k === 'd') L.weaponKeys[slot] = k;
        else delete L.weaponKeys[slot];
        L.weaponKeySets = this.normalizeWeaponKeySets(L.weaponKeySets);
        L.weaponKeySets[slot] = [k === 'a' || k === 's' || k === 'd' ? k : 'space'];
        this.setLoadout(shipId, L);
        return this.getWeaponFireKey(L, index);
    };

    /** SPACE → A → S → D → SPACE. */
    proto.cycleWeaponFireKey = function (shipId, index) {
        const L = this.getLoadout(shipId);
        const cur = this.getWeaponFireKey(L, index);
        const allKey = this.getAllFireKey(L);
        let next = KEYS[(KEYS.indexOf(cur) + 1) % KEYS.length];
        // Skip the ALL key — that key already fires every weapon.
        if (next === allKey && next !== 'space') next = KEYS[(KEYS.indexOf(next) + 1) % KEYS.length];
        return this.setWeaponFireKey(shipId, index, next);
    };
})();
