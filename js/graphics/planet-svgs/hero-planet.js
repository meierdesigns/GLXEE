"use strict";

// PlanetSVGManager: a bigger, more detailed "hero" planet per faction, used
// as an animated backdrop behind the faction-pick wizard card (instead of a
// generic in-game globe). Reuses the same spin-frame rotation pipeline
// (spin-frames.js) at a higher detail grid.
extendClass(PlanetSVGManager, {
    /** Registers (once) and returns the spin model for faction `factionId`'s hero planet. */
    getHeroPlanetSpinModel(factionId, detail) {
        const faction = String(factionId || 'pirate').toLowerCase();
        const id = 'hero-' + faction;
        // getPlanetSpinModel() always re-derives this id's spec via getPlanetSVG()
        // (ensurePlanetGraphic), which for an id with no planetConfigManager entry
        // falls back to namedStyles[id]/namedPalettes[id] (defaulting to gray if
        // unset). Registering the faction's real style/color there — instead of
        // pre-seeding planetSpecs directly — lets that shared fallback path pick
        // up the right look without having to special-case the spin-model lookup
        // (which is shared by every other planet in the game and must not change).
        this.namedPalettes = this.namedPalettes || {};
        this.namedStyles = this.namedStyles || {};
        if (!this.namedPalettes[id]) {
            const style = this.resolveIconStyle ? this.resolveIconStyle(null, faction) : 'banded';
            const pal = (typeof factionShipStyles !== 'undefined' && factionShipStyles.getFactionStyle)
                ? factionShipStyles.getFactionStyle(faction) : null;
            this.namedPalettes[id] = (pal && pal.hull) || this.namedPalettes[faction] || '#808080';
            this.namedStyles[id] = style;
        }
        return this.getPlanetSpinModel(id, detail || 16);
    }
});
