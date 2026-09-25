"use strict";

// DefenseViewerUI methods, split from defense-viewer.js.
extendClass(DefenseViewerUI, {
    renderDetail() {
        const root = this.overlay && this.overlay.querySelector('#dvDetail');
        const a = this.items[this.selectedIndex];
        if (!root || !a) return;
        root.innerHTML = `
            <div class="content-viewer-hero">
                <div class="cv-ability-hero-icon">${this.iconHtml(a.icon, 48, a.name)}</div>
                <div>
                    <h3 class="content-viewer-name">${a.name}</h3>
                    <p class="content-viewer-desc">${a.description || 'No description.'}</p>
                </div>
            </div>
            <div class="content-viewer-stats">
                <div class="stat-row"><span class="stat-label">System</span><span class="stat-value">DEFENSE</span></div>
                <div class="stat-row"><span class="stat-label">Type</span><span class="stat-value">${String(a.type || '—').toUpperCase()}</span></div>
                <div class="stat-row"><span class="stat-label">Tier</span><span class="stat-value">${a.tier}</span></div>
                <div class="stat-row"><span class="stat-label">ID</span><span class="stat-value">${a.id}</span></div>
                <div class="stat-row"><span class="stat-label">Summary</span><span class="stat-value">${a.uiDescription || '—'}</span></div>
            </div>
        `;
        if (this._devToggles) this._devToggles.refresh();
    },

    persist() {
        if (typeof menuStateManager !== 'undefined' && this.visible) {
            const a = this.items[this.selectedIndex];
            menuStateManager.setScreen('defense-viewer', { defenseId: a ? a.id : 'heavy_armor' });
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
                this.selectedIndex = Math.min(this.items.length - 1, this.selectedIndex + 1);
                this.renderList();
                this.renderDetail();
                this.resetPreviewSim();
                this.persist();
                break;
            case 'e':
            case 'E':
            case 'Enter':
                e.preventDefault();
                this.openEditor();
                break;
            case 'Escape':
                e.preventDefault();
                this.close();
                break;
        }
    },

    openEditor() {
        const item = this.items[this.selectedIndex];
        if (!item || typeof abilityEditorUI === 'undefined') return;
        this.hide();
        abilityEditorUI.show(item.id, false, { returnTo: 'defense-viewer' });
    },

    openGfxEditor() {
        const item = this.items[this.selectedIndex];
        if (!item || typeof componentEditorUI === 'undefined') return;
        let type = 'mount';
        let id = item.mountSprite || ('mount_' + item.id);
        if (typeof assetGenRegistry !== 'undefined' && assetGenRegistry.findByKey) {
            const hit = assetGenRegistry.findByKey(id) || assetGenRegistry.get('ability', item.id);
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
            returnTo: 'defense-viewer',
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
                focusExplore: 'defenses',
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
