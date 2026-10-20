"use strict";

// GalaxyMapManager members, continued from render-explore-controls.js (kept under ~500 lines per file).
extendClass(GalaxyMapManager, {
    /** Map SVG wrapped for Global Pixel Size: CSS scale(N) nearest-neighbor raster. */
    mapAreaInnerHtml() {
        return `<div class="gm-px-raster">${this.renderMapSvg()}</div>`;
    },
    renderMapSvg() {
        const nodes = this.map.nodes || [];
        const edges = this.map.edges || [];
        const W = 640;
        const H = 320;
        const pad = 48;

        const mapSpread = 2.0;
        this._linesByDetail = {};
        // Planets are sized once per full render — lines must use that same scale.
        this._nodeObjScale = this.getMapObjectScale();
        const edgesHtml = this.edgeLinesSvg();

        // Ruling faction's base planet (faction-holdings.js).
        const holdings = (typeof profileManager !== 'undefined' && profileManager.getFactionHoldings)
            ? profileManager.getFactionHoldings(this.galaxyId) : null;
        // Hidden until the base planet is reachable.
        const baseId = holdings && !holdings.baseLost && profileManager.isHoldingBaseRevealed(this.galaxyId)
            ? holdings.base : null;
        const rulerStyle = holdings && typeof factionShipStyles !== 'undefined' && factionShipStyles.getFactionStyle
            ? factionShipStyles.getFactionStyle(holdings.ruler) : null;
        const rulerAccent = (rulerStyle && rulerStyle.accent) || 'var(--color-primary)';
        this.prepareSunDrift(W, H, pad);
        // Dev mode: locked planets keep full brightness.
        const devMode = typeof startScreenManager !== 'undefined' && !!startScreenManager.devMode;
        let nodesHtml = '';
        nodes.forEach(n => {
            const x = W / 2 + (n.x - 0.5) * (W - pad * 2) * mapSpread;
            const y = H / 2 + (n.y - 0.5) * (H - pad * 2) * mapSpread;
            const unlocked = this.isUnlocked(n.planetId);
            const cleared = this.isCleared(n.planetId);
            const selected = !this.selectedPostId && n.planetId === this.selectedPlanetId;
            const hovered = n.planetId === this.hoveredPlanetId;
            // Progress label only while there's still something to fight.
            const stageProgress = !unlocked || cleared ? null : this.getPlanetStageProgress(n.planetId);
            const baseSize = this.planetNodeSize(n.planetId);
            let size = baseSize * this.getMapObjectScale();
            const uLat = this.mapPxLatticeUnit ? this.mapPxLatticeUnit() : 0;
            if (uLat > 0) size = Math.max(uLat * 2, Math.round(size / uLat) * uLat);
            const frame = size / 2 + 10;
            const npt = this.latticeMapPt ? this.latticeMapPt(x, y) : { x: x, y: y };
            const stateClass = [
                unlocked ? 'unlocked' : 'locked',
                cleared ? 'cleared' : '',
                selected ? 'selected' : '',
                hovered ? 'hovered' : ''
            ].filter(Boolean).join(' ');
            nodesHtml += `
                <g class="gm-node ${stateClass}"
                   data-planet="${n.planetId}" data-size="${size}" transform="translate(${npt.x},${npt.y})">
                    <title>${unlocked ? String(n.planetId).toUpperCase() : 'LOCKED · COMPLETE A CONNECTED PLANET TO UNLOCK'}</title>
                    <g class="gm-frame-slot" data-frame-r="${(this.planetSurfaceRadius(n.planetId) * this.getMapObjectScale()).toFixed(2)}">${this.selectionFrameSvg(frame, 12, 3)}</g>
                    <foreignObject class="gm-planet-lit${unlocked || devMode ? ' is-active' : ' is-locked'}" data-lit-x="${npt.x}" data-lit-y="${npt.y}" x="${-size / 2}" y="${-size / 2}" width="${size}" height="${size}">
                        <div xmlns="http://www.w3.org/1999/xhtml" class="gm-node-icon-wrap ${unlocked || devMode ? '' : 'dimmed'}">
                            ${this.planetIconHtml(n.planetId, size, true, this.planetLightDir(npt.x, npt.y), true)}
                        </div>
                    </foreignObject>
                    ${this.invasionMarkerSvg ? this.invasionMarkerSvg(n.planetId, size) : ''}
                    ${n.planetId === baseId ? `
                        <g class="gm-base-marker" style="--fac:${rulerAccent}">
                            <title>${String(holdings.ruler).toUpperCase()} BASE${holdings.stations.length ? ' · DESTROY ITS STATIONS TO ASSAULT IT' : ' · OPEN TO ASSAULT'}</title>
                            ${this.baseFortressSvg(size, holdings.ruler)}
                        </g>
                    ` : ''}
                    ${stageProgress ? `<g class="gm-stage-anchor" data-r="${(this.planetSurfaceRadius(n.planetId) * this.getMapObjectScale()).toFixed(2)}" transform="translate(0,${(this.planetSurfaceRadius(n.planetId) * this.getMapObjectScale()).toFixed(2)}) scale(${(this.getMapObjectScale() * this.stageTextScale()).toFixed(4)})">
                        ${stageProgress.boss
                            // Boss stage: skull + "/4". The skull sits clear of the text's
                            // dark outline stroke, which used to paint over its right edge.
                            ? `${this.bossIconSvg(-7.5, 9, 1)}${this.pixelTextGroup('/' + stageProgress.total, 0, 12, 'start')}`
                            : this.pixelTextGroup(stageProgress.next + '/' + stageProgress.total, 0, 12, 'middle')}
                    </g>` : ''}
                    ${!unlocked ? `
                        <g class="gm-locked-icon" transform="translate(-6,${size / 2 + 3})">
                            <path class="gm-lock-shackle" d="M3 6V3h1V2h1V1h2v1h1v1h1v3H8V3H7V2H5v1H4v3z"/>
                            <rect class="gm-lock-body" x="1" y="6" width="10" height="7"/>
                            <rect class="gm-lock-hole" x="5" y="8" width="2" height="3"/>
                        </g>
                    ` : ''}
                </g>
            `;
        });

        let postsHtml = '';
        this.getTradingPosts().forEach(post => {
            const x = W / 2 + (post.x - 0.5) * (W - pad * 2) * mapSpread;
            const y = H / 2 + (post.y - 0.5) * (H - pad * 2) * mapSpread;
            const open = profileManager.isTradingPostUnlocked(post);
            // Fixed map footprint (same as planets/ship). Under GP, screen cells stay gp via
            // vfMapPx — do not scale stations by live zoom (that made cells grow on zoom-out).
            const pp = this.planetPixelSize(post.planetId) * this.getMapObjectScale();
            const half = 2.6 * pp;
            const stDetail = this.getMapDetail();
            const ppt = this.latticeMapPt ? this.latticeMapPt(x, y) : { x: x, y: y };
            const hint = open ? 'DOUBLE-CLICK TO FLY THERE / DOCK' : 'REACH ' + profileManager.getTradingPostUnlockLabel(post) + ' TO UNLOCK';
            postsHtml += `
                <g class="gm-post-node ${open ? 'open' : 'closed'} ${post.id === this.selectedPostId ? 'selected' : ''}${post.factionStation ? ' is-faction' : ''}${post.faction ? ' is-built' : ''}" data-post="${post.id}" transform="translate(${ppt.x},${ppt.y})"${post.faction ? ` style="--fac:${((typeof factionShipStyles !== 'undefined' && factionShipStyles.getFactionStyle && factionShipStyles.getFactionStyle(post.faction)) || {}).accent || 'var(--color-primary)'}"` : ''}>
                    <rect class="gm-post-hit" x="${-half - 2}" y="${-half - 2}" width="${2 * half + 4}" height="${2 * half + 4}"/>
                    <g class="gm-frame-slot" data-frame-r="${half.toFixed(2)}" data-frame-post="1">${this.selectionFrameSvg(half + 4, 7, 2)}</g>
                    <title>${post.name}${post.factionStation ? ' · FACTION STATION' : ' TRADING POST'} · ${hint}</title>
                    ${post.faction ? `<rect class="gm-faction-station-ring" x="${-half - 1}" y="${-half - 1}" width="${2 * half + 2}" height="${2 * half + 2}"/>` : ''}
                    <g class="gm-post-art" transform="scale(${(pp * 0.42).toFixed(3)})">${this.stationArtImage(post, stDetail, open)}</g>
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
            const icon = this.getShipIconUrl(this.getMapDetail());
            // Sized to the ring: ~39×51 on a planet, ~26×34 on a trading post.
            // Whole-pixel magnification of the 13×17 icon, so every pixel is the same size.
            const box = this.shipIconBox();
            const k = box.w / 11;
            const shipPt = this.latticeShipPt ? this.latticeShipPt(x, y) : { x: x, y: y };
            const gpOn = typeof uiAppearanceManager !== 'undefined' && uiAppearanceManager.getGlobalPixelPx
                && uiAppearanceManager.getGlobalPixelPx() > 0;
            const shipSvg = icon
                ? `<image href="${icon}" ${box.attrs} class="gm-ship-marker-img" transform="rotate(180)"/>`
                : `<path d="M0 7 L6 -6 L0 -3 L-6 -6 Z" class="gm-ship-marker-body" transform="scale(${k})"/>`;
            const view = this.getMapViewBox(W, H, pad);
            const centered = Math.hypot(
                x - (view[0] + view[2] / 2),
                y - (view[1] + view[3] / 2)
            ) < Math.min(view[2], view[3]) * 0.12;
            const showShipLabel = (this.mapZoom || 1) < 1.1 &&
                !centered &&
                this._shipLabelReady;
            // Under GP skip sub-pixel bob — it fights the shared screen lattice.
            const bob = gpOn ? '' : '<animateTransform attributeName="transform" type="translate" values="0 0; 0 -2; 0 0; 0 2; 0 0" dur="2.4s" repeatCount="indefinite"/>';
            shipHtml = `
                <g class="gm-ship-marker" transform="translate(${shipPt.x},${shipPt.y})">
                    <title>YOUR SHIP</title>
                    <g class="gm-ship-scale" transform="scale(1)">
                    ${showShipLabel ? `<text class="gm-ship-location-label" x="0" y="${-r - 8}">YOU ARE HERE</text>` : ''}
                    <g>
                        ${bob}
                        ${shipSvg}
                    </g>
                    </g>
                </g>
            `;
        }

        return `
            <svg class="galaxy-map-svg${(this.mapZoom || 1) >= 2.5 ? ' gm-close-view' : ''}" style="--gm-px:${1 / this.getMapDetail()}" viewBox="${this.getMapViewBox(W, H, pad).join(' ')}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
                ${this.galaxyStarsSvg ? this.galaxyStarsSvg(W, H) : ''}
                <g class="gm-suns">${this.galaxySunsSvg ? this.galaxySunsSvg(W, H, pad) : ''}</g>
                <g class="gm-lines">${edgesHtml}</g>
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
        // 7×7 map sizes of stars; the black backdrop is far bigger still, so
        // there is never an edge when fully zoomed out.
        const x0 = -3 * W;
        const y0 = -3 * H;
        const detail = this.getMapDetail ? this.getMapDetail() : 1;
        let stars = '';
        // Static stars are merged into a few paths (one per brightness step):
        // thousands of separate elements made every zoom frame expensive.
        // Only a capped number twinkle as their own elements.
        const q = detail > 1 ? 2 / detail : 1;
        const sq = (x, y, w, h) => `M${x} ${y}h${w}v${h}h${-w}z`;
        const buckets = ['', '', '', ''];
        let glow = '';
        let twinkles = 0;
        for (let i = 0; i < 2200; i++) {
            const x = Math.round(x0 + next() * W * 7);
            const y = Math.round(y0 + next() * H * 7);
            const big = next() < 0.08;
            const a = 0.45 + next() * 0.55;
            const twinkle = next() < 0.35;
            const delay = next();
            const s = big ? 2 * q : q;
            if (big) glow += sq(x - q, y, s + 2 * q, s) + sq(x, y - q, s, s + 2 * q);
            if (twinkle && twinkles < 140) {
                twinkles++;
                stars += `<rect class="gm-star-twinkle" x="${x}" y="${y}" width="${s}" height="${s}" style="animation-delay:${(-Math.floor(delay * 6) * 0.6).toFixed(1)}s"/>`;
            } else {
                buckets[Math.min(3, Math.floor((a - 0.45) / 0.1375))] += sq(x, y, s, s);
            }
        }
        const starPaths = buckets.map((d, i) => d ? `<path d="${d}" opacity="${(0.5 + i * 0.16).toFixed(2)}"/>` : '').join('') +
            (glow ? `<path class="gm-star-glow" d="${glow}"/>` : '');
        // Stars fade out towards the edge of the field (radial mask).
        const fadeR = Math.max(W, H) * 3;
        const fade = `<defs><radialGradient id="gmStarFade" gradientUnits="userSpaceOnUse" cx="${W / 2}" cy="${H / 2}" r="${fadeR}">` +
            `<stop offset="0.25" stop-color="#fff"/><stop offset="0.7" stop-color="#fff" stop-opacity="0.35"/>` +
            `<stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>` +
            `<mask id="gmStarMask" maskUnits="userSpaceOnUse" x="${x0}" y="${y0}" width="${W * 7}" height="${H * 7}">` +
            `<rect x="${x0}" y="${y0}" width="${W * 7}" height="${H * 7}" fill="url(#gmStarFade)"/></mask></defs>`;
        return `<g class="gm-space" aria-hidden="true">` + fade +
            `<rect class="gm-space-bg" x="${-20 * W}" y="${-20 * H}" width="${W * 41}" height="${H * 41}"/>` +
            this.galaxyNebulaSvg(W, H, x0, y0) +
            `<g class="gm-stars" mask="url(#gmStarMask)">${starPaths}${stars}</g></g>`;
    },
    /**
     * Pixel nebulae, dust and distant galaxies around the galaxy: seeded
     * fbm clouds in the galaxy's colours, faint over the planets and denser
     * outside, dithered into 3 opacity steps on a coarse pixel grid.
     * Cached per galaxy (it's big and never changes).
     */
    /** Starts the current galaxy's nebula job early (boot), so the map already has it when opened. */
    prewarmNebula() {
        try {
            if (typeof profileManager === 'undefined' || !profileManager.hasActiveProfile || !profileManager.hasActiveProfile()) return;
            const gid = profileManager.getCurrentGalaxyId(profileManager.getActiveProfile());
            if (!gid) return;
            this.galaxyId = gid;
            this.galaxyNebulaSvg(GM_MAP_W, GM_MAP_H, -3 * GM_MAP_W, -3 * GM_MAP_H);
        } catch (e) { /* the map builds it itself later */ }
    },
});
