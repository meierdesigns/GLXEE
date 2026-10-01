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
        this.onDock = null;
        this.onEscape = null;
        this.statusMsg = '';
        this.map = null;
        this.nodeById = {};
        // Normal map view starts at the full-theater scale. The versioned key
        // clears older oversized defaults while preserving later user zoom.
        const zoomStorageKey = 'vf.galaxyMapZoomV2';
        let zoom = 1;
        try {
            const saved = Number(localStorage.getItem(zoomStorageKey));
            if (Number.isFinite(saved) && saved > 0) zoom = Math.max(0.75, Math.min(2.5, saved));
        } catch (e) {}
        Object.defineProperty(this, 'mapZoom', {
            configurable: true,
            enumerable: true,
            get: () => zoom,
            set: (v) => {
                zoom = v;
                if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) return;
                clearTimeout(this._zoomSaveTimer);
                this._zoomSaveTimer = setTimeout(() => {
                    try { localStorage.setItem(zoomStorageKey, String(zoom)); } catch (e) {}
                }, 300);
            }
        });
        this.mapPan = null;
    }

    show(options) {
        this.isVisible = true;
        this.galaxyId = options && options.galaxyId;
        this.onConfirm = options && options.onConfirm;
        this.onBack = options && options.onBack;
        this.onExplored = options && options.onExplored;
        this.onDock = options && options.onDock;
        this.onEscape = options && options.onEscape;
        this._mountEl = (options && options.mount) || null;
        // Embedded map (PLAY tab): the keyboard stays with the station until
        // ENTER / SPACE enters the map (armInput). Mouse clicks work anyway.
        // The standalone map overlay takes the keyboard right away.
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
            } else if (profile && profileManager.ensureAllyDefense) {
                // Saves from before ally defenses: start it on the next visit.
                profileManager.ensureAllyDefense(this.galaxyId, profile);
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
        this.clearActionFocus();
        return this.setInputActive(false);
    }

    /** Start/confirm buttons of the selected planet card, enabled only. */
    getActionButtons() {
        const actions = this.overlay && this.overlay.querySelector('#gmActions');
        if (!actions) return [];
        return Array.from(actions.querySelectorAll('button[data-nav-item]'))
            .filter((b) => !b.disabled && b.id !== 'gmBack');
    }

    hasActionFocus() {
        return this._actionFocus != null && this.getActionButtons().length > 0;
    }

    /** Highlight one action button (defaults to the main CONTINUE/START one). */
    focusActionButton(index) {
        const list = this.getActionButtons();
        if (!list.length) {
            this._actionFocus = null;
            return false;
        }
        let i = index;
        if (i == null) {
            const main = list.findIndex((b) => b.id === 'gmConfirm');
            i = main >= 0 ? main : 0;
        }
        i = (i + list.length) % list.length;
        this._actionFocus = i;
        list.forEach((b, idx) => b.classList.toggle('nav-focused', idx === i));
        try { list[i].focus({ preventScroll: true }); } catch (e) { /* ignore */ }
        return true;
    }

    clearActionFocus() {
        this._actionFocus = null;
        this.getActionButtons().forEach((b) => {
            b.classList.remove('nav-focused');
            if (document.activeElement === b) b.blur();
        });
    }

    /**
     * ENTER / SPACE inside the map: first press moves focus from the map to
     * the planet card's start button, the next press activates it.
     */
    confirmKey() {
        if (!this.hasActionFocus()) {
            if (this.focusActionButton()) return true;
            this.confirm('resume');
            return true;
        }
        const btn = this.getActionButtons()[this._actionFocus];
        this.clearActionFocus();
        if (btn) btn.click();
        return true;
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
        // Cursor starts where the ship is.
        this.selectedPostId = null;
        this.selectedBorder = null;
        const loc = (typeof profileManager !== 'undefined' && profileManager.getShipLocation)
            ? profileManager.getShipLocation(this.galaxyId)
            : null;
        if (loc && loc.kind === 'planet' && this.nodeById[loc.id]) {
            this.selectedPlanetId = loc.id;
        } else if (loc && loc.kind === 'post' && profileManager.getTradingPost) {
            const post = profileManager.getTradingPost(loc.id);
            if (post && this.nodeById[post.planetId]) {
                this.selectedPlanetId = post.planetId;
                this.selectedPostId = post.id;
            }
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

    getStagesPerPlanet(planetId) {
        if (planetId && typeof getPlanetStageCount === 'function') return getPlanetStageCount(planetId);
        if (typeof game !== 'undefined' && game.levelManager && game.levelManager.stagesPerPlanet) {
            return Math.max(1, Math.round(Number(game.levelManager.stagesPerPlanet)) || 3);
        }
        if (typeof gameCore !== 'undefined' && gameCore.levelManager && gameCore.levelManager.stagesPerPlanet) {
            return Math.max(1, Math.round(Number(gameCore.levelManager.stagesPerPlanet)) || 3);
        }
        return 3;
    }

    /**
     * Stage progress incl. the boss: stages 1..N plus the boss as N+1.
     * Returns { done, total, boss } or null before the first clear;
     * boss = true while the boss stage is the next one to fight.
     */
    getPlanetStageProgress(planetId) {
        const pid = String(planetId || '').toLowerCase();
        if (!pid) return null;
        const stage = (typeof profileManager !== 'undefined')
            ? profileManager.getPlanetStageState(this.galaxyId, pid)
            : { highestStage: 0, bossCleared: false };
        const highest = Math.max(0, Math.round(Number(stage.highestStage) || 0));
        const cleared = this.isCleared(pid) || !!stage.bossCleared;
        if (!cleared && highest <= 0) return null;
        const stages = this.getStagesPerPlanet(pid);
        const total = stages + 1;
        if (cleared) return { done: total, total, boss: false };
        if (highest >= stages) return { done: total, total, boss: true };
        return { done: highest, total, boss: false };
    }

    getPlanetStageProgressLabel(planetId) {
        const p = this.getPlanetStageProgress(planetId);
        if (!p) return '';
        return p.boss ? `BOSS/${p.total}` : `${p.done}/${p.total}`;
    }

    /** Pixel boss skull (SVG group, 9×8 px) centred on x,y. */
    bossIconSvg(x, y, px) {
        const s = px || 1;
        const rows = [
            '.#######.',
            '#########',
            '##..#..##',
            '##..#..##',
            '#########',
            '.###.###.',
            '..#.#.#..',
            '..#####..'
        ];
        let d = '';
        rows.forEach((row, ry) => {
            for (let rx = 0; rx < row.length; rx++) {
                if (row[rx] === '#') d += `M${rx} ${ry}h1v1h-1z`;
            }
        });
        return `<g class="gm-boss-icon" shape-rendering="crispEdges" transform="translate(${x - 4.5 * s},${y - 4 * s}) scale(${s})"><path d="${d}"/></g>`;
    }

    /**
     * Stage stepper in the planet card: stages 1..N plus the boss.
     * Cleared stages get a check, the next stage to fight shows the player
     * ship, the boss stage the skull.
     */
    isDevMode() {
        return typeof startScreenManager !== 'undefined' && !!startScreenManager.devMode;
    }

    /** Dev-mode stage pick for a planet (1..N, N = boss) or null. */
    getDevStagePick(planetId) {
        const v = this._devStagePick && this._devStagePick[String(planetId || '').toLowerCase()];
        return v || null;
    }

    /** Level id of the dev-mode pick, e.g. "mars-2" / "mars-boss". */
    getDevStageLevelId(planetId) {
        const pid = String(planetId || '').toLowerCase();
        const pick = this.isDevMode() ? this.getDevStagePick(pid) : null;
        if (!pick) return null;
        return pick > this.getStagesPerPlanet(pid) ? `${pid}-boss` : `${pid}-${pick}`;
    }

    /** Stepper clicks in dev mode (delegated, bound once). */
    bindDevStagePicks() {
        if (this._devStageBound) return;
        this._devStageBound = true;
        document.addEventListener('click', (e) => {
            const el = e.target && e.target.closest && e.target.closest('.gm-sector-stage[data-dev-stage]');
            if (!el || !this.isDevMode()) return;
            e.preventDefault();
            e.stopPropagation();
            const pid = el.getAttribute('data-dev-planet');
            this._devStagePick = this._devStagePick || {};
            this._devStagePick[pid] = Number(el.getAttribute('data-dev-stage')) || 1;
            const stepper = this.overlay && this.overlay.querySelector('#gmStageStepper');
            if (stepper) stepper.innerHTML = this.planetStagesHtml(pid);
            // Start button follows the pick.
            if (this.syncConfirmButton) this.syncConfirmButton();
        }, true);
    }

    planetStagesHtml(planetId) {
        this.bindDevStagePicks();
        const pid = String(planetId || '').toLowerCase();
        if (!pid) return '';
        const stages = this.getStagesPerPlanet(pid);
        const total = stages + 1;
        const p = this.getPlanetStageProgress(pid) || { done: 0, total, boss: false };
        const cleared = p.done >= total && !p.boss;
        // Dev mode: every stage is pickable; the pick replaces the "current" one.
        const dev = this.isDevMode();
        const pick = dev ? this.getDevStagePick(pid) : null;
        const current = pick ? pick : (cleared ? -1 : (p.boss ? total : p.done + 1));
        const ship = this.getShipIconUrl ? this.getShipIconUrl(1) : null;
        let html = '';
        for (let i = 1; i <= total; i++) {
            const isBoss = i === total;
            const done = pick ? (cleared || i < (cleared ? total + 1 : (p.boss ? total : p.done + 1))) : (cleared || i < current);
            const here = i === current;
            let inner = '';
            if (isBoss && !done) {
                inner = `<svg viewBox="0 0 9 8">${this.bossIconSvg(4.5, 4, 1)}</svg>`;
            } else if (done) {
                // Cleared: solid green tile with a dark pixel check.
                inner = '<svg viewBox="0 0 10 10" shape-rendering="crispEdges"><rect class="gm-stage-done-bg" width="10" height="10"/><path class="gm-stage-check" d="M2 5h1v1h1v1h1V6h1V5h1V4h1V3H7v1H6v1H5v1H4V5H3V4H2z"/></svg>';
            } else {
                // Open stage: pixel target / crosshair.
                inner = '<svg viewBox="0 0 9 9" shape-rendering="crispEdges"><path class="gm-stage-open" d="M3 0h3v1H3zM0 3h1v3H0zM8 3h1v3H8zM3 8h3v1H3zM1 1h2v1H2v1H1zM6 1h2v2H7V2H6zM1 6h1v1h1v1H1zM7 6h1v2H6V7h1zM4 2h1v2h2v1H5v2H4V5H2V4h2z"/></svg>';
            }
            // Player ship hovers above the stage it fights next.
            if (here && ship) inner += `<img src="${ship}" alt="" class="gm-stage-ship">`;
            const tag = isBoss ? 'BOSS' : String(i);
            html += `<span class="gm-sector-stage${done ? ' is-done' : ''}${here ? ' is-current' : ''}${isBoss ? ' is-boss' : ''}${dev ? ' is-dev-pick' : ''}"` +
                (dev ? ` data-dev-stage="${i}" data-dev-planet="${pid}"` : '') +
                ` title="${isBoss ? 'BOSS' : 'STAGE ' + i} ${i}/${total}${done ? ' · CLEARED' : ''}${dev ? ' · DEV: CLICK TO PLAY' : ''}">` +
                `${inner}<span class="gm-stage-tag">${tag}</span></span>`;
            // Connector to the next step: solid once walked, dashed ahead.
            if (i < total) html += `<span class="gm-stage-link${cleared || i + 1 <= current ? ' is-walked' : ''}"></span>`;
        }
        return html;
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
                const pf = planetConfigManager.getPlanetFactions ? planetConfigManager.getPlanetFactions(pid) : (cfg.factions || []);
                if (Array.isArray(pf) && pf.length > 1) {
                    description = 'ALLIED: ' + pf.map((f) => String(f).toUpperCase()).join(' + ')
                        + ' · ' + description;
                }
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
                if (planetConfigManager.getGalaxyControlLabel) {
                    return g.name + ' · ' + planetConfigManager.getGalaxyControlLabel(this.galaxyId);
                }
                const faction = planetConfigManager.getGalaxyFaction
                    ? planetConfigManager.getGalaxyFaction(this.galaxyId)
                    : g.faction;
                const factionTag = faction ? (' · ' + String(faction).toUpperCase()) : '';
                return g.name + factionTag;
            }
        }
        return String(this.galaxyId || '').toUpperCase();
    }

    /** Top-right badge: the faction that rules this galaxy (its main faction). */
    renderGalaxyRulerBadge() {
        if (typeof planetConfigManager === 'undefined' || !planetConfigManager.getGalaxyControl) return '';
        const c = planetConfigManager.getGalaxyControl(this.galaxyId);
        if (!c || !c.main) return '';
        const styleOf = (f) => (typeof factionShipStyles !== 'undefined' && factionShipStyles.getFactionStyle
            ? factionShipStyles.getFactionStyle(f) : null);
        const emblemOf = (f, size) => (typeof profileSelectionManager !== 'undefined' && profileSelectionManager.getFactionEmblemHtml
            ? profileSelectionManager.getFactionEmblemHtml(f, size) : '');
        const style = styleOf(c.main);
        const accent = (style && style.accent) || 'var(--color-primary)';
        const emblem = emblemOf(c.main, 48);
        const state = c.control === 'contested' ? 'CONTESTED' : 'HELD';
        const g = planetConfigManager.getGalaxy ? planetConfigManager.getGalaxy(this.galaxyId) : null;
        const galaxyName = (g && g.name) || String(this.galaxyId || '').toUpperCase();
        // Ruler card: emblem + galaxy name + control state (faction reads from the emblem).
        const ruler = `<div class="galaxy-map-ruler-card" style="--ruler-accent:${accent}" title="Ruled by ${String(c.main).toUpperCase()}">` +
            (emblem ? `<span class="galaxy-map-ruler-emblem">${emblem}</span>` : '') +
            `<span class="galaxy-map-ruler-text"><span class="galaxy-map-ruler-galaxy">${galaxyName}</span>` +
            `<span class="galaxy-map-ruler-label">${state}</span>${this.renderHoldingsLine()}</span></div>`;
        return `<div class="galaxy-map-ruler">${ruler}${this.renderGalaxySituationCard(c, emblemOf, styleOf)}</div>`;
    }

    /** "BASE MARS · 2 WARCAMPS" (or "BASE DESTROYED") under the ruler state. */
    renderHoldingsLine() {
        const pm = typeof profileManager !== 'undefined' ? profileManager : null;
        const h = pm && pm.getFactionHoldings ? pm.getFactionHoldings(this.galaxyId) : null;
        if (!h || !h.base) return '';
        if (h.baseLost) return '<span class="galaxy-map-ruler-holdings">BASE DESTROYED</span>';
        const cfg = planetConfigManager.getConfig ? planetConfigManager.getConfig(h.base) : null;
        const baseName = pm.isHoldingBaseRevealed(this.galaxyId)
            ? String((cfg && cfg.name) || h.base).toUpperCase() : 'UNKNOWN';
        const label = pm.getFactionExpansion(h.ruler).label;
        const n = h.stations.length;
        return `<span class="galaxy-map-ruler-holdings">BASE ${baseName}${n ? ' · ' + n + ' ' + label + (n === 1 ? '' : 'S') : ''}</span>`;
    }

    /** Card under the ruler: active mission here, else the galaxy's conflict, else a hint. */
    renderGalaxySituationCard(c, emblemOf, styleOf) {
        const esc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
        const p = (typeof profileManager !== 'undefined' && profileManager.getActiveProfile) ? profileManager.getActiveProfile() : null;
        // Invasion of this galaxy comes first (invasion-scenario.js).
        const inv = (typeof profileManager !== 'undefined' && profileManager.getActiveInvasion)
            ? profileManager.getActiveInvasion(p, this.galaxyId) : null;
        if (inv) {
            const icfg = planetConfigManager.getConfig ? planetConfigManager.getConfig(inv.planetId) : null;
            const iplanet = String((icfg && icfg.name) || inv.planetId).toUpperCase();
            const ist = styleOf(inv.attacker);
            return `<div class="galaxy-map-situation is-invasion" style="--ruler-accent:${(ist && ist.accent) || '#ff4a3a'}">` +
                `<span class="galaxy-map-situation-kind">${inv.ally ? 'ALLY UNDER ATTACK' : 'INVASION'}</span>` +
                `<span class="galaxy-map-situation-row"><span class="galaxy-map-situation-emblem">${emblemOf(inv.attacker, 14)}</span>` +
                `<span class="galaxy-map-situation-title">${esc(String(inv.attacker).toUpperCase())} ATTACKS ${esc(iplanet)}</span></span>` +
                `<span class="galaxy-map-situation-sub">${inv.ally
                    ? 'DEFEND YOUR ' + esc(String(inv.defender).toUpperCase()) + ' ALLIES · WIN A STAGE THERE'
                    : 'FLY THERE AND WIN A STAGE TO REPEL IT'}</span>` +
                `</div>`;
        }
        const m = p && p.activeMission;
        if (m && m.galaxyId === this.galaxyId) {
            const cfg = planetConfigManager.getConfig ? planetConfigManager.getConfig(m.planetId) : null;
            const planet = String((cfg && cfg.name) || m.planetId || '').toUpperCase();
            const reward = Object.keys(m.reward || {}).map((k) => m.reward[k] + ' ' + (k === 'credits' ? 'CR' : k.toUpperCase())).join(' · ');
            const fStyle = m.factionId ? styleOf(m.factionId) : null;
            const accent = (fStyle && fStyle.accent) || 'var(--color-primary)';
            return `<div class="galaxy-map-situation is-mission" style="--ruler-accent:${accent}">` +
                `<span class="galaxy-map-situation-kind">ACTIVE MISSION</span>` +
                `<span class="galaxy-map-situation-title">${esc(String(m.type || 'MISSION').toUpperCase())} · ${esc(planet)}</span>` +
                (reward ? `<span class="galaxy-map-situation-sub">REWARD ${esc(reward)}</span>` : '') +
                `</div>`;
        }
        if (c.control === 'contested' && c.rivals && c.rivals.length) {
            const map = planetConfigManager.getGalaxyMap ? (planetConfigManager.getGalaxyMap(this.galaxyId) || {}) : {};
            const front = (map.nodes || []).filter((n) => {
                const f = planetConfigManager.getPlanetFactions ? planetConfigManager.getPlanetFactions(n.planetId) : [];
                // Frontline = a planet held by an invading rival.
                return f && f.length && c.rivals.indexOf(f[0]) !== -1;
            }).length;
            const rivalStyle = styleOf(c.rivals[0]);
            const accent = (rivalStyle && rivalStyle.accent) || 'var(--color-primary)';
            const emblems = c.rivals.map((f) => `<span class="galaxy-map-situation-emblem" title="${esc(String(f).toUpperCase())}">${emblemOf(f, 14)}</span>`).join('');
            return `<div class="galaxy-map-situation is-conflict" style="--ruler-accent:${accent}">` +
                `<span class="galaxy-map-situation-kind">CONFLICT</span>` +
                `<span class="galaxy-map-situation-row">${emblems}` +
                `<span class="galaxy-map-situation-title">${esc(c.rivals.map((f) => String(f).toUpperCase()).join(' · '))} INVASION</span></span>` +
                `<span class="galaxy-map-situation-sub">${front ? front + ' FRONTLINE PLANET' + (front === 1 ? '' : 'S') : 'RAIDS ON THE BORDER'}</span>` +
                `</div>`;
        }
        return `<div class="galaxy-map-situation is-calm">` +
            `<span class="galaxy-map-situation-kind">NO ACTIVE MISSION</span>` +
            `<span class="galaxy-map-situation-sub">TAKE ONE AT THE HANGAR MISSION BOARD</span>` +
            `</div>`;
    }

    /** Atmosphere haze tone baked into a planet SVG (palette atmoHaze, alpha 66); '' for stations / no atmosphere. */
    planetAtmoColor(iconHtml) {
        const m = /fill="(#[0-9a-f]{6})66"/i.exec(iconHtml || '');
        return m ? m[1] : '';
    }

    planetIconHtml(planetId, size, asImage, lightDir) {
        const sid = String(planetId || 'mars').toLowerCase();
        const px = size || 48;
        if (typeof planetSVGManager !== 'undefined') {
            if (!planetSVGManager.planets || !Object.keys(planetSVGManager.planets).length) {
                planetSVGManager.init();
            }
            // Large views get a finer grid instead of an upscaled icon.
            // Map nodes follow the zoom (shared with the ship, getMapDetail);
            // big views (sector card) always get a fine grid.
            const zoomDetail = this.getMapDetail ? this.getMapDetail() : 1;
            const detail = px >= 160 ? Math.max(4, zoomDetail) : (px >= 80 ? Math.max(2, zoomDetail) : zoomDetail);
            // Current rotation frame, so zoom re-renders don't jump.
            const spinModel = planetSVGManager.getPlanetSpinModel ? planetSVGManager.getPlanetSpinModel(sid, detail, lightDir) : null;
            const spinFrame = spinModel ? planetSVGManager.getPlanetSpinIndex(sid, spinModel) : null;
            let svg = spinModel ? planetSVGManager.getPlanetSpinFrame(spinModel, spinFrame) : planetSVGManager.getPlanetSVGDetailed
                ? planetSVGManager.getPlanetSVGDetailed(sid, detail)
                : planetSVGManager.getPlanetSVG(sid);
            if (svg && asImage && planetSVGManager.planetSvgToImg) {
                // Map nodes: an <img> is rasterised once and just scaled while
                // zooming — inline SVG with thousands of rects repainted every frame.
                let conv;
                if (spinModel) {
                    spinModel.frameUrls = spinModel.frameUrls || {};
                    spinModel.frameScale = spinModel.frameScale || null;
                    if (!spinModel.frameUrls[spinFrame]) {
                        conv = planetSVGManager.planetSvgToImg(svg);
                        spinModel.frameUrls[spinFrame] = conv.url;
                        spinModel.frameScale = conv.scale;
                    }
                    conv = { url: spinModel.frameUrls[spinFrame], scale: spinModel.frameScale || planetSVGManager.planetSvgToImg(svg).scale };
                } else {
                    conv = planetSVGManager.planetSvgToImg(svg);
                }
                const big = px * conv.scale;
                const off = -(big - px) / 2;
                if (planetSVGManager.startPlanetSpin) planetSVGManager.startPlanetSpin();
                return `<span class="gm-planet-icon gm-planet-icon-img" data-planet-spin="${sid}|${detail}${lightDir == null ? '' : '|' + lightDir}"${spinModel ? ` data-spin-frame="${spinFrame}"` : ''}>` +
                    `<img class="gm-planet-img" src="${conv.url}" alt="" draggable="false" style="width:${big}px;height:${big}px;left:${off}px;top:${off}px"></span>`;
            }
            if (svg) {
                const uid = 'gm_' + sid + '_' + Math.random().toString(36).slice(2, 7);
                svg = svg
                    .replace(/id="([^"]+)"/g, (m, id) => `id="${uid}_${id}"`)
                    .replace(/url\(#([^)]+)\)/g, (m, id) => `url(#${uid}_${id})`)
                    .replace(/width="[^"]*"/, `width="${px}"`)
                    .replace(/height="[^"]*"/, `height="${px}"`);
                // Slow axial rotation (planet-svgs/spin-frames.js).
                if (planetSVGManager.startPlanetSpin) planetSVGManager.startPlanetSpin();
                return `<span class="gm-planet-icon" data-planet-spin="${sid}|${detail}${lightDir == null ? '' : '|' + lightDir}"${spinModel ? ` data-spin-frame="${spinFrame}"` : ''}>${svg}</span>`;
            }
        }
        return `<span class="gm-planet-fallback" style="width:${px}px;height:${px}px">${sid.charAt(0).toUpperCase()}</span>`;
    }
}
