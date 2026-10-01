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

    const baseNormalize = proto.normalizeLoadout;
    proto.normalizeLoadout = function (src) {
        const L = baseNormalize.call(this, src);
        L.weaponKeys = this.normalizeWeaponKeys(src && src.weaponKeys);
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

    proto.setWeaponFireKey = function (shipId, index, key) {
        const L = this.getLoadout(shipId);
        const k = String(key || 'space').toLowerCase();
        const slot = String(Math.max(0, Math.round(Number(index) || 0)));
        L.weaponKeys = this.normalizeWeaponKeys(L.weaponKeys);
        if (k === 'a' || k === 's' || k === 'd') L.weaponKeys[slot] = k;
        else delete L.weaponKeys[slot];
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
