"use strict";

/**
 * Profile create / select / rename / delete overlay.
 */
class ProfileSelectionManager {
    constructor() {
        this.isVisible = false;
        this.selectedIndex = 0;
        this.overlay = null;
        this._keyHandler = null;
        this.onClose = null;
        this.mode = 'list'; // list | create | rename
        this.pendingFaction = this.getFactionIds()[0];
    }
    getFactionIds() {
        if (typeof factionManager !== 'undefined' && factionManager.getFactionIds) {
            return factionManager.getFactionIds();
        }
        return ['terran', 'kronax', 'voidborn', 'pirate', 'machine'];
    }
    /** True when VOXEL / GUI-voxel wants hard blocks (no Scale2x slopes). */
    wantsVoxelEmblems() {
        try {
            const root = document.documentElement;
            if (root.getAttribute('data-vf-ship-render') === 'VOXEL') return true;
            if (root.getAttribute('data-vf-gui-voxel') === 'on') return true;
            if (typeof window !== 'undefined' && window.combatVoxels && window.combatVoxels.cell
                && window.combatVoxels.cell()) return true;
        } catch (e) { /* ignore */ }
        return false;
    }
}
