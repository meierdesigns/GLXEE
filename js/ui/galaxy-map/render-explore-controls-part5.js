"use strict";

// GalaxyMapManager members, continued from render-explore-controls.js (kept under ~500 lines per file).
extendClass(GalaxyMapManager, {
    /**
     * Position + size of the ship icon in map units. The icon is 13*dk x 17*dk texels, and one texel is
     * exactly the map's one pixel (mapPixelUnitGlobal), the same pixel the planets, sun and nebula use,
     * so ship and planet pixels always match at every zoom.
     */
    shipIconBox() {
        const dk = Math.max(1, Math.round(this.getMapDetail()));
        const u = this.mapPixelUnitGlobal();
        const w = 13 * dk * u, h = 17 * dk * u;
        return { x: -w / 2, y: -h / 2, w: w, h: h, attrs: `x="${(-w / 2).toFixed(3)}" y="${(-h / 2).toFixed(3)}" width="${w.toFixed(3)}" height="${h.toFixed(3)}"` };
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
        if (!svg || !svg.viewBox || !svg.viewBox.baseVal) {
            this.syncLocateShipButton();
            return;
        }
        // Screen scale from the cached element size + viewBox (meet): reading
        // getScreenCTM right after a viewBox change forced a full layout of
        // the map on every zoom frame.
        if (this._svgSizeEl !== svg || !this._svgSize) {
            const r = svg.getBoundingClientRect();
            const vb0 = svg.viewBox.baseVal;
            const ctm = svg.getScreenCTM && svg.getScreenCTM();
            const fit = vb0.width && vb0.height ? Math.min(r.width / vb0.width, r.height / vb0.height) : 0;
            // CTM vs. rect ratio (the GUI's CSS zoom), measured once.
            const c = ctm && fit ? Math.hypot(ctm.a, ctm.b) / fit : 1;
            this._svgSizeEl = svg;
            this._svgSize = { w: r.width * c, h: r.height * c };
            if (!this._svgSizeReset) {
                this._svgSizeReset = () => { this._svgSize = null; };
                window.addEventListener('resize', this._svgSizeReset);
            }
        }
        const vb = svg.viewBox.baseVal;
        const s = vb.width && vb.height ? Math.min(this._svgSize.w / vb.width, this._svgSize.h / vb.height) : 0;
        if (!s) {
            this.syncLocateShipButton();
            return;
        }
        const px = (n) => Math.max(1, Math.round(n)) / s;   // screen px → map units
        const key = s.toFixed(4);
        // Only visible frames (selected / hovered) are rebuilt per zoom frame;
        // the rest catch up when they get selected (syncNodeHighlight).
        svg.querySelectorAll(':is(.gm-node, .gm-post-node, .gm-border-station):is(.selected, .hovered) .gm-frame-slot').forEach((slot) => {
            if (slot._frameKey === key) return;
            slot._frameKey = key;
            const r = Number(slot.getAttribute('data-frame-r')) || 16;
            const ry = slot.hasAttribute('data-frame-ry') ? Number(slot.getAttribute('data-frame-ry')) : null;
            const post = slot.hasAttribute('data-frame-post');
            const gap = post ? 8 : 12, arm = post ? 10 : 16, thick = post ? 2 : 2;
            // Corner sits `gap` px outside the surface (a square frame around a disc).
            const f = r + px(gap);
            slot.innerHTML = this.selectionFrameSvg(f, px(arm), px(thick), ry == null ? null : ry + px(gap));
        });
        this.syncLocateShipButton();
    },
    selectionFrameSvg(f, L, t, fy) {
        const faction = this.getCursorFaction();
        const corners = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
        let body = '';
        corners.forEach(([sx, sy]) => {
            const x = sx * f;
            const y = sy * (fy == null ? f : fy);
            const ix = -sx; // points inward
            const iy = -sy;
            switch (faction) {
                case 'voidborn': {
                    const c = L * 1.1;
                    body += `<path class="gm-corner-organic" d="M${x + ix * c} ${y + iy} ` +
                        `Q${x + ix * c * 0.35} ${y - iy * 2.5} ${x} ${y} ` +
                        `Q${x - ix * 2.5} ${y + iy * c * 0.35} ${x + ix} ${y + iy * c}"/>`;
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
                return Math.hypot(pt.x - at.x, pt.y - at.y) <= this.planetNodeSize(pid) / 2;
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
        const baseW = w;
        const baseH = h;
        const baseCx = (x0 + x1) / 2;
        const baseCy = (y0 + y1) / 2;
        let cx = baseCx;
        let cy = baseCy;
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
        // Keep enough of the galaxy in view that panning never loses the map,
        // while retaining a little overscroll for a natural camera feel.
        const limitCenter = (center, baseCenter, baseSize, viewSize) => {
            const overscroll = Math.min(baseSize, viewSize) * 0.25;
            const min = baseCenter - baseSize / 2 + viewSize / 2 - overscroll;
            const max = baseCenter + baseSize / 2 - viewSize / 2 + overscroll;
            return min > max ? baseCenter : Math.max(min, Math.min(max, center));
        };
        const clampedCx = limitCenter(cx, baseCx, baseW, w);
        const clampedCy = limitCenter(cy, baseCy, baseH, h);
        if (this.mapPan && (clampedCx !== cx || clampedCy !== cy)) {
            const panBaseX = this._panAnchor ? this._panAnchor.x : baseCx;
            const panBaseY = this._panAnchor ? this._panAnchor.y : baseCy;
            this.mapPan.x = clampedCx - panBaseX;
            this.mapPan.y = clampedCy - panBaseY;
        }
        cx = clampedCx;
        cy = clampedCy;
        return [cx - w / 2, cy - h / 2, w, h];
    },
    /**
     * Camera: when the selection changes, glide (animated viewBox) so both
     * the player ship and the selected planet / station are in view. Only
     * zooms out if they don't fit; never zooms in past the player's zoom.
     */
    frameSelectionCamera(withShip) {
        if (this._flight || !this.overlay || typeof profileManager === 'undefined') return;
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
        // Callers can opt into framing the selected target and the ship together.
        const pts = b && withShip ? [a, b] : [a];
        // Same spot as the ship (or nothing to compare): just centre on it.
        const margin = 110;
        const x0 = Math.min(...pts.map((p) => p.x)) - margin;
        const x1 = Math.max(...pts.map((p) => p.x)) + margin;
        const y0 = Math.min(...pts.map((p) => p.y)) - margin;
        const y1 = Math.max(...pts.map((p) => p.y)) + margin;
        const cur = svg.viewBox.baseVal;
        const from = [cur.x, cur.y, cur.width, cur.height];
        const aspect = cur.width / Math.max(1, cur.height);
        let w = cur.width;
        if (withShip === 'follow' && pts.length > 1) {
            // Keyboard navigation: centre between ship and target and zoom to fit both —
            // further apart = further out, never closer than the player's own zoom.
            const baseW = cur.width * (this.mapZoom || 1);
            const wFit = Math.max(x1 - x0, (y1 - y0) * aspect);
            if (this._userMapZoom == null) this._userMapZoom = this.mapZoom || 1; // remember the player's own zoom
            const userZ = this._userMapZoom;
            // Target on the ship itself: no need to fit anything, keep the player's zoom.
            const apart = Math.hypot(a.x - b.x, a.y - b.y) > 4;
            const z = apart ? Math.max(0.35, Math.min(userZ, baseW / Math.max(1, wFit))) : userZ;
            w = baseW / z;
        } else if (pts.length > 1) {
            // Selecting a single target only pans: keep the user's zoom. Widen
            // the frame only when the ship has to fit in as well.
            if (x1 - x0 > w) w = x1 - x0;
            if ((y1 - y0) * aspect > w) w = (y1 - y0) * aspect;
        }
        // Dead band: tiny zoom corrections just look like jitter — keep the current zoom.
        if (Math.abs(Math.log(w / cur.width)) < 0.15) w = cur.width;
        const h = w / aspect;
        const cx = (x0 + x1) / 2;
        const cy = (y0 + y1) / 2;
        const to = [cx - w / 2, cy - h / 2, w, h];
        // Persist as the camera state getMapViewBox uses on re-render.
        this.mapZoom = (this.mapZoom || 1) * (cur.width / w);
        this._panAnchor = { x: cx, y: cy };
        this.mapPan = { x: 0, y: 0 };
        // Animate the viewBox: centre moves linearly, zoom in log space, so pan and zoom stay in sync.
        const start = performance.now();
        const fcx = from[0] + from[2] / 2, fcy = from[1] + from[3] / 2;
        const travel = Math.hypot(cx - fcx, cy - fcy) / Math.max(1, cur.width);
        const dur = Math.round(Math.max(380, Math.min(900, 380 + travel * 700 + Math.abs(Math.log(w / cur.width)) * 300)));
        const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
        const lw0 = Math.log(from[2]), lw1 = Math.log(w);
        const token = (this._camAnim = {});
        const step = (now) => {
            if (this._camAnim !== token || !svg.isConnected || this._flight) return;
            const t = Math.min(1, (now - start) / dur);
            const k = ease(t);
            const vw = Math.exp(lw0 + (lw1 - lw0) * k);
            const vh = vw / aspect;
            const vcx = fcx + (cx - fcx) * k, vcy = fcy + (cy - fcy) * k;
            svg.setAttribute('viewBox', [vcx - vw / 2, vcy - vh / 2, vw, vh].map((v) => v.toFixed(2)).join(' '));
            this.updateSelectionFrames();
            if (t < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    },
    /** True when the player ship marker lies in the visible map viewport. */
    isShipOnScreen() {
        const svg = this.overlay && this.overlay.querySelector('.galaxy-map-svg');
        if (!svg || !svg.viewBox || !svg.viewBox.baseVal || !this.locationPoint) return true;
        if (typeof profileManager === 'undefined' || !profileManager.getShipLocation) return true;
        const loc = profileManager.getShipLocation(this.galaxyId);
        const p = loc ? this.locationPoint(loc) : null;
        if (!p) return true;
        const vb = svg.viewBox.baseVal;
        const r = svg.getBoundingClientRect();
        if (!vb.width || !vb.height || !r.width || !r.height) return true;
        // preserveAspectRatio meet: only the centred visible slice of the viewBox.
        const s = Math.min(r.width / vb.width, r.height / vb.height);
        const visW = r.width / s;
        const visH = r.height / s;
        const left = vb.x + (vb.width - visW) / 2;
        const top = vb.y + (vb.height - visH) / 2;
        const pad = 16;
        return p.x >= left - pad && p.x <= left + visW + pad
            && p.y >= top - pad && p.y <= top + visH + pad;
    },

    /** FIND SHIP only when the ship has left the screen. */
    syncLocateShipButton() {
        const btn = this.overlay && this.overlay.querySelector('#gmLocateShip');
        if (!btn) return;
        const show = !this.isShipOnScreen();
        btn.hidden = !show;
        btn.setAttribute('aria-hidden', show ? 'false' : 'true');
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
        if (Math.hypot(to[0] - from[0], to[1] - from[1]) < 2) {
            this.syncLocateShipButton();
            return;
        }
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
            else this.syncLocateShipButton();
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
});
