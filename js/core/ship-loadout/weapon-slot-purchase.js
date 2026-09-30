"use strict";

// Buyable weapon slots.
//
// Profiles created with this system (profile.weaponSlotModel === 'purchase')
// start every ship with its class's weapon mounts (interceptor 1, starfighter
// and assault 3, heavy 5 — see ShipLoadoutManager.baseWeaponMounts).
// Further slots are bought per ship; their size (S → M → L) is upgraded with
// the existing slot size upgrades (slot-sizes.js).
//
//   profile.shipUpgrades[shipId].weaponSlotsBought = n   (extra slots)
//
// Older profiles keep the previous caps, so no equipped weapon is lost.
(function weaponSlotPurchase() {
    const MAX_EXTRA = 4;

    const slm = ShipLoadoutManager.prototype;
    const pm = ProfileManager.prototype;

    /** True when this profile uses bought weapon slots (all new profiles). */
    pm.usesWeaponSlotPurchase = function (profile) {
        const p = profile || this.getActiveProfile();
        return !!(p && p.weaponSlotModel === 'purchase');
    };

    pm.getWeaponSlotsBought = function (shipId, profile) {
        const p = profile || this.getActiveProfile();
        const entry = p && p.shipUpgrades && p.shipUpgrades[String(shipId || '')];
        return Math.max(0, Math.round(Number(entry && entry.weaponSlotsBought) || 0));
    };

    pm.getMaxWeaponSlotsBought = function () {
        return MAX_EXTRA;
    };

    /** Cost of the next extra weapon slot (rises with each one bought). */
    pm.getWeaponSlotCost = function (bought) {
        const n = Math.max(0, Number(bought) || 0) + 1;
        const cost = { scrap: 120 * n, ore: 40 * n };
        if (n >= 3) cost.crystal = 15 * (n - 2);
        return cost;
    };

    pm.canPurchaseWeaponSlot = function (shipId, profile) {
        const p = profile || this.getActiveProfile();
        if (!p || typeof economyConfig === 'undefined') return { ok: false, reason: 'NO PROFILE' };
        if (!this.usesWeaponSlotPurchase(p)) return { ok: false, reason: 'N/A' };
        this.ensureEconomyDefaults(p);
        const id = String(shipId || '');
        if (!this.ownsShip(id, p)) return { ok: false, reason: 'NOT OWNED' };
        const bought = this.getWeaponSlotsBought(id, p);
        if (bought >= MAX_EXTRA) return { ok: false, reason: 'MAX SLOTS', bought: bought };
        const cost = this.getWeaponSlotCost(bought);
        if (!economyConfig.canAfford(p.resources, cost)) {
            return { ok: false, reason: 'RESOURCES', cost: cost, bought: bought };
        }
        return { ok: true, cost: cost, bought: bought };
    };

    pm.purchaseWeaponSlot = function (shipId) {
        const p = this.getActiveProfile();
        const id = String(shipId || '');
        const check = this.canPurchaseWeaponSlot(id, p);
        if (!check.ok) return check;
        if (!this.spendResources(check.cost)) return { ok: false, reason: 'RESOURCES' };
        if (!p.shipUpgrades[id]) p.shipUpgrades[id] = { frameLevel: 0 };
        p.shipUpgrades[id].weaponSlotsBought = check.bought + 1;
        this.save();
        return { ok: true, bought: check.bought + 1 };
    };

    // New profiles start on the purchase model.
    const baseCreate = pm.create;
    pm.create = function (name, factionId) {
        const profile = baseCreate.call(this, name, factionId);
        if (profile) {
            profile.weaponSlotModel = 'purchase';
            this.save();
        }
        return profile;
    };

    // Caps: class mounts + bought slots (+ area upgrade bonus). caps.weapons counts
    // physical guns (nose + every wing side): 1 + 2 per extra slot, which
    // weaponMountSlots() turns back into 1 + bought mount slots.
    const baseCaps = slm.getSlotCaps;
    slm.getSlotCaps = function (shipId, modelClass) {
        const caps = baseCaps.call(this, shipId, modelClass);
        if (typeof profileManager === 'undefined' || !profileManager.usesWeaponSlotPurchase
            || !profileManager.usesWeaponSlotPurchase()) {
            return caps;
        }
        const base = this.getBaseSlotCaps(modelClass || this.resolveModelClass(shipId));
        const baseMounts = this.baseWeaponMounts(base);
        const areaBonus = Math.max(0, (Number(caps.weapons) || 0) - baseMounts);
        const bought = profileManager.getWeaponSlotsBought(shipId);
        // Class mounts (interceptor 1, starfighter/assault 3, heavy 5) + 2 per bought slot.
        caps.weapons = baseMounts + 2 * bought + areaBonus;
        return caps;
    };
})();
