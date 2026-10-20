"use strict";

// GalaxyMapManager members, continued from render-explore-controls.js (kept under ~500 lines per file).
extendClass(GalaxyMapManager, {
    bindMapZoom() {
        const svg = this.overlay.querySelector('.galaxy-map-svg');
        if (!svg) return;
        requestAnimationFrame(() => this.updateSelectionFrames());
        // Detail swap (planets, stations, lines, stars) is heavy: run it once
        // the zoom has settled, not on every animation frame.
        const mapLive = () => !!(this.overlay && this.overlay.isConnected && !this._parkedGalaxyId);
        const swapDetail = (force) => {
            if (!mapLive()) return;
            // After park→reuse, first layout/resize must not rebuild planets (H12).
            if (this._reuseQuietUntil && performance.now() < this._reuseQuietUntil) {
                this._mapArtSKey = this.getMapScaleKey();
                this._mapArtDetail = this.getMapDetail();
                this._mapLineDetail = this.getLineDetail();
                return;
            }
            const cur = this.overlay && this.overlay.querySelector('.galaxy-map-svg');
            if (!cur) return;
            const detail = this.getMapDetail();
            const skey = this.getMapScaleKey();
            const same = this._mapArtDetail === detail && this._mapArtSKey === skey;
            if (same && force === true) {
                // Same detail, view left the fine patch: refine nebula only (keep stars).
                if (this.refreshNebulaInPlace) this.refreshNebulaInPlace();
                return;
            }
            if (same && force === 'lines') {
                // Only the line thickness step changed: swap the lines alone.
                this._mapLineDetail = this.getLineDetail();
                const old = cur.querySelector('.gm-lines');
                if (old) old.innerHTML = this.linesLayerHtml();
                if (this.syncRoutePreview) this.syncRoutePreview();
                return;
            }
            if (same) return;
            this._mapArtDetail = detail;
            this._mapArtSKey = skey;
            this._mapLineDetail = this.getLineDetail();
            // Stars / lines are drawn on the art pixel grid: swap in fresh ones.
            // Only these layers are built — rendering the whole map here made
            // every zoom step rebuild all planets, stations and checkpoints.
            const dPx = this.getMapDetailFloat ? this.getMapDetailFloat() : detail;
            cur.style.setProperty('--gm-px', String(1 / Math.max(0.5, dPx)));
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
                if (pid && icon) icon.innerHTML = this.planetIconHtml(pid, size, true, dir, true);
                // Faction emblems follow the zoom detail (finer art).
                const facs = node.querySelector('.gm-node-factions');
                if (pid && facs) {
                    const tmp = document.createElement('div');
                    tmp.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg">${this.planetFactionsSvg(pid, size)}</svg>`;
                    const next = tmp.querySelector('.gm-node-factions');
                    if (next) facs.innerHTML = next.innerHTML;
                }
            });
            // Stations share bake detail; map footprint stays fixed (GP screen cells via vfMapPx).
            cur.querySelectorAll('.gm-post-node[data-post]').forEach((node) => {
                const art = node.querySelector('.gm-post-art');
                const post = art && this.getTradingPosts().find((p) => p.id === node.getAttribute('data-post'));
                if (post) art.innerHTML = this.stationArtImage(post, detail, node.classList.contains('open'));
            });
            applyShip();
            this.snapMapPlanets();
        };
        // Zoom glide: only the viewBox moves. Selection frames, --gm-px, snap,
        // nebula and art swaps each forced layout / rebuilds and made the map stutter.
        const applyCamera = () => {
            if (!mapLive()) return;
            const cur = this.overlay && this.overlay.querySelector('.galaxy-map-svg');
            if (!cur) return;
            const v = this.getMapViewBox(GM_MAP_W, GM_MAP_H, GM_MAP_PAD);
            cur.setAttribute('viewBox', v.join(' '));
        };
        let apply = (src) => {
            if (!mapLive()) return;
            clearTimeout(this._snapTimer);
            this._snapTimer = setTimeout(() => this.snapMapPlanets(), 250);
            const cur = this.overlay && this.overlay.querySelector('.galaxy-map-svg');
            if (!cur) return;
            // Remount layout: camera + re-key only — never schedule art swap in the quiet window.
            if (this._reuseQuietUntil && performance.now() < this._reuseQuietUntil) {
                const v = this.getMapViewBox(GM_MAP_W, GM_MAP_H, GM_MAP_PAD);
                cur.setAttribute('viewBox', v.join(' '));
                const dFloat = this.getMapDetailFloat ? this.getMapDetailFloat() : this.getMapDetail();
                cur.style.setProperty('--gm-px', String(1 / Math.max(0.5, dFloat)));
                this._mapArtSKey = this.getMapScaleKey();
                this._mapArtDetail = this.getMapDetail();
                this._mapLineDetail = this.getLineDetail();
                if (this.updateSelectionFrames) this.updateSelectionFrames();
                return;
            }
            cur.classList.toggle('gm-close-view', (this.mapZoom || 1) >= 2.5);
            // Only the camera moves: set the viewBox directly (no re-render).
            if (typeof uiAppearanceManager !== 'undefined' && uiAppearanceManager.getGlobalPixelPx && uiAppearanceManager.getGlobalPixelPx() > 0
                && uiAppearanceManager.ensureMapPxFilter) {
                const area = (cur.closest && cur.closest('#gmMapArea')) || document.getElementById('gmMapArea') || cur;
                uiAppearanceManager.ensureMapPxFilter(uiAppearanceManager.getGlobalPixelPx(), area);
            }
            const v = this.getMapViewBox(GM_MAP_W, GM_MAP_H, GM_MAP_PAD);
            cur.setAttribute('viewBox', v.join(' '));
            const dFloat = this.getMapDetailFloat ? this.getMapDetailFloat() : this.getMapDetail();
            cur.style.setProperty('--gm-px', String(1 / Math.max(0.5, dFloat)));
            this.updateSelectionFrames();
            try { if (typeof uiAppearanceManager !== 'undefined' && uiAppearanceManager.dirtyMapPxCanvas) uiAppearanceManager.dirtyMapPxCanvas(); } catch (e) { /* */ }
            // Ship grows only gently when zooming in (1/√zoom), so it stays readable.
            const shipScale = cur.querySelector('.gm-ship-scale');
            if (shipScale) shipScale.setAttribute('transform', 'scale(1)');
            const stageK = (this.getMapObjectScale() * this.stageTextScale()).toFixed(4);
            cur.querySelectorAll('.gm-stage-anchor').forEach((g) => g.setAttribute('transform', `translate(0,${g.getAttribute('data-r')}) scale(${stageK})`));
            if (this._mapArtDetail === this.getMapDetail() && this._mapArtSKey === this.getMapScaleKey()) {
                if (this._mapLineDetail !== this.getLineDetail()) {
                    clearTimeout(this._lineTimer);
                    this._lineTimer = setTimeout(() => swapDetail('lines'), 0);
                }
                const R = this._nebulaRegion;
                if (R && (v[0] < R.x || v[1] < R.y || v[0] + v[2] > R.x + R.w || v[1] + v[3] > R.y + R.h)) {
                    clearTimeout(this._nebTimer);
                    // Was 120ms — felt like the nebula lagged behind the camera.
                    this._nebTimer = setTimeout(() => {
                        swapDetail(true);
                    }, 32);
                }
                return;
            }
            clearTimeout(this._detailTimer);
            this._detailTimer = setTimeout(swapDetail, 0);
        };
        // Ship outline is baked into its texture, so refresh it on every zoom
        // step to keep the outline the same on-screen width.
        const applyShip = () => {
            const cur = this.overlay && this.overlay.querySelector('.galaxy-map-svg');
            const shipImg = cur && cur.querySelector('.gm-ship-marker-img');
            const url = shipImg && this.getShipIconUrl(this.getMapDetail());
            if (url && shipImg.getAttribute('href') !== url) shipImg.setAttribute('href', url);
            if (url) {
                const b = this.shipIconBox();
                ['x', 'y', 'width', 'height'].forEach((a, i) => shipImg.setAttribute(a, [b.x, b.y, b.w, b.h][i].toFixed(3)));
            }
            // Global Pixel Size: re-seat the resting marker on the lattice (the true spot is kept in data-tx/ty).
            const mk = cur && cur.querySelector(':scope > .gm-ship-marker');
            if (mk && !this._flight && this.latticeShipPt) {
                if (mk.dataset.tx == null) {
                    const mm = /translate\(([-\d.]+)[ ,]+([-\d.]+)\)/.exec(mk.getAttribute('transform') || '');
                    if (mm) { mk.dataset.tx = mm[1]; mk.dataset.ty = mm[2]; }
                }
                if (mk.dataset.tx != null) {
                    const sp = this.latticeShipPt(+mk.dataset.tx, +mk.dataset.ty);
                    mk.setAttribute('transform', `translate(${sp.x},${sp.y})`);
                }
            }
        };
        // Any manual camera input stops a running glide, which would
        // otherwise keep writing its own viewBox and snap the zoom back.
        const stopGlide = () => { this._camAnim = null; };
        const stopZoom = () => { this._zoomAnim = null; };
        this._mapArtDetail = this.getMapDetail();
        this._mapArtSKey = this.getMapScaleKey();
        // Global Pixel Size: seat the lattice once after first layout — not on every bindMapZoom.
        if (!this._pxLatticeSeated
            && typeof uiAppearanceManager !== 'undefined' && uiAppearanceManager.getGlobalPixelPx
            && uiAppearanceManager.getGlobalPixelPx() > 0) {
            this._pxLatticeSeated = true;
            clearTimeout(this._detailTimer);
            this._detailTimer = setTimeout(() => { this._mapArtSKey = null; swapDetail(); }, 450);
        }
        this._mapLineDetail = this.getLineDetail();
        // Global Pixel Size changed (settings slider): drop the cached detail and rebuild the map art.
        this._swapMapDetail = swapDetail;
        this._mapApply = apply;
        this._mapApplyCamera = applyCamera;
        if (!this._pxEvtBound) {
            this._pxEvtBound = true;
            window.addEventListener('vf:pixelsize', () => {
                try {
                    const cv = this.overlay && this.overlay.querySelector('.galaxy-map-svg');
                    const area = (this.overlay && this.overlay.querySelector('#gmMapArea'))
                        || document.getElementById('gmMapArea') || cv;
                    const g0 = uiAppearanceManager.getGlobalPixelPx();
                    if (uiAppearanceManager.ensureMapPxFilter) uiAppearanceManager.ensureMapPxFilter(g0 > 0 ? g0 : 0, area);
                    if (cv && !(g0 > 0)) cv.style.translate = '';
                } catch (e) { /* no map */ }
                if (this.resetPixelSizeDetailPeak) this.resetPixelSizeDetailPeak();
                this._pxDetailKey = null;
                this._mapArtDetail = -1;
                clearTimeout(this._detailTimer);
                this._detailTimer = setTimeout(() => {
                    try { if (this._swapMapDetail) this._swapMapDetail(); } catch (e) { /* map not mounted */ }
                    try { this.updateSelectionFrames(); } catch (e) { /* map not mounted */ }
                }, 60);
            });
        }
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
            this._userMapZoom = next; // the zoom the keyboard camera may not exceed
            if (this._zoomAnim) applyCamera();
            else apply();
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
                clearTimeout(this._lineTimer);
                clearTimeout(this._nebTimer);
                clearTimeout(this._snapTimer);
                // One full sync after the glide — never mid-frame.
                apply();
                swapDetail();
                return;
            }
            requestAnimationFrame(runZoom);
        };
        // The view box is fitted to the map area's aspect. The embedded map is laid
        // out after the first render (fonts, header, stage size), so refit whenever the
        // area changes size — otherwise a reload at another zoom keeps a stale aspect
        // and the planets come out smaller than at the same zoom reached by scrolling.
        this.reattachMapAreaObserver();
        svg.addEventListener('wheel', (e) => {
            e.preventDefault();
            stopGlide();
            const cur = this.overlay && this.overlay.querySelector('.galaxy-map-svg');
            const pt = cur ? this.clientToMapPoint(cur, e.clientX, e.clientY) : null;
            // Trackpads send many small deltas, mice a few big ones.
            const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
            if (!this._zoomAnim) syncZoomToView();
            const from = this._zoomAnim ? this._zoomAnim.target : (this.mapZoom || 1);
            let target = Math.min(12, Math.max(0.35, from * Math.exp(-Math.max(-120, Math.min(120, dy)) * 0.0022)));
            if (target === from && !this._zoomAnim) return;
            const running = !!this._zoomAnim;
            this._zoomAnim = { target: target, pt: pt };
            // Cancel any pending heavy work from a previous zoom settle.
            clearTimeout(this._detailTimer);
            clearTimeout(this._lineTimer);
            clearTimeout(this._nebTimer);
            clearTimeout(this._snapTimer);
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
            const node = e.composedPath().find((el) => el && el.classList && el.classList.contains('gm-node'));
            const post = e.composedPath().find((el) => el && el.classList && el.classList.contains('gm-post-node'));
            this._mapDrag = {
                x: e.clientX,
                y: e.clientY,
                moved: false,
                pointerId: e.pointerId,
                planetId: node && node.getAttribute('data-planet'),
                postId: post && post.getAttribute('data-post')
            };
        });
        const endDrag = (e) => {
            if (!this._mapDrag || (e.pointerId != null && e.pointerId !== this._mapDrag.pointerId)) return;
            const drag = this._mapDrag;
            this._mapDrag = null;
            svg.classList.remove('is-panning');
            if (drag.moved) {
                this._mapDragSwallow = true;
                setTimeout(() => { this._mapDragSwallow = false; }, 0);
                clearTimeout(this._nebPanTimer);
                apply();
            } else if (drag.planetId || drag.postId) {
                this.markUserPicked();
                if (drag.planetId) this.selectPlanet(drag.planetId);
                else this.selectPost(drag.postId);
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
            // Border station: select it; the card shows what opens it.
            const border = e.target.closest && e.target.closest('.gm-border-station[data-focus-planet]');
            if (border) {
                this.markUserPicked();
                this.selectBorder(border.getAttribute('data-focus-planet'), border.getAttribute('data-border-shut'));
                return;
            }
            const target = e.composedPath().find((el) => el && el.classList
                && (el.classList.contains('gm-node') || el.classList.contains('gm-post-node')));
            if (!target) {
                const point = this.clientToMapPoint(svg, e.clientX, e.clientY);
                if (!point || !this.locationPoint) return;
                const hit = (this.map.nodes || []).find((node) => {
                    const loc = this.locationPoint({ kind: 'planet', id: node.planetId });
                    const radius = Math.max(14, this.planetSurfaceRadius(node.planetId) * this.getMapObjectScale());
                    return loc && Math.hypot(point.x - loc.x, point.y - loc.y) <= radius;
                });
                if (!hit) return;
                this.markUserPicked();
                this.selectPlanet(hit.planetId);
                return;
            }
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
            const scale = Math.min(
                rect.width / Math.max(1, vb.width),
                rect.height / Math.max(1, vb.height)
            );
            this.mapPan = this.mapPan || { x: 0, y: 0 };
            this.mapPan.x -= dx / Math.max(0.0001, scale);
            this.mapPan.y -= dy / Math.max(0.0001, scale);
            delayShipLabel();
            drag.x = e.clientX;
            drag.y = e.clientY;
            // Pan: camera only (same as zoom glide) — full apply was H3 stutter.
            applyCamera();
            // Debounced refine: only rebuild nebula when the view leaves the fine patch.
            clearTimeout(this._nebPanTimer);
            this._nebPanTimer = setTimeout(() => {
                if (!mapLive()) return;
                const v = this.getMapViewBox(GM_MAP_W, GM_MAP_H, GM_MAP_PAD);
                const R = this._nebulaRegion;
                if (!R || v[0] < R.x || v[1] < R.y || v[0] + v[2] > R.x + R.w || v[1] + v[3] > R.y + R.h) {
                    if (this.refreshNebulaInPlace) this.refreshNebulaInPlace();
                }
            }, 50);
        });
        const stopWindowDrag = () => {
            const drag = this._mapDrag;
            const moved = !!(drag && drag.moved);
            this._mapDrag = null;
            const cur = this.overlay && this.overlay.querySelector('.galaxy-map-svg');
            if (cur) cur.classList.remove('is-panning');
            if (moved) {
                this._mapDragSwallow = true;
                // Clear if no click follows (released outside the map).
                setTimeout(() => { this._mapDragSwallow = false; }, 0);
                clearTimeout(this._nebPanTimer);
                // H16: pan end never refreshed nebula — patch stayed on the old tile.
                apply();
            }
        };
        window.addEventListener('pointerup', stopWindowDrag);
        window.addEventListener('pointercancel', stopWindowDrag);
    },
    /** Reattach #gmMapArea ResizeObserver after park/reuse (bindMapZoom must not re-run). */
    reattachMapAreaObserver() {
        const mapArea = this.overlay && this.overlay.querySelector('#gmMapArea');
        if (this._mapAreaRO) {
            try { this._mapAreaRO.disconnect(); } catch (e) { /* */ }
            this._mapAreaRO = null;
        }
        if (!mapArea || typeof ResizeObserver === 'undefined' || !this._mapApply) return;
        let lastW = 0, lastH = 0;
        this._mapAreaRO = new ResizeObserver(() => {
            if (this._parkedGalaxyId || !this.overlay || !this.overlay.isConnected) return;
            if (mapArea.clientWidth < 8 || mapArea.clientHeight < 8) return;
            if (mapArea.clientWidth === lastW && mapArea.clientHeight === lastH) return;
            lastW = mapArea.clientWidth;
            lastH = mapArea.clientHeight;
            if (!this._flight && !this._zoomAnim && !this._camAnim) this._mapApply('resize');
        });
        this._mapAreaRO.observe(mapArea);
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
});
