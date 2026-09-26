"use strict";

// ShipLoadoutManager methods: per-faction default ship anatomy.
// Fields copied from/onto a loadout; the same set RESET ANATOMY touches.
const FACTION_LAYOUT_KEYS = [
    'wingOffsetX', 'wingOffsetY', 'wingConnectionY', 'wingConnectionWidth',
    'wingConnectionWidthEnd', 'wingRotation', 'voxelScale', 'wingConnectionVoxelScale',
    'wingConnectionStyle', 'spineConnectionStyle', 'spineConnectionWidth',
    'spineConnectionWidthEnd', 'spineConnectionX', 'wingJointSides', 'spineJoints',
    'hideWingConnection', 'hideSpineFront', 'hideSpineBack', 'disabledAreas',
    'segmentScale', 'segmentOffset', 'moduleOffset', 'moduleOffsets',
    'slotAnchors', 'singleWeaponSide'
];

const FACTION_LAYOUT_STORAGE_KEY = 'vf_faction_layout_defaults_v1';

// Captured in the hangar via shipLoadoutManager.exportHangarLayout().
const FACTION_LAYOUT_DEFAULTS = {
    voidborn: null
};

extendClass(ShipLoadoutManager, {
    getFactionLayoutDefaults(factionId) {
        // A layout saved in the hangar (SET AS DEFAULT) wins over the stock one.
        let saved = null;
        try {
            const all = JSON.parse(localStorage.getItem(FACTION_LAYOUT_STORAGE_KEY) || '{}');
            saved = all && all[factionId];
        } catch (e) { /* ignore */ }
        const d = saved || FACTION_LAYOUT_DEFAULTS[factionId];
        return d ? JSON.parse(JSON.stringify(d)) : null;
    },

    /** Overlay the faction's default anatomy onto a loadout (in place). */
    applyFactionLayoutDefaults(loadout, factionId) {
        const faction = factionId || (typeof factionShipStyles !== 'undefined' && factionShipStyles.resolveActiveFaction
            ? factionShipStyles.resolveActiveFaction() : null);
        const d = this.getFactionLayoutDefaults(faction);
        if (!d || !loadout) return loadout;
        FACTION_LAYOUT_KEYS.forEach((k) => {
            if (d[k] !== undefined) loadout[k] = d[k];
        });
        return loadout;
    },

    /** Save the ship's current anatomy as its faction's default (used by RESET ANATOMY). */
    saveFactionLayoutDefault(shipId, factionId) {
        const faction = factionId || (typeof factionShipStyles !== 'undefined' && factionShipStyles.resolveActiveFaction
            ? factionShipStyles.resolveActiveFaction() : null) || 'terran';
        const snap = this.snapshotHangarLayout(shipId);
        try {
            const all = JSON.parse(localStorage.getItem(FACTION_LAYOUT_STORAGE_KEY) || '{}') || {};
            all[faction] = snap;
            localStorage.setItem(FACTION_LAYOUT_STORAGE_KEY, JSON.stringify(all));
        } catch (e) {
            return null;
        }
        return snap;
    },

    /** Dev helper: current ship anatomy as JSON (also copied to clipboard). */
    exportHangarLayout(shipId) {
        const json = JSON.stringify(this.snapshotHangarLayout(shipId));
        try { navigator.clipboard.writeText(json); } catch (e) { /* ignore */ }
        console.log(json);
        return json;
    },

    snapshotHangarLayout(shipId) {
        const id = shipId || (typeof homeStationUI !== 'undefined' && homeStationUI.hangarShipId) || 'player_scrap';
        const L = this.getLoadout(id);
        const out = {};
        FACTION_LAYOUT_KEYS.forEach((k) => { out[k] = L[k]; });
        // Wing/part shape picks and wing symmetry live on the profile.
        const profile = (typeof profileManager !== 'undefined' && profileManager.getActiveProfile)
            ? profileManager.getActiveProfile() : null;
        if (profile && profile.segmentShapeVariants && profile.segmentShapeVariants[id]) {
            out.segmentShapeVariants = profile.segmentShapeVariants[id];
        }
        if (profile && profile.wingStyleSymmetry && profile.wingStyleSymmetry[id] != null) {
            out.wingStyleSymmetry = profile.wingStyleSymmetry[id];
        }
        const cfg = typeof shipConfigManager !== 'undefined' ? shipConfigManager.getConfig(id) : null;
        if (cfg && cfg.segmentUv) out.segmentUv = cfg.segmentUv;
        return JSON.parse(JSON.stringify(out));
    },
});
