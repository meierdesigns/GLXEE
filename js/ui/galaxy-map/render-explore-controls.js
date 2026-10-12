"use strict";

// Stations / checkpoints stop refining past this zoom detail (perf).
const GM_ART_DETAIL_MAX = 4;
// Map units per art pixel at zoom detail 1: the single pixel size every map object is built from.
const GM_PIXEL_U0 = 32 / 18;

// Galaxy-map nebula feature scale (noise frequency per map unit): higher =
// smaller clouds, finer wisps and filaments.
// Bump when the nebula look changes: invalidates the copies stored across reloads.
const NEB_VERSION = 17;
const NEB_SCALE = 0.0038;
// Max pixels computed for the nebula patch over the view (performance cap).
const NEB_PIXEL_BUDGET = 160000;
// Time per compute slice: the fine patch (rebuilt while zooming / panning) takes small bites so frames keep running;
// the coarse field is built once and may take bigger ones.
const NEB_SLICE_FINE_MS = 5;
const NEB_SLICE_COARSE_MS = 12;
// How steeply nebula density drops with distance from the suns (higher = faster).
const NEB_SUN_FALLOFF = 1.8;
// Free-floating static vortices in the nebula: one candidate per cell of this size.
const SWIRL_CELL = 900;
const swirlHash = (gx, gy) => {
    const h = (k) => { let v = Math.imul(gx * 73856093 ^ gy * 19349663 ^ k * 83492791, 2654435761); v ^= v >>> 15; v = Math.imul(v, 2246822519); v ^= v >>> 13; return (v >>> 0) / 4294967296; };
    return { p: h(1), a: 0.2 + h(2) * 0.6, b: 0.2 + h(3) * 0.6, c: h(4), dir: h(5) < 0.5 ? -1 : 1 };
};

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
        const exploreLabel = `EXPLORES ${used}/${budget}`;
        const progress = `<div class="gm-explore-progress" title="Explore budget in this galaxy">` +
            `${this.progressPlanetIconHtml()}<span class="gm-progress-text">${exploreLabel}</span></div>`;
        const meta = reason ? `<span class="gm-explore-meta">${reason}</span>` : '';
        this._exploreMetaHtml = '';
        return `<div class="galaxy-map-explore">` +
            progress +
            `<button class="action-button gm-explore-btn" id="gmExplore" ${disabled}${costLabel ? ` data-ui-tip="COST · ${costLabel}"` : ''}>EXPLORE NEW SECTOR` +
            (costIcons ? `<span class="gm-explore-costs">${costIcons}</span>` : (costLabel ? ` (${costLabel})` : '')) +
            `</button>` + (meta ? meta : '') + `</div>`;
    },
    /** Planet-to-planet lines (lit, dim, or fading towards a locked planet). */
    edgeLinesSvg() {
        const edges = this.map.edges || [];
        let backBlocks = '';
        let frontBlocks = '';
        const W = 640;
        const H = 320;
        const pad = 48;
        const edgeGap = 0;
        const mapSpread = 2.0;
        // Lines aim at the centre and stop on the drawn surface.
        const objScale = this.nodeObjScale();
        // Lines are drawn under the planets and run slightly into the disc, so the planet's own silhouette cuts them: they meet the surface exactly.
        const planetRadius = (planetId) => this.planetSurfaceRadius(planetId) * objScale * 0.88;
        let edgesHtml = '';
        // Lanes leaving the ship's current spot (planet, or the anchor planets of a post) are the
        // next jump: they get the strong beam, the other reachable lanes a weaker one.
        const shipLoc = (typeof profileManager !== 'undefined' && profileManager.getShipLocation)
            ? profileManager.getShipLocation(this.galaxyId) : null;
        const hereIds = [];
        if (shipLoc && shipLoc.kind === 'planet') hereIds.push(shipLoc.id);
        else if (shipLoc && shipLoc.kind === 'post' && profileManager.getTradingPost) {
            const hp = profileManager.getTradingPost(shipLoc.id);
            if (hp) (hp.anchors || [hp.planetId]).forEach((id) => hereIds.push(id));
        }
        const routeIds = this.routeEdgeIds ? this.routeEdgeIds() : null;
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
            // A lane is lit only when travel along it is possible (both ends
            // reachable). A lane to a still-locked planet stays dim: no gate on it.
            edgesHtml += this.pixelLineSvg([{ x: x1, y: y1 }, { x: x2, y: y2 }], 'gm-edge ' + (okA && okB
                ? (hereIds.indexOf(edge[0]) !== -1 || hereIds.indexOf(edge[1]) !== -1 ? 'lit next' : 'lit')
                : 'dim') + ' gm-e-' + edge[0] + ' gm-e-' + edge[1]
                + (routeIds && routeIds.indexOf(edge[0]) !== -1 && routeIds.indexOf(edge[1]) !== -1 ? ' on-route' : ''));
        });
        // Border stations always sit on top of the beams (a beam never runs across one).
        return edgesHtml + (this.postLanesSvg ? this.postLanesSvg() : '') + backBlocks + frontBlocks;
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
    /**
     * Per-faction checkpoint shape (ship silhouettes): left tower 6×9 (the
     * right one mirrors it), field rows 5-8 between
     * them, 3 base rows. Built into a 21×12 art like BORDER_STATION_ART.
     */
    /**
     * Checkpoint art on a 2× finer grid (41×22): two emitter pylons with a
     * shaded body and window slits, faction head / fittings, the field
     * between them and a riveted base. Keys as BORDER_STATION_ART.
     */
    borderArtFor(style) {
        const sil = (style && style.silhouette) || 'modular';
        this._borderArt = this._borderArt || {};
        if (this._borderArt[sil]) return this._borderArt[sil];
        const W = 41, H = 22, PW = 9;
        const P = Array.from({ length: H }, () => Array(PW).fill('.'));
        const fill = (x0, y0, w, h, c) => {
            for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (P[y] && x >= 0 && x < PW) P[y][x] = c || '#';
        };
        // Pylon body + field emitter collar.
        fill(1, 5, 6, 13);
        fill(7, 8, 2, 10, 'k');
        [7, 10, 13, 16].forEach((y) => { P[y][3] = 'w'; });
        if (sil === 'spikes') {
            fill(0, 4, 8, 1); fill(1, 3, 6, 1); fill(2, 2, 4, 1); fill(3, 1, 2, 1); P[0][3] = 'a';
            fill(0, 8, 1, 5, 'd'); P[7][0] = 'd';
        } else if (sil === 'rings') {
            fill(2, 0, 4, 1); fill(1, 1, 1, 3); fill(6, 1, 1, 3); fill(2, 4, 4, 1); P[2][3] = 'a'; P[2][4] = 'a';
        } else if (sil === 'scrap') {
            fill(0, 3, 6, 2); fill(0, 2, 3, 1); fill(5, 0, 1, 3, 'k'); P[0][5] = 'a';
            fill(0, 11, 1, 3, 'd'); fill(6, 5, 2, 2);
        } else if (sil === 'circuit') {
            fill(0, 2, 8, 3); P[1][0] = 'k'; P[1][7] = 'k'; P[0][7] = 'a';
            fill(0, 5, 1, 5, 'k');
        } else {
            fill(0, 2, 8, 3); fill(3, 1, 1, 1, 'k'); P[0][3] = 'a';
        }
        // Shade generic hull cells by column: lit left, dark right.
        for (let y = 0; y < H; y++) for (let x = 0; x < PW; x++) {
            if (P[y][x] === '#') P[y][x] = x <= 1 ? 'l' : x >= 5 ? 'd' : 'm';
        }
        const rows = [];
        for (let y = 0; y < H; y++) {
            const left = P[y].join('');
            let mid = '';
            for (let x = PW; x < W - PW; x++) mid += (y >= 8 && y <= 17) ? (((x + y) % 2) ? 'R' : 'r') : '.';
            rows.push(left + mid + left.split('').reverse().join(''));
        }
        // Riveted base slab.
        const line = (f) => Array.from({ length: W }, (_, x) => f(x)).join('');
        rows[18] = line(() => 'l');
        rows[19] = line((x) => (x % 5 === 2 ? 'k' : 'm'));
        rows[20] = line((x) => (x >= 1 && x < W - 1 ? 'd' : '.'));
        rows[21] = line((x) => (x >= 3 && x < W - 3 ? 'k' : '.'));
        this._borderArt[sil] = rows;
        return rows;
    },
    /** Galaxy's ruling faction style (faction-holdings.js), or null. */
    borderRulerStyle() {
        // The builder is remembered: conquering the galaxy does not restyle its stations.
        const fid = (typeof profileManager !== 'undefined' && profileManager.getBorderBuilder)
            ? profileManager.getBorderBuilder(this.galaxyId) : null;
        if (!fid || typeof factionShipStyles === 'undefined' || !factionShipStyles.getFactionStyle) return null;
        return factionShipStyles.getFactionStyle(fid);
    },
    blockadeSvg(cx, cy, focusPlanet, shutPlanet) {
        // Cached per checkpoint + zoom detail + ruler (the art is costly at high zoom).
        const style = this.borderRulerStyle();
        const key = [cx.toFixed(2), cy.toFixed(2), focusPlanet, shutPlanet, this.getMapDetail ? this.getMapDetail() : 1,
            this.planetPixelSize(focusPlanet) * this.getMapObjectScale(), style ? style.silhouette + style.hull : ''].join('|');
        this._blockadeCache = this._blockadeCache || {};
        if (!this._blockadeCache[key]) this._blockadeCache[key] = this.blockadeSvgRaw(cx, cy, focusPlanet, shutPlanet);
        return this._blockadeCache[key];
    },
    blockadeSvgRaw(cx, cy, focusPlanet, shutPlanet, cellOverride) {
        const style = this.borderRulerStyle();
        const rows = this.borderArtFor(style);
        // Same on-map size as a shop station (its art spans ~13 planet pixels).
        const artScale = 13 / rows[0].length;
        const w = rows[0].length, h = rows.length;
        // One art cell = one pixel of the planet it guards (zoom-scaled).
        const cell = (cellOverride || this.planetPixelSize(focusPlanet) * this.getMapObjectScale()) * artScale;
        const at = (x, y) => (rows[y] && rows[y][x]) || '.';
        const d = Math.max(1, Math.round(Math.min(GM_ART_DETAIL_MAX, this.getMapDetail ? this.getMapDetail() : 1) / 2));
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
        const tipAttr = shutPlanet ? ` data-border-shut="${String(shutPlanet).replace(/"/g, '')}"` : '';
        const focusAttr = focusPlanet ? ` data-focus-planet="${String(focusPlanet).replace(/"/g, '')}"` : '';
        // Map: same corner selection frame as planets / posts (wide: own height).
        const frame = cellOverride ? '' : `<g class="gm-frame-slot" data-frame-r="${(w / 2 * cell).toFixed(2)}" data-frame-ry="${(h / 2 * cell).toFixed(2)}" data-frame-post="1">${this.selectionFrameSvg(w / 2 * cell + 4, 7, 2, h / 2 * cell + 4)}</g>`;
        const wrapClass = 'gm-border-station' + (style ? ' is-faction' : '');
        const art = this.gmArtImage(outline + body, wrapClass, styleAttr.replace(/^ style="|"$/g, ''), -1, -1, w + 2, h + 2);
        return `<g class="${wrapClass}"${styleAttr}${tipAttr}${focusAttr} transform="translate(${cx.toFixed(2)} ${cy.toFixed(2)})">` + frame +
            `<g transform="scale(${cell}) translate(${-w / 2} ${-h / 2})">` + art + `</g></g>`;
    },
    /**
     * The .gm-lines layer alone, cached per line step, so zooming only
     * redraws lines (and returns instantly to steps seen before).
     */
    linesLayerHtml() {
        const key = this.getLineDetail() + '|' + this.nodeObjScale().toFixed(3);
        this._linesByDetail = this._linesByDetail || {};
        if (!this._linesByDetail[key]) {
            this._linesByDetail[key] = this.edgeLinesSvg();
        }
        return this._linesByDetail[key];
    },
});
