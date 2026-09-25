"use strict";

// EnemyViewerUI methods, split from enemy-viewer.js.
extendClass(EnemyViewerUI, {
    openGfxEditor() {
        const enemy = this.enemies[this.selectedIndex];
        if (!enemy || typeof componentEditorUI === 'undefined') return;
        let type = 'enemy';
        let id = enemy.id;
        if (typeof assetGenRegistry !== 'undefined' && assetGenRegistry.findByKey) {
            const hit = assetGenRegistry.findByKey(enemy.id)
                || assetGenRegistry.findByKey('enemy-' + String(enemy.id).replace(/^enemy[-_]?/, ''));
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
            returnTo: 'enemy-viewer',
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
                focusExplore: 'enemies',
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
