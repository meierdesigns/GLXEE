"use strict";

// Stations / checkpoints stop refining past this zoom detail (perf).
const GM_ART_DETAIL_MAX = 4;

// Galaxy-map nebula feature scale (noise frequency per map unit): higher =
// smaller clouds, finer wisps and filaments.
const NEB_SCALE = 0.0042;
// Max pixels computed for the nebula patch over the view (performance cap).
const NEB_PIXEL_BUDGET = 520000;
// How steeply nebula density drops with distance from the suns (higher = faster).
const NEB_SUN_FALLOFF = 1.8;

// GalaxyMapManager methods, split from galaxy-map.js.
extendClass(GalaxyMapManager, {
    renderExploreControls(splitMeta) {
        this._exploreMetaHtml = '';
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
        // Cost as resource icon + amount (label kept as the tooltip).
        const costLabel = cost && typeof economyConfig !== 'undefined'
            ? economyConfig.formatCost(cost)
            : '';
        const iconKeys = { credits: 'menuCredits', scrap: 'resScrap', ore: 'resOre', crystal: 'resCrystal', voltex: 'resVoltex' };
        const costIcons = cost && typeof iconRenderer !== 'undefined' && iconRenderer.imgHtml
            ? Object.keys(cost).filter((id) => cost[id] > 0).map((id) =>
                `<span class="gm-explore-cost">${iconRenderer.imgHtml(iconKeys[id] || 'resScrap', 16, 'gm-explore-cost-icon', undefined, false)}${cost[id]}</span>`).join('')
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
        const meta = `<span class="gm-explore-meta">EXPLORES ${used}/${budget}` +
            (reason ? ` · ${reason}` : '') + `</span>`;
        // Map header shows the meta line under the progress label instead
        // (exploreMetaHtml); elsewhere it stays under the button.
        this._exploreMetaHtml = meta;
        return `<div class="galaxy-map-explore">` +
            `<button class="action-button gm-explore-btn" id="gmExplore" ${disabled}${costLabel ? ` data-ui-tip="COST · ${costLabel}"` : ''}>EXPLORE NEW SECTOR` +
            (costIcons ? `<span class="gm-explore-costs">${costIcons}</span>` : (costLabel ? ` (${costLabel})` : '')) +
            `</button>` + (splitMeta ? '' : meta) + `</div>`;
    },

    /** Planet-to-planet lines (lit, dim, or fading towards a locked planet). */
    edgeLinesSvg() {
        const edges = this.map.edges || [];
        let blocks = '';
        const W = 640;
        const H = 320;
        const pad = 48;
        const edgeGap = 0;
        const mapSpread = 2.0;
        // Lines aim at the centre and stop on the drawn surface.
        const planetRadius = (planetId) => this.planetSurfaceRadius(planetId);
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
            // Only paths between two reachable planets read as active; dev
            // mode lights everything.
            const devLit = typeof startScreenManager !== 'undefined' && !!startScreenManager.devMode;
            const okA = devLit || this.isUnlocked(edge[0]);
            const okB = devLit || this.isUnlocked(edge[1]);
            // Border of the reachable space (exactly one end open): a border
            // station sits on the middle of the line.
            if (okA !== okB) {
                const open = okA ? edge[0] : edge[1];
                const shut = okA ? edge[1] : edge[0];
                const nm = (id) => String((this.getPlanetInfo(id) || {}).name || id).toUpperCase();
                blocks += this.blockadeSvg((x1 + x2) / 2, (y1 + y2) / 2, open,
                    `BEYOND: ${nm(shut)} (LOCKED)\nTO OPEN: CLEAR ${nm(open)}\nThe route stays sealed until the planet on this side is cleared. Click to focus it.`);
            }
            if (okA === okB) {
                edgesHtml += this.pixelLineSvg([{ x: x1, y: y1 }, { x: x2, y: y2 }], 'gm-edge ' + (okA ? 'lit' : 'dim'));
                return;
            }
            // Reachable → locked: lit only up to the border station in the
            // middle, dark beyond it (slices of one line tile without seams).
            const from = okA ? { x: x1, y: y1 } : { x: x2, y: y2 };
            const to = okA ? { x: x2, y: y2 } : { x: x1, y: y1 };
            edgesHtml += this.pixelLineSvg([from, to], 'gm-edge lit', { range: [0, 0.5] }) +
                this.pixelLineSvg([from, to], 'gm-edge dim', { range: [0.5, 1] });
        });
        // Blockades on top of every beam.
        return edgesHtml + blocks;
    },

    /**
     * Border station on a line where reachable space ends: two gate towers
     * with lit windows and lamps, a shimmering energy field between them.
     * Keys: k d m l hull depths, w windows, a lamps, r/R field (alternating
     * columns shimmer out of phase).
     */
    BORDER_STATION_ART: [
        '...a.............a...',
        '...l.............l...',
        '..lmd...........lmd..',
        '.llmdd.........llmdd.',
        '.lwmdd.........lwmdd.',
        '.lmmddrRrRrRrRrlmmdd.',
        '.lwmddRrRrRrRrRlwmdd.',
        '.lmmddrRrRrRrRrlmmdd.',
        '.lwmddRrRrRrRrRlwmdd.',
        'lllllllllllllllllllll',
        'mmkmmmkmmmkmmmkmmmkmm',
        '.ddddddddddddddddddd.'
    ],

    /** Tower caps (5 wide, cols 1-5, mirrored to 15-19) per faction silhouette. */
    BORDER_CAPS: {
        modular: ['.lad.', '.lmd.', 'llmdd'],
        spikes: ['a...a', 'l.l.l', 'llmdd'],
        rings: ['.lal.', 'l...d', 'llmdd'],
        scrap: ['.a...', '.ld..', 'lmmd.'],
        circuit: ['a.l.a', 'lllmd', 'l.m.d']
    },

    /** Galaxy's ruling faction style (faction-holdings.js), or null. */
    borderRulerStyle() {
        const holdings = (typeof profileManager !== 'undefined' && profileManager.getFactionHoldings)
            ? profileManager.getFactionHoldings(this.galaxyId) : null;
        if (!holdings || !holdings.ruler || typeof factionShipStyles === 'undefined' || !factionShipStyles.getFactionStyle) return null;
        return factionShipStyles.getFactionStyle(holdings.ruler);
    },

    blockadeSvg(cx, cy, focusPlanet, tip) {
        // Cached per checkpoint + zoom detail + ruler (the art is costly at high zoom).
        const style = this.borderRulerStyle();
        const key = [cx.toFixed(2), cy.toFixed(2), focusPlanet, tip, this.getMapDetail ? this.getMapDetail() : 1,
            this.planetPixelSize(focusPlanet) * this.getMapObjectScale(), style ? style.silhouette + style.hull : ''].join('|');
        this._blockadeCache = this._blockadeCache || {};
        if (!this._blockadeCache[key]) this._blockadeCache[key] = this.blockadeSvgRaw(cx, cy, focusPlanet, tip);
        return this._blockadeCache[key];
    },

    blockadeSvgRaw(cx, cy, focusPlanet, tip) {
        const style = this.borderRulerStyle();
        let rows = this.BORDER_STATION_ART;
        const cap = style && this.BORDER_CAPS[style.silhouette];
        if (cap) {
            rows = rows.map((r, y) => {
                if (y > 2) return r;
                const mid = r.slice(6, 15);
                const left = cap[y];
                return '.' + left + mid.replace(/[^.]/g, '.') + left + '.';
            });
        }
        const w = rows[0].length, h = rows.length;
        // One art cell = one pixel of the planet it guards (zoom-scaled).
        const cell = this.planetPixelSize(focusPlanet) * this.getMapObjectScale();
        const at = (x, y) => (rows[y] && rows[y][x]) || '.';
        const d = Math.min(GM_ART_DETAIL_MAX, this.getMapDetail ? this.getMapDetail() : 1);
        const solidAt = (x, y) => at(x, y) !== '.';
        let outline = '', body = '';
        if (d > 1) {
            // Fine silhouette on the planet's pixel grid: convex corners nicked,
            // one-sub-pixel outline.
            const m = this.subMaskNew(d);
            const R = Math.min(d * 0.5, 2); // nick the corner pixel only
            let clipRects = '';
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    const c = at(x, y);
                    if (c === '.') continue;
                    const rows = [];
                    for (let sy = 0; sy < d; sy++) {
                        let a = 0, b = d;
                        const cyy = sy + 0.5;
                        const top = cyy < R && !solidAt(x, y - 1), bot = cyy > d - R && !solidAt(x, y + 1);
                        if (top || bot) {
                            const dy = top ? R - cyy : cyy - (d - R);
                            const inset = Math.round(R - Math.sqrt(Math.max(0, R * R - dy * dy)));
                            if (!solidAt(x - 1, y)) a = inset;
                            if (!solidAt(x + 1, y)) b = d - inset;
                        }
                        if (b > a) rows.push([x * d + a, x * d + b, y * d + sy]);
                    }
                    rows.forEach(([a, b, sy]) => { for (let sx = a; sx < b; sx++) this.subMaskAdd(m, sx, sy); });
                    body += this.subRowsSvg(rows, d, `gm-border-${c === 'R' ? 'r2' : c}`);
                    clipRects += this.subRowsSvg(rows, d, '');
                }
            }
            outline = this.subMaskOutlineSvg(m, 'gm-border-o');
            let shade = '';
            for (let y = 0; y < h; y++) {
                let x0 = -1;
                for (let x = 0; x <= w; x++) {
                    const c = x < w ? at(x, y) : '.';
                    const solid = c !== '.' && c !== 'r' && c !== 'R' && c !== 'a' && c !== 'w';
                    if (solid && x0 < 0) x0 = x;
                    if (!solid && x0 >= 0) {
                        shade += this.ditherShadeSvg(x0, y, x - x0, 1, d, w / 2, h / 2, Math.max(w, h) / 2, 'gm-border');
                        x0 = -1;
                    }
                }
            }
            const clipId = this.nextClipId('gmBdClip');
            body += `<clipPath id="${clipId}">${clipRects}</clipPath><g clip-path="url(#${clipId})">${shade}</g>`;
        } else {
            for (let y = -1; y <= h; y++) {
                for (let x = -1; x <= w; x++) {
                    const c = at(x, y);
                    if (c !== '.') { body += `<rect x="${x}" y="${y}" width="1" height="1" class="gm-border-${c === 'R' ? 'r2' : c}"/>`; continue; }
                    let edge = false;
                    for (let dy = -1; dy <= 1 && !edge; dy++) {
                        for (let dx = -1; dx <= 1; dx++) if (at(x + dx, y + dy) !== '.') { edge = true; break; }
                    }
                    if (edge) outline += `<rect x="${x}" y="${y}" width="1" height="1" class="gm-border-o"/>`;
                }
            }
        }
        // Ruling faction colours (hull / edge / accent) via CSS vars.
        const styleAttr = style
            ? ` style="--bf-hull:${style.hull};--bf-edge:${style.edge || '#07080c'};--bf-accent:${style.accent || '#ff5a3c'}"`
            : '';
        // App tooltip (ui-tooltip.js) via data-ui-tip.
        const tipAttr = tip ? ` data-ui-tip-head="BORDER CHECKPOINT" data-ui-tip="${String(tip).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')}"` : '';
        const focusAttr = focusPlanet ? ` data-focus-planet="${String(focusPlanet).replace(/"/g, '')}"` : '';
        return `<g class="gm-border-station${style ? ' is-faction' : ''}"${styleAttr}${tipAttr}${focusAttr} transform="translate(${cx.toFixed(2)} ${cy.toFixed(2)}) scale(${cell}) translate(${-w / 2} ${-h / 2})" shape-rendering="crispEdges">` +
            outline + body + `</g>`;
    },

    /**
     * The .gm-lines layer alone, cached per line step, so zooming only
     * redraws lines (and returns instantly to steps seen before).
     */
    linesLayerHtml() {
        const key = this.getLineDetail();
        this._linesByDetail = this._linesByDetail || {};
        if (!this._linesByDetail[key]) {
            this._linesByDetail[key] = this.edgeLinesSvg() + (this.postLanesSvg ? this.postLanesSvg() : '');
        }
        return this._linesByDetail[key];
    },

    renderMapSvg() {
        const nodes = this.map.nodes || [];
        const edges = this.map.edges || [];
        const W = 640;
        const H = 320;
        const pad = 48;

        const mapSpread = 2.0;
        this._linesByDetail = {};
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
            const stageProgress = this.getPlanetStageProgress(n.planetId);
            const sizeSeed = String(n.planetId || '').split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
            const baseSize = 32 + (sizeSeed % 7) * 10;
            const size = baseSize * this.getMapObjectScale();
            const frame = size / 2 + 10;
            const stateClass = [
                unlocked ? 'unlocked' : 'locked',
                cleared ? 'cleared' : '',
                selected ? 'selected' : '',
                hovered ? 'hovered' : ''
            ].filter(Boolean).join(' ');
            nodesHtml += `
                <g class="gm-node ${stateClass}"
                   data-planet="${n.planetId}" data-size="${size}" transform="translate(${x},${y})">
                    <title>${unlocked ? String(n.planetId).toUpperCase() : 'LOCKED · COMPLETE A CONNECTED PLANET TO UNLOCK'}</title>
                    <g class="gm-frame-slot" data-frame-r="${this.planetSurfaceRadius(n.planetId).toFixed(2)}">${this.selectionFrameSvg(frame, 12, 3)}</g>
                    <foreignObject class="gm-planet-lit" data-lit-x="${x}" data-lit-y="${y}" x="${-size / 2}" y="${-size / 2}" width="${size}" height="${size}">
                        <div xmlns="http://www.w3.org/1999/xhtml" class="gm-node-icon-wrap ${unlocked || devMode ? '' : 'dimmed'}">
                            ${this.planetIconHtml(n.planetId, size, true, this.planetLightDir(x, y))}
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
                            ${this.baseFortressSvg(size, holdings.ruler)}
                        </g>
                    ` : ''}
                    ${stageProgress ? `
                        ${stageProgress.boss
                            // Boss stage: skull + "/4". The skull sits clear of the text's
                            // dark outline stroke, which used to paint over its right edge.
                            ? `${this.bossIconSvg(-7.5, size / 2 + 9, 1)}${this.pixelTextSvg('/' + stageProgress.total, 0, size / 2 + 12, 'start')}`
                            : this.pixelTextSvg(stageProgress.done + '/' + stageProgress.total, 0, size / 2 + 12, 'middle')}
                    ` : ''}
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
            const anchor = this.getPlanetInfo(post.planetId);
            // One station cell = one pixel of its anchor planet.
            // Stations are small next to planets: half a planet pixel per
            // cell for shops, a bit more for faction stations.
            // Base cell = one planet pixel at zoom detail 1; the station's own
            // sub-pixel detail then follows the zoom like the planets do.
            const pp = this.planetPixelSize(post.planetId) * this.getMapObjectScale();
            const half = 6 * pp;
            const hint = open ? 'DOUBLE-CLICK TO FLY THERE / DOCK' : 'REACH ' + profileManager.getTradingPostUnlockLabel(post) + ' TO UNLOCK';
            postsHtml += `
                <g class="gm-post-node ${open ? 'open' : 'closed'} ${post.id === this.selectedPostId ? 'selected' : ''}${post.factionStation ? ' is-faction' : ''}" data-post="${post.id}" transform="translate(${x},${y})"${post.factionStation ? ` style="--fac:${((typeof factionShipStyles !== 'undefined' && factionShipStyles.getFactionStyle && factionShipStyles.getFactionStyle(post.faction)) || {}).accent || 'var(--color-primary)'}"` : ''}>
                    <rect class="gm-post-hit" x="${-half - 2}" y="${-half - 2}" width="${2 * half + 4}" height="${2 * half + 4}"/>
                    <g class="gm-frame-slot" data-frame-r="${half.toFixed(2)}" data-frame-post="1">${this.selectionFrameSvg(half + 4, 7, 2)}</g>
                    <title>${post.name}${post.factionStation ? ' · FACTION STATION' : ' TRADING POST'} · ${hint}</title>
                    ${post.factionStation ? `<rect class="gm-faction-station-ring" x="${-half - 1}" y="${-half - 1}" width="${2 * half + 2}" height="${2 * half + 2}"/>` : ''}
                    <g class="gm-post-art" transform="scale(${pp.toFixed(3)})">${this.stationPixelsSvg(post, this.getMapDetail())}</g>
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
            const px = Math.max(2, Math.round(r * 1.2 / 13));
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
                    <g class="gm-ship-scale" transform="scale(${(1 / Math.sqrt(Math.max(1, this.mapZoom || 1))).toFixed(4)})">
                    ${showShipLabel ? `<text class="gm-ship-location-label" x="0" y="${-r - 8}">YOU ARE HERE</text>` : ''}
                    <g>
                        <animateTransform attributeName="transform" type="translate" values="0 0; 0 -2; 0 0; 0 2; 0 0" dur="2.4s" repeatCount="indefinite"/>
                        ${shipSvg}
                    </g>
                    </g>
                </g>
            `;
        }

        return `
            <svg class="galaxy-map-svg" style="--gm-px:${1 / this.getMapDetail()}" viewBox="${this.getMapViewBox(W, H, pad).join(' ')}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
                ${this.galaxyStarsSvg ? this.galaxyStarsSvg(W, H) : ''}
                <g class="gm-suns">${this.galaxySunsSvg ? this.galaxySunsSvg(W, H, pad) : ''}</g>
                ${nodesHtml}
                ${postsHtml}
                <g class="gm-lines">${edgesHtml}${this.postLanesSvg ? this.postLanesSvg() : ''}</g>
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
                stars += `<rect class="gm-star-twinkle" x="${x}" y="${y}" width="${s}" height="${s}" style="animation-delay:${(-delay * 4).toFixed(2)}s"/>`;
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
    galaxyNebulaSvg(W, H, x0, y0) {
        const gid = String(this.galaxyId || '');
        this._nebulaCache = this._nebulaCache || {};
        const detail = this.getMapDetail ? this.getMapDetail() : 1;
        // Zoomed in: a finer copy over the visible area (plus margin), on top
        // of the coarse field with a hole cut where the fine one sits.
        let fine = null;
        if (this.getMapViewBox) {
            const v = this.getMapViewBox(W, H, typeof GM_MAP_PAD !== 'undefined' ? GM_MAP_PAD : 48);
            const mx = v[2] * 0.3, my = v[3] * 0.3; // small margin: less to compute
            const g8 = (n) => Math.floor(n / 8) * 8;
            fine = { x: g8(v[0] - mx), y: g8(v[1] - my) };
            fine.w = g8(v[2] + 2 * mx) + 16;
            fine.h = g8(v[3] + 2 * my) + 16;
            this._nebulaRegion = fine;
        } else {
            this._nebulaRegion = null;
        }
        const key = gid + '|' + (fine ? detail + '|' + fine.x + '|' + fine.y + '|' + fine.w + '|' + fine.h : '1');

        // Keep only the coarse field + the latest fine patch.
        Object.keys(this._nebulaCache).forEach((k) => { if (k !== gid + '|1' && k !== gid + '|coarse' && k.indexOf(gid + '|') === 0) delete this._nebulaCache[k]; });
        let seed = 7;
        for (let i = 0; i < gid.length; i++) seed = (Math.imul(seed, 31) + gid.charCodeAt(i)) >>> 0;
        let s = seed || 1;
        const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
        const table = new Float32Array(512);
        for (let i = 0; i < 512; i++) table[i] = rnd();
        const hash = (x, y) => table[(((x * 73856093) ^ (y * 19349663)) >>> 0) & 511];
        const sm = (t) => t * t * (3 - 2 * t);
        const noise = (x, y) => {
            const xi = Math.floor(x), yi = Math.floor(y), fx = sm(x - xi), fy = sm(y - yi);
            const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
            return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
        };
        const fbm = (x, y, oct) => {
            let v = 0, amp = 0.5, f = 1, n = 0;
            for (let o = 0; o < (oct || 4); o++) { v += noise(x * f, y * f) * amp; n += amp; amp *= 0.5; f *= 2.1; }
            return v / n;
        };
        // Colours: the factions present here (main first); galaxy colour as fallback.
        const toRgb = (h) => {
            const m = /^#?([0-9a-f]{6})$/i.exec(String(h || ''));
            return m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) : null;
        };
        const hex = (c) => '#' + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
        const control = typeof planetConfigManager !== 'undefined' && planetConfigManager.getGalaxyControl
            ? planetConfigManager.getGalaxyControl(gid) : null;
        const facs = (control && control.factions) || [];
        const layers = [];
        facs.slice(0, 3).forEach((f, i) => {
            const st = typeof factionShipStyles !== 'undefined' && factionShipStyles.getFactionStyle
                ? factionShipStyles.getFactionStyle(f.id) : null;
            const c = toRgb(st && st.accent);
            if (c) layers.push({ rgb: c, cover: 0.3 + (f.share || 0.3) * 0.4, sc: NEB_SCALE * (1 + i * 0.3), off: rnd() * 90, ang: rnd() * Math.PI * 2 });
        });
        if (!layers.length) {
            const g = typeof planetConfigManager !== 'undefined' && planetConfigManager.getGalaxy
                ? planetConfigManager.getGalaxy(gid) : null;
            layers.push({ rgb: toRgb(g && g.baseColor) || [122, 60, 255], cover: 0.5, sc: NEB_SCALE, off: rnd() * 90, ang: rnd() * Math.PI * 2 });
        }
        // A deep, dim dust layer in the main colour gives the clouds depth.
        layers.unshift({ rgb: layers[0].rgb.map((v) => v * 0.4), cover: 0.55, sc: NEB_SCALE * 0.6, off: rnd() * 90, dust: true });
        const cxm = W / 2, cym = H / 2;
        const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
        const sstep = (a0, a1, t) => { const k = Math.max(0, Math.min(1, (t - a0) / (a1 - a0))); return k * k * (3 - 2 * k); };
        // Nebula field: 6×6 map sizes; it has faded to nothing before its edge.
        const nx0 = -2.5 * W, ny0 = -2.5 * H;
        // Suns light the clouds around them (denser, brighter, sun-tinted).
        const pad0 = typeof GM_MAP_PAD !== 'undefined' ? GM_MAP_PAD : 48;
        const suns = (typeof planetConfigManager !== 'undefined' && planetConfigManager.getGalaxySuns
            ? planetConfigManager.getGalaxySuns(gid) || [] : []).map((sn) => ({
            x: W / 2 + (sn.x - 0.5) * (W - pad0 * 2) * 2.0,
            y: H / 2 + (sn.y - 0.5) * (H - pad0 * 2) * 2.0,
            reach: Math.max(24, sn.r * (W - pad0 * 2) / 1.3) * 7,
            rgb: toRgb(sn.color) || [255, 190, 120]
        }));
        const sunLight = (x, y) => {
            let best = 0, rgb = null;
            suns.forEach((sn) => {
                const k = Math.exp(-Math.hypot(x - sn.x, y - sn.y) / sn.reach * 2.2);
                if (k > best) { best = k; rgb = sn.rgb; }
            });
            return { k: best, rgb: rgb };
        };
        // Rendered into a canvas (one RGBA pixel per nebula cell) and shown as a
        // single pixelated <image>: far cheaper than thousands of SVG paths.
        // Computed in ~14 ms slices between frames (never blocks zoom / pan);
        // the <image> gets its picture when the job is done. opaque = composite
        // over the black space backdrop (fine patch covers the coarse field).
        this._nebJobs = this._nebJobs || {};
        this._nebUrls = this._nebUrls || {};
        const paint = (jobKey, cell, bx, by, cols, rows, oct, opaque) => {
            const tag = (href) => `<image data-neb-key="${jobKey}"${href ? ` href="${href}"` : ''} x="${bx}" y="${by}" width="${cols * cell}" height="${rows * cell}" preserveAspectRatio="none" style="image-rendering:pixelated;image-rendering:crisp-edges"/>`;
            if (this._nebUrls[jobKey]) return tag(this._nebUrls[jobKey]);
            if (typeof document === 'undefined' || this._nebJobs[jobKey]) return tag('');
            // Only the newest fine patch keeps computing.
            if (opaque) Object.keys(this._nebJobs).forEach((k) => { if (this._nebJobs[k].opaque) this._nebJobs[k].cancel = true; });
            const cv = document.createElement('canvas');
            cv.width = cols;
            cv.height = rows;
            const ctx = cv.getContext('2d');
            const img = ctx.createImageData(cols, rows);
            const px = img.data;
            const toneAlpha = [0.1, 0.18, 0.28, 0.36];
            const job = { opaque: !!opaque, cancel: false };
            this._nebJobs[jobKey] = job;
            let r = 0;
            const slice = () => {
                if (job.cancel) { delete this._nebJobs[jobKey]; return; }
                const until = performance.now() + 14;
                for (; r < rows && performance.now() < until; r++) paintRow(r);
                if (r < rows) { setTimeout(slice, 0); return; }
                ctx.putImageData(img, 0, 0);
                const url = cv.toDataURL();
                this._nebUrls[jobKey] = url;
                const fines = Object.keys(this._nebUrls).filter((k) => k.indexOf('|f') !== -1);
                if (fines.length > 4) fines.slice(0, fines.length - 4).forEach((k) => { if (k !== jobKey) delete this._nebUrls[k]; });
                delete this._nebJobs[jobKey];
                if (opaque) this._nebLastFine = { key: jobKey, tag: tag(url) };
                document.querySelectorAll(`image[data-neb-key="${jobKey}"]`).forEach((el) => el.setAttribute('href', url));
            };
            const paintRow = (r) => {
                const y = by + r * cell;
                for (let c = 0; c < cols; c++) {
                    const x = bx + c * cell;
                    const d = Math.hypot((x - cxm) / W, (y - cym) / H) + (fbm(x * 0.0014 + 40, y * 0.0014, 2) - 0.5) * 0.9;
                    const envBase = (0.3 + 0.7 * sstep(0.15, 0.75, d)) * (1 - sstep(0.9, 2.0, d));
                    const sl = suns.length ? sunLight(x, y) : { k: 0, rgb: null };
                    // Away from the suns the clouds thin out fast: density
                    // follows sun proximity (steep curve), so dark space
                    // between systems stays mostly clear.
                    const sunFade = suns.length
                        ? Math.min(1, Math.pow(sl.k, NEB_SUN_FALLOFF) * 2.2)
                        : 1;
                    const envNear = envBase * sunFade;
                    if (envNear < 0.02 && sl.k < 0.05) continue;
                    const th = (bayer[(r % 4) * 4 + (c % 4)] / 16 - 0.5) * 0.035;
                    let R = 0, G = 0, B = 0, A = 0;
                    for (let li = 0; li < layers.length; li++) {
                        const L = layers[li];
                        let env = Math.max(envNear, sl.k * 0.9);
                        if (L.ang != null && layers.length > 2) {
                            const a2 = Math.atan2((y - cym) / H, (x - cxm) / W);
                            env *= 0.25 + 0.75 * Math.max(0, Math.cos(a2 - L.ang));
                        }
                        if (env < 0.02) continue;
                        const X = x * L.sc + L.off, Y = y * L.sc * 1.3 + L.off;
                        const q = fbm(X * 0.8, Y * 0.8, 2);
                        const base = fbm(X + q * 2.4, Y - q * 2.4, oct);
                        const ridge = 1 - Math.abs(fbm(X * 2.6 + 3, Y * 2.6 - q, oct - 1) * 2 - 1);
                        const v = (base * 0.75 + ridge * ridge * ridge * 0.45 - (1 - L.cover) * 1.05) * env + sl.k * 0.12;
                        let l = v > 0.34 + th ? 3 : v > 0.25 + th ? 2 : v > 0.15 + th ? 1 : v > 0.07 + th ? 0 : -1;
                        if (l < 0) continue;
                        if (L.dust && l > 1) l = 1;
                        // Tone colour; near a sun lifted a level and tinted by it.
                        const lit = sl.k;
                        const lift = [0, 14, 40, 70][l] + lit * 90;
                        const mulc = [1, 1.1, 1.15, 1.1][l];
                        let cr = L.rgb[0] * mulc + lift, cg = L.rgb[1] * mulc + lift, cb = L.rgb[2] * mulc + lift;
                        if (sl.rgb && lit > 0.02) {
                            const t = Math.min(0.7, lit * 0.9);
                            cr += (sl.rgb[0] - cr) * t; cg += (sl.rgb[1] - cg) * t; cb += (sl.rgb[2] - cb) * t;
                        }
                        const a = Math.min(0.75, (L.dust ? [0.11, 0.16][Math.min(1, l)] : toneAlpha[l]) * (1 + lit * 1.4));
                        // Porter-Duff "over".
                        R = cr * a + R * (1 - a); G = cg * a + G * (1 - a); B = cb * a + B * (1 - a);
                        A = a + A * (1 - a);
                    }
                    const o = (r * cols + c) * 4;
                    if (opaque) {
                        // Over black: premultiplied colour, fully opaque.
                        px[o] = Math.min(255, R); px[o + 1] = Math.min(255, G); px[o + 2] = Math.min(255, B);
                        px[o + 3] = 255;
                        continue;
                    }
                    if (A <= 0) continue;
                    px[o] = Math.min(255, R / A); px[o + 1] = Math.min(255, G / A); px[o + 2] = Math.min(255, B / A);
                    px[o + 3] = Math.round(A * 255);
                }
            };
            setTimeout(slice, 0);
            return tag('');
        };
        const coarse = paint(gid + '|coarse', 8, nx0, ny0, Math.ceil(W * 6 / 8), Math.ceil(H * 6 / 8), 5, false);
        let out = `<g class="gm-neb-layer">${coarse}</g>`;
        if (fine) {
            // Finer pixels + extra octaves over the view, opaque over black,
            // so it simply covers the coarse field (no clip / mask needed).
            // Same pixel size as the planets; only if the patch would get too
            // big for the budget do the cells grow.
            // At full zoom the nebula goes well below the planet pixels (close
            // to screen pixels); the pixel budget below caps the cost.
            const unit = (this.mapPixelUnit ? this.mapPixelUnit() : 8 / detail) / (detail >= 8 ? 4 : 1);
            const want = Math.max(unit, Math.sqrt(fine.w * fine.h / NEB_PIXEL_BUDGET));
            // Cell = 8 / 2^k: nests exactly in the coarse 8-unit grid (patch
            // origin is a multiple of 8), so pixels never shift between patches.
            const cell = 8 / Math.pow(2, Math.max(0, Math.floor(Math.log2(8 / want))));
            // Same base octaves as the coarse field; finer cells add detail on top.
            const oct = Math.min(7, 5 + Math.max(0, Math.round(Math.log2(8 / cell)) - 1));
            const fk = `${gid}|f${cell}|${fine.x}|${fine.y}|${fine.w}|${fine.h}`;
            const fineTag = paint(fk, cell, fine.x, fine.y, Math.ceil(fine.w / cell), Math.ceil(fine.h / cell), oct, true);
            // Keep the last finished patch underneath until the new one is ready
            // (otherwise the coarse field flashes through while it computes).
            const prev = this._nebLastFine;
            const prevTag = prev && prev.key !== fk && this._nebUrls[prev.key] ? prev.tag : '';
            if (this._nebUrls[fk]) this._nebLastFine = { key: fk, tag: fineTag };
            out += `<g class="gm-neb-layer gm-neb-fine">${prevTag}${fineTag}</g>`;
        }
        const W5 = 6;
        // Distant pixel galaxies: tilted ellipse of pixels, bright core.
        let far = '';
        const count = 5 + Math.floor(rnd() * 5);
        for (let i = 0; i < count; i++) {
            let gx, gy, tries = 0;
            do {
                gx = nx0 + rnd() * W * W5;
                gy = ny0 + rnd() * H * W5;
                tries++;
            } while (tries < 20 && Math.hypot((gx - cxm) / W, (gy - cym) / H) < 1.1);
            const rx = 10 + rnd() * 22, ry = rx * (0.25 + rnd() * 0.4), ang = rnd() * Math.PI;
            const p = 2, ca = Math.cos(ang), sa = Math.sin(ang);
            const col = hex(layers[i % layers.length].rgb.map((v) => v * 0.8 + 60));
            let d1 = '', d2 = '';
            for (let yy = -rx; yy <= rx; yy += p) {
                for (let xx = -rx; xx <= rx; xx += p) {
                    const u = (xx * ca + yy * sa) / rx, v = (-xx * sa + yy * ca) / ry;
                    const e = u * u + v * v;
                    if (e > 1) continue;
                    const px = Math.round((gx + xx) / p) * p, py = Math.round((gy + yy) / p) * p;
                    if (e < 0.08) d1 += `M${px} ${py}h${p}v${p}h${-p}z`;
                    else if (rnd() < 0.75 - e * 0.55) d2 += `M${px} ${py}h${p}v${p}h${-p}z`;
                }
            }
            far += `<path d="${d2}" fill="${col}" opacity="0.28"/><path d="${d1}" fill="#fff4e0" opacity="0.75"/>`;
        }
        const svg = `<g class="gm-nebula" shape-rendering="crispEdges">${out}${far}</g>`;
        return svg;
    },

    /**
     * Pixel suns behind the map (planetConfigManager.getGalaxySuns): stepped
     * glow squares, a pixel disc and a bright core, gently pulsing.
     */
    galaxySunsSvg(W, H, pad) {
        if (typeof planetConfigManager === 'undefined' || !planetConfigManager.getGalaxySuns) return '';
        const suns = planetConfigManager.getGalaxySuns(this.galaxyId) || [];
        this.prepareSunDrift(W, H, pad);
        return suns.map((s, i) => {
            const pose = this._sunDrift[i];
            const at = this.sunDriftPos(pose, performance.now() / 1000);
            const r = pose.r;
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
            // Star pixels follow the zoom detail (planet pixel size, so the sun
            // sharpens with the planets); glow rings stay a few steps coarser.
            const detail = this.getMapDetail ? this.getMapDetail() : 1;
            const unit = this.mapPixelUnit ? this.mapPixelUnit() : 0;
            const px = Math.max(unit > 0 ? unit : 0.25, Math.min(Math.max(2, Math.round(r / 14)), r / (14 * detail)));
            const gp = Math.max(px * 2, Math.round(r / 4) / detail);
            const disc = pixelCircle(r, px);
            // Limb darkening: a slightly smaller, brighter inner disc.
            const inner = pixelCircle(Math.round(r * 0.72), px);
            const core = pixelCircle(Math.round(r * 0.38), px);
            // No rays: the star itself animates (breathing body, flickering
            // surface, pulsing glow) — see .gm-sun-body in styles.css.
            const delay = `animation-delay:${(-i * 1.7).toFixed(1)}s`;
            return `
                <g class="gm-sun gm-sun-${s.kind}" data-sun="${i}" transform="translate(${at.x.toFixed(1)},${at.y.toFixed(1)})" style="--sun:${s.color};--sun-glow:${s.glow}">
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
     * Sun drift: each sun circles its base spot very slowly (one loop in
     * ~10 minutes); planets are shaded from the suns' direction (16 steps,
     * weighted by closeness; planetLightVector re-bakes the sphere). A 1 s timer moves both while the map is up.
     */
    prepareSunDrift(W, H, pad) {
        const suns = (typeof planetConfigManager !== 'undefined' && planetConfigManager.getGalaxySuns)
            ? planetConfigManager.getGalaxySuns(this.galaxyId) || [] : [];
        this._sunDrift = suns.map((s, i) => {
            const r = Math.max(24, Math.round(s.r * (W - pad * 2) / 1.3));
            return {
                x: W / 2 + (s.x - 0.5) * (W - pad * 2) * 2.0,
                y: H / 2 + (s.y - 0.5) * (H - pad * 2) * 2.0,
                r: r,
                amp: r * 0.8,
                period: 540 + i * 170,
                phase: i * 2.3 + (s.x + s.y) * 5
            };
        });
        this.startSunDrift();
    },

    sunDriftPos(pose, t) {
        const a = pose.phase + (t / pose.period) * Math.PI * 2;
        return { x: pose.x + Math.cos(a) * pose.amp, y: pose.y + Math.sin(a) * pose.amp * 0.6 };
    },

    /** Light direction step (0 … 15) from the suns for a planet at x, y; null = default. */
    planetLightDir(x, y) {
        const drift = this._sunDrift || [];
        if (!drift.length) return null;
        const t = performance.now() / 1000;
        let vx = 0;
        let vy = 0;
        drift.forEach((pose) => {
            const p = this.sunDriftPos(pose, t);
            const dx = p.x - x;
            const dy = p.y - y;
            const d = Math.hypot(dx, dy) || 1;
            const w = (pose.r * pose.r) / (d * d);
            vx += dx / d * w;
            vy += dy / d * w;
        });
        if (!vx && !vy) return null;
        const step = Math.round(Math.atan2(vy, vx) / (Math.PI * 2) * 16);
        return ((step % 16) + 16) % 16;
    },

    startSunDrift() {
        if (this._sunDriftTimer) return;
        this._sunDriftTimer = setInterval(() => {
            const svg = document.querySelector('.galaxy-map-svg');
            if (!svg || !this._sunDrift) {
                clearInterval(this._sunDriftTimer);
                this._sunDriftTimer = null;
                return;
            }
            const t = performance.now() / 1000;
            svg.querySelectorAll('.gm-sun[data-sun]').forEach((el) => {
                const pose = this._sunDrift[+el.getAttribute('data-sun')];
                if (!pose) return;
                const p = this.sunDriftPos(pose, t);
                el.setAttribute('transform', `translate(${p.x.toFixed(1)},${p.y.toFixed(1)})`);
            });
            // New light step: the spin timer redraws that planet's frame.
            svg.querySelectorAll('.gm-planet-lit').forEach((el) => {
                const dir = this.planetLightDir(+el.getAttribute('data-lit-x'), +el.getAttribute('data-lit-y'));
                const span = el.querySelector('[data-planet-spin]');
                if (!span || dir == null) return;
                const parts = String(span.getAttribute('data-planet-spin')).split('|');
                if (parts[2] === String(dir)) return;
                span.setAttribute('data-planet-spin', parts[0] + '|' + parts[1] + '|' + dir);
            });
        }, 1000);
    },

    /**
     * Lanes from each station / trading post to its anchor planet(s), routed
     * around other bodies (routePath); lit when the station is open.
     */
    /**
     * Line drawn as square pixels on a grid of the current art pixel size
     * (2 map units at detail 1, finer when zoomed in), with a wider dim
     * pixel glow behind. dash = [on, off] in pixels.
     */
    pixelLineSvg(points, cls, opts) {
        const o = opts || {};
        const d = this.getMapDetail ? this.getMapDetail() : 1;
        // Thinner in map units as the zoom detail rises, so lines stay
        // about the same thickness on screen instead of growing chunky.
        const width = (o.width || 2.6) / this.getLineDetail();
        // Fine grid (smoother diagonals), but never more than ~8 px across.
        const p = Math.max(1 / d, width / 8);
        const rad = width / 2 / p;          // brush radius in pixels
        // Energy beam: white-hot centre, coloured core, glow, faint halo.
        const hotRad = Math.max(0.5, rad * 0.4);
        const glowRad = rad + 1.6;
        const haloRad = rad + 3.6;
        const hotCells = new Map();
        const coreCells = new Map();
        const glowCells = new Map();
        const haloCells = new Map();
        // Optional slice of a two-point line (0..1 along it): only pixels
        // whose centre projects into [t0, t1) are kept, so slices tile exactly.
        const rg = o.range && points.length === 2 ? o.range : null;
        const rx = rg ? points[1].x - points[0].x : 0;
        const ry = rg ? points[1].y - points[0].y : 0;
        const rl2 = rx * rx + ry * ry || 1;
        const mark = (map, gx, gy) => {
            if (rg) {
                const t = (((gx + 0.5) * p - points[0].x) * rx + ((gy + 0.5) * p - points[0].y) * ry) / rl2;
                if (t < rg[0] ? rg[0] > 0 : (t >= rg[1] && rg[1] < 1)) return;
            }
            let row = map.get(gy);
            if (!row) { row = new Set(); map.set(gy, row); }
            row.add(gx);
        };
        // Dash pattern in brush widths along the path.
        const dashOn = o.dash ? o.dash[0] * width : 0;
        const dashLen = o.dash ? (o.dash[0] + o.dash[1]) * width : 0;
        let travelled = 0;
        const R = Math.ceil(haloRad);
        let segs = points;
        if (rg) {
            const L = Math.sqrt(rl2) || 1;
            const ext = (haloRad + 1) * p / L;
            const at = (t) => ({ x: points[0].x + rx * t, y: points[0].y + ry * t });
            segs = [at(Math.max(0, rg[0] - ext)), at(Math.min(1, rg[1] + ext))];
        }
        for (let i = 0; i < segs.length - 1; i++) {
            const a = segs[i], b = segs[i + 1];
            const len = Math.hypot(b.x - a.x, b.y - a.y);
            const n = Math.max(1, Math.ceil(len / p));
            for (let s = 0; s <= n; s++) {
                const along = travelled + len * s / n;
                if (o.dash && (along % dashLen) >= dashOn) continue;
                const cx = (a.x + (b.x - a.x) * s / n) / p;
                const cy = (a.y + (b.y - a.y) * s / n) / p;
                const bx = Math.round(cx), by = Math.round(cy);
                for (let yy = -R; yy <= R; yy++) {
                    for (let xx = -R; xx <= R; xx++) {
                        const gx = bx + xx, gy = by + yy;
                        const dd = Math.hypot(gx + 0.5 - cx - 0.5, gy + 0.5 - cy - 0.5);
                        if (dd > haloRad) continue;
                        mark(dd <= hotRad ? hotCells : dd <= rad ? coreCells : dd <= glowRad ? glowCells : haloCells, gx, gy);
                    }
                }
            }
            travelled += len;
        }
        // Row runs → one compact path per layer.
        // Flow: bright pulses sliding along the beam (animated dash offset).
        // Pulse spacing is in map units so slices of one line stay in phase.
        let flow = '';
        if (!o.dash && !o.noFlow) {
            const fp = rg
                ? [{ x: points[0].x + rx * rg[0], y: points[0].y + ry * rg[0] }, { x: points[0].x + rx * rg[1], y: points[0].y + ry * rg[1] }]
                : points;
            const off = rg ? Math.sqrt(rl2) * rg[0] : 0;
            // Irregular dark bands (in brush widths) so the beam reads as a
            // moving current rather than an even tube.
            const pattern = [4, 3, 1.5, 5, 6, 2, 2.5, 8];
            const period = pattern.reduce((m, v) => m + v, 0) * width;
            const dashes = pattern.map((v) => (v * width).toFixed(2)).join(' ');
            flow = `<path class="gm-pxline-flow" fill="none" d="M${fp.map((q) => q.x.toFixed(2) + ' ' + q.y.toFixed(2)).join('L')}" ` +
                `style="stroke-width:${(rad * 2 * p).toFixed(2)};stroke-dasharray:${dashes};--flow-len:${period.toFixed(2)}px;--flow-from:${(-(off % period)).toFixed(2)}px"/>`;
        }
        // A cell belongs to its innermost layer: skip it in outer ones.
        const toPath = (map, ...skips) => {
            let out = '';
            map.forEach((row, gy) => {
                const xs = Array.from(row)
                    .filter((x) => !skips.some((sk) => sk.get(gy) && sk.get(gy).has(x)))
                    .sort((m, q) => m - q);
                for (let k = 0; k < xs.length;) {
                    let e = k;
                    while (e + 1 < xs.length && xs[e + 1] === xs[e] + 1) e++;
                    const x = +(xs[k] * p).toFixed(3), y = +(gy * p).toFixed(3), w = +((e - k + 1) * p).toFixed(3);
                    out += `M${x} ${y}h${w}v${+p.toFixed(3)}h${-w}z`;
                    k = e + 1;
                }
            });
            return out;
        };
        return `<g class="${cls} gm-pxline" shape-rendering="crispEdges">` +
            `<path class="gm-pxline-halo" d="${toPath(haloCells, glowCells, coreCells, hotCells)}"/>` +
            `<path class="gm-pxline-glow" d="${toPath(glowCells, coreCells, hotCells)}"/>` +
            `<path class="gm-pxline-core" d="${toPath(coreCells, hotCells)}"/>` +
            `<path class="gm-pxline-hot" d="${toPath(hotCells)}"/>` + flow + `</g>`;
    },

    /**
     * Radius of the visible planet disc in map units: the icon box minus
     * the ring / atmosphere margin of the pixel grid (planet-svgs).
     */
    planetSurfaceRadius(planetId) {
        const seed = String(planetId || '').split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
        const size = 32 + (seed % 7) * 10;
        let frac = 0.37;
        try {
            const sid = String(planetId || '').toLowerCase();
            const m = typeof planetSVGManager !== 'undefined' && planetSVGManager.getPlanetSpinModel
                ? planetSVGManager.getPlanetSpinModel(sid, 1) : null;
            if (m && m.r && m.n) frac = (m.r + 0.5) / m.n;
        } catch (e) { /* keep default */ }
        return size * frac;
    },

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
                const planetInset = this.planetSurfaceRadius(pid);
                p[p.length - 1] = trim(p[p.length - 1], p[p.length - 2], planetInset);
                out += this.pixelLineSvg(p, 'gm-edge gm-post-lane ' + (open ? 'lit' : 'dim'), { dash: [2, 1] });
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
        // Only the factions attacking the player here (never the own side).
        const factions = planetConfigManager.getHostileFactions
            ? planetConfigManager.getHostileFactions(planetId)
            : planetConfigManager.getPlanetFactions(planetId);
        if (!factions.length) return '';
        if (typeof profileSelectionManager === 'undefined' || !profileSelectionManager.getFactionEmblemHtml) return '';
        // Bare faction icons — no boxes around them.
        const names = factions.map((f) =>
            `<span class="gm-node-faction-icon" title="${String(f).toUpperCase()}">${profileSelectionManager.getFactionEmblemHtml(f, 16, this.getMapDetail())}</span>`
        ).join('');
        const w = 80;
        const h = 18;
        return `<foreignObject x="${-w / 2}" y="${-size / 2 - h - 8}" width="${w}" height="${h}">` +
            `<div xmlns="http://www.w3.org/1999/xhtml" class="gm-node-factions">${names}</div></foreignObject>`;
    },

    /** Player's active ship rendered once to a small PNG data URL (cached per model). */
    /**
     * Pixel grid multiplier for map art at the current zoom — planets and
     * the player ship share it, so both get finer pixels as you zoom in.
     */
    /**
     * Line thinning factor: the zoom snapped to quarter-octave steps
     * (×1.19 each), so lines thin out in small pixel steps while zooming.
     */
    getLineDetail() {
        const z = (typeof this.mapZoom === 'number' && Number.isFinite(this.mapZoom)) ? this.mapZoom : 1;
        return Math.pow(2, Math.round(Math.log2(Math.max(1, Math.min(12, z))) * 4) / 4);
    },

    getMapDetail() {
        const z = (typeof this.mapZoom === 'number' && Number.isFinite(this.mapZoom)) ? this.mapZoom : 1;
        return z >= 6 ? 8 : (z >= 2.5 ? 4 : (z >= 1.35 ? 2 : 1));
    },

    /**
     * Keep map objects visually proportional while the camera zooms.
     * Without this compensation, planets and stations grow linearly with the
     * viewBox and become oversized pixel blocks before their finer art loads.
     */
    getMapObjectScale() {
        const z = (typeof this.mapZoom === 'number' && Number.isFinite(this.mapZoom))
            ? Math.max(1, this.mapZoom) : 1;
        return 1 / Math.sqrt(z);
    },

    /**
     * Player's active ship rendered to a small PNG data URL, at `detail`×
     * the base 11×15 grid (cached per model + detail).
     */
    getShipIconUrl(detail) {
        const model = this.getActiveShipModel && this.getActiveShipModel();
        if (!model || typeof shipRenderer === 'undefined' || !shipRenderer.renderShipPreview) return null;
        const dk = Math.max(1, Math.round(detail || this.getMapDetail()));
        const outlinePx = this.getShipOutlineTexels(dk);
        const key = (model.id || model.name || 'ship') + '|' + (model.layout ? JSON.stringify(model.layout).length : 0);
        this._shipIcons = this._shipIcons && this._shipIconsKey === key ? this._shipIcons : {};
        this._shipIconsKey = key;
        const cacheKey = dk + '|' + outlinePx;
        if (this._shipIcons[cacheKey]) return this._shipIcons[cacheKey];
        let url = null;
        try {
            const inner = document.createElement('canvas');
            // Small render → coarse voxels when scaled up pixelated on the map.
            inner.width = 11 * dk;
            inner.height = 15 * dk;
            shipRenderer.renderShipPreview(inner, model, 1);
            // Dark outline (1 base pixel wide, at least 1 px), pixel-exact:
            // empty pixels touching the ship become dark.
            const c = document.createElement('canvas');
            c.width = 13 * dk;
            c.height = 17 * dk;
            const ctx = c.getContext('2d');
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(inner, dk, dk);
            const img = ctx.getImageData(0, 0, c.width, c.height);
            const d = img.data;
            // Hard alpha: faint anti-aliased pixels made a ragged fringe.
            for (let o = 0; o < d.length; o += 4) d[o + 3] = d[o + 3] > 96 ? 255 : 0;
            const width = outlinePx;
            for (let pass = 0; pass < width; pass++) {
                const solid = (x, y) => x >= 0 && y >= 0 && x < c.width && y < c.height && d[(y * c.width + x) * 4 + 3] > 0;
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
            }
            ctx.putImageData(img, 0, 0);
            url = c.toDataURL();
            // Only cache once ship art is loaded; before that it's a placeholder.
            const ready = typeof spriteLoader === 'undefined' || spriteLoader.loaded;
            if (ready) this._shipIcons[cacheKey] = url;
        } catch (e) {
            url = null;
        }
        return url;
    },

    /**
     * Outline width in texture pixels so it stays ~2 screen px at any zoom.
     * One texel's screen size = (marker px per base pixel / dk) × SVG screen scale.
     */
    getShipOutlineTexels(dk) {
        const svg = this.overlay && this.overlay.querySelector('.galaxy-map-svg');
        const ctm = svg && svg.getScreenCTM ? svg.getScreenCTM() : null;
        const scale = ctm ? Math.hypot(ctm.a, ctm.b) : 0;
        if (!scale) return Math.max(1, Math.round(dk * 0.75));
        const basePx = Math.max(1, Math.round(32 * 0.7 / 13)); // same as the marker sizing
        const texelScreen = basePx * scale / dk;
        return Math.max(1, Math.min(dk * 2, Math.round(2 / texelScreen)));
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
    /**
     * Selection corners keep a fixed on-screen gap to the planet surface and a
     * fixed on-screen size at every zoom: rebuilt from the current screen
     * scale (screen px per map unit), snapped to whole screen pixels.
     */
    updateSelectionFrames() {
        const svg = this.overlay && this.overlay.querySelector('.galaxy-map-svg');
        if (!svg || !svg.getScreenCTM) return;
        const ctm = svg.getScreenCTM();
        const s = ctm ? Math.hypot(ctm.a, ctm.b) : 0;
        if (!s) return;
        const px = (n) => Math.max(1, Math.round(n)) / s;   // screen px → map units
        const key = s.toFixed(4);
        svg.querySelectorAll('.gm-frame-slot').forEach((slot) => {
            if (slot._frameKey === key) return;
            slot._frameKey = key;
            const r = Number(slot.getAttribute('data-frame-r')) || 16;
            const post = slot.hasAttribute('data-frame-post');
            const gap = post ? 8 : 12, arm = post ? 10 : 16, thick = post ? 3 : 4;
            // Corner sits `gap` px outside the surface (a square frame around a disc).
            const f = r + px(gap);
            slot.innerHTML = this.selectionFrameSvg(f, px(arm), px(thick));
        });
    },

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
        // Hover ends as soon as the pointer leaves the planet disc — the node
        // group (frame, emblems, labels) is much larger, so pointerleave came late.
        const svg = this.overlay.querySelector('.galaxy-map-svg');
        if (svg && !svg._gmHoverBound) {
            svg._gmHoverBound = true;
            const clear = () => { if (this.hoveredPlanetId) this.setHoveredPlanet(null); };
            svg.addEventListener('pointerleave', clear);
            const inDisc = (pid, e) => {
                const ctm = svg.getScreenCTM && svg.getScreenCTM();
                const at = this.locationPoint && this.locationPoint({ kind: 'planet', id: pid });
                if (!ctm || !at) return true;
                const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
                const seed = String(pid).split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
                return Math.hypot(pt.x - at.x, pt.y - at.y) <= (32 + (seed % 7) * 10) / 2;
            };
            svg.addEventListener('pointermove', (e) => {
                const pid = this.hoveredPlanetId;
                if (pid) {
                    if (!inDisc(pid, e)) clear();
                    return;
                }
                // Back onto the disc from the frame area (no new pointerenter).
                const node = e.target && e.target.closest && e.target.closest('.gm-node[data-planet]');
                const over = node && node.getAttribute('data-planet');
                if (over && inDisc(over, e)) this.setHoveredPlanet(over);
            });
        }
        this.overlay.querySelectorAll('.gm-node').forEach(node => {
            node.addEventListener('pointerenter', () => {
                const pid = node.getAttribute('data-planet');
                if (!pid || this.hoveredPlanetId === pid) return;
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

    /**
     * Camera: when the selection changes, glide (animated viewBox) so both
     * the player ship and the selected planet / station are in view. Only
     * zooms out if they don't fit; never zooms in past the player's zoom.
     */
    frameSelectionCamera(withShip) {
        if (this._flight || !this.overlay || typeof profileManager === 'undefined') return;
        if (!withShip) this.armCameraIdleReturn();
        const svg = this.overlay.querySelector('.galaxy-map-svg');
        if (!svg || !svg.viewBox || !svg.viewBox.baseVal) return;
        const target = this.selectedPostId
            ? { kind: 'post', id: this.selectedPostId }
            : (this.selectedPlanetId ? { kind: 'planet', id: this.selectedPlanetId } : null);
        const key = target ? target.kind + ':' + target.id : '';
        if (key === this._camKey && !withShip) return;
        this._camKey = key;
        if (!target || !this.locationPoint) return;
        const shipLoc = profileManager.getShipLocation ? profileManager.getShipLocation(this.galaxyId) : null;
        const a = this.locationPoint(target);
        const b = shipLoc ? this.locationPoint(shipLoc) : null;
        if (!a) return;
        // The ship joins the frame only after the cursor has been idle (armCameraIdleReturn).
        const pts = b && withShip ? [a, b] : [a];
        const margin = 110;
        const x0 = Math.min(...pts.map((p) => p.x)) - margin;
        const x1 = Math.max(...pts.map((p) => p.x)) + margin;
        const y0 = Math.min(...pts.map((p) => p.y)) - margin;
        const y1 = Math.max(...pts.map((p) => p.y)) + margin;
        const cur = svg.viewBox.baseVal;
        const from = [cur.x, cur.y, cur.width, cur.height];
        const aspect = cur.width / Math.max(1, cur.height);
        let w = cur.width;
        // Selecting a single target only pans: keep the user's zoom. Widen
        // the frame only when the ship has to fit in as well.
        if (pts.length > 1) {
            if (x1 - x0 > w) w = x1 - x0;
            if ((y1 - y0) * aspect > w) w = (y1 - y0) * aspect;
        }
        const h = w / aspect;
        const cx = (x0 + x1) / 2;
        const cy = (y0 + y1) / 2;
        const to = [cx - w / 2, cy - h / 2, w, h];
        // Persist as the camera state getMapViewBox uses on re-render.
        this.mapZoom = (this.mapZoom || 1) * (cur.width / w);
        this._panAnchor = { x: cx, y: cy };
        this.mapPan = { x: 0, y: 0 };
        // Animate the viewBox.
        const start = performance.now();
        const dur = 450;
        const ease = (t) => 1 - Math.pow(1 - t, 3);
        const token = (this._camAnim = {});
        const step = (now) => {
            if (this._camAnim !== token || !svg.isConnected || this._flight) return;
            const t = Math.min(1, (now - start) / dur);
            const k = ease(t);
            const vb = from.map((v, i) => v + (to[i] - v) * k);
            svg.setAttribute('viewBox', vb.map((v) => v.toFixed(2)).join(' '));
            this.updateSelectionFrames();
            if (t < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    },

    /**
     * Glide back to the player ship only after 5 s without cursor activity
     * on the map; any pointer move / wheel / press restarts the wait.
     */
    armCameraIdleReturn() {
        const area = this.overlay && this.overlay.querySelector('#gmMapArea');
        if (!area) return;
        const restart = () => {
            clearTimeout(this._camIdleTimer);
            this._camIdleTimer = setTimeout(() => {
                if (!this.overlay || !area.isConnected || this._flight) return;
                this.returnCameraToShip();
            }, 5000);
        };
        if (!area._gmIdleBound) {
            area._gmIdleBound = true;
            ['pointermove', 'pointerdown', 'wheel'].forEach((ev) =>
                area.addEventListener(ev, restart, { passive: true }));
        }
        restart();
    },

    /** Glide the camera (current zoom) back to centre on the player ship. */
    returnCameraToShip() {
        const svg = this.overlay && this.overlay.querySelector('.galaxy-map-svg');
        if (!svg || !svg.viewBox || !svg.viewBox.baseVal || !this.locationPoint) return;
        const loc = profileManager.getShipLocation ? profileManager.getShipLocation(this.galaxyId) : null;
        const p = loc ? this.locationPoint(loc) : null;
        if (!p) return;
        const cur = svg.viewBox.baseVal;
        const from = [cur.x, cur.y, cur.width, cur.height];
        const to = [p.x - cur.width / 2, p.y - cur.height / 2, cur.width, cur.height];
        if (Math.hypot(to[0] - from[0], to[1] - from[1]) < 2) return;
        this._panAnchor = { x: p.x, y: p.y };
        this.mapPan = { x: 0, y: 0 };
        const start = performance.now();
        // Longer glide with ease-in-out: starts and settles gently.
        const dist = Math.hypot(to[0] - from[0], to[1] - from[1]);
        const dur = Math.min(2200, 1100 + dist * 1.2);
        const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
        const token = (this._camAnim = {});
        const step = (now) => {
            if (this._camAnim !== token || !svg.isConnected || this._flight) return;
            const t = Math.min(1, (now - start) / dur);
            const k = ease(t);
            svg.setAttribute('viewBox', from.map((v, i) => (v + (to[i] - v) * k).toFixed(2)).join(' '));
            this.updateSelectionFrames();
            if (t < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    },

    /**
     * Pointer (client px) → map viewBox coords. Uses the bounding rect, which
     * is zoom-corrected (zoom-rect-fix.js); getScreenCTM ignores the GUI's CSS
     * zoom on some engines, which made the zoom anchor drift and the map jump.
     */
    clientToMapPoint(svg, clientX, clientY) {
        const vb = svg.viewBox && svg.viewBox.baseVal;
        const r = svg.getBoundingClientRect();
        if (!vb || !vb.width || !r.width || !r.height) return null;
        // preserveAspectRatio="xMidYMid meet": uniform scale, centred.
        const s = Math.min(r.width / vb.width, r.height / vb.height);
        const ox = r.left + (r.width - vb.width * s) / 2;
        const oy = r.top + (r.height - vb.height * s) / 2;
        return { x: vb.x + (clientX - ox) / s, y: vb.y + (clientY - oy) / s };
    },

    bindMapZoom() {
        this.armCameraIdleReturn();
        const svg = this.overlay.querySelector('.galaxy-map-svg');
        if (!svg) return;
        requestAnimationFrame(() => this.updateSelectionFrames());
        // Detail swap (planets, stations, lines, stars) is heavy: run it once
        // the zoom has settled, not on every animation frame.
        const swapDetail = (force) => {
            const cur = this.overlay && this.overlay.querySelector('.galaxy-map-svg');
            if (!cur) return;
            const detail = this.getMapDetail();
            if (this._mapArtDetail === detail && force === true) {
                // Same detail, view left the fine nebula patch: only swap space.
                // Build the space layer alone (not the whole map).
                const fresh = document.createElement('div');
                fresh.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg">${this.galaxyStarsSvg(GM_MAP_W, GM_MAP_H)}</svg>`;
                const next = fresh.querySelector('.gm-space'), old = cur.querySelector('.gm-space');
                if (next && old) old.replaceWith(next);
                return;
            }
            if (this._mapArtDetail === detail && force === 'lines') {
                // Only the line thickness step changed: swap the lines alone.
                this._mapLineDetail = this.getLineDetail();
                const old = cur.querySelector('.gm-lines');
                if (old) old.innerHTML = this.linesLayerHtml();
                if (this.syncRoutePreview) this.syncRoutePreview();
                return;
            }
            if (this._mapArtDetail === detail) return;
            this._mapArtDetail = detail;
            this._mapLineDetail = this.getLineDetail();
            // Stars / lines are drawn on the art pixel grid: swap in fresh ones.
            // Only these layers are built — rendering the whole map here made
            // every zoom step rebuild all planets, stations and checkpoints.
            cur.style.setProperty('--gm-px', String(1 / detail));
            this._linesByDetail = {}; // checkpoints in the lines follow the art detail
            const fresh = document.createElement('div');
            fresh.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg">${this.galaxyStarsSvg(GM_MAP_W, GM_MAP_H)}</svg>`;
            const nextSpace = fresh.querySelector('.gm-space'), oldSpace = cur.querySelector('.gm-space');
            if (nextSpace && oldSpace) oldSpace.replaceWith(nextSpace);
            const oldLines = cur.querySelector('.gm-lines');
            if (oldLines) oldLines.innerHTML = this.linesLayerHtml();
            // Suns sharpen with the zoom detail too.
            const sunsLayer = cur.querySelector('.gm-suns');
            if (sunsLayer && this.galaxySunsSvg) sunsLayer.innerHTML = this.galaxySunsSvg(GM_MAP_W, GM_MAP_H, GM_MAP_PAD);
            if (this.syncRoutePreview) this.syncRoutePreview();
            cur.querySelectorAll('.gm-node[data-planet]').forEach((node) => {
                const pid = node.getAttribute('data-planet');
                const icon = node.querySelector('.gm-node-icon-wrap');
                // Re-render at the node's own size; a fixed 48 clipped small planets.
                const size = Number(node.getAttribute('data-size')) || 48;
                const lit = node.querySelector('.gm-planet-lit');
                const dir = lit ? this.planetLightDir(+lit.getAttribute('data-lit-x'), +lit.getAttribute('data-lit-y')) : null;
                if (pid && icon) icon.innerHTML = this.planetIconHtml(pid, size, true, dir);
                // Faction emblems follow the zoom detail (finer art).
                const facs = node.querySelector('.gm-node-factions');
                if (pid && facs) {
                    const tmp = document.createElement('div');
                    tmp.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg">${this.planetFactionsSvg(pid, size)}</svg>`;
                    const next = tmp.querySelector('.gm-node-factions');
                    if (next) facs.innerHTML = next.innerHTML;
                }
            });
            // Stations share the zoom detail (sub-pixel shading, windows, cells).
            cur.querySelectorAll('.gm-post-node[data-post]').forEach((node) => {
                const art = node.querySelector('.gm-post-art');
                const post = art && this.getTradingPosts().find((p) => p.id === node.getAttribute('data-post'));
                if (post) art.innerHTML = this.stationPixelsSvg(post, detail);
            });
            applyShip();
        };
        let apply = () => {
            const cur = this.overlay && this.overlay.querySelector('.galaxy-map-svg');
            if (!cur) return;
            // Only the camera moves: set the viewBox directly (no re-render).
            const v = this.getMapViewBox(GM_MAP_W, GM_MAP_H, GM_MAP_PAD);
            cur.setAttribute('viewBox', v.join(' '));
            this.updateSelectionFrames();
            // Ship grows only gently when zooming in (1/√zoom), so it stays readable.
            const shipScale = cur.querySelector('.gm-ship-scale');
            if (shipScale) shipScale.setAttribute('transform', `scale(${(1 / Math.sqrt(Math.max(1, this.mapZoom || 1))).toFixed(4)})`);
            if (this._mapArtDetail === this.getMapDetail()) {
                if (this._mapLineDetail !== this.getLineDetail()) {
                    clearTimeout(this._lineTimer);
                    this._lineTimer = setTimeout(() => swapDetail('lines'), this._zoomAnim ? 120 : 0);
                }
                // Panned / zoomed out of the fine nebula patch → rebuild it (debounced).
                const R = this._nebulaRegion;
                if (R && (v[0] < R.x || v[1] < R.y || v[0] + v[2] > R.x + R.w || v[1] + v[3] > R.y + R.h)) {
                    clearTimeout(this._nebTimer);
                    this._nebTimer = setTimeout(() => swapDetail(true), 80);
                }
                return;
            }
            clearTimeout(this._detailTimer);
            this._detailTimer = setTimeout(swapDetail, this._zoomAnim ? 180 : 0);
        };
        // Ship outline is baked into its texture, so refresh it on every zoom
        // step to keep the outline the same on-screen width.
        const applyShip = () => {
            const cur = this.overlay && this.overlay.querySelector('.galaxy-map-svg');
            const shipImg = cur && cur.querySelector('.gm-ship-marker-img');
            const url = shipImg && this.getShipIconUrl(this.getMapDetail());
            if (url && shipImg.getAttribute('href') !== url) shipImg.setAttribute('href', url);
        };
        // Any manual camera input stops a running glide, which would
        // otherwise keep writing its own viewBox and snap the zoom back.
        const stopGlide = () => { this._camAnim = null; };
        const stopZoom = () => { this._zoomAnim = null; };
        this._mapArtDetail = this.getMapDetail();
        this._mapLineDetail = this.getLineDetail();
        const delayShipLabel = () => {
            this._shipLabelReady = false;
            clearTimeout(this._shipLabelTimer);
            this._shipLabelTimer = setTimeout(() => {
                this._shipLabelReady = true;
                apply();
            }, 1500);
        };
        // Zoom out below the snug fit (0.35) to see the surroundings, in up
        // to 12x; the point under the cursor stays put.
        // Smooth zoom: the wheel moves a target, a frame loop eases the zoom
        // toward it (log space) while the point under the cursor stays put.
        const zoomStep = (before, next, pt) => {
            const cur = this.overlay && this.overlay.querySelector('.galaxy-map-svg');
            if (cur && pt) {
                const vb = cur.viewBox.baseVal;
                if (!this.mapPan) {
                    this._panAnchor = { x: vb.x + vb.width / 2, y: vb.y + vb.height / 2 };
                    this.mapPan = { x: 0, y: 0 };
                }
                const cx = vb.x + vb.width / 2, cy = vb.y + vb.height / 2;
                const f = 1 - before / next;
                this.mapPan.x += (pt.x - cx) * f;
                this.mapPan.y += (pt.y - cy) * f;
            }
            this.mapZoom = next;
            apply();
        };
        // A camera glide writes its own viewBox; adopt that as the zoom/pan
        // state first, otherwise the first zoom step snaps back (jump).
        const syncZoomToView = () => {
            const cur = this.overlay && this.overlay.querySelector('.galaxy-map-svg');
            if (!cur || !cur.viewBox || !cur.viewBox.baseVal) return;
            const vb = cur.viewBox.baseVal;
            if (!vb.width) return;
            const z0 = this.mapZoom;
            this.mapZoom = 1;
            const base = this.getMapViewBox(GM_MAP_W, GM_MAP_H, GM_MAP_PAD);
            this.mapZoom = z0;
            this.mapZoom = Math.min(12, Math.max(0.35, base[2] / vb.width));
            this._panAnchor = { x: vb.x + vb.width / 2, y: vb.y + vb.height / 2 };
            this.mapPan = { x: 0, y: 0 };
        };
        const runZoom = () => {
            const a = this._zoomAnim;
            if (!a || !this.overlay || !this.overlay.isConnected) { this._zoomAnim = null; return; }
            const before = this.mapZoom || 1;
            const lb = Math.log(before), lt = Math.log(a.target);
            const done = Math.abs(lt - lb) < 0.002;
            const next = done ? a.target : Math.exp(lb + (lt - lb) * 0.22);
            zoomStep(before, next, a.pt);
            if (done) {
                this._zoomAnim = null;
                clearTimeout(this._detailTimer);
                swapDetail();
                return;
            }
            requestAnimationFrame(runZoom);
        };
        svg.addEventListener('wheel', (e) => {
            e.preventDefault();
            stopGlide();
            const cur = this.overlay && this.overlay.querySelector('.galaxy-map-svg');
            const pt = cur ? this.clientToMapPoint(cur, e.clientX, e.clientY) : null;
            // Trackpads send many small deltas, mice a few big ones.
            const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
            if (!this._zoomAnim) syncZoomToView();
            const from = this._zoomAnim ? this._zoomAnim.target : (this.mapZoom || 1);
            const target = Math.min(12, Math.max(0.35, from * Math.exp(-Math.max(-120, Math.min(120, dy)) * 0.0022)));
            if (target === from && !this._zoomAnim) return;
            const running = !!this._zoomAnim;
            this._zoomAnim = { target: target, pt: pt };
            delayShipLabel();
            if (!running) requestAnimationFrame(runZoom);
        }, { passive: false });
        // Drag pans at any zoom; a real drag swallows the click that follows
        // so releasing over a planet doesn't select it.
        svg.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            stopGlide();
            stopZoom();
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
            // Border station: focus the planet whose clearing opens it.
            const border = e.target.closest && e.target.closest('.gm-border-station[data-focus-planet]');
            if (border) {
                this.markUserPicked();
                this.selectPlanet(border.getAttribute('data-focus-planet'));
                return;
            }
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
        return `<svg viewBox="-7 -7 14 14" class="${cls}" shape-rendering="crispEdges">` +
            this.stationPixelsSvg(post, 4) + `</svg>`;
    },

    /**
     * Faction base art, left half only (mirrored at draw time). Pixel keys
     * are the gm-base-* depths: k d m l (dark → light), w windows, c glowing
     * core, a blinking lamps. Each faction gets its own silhouette.
     */
    BASE_FORTRESS_ART: {
        terran: [ // Citadel: radar dish, watchtower, tiered keep, spire.
            '.......................a',
            '.......................l',
            '......................lm',
            '......................lm',
            '.....................llm',
            '....................lmwm',
            '....................lmmm',
            '..lll..........a...lllll',
            '.l...l.........m...mwmwm',
            'l..d..l.......lmd..mmmmm',
            '...d..........lmd.llllll',
            '..lmd.........lwd.mwmmwm',
            '..lmd.........lmd.mmmmmm',
            '..lmd.....llllllllllllll',
            '..lwd.....mmwmmwmmwmmwmm',
            '.llmdd....mmmmmmmmmmmmmm',
            '.lmmmd....mmwmmwmmwmmccc',
            '.lmwmd....dddddmmmmmmccc',
            'llllllllllllllllllllllll',
            'mmkkkkmmmmkkkkmmmmkkkkmm',
            'mmmmmmmmmmmmmmmmmmmmmmmm',
            '.ddddddddddddddddddddddd'
        ],
        kronax: [ // War hold: horns sweeping into a chevron, clawed legs.
            'a.......................',
            'ml......................',
            'mml.....................',
            'dmml....................',
            '.dmml.................a.',
            '..dmml................l.',
            '...dmml..............lm.',
            '....dmml............lmm.',
            '.....dmml..........lmmm.',
            '......dmmllllllllllmmmm.',
            '.......dmmmmmmmmmmmmwwmm',
            '.......dmmwmmwmmmmmmmmmc',
            '......ddmmmmmmmmkmmmmmcc',
            '.....dddmmkmmmmkkmmmmccc',
            '....llllllllllllllllllll',
            '...lmmmmdmmmmmmdmmmmmmmm',
            '...ddddd.ddddddd.ddddddd',
            '..ddd.....ddd......ddd..',
            '.dd.......dd........dd..'
        ],
        voidborn: [ // Sanctum: glowing eye-orb cradled by crescent arms.
            '.......................a',
            '.......................l',
            '.......................l',
            '..................llllll',
            '...............lllmmmmmm',
            '.......d......lmmmmwwmmm',
            '......dm.....lmmmwwmmmmm',
            '.....dm.....lmmmwmmmmccc',
            '....dm......lmmmmmmmcccc',
            '...dm.......lmmmmmmmcccc',
            '...dm.......dmmmmmmmmccc',
            '...dm........dmmmmmmmmmm',
            '...dml........ddmmmmmmmm',
            '....dml.........dddddddd',
            '.....dmll...............',
            '......dmmlllllllllllllll',
            '.......ddmmmmkmmmmmkmmmm',
            '.........dddmmmmmmmmmmmm',
            '............dddddddddddd'
        ],
        pirate: [ // Haven: banner mast, patched shacks, stilt pylons.
            '...a....................',
            '...l.lllllll............',
            '...l.lwlllwl............',
            '...l.llwwwll............',
            '...l.lllllll............',
            '...l.l..................',
            '..lml.l.........aa......',
            '..lml.l........lmmd.....',
            '.lmmml.l.......lwmd.....',
            '.lmwmml.l.....lmmmmd...l',
            'lmmmmmlll.....lmwmmd..lm',
            'lmwmmmmmmllllllmmmmmdlmm',
            'llllllllllllllllllllllll',
            '.mkmmkmmmkmmmmkmmmmmkmcc',
            '..dddddddddddddddddddddd',
            '...dd.......dd.......dd.',
            '...dd.......dd.......dd.'
        ],
        machine: [ // Foundry: twin smokestacks, core vents, toothed base.
            '....a..........a........',
            '....m..........m........',
            '...lmd........lmd.......',
            '...lmd........lmd.......',
            '...lwd........lwd.......',
            '...lmd..l..l..lmd..l..ll',
            '...lmd.llllllllmdlllllll',
            '..llllllmmmmmmmmmmmmmmmm',
            '..lmwmwmkkkkkkkkkkkkkkkk',
            '..lmmmmmkcckcckcckcckcck',
            '..lmwmwmkkkkkkkkkkkkkkkk',
            '..lmmmmmmmmmwmmmwmmmwmmm',
            'llllllllllllllllllllllll',
            'mdmdmdmdmdmdmdmdmdmdmdmd',
            'dddddddddddddddddddddddd',
            '.kk....kk....kk....kk...'
        ]
    },

    /**
     * Faction base on its planet: the ruling faction's pixel silhouette in
     * five depths of its colour, with lit windows, a glowing core and
     * blinking lamps. About 30 % of the planet's width, centred so the
     * animated planet stays visible around it.
     */
    baseFortressSvg(size, factionId) {
        const fid = typeof factionShipStyles !== 'undefined' && factionShipStyles.normalizeFaction
            ? factionShipStyles.normalizeFaction(factionId) : factionId;
        const half = this.BASE_FORTRESS_ART[fid] || this.BASE_FORTRESS_ART.terran;
        const rows = half.map((r) => r + r.split('').reverse().join(''));
        const w = rows[0].length;
        const h = rows.length;
        const cell = size * 0.3 / w;
        const at = (x, y) => (rows[y] && rows[y][x]) || '.';
        const rect = (x, y, rw, c) => `<rect x="${x}" y="${y}" width="${rw}" height="1" class="gm-base-${c}"/>`;
        let outline = '';
        let body = '';
        // Dark outline: every empty cell touching the art (8-neighbourhood),
        // merged into horizontal runs.
        for (let y = -1; y <= h; y++) {
            let run = -1;
            for (let x = -1; x <= w + 1; x++) {
                let edge = false;
                if (x <= w && at(x, y) === '.') {
                    for (let dy = -1; dy <= 1 && !edge; dy++) {
                        for (let dx = -1; dx <= 1; dx++) if (at(x + dx, y + dy) !== '.') { edge = true; break; }
                    }
                }
                if (edge && run < 0) run = x;
                if (!edge && run >= 0) { outline += rect(run, y, x - run, 'o'); run = -1; }
            }
        }
        rows.forEach((row, y) => {
            let x = 0;
            while (x < w) {
                const c = row[x];
                let e = x + 1;
                while (e < w && row[e] === c) e++;
                if (c !== '.') body += rect(x, y, e - x, c);
                x = e;
            }
        });
        return `<g class="gm-base-graphic" transform="scale(${cell.toFixed(3)}) translate(${-w / 2} ${-h / 2})" shape-rendering="crispEdges">` +
            outline + body + `</g>`;
    },

    /** Map size of a planet node (same seed as renderMapSvg). */
    planetNodeSize(planetId) {
        const seed = String(planetId || '').split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
        return 32 + (seed % 7) * 10;
    },

    /**
     * The map's pixel unit: one art pixel of an average planet here, as
     * drawn right now (object scale + zoom detail). Stations, border
     * blockades and the nebula use it so everything shares one resolution.
     */
    mapPixelUnit(planetId) {
        let base;
        if (planetId) {
            base = this.planetPixelSize(planetId);
        } else {
            const ids = Object.keys(this.nodeById || {});
            base = ids.length
                ? ids.reduce((sum, id) => sum + this.planetPixelSize(id), 0) / ids.length
                : this.planetNodeSize('') / 18;
        }
        const detail = this.getMapDetail ? this.getMapDetail() : 1;
        return base * this.getMapObjectScale() / detail;
    },

    /** Map units per art pixel of a planet (grid 16 + margin; 22 with rings). */
    planetPixelSize(planetId) {
        const pid = String(planetId || '').toLowerCase();
        const spec = typeof planetSVGManager !== 'undefined' && planetSVGManager.planetSpecs && planetSVGManager.planetSpecs[pid];
        const rings = !!(spec && spec.features && spec.features.rings);
        return this.planetNodeSize(planetId) / (rings ? 22 : 18);
    },

    /**
     * Pixel-art space station on a 12×12 grid centred on 0,0; the map scales
     * it so one cell = one pixel of its anchor planet (planetPixelSize).
     * Faction stations use military builds (ring hub, truss, spindle), plain
     * trading posts use shop builds (market hub, cargo yard, bazaar ring);
     * the build is picked from the post id. Parts: h = hull, d = dark frame,
     * p = solar panel, c = cargo crate, s = shop sign, l = beacon light,
     * lamps r / g = red / green position lights, w = white strobe,
     * a = amber shop lamp (lamps glow and blink when the post is open).
     */
    /** 3x5 pixel font for map labels (digits, slash, a few signs). */
    PIXEL_GLYPHS: {
        0: ['111', '101', '101', '101', '111'], 1: ['010', '110', '010', '010', '111'],
        2: ['111', '001', '111', '100', '111'], 3: ['111', '001', '011', '001', '111'],
        4: ['101', '101', '111', '001', '001'], 5: ['111', '100', '111', '001', '111'],
        6: ['111', '100', '111', '101', '111'], 7: ['111', '001', '010', '010', '010'],
        8: ['111', '101', '111', '101', '111'], 9: ['111', '101', '111', '001', '111'],
        '/': ['001', '001', '010', '100', '100'], '-': ['000', '000', '111', '000', '000'],
        '+': ['000', '010', '111', '010', '000'], ' ': ['000', '000', '000', '000', '000']
    },

    /**
     * Text as pixel rects (baseline at y), with a dark one-pixel outline so
     * it reads on any background. anchor: 'start' | 'middle'.
     */
    pixelTextSvg(str, x, y, anchor, px) {
        const P = px || 1.5;
        const chars = String(str).split('').map((c) => this.PIXEL_GLYPHS[c] || this.PIXEL_GLYPHS[' ']);
        const cols = chars.length * 4 - 1;
        const x0 = anchor === 'middle' ? x - (cols * P) / 2 : x;
        const y0 = y - 5 * P;
        const on = new Set();
        chars.forEach((g, i) => g.forEach((row, ry) => row.split('').forEach((b, rx) => {
            if (b === '1') on.add((i * 4 + rx) + ',' + ry);
        })));
        let outline = '', fill = '';
        const r = (cx, cy, cls) => `<rect x="${(x0 + cx * P).toFixed(2)}" y="${(y0 + cy * P).toFixed(2)}" width="${P}" height="${P}" class="${cls}"/>`;
        for (let cy = -1; cy <= 5; cy++) {
            for (let cx = -1; cx <= cols; cx++) {
                if (on.has(cx + ',' + cy)) { fill += r(cx, cy, 'gm-pixel-text'); continue; }
                let edge = false;
                for (let dy = -1; dy <= 1 && !edge; dy++) for (let dx = -1; dx <= 1; dx++) if (on.has((cx + dx) + ',' + (cy + dy))) { edge = true; break; }
                if (edge) outline += r(cx, cy, 'gm-pixel-text-o');
            }
        }
        return `<g class="gm-stage-progress-px" shape-rendering="crispEdges">${outline}${fill}</g>`;
    },

    /**
     * Sub-pixel silhouette helpers (zoom detail d): a mask of solid
     * sub-pixels, drawn as merged row runs, with a one-sub-pixel outline —
     * so stations / checkpoints get the planets' fine edges, not 1-cell blocks.
     */
    subMaskNew(d) {
        return { d: d, set: new Set(), minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    },

    subMaskAdd(m, sx, sy) {
        m.set.add(sx + ',' + sy);
        if (sx < m.minX) m.minX = sx;
        if (sx > m.maxX) m.maxX = sx;
        if (sy < m.minY) m.minY = sy;
        if (sy > m.maxY) m.maxY = sy;
    },

    /** Rounded block (radius r in cells) as sub-pixel rows: [sx0, sx1, sy]. */
    roundedRowsSub(x, y, w, h, d, r) {
        const rows = [];
        const X0 = Math.round(x * d), Y0 = Math.round(y * d);
        const W = Math.round(w * d), H = Math.round(h * d);
        const R = Math.min(r * d, W / 2, H / 2);
        for (let sy = 0; sy < H; sy++) {
            const cy = sy + 0.5;
            const dy = cy < R ? R - cy : (cy > H - R ? cy - (H - R) : 0);
            const inset = dy > 0 ? Math.round(R - Math.sqrt(Math.max(0, R * R - dy * dy))) : 0;
            if (W - inset * 2 > 0) rows.push([X0 + inset, X0 + W - inset, Y0 + sy]);
        }
        return rows;
    },

    subRowsSvg(rows, d, cls, extra) {
        const p = 1 / d;
        return rows.map(([a, b, sy]) => `<rect x="${(a * p).toFixed(4)}" y="${(sy * p).toFixed(4)}" width="${((b - a) * p).toFixed(4)}" height="${p.toFixed(4)}"${cls ? ` class="${cls}"` : ''}${extra || ''}/>`).join('');
    },

    /** One-sub-pixel ring around the mask (8-neighbour), merged per row. */
    subMaskOutlineSvg(m, cls) {
        const rows = [];
        const has = (x, y) => m.set.has(x + ',' + y);
        for (let sy = m.minY - 1; sy <= m.maxY + 1; sy++) {
            let start = null;
            for (let sx = m.minX - 1; sx <= m.maxX + 2; sx++) {
                let edge = false;
                if (sx <= m.maxX + 1 && !has(sx, sy)) {
                    for (let dy = -1; dy <= 1 && !edge; dy++) {
                        for (let dx = -1; dx <= 1; dx++) if (has(sx + dx, sy + dy)) { edge = true; break; }
                    }
                }
                if (edge && start === null) start = sx;
                if (!edge && start !== null) { rows.push([start, sx, sy]); start = null; }
            }
        }
        return this.subRowsSvg(rows, m.d, cls);
    },

    nextClipId(prefix) {
        this._clipSeq = (this._clipSeq || 0) + 1;
        return prefix + this._clipSeq;
    },

    /**
     * Planet-style sub-pixel shading for one art block: light from the top
     * left across the whole object (cx, cy, R) plus a soft local bevel,
     * quantised to glint / shade / deep with 4x4 ordered (Bayer) dithering,
     * the same look as the planets at that zoom detail. Runs are merged.
     */
    ditherShadeSvg(x, y, w, h, d, cx, cy, R, prefix) {
        const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
        const p = 1 / d;
        const W = Math.round(w * d), H = Math.round(h * d);
        let out = '';
        for (let sy = 0; sy < H; sy++) {
            let run = null, runX = 0;
            const flush = (end) => {
                if (run) out += `<rect x="${(x + runX * p).toFixed(4)}" y="${(y + sy * p).toFixed(4)}" width="${((end - runX) * p).toFixed(4)}" height="${p.toFixed(4)}" class="${prefix}-${run}"/>`;
            };
            for (let sx = 0; sx <= W; sx++) {
                let tone = null;
                if (sx < W) {
                    const gx = x + (sx + 0.5) * p - cx, gy = y + (sy + 0.5) * p - cy;
                    // Global light + local bevel (lit near top/left of the block).
                    const u = (sx + 0.5) / W, v = (sy + 0.5) / H;
                    let l = -(gx + gy) / (R * 2) + (0.5 - (u + v) / 2) * 0.45;
                    l += ((BAYER[(sy & 3) * 4 + (sx & 3)] + 0.5) / 16 - 0.5) * 0.22;
                    tone = l > 0.32 ? 'glint' : l < -0.42 ? 'deep' : l < -0.14 ? 'shade' : null;
                }
                if (tone !== run) { flush(sx); run = tone; runX = sx; }
            }
        }
        return out;
    },

    /**
     * Station art is costly at high zoom (thousands of sub-pixel rects): cap
     * the detail at 4 and cache the markup per station + detail, so zoom
     * steps only swap strings instead of rebuilding the art.
     */
    stationPixelsSvg(post, detail) {
        const d = Math.min(GM_ART_DETAIL_MAX, Math.max(1, Math.round(detail || 1)));
        const key = String((post && post.id) || '') + (post && post.factionStation ? '|f' : '') + '@' + d;
        this._stationArtCache = this._stationArtCache || {};
        if (!this._stationArtCache[key]) this._stationArtCache[key] = this.stationPixelsSvgRaw(post, d);
        return this._stationArtCache[key];
    },

    stationPixelsSvgRaw(post, detail) {
        const id = String((post && post.id) || '');
        let hash = 0;
        for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
        const stations = [
            // Ring hub with spokes and side panels.
            [['p', -6, -1, 1, 2], ['p', 5, -1, 1, 2],
                ['h', -3, -5, 6, 1], ['h', -3, 4, 6, 1], ['h', -5, -3, 1, 6], ['h', 4, -3, 1, 6],
                ['h', -4, -4, 1, 1], ['h', 3, -4, 1, 1], ['h', -4, 3, 1, 1], ['h', 3, 3, 1, 1],
                ['d', -1, -4, 2, 2], ['d', -1, 2, 2, 2], ['d', -4, -1, 2, 2], ['d', 2, -1, 2, 2],
                ['h', -1, -1, 2, 2], ['l', 0, 0, 1, 1],
                ['w', -1, -6, 1, 1], ['w', 0, 5, 1, 1], ['r', -6, -2, 1, 1], ['g', 5, -2, 1, 1]],
            // Truss station: core module, long truss, four solar wings.
            [['d', -6, 0, 12, 1], ['p', -6, -3, 2, 2], ['p', -6, 2, 2, 2], ['p', 4, -3, 2, 2], ['p', 4, 2, 2, 2],
                ['h', -2, -3, 4, 6], ['d', -2, 0, 4, 1], ['h', -1, -5, 2, 2], ['h', -3, 3, 6, 2], ['d', -3, 4, 6, 1],
                ['l', -1, -2, 1, 1], ['l', 0, 2, 1, 1], ['w', -1, -6, 1, 1],
                ['r', -6, -1, 1, 1], ['g', 5, -1, 1, 1], ['a', -3, 5, 1, 1], ['a', 2, 5, 1, 1]],
            // Spindle: long spine with two habitat rings and docking pods.
            [['p', -6, 0, 3, 1], ['p', 3, 0, 3, 1], ['h', -1, -6, 2, 12],
                ['h', -3, -3, 6, 1], ['h', -3, 2, 6, 1],
                ['d', -4, -4, 1, 3], ['d', 3, -4, 1, 3], ['d', -4, 1, 1, 3], ['d', 3, 1, 1, 3],
                ['d', -1, 0, 2, 1], ['w', 0, -6, 1, 1], ['w', -1, 5, 1, 1],
                ['r', -5, -3, 1, 1], ['g', 4, -3, 1, 1], ['r', -5, 2, 1, 1], ['g', 4, 2, 1, 1]]
        ];
        const shops = [
            // Market hub: domed trade hall, sign board, docking arms, crates.
            [['d', -6, 1, 12, 1], ['h', -6, 0, 1, 3], ['h', 5, 0, 1, 3],
                ['h', -3, -2, 6, 5], ['h', -2, -4, 4, 2], ['s', -2, -1, 4, 1],
                ['c', -5, 2, 2, 2], ['c', 3, 2, 2, 2], ['c', -1, 3, 2, 2],
                ['d', -1, -5, 2, 1], ['w', -1, -6, 2, 1],
                ['a', -3, -2, 1, 1], ['a', 2, -2, 1, 1], ['r', -6, -1, 1, 1], ['g', 5, -1, 1, 1]],
            // Cargo yard: rails with container racks and a lit sign tower.
            [['d', -6, -1, 12, 1], ['d', -6, 1, 12, 1],
                ['c', -5, -4, 2, 3], ['c', 3, -4, 2, 3], ['c', -5, 2, 2, 3], ['c', 3, 2, 2, 2],
                ['h', -2, -5, 4, 10], ['s', -1, -4, 2, 2], ['d', -2, 0, 4, 1],
                ['w', -1, 5, 2, 1], ['a', -3, -5, 1, 1], ['a', 2, -5, 1, 1],
                ['r', -6, 0, 1, 1], ['g', 5, 0, 1, 1]],
            // Bazaar ring: ring of stalls around a sign tower.
            [['h', -3, -5, 6, 1], ['h', -3, 4, 6, 1], ['h', -5, -3, 1, 6], ['h', 4, -3, 1, 6],
                ['h', -4, -4, 1, 1], ['h', 3, -4, 1, 1], ['h', -4, 3, 1, 1], ['h', 3, 3, 1, 1],
                ['c', -3, -4, 1, 1], ['c', 2, -4, 1, 1], ['c', -3, 3, 1, 1], ['c', 2, 3, 1, 1],
                ['d', -1, -4, 2, 2], ['d', -1, 2, 2, 2], ['d', -4, -1, 2, 2], ['d', 2, -1, 2, 2],
                ['h', -2, -2, 4, 4], ['s', -1, -1, 2, 1], ['l', -1, 1, 2, 1],
                ['a', -3, -6, 1, 1], ['a', 2, -6, 1, 1], ['a', -3, 5, 1, 1], ['a', 2, 5, 1, 1],
                ['r', -6, -1, 1, 1], ['g', 5, -1, 1, 1], ['w', -1, -6, 2, 1]]
        ];
        const builds = (post && post.factionStation) ? stations : shops;
        const cls = {
            h: 'gm-station-hull', d: 'gm-station-dark', p: 'gm-station-panel', c: 'gm-station-crate',
            s: 'gm-station-sign', l: 'gm-station-light',
            r: 'gm-station-lamp gm-lamp-red', g: 'gm-station-lamp gm-lamp-green',
            w: 'gm-station-lamp gm-lamp-strobe', a: 'gm-station-lamp gm-lamp-amber'
        };
        const lamp = (k) => k === 'r' || k === 'g' || k === 'w' || k === 'a';
        const parts = builds[hash % builds.length];
        const rect = (x, y, w, h, c, extra) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" class="${c}"${extra || ''}/>`;
        const d = Math.max(1, Math.round(detail || 1));
        // Lamps: staggered blink per lamp (no translucent halo squares).
        let lampIdx = 0;
        const delays = parts.map(([k]) => lamp(k)
            ? ` style="animation-delay:${(lampIdx++ * 0.37 + (hash % 7) * 0.11).toFixed(2)}s"` : '');
        let outline, base, clipId = null, clipRects = '';
        if (d > 1) {
            // Fine silhouette on the planet's pixel grid; corners just nicked.
            const m = this.subMaskNew(d);
            base = parts.map(([k, x, y, w, h], i) => {
                // Only the corner pixels are softened (crisp, boxy look).
                const rows = this.roundedRowsSub(x, y, w, h, d, (lamp(k) ? 3 : 2) / d);
                rows.forEach(([a, b, sy]) => { for (let sx = a; sx < b; sx++) this.subMaskAdd(m, sx, sy); });
                clipRects += this.subRowsSvg(rows, d, '');
                return this.subRowsSvg(rows, d, cls[k], delays[i]);
            }).join('');
            outline = this.subMaskOutlineSvg(m, 'gm-station-outline');
            clipId = this.nextClipId('gmStClip');
        } else {
            // Dark #05060a outline around the whole silhouette (lamps included).
            outline = parts.map(([, x, y, w, h]) => rect(x - 0.5, y - 0.5, w + 1, h + 1, 'gm-station-outline')).join('');
            base = parts.map(([k, x, y, w, h], i) => rect(x, y, w, h, cls[k], delays[i])).join('');
        }
        // Large card view: sub-pixel shading on top of the same silhouette
        // (lit top/left edge, shaded bottom/right edge, panel cells, windows).
        let fine = '';
        if (d > 1) {
            const p = 1 / d;
            parts.forEach(([k, x, y, w, h]) => {
                if (k === 'l' || lamp(k)) {
                    fine += rect(x + p, y + p, Math.max(p, w - 2 * p), Math.max(p, h - 2 * p), 'gm-station-glint');
                    return;
                }
                // Sub-pixel shading at the planet's resolution (one planet pixel = 1/d).
                fine += this.ditherShadeSvg(x, y, w, h, d, 0, 0, 7, 'gm-station');
                if (k === 'p') {
                    // Solar cell grid.
                    for (let gx = x + 1; gx < x + w; gx += 1) fine += rect(gx - p / 2, y, p, h, 'gm-station-shade');
                    for (let gy = y + 1; gy < y + h; gy += 1) fine += rect(x, gy - p / 2, w, p, 'gm-station-shade');
                } else if (k === 'c') {
                    // Crate ribs.
                    for (let gx = x + 1; gx < x + w; gx += 1) fine += rect(gx - p / 2, y + p, p, h - 2 * p, 'gm-station-shade');
                } else if (k === 's') {
                    // Sign board: a row of lit glyph pixels.
                    for (let i = 0; i < w * d - 2; i += 2) {
                        if ((i + hash) % 3 === 0) continue;
                        fine += rect(x + p + i * p, y + h / 2 - p, p, 2 * p, 'gm-station-sign-glyph');
                    }
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
        const fineG = clipId
            ? `<clipPath id="${clipId}">${clipRects}</clipPath><g clip-path="url(#${clipId})">${fine}</g>` : fine;
        return `<g class="gm-station" shape-rendering="crispEdges">` + outline + base + fineG + `</g>`;
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
        this.raiseHoveredMarker();
        this.raiseSelectedMarker();
        this.frameSelectionCamera();
    },

    /**
     * SVG has no z-index: move the selected planet / post (with its frame)
     * to the top, just under the player ship, so markings are never covered.
     */
    /**
     * Hovered planet overlays the lines: lift it above .gm-lines (under the
     * route + ship) and put it back in place when the hover ends.
     */
    raiseHoveredMarker() {
        const svg = this.overlay && this.overlay.querySelector('.galaxy-map-svg');
        if (!svg) return;
        const prev = this._hoverLift;
        const node = this.hoveredPlanetId
            ? svg.querySelector(`:scope > .gm-node[data-planet="${this.hoveredPlanetId}"]`) : null;
        if (prev && prev.node !== node) {
            if (prev.node.isConnected && !prev.node.classList.contains('selected') && prev.next && prev.next.parentNode === svg) {
                svg.insertBefore(prev.node, prev.next);
            }
            this._hoverLift = null;
        }
        if (!node || (this._hoverLift && this._hoverLift.node === node)) return;
        const anchor = svg.querySelector(':scope > .gm-route-layer');
        if (!anchor) return;
        this._hoverLift = { node: node, next: node.nextSibling };
        if (node.nextSibling !== anchor) svg.insertBefore(node, anchor);
    },

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
                if (homeStationUI.tab === 'play' && homeStationUI.openTravelModal) {
                    homeStationUI.openTravelModal();
                    return;
                }
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
                if (this.hasActionFocus()) {
                    // On the start buttons: ←/→ pick one, ↑ back to the map.
                    if (e.key === 'ArrowLeft') this.focusActionButton(this._actionFocus - 1);
                    else if (e.key === 'ArrowRight') this.focusActionButton(this._actionFocus + 1);
                    else if (e.key === 'ArrowUp') this.clearActionFocus();
                    return;
                }
                this.navigateByArrow(e.key);
            } else if (e.key === 'Enter' || e.key === ' ') {
                // Embedded Play tab: Home Station owns confirmation → startMission.
                if (this._mountEl) return;
                e.preventDefault();
                e.stopPropagation();
                this.confirmKey();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                if (this.hasActionFocus()) {
                    this.clearActionFocus();
                    return;
                }
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
