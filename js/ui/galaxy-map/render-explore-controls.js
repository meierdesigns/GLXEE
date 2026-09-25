"use strict";

// GalaxyMapManager methods, split from galaxy-map.js.
extendClass(GalaxyMapManager, {
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
    },

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
    },

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
    },

    setHoveredPlanet(planetId) {
        const next = planetId || null;
        if (this.hoveredPlanetId === next) return;
        this.hoveredPlanetId = next;
        this.syncNodeHighlight();
    },

    syncNodeHighlight() {
        if (!this.overlay) return;
        this.overlay.querySelectorAll('.gm-node').forEach(node => {
            const pid = node.getAttribute('data-planet');
            node.classList.toggle('selected', pid === this.selectedPlanetId);
            node.classList.toggle('hovered', pid === this.hoveredPlanetId);
        });
    },

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
    },

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
    },
});
