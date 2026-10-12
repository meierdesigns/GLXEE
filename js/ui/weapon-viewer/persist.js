"use strict";

// WeaponViewerUI methods, split from weapon-viewer.js.
extendClass(WeaponViewerUI, {
    persist() {
        if (typeof menuStateManager !== 'undefined' && this.visible) {
            const w = this.weapons[this.selectedIndex];
            menuStateManager.setScreen('weapon-viewer', { weaponId: w ? w.id : 'laser' });
        }
    },

    handleKeyDown(e) {
        if (!this.visible) return;
        if (this._devToggles && this._devToggles.handleKey(e)) return;
        if (e.key === 'Escape' && this.previewFullscreen) {
            e.preventDefault();
            this.setPreviewFullscreen(false);
            return;
        }
        switch (e.key) {
            case 'ArrowUp':
            case 'ArrowLeft':
                e.preventDefault();
                this.selectedIndex = Math.max(0, this.selectedIndex - 1);
                this.renderList();
                this.renderDetail();
                this.resetPreviewSim();
                this.persist();
                break;
            case 'ArrowDown':
            case 'ArrowRight':
                e.preventDefault();
                this.selectedIndex = Math.min(this.weapons.length - 1, this.selectedIndex + 1);
                this.renderList();
                this.renderDetail();
                this.resetPreviewSim();
                this.persist();
                break;
            case 'Escape':
                e.preventDefault();
                this.close();
                break;
        }
    },

    openGfxEditor() {
        const wpn = this.weapons[this.selectedIndex];
        if (!wpn || typeof componentEditorUI === 'undefined') return;
        let type = 'weapon';
        let id = wpn.id;
        const mountKey = wpn.mountSprite || null;
        if (mountKey && typeof assetGenRegistry !== 'undefined' && assetGenRegistry.findByKey) {
            const mountHit = assetGenRegistry.findByKey(mountKey);
            if (mountHit) {
                type = mountHit.type;
                id = mountHit.id;
            }
        } else if (typeof assetGenRegistry !== 'undefined' && assetGenRegistry.get) {
            const hit = assetGenRegistry.get('weapon', wpn.id);
            if (hit) {
                type = hit.type;
                id = hit.id;
            }
        }
        const returnCb = this.onClose;
        this.hide();
        componentEditorUI.open({
            type: type,
            id: id,
            returnTo: 'weapon-viewer',
            onClose: () => {
                this.show({ onClose: returnCb });
            }
        });
    },

    close() {
        this.hide();
        const container = document.querySelector('.game-container');
        const inGame = container && container.style.display !== 'none';
        if (inGame) {
            if (typeof menuStateManager !== 'undefined') menuStateManager.setScreen('ingame');
            return;
        }
        if (this.onClose) {
            const cb = this.onClose;
            this.onClose = null;
            cb();
            return;
        }
        if (typeof homeStationUI !== 'undefined') {
            homeStationUI.show({
                tab: 'explorations',
                focusExplore: 'weapons',
                onClose: () => {
                    if (typeof startScreenManager !== 'undefined') startScreenManager.show();
                }
            });
        } else if (typeof startScreenManager !== 'undefined') {
            startScreenManager.show();
        } else if (typeof menuStateManager !== 'undefined') {
            menuStateManager.setScreen('start');
        }
    },
});
