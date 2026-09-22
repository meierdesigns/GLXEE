"use strict";

/**
 * Screen 2 — Galaxy planet node-network map.
 */
class GalaxyMapManager {
    constructor() {
        this.isVisible = false;
        this.galaxyId = null;
        this.selectedPlanetId = null;
        this.hoveredPlanetId = null;
        this.overlay = null;
        this._keyHandler = null;
        this._mountEl = null;
        this._inputActive = true;
        this.onConfirm = null;
        this.onBack = null;
        this.onExplored = null;
        this.onEscape = null;
        this.statusMsg = '';
        this.map = null;
        this.nodeById = {};
    }

    show(options) {
        this.isVisible = true;
        this.galaxyId = options && options.galaxyId;
        this.onConfirm = options && options.onConfirm;
        this.onBack = options && options.onBack;
        this.onExplored = options && options.onExplored;
        this.onEscape = options && options.onEscape;
        this._mountEl = (options && options.mount) || null;
        // Embedded in Home Station: wait for ENTER to arm planet selection.
        this._inputActive = !this._mountEl;
        this.statusMsg = '';
        if (
            typeof planetConfigManager !== 'undefined' &&
            planetConfigManager.ensureGalaxyArrivalContent &&
            typeof profileManager !== 'undefined'
        ) {
            const profile = profileManager.getActiveProfile && profileManager.getActiveProfile();
            const firstVisit = profile
                ? !profileManager.hasDiscoveredGalaxy(this.galaxyId, profile)
                : true;
            const arrival = planetConfigManager.ensureGalaxyArrivalContent(
                this.galaxyId,
                profile ? (String(profile.id) + '|' + this.galaxyId) : ('map|' + this.galaxyId),
                { firstVisit: firstVisit }
            );
            if (arrival && arrival.ok && arrival.seeded && arrival.startPlanetId && profileManager.unlockPlanet) {
                profileManager.unlockPlanet(arrival.startPlanetId);
            }
            if (profile && firstVisit && profileManager.discoverGalaxy) {
                profileManager.discoverGalaxy(this.galaxyId);
            }
        }
        this.loadMap();
        this.createUI();
        if (typeof menuStateManager !== 'undefined' && !this._mountEl) {
            menuStateManager.setScreen('galaxyMap');
        }
    }

    hide() {
        this.isVisible = false;
        this._mountEl = null;
        this._inputActive = false;
        this.hoveredPlanetId = null;
        this.onEscape = null;
        if (this._keyHandler) {
            document.removeEventListener('keydown', this._keyHandler);
            this._keyHandler = null;
        }
        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
        }
    }

    isInputActive() {
        return !!this._inputActive;
    }

    setInputActive(active) {
        this._inputActive = !!active;
        if (this.overlay) {
            this.overlay.classList.toggle('is-input-active', this._inputActive);
        }
        if (this._mountEl) {
            this._mountEl.classList.toggle('is-map-active', this._inputActive);
        }
        return this._inputActive;
    }

    armInput() {
        return this.setInputActive(true);
    }

    disarmInput() {
        return this.setInputActive(false);
    }

    loadMap() {
        this.map = (typeof planetConfigManager !== 'undefined')
            ? planetConfigManager.getGalaxyMap(this.galaxyId)
            : { startPlanetId: 'mars', nodes: [], edges: [] };
        this.nodeById = {};
        (this.map.nodes || []).forEach(n => {
            this.nodeById[n.planetId] = n;
        });

        const startId = this.map.startPlanetId;
        const unlockedStart = startId && this.isUnlocked(startId);
        if (unlockedStart) {
            this.selectedPlanetId = startId;
        } else {
            const firstUnlocked = (this.map.nodes || []).find(n => this.isUnlocked(n.planetId));
            this.selectedPlanetId = firstUnlocked ? firstUnlocked.planetId : (startId || null);
        }
    }

    isUnlocked(planetId) {
        if (typeof profileManager === 'undefined') return true;
        return profileManager.isPlanetUnlocked(this.galaxyId, planetId);
    }

    isCleared(planetId) {
        if (typeof profileManager === 'undefined') return false;
        return profileManager.isPlanetCleared(this.galaxyId, planetId);
    }

    getStagesPerPlanet() {
        if (typeof game !== 'undefined' && game.levelManager && game.levelManager.stagesPerPlanet) {
            return Math.max(1, Math.round(Number(game.levelManager.stagesPerPlanet)) || 3);
        }
        if (typeof gameCore !== 'undefined' && gameCore.levelManager && gameCore.levelManager.stagesPerPlanet) {
            return Math.max(1, Math.round(Number(gameCore.levelManager.stagesPerPlanet)) || 3);
        }
        return 3;
    }

    getPlanetStageProgressLabel(planetId) {
        const pid = String(planetId || '').toLowerCase();
        if (!pid) return '';
        const stage = (typeof profileManager !== 'undefined')
            ? profileManager.getPlanetStageState(this.galaxyId, pid)
            : { highestStage: 0, bossCleared: false };
        const highest = Math.max(0, Math.round(Number(stage.highestStage) || 0));
        const cleared = this.isCleared(pid);
        if (!cleared && !stage.bossCleared && highest <= 0) return '';
        const total = this.getStagesPerPlanet();
        const done = (cleared || stage.bossCleared) ? total : Math.min(highest, total);
        return `${done}/${total}`;
    }

    getPlanetInfo(planetId) {
        const pid = String(planetId || '').toLowerCase();
        let name = pid.toUpperCase();
        let difficulty = '';
        let description = '3 stages + boss chamber';
        let enemyCount = 5;
        let obstacleCount = 3;
        if (typeof planetConfigManager !== 'undefined') {
            const cfg = planetConfigManager.getConfig(pid);
            if (cfg) {
                name = cfg.name || name;
                difficulty = cfg.difficulty || '';
                description = cfg.description || description;
                enemyCount = (cfg.enemies && cfg.enemies.length) || enemyCount;
            }
        }
        const stage = (typeof profileManager !== 'undefined')
            ? profileManager.getPlanetStageState(this.galaxyId, pid)
            : { highestStage: 0, bossCleared: false };
        const unlocked = this.isUnlocked(pid);
        const cleared = this.isCleared(pid);
        return {
            id: pid,
            name,
            difficulty,
            description,
            enemyCount,
            obstacleCount,
            reward: 'XP',
            unlocked,
            cleared,
            stage
        };
    }

    getGalaxyProgressLabel() {
        if (typeof profileManager === 'undefined') return '0/0 CLEARED';
        return profileManager.getGalaxyProgress(this.galaxyId).label;
    }

    getGalaxyName() {
        if (typeof planetConfigManager !== 'undefined') {
            const g = planetConfigManager.getGalaxy(this.galaxyId);
            if (g) {
                const faction = planetConfigManager.getGalaxyFaction
                    ? planetConfigManager.getGalaxyFaction(this.galaxyId)
                    : g.faction;
                const factionTag = faction ? (' · ' + String(faction).toUpperCase()) : '';
                return g.name + factionTag;
            }
        }
        return String(this.galaxyId || '').toUpperCase();
    }

    planetIconHtml(planetId, size) {
        const sid = String(planetId || 'mars').toLowerCase();
        const px = size || 48;
        if (typeof planetSVGManager !== 'undefined') {
            if (!planetSVGManager.planets || !Object.keys(planetSVGManager.planets).length) {
                planetSVGManager.init();
            }
            let svg = planetSVGManager.getPlanetSVG(sid);
            if (svg) {
                const uid = 'gm_' + sid + '_' + Math.random().toString(36).slice(2, 7);
                svg = svg
                    .replace(/id="([^"]+)"/g, (m, id) => `id="${uid}_${id}"`)
                    .replace(/url\(#([^)]+)\)/g, (m, id) => `url(#${uid}_${id})`)
                    .replace(/width="[^"]*"/, `width="${px}"`)
                    .replace(/height="[^"]*"/, `height="${px}"`);
                return `<span class="gm-planet-icon">${svg}</span>`;
            }
        }
        return `<span class="gm-planet-fallback" style="width:${px}px;height:${px}px">${sid.charAt(0).toUpperCase()}</span>`;
    }

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
        const instructions = embedded
            ? '<p>ARROWS Move cursor | ENTER Start Mission</p>'
            : '<p>ARROWS Move cursor | ENTER Start Mission | ESC Back</p>';

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
    }

    getActiveShipId() {
        if (typeof profileManager !== 'undefined' && profileManager.getActiveShipId) {
            const id = profileManager.getActiveShipId();
            if (id) return id;
        }
        if (typeof homeStationUI !== 'undefined' && homeStationUI && homeStationUI.hangarShipId) {
            return homeStationUI.hangarShipId;
        }
        return 'player_scrap';
    }

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
    }

    iconHtml(iconKey, size, tint) {
        if (typeof iconRenderer !== 'undefined' && iconKey) {
            return iconRenderer.imgHtml(iconKey, size || 32, 'gm-stat-icon', tint);
        }
        return '';
    }

    statChipHtml(iconKey, value, kind) {
        const tint = (kind && typeof iconRenderer !== 'undefined' && iconRenderer.getModuleKindColor)
            ? iconRenderer.getModuleKindColor(kind)
            : undefined;
        return `<span class="gm-stat-chip">${this.iconHtml(iconKey, 32, tint)}<span>${value}</span></span>`;
    }

    frameHtml(ship) {
        return this.statChipHtml('hsUpgrade', ship.frameLabel);
    }

    loadoutHtml(ship) {
        return [
            this.statChipHtml('statWeapon', ship.weaponsLabel, 'weapon'),
            this.statChipHtml('statArmor', ship.defensesLabel, 'defense'),
            this.statChipHtml('statAbilities', ship.abilitiesLabel, 'ability')
        ].join('<span class="gm-stat-sep" aria-hidden="true">·</span>');
    }

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
    }

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
                        <div class="stat-row"><span class="stat-label">Difficulty</span><span class="stat-value" id="gmDiff">${diff}</span></div>
                        <div class="stat-row"><span class="stat-label">Stages</span><span class="stat-value" id="gmStages">${stages}</span></div>
                        <div class="stat-row"><span class="stat-label">Enemies</span><span class="stat-value" id="gmEnemies">${enemies}</span></div>
                        <div class="stat-row"><span class="stat-label">Status</span><span class="stat-value" id="gmStatus">${status}</span></div>
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
    }

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
    }

    renderExploreControls() {
        const gid = String(this.galaxyId || '').toLowerCase();
        if (gid === 'milky_way' || !gid) return '';
        const check = (typeof profileManager !== 'undefined' && profileManager.canExploreGalaxy)
            ? profileManager.canExploreGalaxy(gid)
            : { ok: false, reason: 'NO PROFILE' };
        const used = (typeof profileManager !== 'undefined' && profileManager.getExploreIndex)
            ? profileManager.getExploreIndex(gid)
            : 0;
        const budget = check.budget != null
            ? check.budget
            : ((typeof economyConfig !== 'undefined')
                ? economyConfig.getExploreBudget(
                    (typeof profileManager !== 'undefined')
                        ? profileManager.getStationUpgradeLevels()
                        : {}
                )
                : 1);
        const cost = check.cost || ((typeof profileManager !== 'undefined' && profileManager.getExploreCost)
            ? profileManager.getExploreCost(gid)
            : null);
        const costLabel = cost && typeof economyConfig !== 'undefined'
            ? economyConfig.formatCost(cost)
            : '';
        const disabled = !check.ok ? 'disabled' : '';
        let reason = '';
        if (!check.ok) {
            if (check.reason === 'BUDGET') reason = `EXPLORE BUDGET ${used}/${budget} — UPGRADE NAV COMPUTER`;
            else if (check.reason === 'RESOURCES') reason = 'NEED RESOURCES';
            else if (check.reason === 'DRIVE') reason = 'NEED WARP DRIVE';
            else if (check.reason === 'HANDCRAFTED') reason = '';
            else reason = check.reason || '';
        }
        return `<div class="galaxy-map-explore">` +
            `<button class="action-button" id="gmExplore" ${disabled}>EXPLORE NEW SECTOR` +
            (costLabel ? ` (${costLabel})` : '') +
            `</button>` +
            `<span class="gm-explore-meta">EXPLORES ${used}/${budget}` +
            (reason ? ` · ${reason}` : '') +
            `</span></div>`;
    }

    renderMapSvg() {
        const nodes = this.map.nodes || [];
        const edges = this.map.edges || [];
        const W = 640;
        const H = 320;
        const pad = 48;

        const nodeRadius = 24;
        const edgeGap = 2;
        let edgesHtml = '';
        edges.forEach(edge => {
            const a = this.nodeById[edge[0]];
            const b = this.nodeById[edge[1]];
            if (!a || !b) return;
            const ax = pad + a.x * (W - pad * 2);
            const ay = pad + a.y * (H - pad * 2);
            const bx = pad + b.x * (W - pad * 2);
            const by = pad + b.y * (H - pad * 2);
            const dx = bx - ax;
            const dy = by - ay;
            const dist = Math.hypot(dx, dy);
            if (dist < nodeRadius * 2 + edgeGap * 2) return;
            const ux = dx / dist;
            const uy = dy / dist;
            const inset = nodeRadius + edgeGap;
            const x1 = ax + ux * inset;
            const y1 = ay + uy * inset;
            const x2 = bx - ux * inset;
            const y2 = by - uy * inset;
            const lit = this.isUnlocked(edge[0]) || this.isUnlocked(edge[1]);
            edgesHtml += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="gm-edge ${lit ? 'lit' : 'dim'}"/>`;
        });

        let nodesHtml = '';
        nodes.forEach(n => {
            const x = pad + n.x * (W - pad * 2);
            const y = pad + n.y * (H - pad * 2);
            const unlocked = this.isUnlocked(n.planetId);
            const cleared = this.isCleared(n.planetId);
            const selected = n.planetId === this.selectedPlanetId;
            const hovered = n.planetId === this.hoveredPlanetId;
            const stageProgress = this.getPlanetStageProgressLabel(n.planetId);
            const size = 48;
            const frame = size / 2 + 10;
            const stateClass = [
                unlocked ? 'unlocked' : 'locked',
                cleared ? 'cleared' : '',
                selected ? 'selected' : '',
                hovered ? 'hovered' : ''
            ].filter(Boolean).join(' ');
            nodesHtml += `
                <g class="gm-node ${stateClass}"
                   data-planet="${n.planetId}" transform="translate(${x},${y})">
                    <g class="gm-selection-frame">
                        <rect x="${-frame}" y="${-frame}" width="12" height="3" class="gm-corner"/>
                        <rect x="${-frame}" y="${-frame}" width="3" height="12" class="gm-corner"/>
                        <rect x="${frame - 12}" y="${-frame}" width="12" height="3" class="gm-corner"/>
                        <rect x="${frame - 3}" y="${-frame}" width="3" height="12" class="gm-corner"/>
                        <rect x="${-frame}" y="${frame - 3}" width="12" height="3" class="gm-corner"/>
                        <rect x="${-frame}" y="${frame - 12}" width="3" height="12" class="gm-corner"/>
                        <rect x="${frame - 12}" y="${frame - 3}" width="12" height="3" class="gm-corner"/>
                        <rect x="${frame - 3}" y="${frame - 12}" width="3" height="12" class="gm-corner"/>
                    </g>
                    <foreignObject x="${-size / 2}" y="${-size / 2}" width="${size}" height="${size}">
                        <div xmlns="http://www.w3.org/1999/xhtml" class="gm-node-icon-wrap ${unlocked ? '' : 'dimmed'}">
                            ${this.planetIconHtml(n.planetId, size)}
                        </div>
                    </foreignObject>
                    ${cleared ? `
                        <circle class="gm-cleared-ring" cx="0" cy="0" r="${size / 2 + 6}" fill="none"/>
                        <g class="gm-cleared-badge" transform="translate(${size / 2 - 2},${-size / 2 + 2})">
                            <circle cx="0" cy="0" r="8" class="gm-cleared-badge-bg"/>
                            <path class="gm-cleared-check" d="M-3.5 0 L-1 2.5 L3.5 -2.5" fill="none"/>
                        </g>
                    ` : ''}
                    ${stageProgress ? `
                        <text class="gm-stage-progress" x="0" y="${size / 2 + 12}">${stageProgress}</text>
                    ` : ''}
                </g>
            `;
        });

        return `
            <svg class="galaxy-map-svg" viewBox="0 0 ${W} ${H}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
                ${edgesHtml}
                ${nodesHtml}
            </svg>
        `;
    }

    bindNodeClicks() {
        this.overlay.querySelectorAll('.gm-node').forEach(node => {
            node.addEventListener('pointerenter', () => {
                const pid = node.getAttribute('data-planet');
                if (!pid) return;
                this.setHoveredPlanet(pid);
            });
            node.addEventListener('pointerleave', () => {
                const pid = node.getAttribute('data-planet');
                if (!pid) return;
                if (this.hoveredPlanetId === pid) this.setHoveredPlanet(null);
            });
            node.addEventListener('click', () => {
                const pid = node.getAttribute('data-planet');
                if (!pid) return;
                this.selectPlanet(pid);
            });
            node.addEventListener('dblclick', () => {
                const pid = node.getAttribute('data-planet');
                if (!pid) return;
                this.selectPlanet(pid);
                this.confirm();
            });
        });
    }

    setHoveredPlanet(planetId) {
        const next = planetId || null;
        if (this.hoveredPlanetId === next) return;
        this.hoveredPlanetId = next;
        this.syncNodeHighlight();
    }

    syncNodeHighlight() {
        if (!this.overlay) return;
        this.overlay.querySelectorAll('.gm-node').forEach(node => {
            const pid = node.getAttribute('data-planet');
            node.classList.toggle('selected', pid === this.selectedPlanetId);
            node.classList.toggle('hovered', pid === this.hoveredPlanetId);
        });
    }

    bindEvents() {
        if (this._keyHandler) {
            document.removeEventListener('keydown', this._keyHandler);
            this._keyHandler = null;
        }
        this.bindNodeClicks();

        const exploreBtn = this.overlay.querySelector('#gmExplore');
        this.bindConfirmActions();
        if (exploreBtn) {
            exploreBtn.addEventListener('click', () => this.explore());
        }

        this._keyHandler = (e) => {
            if (!this.isVisible || !this._inputActive) return;
            if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault();
                e.stopPropagation();
                this.navigateByArrow(e.key);
            } else if (e.key === 'Enter' || e.key === ' ') {
                // Embedded Play tab: Home Station owns confirmation → startMission.
                if (this._mountEl) return;
                e.preventDefault();
                e.stopPropagation();
                this.confirm('resume');
            } else if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                if (this._mountEl) {
                    this.disarmInput();
                    if (typeof this.onEscape === 'function') this.onEscape();
                    return;
                }
                this.back();
            }
        };
        document.addEventListener('keydown', this._keyHandler);
        this.syncConfirmButton();
    }

    explore() {
        if (typeof profileManager === 'undefined' || !profileManager.exploreGalaxyPlanet) {
            this.statusMsg = 'EXPLORE UNAVAILABLE';
            this.createUI();
            return;
        }
        const res = profileManager.exploreGalaxyPlanet(this.galaxyId);
        if (res.ok) {
            this.statusMsg = 'DISCOVERED: ' + (res.name || res.planetId);
            this.loadMap();
            this.selectedPlanetId = res.planetId;
            if (typeof this.onExplored === 'function') this.onExplored(res);
            this.createUI();
            return;
        }
        if (res.reason === 'BUDGET') this.statusMsg = 'EXPLORE BUDGET FULL — UPGRADE NAV COMPUTER';
        else if (res.reason === 'RESOURCES') this.statusMsg = 'NEED RESOURCES';
        else if (res.reason === 'DRIVE') this.statusMsg = 'NEED WARP DRIVE';
        else this.statusMsg = res.reason || 'EXPLORE FAILED';
        this.createUI();
    }

    navigateByArrow(key) {
        if (!this.selectedPlanetId) return;
        const neighbors = (typeof planetConfigManager !== 'undefined')
            ? planetConfigManager.getGalaxyNeighbors(this.galaxyId, this.selectedPlanetId)
            : [];
        // Allow cursor on locked planets; only require node exists
        const targets = neighbors.filter(n => this.nodeById[n]);
        if (!targets.length) return;

        const cur = this.nodeById[this.selectedPlanetId];
        if (!cur) return;

        let best = null;
        let bestScore = Infinity;
        targets.forEach(nid => {
            const n = this.nodeById[nid];
            const dx = n.x - cur.x;
            const dy = n.y - cur.y;
            let ok = false;
            if (key === 'ArrowLeft' && dx < -0.02) ok = true;
            if (key === 'ArrowRight' && dx > 0.02) ok = true;
            if (key === 'ArrowUp' && dy < -0.02) ok = true;
            if (key === 'ArrowDown' && dy > 0.02) ok = true;
            if (!ok) return;
            const primary = (key === 'ArrowLeft' || key === 'ArrowRight') ? Math.abs(dx) : Math.abs(dy);
            const secondary = (key === 'ArrowLeft' || key === 'ArrowRight') ? Math.abs(dy) : Math.abs(dx);
            const score = secondary * 2 - primary;
            if (score < bestScore) {
                bestScore = score;
                best = nid;
            }
        });

        if (!best && targets.length) {
            bestScore = Infinity;
            targets.forEach(nid => {
                const n = this.nodeById[nid];
                const d = Math.hypot(n.x - cur.x, n.y - cur.y);
                if (d < bestScore) {
                    bestScore = d;
                    best = nid;
                }
            });
        }
        if (best) this.selectPlanet(best);
    }

    selectPlanet(planetId) {
        this.selectedPlanetId = planetId;
        this.syncNodeHighlight();
        this.updateDetails();
        this.syncConfirmButton();
    }

    getStartOptions(planetId) {
        if (typeof profileManager !== 'undefined' && profileManager.getPlanetStartOptions) {
            return profileManager.getPlanetStartOptions(planetId);
        }
        const pid = String(planetId || '').toLowerCase().split('-')[0];
        return {
            canChoose: false,
            startLevelId: pid ? `${pid}-1` : null,
            resumeLevelId: pid ? `${pid}-1` : null,
            resumeLabel: 'STAGE 1'
        };
    }

    renderConfirmActionsHtml(info) {
        const unlocked = !!(info && info.unlocked);
        if (!unlocked) {
            return '<button class="action-button disabled" id="gmConfirm" data-nav-item disabled>LOCKED</button>';
        }
        const opts = this.getStartOptions(info && info.id);
        if (opts.canChoose) {
            return `
                <button class="action-button secondary" id="gmConfirmStart" data-nav-item data-start-mode="start">FROM START</button>
                <button class="action-button" id="gmConfirm" data-nav-item data-start-mode="resume">CONTINUE · ${opts.resumeLabel}</button>
            `;
        }
        return '<button class="action-button" id="gmConfirm" data-nav-item data-start-mode="resume">START MISSION</button>';
    }

    syncConfirmButton() {
        if (!this.overlay) return;
        const actions = this.overlay.querySelector('#gmActions');
        if (!actions) return;
        const info = this.getPlanetInfo(this.selectedPlanetId);
        const backBtn = actions.querySelector('#gmBack');
        const backHtml = backBtn ? backBtn.outerHTML : '';
        actions.innerHTML = this.renderConfirmActionsHtml(info) + (backHtml ? ` ${backHtml}` : '');
        this.bindConfirmActions();
    }

    bindConfirmActions() {
        if (!this.overlay) return;
        const startBtn = this.overlay.querySelector('#gmConfirmStart');
        const confirmBtn = this.overlay.querySelector('#gmConfirm');
        const backBtn = this.overlay.querySelector('#gmBack');
        if (startBtn) {
            startBtn.addEventListener('click', () => this.confirm('start'));
        }
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => {
                const mode = confirmBtn.getAttribute('data-start-mode') || 'resume';
                this.confirm(mode);
            });
        }
        if (backBtn) {
            backBtn.addEventListener('click', () => this.back());
        }
    }

    updateDetails() {
        const info = this.getPlanetInfo(this.selectedPlanetId);
        const set = (id, text) => {
            const el = this.overlay.querySelector('#' + id);
            if (el) el.textContent = text;
        };
        set('gmSectorName', info.name || '—');
        const planetBg = this.overlay.querySelector('.gm-sector-planet-bg');
        if (planetBg) planetBg.innerHTML = this.planetIconHtml(info.id, 240);
        set('gmDiff', info.unlocked ? (info.difficulty || '—') : '???');
        set('gmStages', info.unlocked
            ? (info.cleared
                ? 'CLEARED'
                : (info.stage.highestStage
                    ? (info.stage.highestStage >= 3 ? 'BOSS READY' : `NEXT STAGE ${info.stage.highestStage + 1}`)
                    : 'READY'))
            : 'LOCKED');
        set('gmEnemies', info.unlocked ? String(info.enemyCount) : '???');
        set('gmStatus', info.unlocked ? (info.cleared ? 'CLEARED' : 'OPEN') : 'LOCKED');
        const progressBar = this.overlay.querySelector('.galaxy-map-progress-bar');
        if (progressBar) progressBar.textContent = this.getGalaxyProgressLabel();
    }

    confirm(startMode) {
        const info = this.getPlanetInfo(this.selectedPlanetId);
        if (!info || !info.unlocked) return;
        const mode = startMode === 'start' ? 'start' : 'resume';
        const opts = this.getStartOptions(info.id);
        const levelId = mode === 'start'
            ? (opts.startLevelId || `${info.id}-1`)
            : (opts.resumeLevelId || `${info.id}-1`);
        const cb = this.onConfirm;
        const payload = {
            galaxyId: this.galaxyId,
            planetId: info.id,
            levelId: levelId,
            startMode: mode,
            name: info.name,
            difficulty: info.difficulty,
            description: info.description,
            enemyCount: info.enemyCount,
            obstacleCount: info.obstacleCount,
            reward: info.reward,
            unlocked: true
        };
        const wasEmbedded = !!this._mountEl;
        if (!wasEmbedded) this.hide();
        if (typeof cb === 'function') cb(payload);
    }

    back() {
        const cb = this.onBack;
        this.hide();
        if (typeof cb === 'function') cb();
    }
}

const galaxyMapManager = new GalaxyMapManager();
window.galaxyMapManager = galaxyMapManager;
