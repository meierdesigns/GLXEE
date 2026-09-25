"use strict";

import { ShipAssetLoader } from './core.js';

// ShipAssetLoader methods, split from ship-asset-loader.js.
extendClass(ShipAssetLoader, {
    /**
     * Resolve PNG key for a hull segment. wingRight falls back to mirrored wingLeft.
     */
    resolveSegmentSpriteKey(shipModel, segmentId) {
        const base = this.getSpriteNameForShip(shipModel);
        if (!base || typeof shipLoadoutManager === 'undefined'
            || !shipLoadoutManager.segmentSpriteKey) {
            return null;
        }
        const sid = String(segmentId || '');
        const tryKeys = [];
        if (sid === 'wingRight') {
            tryKeys.push(shipLoadoutManager.segmentSpriteKey(base, 'wingRight'));
            tryKeys.push(shipLoadoutManager.segmentSpriteKey(base, 'wingLeft'));
            tryKeys.push(shipLoadoutManager.segmentSpriteKey(base, 'wing'));
        } else if (sid === 'wingLeft') {
            tryKeys.push(shipLoadoutManager.segmentSpriteKey(base, 'wingLeft'));
            tryKeys.push(shipLoadoutManager.segmentSpriteKey(base, 'wing'));
        } else {
            tryKeys.push(shipLoadoutManager.segmentSpriteKey(base, sid));
        }
        if (typeof spriteLoader === 'undefined' || !spriteLoader.getSprite) return tryKeys[0] || null;
        for (let i = 0; i < tryKeys.length; i++) {
            if (tryKeys[i] && spriteLoader.getSprite(tryKeys[i])) return tryKeys[i];
        }
        return tryKeys[0] || null;
    },

    /**
     * Resolve segment shape variant override from profile.
     * Returns null if no override is set for this segment.
     */
    resolveSegmentVariantOverride(shipModel, segmentId) {
        if (!shipModel || !segmentId || typeof profileManager === 'undefined') {
            return null;
        }
        const shipId = shipModel.id;
        if (!shipId) return null;
        const isWing = segmentId === 'wingLeft' || segmentId === 'wingRight';
        const profileSegmentId = isWing && profileManager.getWingStyleSymmetry
            && profileManager.getWingStyleSymmetry(shipId)
            ? 'wing'
            : segmentId;
        return profileManager.getSegmentShapeVariant(shipId, profileSegmentId);
    },
});
