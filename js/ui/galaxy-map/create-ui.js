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
        const progressLabel = this.getExploreProgressLabel() || this.getGalaxyProgressLabel();
        const exploreUi = this.renderExploreControls(!!mountEl);
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
        // Map labels / icons are never text-selected (CSS user-select misses SVG text in some engines).
        this.overlay.addEventListener('selectstart', (e) => {
            if (!e.target.closest || !e.target.closest('input, textarea, [contenteditable="true"]')) e.preventDefault();
        });
        if (embedded) {
            this.overlay.innerHTML = `
                <div class="galaxy-map-header">
                <h2 class="galaxy-map-title">${this.getGalaxyName()}</h2>
                <div class="galaxy-map-toolbar">
                    ${this.shipBarHtml()}
                    <div class="gm-progress-col">
                    ${exploreUi}
                    </div>
                    ${typeof homeStationUI !== 'undefined' ? `<button type="button" class="action-button secondary gm-teleport-btn" id="gmTeleport" title="TELEPORT · Travel to another galaxy" aria-label="Teleport to another galaxy">${typeof iconRenderer !== 'undefined' && iconRenderer.imgHtml ? iconRenderer.imgHtml('gmWormhole', 32, 'gm-teleport-icon', '#ffb347', false) : ''}<span class="gm-teleport-label">TELEPORT</span></button>` : ''}
                </div>
                </div>
                ${emptyHint}
                <!-- Map above; bottom bar (planet / ruler / actions) sits under it. -->
                <div class="gm-map-stage">
                <div class="galaxy-map-area" id="gmMapArea">
                    ${this.renderMapSvg()}
                </div>
                ${panelsHtml}
                </div>
                <div class="galaxy-map-instructions">
                    ${instructions}
                    ${this.statusMsg ? `<p class="gm-status-msg">${this.statusMsg}</p>` : ''}
                </div>
            `;
        } else {
            this.overlay.innerHTML = `
                <div class="galaxy-map-content">
                    <div class="galaxy-map-header">
                    <h2 class="galaxy-map-title">${this.getGalaxyName()}</h2>
                    <div class="galaxy-map-progress-bar">${progressLabel}</div>
                    <div class="galaxy-map-toolbar">
                    </div>
                    </div>
                    ${emptyHint}
                    <div class="galaxy-map-area" id="gmMapArea">
                        ${this.renderMapSvg()}
                    </div>
                    ${panelsHtml}
                    ${exploreUi}
                    ${backBtn ? `<div class="galaxy-map-actions gm-actions-row">${backBtn}</div>` : ''}
                    <div class="galaxy-map-instructions">
                        ${instructions}
                        ${this.statusMsg ? `<p class="gm-status-msg">${this.statusMsg}</p>` : ''}
                    </div>
                </div>
            `;
        }
        this._mountEl = mountEl;
        // Explore budget sits above EXPLORE NEW SECTOR — keep the station top card clear.
        const progressCard = embedded ? document.getElementById('hsMapProgress') : null;
        if (progressCard) {
            progressCard.innerHTML = '';
            progressCard.hidden = true;
        }
        if (mountEl) {
            mountEl.appendChild(this.overlay);
            this.overlay.classList.toggle('is-input-active', this._inputActive);
            this.overlay.classList.toggle('is-picked', !!this._picked);
            mountEl.classList.toggle('is-map-active', this._inputActive);
        } else {
            document.body.appendChild(this.overlay);
        }
        this.bindEvents();
        this.paintShipMini();
        this.scheduleShipGraphicsRefresh();
    },

    /** GPS pin with a ship silhouette: find / return camera to the ship. */
    shipLocatorIconSvg() {
        // Filled 1px rects only (no strokes) so it stays crisp at UI scale.
        // GPS teardrop pin (point down) + small ship nose-up inside the head.
        const pin = [
            // Pin head ring
            [5,1,6,1],[4,2,2,1],[10,2,2,1],[3,3,1,1],[12,3,1,1],
            [3,4,1,2],[12,4,1,2],[3,6,1,1],[12,6,1,1],
            [4,7,1,1],[11,7,1,1],[5,8,2,1],[9,8,2,1],
            // Pin stem / point
            [6,9,4,1],[7,10,2,1],[7,11,2,1],[7,12,2,1],[8,13,1,1]
        ];
        const ship = [
            // Nose
            [7,2,2,1],
            // Body / wings
            [6,3,4,1],[5,4,6,1],[6,5,4,1],
            // Engine notch
            [7,6,2,1]
        ];
        const ticks = [
            // Cardinal GPS ticks outside the pin
            [7,0,2,1],[0,5,2,1],[14,5,2,1]
        ];
        const rects = (list, op) => list.map(([x, y, w, h]) =>
            `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="currentColor"${op ? ` opacity="${op}"` : ''}/>`
        ).join('');
        return `<svg class="gm-locate-map-icon" viewBox="0 0 16 16" width="32" height="32" shape-rendering="crispEdges" aria-hidden="true">` +
            `${rects(ticks, 0.55)}${rects(pin)}${rects(ship)}</svg>`;
    },

    shipLocatorButtonHtml() {
        return `<button type="button" class="gm-locate-ship" id="gmLocateShip" title="FIND SHIP · center map on your ship" aria-label="Find ship on map" data-nav-item>` +
            this.shipLocatorIconSvg() +
            `</button>`;
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
        return `<span class="gm-stat-chip">${this.iconHtml(iconKey, 40, tint)}<span>${value}</span></span>`;
    },

    frameHtml(ship) {
        return this.statChipHtml('hsUpgrade', ship.frameLabel);
    },

    /** Defense + ability slots used / available. */
    loadoutModulesHtml(ship) {
        return [
            this.statChipHtml('statArmor', ship.defensesLabel, 'defense'),
            this.statChipHtml('statAbilities', ship.abilitiesLabel, 'ability')
        ].join('');
    },

    loadoutHtml(ship) {
        return [
            this.statChipHtml('statWeapon', ship.weaponsLabel, 'weapon'),
            this.statChipHtml('statArmor', ship.defensesLabel, 'defense'),
            this.statChipHtml('statAbilities', ship.abilitiesLabel, 'ability')
        ].join('<span class="gm-stat-sep" aria-hidden="true">·</span>');
    },

    /** Equipped weapons: icon + name each, no other module kinds. */
    weaponsHtml(ship) {
        const ids = (ship.weapons || []).filter(Boolean);
        if (!ids.length) return '<span class="gm-muted">NONE</span>';
        return ids.map((id) => {
            const info = (typeof iconRenderer !== 'undefined' && iconRenderer.weaponIconInfo)
                ? iconRenderer.weaponIconInfo(id)
                : { key: 'statWeapon', tint: undefined, name: String(id).toUpperCase() };
            // Same module icon as the hangar editor's parts grid.
            const icon = (typeof homeStationUI !== 'undefined' && homeStationUI.moduleIconHtml)
                ? homeStationUI.moduleIconHtml('weapon', id, 40, 'hs-pixel gm-stat-icon', false)
                : this.iconHtml(info.key, 40, info.tint || undefined);
            const n = (ship.weaponCounts && ship.weaponCounts[id]) || 1;
            return `<span class="gm-stat-chip" data-ui-tip="${info.name}${n > 1 ? ' ×' + n : ''}">${icon}<span>${n > 1 ? '×' + n : ''}</span></span>`;
        }).join('');
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
        // Frame = sum of the hull-area levels (front / center / back / wing).
        const areas = (typeof profileManager !== 'undefined' && profileManager.getShipAreaLevels)
            ? profileManager.getShipAreaLevels(shipId, profile) : null;
        const areaMax = (typeof profileManager !== 'undefined' && profileManager.maxShipAreaLevel)
            ? profileManager.maxShipAreaLevel() : 2;
        const frameLevel = areas
            ? Object.values(areas).reduce((sum, v) => sum + v, 0)
            : ((typeof profileManager !== 'undefined' && profileManager.getShipFrameLevel)
                ? profileManager.getShipFrameLevel(shipId, profile) : 0);
        const frameMax = areas ? Object.keys(areas).length * areaMax
            : ((typeof economyConfig !== 'undefined') ? (economyConfig.maxShipFrameLevel || 8) : 8);
        const rawLoadout = (typeof shipLoadoutManager !== 'undefined')
            ? shipLoadoutManager.getLoadout(shipId)
            : { weapons: [], defenses: [], abilities: [], energy: [] };
        const loadout = (typeof shipLoadoutManager !== 'undefined' && shipLoadoutManager.normalizeLoadout)
            ? shipLoadoutManager.normalizeLoadout(rawLoadout) : rawLoadout;
        // Weapons sit in weaponSlots now; a wing slot carries two guns.
        const mounts = (typeof shipLoadoutManager !== 'undefined' && shipLoadoutManager.weaponMounts)
            ? shipLoadoutManager.weaponMounts(loadout)
            : (loadout.weapons || []).filter(Boolean).map((id) => ({ id: id }));
        const weaponCounts = {};
        mounts.forEach((m) => { weaponCounts[m.id] = (weaponCounts[m.id] || 0) + 1; });
        const count = (list) => (list || []).filter(Boolean).length;
        const caps = (typeof shipLoadoutManager !== 'undefined')
            ? shipLoadoutManager.getSlotCaps(shipId, (model && model.modelClass) || 'starfighter')
            : { weapons: 1, defenses: 1, abilities: 1, energy: 1 };
        const isActive = !!(profile && profile.activeShipId === shipId);
        return {
            id: shipId,
            name,
            modelClass,
            frameLabel: `${frameLevel}/${frameMax}`,
            weaponsLabel: `${mounts.length}`,
            weapons: Object.keys(weaponCounts),
            weaponCounts: weaponCounts,
            gunCount: mounts.length,
            defensesLabel: `${count(loadout.defenses)}/${caps.defenses || 0}`,
            abilitiesLabel: `${count(loadout.abilities)}/${caps.abilities || 0}`,
            status: isActive ? 'ACTIVE' : 'STANDBY'
        };
    },

    /**
     * Active ship summary, shown bare (no panel) in the header toolbar
     * between EXPLORE NEW SECTOR and TELEPORT.
     */
    /** 16x16 pixel planet with a tilted ring, for the EXPLORES counter (drawn per pixel, 2x). */
    progressPlanetIconHtml() {
        const N = 16, cx = 7.5, cy = 7.5, R = 5.6;
        const tilt = -0.42, ca = Math.cos(tilt), sa = Math.sin(tilt);
        const rx = 7.9, ry = 2.9;
        let body = '', light = '', ring = '', ringFront = '';
        for (let y = 0; y < N; y++) {
            for (let x = 0; x < N; x++) {
                const dx = x + 0.5 - (cx + 0.5), dy = y + 0.5 - (cy + 0.5);
                const inDisc = Math.hypot(dx, dy) <= R;
                const u = dx * ca + dy * sa, v = -dx * sa + dy * ca;
                const e = (u / rx) * (u / rx) + (v / ry) * (v / ry);
                const onRing = e <= 1 && e >= 0.55;
                const cell = `<rect x="${x}" y="${y}" width="1" height="1"/>`;
                if (onRing && v > 0) ringFront += cell;           // front half crosses the planet
                else if (onRing && !inDisc) ring += cell;         // back half only outside it
                else if (inDisc) {
                    if (dx * -0.6 + dy * -0.8 > 1.6) light += cell; else body += cell;
                }
            }
        }
        return '<svg class="gm-progress-icon" viewBox="0 0 16 16" width="32" height="32" shape-rendering="crispEdges" aria-hidden="true">' +
            `<g fill="#ffb347" opacity="0.7">${ring}</g><g fill="#5f93e6">${body}</g><g fill="#bfe0ff">${light}</g><g fill="#ffd27a">${ringFront}</g></svg>`;
    },

    shipBarHtml() {
        const ship = this.getShipPanelInfo();
        return `
                <div class="gm-ship-card gm-ship-bar">
                    <div class="gm-ship-card-art">
                        <canvas class="gm-ship-mini-canvas" id="gmShipCanvas" width="84" height="120" aria-label="Selected ship"></canvas>
                    </div>
                    <div class="gm-ship-card-main">
                        <div class="gm-ship-card-info">
                            <span class="gm-panel-value" id="gmShipName">${String(ship.name).toUpperCase()}</span>
                            <span class="gm-ship-card-class" id="gmShipClass">${ship.modelClass}</span>
                        </div>
                        <dl class="gm-ship-card-stats">
                            <div><dt>Weapons</dt><dd class="gm-ship-loadout" id="gmShipLoadout">${this.weaponsHtml(ship)}</dd></div>
                            <div><dt>Modules</dt><dd id="gmShipModules">${this.loadoutModulesHtml(ship)}</dd></div>
                        </dl>
                    </div>
                    ${this.shipLocatorButtonHtml()}
                </div>
        `;
    },

    renderPanelsHtml(info) {
        const ship = this.getShipPanelInfo();
        const stages = !info.unlocked
            ? 'LOCKED'
            : (info.cleared
                ? 'CLEARED'
                : (info.stage.highestStage
                    ? (info.stage.highestStage >= this.getStagesPerPlanet(info.id) ? `BOSS READY · ${this.getStagesPerPlanet(info.id) + 1}/${this.getStagesPerPlanet(info.id) + 1}` : `NEXT STAGE ${info.stage.highestStage + 1}/${this.getStagesPerPlanet(info.id) + 1}`)
                    : 'READY'));
        const diff = info.unlocked ? (info.difficulty || '—') : '???';
        const enemies = info.unlocked ? String(info.enemyCount) : '???';
        const status = info.unlocked ? (info.cleared ? 'CLEARED' : 'OPEN') : 'LOCKED';
        const unlockFrom = !info.unlocked
            ? (this.map.edges || []).map((edge) => edge[0] === info.id ? edge[1] : (edge[1] === info.id ? edge[0] : null))
                .find((pid) => pid && this.isUnlocked(pid))
            : null;
        const unlockHint = this.unlockHintHtml(info);
        if (this.bindUnlockJump) this.bindUnlockJump();
        const planetIcon = this.planetIconHtml(info.id, 260);
        const planetAtmo = this.planetAtmoColor(planetIcon);
        this._barAccent = null;
        const rulerSegs = this.renderGalaxyRulerBadge() || '';
        const barAccent = this._barAccent || 'var(--color-primary)';
        return `
            <div class="galaxy-map-panels">
                <div class="galaxy-map-ruler is-bar" style="--ruler-accent:${barAccent}">
                <div class="galaxy-map-panel galaxy-map-panel-select galaxy-map-ruler-seg is-planet">
                    <div class="gm-sector-planet-col">
                        <div class="gm-sector-heading">
                            <span class="gm-panel-value" id="gmSectorName">${info.name || '—'}</span>
                        </div>
                        <div class="gm-sector-planet-bg${planetAtmo ? ' has-atmo' : ''}" style="--atmo:${planetAtmo || 'transparent'};--dk:${this.planetAtmoScale(planetIcon)}">${planetIcon}${info.unlocked ? '' : this.lockBadgeHtml()}</div>
                    </div>
                    <div class="gm-detail">
                        <div class="stat-row"><span class="stat-label" id="gmFactionLabel">Faction</span><span class="stat-value gm-faction-value" id="gmFaction">${this.planetFactionsLabelHtml ? this.planetFactionsLabelHtml(info.id) : ''}</span></div>
                        <div class="stat-row"><span class="stat-label" id="gmDiffLabel">Difficulty</span><span class="stat-value" id="gmDiff">${diff}</span></div>
                        <div class="stat-row"><span class="stat-label" id="gmStagesLabel">Stages</span><span class="stat-value" id="gmStages">${stages}</span></div>
                        <div class="stat-row"><span class="stat-label" id="gmEnemiesLabel">Enemies</span><span class="stat-value" id="gmEnemies">${enemies}</span></div>
                        <div class="stat-row"><span class="stat-label" id="gmStatusLabel">Status</span><span class="stat-value" id="gmStatus">${status}</span></div>
                        <div class="gm-stage-stepper" id="gmStageStepper">${info.unlocked ? this.planetStagesHtml(info.id) : ''}</div>
                        <div class="gm-unlock-hint" id="gmUnlockHint">${unlockHint}</div>
                    </div>
                </div>
                ${rulerSegs ? `<div class="galaxy-map-ruler-stack">${rulerSegs}</div>` : ''}
                <div class="galaxy-map-ruler-seg is-actions">
                    <div class="galaxy-map-actions gm-actions-row gm-card-actions" id="gmActions">
                        ${this.renderConfirmActionsHtml(info)}
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
            this._shipIcons = null;
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
        setHtml('gmShipLoadout', this.weaponsHtml(ship));
        setHtml('gmShipModules', this.loadoutModulesHtml(ship));
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
