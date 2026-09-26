"use strict";

// GalaxyMapManager methods, split from galaxy-map.js.
extendClass(GalaxyMapManager, {
    createUI() {
        const mountEl = this._mountEl;
        if (this.overlay) this.overlay.remove();
        this.hoveredPlanetId = null;
        if (typeof planetSVGManager !== 'undefined') {
            planetSVGManager.init();
            if (typeof planetConfigManager !== 'undefined' && this.galaxyId) {
                const g = planetConfigManager.getGalaxy(this.galaxyId);
                const ids = (g && g.planetIds) || [];
                ids.forEach((pid) => {
                    const cfg = planetConfigManager.getConfig(pid);
                    if (cfg && planetSVGManager.registerFromConfig) {
                        planetSVGManager.registerFromConfig(cfg, { force: true });
                    }
                });
            }
        }

        const info = this.getPlanetInfo(this.selectedPlanetId);
        const progressLabel = this.getGalaxyProgressLabel();
        const exploreUi = this.renderExploreControls();
        const panelsHtml = this.renderPanelsHtml(info);
        const emptyHint = (!(this.map.nodes || []).length)
            ? '<p class="galaxy-map-empty-hint">No planets charted yet — travel here from HOME STATION to seed faction sectors, or use EXPLORE.</p>'
            : '';
        const embedded = !!mountEl;
        const backBtn = embedded
            ? ''
            : '<button class="action-button secondary" id="gmBack">BACK</button>';
        const instructions = '';

        this.overlay = document.createElement('div');
        this.overlay.className = embedded ? 'galaxy-map-embedded' : 'galaxy-map-overlay';
        if (embedded) {
            this.overlay.innerHTML = `
                <div class="galaxy-map-toolbar">
                    <h2 class="galaxy-map-title">${this.getGalaxyName()}</h2>
                    <div class="galaxy-map-progress-bar">${progressLabel}</div>
                </div>
                ${emptyHint}
                <div class="galaxy-map-area" id="gmMapArea">
                    ${this.renderMapSvg()}
                </div>
                ${panelsHtml}
                ${exploreUi}
                <div class="galaxy-map-actions gm-actions-row" id="gmActions">
                    ${this.renderConfirmActionsHtml(this.getPlanetInfo(this.selectedPlanetId))}
                </div>
                <div class="galaxy-map-instructions">
                    ${instructions}
                    ${this.statusMsg ? `<p class="gm-status-msg">${this.statusMsg}</p>` : ''}
                </div>
            `;
        } else {
            this.overlay.innerHTML = `
                <div class="galaxy-map-content">
                    <h2 class="galaxy-map-title">${this.getGalaxyName()}</h2>
                    <div class="galaxy-map-progress-bar">${progressLabel}</div>
                    ${emptyHint}
                    <div class="galaxy-map-area" id="gmMapArea">
                        ${this.renderMapSvg()}
                    </div>
                    ${panelsHtml}
                    ${exploreUi}
                    <div class="galaxy-map-actions gm-actions-row" id="gmActions">
                        ${this.renderConfirmActionsHtml(this.getPlanetInfo(this.selectedPlanetId))}
                        ${backBtn}
                    </div>
                    <div class="galaxy-map-instructions">
                        ${instructions}
                        ${this.statusMsg ? `<p class="gm-status-msg">${this.statusMsg}</p>` : ''}
                    </div>
                </div>
            `;
        }
        this._mountEl = mountEl;
        if (mountEl) {
            mountEl.appendChild(this.overlay);
            this.overlay.classList.toggle('is-input-active', this._inputActive);
            mountEl.classList.toggle('is-map-active', this._inputActive);
        } else {
            document.body.appendChild(this.overlay);
        }
        this.bindEvents();
        this.paintShipMini();
        this.scheduleShipGraphicsRefresh();
    },

    getActiveShipId() {
        if (typeof profileManager !== 'undefined' && profileManager.getActiveShipId) {
            const id = profileManager.getActiveShipId();
            if (id) return id;
        }
        if (typeof homeStationUI !== 'undefined' && homeStationUI && homeStationUI.hangarShipId) {
            return homeStationUI.hangarShipId;
        }
        return 'player_scrap';
    },

    getActiveShipModel() {
        const shipId = this.getActiveShipId();
        if (typeof shipConfigManager !== 'undefined' && shipConfigManager.getMergedModel) {
            const model = shipConfigManager.getMergedModel(shipId);
            if (model) {
                if (!model.id) model.id = shipId;
                return model;
            }
        }
        return { id: shipId, name: shipId, type: shipId };
    },

    iconHtml(iconKey, size, tint) {
        if (typeof iconRenderer !== 'undefined' && iconKey) {
            return iconRenderer.imgHtml(iconKey, size || 32, 'gm-stat-icon', tint);
        }
        return '';
    },

    statChipHtml(iconKey, value, kind) {
        const tint = (kind && typeof iconRenderer !== 'undefined' && iconRenderer.getModuleKindColor)
            ? iconRenderer.getModuleKindColor(kind)
            : undefined;
        return `<span class="gm-stat-chip">${this.iconHtml(iconKey, 32, tint)}<span>${value}</span></span>`;
    },

    frameHtml(ship) {
        return this.statChipHtml('hsUpgrade', ship.frameLabel);
    },

    loadoutHtml(ship) {
        return [
            this.statChipHtml('statWeapon', ship.weaponsLabel, 'weapon'),
            this.statChipHtml('statArmor', ship.defensesLabel, 'defense'),
            this.statChipHtml('statAbilities', ship.abilitiesLabel, 'ability')
        ].join('<span class="gm-stat-sep" aria-hidden="true">·</span>');
    },

    getShipPanelInfo() {
        const shipId = this.getActiveShipId();
        const model = this.getActiveShipModel();
        const name = (model && (model.name || model.id)) || shipId || '—';
        const modelClass = String((model && (model.modelClass || model.class)) || 'starfighter')
            .replace(/_/g, ' ')
            .toUpperCase();
        const profile = (typeof profileManager !== 'undefined' && profileManager.getActiveProfile)
            ? profileManager.getActiveProfile()
            : null;
        const frameLevel = (typeof profileManager !== 'undefined' && profileManager.getShipFrameLevel)
            ? profileManager.getShipFrameLevel(shipId, profile)
            : 0;
        const frameMax = (typeof economyConfig !== 'undefined') ? (economyConfig.maxShipFrameLevel || 9) : 9;
        const loadout = (typeof shipLoadoutManager !== 'undefined')
            ? shipLoadoutManager.getLoadout(shipId)
            : { weapons: [], defenses: [], abilities: [], energy: [] };
        const caps = (typeof shipLoadoutManager !== 'undefined')
            ? shipLoadoutManager.getSlotCaps(shipId, (model && model.modelClass) || 'starfighter')
            : { weapons: 1, defenses: 1, abilities: 1, energy: 1 };
        const isActive = !!(profile && profile.activeShipId === shipId);
        return {
            id: shipId,
            name,
            modelClass,
            frameLabel: `${frameLevel}/${frameMax}`,
            weaponsLabel: `${(loadout.weapons || []).length}/${caps.weapons || 0}`,
            defensesLabel: `${(loadout.defenses || []).length}/${caps.defenses || 0}`,
            abilitiesLabel: `${(loadout.abilities || []).length}/${caps.abilities || 0}`,
            status: isActive ? 'ACTIVE' : 'STANDBY'
        };
    },

    renderPanelsHtml(info) {
        const ship = this.getShipPanelInfo();
        const stages = !info.unlocked
            ? 'LOCKED'
            : (info.cleared
                ? 'CLEARED'
                : (info.stage.highestStage
                    ? (info.stage.highestStage >= 3 ? 'BOSS READY' : `NEXT STAGE ${info.stage.highestStage + 1}`)
                    : 'READY'));
        const diff = info.unlocked ? (info.difficulty || '—') : '???';
        const enemies = info.unlocked ? String(info.enemyCount) : '???';
        const status = info.unlocked ? (info.cleared ? 'CLEARED' : 'OPEN') : 'LOCKED';
        return `
            <div class="galaxy-map-panels">
                <div class="galaxy-map-panel galaxy-map-panel-select">
                    <div class="gm-sector-planet-col">
                        <div class="gm-sector-heading">
                            <span class="gm-panel-label">SECTOR</span>
                            <span class="gm-panel-value" id="gmSectorName">${info.name || '—'}</span>
                        </div>
                        <div class="gm-sector-planet-bg">${this.planetIconHtml(info.id, 240)}</div>
                    </div>
                    <div class="gm-detail">
                        <div class="stat-row"><span class="stat-label" id="gmDiffLabel">Difficulty</span><span class="stat-value" id="gmDiff">${diff}</span></div>
                        <div class="stat-row"><span class="stat-label" id="gmStagesLabel">Stages</span><span class="stat-value" id="gmStages">${stages}</span></div>
                        <div class="stat-row"><span class="stat-label" id="gmEnemiesLabel">Enemies</span><span class="stat-value" id="gmEnemies">${enemies}</span></div>
                        <div class="stat-row"><span class="stat-label" id="gmStatusLabel">Status</span><span class="stat-value" id="gmStatus">${status}</span></div>
                    </div>
                </div>
                <div class="galaxy-map-panel galaxy-map-panel-ship">
                    <div class="gm-panel-label">SHIP</div>
                    <div class="gm-ship-panel-body">
                        <canvas class="gm-ship-mini-canvas" id="gmShipCanvas" width="84" height="120" aria-label="Selected ship"></canvas>
                        <div class="gm-ship-panel-info">
                            <div class="gm-panel-value" id="gmShipName">${String(ship.name).toUpperCase()}</div>
                            <div class="gm-detail gm-ship-detail">
                                <div class="stat-row"><span class="stat-label">Class</span><span class="stat-value" id="gmShipClass">${ship.modelClass}</span></div>
                                <div class="stat-row"><span class="stat-label">Frame</span><span class="stat-value" id="gmShipFrame">${this.frameHtml(ship)}</span></div>
                                <div class="stat-row"><span class="stat-label">Loadout</span><span class="stat-value gm-ship-loadout" id="gmShipLoadout">${this.loadoutHtml(ship)}</span></div>
                                <div class="stat-row"><span class="stat-label">Status</span><span class="stat-value" id="gmShipStatus">${ship.status}</span></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Ship art (and lazily loaded module sprites) may arrive after the map is
     * built — repaint the ship panel and the orbit icon once it's ready, plus
     * a couple of short retries for late module sprites.
     */
    scheduleShipGraphicsRefresh() {
        const refresh = () => {
            if (!this.overlay || !this.overlay.isConnected) return;
            this._shipIconKey = null;
            this.paintShipMini();
            const url = this.getShipIconUrl && this.getShipIconUrl();
            const img = this.overlay.querySelector('.gm-ship-marker-img');
            if (url && img) img.setAttribute('href', url);
        };
        if (typeof spriteLoader !== 'undefined' && !spriteLoader.loaded) {
            window.addEventListener('vf-sprites-loaded', refresh, { once: true });
        }
        clearTimeout(this._shipRefreshA);
        clearTimeout(this._shipRefreshB);
        this._shipRefreshA = setTimeout(refresh, 400);
        this._shipRefreshB = setTimeout(refresh, 1500);
    },

    paintShipMini() {
        if (!this.overlay) return;
        const canvas = this.overlay.querySelector('#gmShipCanvas');
        const nameEl = this.overlay.querySelector('#gmShipName');
        const ship = this.getShipPanelInfo();
        const model = this.getActiveShipModel();
        if (nameEl) nameEl.textContent = String(ship.name || 'SHIP').toUpperCase();
        const setText = (id, text) => {
            const el = this.overlay.querySelector('#' + id);
            if (el) el.textContent = text;
        };
        const setHtml = (id, html) => {
            const el = this.overlay.querySelector('#' + id);
            if (el) el.innerHTML = html;
        };
        setText('gmShipClass', ship.modelClass);
        setHtml('gmShipFrame', this.frameHtml(ship));
        setHtml('gmShipLoadout', this.loadoutHtml(ship));
        setText('gmShipStatus', ship.status);
        if (!canvas || !model) return;
        if (typeof shipRenderer !== 'undefined' && shipRenderer.renderShipPreview) {
            shipRenderer.renderShipPreview(canvas, model, 1);
            return;
        }
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'var(--color-primary, #f80)';
        ctx.fillRect(32, 24, 32, 24);
    },
});
