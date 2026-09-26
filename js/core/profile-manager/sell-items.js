"use strict";

// ProfileManager methods: selling ships, unlearned blueprints, parts and
// unlocked styles back to the shop for credits.
const SELL_RATE = 0.5;

extendClass(ProfileManager, {
    /** Credits paid out for an item that was bought for `cost`. */
    getSellValue(cost) {
        if (!cost) return 0;
        const credits = Number(cost.credits) || 0;
        const full = credits > 0
            ? credits
            : ((typeof economyConfig !== 'undefined' && economyConfig.materialCostToCredits)
                ? economyConfig.materialCostToCredits(cost)
                : 0);
        return Math.max(1, Math.floor(full * SELL_RATE));
    },

    /** Why a ship cannot be sold ('' when it can). */
    getShipSellBlock(shipId, profile) {
        const p = profile || this.getActiveProfile();
        if (!p) return 'NO PROFILE';
        const id = String(shipId || '');
        if (p.ownedShipIds.indexOf(id) === -1) return 'NOT OWNED';
        if (id === this.getStarterShipId()) return 'STARTER SHIP';
        if (this.getActiveShipId && this.getActiveShipId() === id) return 'ACTIVE SHIP';
        return '';
    },

    getShipSellValue(shipId) {
        if (typeof economyConfig === 'undefined' || typeof shipConfigManager === 'undefined') return 0;
        return this.getSellValue(economyConfig.getShopCost(shipConfigManager.getConfig(shipId)));
    },

    sellShip(shipId) {
        const profile = this.getActiveProfile();
        const block = this.getShipSellBlock(shipId, profile);
        if (block) return { ok: false, reason: block };
        const credits = this.getShipSellValue(shipId);
        profile.ownedShipIds = profile.ownedShipIds.filter((id) => id !== shipId);
        this.addCredits(credits, true);
        this.save();
        return { ok: true, credits: credits };
    },

    getBlueprintSellValue(shipId) {
        if (typeof economyConfig === 'undefined' || typeof shipConfigManager === 'undefined') return 0;
        return this.getSellValue(economyConfig.getBlueprintCost(shipConfigManager.getConfig(shipId)));
    },

    /** Sells one station blueprint that has not been crafted into a ship. */
    sellBlueprint(shipId) {
        const profile = this.getActiveProfile();
        if (!profile) return { ok: false, reason: 'NO PROFILE' };
        this.ensureEconomyDefaults(profile);
        const id = String(shipId || '');
        if (!((profile.blueprints[id] || 0) > 0)) return { ok: false, reason: 'NONE LEFT' };
        const credits = this.getBlueprintSellValue(id);
        profile.blueprints[id] -= 1;
        if (profile.blueprints[id] <= 0) delete profile.blueprints[id];
        this.addCredits(credits, true);
        this.save();
        return { ok: true, credits: credits };
    },

    getPartItem(kind, partId) {
        if (kind === 'weapon') {
            return typeof weaponConfigManager !== 'undefined' ? weaponConfigManager.getWeapon(partId) : null;
        }
        return typeof abilityConfigManager !== 'undefined' ? abilityConfigManager.getAbility(partId) : null;
    },

    getPartSellValue(kind, partId) {
        if (typeof economyConfig === 'undefined') return 0;
        const item = this.getPartItem(kind, partId);
        return item ? this.getSellValue(economyConfig.getPartCost(kind, item)) : 0;
    },

    /** Sells one stored part. Equipping depends on discovery, not the count. */
    sellPart(kind, partId) {
        const profile = this.getActiveProfile();
        if (!profile) return { ok: false, reason: 'NO PROFILE' };
        this.ensureEconomyDefaults(profile);
        const bag = kind === 'weapon' ? profile.parts.weapons
            : (kind === 'defense' ? profile.parts.defenses
                : (kind === 'energy' ? profile.parts.energy : profile.parts.abilities));
        const id = String(partId || '');
        if (!bag || !((bag[id] || 0) > 0)) return { ok: false, reason: 'NONE LEFT' };
        const credits = this.getPartSellValue(kind, id);
        bag[id] -= 1;
        if (bag[id] <= 0) delete bag[id];
        this.addCredits(credits, true);
        this.save();
        return { ok: true, credits: credits };
    },

    /** Bought (not starter) styles of a group the profile owns. */
    getSellableStyles(groupId, profile) {
        const p = profile || this.getActiveProfile();
        const owned = (p && p.unlockedStyles && p.unlockedStyles[groupId]) || [];
        return this.getStyleGroupEntries(groupId)
            .map((style, index) => ({ style: style, index: index }))
            .filter((e) => owned.indexOf(e.style.id) !== -1 && this.getStyleCost(e.index));
    },

    sellStyle(groupId, styleId) {
        const profile = this.getActiveProfile();
        if (!profile) return { ok: false, reason: 'NO PROFILE' };
        const entry = this.getSellableStyles(groupId, profile).find((e) => e.style.id === String(styleId));
        if (!entry) return { ok: false, reason: 'NOT OWNED' };
        const credits = this.getSellValue(this.getStyleCost(entry.index));
        profile.unlockedStyles[groupId] = profile.unlockedStyles[groupId].filter((id) => id !== String(styleId));
        this.addCredits(credits, true);
        this.save();
        return { ok: true, credits: credits };
    },
});
