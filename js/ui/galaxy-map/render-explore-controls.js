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
            const selected = !this.selectedPostId && n.planetId === this.selectedPlanetId;
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
                    ${this.selectionFrameSvg(frame, 12, 3)}
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

        let postsHtml = '';
        this.getTradingPosts().forEach(post => {
            const x = pad + post.x * (W - pad * 2);
            const y = pad + post.y * (H - pad * 2);
            const open = profileManager.isTradingPostUnlocked(post);
            const anchor = this.getPlanetInfo(post.planetId);
            const hint = open ? 'DOUBLE-CLICK TO FLY THERE / DOCK' : 'REACH ' + profileManager.getTradingPostUnlockLabel(post) + ' TO UNLOCK';
            postsHtml += `
                <g class="gm-post-node ${open ? 'open' : 'closed'} ${post.id === this.selectedPostId ? 'selected' : ''}" data-post="${post.id}" transform="translate(${x},${y})">
                    <rect class="gm-post-hit" x="-16" y="-16" width="32" height="32"/>
                    ${this.selectionFrameSvg(17, 7, 2)}
                    <title>${post.name} TRADING POST · ${hint}</title>
                    <g transform="scale(1.1)">${this.stationPixelsSvg(post)}</g>
                </g>
            `;
        });

        // Player ship marker at its current location (planet or post).
        let shipHtml = '';
        const loc = (typeof profileManager !== 'undefined' && profileManager.getShipLocation)
            ? profileManager.getShipLocation(this.galaxyId)
            : null;
        const at = loc && (loc.kind === 'post'
            ? this.getTradingPosts().find(p => p.id === loc.id)
            : this.nodeById[loc.id]);
        if (at) {
            const x = pad + at.x * (W - pad * 2);
            const y = pad + at.y * (H - pad * 2);
            // Ship icon orbiting the location (SMIL rotate around the node).
            const r = loc.kind === 'post' ? 18 : 32;
            const icon = this.getShipIconUrl();
            const shipSvg = icon
                ? `<image href="${icon}" x="-5.5" y="-7.5" width="11" height="15" class="gm-ship-marker-img" transform="rotate(180)"/>`
                : '<path d="M0 7 L6 -6 L0 -3 L-6 -6 Z" class="gm-ship-marker-body"/>';
            shipHtml = `
                <g class="gm-ship-marker" transform="translate(${x},${y})">
                    <title>YOUR SHIP</title>
                    <circle r="${r}" class="gm-ship-orbit-ring"/>
                    <g>
                        <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="9s" repeatCount="indefinite"/>
                        <g transform="translate(${r},0)">
                            <g>
                                <animateTransform attributeName="transform" type="translate" values="0 0; 1.5 0; 0 0; -1 0; 0 0" dur="1.6s" repeatCount="indefinite"/>
                                ${shipSvg}
                            </g>
                        </g>
                    </g>
                </g>
            `;
        }

        return `
            <svg class="galaxy-map-svg" viewBox="${this.getMapViewBox(W, H, pad).join(' ')}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
                ${edgesHtml}
                <g class="gm-route-layer">${this.routePreviewSvg ? this.routePreviewSvg() : ''}</g>
                ${nodesHtml}
                ${postsHtml}
                ${shipHtml}
            </svg>
        `;
    },

    /** Player's active ship rendered once to a small PNG data URL (cached per model). */
    getShipIconUrl() {
        const model = this.getActiveShipModel && this.getActiveShipModel();
        if (!model || typeof shipRenderer === 'undefined' || !shipRenderer.renderShipPreview) return null;
        const key = (model.id || model.name || 'ship') + '|' + (model.layout ? JSON.stringify(model.layout).length : 0);
        if (this._shipIconKey === key && this._shipIconUrl) return this._shipIconUrl;
        try {
            const c = document.createElement('canvas');
            // Tiny render → coarse voxels when scaled up pixelated on the map.
            c.width = 11;
            c.height = 15;
            shipRenderer.renderShipPreview(c, model, 1);
            this._shipIconUrl = c.toDataURL();
            // Only cache once ship art is loaded; before that it's a placeholder.
            const ready = typeof spriteLoader === 'undefined' || spriteLoader.loaded;
            this._shipIconKey = ready ? key : null;
        } catch (e) {
            this._shipIconUrl = null;
        }
        return this._shipIconUrl;
    },

    /** Faction whose look the map cursor takes (the galaxy's main faction). */
    getCursorFaction() {
        if (typeof planetConfigManager === 'undefined' || !planetConfigManager.getGalaxyFaction) return 'terran';
        return String(planetConfigManager.getGalaxyFaction(this.galaxyId) || 'terran').toLowerCase();
    },

    /**
     * Selection cursor around a map node, styled per faction. f = half size,
     * L = arm length, t = stroke thickness. Terran: square brackets; Kronax:
     * heavy chevrons; Machine: pixel ticks; Pirate: jagged hooks; Voidborn:
     * organic curling tendrils that breathe instead of snapping.
     */
    selectionFrameSvg(f, L, t) {
        const faction = this.getCursorFaction();
        const corners = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
        let body = '';
        corners.forEach(([sx, sy]) => {
            const x = sx * f;
            const y = sy * f;
            const ix = -sx; // points inward
            const iy = -sy;
            switch (faction) {
                case 'voidborn': {
                    // Curling tendril: bulb at the corner, two tapering curves.
                    const c = L * 1.1;
                    body += `<path class="gm-corner-organic" d="M${x + ix * c} ${y + iy} ` +
                        `Q${x + ix * c * 0.35} ${y - iy * 2.5} ${x} ${y} ` +
                        `Q${x - ix * 2.5} ${y + iy * c * 0.35} ${x + ix} ${y + iy * c}"/>`;
                    body += `<circle class="gm-corner" cx="${x + ix * 0.5}" cy="${y + iy * 0.5}" r="${t * 0.9}"/>`;
                    body += `<circle class="gm-corner" cx="${x + ix * c * 0.72}" cy="${y + iy * c * 0.2}" r="${t * 0.45}"/>`;
                    break;
                }
                case 'kronax': {
                    const k = t * 1.6;
                    body += `<path class="gm-corner" d="M${x} ${y} L${x + ix * L} ${y} L${x + ix * (L - k)} ${y + iy * k} ` +
                        `L${x + ix * k} ${y + iy * k} L${x + ix * k} ${y + iy * (L - k)} L${x} ${y + iy * L} Z"/>`;
                    break;
                }
                case 'machine':
                    for (let i = 0; i < 3; i++) {
                        const d = i * (t + 1.5);
                        const ox = ix < 0 ? t : 0;
                        const oy = iy < 0 ? t : 0;
                        body += `<rect class="gm-corner" x="${x + ix * d - ox}" y="${y - oy}" width="${t}" height="${t}"/>`;
                        if (i) body += `<rect class="gm-corner" x="${x - ox}" y="${y + iy * d - oy}" width="${t}" height="${t}"/>`;
                    }
                    break;
                case 'pirate':
                    body += `<path class="gm-corner-stroke" d="M${x + ix * L} ${y + iy * t} L${x + ix * L * 0.55} ${y} L${x} ${y} ` +
                        `L${x} ${y + iy * L * 0.6} L${x + ix * t} ${y + iy * L}"/>`;
                    break;
                default:
                    body += `<rect class="gm-corner" x="${Math.min(x, x + ix * L)}" y="${Math.min(y, y + iy * t)}" width="${L}" height="${t}"/>`;
                    body += `<rect class="gm-corner" x="${Math.min(x, x + ix * t)}" y="${Math.min(y, y + iy * L)}" width="${t}" height="${L}"/>`;
            }
        });
        return `<g class="gm-selection-frame gm-cursor-${faction}" style="--cursor-t:${t}px">${body}</g>`;
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

    /**
     * Visible map window: fits planets and posts snugly (zoomed in), then
     * applies the player's wheel zoom / drag pan kept in this.mapZoom/mapPan.
     */
    getMapViewBox(W, H, pad) {
        const pts = (this.map.nodes || []).concat(this.getTradingPosts())
            .map(n => [pad + n.x * (W - pad * 2), pad + n.y * (H - pad * 2)]);
        let x0 = 0, y0 = 0, x1 = W, y1 = H;
        if (pts.length) {
            const m = 44;
            x0 = Math.min(...pts.map(p => p[0])) - m;
            x1 = Math.max(...pts.map(p => p[0])) + m;
            y0 = Math.min(...pts.map(p => p[1])) - m;
            y1 = Math.max(...pts.map(p => p[1])) + m;
        }
        // Keep the map's aspect so meet-scaling fills the area.
        const aspect = W / H;
        let w = x1 - x0, h = y1 - y0;
        if (w / h < aspect) w = h * aspect; else h = w / aspect;
        const cx = (x0 + x1) / 2 + (this.mapPan ? this.mapPan.x : 0);
        const cy = (y0 + y1) / 2 + (this.mapPan ? this.mapPan.y : 0);
        const z = this.mapZoom || 1;
        w /= z;
        h /= z;
        return [cx - w / 2, cy - h / 2, w, h];
    },

    bindMapZoom() {
        const svg = this.overlay.querySelector('.galaxy-map-svg');
        if (!svg) return;
        const apply = () => {
            const html = this.renderMapSvg();
            const vb = /viewBox="([^"]+)"/.exec(html);
            if (vb) svg.setAttribute('viewBox', vb[1]);
        };
        svg.addEventListener('wheel', (e) => {
            e.preventDefault();
            const z = (this.mapZoom || 1) * (e.deltaY < 0 ? 1.15 : 1 / 1.15);
            this.mapZoom = Math.min(4, Math.max(1, z));
            if (this.mapZoom === 1) this.mapPan = null;
            apply();
        }, { passive: false });
        let drag = null;
        svg.addEventListener('pointerdown', (e) => {
            if ((this.mapZoom || 1) <= 1 || e.button !== 0) return;
            drag = { x: e.clientX, y: e.clientY, moved: false };
        });
        window.addEventListener('pointermove', (e) => {
            if (!drag || !svg.isConnected) return;
            const vb = svg.viewBox.baseVal;
            const rect = svg.getBoundingClientRect();
            const scale = Math.max(vb.width / rect.width, vb.height / rect.height);
            const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
            if (!drag.moved && Math.hypot(dx, dy) < 4) return;
            drag.moved = true;
            this.mapPan = this.mapPan || { x: 0, y: 0 };
            this.mapPan.x -= dx * scale;
            this.mapPan.y -= dy * scale;
            drag.x = e.clientX;
            drag.y = e.clientY;
            apply();
        });
        window.addEventListener('pointerup', () => { drag = null; });
        svg.addEventListener('dblclick', (e) => {
            if (e.target.closest('.gm-node, .gm-post-node')) return;
            this.mapZoom = 1;
            this.mapPan = null;
            apply();
        });
    },

    bindPostClicks() {
        this.overlay.querySelectorAll('.gm-post-node[data-post]').forEach(node => {
            const id = node.getAttribute('data-post');
            node.addEventListener('pointerenter', () => node.classList.add('hovered'));
            node.addEventListener('pointerleave', () => node.classList.remove('hovered'));
            node.addEventListener('click', () => this.selectPost(id));
            node.addEventListener('dblclick', () => {
                this.selectPost(id);
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

    /** Large station picture for the sector card when a post is selected. */
    postIconSvg(open, post) {
        // Not a .gm-post-node: that class is the clickable map node, and the
        // card picture must not pick up its click / hover / selection rules.
        const cls = 'gm-station-card ' + (open ? 'open' : 'closed');
        return `<svg viewBox="-13 -13 26 26" class="${cls}" shape-rendering="crispEdges">` +
            this.stationPixelsSvg(post, 4) + `</svg>`;
    },

    /**
     * Pixel-art space station on a 24×24 grid centred on 0,0. Each post gets
     * one of three fixed builds (ring hub, truss with solar wings, spindle)
     * from its id. Parts: h = hull, d = dark frame, p = solar panel,
     * l = beacon light (blinks when the post is open).
     */
    stationPixelsSvg(post, detail) {
        const id = String((post && post.id) || '');
        let hash = 0;
        for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
        const builds = [
            // Ring hub with spokes and side panels.
            [['p', -12, -3, 3, 6], ['p', 9, -3, 3, 6], ['d', -9, -1, 1, 2], ['d', 8, -1, 1, 2],
                ['h', -6, -9, 12, 2], ['h', -6, 7, 12, 2], ['h', -9, -6, 2, 12], ['h', 7, -6, 2, 12],
                ['h', -8, -8, 2, 2], ['h', 6, -8, 2, 2], ['h', -8, 6, 2, 2], ['h', 6, 6, 2, 2],
                ['d', -1, -7, 2, 4], ['d', -1, 3, 2, 4], ['d', -7, -1, 4, 2], ['d', 3, -1, 4, 2],
                ['h', -3, -3, 6, 6], ['l', -1, -1, 2, 2], ['l', -1, -10, 2, 1], ['l', -1, 9, 2, 1]],
            // Truss station: core module, long truss, four solar wings.
            [['d', -11, -1, 22, 2], ['p', -11, -6, 5, 4], ['p', -11, 2, 5, 4], ['p', 6, -6, 5, 4], ['p', 6, 2, 5, 4],
                ['d', -9, -2, 1, 4], ['d', 8, -2, 1, 4],
                ['h', -3, -5, 6, 10], ['d', -3, -1, 6, 1], ['h', -1, -10, 2, 5], ['l', -1, -11, 2, 1],
                ['h', -2, 5, 4, 2], ['h', -4, 7, 8, 2], ['l', -2, -3, 1, 1], ['l', 1, 2, 1, 1]],
            // Spindle: long spine with two habitat rings and docking pods.
            [['p', -12, -1, 7, 2], ['p', 5, -1, 7, 2], ['h', -2, -11, 4, 22],
                ['h', -6, -6, 12, 2], ['h', -6, 4, 12, 2],
                ['d', -8, -7, 2, 4], ['d', 6, -7, 2, 4], ['d', -8, 3, 2, 4], ['d', 6, 3, 2, 4],
                ['d', -2, -1, 4, 2], ['l', -1, -12, 2, 1], ['l', -1, 11, 2, 1], ['l', -8, -5, 1, 1], ['l', 7, 4, 1, 1]]
        ];
        const cls = { h: 'gm-station-hull', d: 'gm-station-dark', p: 'gm-station-panel', l: 'gm-station-light' };
        const parts = builds[hash % builds.length];
        const base = parts.map(([k, x, y, w, h]) =>
            `<rect x="${x}" y="${y}" width="${w}" height="${h}" class="${cls[k]}"/>`).join('');
        // Large card view: sub-pixel shading on top of the same silhouette
        // (lit top/left edge, shaded bottom/right edge, panel cells, windows).
        const d = Math.max(1, Math.round(detail || 1));
        let fine = '';
        if (d > 1) {
            const p = 1 / d;
            const rect = (x, y, w, h, c) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" class="${c}"/>`;
            parts.forEach(([k, x, y, w, h]) => {
                if (k === 'l') {
                    fine += rect(x + p, y + p, Math.max(p, w - 2 * p), Math.max(p, h - 2 * p), 'gm-station-glint');
                    return;
                }
                fine += rect(x, y, w, p, 'gm-station-glint') + rect(x, y, p, h, 'gm-station-glint');
                fine += rect(x, y + h - p, w, p, 'gm-station-shade') + rect(x + w - p, y, p, h, 'gm-station-shade');
                if (k === 'p') {
                    // Solar cell grid.
                    for (let gx = x + 1; gx < x + w; gx += 1) fine += rect(gx - p / 2, y, p, h, 'gm-station-shade');
                    for (let gy = y + 1; gy < y + h; gy += 1) fine += rect(x, gy - p / 2, w, p, 'gm-station-shade');
                } else if (k === 'h' && w >= 2 && h >= 2) {
                    // Window row along the long side.
                    const horiz = w >= h;
                    const len = horiz ? w : h;
                    for (let i = 1; i < len; i += 1) {
                        if ((i + x + y) % 2) continue;
                        const wx = horiz ? x + i - p / 2 : x + w / 2 - p / 2;
                        const wy = horiz ? y + h / 2 - p / 2 : y + i - p / 2;
                        fine += rect(wx, wy, p, p, 'gm-station-window');
                    }
                }
            });
        }
        return `<g class="gm-station" shape-rendering="crispEdges">` + base + fine + `</g>`;
    },

    syncNodeHighlight() {
        if (!this.overlay) return;
        this.overlay.querySelectorAll('.gm-post-node[data-post]').forEach(node => {
            node.classList.toggle('selected', node.getAttribute('data-post') === this.selectedPostId);
        });
        this.overlay.querySelectorAll('.gm-node').forEach(node => {
            const pid = node.getAttribute('data-planet');
            node.classList.toggle('selected', !this.selectedPostId && pid === this.selectedPlanetId);
            node.classList.toggle('hovered', pid === this.hoveredPlanetId);
        });
        if (this.syncRoutePreview) this.syncRoutePreview();
    },

    bindEvents() {
        if (this._keyHandler) {
            document.removeEventListener('keydown', this._keyHandler);
            this._keyHandler = null;
        }
        this.bindNodeClicks();
        this.bindPostClicks();
        this.bindMapZoom();
        if (this.selectedPostId) this.updateDetails();

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
