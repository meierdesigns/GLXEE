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
            if (Number.isFinite(saved) && saved > 0) zoom = Math.max(0.35, Math.min(12, saved));
        } catch (e) {}
        Object.defineProperty(this, 'mapZoom', {
            configurable: true,
            enumerable: true,
            get: () => zoom,
            set: (v) => {
                if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) return;
                zoom = Math.max(0.35, Math.min(12, v));
                clearTimeout(this._zoomSaveTimer);
                this._zoomSaveTimer = setTimeout(() => {
                    try { localStorage.setItem(zoomStorageKey, String(zoom)); } catch (e) {}
                    this.saveGalaxyView();
                }, 300);
            }
        });
        this.mapPan = null;
    }
    /** Per-galaxy camera (zoom + pan) kept in localStorage so every galaxy reopens as it was left. */
    saveGalaxyView() {
        if (!this.galaxyId) return;
        try {
            const all = JSON.parse(localStorage.getItem('vf.galaxyMapViewV1') || '{}') || {};
            all[this.galaxyId] = {
                z: this.mapZoom,
                a: this._panAnchor ? { x: this._panAnchor.x, y: this._panAnchor.y } : null,
                p: this.mapPan ? { x: this.mapPan.x, y: this.mapPan.y } : null
            };
            localStorage.setItem('vf.galaxyMapViewV1', JSON.stringify(all));
        } catch (e) {}
    }
    /** Last selected planet / station per galaxy, so a refresh or a return from a mission reopens on it. */
    saveGalaxySelection() {
        if (!this.galaxyId || !this.selectedPlanetId) return;
        try {
            const all = JSON.parse(localStorage.getItem('vf.galaxySelV1') || '{}') || {};
            all[this.galaxyId] = { p: this.selectedPlanetId, s: this.selectedPostId || null };
            localStorage.setItem('vf.galaxySelV1', JSON.stringify(all));
        } catch (e) {}
    }
    restoreGalaxySelection() {
        try {
            const all = JSON.parse(localStorage.getItem('vf.galaxySelV1') || '{}') || {};
            const v = all[this.galaxyId];
            if (!v || !this.nodeById[v.p] || !this.isUnlocked(v.p)) return;
            this.selectedPlanetId = v.p;
            this._picked = true;
            if (v.s) {
                const post = (this.getTradingPosts() || []).find((q) => q.id === v.s);
                if (post && post.planetId === v.p) this.selectedPostId = post.id;
            }
        } catch (e) {}
    }
    restoreGalaxyView() {
        this._panAnchor = null;
        this.mapPan = null;
        try {
            const all = JSON.parse(localStorage.getItem('vf.galaxyMapViewV1') || '{}') || {};
            const v = all[this.galaxyId];
            if (!v || !Number.isFinite(v.z)) return;
            this.mapZoom = v.z;
            if (v.a && Number.isFinite(v.a.x) && Number.isFinite(v.a.y)) this._panAnchor = { x: v.a.x, y: v.a.y };
            if (v.p && Number.isFinite(v.p.x) && Number.isFinite(v.p.y)) this.mapPan = { x: v.p.x, y: v.p.y };
        } catch (e) {}
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
        const reuse = !!(this._mountEl && this.overlay && this._parkedGalaxyId === this.galaxyId);
        // Parked map already has live zoom/pan — restoreGalaxyView from LS fought it and forced art swaps.
        if (!reuse) this.restoreGalaxyView();
        else this._reuseQuietUntil = performance.now() + 250;
        if (!reuse
            && typeof planetConfigManager !== 'undefined'
            && planetConfigManager.ensureGalaxyArrivalContent
            && typeof profileManager !== 'undefined'
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
        // Reuse keeps selection/camera; loadMap() would reset selectedPlanetId.
        if (!reuse) this.loadMap();
        this.createUI();
        if (this.startOrbitLoop) this.startOrbitLoop();
        // Open with the route to the selected planet centred (animated).
        // Skip camera tween when reusing a parked map — it already frames the selection.
        if (!reuse) {
            requestAnimationFrame(() => { if (this.isVisible && this.frameSelectionCamera) this.frameSelectionCamera('follow'); });
        }
        if (typeof menuStateManager !== 'undefined' && !this._mountEl) {
            menuStateManager.setScreen('galaxyMap');
        }
    }
    hide() {
        if (this.isVisible) this.saveGalaxyView();
        const wasEmbedded = !!(this._mountEl && this.overlay && this.overlay.classList.contains('galaxy-map-embedded'));
        this.isVisible = false;
        this._inputActive = false;
        this.hoveredPlanetId = null;
        this.onEscape = null;
        if (this._keyHandler) {
            document.removeEventListener('keydown', this._keyHandler);
            this._keyHandler = null;
        }
        if (this._orbitTimer) {
            try { clearInterval(this._orbitTimer); } catch (e) { /* */ }
            this._orbitTimer = null;
        }
        if (this.overlay) {
            // Embedded PLAY map: park DOM for reuse (H9 — hide+show was a full SVG rebuild).
            if (wasEmbedded) {
                this._parkedGalaxyId = this.galaxyId;
                // Cancel pending art swaps + size observers (detach → 0×0 RO fired apply/swap).
                clearTimeout(this._detailTimer);
                clearTimeout(this._lineTimer);
                clearTimeout(this._nebTimer);
                clearTimeout(this._nebPanTimer);
                clearTimeout(this._snapTimer);
                if (this._mapAreaRO) {
                    try { this._mapAreaRO.disconnect(); } catch (e) { /* */ }
                    this._mapAreaRO = null;
                }
                this.overlay.remove();
            } else {
                this.overlay.remove();
                this.overlay = null;
                this._parkedGalaxyId = null;
                this._pxLatticeSeated = false;
                if (this._mapAreaRO) {
                    try { this._mapAreaRO.disconnect(); } catch (e) { /* */ }
                    this._mapAreaRO = null;
                }
            }
        }
        this._mountEl = null;
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
        this.restoreGalaxySelection();
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
     * Returns { done, next, total, boss } or null for invalid planets;
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
        const stages = this.getStagesPerPlanet(pid);
        const total = stages + 1;
        if (cleared) return { done: total, next: total, total, boss: false };
        if (highest >= stages) return { done: stages, next: total, total, boss: true };
        return { done: highest, next: highest + 1, total, boss: false };
    }
    getPlanetStageProgressLabel(planetId) {
        const p = this.getPlanetStageProgress(planetId);
        if (!p) return '';
        return p.boss ? `BOSS/${p.total}` : `${p.next}/${p.total}`;
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
    /** Locked-planet hint: what to clear first, with a JUMP TO button that selects that planet. */
    unlockHintHtml(info) {
        if (!info || info.unlocked) return '';
        const from = (this.map.edges || []).map((edge) => edge[0] === info.id ? edge[1] : (edge[1] === info.id ? edge[0] : null))
            .find((pid) => pid && this.isUnlocked(pid));
        if (!from) return `<span class="gm-unlock-text">CLEAR A CONNECTED PLANET TO UNLOCK</span>`;
        const name = String(this.getPlanetInfo(from).name).toUpperCase();
        const ir = typeof iconRenderer !== 'undefined' ? iconRenderer : null;
        const ico = ir && ir.imgHtml ? `<span class="gm-jump-ico">${ir.imgHtml('navRocket', 32, 'hs-pixel', null, false)}</span>` : '';
        return `<span class="gm-unlock-text">CLEAR <b>${name}</b> TO UNLOCK</span>` +
            `<button type="button" class="action-button gm-unlock-jump" data-gm-jump="${from}" data-nav-item>${ico}<span>JUMP TO ${name}</span></button>`;
    }
    /** JUMP TO buttons in the unlock hint (delegated, bound once). */
    bindUnlockJump() {
        if (this._unlockJumpBound) return;
        this._unlockJumpBound = true;
        document.addEventListener('click', (e) => {
            const el = e.target && e.target.closest && e.target.closest('[data-gm-jump]');
            if (!el || !this.overlay || !this.overlay.contains(el)) return;
            e.preventDefault();
            e.stopPropagation();
            this.selectPlanet(el.getAttribute('data-gm-jump'));
            if (this.frameSelectionCamera) this.frameSelectionCamera('follow');
        }, true);
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
            if (stepper && !this.selectedPostId && !this.selectedBorder) stepper.innerHTML = this.planetStagesHtml(pid);
            // Start button follows the pick.
            if (this.syncConfirmButton) this.syncConfirmButton();
        }, true);
    }
    /** Click a cleared stage in the stepper: start the mission again from that stage. */
    bindReplayPicks() {
        if (this._replayBound) return;
        this._replayBound = true;
        document.addEventListener('click', (e) => {
            const el = e.target && e.target.closest && e.target.closest('.gm-sector-stage[data-replay-stage]');
            if (!el || this.isDevMode()) return;
            e.preventDefault();
            e.stopPropagation();
            const pid = el.getAttribute('data-replay-planet');
            const i = Number(el.getAttribute('data-replay-stage')) || 1;
            if (!this.isShipAt || !this.isShipAt('planet', pid)) return;
            this._replayLevelId = i > this.getStagesPerPlanet(pid) ? `${pid}-boss` : `${pid}-${i}`;
            this.confirm('start');
        }, true);
    }
    planetStagesHtml(planetId) {
        this.bindDevStagePicks();
        this.bindReplayPicks();
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
        const canReplay = !!(this.isShipAt && this.isShipAt('planet', pid));
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
            } else if (!isBoss && typeof isTransitStage === 'function' && isTransitStage(pid, i)) {
                // Transit stage: arrow flying up between two gate walls.
                inner = '<svg viewBox="0 0 9 9" shape-rendering="crispEdges"><path class="gm-stage-open" d="M4 0h1v1h1v1h1v1H2V2h1V1h1zM4 3h1v3H4zM0 7h3v2H0zM6 7h3v2H6z"/></svg>';
            } else {
                // Open stage: pixel target / crosshair.
                inner = '<svg viewBox="0 0 9 9" shape-rendering="crispEdges"><path class="gm-stage-open" d="M3 0h3v1H3zM0 3h1v3H0zM8 3h1v3H8zM3 8h3v1H3zM1 1h2v1H2v1H1zM6 1h2v2H7V2H6zM1 6h1v1h1v1H1zM7 6h1v2H6V7h1zM4 2h1v2h2v1H5v2H4V5H2V4h2z"/></svg>';
            }
            // Player ship hovers above the stage it fights next.
            if (here && ship) inner += `<img src="${ship}" alt="" class="gm-stage-ship">`;
            const tag = isBoss ? 'BOSS' : String(i);
            html += `<span class="gm-sector-stage${done ? ' is-done' : ''}${here ? ' is-current' : ''}${isBoss ? ' is-boss' : ''}${dev ? ' is-dev-pick' : ''}${!dev && done && canReplay ? ' is-replay' : ''}"` +
                (dev ? ` data-dev-stage="${i}" data-dev-planet="${pid}"` : '') +
                (!dev && done && canReplay ? ` data-replay-stage="${i}" data-replay-planet="${pid}"` : '') +
                ` title="${isBoss ? 'BOSS' : (typeof isTransitStage === 'function' && isTransitStage(pid, i) ? 'TRANSIT ' : 'STAGE ') + i} ${i}/${total}${done ? ' · CLEARED' : ''}${dev ? ' · DEV: CLICK TO PLAY' : ''}${!dev && done && canReplay ? ' · CLICK TO PLAY AGAIN' : ''}">` +
                `${inner}<span class="gm-stage-tag">${tag}</span></span>`;
            // Connector to the next step: solid once walked, dashed ahead.
            if (i < total) html += `<span class="gm-stage-link${cleared || i + 1 <= current ? ' is-walked' : ''}"></span>`;
        }
        return html;
    }
}
