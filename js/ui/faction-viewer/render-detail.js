"use strict";

// FactionViewerUI methods, split from faction-viewer.js.
extendClass(FactionViewerUI, {
    renderDetail() {
        const root = this.overlay && this.overlay.querySelector('#fvDetail');
        const f = this.factions[this.selectedIndex];
        if (!root || !f) return;
        const traits = (f.traits || []).map((t) => String(t).toUpperCase()).join(' · ') || '—';
        const lore = f.loreLong || f.lore || 'No archive entry.';
        const enemyCount = this.countRelatedEnemies(f.id);
        const planetCount = this.countRelatedPlanets(f.id);
        const emblemKey = (typeof factionShipStyles !== 'undefined' && factionShipStyles.emblemKey)
            ? factionShipStyles.emblemKey(f.id)
            : ('faction-' + f.id);
        const classes = (typeof factionShipStyles !== 'undefined' && factionShipStyles.classes)
            ? factionShipStyles.classes
            : ['scout', 'assault', 'heavy', 'elite', 'capital'];
        const fleetHtml = classes.map((cls) => {
            const shipKey = (typeof factionShipStyles !== 'undefined' && factionShipStyles.spriteKey)
                ? factionShipStyles.spriteKey(f.id, cls)
                : ('enemy-' + f.id + '-' + cls);
            return `<button type="button" class="pe-btn fv-fleet-chip" data-ag-type="factionShip" data-ag-id="${shipKey}" data-ag-key="${shipKey}" title="${shipKey}">${String(cls).toUpperCase()}</button>`;
        }).join('');
        root.innerHTML = `
            <div class="content-viewer-hero" data-ag-type="faction" data-ag-id="${emblemKey}" data-ag-key="${emblemKey}">
                <div class="cv-ability-hero-icon" data-icon="${f.icon}" data-ag-key="${emblemKey}">${this.iconHtml(f.icon, 64, f.label || f.id)}</div>
                <div>
                    <h3 class="content-viewer-name">${f.label}</h3>
                    <p class="content-viewer-desc">${f.lore || ''}</p>
                </div>
            </div>
            <div class="content-viewer-stats cv-stat-clusters cv-stat-clusters-plain">
                <div class="cv-stat-cluster">
                    <div class="cv-stat-cluster-title">Identity</div>
                    <div class="stat-row"><span class="stat-label">Faction</span><span class="stat-value">${f.label}</span></div>
                    <div class="stat-row"><span class="stat-label">Home</span><span class="stat-value">${this.resolveGalaxyName(f.homeGalaxy)}</span></div>
                    <div class="stat-row"><span class="stat-label">Traits</span><span class="stat-value">${traits}</span></div>
                </div>
                <div class="cv-stat-cluster">
                    <div class="cv-stat-cluster-title">Archive Links</div>
                    <div class="stat-row"><span class="stat-label">Enemy types</span><span class="stat-value">${enemyCount}</span></div>
                    <div class="stat-row"><span class="stat-label">Planet tags</span><span class="stat-value">${planetCount}</span></div>
                    <div class="stat-row"><span class="stat-label">ID</span><span class="stat-value">${f.id}</span></div>
                </div>
            </div>
            <div class="cv-stat-cluster">
                <div class="cv-stat-cluster-title">Fleet Classes · hover+# generate</div>
                <div class="fv-fleet-row">${fleetHtml}</div>
            </div>
            <div class="cv-stat-cluster fv-lore-block">
                <div class="cv-stat-cluster-title">Lore</div>
                <p class="content-viewer-desc fv-lore-text">${lore}</p>
            </div>
        `;
        if (this._devToggles) this._devToggles.refresh();
    },

    persist() {
        if (typeof menuStateManager !== 'undefined' && this.visible) {
            const f = this.factions[this.selectedIndex];
            menuStateManager.setScreen('faction-viewer', { factionId: f ? f.id : 'terran' });
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
                this.selectedIndex = Math.min(this.factions.length - 1, this.selectedIndex + 1);
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
                focusExplore: 'factions',
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
