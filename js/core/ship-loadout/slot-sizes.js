"use strict";

// Slot sizes per slot (replaces "area level = size of every slot").
//
//   size = base + upgrades, capped at L
//   base: almost everything starts S. Only a single centre-line weapon
//         mount (nose gun) starts at M — wing pairs, defense, ability and
//         energy stay S until upgraded in the hangar slot menu (S → M → L).
//
// Area upgrades still open new slots (see ship-areas.js); they no longer
// change slot size. Stored as
//   profile.shipUpgrades[shipId].slotLevels = { 'weapon:1': 1, ... }
(function slotSizes() {
    const MAX = 2;
    const key = (kind, index) => String(kind) + ':' + Math.max(0, Math.round(Number(index) || 0));

    const slm = ShipLoadoutManager.prototype;

    /** True when this slot is a mirrored pair (two half-size sockets). */
    slm.isSplitSlot = function (shipId, kind, index) {
        if (kind !== 'weapon') return false;
        const i = Math.max(0, Math.round(Number(index) || 0));
        const L = this.getLoadout(shipId);
        const m = this.getStoredWeaponMount ? this.getStoredWeaponMount(L, i) : null;
        if (m) {
            const area = String(m.area || m.kind || '').toLowerCase();
            return area === 'wing'
                || !!m.split
                || m.mx != null
                || m.my != null
                || m.mirrorNx != null
                || m.mirrorNy != null;
        }
        // Classic layout: slot 0 is the single nose gun, the rest are wing pairs.
        return i > 0;
    };

    slm.getSlotBaseSizeLevel = function (shipId, kind, index) {
        // Fresh hull: only the single nose/core weapon is M. Everything else
        // (wings, defense, ability, energy) is S so new profiles aren't all-M.
        if (kind === 'weapon' && !this.isSplitSlot(shipId, kind, index)) return 1;
        return 0;
    };

    /**
     * Size factor per weapon slot for the layout. Single guns: S 0.5, M 0.7, L 1 (the full gun).
     * Split (wing) guns: each step above S makes the weapon 25% bigger — and its
     * shots (see shootWithShipWeapon). { slotIndex: factor }, 1 omitted.
     */
    slm.getWeaponSlotScales = function (shipId) {
        const out = {};
        if (!this.getSlotSizeLevel) return out;
        const L = this.getLoadout(shipId);
        const slots = (L.weaponSlots && L.weaponSlots.length ? L.weaponSlots : L.weapons) || [];
        slots.forEach((id, i) => {
            if (!id) return;
            const level = this.getSlotSizeLevel(shipId, 'weapon', i);
            if (!this.isSplitSlot(shipId, 'weapon', i)) {
                // Single (centre-line) guns: L is the full gun size, M a clearly smaller one, S smaller still.
                const f = [0.5, 0.7, 1][Math.max(0, Math.min(2, level))];
                if (f !== 1) out[i] = f;
                return;
            }
            const step = level - this.getSlotBaseSizeLevel(shipId, 'weapon', i);
            if (step > 0) out[i] = 1 + 0.25 * step;
        });
        return out;
    };

    /** Loadout copy carrying the weapon slot size factors for buildLayout. */
    slm.withWeaponSlotScales = function (shipId, loadout) {
        return Object.assign({}, loadout, { weaponSlotScales: this.getWeaponSlotScales(shipId) });
    };

    slm.getSlotUpgradeLevel = function (shipId, kind, index) {
        if (typeof profileManager === 'undefined' || !profileManager.getSlotUpgradeLevels) return 0;
        const levels = profileManager.getSlotUpgradeLevels(shipId);
        const direct = levels[key(kind, index)];
        if (direct != null) return Number(direct) || 0;
        // Accept the legacy plural weapon key used by older saved profiles.
        if (kind === 'weapon' && levels[key('weapons', index)] != null) {
            return Number(levels[key('weapons', index)]) || 0;
        }
        return 0;
    };

    /**
     * Size level (0 S, 1 M, 2 L) of a slot. Without an index, the largest
     * slot of that kind counts — "does this part fit anywhere".
     * Upgrade UI uses this raw value (split wings start S and grow S→M→L).
     */
    slm.getSlotSizeLevel = function (shipId, kind, index) {
        if (index == null) {
            const caps = this.getSlotCaps(shipId, this.resolveModelClass(shipId));
            const n = kind === 'weapon'
                ? (this.weaponMountSlots ? this.weaponMountSlots(caps.weapons) : caps.weapons)
                : caps[this.kindToLoadoutKey(kind)];
            let best = 0;
            for (let i = 0; i < Math.max(1, Number(n) || 1); i++) {
                best = Math.max(best, this.getSlotSizeLevel(shipId, kind, i));
            }
            return best;
        }
        return Math.min(MAX, this.getSlotBaseSizeLevel(shipId, kind, index)
            + this.getSlotUpgradeLevel(shipId, kind, index));
    };

    /**
     * Size that governs fit + inventory footprint. A split weapon mount is a
     * pair of half-sockets whose complete mount is at least M — so M guns
     * fit wing/split slots even while the upgrade ladder still starts at S.
     */
    slm.getSlotEffectiveSizeLevel = function (shipId, kind, index) {
        if (index == null) {
            const caps = this.getSlotCaps(shipId, this.resolveModelClass(shipId));
            const n = kind === 'weapon'
                ? (this.weaponMountSlots ? this.weaponMountSlots(caps.weapons) : caps.weapons)
                : caps[this.kindToLoadoutKey(kind)];
            let best = 0;
            for (let i = 0; i < Math.max(1, Number(n) || 1); i++) {
                best = Math.max(best, this.getSlotEffectiveSizeLevel(shipId, kind, i));
            }
            return best;
        }
        let have = this.getSlotSizeLevel(shipId, kind, index);
        if (kind === 'weapon' && this.isSplitSlot && this.isSplitSlot(shipId, kind, index)) {
            have = Math.max(have, 1);
        }
        return have;
    };

    slm.getMaxSlotSizeLevel = function () {
        return MAX;
    };

    const pm = ProfileManager.prototype;

    pm.getSlotUpgradeLevels = function (shipId, profile) {
        const p = profile || this.getActiveProfile();
        const entry = p && p.shipUpgrades && p.shipUpgrades[String(shipId || '')];
        return (entry && entry.slotLevels) || {};
    };

    /** Cost to grow a slot to `nextSize` (1 M, 2 L); split pairs cost 1.5×. */
    pm.getSlotUpgradeCost = function (nextSize, split) {
        const mul = split ? 1.5 : 1;
        const cost = nextSize >= 2
            ? { scrap: 140, ore: 50, crystal: 25 }
            : { scrap: 60, ore: 20 };
        Object.keys(cost).forEach((k) => { cost[k] = Math.round(cost[k] * mul); });
        return cost;
    };

    pm.canPurchaseSlotUpgrade = function (shipId, kind, index, profile) {
        const p = profile || this.getActiveProfile();
        if (!p || typeof economyConfig === 'undefined' || typeof shipLoadoutManager === 'undefined') {
            return { ok: false, reason: 'NO PROFILE' };
        }
        this.ensureEconomyDefaults(p);
        const id = String(shipId || '');
        if (!this.ownsShip(id, p)) return { ok: false, reason: 'NOT OWNED' };
        const size = shipLoadoutManager.getSlotSizeLevel(id, kind, index);
        if (size >= MAX) return { ok: false, reason: 'MAX SIZE', size: size };
        const cost = this.getSlotUpgradeCost(size + 1, shipLoadoutManager.isSplitSlot(id, kind, index));
        if (!economyConfig.canAfford(p.resources, cost)) {
            return { ok: false, reason: 'RESOURCES', cost: cost, size: size, nextSize: size + 1 };
        }
        return { ok: true, cost: cost, size: size, nextSize: size + 1 };
    };

    pm.purchaseSlotUpgrade = function (shipId, kind, index) {
        const p = this.getActiveProfile();
        const id = String(shipId || '');
        const check = this.canPurchaseSlotUpgrade(id, kind, index, p);
        if (!check.ok) return check;
        if (!this.spendResources(check.cost)) return { ok: false, reason: 'RESOURCES' };
        if (!p.shipUpgrades[id]) p.shipUpgrades[id] = { frameLevel: 0 };
        const entry = p.shipUpgrades[id];
        if (!entry.slotLevels) entry.slotLevels = {};
        const k = key(kind, index);
        entry.slotLevels[k] = (Number(entry.slotLevels[k]) || 0) + 1;
        this.save();
        return { ok: true, size: check.nextSize };
    };
})();
