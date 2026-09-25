"use strict";

// AbilityViewerUI methods, split from ability-viewer.js.
extendClass(AbilityViewerUI, {
    renderDetail() {
        const root = this.overlay && this.overlay.querySelector('#avDetail');
        const a = this.abilities[this.selectedIndex];
        if (!root || !a) return;
        root.innerHTML = `
            <div class="content-viewer-hero">
                <div class="cv-ability-hero-icon">${typeof abilityConfigManager !== 'undefined' ? abilityConfigManager.resolveIconHtml(a.icon, 32, 'cv-ability-icon-img', a.name) : a.icon}</div>
                <div>
                    <h3 class="content-viewer-name">${a.name}</h3>
                    <p class="content-viewer-desc">${a.description || 'No description.'}</p>
                </div>
            </div>
            <div class="content-viewer-stats">
                <div class="stat-row"><span class="stat-label">Cluster</span><span class="stat-value">${a.clusterLabel}</span></div>
                <div class="stat-row"><span class="stat-label">Type</span><span class="stat-value">${String(a.type || '—').toUpperCase()}</span></div>
                <div class="stat-row"><span class="stat-label">Tier</span><span class="stat-value">${a.tier}</span></div>
                <div class="stat-row"><span class="stat-label">ID</span><span class="stat-value">${a.id}</span></div>
                <div class="stat-row"><span class="stat-label">Summary</span><span class="stat-value">${a.uiDescription || '—'}</span></div>
            </div>
        `;
        this.updateDeleteButton();
        if (this._devToggles) this._devToggles.refresh();
    },

    updateDeleteButton() {
        const btn = this.overlay && this.overlay.querySelector('#avDelete');
        const a = this.abilities[this.selectedIndex];
        if (!btn) return;
        btn.disabled = !(a && a.custom);
        btn.style.opacity = btn.disabled ? '0.4' : '1';
    },

    persist() {
        if (typeof menuStateManager !== 'undefined' && this.visible) {
            const a = this.abilities[this.selectedIndex];
            menuStateManager.setScreen('ability-viewer', { abilityId: a ? a.id : 'player_control' });
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
                this.selectedIndex = Math.min(this.abilities.length - 1, this.selectedIndex + 1);
                this.renderList();
                this.renderDetail();
                this.resetPreviewSim();
                this.persist();
                break;
            case 'n':
            case 'N':
                e.preventDefault();
                this.createNew();
                break;
            case 'e':
            case 'E':
            case 'Enter':
                e.preventDefault();
                this.openEditor();
                break;
            case 'Delete':
            case 'Backspace':
                e.preventDefault();
                this.deleteSelected();
                break;
            case 'Escape':
                e.preventDefault();
                this.close();
                break;
        }
    },

    createNew() {
        if (typeof abilityConfigManager === 'undefined') return;
        const ability = abilityConfigManager.createAbility({ name: 'New Ability' });
        this.abilities = this.getAbilityList();
        const idx = this.abilities.findIndex((a) => a.id === ability.id);
        this.selectedIndex = idx >= 0 ? idx : this.abilities.length - 1;
        this.renderList();
        this.renderDetail();
        this.resetPreviewSim();
        this.persist();
        this.openEditor();
    },

    deleteSelected() {
        const ability = this.abilities[this.selectedIndex];
        if (!ability || !ability.custom || typeof abilityConfigManager === 'undefined') return;
        abilityConfigManager.deleteAbility(ability.id);
        this.abilities = this.getAbilityList();
        this.selectedIndex = Math.max(0, Math.min(this.selectedIndex, this.abilities.length - 1));
        this.renderList();
        this.renderDetail();
        this.resetPreviewSim();
        this.persist();
    },

    openEditor() {
        const ability = this.abilities[this.selectedIndex];
        if (!ability || typeof abilityEditorUI === 'undefined') return;
        this.hide();
        abilityEditorUI.show(ability.id, false, { returnTo: 'ability-viewer' });
    },

    openGfxEditor() {
        const ability = this.abilities[this.selectedIndex];
        if (!ability || typeof componentEditorUI === 'undefined') return;
        let type = 'ability';
        let id = ability.id;
        const mountKey = ability.mountSprite || null;
        if (mountKey && typeof assetGenRegistry !== 'undefined' && assetGenRegistry.findByKey) {
            const mountHit = assetGenRegistry.findByKey(mountKey);
            if (mountHit) {
                type = mountHit.type;
                id = mountHit.id;
            }
        } else if (typeof assetGenRegistry !== 'undefined' && assetGenRegistry.get) {
            const hit = assetGenRegistry.get('ability', ability.id);
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
            returnTo: 'ability-viewer',
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
                focusExplore: 'abilities',
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
