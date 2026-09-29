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

        const edgeGap = 2;
        const mapSpread = 2.0;
        const planetRadius = (planetId) => {
            const seed = String(planetId || '').split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
            return (32 + (seed % 7) * 10) / 2;
        };
        let edgesHtml = '';
        edges.forEach(edge => {
            const a = this.nodeById[edge[0]];
            const b = this.nodeById[edge[1]];
            if (!a || !b) return;
            const ax = W / 2 + (a.x - 0.5) * (W - pad * 2) * mapSpread;
            const ay = H / 2 + (a.y - 0.5) * (H - pad * 2) * mapSpread;
            const bx = W / 2 + (b.x - 0.5) * (W - pad * 2) * mapSpread;
            const by = H / 2 + (b.y - 0.5) * (H - pad * 2) * mapSpread;
            const dx = bx - ax;
            const dy = by - ay;
            const dist = Math.hypot(dx, dy);
            if (dist < planetRadius(a.planetId) + planetRadius(b.planetId) + edgeGap * 2) return;
            const ux = dx / dist;
            const uy = dy / dist;
            const insetA = planetRadius(a.planetId) + edgeGap;
            const insetB = planetRadius(b.planetId) + edgeGap;
            const x1 = ax + ux * insetA;
            const y1 = ay + uy * insetA;
            const x2 = bx - ux * insetB;
            const y2 = by - uy * insetB;
            // Only paths between two reachable planets read as active.
            const lit = this.isUnlocked(edge[0]) && this.isUnlocked(edge[1]);
            edgesHtml += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="gm-edge ${lit ? 'lit' : 'dim'}"/>`;
        });

        // Ruling faction's base planet (faction-holdings.js).
        const holdings = (typeof profileManager !== 'undefined' && profileManager.getFactionHoldings)
            ? profileManager.getFactionHoldings(this.galaxyId) : null;
        // Hidden until the base planet is reachable.
        const baseId = holdings && !holdings.baseLost && profileManager.isHoldingBaseRevealed(this.galaxyId)
            ? holdings.base : null;
        const rulerStyle = holdings && typeof factionShipStyles !== 'undefined' && factionShipStyles.getFactionStyle
            ? factionShipStyles.getFactionStyle(holdings.ruler) : null;
        const rulerAccent = (rulerStyle && rulerStyle.accent) || 'var(--color-primary)';
        let nodesHtml = '';
        nodes.forEach(n => {
            const x = W / 2 + (n.x - 0.5) * (W - pad * 2) * mapSpread;
            const y = H / 2 + (n.y - 0.5) * (H - pad * 2) * mapSpread;
            const unlocked = this.isUnlocked(n.planetId);
            const cleared = this.isCleared(n.planetId);
            const selected = !this.selectedPostId && n.planetId === this.selectedPlanetId;
            const hovered = n.planetId === this.hoveredPlanetId;
            const stageProgress = this.getPlanetStageProgressLabel(n.planetId);
            const sizeSeed = String(n.planetId || '').split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
            const size = 32 + (sizeSeed % 7) * 10;
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
                    <title>${unlocked ? String(n.planetId).toUpperCase() : 'LOCKED · COMPLETE A CONNECTED PLANET TO UNLOCK'}</title>
                    ${this.selectionFrameSvg(frame, 12, 3)}
                    <foreignObject x="${-size / 2}" y="${-size / 2}" width="${size}" height="${size}">
                        <div xmlns="http://www.w3.org/1999/xhtml" class="gm-node-icon-wrap ${unlocked ? '' : 'dimmed'}">
                            ${this.planetIconHtml(n.planetId, size)}
                        </div>
                    </foreignObject>
                    ${cleared ? `
                        <g class="gm-cleared-badge" transform="translate(${size / 2 - 2},${-size / 2 + 2})">
                            <circle cx="0" cy="0" r="8" class="gm-cleared-badge-bg"/>
                            <path class="gm-cleared-check" d="M-3.5 0 L-1 2.5 L3.5 -2.5" fill="none"/>
                        </g>
                    ` : ''}
                    ${this.planetFactionsSvg(n.planetId, size)}
                    ${this.invasionMarkerSvg ? this.invasionMarkerSvg(n.planetId, size) : ''}
                    ${n.planetId === baseId ? `
                        <g class="gm-base-marker" style="--fac:${rulerAccent}">
                            <title>${String(holdings.ruler).toUpperCase()} BASE${holdings.stations.length ? ' · DESTROY ITS STATIONS TO ASSAULT IT' : ' · OPEN TO ASSAULT'}</title>
                            <g class="gm-base-graphic" transform="translate(0 2) scale(.7)">
                                <rect class="gm-base-outline" x="-11" y="-10" width="22" height="16"/>
                                <rect x="-9" y="-5" width="18" height="10"/>
                                <rect x="-6" y="-8" width="3" height="3"/>
                                <rect x="3" y="-8" width="3" height="3"/>
                                <rect class="gm-base-core" x="-2" y="-2" width="4" height="4"/>
                            </g>
                        </g>
                    ` : ''}
                    ${stageProgress ? `
                        <text class="gm-stage-progress" x="0" y="${size / 2 + 12}">${stageProgress}</text>
                    ` : ''}
                    ${!unlocked ? `
                        <text class="gm-locked-label" x="0" y="${size / 2 + 14}">LOCKED</text>
                    ` : ''}
                </g>
            `;
        });

        let postsHtml = '';
        this.getTradingPosts().forEach(post => {
            const x = W / 2 + (post.x - 0.5) * (W - pad * 2) * mapSpread;
            const y = H / 2 + (post.y - 0.5) * (H - pad * 2) * mapSpread;
            const open = profileManager.isTradingPostUnlocked(post);
            const anchor = this.getPlanetInfo(post.planetId);
            const hint = open ? 'DOUBLE-CLICK TO FLY THERE / DOCK' : 'REACH ' + profileManager.getTradingPostUnlockLabel(post) + ' TO UNLOCK';
            postsHtml += `
                <g class="gm-post-node ${open ? 'open' : 'closed'} ${post.id === this.selectedPostId ? 'selected' : ''}${post.factionStation ? ' is-faction' : ''}" data-post="${post.id}" transform="translate(${x},${y})"${post.factionStation ? ` style="--fac:${((typeof factionShipStyles !== 'undefined' && factionShipStyles.getFactionStyle && factionShipStyles.getFactionStyle(post.faction)) || {}).accent || 'var(--color-primary)'}"` : ''}>
                    <rect class="gm-post-hit" x="-16" y="-16" width="32" height="32"/>
                    ${this.selectionFrameSvg(17, 7, 2)}
                    <title>${post.name}${post.factionStation ? ' · FACTION STATION' : ' TRADING POST'} · ${hint}</title>
                    ${post.factionStation ? '<rect class="gm-faction-station-ring" x="-14" y="-14" width="28" height="28"/>' : ''}
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
            const x = W / 2 + (at.x - 0.5) * (W - pad * 2) * mapSpread;
            const y = H / 2 + (at.y - 0.5) * (H - pad * 2) * mapSpread;
            // Ship centred on the location, nose down, gently hovering up and
            // down instead of orbiting.
            const r = loc.kind === 'post' ? 18 : 32;
            const icon = this.getShipIconUrl();
            // Sized to the ring: ~22×30 on a planet, smaller on a trading post.
            // Whole-pixel magnification of the 13×17 icon, so every pixel is the same size.
            const px = Math.max(1, Math.round(r * 0.7 / 13));
            const sw = 13 * px;
            const sh = 17 * px;
            const k = sw / 11;
            const shipSvg = icon
                ? `<image href="${icon}" x="${-Math.round(sw / 2)}" y="${-Math.round(sh / 2)}" width="${sw}" height="${sh}" class="gm-ship-marker-img" transform="rotate(180)"/>`
                : `<path d="M0 7 L6 -6 L0 -3 L-6 -6 Z" class="gm-ship-marker-body" transform="scale(${k})"/>`;
            const view = this.getMapViewBox(W, H, pad);
            const centered = Math.hypot(
                x - (view[0] + view[2] / 2),
                y - (view[1] + view[3] / 2)
            ) < Math.min(view[2], view[3]) * 0.12;
            const showShipLabel = (this.mapZoom || 1) < 1.1 &&
                !centered &&
                this._shipLabelReady;
            shipHtml = `
                <g class="gm-ship-marker" transform="translate(${x},${y})">
                    <title>YOUR SHIP</title>
                    ${showShipLabel ? `<text class="gm-ship-location-label" x="0" y="${-r - 8}">YOU ARE HERE</text>` : ''}
                    <g>
                        <animateTransform attributeName="transform" type="translate" values="0 0; 0 -2; 0 0; 0 2; 0 0" dur="2.4s" repeatCount="indefinite"/>
                        ${shipSvg}
                    </g>
                </g>
            `;
        }

        return `
            <svg class="galaxy-map-svg" viewBox="${this.getMapViewBox(W, H, pad).join(' ')}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
                ${this.galaxyStarsSvg ? this.galaxyStarsSvg(W, H) : ''}
                ${this.galaxySunsSvg ? this.galaxySunsSvg(W, H, pad) : ''}
                ${edgesHtml}
                ${this.postLanesSvg ? this.postLanesSvg() : ''}
                ${nodesHtml}
                ${postsHtml}
                <g class="gm-route-layer">${this.routePreviewSvg ? this.routePreviewSvg() : ''}</g>
                ${shipHtml}
            </svg>
        `;
    },

    /**
     * Black space + seeded pixel starfield behind the map (a few stars twinkle).
     * Oversized so it still fills the view when the map is zoomed / panned.
     */
    galaxyStarsSvg(W, H) {
        let rnd = 0;
        const gid = String(this.galaxyId || '');
        for (let i = 0; i < gid.length; i++) rnd = (Math.imul(rnd, 31) + gid.charCodeAt(i)) >>> 0;
        rnd = rnd || 1;
        const next = () => {
            rnd = (Math.imul(rnd, 1664525) + 1013904223) >>> 0;
            return rnd / 4294967296;
        };
        const x0 = -W;
        const y0 = -H;
        let stars = '';
        for (let i = 0; i < 420; i++) {
            const x = Math.round(x0 + next() * W * 3);
            const y = Math.round(y0 + next() * H * 3);
            const big = next() < 0.08;
            const a = (0.25 + next() * 0.75).toFixed(2);
            const tw = next() < 0.35 ? ` class="gm-star-twinkle" style="animation-delay:${(-next() * 4).toFixed(2)}s"` : '';
            stars += `<rect x="${x}" y="${y}" width="${big ? 2 : 1}" height="${big ? 2 : 1}" opacity="${a}"${tw}/>`;
        }
        return `<g class="gm-space" aria-hidden="true">` +
            `<rect class="gm-space-bg" x="${x0}" y="${y0}" width="${W * 3}" height="${H * 3}"/>` +
            `<g class="gm-stars">${stars}</g></g>`;
    },

    /**
     * Pixel suns behind the map (planetConfigManager.getGalaxySuns): stepped
     * glow squares, a pixel disc and a bright core, gently pulsing.
     */
    galaxySunsSvg(W, H, pad) {
        if (typeof planetConfigManager === 'undefined' || !planetConfigManager.getGalaxySuns) return '';
        const suns = planetConfigManager.getGalaxySuns(this.galaxyId) || [];
        return suns.map((s, i) => {
            const sunSpread = 2.0;
            const x = Math.round(W / 2 + (s.x - 0.5) * (W - pad * 2) * sunSpread);
            const y = Math.round(H / 2 + (s.y - 0.5) * (H - pad * 2) * sunSpread);
            const r = Math.max(24, Math.round(s.r * (W - pad * 2) / 1.3));
            // Circle quantised to square pixels of size p, as row strips.
            const pixelCircle = (radius, p) => {
                let out = '';
                for (let dy = -radius; dy < radius; dy += p) {
                    const mid = dy + p / 2;
                    const half = Math.floor(Math.sqrt(Math.max(0, radius * radius - mid * mid)) / p) * p;
                    if (half > 0) out += `<rect x="${-half}" y="${dy}" width="${half * 2}" height="${p}"/>`;
                }
                return out;
            };
            // Fine pixels for the star itself (higher resolution)…
            const px = Math.max(2, Math.round(r / 14));
            // …chunky steps for the glow rings around it.
            const gp = Math.max(4, Math.round(r / 4));
            const disc = pixelCircle(r, px);
            // Limb darkening: a slightly smaller, brighter inner disc.
            const inner = pixelCircle(Math.round(r * 0.72), px);
            const core = pixelCircle(Math.round(r * 0.38), px);
            // No rays: the star itself animates (breathing body, flickering
            // surface, pulsing glow) — see .gm-sun-body in styles.css.
            const delay = `animation-delay:${(-i * 1.7).toFixed(1)}s`;
            return `
                <g class="gm-sun gm-sun-${s.kind}" transform="translate(${x},${y})" style="--sun:${s.color};--sun-glow:${s.glow}">
                    <title>${s.kind.toUpperCase()} STAR</title>
                    <g class="gm-sun-glow gm-sun-glow-outer" style="${delay}">${pixelCircle(Math.round(r * 2.6 / gp) * gp, gp)}</g>
                    <g class="gm-sun-glow gm-sun-glow-inner" style="${delay}">${pixelCircle(Math.round(r * 1.7 / gp) * gp, gp)}</g>
                    <g class="gm-sun-body" style="${delay}">
                        <g class="gm-sun-disc">${disc}</g>
                        <g class="gm-sun-inner" style="${delay}">${inner}</g>
                        <g class="gm-sun-core" style="${delay}">${core}</g>
                    </g>
                </g>`;
        }).join('');
    },

    /**
     * Lanes from each station / trading post to its anchor planet(s), routed
     * around other bodies (routePath); lit when the station is open.
     */
    postLanesSvg() {
        if (!this.routePath || typeof profileManager === 'undefined') return '';
        let out = '';
        (this.getTradingPosts() || []).forEach((post) => {
            const open = profileManager.isTradingPostUnlocked ? profileManager.isTradingPostUnlocked(post) : true;
            (post.anchors || [post.planetId]).forEach((pid) => {
                if (!this.nodeById || !this.nodeById[pid]) return;
                const pts = this.routePath({ kind: 'post', id: post.id }, { kind: 'planet', id: pid });
                if (!pts || pts.length < 2) return;
                // Start / end outside the station icon and the planet disc.
                const trim = (a, b, by) => {
                    const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
                    return { x: a.x + (b.x - a.x) / l * by, y: a.y + (b.y - a.y) / l * by };
                };
                const p = pts.slice();
                p[0] = trim(p[0], p[1], 16);
                const planetSeed = String(pid).split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
                const planetInset = (32 + (planetSeed % 7) * 10) / 2 + 2;
                p[p.length - 1] = trim(p[p.length - 1], p[p.length - 2], planetInset);
                out += `<polyline class="gm-edge gm-post-lane ${open ? 'lit' : 'dim'}" fill="none" points="${p.map((q) => q.x.toFixed(1) + ',' + q.y.toFixed(1)).join(' ')}"/>`;
            });
        });
        return out;
    },

    /** "UNDER ATTACK" marker on the planet of an active invasion (invasion-scenario.js). */
    invasionMarkerSvg(planetId, size) {
        if (typeof profileManager === 'undefined' || !profileManager.getInvadedPlanetId) return '';
        if (profileManager.getInvadedPlanetId(this.galaxyId) !== planetId) return '';
        const inv = profileManager.getActiveInvasion();
        const st = typeof factionShipStyles !== 'undefined' && factionShipStyles.getFactionStyle
            ? factionShipStyles.getFactionStyle(inv.attacker) : null;
        const accent = (st && st.accent) || '#ff4a3a';
        const emblem = typeof profileSelectionManager !== 'undefined' && profileSelectionManager.getFactionEmblemHtml
            ? profileSelectionManager.getFactionEmblemHtml(inv.attacker, 14) : '';
        const f = size / 2 + 12;
        return `<g class="gm-invasion" style="--fac:${accent}">` +
            `<title>${String(inv.attacker).toUpperCase()} INVASION · WIN A STAGE HERE TO REPEL IT</title>` +
            `<rect class="gm-invasion-ring" x="${-f}" y="${-f}" width="${f * 2}" height="${f * 2}"/>` +
            `<rect class="gm-invasion-ring gm-invasion-ring-2" x="${-f - 6}" y="${-f - 6}" width="${f * 2 + 12}" height="${f * 2 + 12}"/>` +
            `<text class="gm-invasion-label" x="0" y="${f + 14}">UNDER ATTACK</text>` +
            `<foreignObject x="${f - 10}" y="${-f - 10}" width="20" height="20">` +
            `<div xmlns="http://www.w3.org/1999/xhtml" class="gm-invasion-emblem">${emblem}</div></foreignObject>` +
            `</g>`;
    },

    /** Emblems of the factions fighting on a planet, in a row above it. */
    planetFactionsSvg(planetId, size) {
        if (typeof planetConfigManager === 'undefined' || !planetConfigManager.getPlanetFactions) return '';
        // Factions are only known on reachable planets.
        if (this.isUnlocked && !this.isUnlocked(planetId)) return '';
        const factions = planetConfigManager.getPlanetFactions(planetId);
        if (!factions.length) return '';
        if (typeof profileSelectionManager === 'undefined' || !profileSelectionManager.getFactionEmblemHtml) return '';
        // Bare faction icons — no boxes around them.
        const names = factions.map((f) =>
            `<span class="gm-node-faction-icon" title="${String(f).toUpperCase()}">${profileSelectionManager.getFactionEmblemHtml(f, 16)}</span>`
        ).join('');
        const w = 80;
        const h = 18;
        return `<foreignObject x="${-w / 2}" y="${-size / 2 - h - 8}" width="${w}" height="${h}">` +
            `<div xmlns="http://www.w3.org/1999/xhtml" class="gm-node-factions">${names}</div></foreignObject>`;
    },

    /** Player's active ship rendered once to a small PNG data URL (cached per model). */
    getShipIconUrl() {
        const model = this.getActiveShipModel && this.getActiveShipModel();
        if (!model || typeof shipRenderer === 'undefined' || !shipRenderer.renderShipPreview) return null;
        const key = (model.id || model.name || 'ship') + '|' + (model.layout ? JSON.stringify(model.layout).length : 0);
        if (this._shipIconKey === key && this._shipIconUrl) return this._shipIconUrl;
        try {
            const inner = document.createElement('canvas');
            // Tiny render → coarse voxels when scaled up pixelated on the map.
            inner.width = 11;
            inner.height = 15;
            shipRenderer.renderShipPreview(inner, model, 1);
            // 1 px dark outline, pixel-exact: every empty pixel touching the
            // ship becomes dark (a blur/dilate filter smeared it into a blob).
            const c = document.createElement('canvas');
            c.width = 13;
            c.height = 17;
            const ctx = c.getContext('2d');
            ctx.drawImage(inner, 1, 1);
            const img = ctx.getImageData(0, 0, c.width, c.height);
            const d = img.data;
            const solid = (x, y) => x >= 0 && y >= 0 && x < c.width && y < c.height && d[(y * c.width + x) * 4 + 3] > 96;
            // Hard alpha: faint anti-aliased pixels made a ragged fringe.
            for (let o = 0; o < d.length; o += 4) d[o + 3] = d[o + 3] > 96 ? 255 : 0;
            const edge = [];
            for (let y = 0; y < c.height; y++) {
                for (let x = 0; x < c.width; x++) {
                    if (solid(x, y)) continue;
                    if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) edge.push(x, y);
                }
            }
            for (let i = 0; i < edge.length; i += 2) {
                const o = (edge[i + 1] * c.width + edge[i]) * 4;
                d[o] = 5; d[o + 1] = 5; d[o + 2] = 8; d[o + 3] = 255;
            }
            ctx.putImageData(img, 0, 0);
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
                this.markUserPicked();
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
            .map(n => [
                W / 2 + (n.x - 0.5) * (W - pad * 2) * 2.0,
                H / 2 + (n.y - 0.5) * (H - pad * 2) * 2.0
            ]);
        const suns = typeof planetConfigManager !== 'undefined' && planetConfigManager.getGalaxySuns
            ? planetConfigManager.getGalaxySuns(this.galaxyId) || [] : [];
        suns.forEach((s) => {
            pts.push([
                W / 2 + (s.x - 0.5) * (W - pad * 2) * 2.0,
                H / 2 + (s.y - 0.5) * (H - pad * 2) * 2.0
            ]);
        });
        let x0 = 0, y0 = 0, x1 = W, y1 = H;
        if (pts.length) {
            // Room for the faction emblems above each planet, the stage
            // label below, and the galaxy badges in the top-right corner.
            // Keep a generous orbit around the nodes so the galaxy does not
            // look cramped when the map opens.
            x0 = Math.min(...pts.map(p => p[0])) - 150;
            x1 = Math.max(...pts.map(p => p[0])) + 190;
            y0 = Math.min(...pts.map(p => p[1])) - 140;
            y1 = Math.max(...pts.map(p => p[1])) + 120;
        }
        // Match the on-screen area's aspect so meet-scaling fills it.
        const area = this.overlay && this.overlay.querySelector('#gmMapArea');
        const aspect = area && area.clientWidth > 0 && area.clientHeight > 0
            ? area.clientWidth / area.clientHeight : W / H;
        let w = x1 - x0, h = y1 - y0;
        if (w / h < aspect) w = h * aspect; else h = w / aspect;
        let cx = (x0 + x1) / 2;
        let cy = (y0 + y1) / 2;
        if (this._panAnchor) {
            cx = this._panAnchor.x;
            cy = this._panAnchor.y;
        } else if (!this.mapPan && typeof profileManager !== 'undefined' && profileManager.getShipLocation) {
            const loc = profileManager.getShipLocation(this.galaxyId);
            const target = loc && loc.kind === 'post'
                ? this.getTradingPosts().find((p) => p.id === loc.id)
                : (loc && this.nodeById[loc.id]);
            if (target) {
                cx = W / 2 + (target.x - 0.5) * (W - pad * 2) * 2.0;
                cy = H / 2 + (target.y - 0.5) * (H - pad * 2) * 2.0;
            }
        }
        cx += this.mapPan ? this.mapPan.x : 0;
        cy += this.mapPan ? this.mapPan.y : 0;
        const z = this.mapZoom || 1;
        w /= z;
        h /= z;
        return [cx - w / 2, cy - h / 2, w, h];
    },

    bindMapZoom() {
        const svg = this.overlay.querySelector('.galaxy-map-svg');
        if (!svg) return;
        const apply = () => {
            const cur = this.overlay && this.overlay.querySelector('.galaxy-map-svg');
            if (!cur) return;
            const html = this.renderMapSvg();
            const vb = /viewBox="([^"]+)"/.exec(html);
            if (vb) cur.setAttribute('viewBox', vb[1]);
            cur.querySelectorAll('.gm-node[data-planet]').forEach((node) => {
                const pid = node.getAttribute('data-planet');
                const icon = node.querySelector('.gm-node-icon-wrap');
                if (pid && icon) icon.innerHTML = this.planetIconHtml(pid, 48);
            });
        };
        const delayShipLabel = () => {
            this._shipLabelReady = false;
            clearTimeout(this._shipLabelTimer);
            this._shipLabelTimer = setTimeout(() => {
                this._shipLabelReady = true;
                apply();
            }, 1500);
        };
        // Zoom out below the snug fit (0.35) to see the surroundings, in up to 4x.
        svg.addEventListener('wheel', (e) => {
            e.preventDefault();
            const z = (this.mapZoom || 1) * (e.deltaY < 0 ? 1.15 : 1 / 1.15);
            this.mapZoom = Math.min(4, Math.max(0.35, z));
            delayShipLabel();
            apply();
        }, { passive: false });
        // Drag pans at any zoom; a real drag swallows the click that follows
        // so releasing over a planet doesn't select it.
        svg.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            this._mapDrag = null;
            svg.classList.remove('is-panning');
            if (!this.mapPan) {
                const vb = svg.viewBox.baseVal;
                this._panAnchor = { x: vb.x + vb.width / 2, y: vb.y + vb.height / 2 };
                this.mapPan = { x: 0, y: 0 };
            }
            this._mapDrag = { x: e.clientX, y: e.clientY, moved: false, pointerId: e.pointerId };
        });
        const endDrag = (e) => {
            if (!this._mapDrag || (e.pointerId != null && e.pointerId !== this._mapDrag.pointerId)) return;
            const drag = this._mapDrag;
            this._mapDrag = null;
            if (svg.hasPointerCapture?.(drag.pointerId)) svg.releasePointerCapture(drag.pointerId);
            svg.classList.remove('is-panning');
            if (drag.moved) {
                this._mapDragSwallow = true;
                setTimeout(() => { this._mapDragSwallow = false; }, 0);
            }
        };
        svg.addEventListener('pointerup', endDrag);
        svg.addEventListener('pointercancel', endDrag);
        svg.addEventListener('click', (e) => {
            this._mapDrag = null;
            svg.classList.remove('is-panning');
            this._mapDragSwallow = false;
        }, true);
        svg.addEventListener('click', (e) => {
            if (this._mapDragSwallow) return;
            const target = e.composedPath().find((el) => el && el.classList
                && (el.classList.contains('gm-node') || el.classList.contains('gm-post-node')));
            if (!target) return;
            const pid = target.getAttribute('data-planet');
            const postId = target.getAttribute('data-post');
            this.markUserPicked();
            if (pid) this.selectPlanet(pid);
            else if (postId) this.selectPost(postId);
        });
        svg.addEventListener('dblclick', (e) => {
            if (e.target.closest('.gm-node, .gm-post-node')) return;
            this.mapZoom = 1;
            this.mapPan = null;
            this._panAnchor = null;
            apply();
        });
        // The map SVG is re-rendered often: bind the window handlers once.
        if (this._mapDragBound) return;
        this._mapDragBound = true;
        window.addEventListener('pointermove', (e) => {
            const drag = this._mapDrag;
            const cur = this.overlay && this.overlay.querySelector('.galaxy-map-svg');
            if (!drag || e.pointerId !== drag.pointerId || !cur || !cur.isConnected) return;
            const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
            if (!drag.moved && Math.hypot(dx, dy) < 4) return;
            drag.moved = true;
            cur.classList.add('is-panning');
            const vb = cur.viewBox.baseVal;
            const rect = cur.getBoundingClientRect();
            const scaleX = vb.width / Math.max(1, rect.width);
            const scaleY = vb.height / Math.max(1, rect.height);
            this.mapPan = this.mapPan || { x: 0, y: 0 };
            this.mapPan.x -= dx * scaleX;
            this.mapPan.y -= dy * scaleY;
            delayShipLabel();
            drag.x = e.clientX;
            drag.y = e.clientY;
            apply();
        });
        window.addEventListener('pointerup', () => {
            const drag = this._mapDrag;
            this._mapDrag = null;
            const cur = this.overlay && this.overlay.querySelector('.galaxy-map-svg');
            if (cur) cur.classList.remove('is-panning');
            if (drag && drag.moved) {
                this._mapDragSwallow = true;
                // Clear if no click follows (released outside the map).
                setTimeout(() => { this._mapDragSwallow = false; }, 0);
            }
        });
    },

    bindPostClicks() {
        this.overlay.querySelectorAll('.gm-post-node[data-post]').forEach(node => {
            const id = node.getAttribute('data-post');
            node.addEventListener('pointerenter', () => node.classList.add('hovered'));
            node.addEventListener('pointerleave', () => node.classList.remove('hovered'));
            node.addEventListener('click', () => {
                this.markUserPicked();
                this.selectPost(id);
            });
            node.addEventListener('dblclick', () => {
                this.selectPost(id);
                this.confirm();
            });
        });
    },

    /** A click picked a planet / post: show its selection frame even without map focus. */
    markUserPicked() {
        this._picked = true;
        if (this.overlay) this.overlay.classList.add('is-picked');
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
        this.raiseSelectedMarker();
    },

    /**
     * SVG has no z-index: move the selected planet / post (with its frame)
     * to the top, just under the player ship, so markings are never covered.
     */
    raiseSelectedMarker() {
        const svg = this.overlay && this.overlay.querySelector('.galaxy-map-svg');
        if (!svg) return;
        const sel = svg.querySelector('.gm-post-node.selected') || svg.querySelector('.gm-node.selected');
        if (!sel || sel.parentNode !== svg) return;
        const ship = svg.querySelector(':scope > .gm-ship-marker');
        if (sel.nextSibling === ship) return;
        svg.insertBefore(sel, ship || null);
    },

    bindEvents() {
        if (this._keyHandler) {
            document.removeEventListener('keydown', this._keyHandler);
            this._keyHandler = null;
        }
        this.bindNodeClicks();
        this.bindPostClicks();
        this.bindMapZoom();
        this.raiseSelectedMarker();
        if (this.selectedPostId) this.updateDetails();

        // Jump to the station's galaxy travel (teleport) tab.
        const teleportBtn = this.overlay.querySelector('#gmTeleport');
        if (teleportBtn) {
            teleportBtn.addEventListener('click', () => {
                if (typeof homeStationUI === 'undefined') return;
                homeStationUI.tab = 'travel';
                homeStationUI.statusMsg = '';
                homeStationUI._navLevel = 'tabs';
                homeStationUI.persistTab();
                homeStationUI.createUI();
            });
        }
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
