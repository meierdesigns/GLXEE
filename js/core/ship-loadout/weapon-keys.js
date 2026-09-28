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
        return L;
    };

    /** Key that fires every weapon at once (the ALL tile): default SPACE. */
    proto.getAllFireKey = function (L) {
        return (L && L.allFireKey) || 'space';
    };

    proto.cycleAllFireKey = function (shipId) {
        const L = this.getLoadout(shipId);
        const cur = this.getAllFireKey(L);
        L.allFireKey = KEYS[(KEYS.indexOf(cur) + 1) % KEYS.length];
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
        const cur = this.getWeaponFireKey(this.getLoadout(shipId), index);
        const next = KEYS[(KEYS.indexOf(cur) + 1) % KEYS.length];
        return this.setWeaponFireKey(shipId, index, next);
    };
})();
