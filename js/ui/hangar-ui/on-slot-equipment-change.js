"use strict";

// HangarUI methods, split from hangar-ui.js.
extendClass(HangarUI, {
    onSlotEquipmentChange(idx, newId) {
        const profile = this.parent.getProfile();
        if (!profile || !profile.ships || !profile.ships[this.shipId]) return;

        const ship = profile.ships[this.shipId];
        if (ship.slots && ship.slots[idx]) {
            ship.slots[idx].equipped = newId;
            this.parent.createUI();
        }
    },

    destroy() {
        if (this.previewAnimId) {
            cancelAnimationFrame(this.previewAnimId);
            this.previewAnimId = null;
        }
        if (this.wheelBound) {
            if (this.previewCanvas) {
                this.previewCanvas.removeEventListener('wheel', this.wheelBound);
            }
            this.wheelBound = null;
        }
        this.savePrefs();
    },
});
