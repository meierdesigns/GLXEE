"use strict";

// ProfileManager methods: cosmetic style unlocks (hull areas, module skins,
// connections). The first STYLE_FREE_COUNT styles of every group are free;
// the rest are bought in the shop's STYLES category.
const STYLE_FREE_COUNT = 3;

extendClass(ProfileManager, {
    /** Style groups in shop order: { id, label, icon }. */
    getStyleGroups() {
        return [
            { id: 'hull:front', label: 'NOSE', icon: 'hsShip' },
            { id: 'hull:center', label: 'CORE', icon: 'hsShip' },
            { id: 'hull:back', label: 'AFT', icon: 'hsShip' },
            { id: 'hull:wing', label: 'WINGS', icon: 'hsShip' },
            { id: 'skin:weapon', label: 'WEAPON', icon: 'statWeapon' },
            { id: 'skin:defense', label: 'DEFENSE', icon: 'statArmor' },
            { id: 'skin:ability', label: 'ABILITY', icon: 'statAbilities' },
            { id: 'skin:energy', label: 'ENERGY', icon: 'ability_energy_shield' },
            { id: 'joint', label: 'CONNECTION', icon: 'hsCraft' }
        ];
    },

    /** Hull segment ids (wingLeft / wingRight / wing) → style group id. */
    hullStyleGroup(segmentId) {
        const seg = String(segmentId || '');
        return 'hull:' + (seg.indexOf('wing') === 0 ? 'wing' : seg);
    },

    /** Ordered styles of a group: [{ id, label }]. Hull ids are indices. */
    getStyleGroupEntries(groupId) {
        const group = String(groupId || '');
        if (group.indexOf('hull:') === 0) {
            const loader = (typeof graphicsManager !== 'undefined') ? graphicsManager.shipAssetLoader : null;
            if (!loader) return [];
            const seg = group.slice(5);
            const labels = seg === 'wing'
                ? loader.wingShapeVariants.map((v) => v.label)
                : loader.bodyShapeVariantLabels(seg);
            return labels.map((label, index) => ({ id: String(index), label: label }));
        }
        if (group.indexOf('skin:') === 0) {
            if (typeof shipLoadoutManager === 'undefined') return [];
            return shipLoadoutManager.getAvailableSkins(group.slice(5));
        }
        if (group === 'joint') {
            return ['strut', 'plate', 'double', 'hinge'].map((id) => ({ id: id, label: id.toUpperCase() }));
        }
        return [];
    },

    /** Credits price of the style at `index` in its group (0 when free). */
    getStyleCost(index) {
        const tier = index - STYLE_FREE_COUNT + 1;
        if (tier <= 0) return null;
        return { credits: 100 + (tier - 1) * 75 };
    },

    isStyleUnlocked(groupId, styleId, profile) {
        const entries = this.getStyleGroupEntries(groupId);
        const index = entries.findIndex((e) => e.id === String(styleId));
        if (index === -1) return false;
        if (index < STYLE_FREE_COUNT) return true;
        const p = profile || this.getActiveProfile();
        const owned = p && p.unlockedStyles && p.unlockedStyles[groupId];
        return Array.isArray(owned) && owned.indexOf(String(styleId)) !== -1;
    },

    canPurchaseStyle(groupId, styleId, profile) {
        const p = profile || this.getActiveProfile();
        if (!p || typeof economyConfig === 'undefined') return { ok: false, reason: 'NO PROFILE' };
        const entries = this.getStyleGroupEntries(groupId);
        const index = entries.findIndex((e) => e.id === String(styleId));
        if (index === -1) return { ok: false, reason: 'INVALID' };
        if (this.isStyleUnlocked(groupId, styleId, p)) return { ok: false, reason: 'OWNED' };
        const cost = this.getStyleCost(index);
        // Style prices are credits, which live on the profile, not in resources.
        if ((Number(p.credits) || 0) < cost.credits) {
            return { ok: false, reason: 'RESOURCES', cost: cost };
        }
        return { ok: true, cost: cost };
    },

    purchaseStyle(groupId, styleId) {
        const profile = this.getActiveProfile();
        const check = this.canPurchaseStyle(groupId, styleId, profile);
        if (!check.ok) return check;
        if (!this.spendCredits(check.cost.credits)) return { ok: false, reason: 'RESOURCES', cost: check.cost };
        if (!profile.unlockedStyles || typeof profile.unlockedStyles !== 'object') profile.unlockedStyles = {};
        if (!Array.isArray(profile.unlockedStyles[groupId])) profile.unlockedStyles[groupId] = [];
        profile.unlockedStyles[groupId].push(String(styleId));
        this.save();
        return { ok: true };
    },
});
