"use strict";

// GalaxyViewer members, continued from galaxy-viewer.js (kept under ~500 lines per file).
extendClass(GalaxyViewer, {
    handleKey(e) {
        if (!this.el) return;
        // Page rebuilt underneath: stop listening.
        if (!this.el.isConnected) { this.unmount(); return; }
        // The NEW GALAXY modal handles its own keys.
        if (typeof profileSelectionManager !== 'undefined' && profileSelectionManager._galaxyModal) return;
        e.stopImmediatePropagation();
        // DELETE GALAXY modal: ↑/↓ pick the target, ENTER deletes, ESC cancels.
        if (this._reassign) {
            const r = this._reassign;
            const ids = planetConfigManager.getGalaxyIds().filter((id) => id !== r.gid);
            const i = ids.indexOf(r.target);
            if (e.key === 'Escape') { e.preventDefault(); this._reassign = null; this.render(); }
            else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                r.target = ids[(i + (e.key === 'ArrowDown' ? 1 : -1) + ids.length) % ids.length];
                this.render();
            } else if (e.key === 'Enter') { e.preventDefault(); this.confirmReassign(); }
            return;
        }
        // UNIVERSE LOADER open: ESC closes just the modal, other keys do nothing.
        if (this._universeOpen) {
            if (e.key === 'Escape') { e.preventDefault(); this.setUniverseOpen(false); }
            return;
        }
        const ids = planetConfigManager.getGalaxyIds();
        const i = ids.indexOf(this.selected);
        if (e.key === 'Escape') { e.preventDefault(); this.hide(); }
        else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            const d = e.key === 'ArrowDown' ? 1 : -1;
            this.select(ids[(i + d + ids.length) % ids.length]);
        } else if (e.key === 'n' || e.key === 'N') { e.preventDefault(); this.openNew(); }
        else if (e.key === 'Delete') { e.preventDefault(); this.deleteSelected(); }
    },
});

const galaxyViewer = new GalaxyViewer();
window.galaxyViewer = galaxyViewer;
