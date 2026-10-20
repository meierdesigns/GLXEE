"use strict";

// PlanetSVGManager: axial rotation frames for the pixel globes.
// The surface detail (bands, craters, storms …) is the difference between the
// shaded base sphere and the finished globe. Each frame maps every row back
// onto the sphere (x → longitude) and rotates the detail around the axis, so
// features drift left → right, stretch at the limb and come back over the
// horizon. Lighting and rings stay fixed like on a real planet.
extendClass(PlanetSVGManager, {
    /** True when that model is already built (so asking for it is cheap). */
    hasSpinModel(planetName, detail, lightDir) {
        const id = String(planetName || '').toLowerCase();
        const spec = this.parseLightSpec(lightDir);
        const k = Math.max(1, Math.round(detail || 1));
        return !!(this.spinModels && this.spinModels[id + '@' + k + (spec ? '#' + spec.key : '')]);
    },

    /** Build (once) the base / detail grids a planet's spin frames sample from. */
    getPlanetSpinModel(planetName, detail, lightDir) {
        const id = String(planetName || '').toLowerCase();
        // lightDir: one step (0 … 15) or several suns, "10+3:40" (step[:weight %]).
        const spec = this.parseLightSpec(lightDir);
        const dir = spec ? spec.key : null;
        const k = Math.max(1, Math.round(detail || 1));
        if (!id) return null;
        this.getPlanetSVG(id);
        const pspec = this.planetSpecs && this.planetSpecs[id];
        if (!pspec) return null;
        this.spinModels = this.spinModels || {};
        const key = id + '@' + k + (dir == null ? '' : '#' + dir);
        if (this.spinModels[key]) return this.spinModels[key];
        const style = String(pspec.style || 'banded').toLowerCase();
        const seedKey = String(pspec.seed != null ? pspec.seed : this.hashId(id));
        const feat = pspec.features || { rings: style === 'ringed' };
        // Same recipe as createPixelPlanetSVG, keeping the bare sphere too.
        const n = (feat.rings ? Math.max(this.gridSize, 18) : this.gridSize) * k;
        let radiusBias = ((this.hashId(id + '|r') % 5) - 2) * 0.15;
        if (feat.rings) radiusBias -= 1.1;
        this._lights = spec ? spec.lights.map((l) => ({ v: this.planetLightVector(l.step), w: l.w })) : null;
        const built = this.buildBaseGrid(n, seedKey + '|' + id, radiusBias, k, (feat.rings ? 2 : 1) * k);
        this._lights = null;
        built.moons = Array.isArray(feat.moons) ? feat.moons.slice(0, 1) : [];
        const base = built.grid.map((row) => row.slice());
        this.applyStyleDetails(built.grid, style, seedKey + '|' + style, built, feat);
        const model = {
            // Noise styles are re-painted per frame on the turned sphere;
            // classic ones fall back to remapping the finished globe.
            regen: typeof PLANET_EXTRA_STYLES !== 'undefined' && PLANET_EXTRA_STYLES.indexOf(style) !== -1,
            style: style,
            styleSeed: seedKey + '|' + style,
            feat: feat,
            meta: built,
            base: base,
            final: built.grid,
            cx: built.cx,
            cy: built.cy,
            r: built.r,
            n: built.grid.length,
            palette: this.buildPalette(pspec.baseColor || this.namedPalettes[id] || '#808080', feat.altColor, feat),
            uid: 'spin_' + id.replace(/[^a-z0-9]/g, '') + '_' + k + (dir == null ? '' : 'l' + String(dir).replace(/[^0-9]/g, '_')),
            // One frame per pixel of travel at the equator.
            count: Math.max(24, Math.round(2 * Math.PI * built.r)),
            frames: []
        };
        this.spinModels[key] = model;
        return model;
    },

    /**
     * Light vector for direction step `dir` (0 … 15, clockwise from +x in
     * screen space: 10 ≈ upper left, the classic look), slightly in front.
     */
    /** "10" or "10+3:40" → { lights: [{ step, w }], key } or null. */
    parseLightSpec(raw) {
        if (raw == null || raw === '') return null;
        const lights = String(raw).split('+').map((part) => {
            const [st, wt] = part.split(':');
            const step = Number(st);
            if (!Number.isFinite(step)) return null;
            const w = wt == null ? 1 : Math.max(0.1, Math.min(1, Number(wt) / 100 || 1));
            return { step: ((Math.round(step) % 16) + 16) % 16, w: w };
        }).filter(Boolean).slice(0, 3);
        if (!lights.length) return null;
        return { lights: lights, key: lights.map((l) => l.step + (l.w < 1 ? ':' + Math.round(l.w * 100) : '')).join('+') };
    },

    planetLightVector(dir) {
        const a = (dir / 16) * Math.PI * 2;
        return [Math.cos(a) * 0.81, Math.sin(a) * 0.81, 0.58];
    },

    /** SVG of rotation frame `index` (0 … model.count-1). */
    getPlanetSpinFrame(model, index) {
        const f = ((index % model.count) + model.count) % model.count;
        if (model.frames[f]) return model.frames[f];
        const { base, final, cx, cy, r, n } = model;
        const phase = (f / model.count) * Math.PI * 2;
        if (model.regen) {
            const fresh = base.map((row) => row.slice());
            const meta = Object.assign({}, model.meta, { grid: fresh, rot: phase });
            this.applyStyleDetails(fresh, model.style, model.styleSeed, meta, Object.assign({}, model.feat));
            const out = this.gridToSvg(fresh, model.uid, model.palette, meta);
            // Finest grids (deep zoom) are cheap to rebuild but heavy to keep.
            if (model.n <= 80) model.frames[f] = out;
            return out;
        }
        const isRing = (t) => t === 'ring' || t === 'ringDark';
        const grid = base.map((row) => row.slice());
        for (let y = 0; y < n; y++) {
            const dy = y - cy;
            const hw = Math.sqrt(Math.max(0, r * r - dy * dy));
            for (let x = 0; x < n; x++) {
                const shade = base[y][x];
                const done = final[y][x];
                // Rings (and anything drawn off the body) stay put.
                if (shade === null || isRing(done)) {
                    grid[y][x] = done;
                    continue;
                }
                if (hw < 0.5) continue;
                const s = Math.max(-1, Math.min(1, (x - cx) / hw));
                // Longitude now under this pixel, turned back by the spin.
                let lon = Math.asin(s) - phase;
                lon = Math.atan2(Math.sin(lon), Math.cos(lon));
                // The far side repeats the near side, half a turn on.
                if (lon > Math.PI / 2) lon -= Math.PI;
                else if (lon < -Math.PI / 2) lon += Math.PI;
                const sx = Math.round(cx + Math.sin(lon) * hw);
                if (sx < 0 || sx >= n) continue;
                const src = final[y][sx];
                const srcBase = base[y][sx];
                if (src === null || src === srcBase || isRing(src)) continue;
                // Re-light the material for where it is now on the globe.
                grid[y][x] = this.reshadeTone(src, this.toneLevel(srcBase), this.toneLevel(shade));
            }
        }
        model.frames[f] = this.gridToSvg(grid, model.uid, model.palette, Object.assign({}, model.meta, { rot: phase }));
        return model.frames[f];
    },

    /** Frame index a planet shows right now (shared clock, per-planet offset). */
    getPlanetSpinIndex(id, model) {
        const period = this.spinPeriod || 60000;
        const offset = (this.hashId(id) % 1000) / 1000;
        return Math.floor((performance.now() / period + offset) * model.count) % model.count;
    },

    /**
     * The planet's SVG at its current rotation, so a re-render (zoom, map
     * refresh) lands on the same frame instead of jumping back to frame 0.
     */
    getPlanetSpinSVG(planetName, detail) {
        const id = String(planetName || '').toLowerCase();
        const model = this.getPlanetSpinModel(id, detail);
        return model ? this.getPlanetSpinFrame(model, this.getPlanetSpinIndex(id, model)) : '';
    },

    /**
     * Spin every `[data-planet-spin="id|detail"]` element in the page: its
     * inner SVG is swapped for the current rotation frame. One full turn
     * takes `periodMs`; a single timer serves all planets.
     */
    /**
     * Planet SVG → data URL for an <img>. The viewBox grows by `margin` (share
     * of the grid) on every side so moons outside the disc box stay visible;
     * `scale` is how much bigger the image is than the planet box.
     */
    planetSvgToImg(svg, margin) {
        const mg = margin == null ? 0.3 : margin;
        const m = /viewBox="0 0 (\d+) (\d+)"/.exec(svg || '');
        const n = m ? Number(m[1]) : 16;
        const pad = Math.round(n * mg);
        let out = String(svg || '').trim()
            .replace(/viewBox="0 0 (\d+) (\d+)"/, `viewBox="${-pad} ${-pad} ${n + 2 * pad} ${n + 2 * pad}"`)
            .replace(/width="[^"]*"/, `width="${n + 2 * pad}"`)
            .replace(/height="[^"]*"/, `height="${n + 2 * pad}"`);
        if (out.indexOf('xmlns=') === -1) out = out.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
        // base64 is ~20x cheaper than encodeURIComponent on these large rect lists.
        let url;
        try { url = 'data:image/svg+xml;base64,' + btoa(out); } catch (e) { url = 'data:image/svg+xml,' + encodeURIComponent(out); }
        return { url: url, scale: (n + 2 * pad) / n };
    },

    /**
     * Global Pixel Size: show `rawUrl` in `imgEl` snapped to a grid of gp screen px per pixel.
     * The raster is decoded once and nearest-sampled down to round(shownW / gp) pixels (cached),
     * so art that is finer than gp (already at the minimum detail) still has uniform pixels.
     */
    snapPixelImg(imgEl, rawUrl, shownW, geo) {
        const gp = (typeof uiAppearanceManager !== 'undefined' && uiAppearanceManager.getGlobalPixelPx)
            ? uiAppearanceManager.getGlobalPixelPx() : 0;
        imgEl._rawUrl = rawUrl;
        imgEl._snapGeo = geo || null;
        // Without a global Pixel Size the planet still gets whole-screen-pixel texels ("auto" mode, needs geo.live).
        const auto = !(gp > 0) && geo && geo.live > 0 && shownW > 0;
        if ((!(gp > 0) && !auto) || !(shownW > 0)) {
            if (imgEl.getAttribute('src') !== rawUrl) imgEl.src = rawUrl;
            return;
        }
        const N = gp > 0 ? Math.max(1, Math.round(shownW / gp)) : 0;
        let h = 5381;
        for (let i = 0; i < rawUrl.length; i += 17) h = ((h << 5) + h + rawUrl.charCodeAt(i)) | 0;
        const key = rawUrl.length + ':' + h + '|' + (gp > 0 ? N : 'a' + Math.round(shownW));
        this._snapCache = this._snapCache || new Map();
        imgEl.style.imageRendering = 'pixelated';
        const place = (entry) => {
            if (imgEl.getAttribute('src') !== entry.url) imgEl.src = entry.url;
            const g = imgEl._snapGeo;
            // Auto mode only: seat whole-screen-pixel texels in the icon box.
            // Global Pixel Size keeps the icon box from planetIconHtml / spin and only
            // swaps in a gp-quantized bitmap (resizing here shrank planets to native texels).
            if (!g || !(g.live > 0) || !entry.t) return;
            const W = entry.n * entry.t / g.live;
            imgEl.style.width = W + 'px';
            imgEl.style.height = W + 'px';
            imgEl.style.left = ((g.size - W) / 2) + 'px';
            imgEl.style.top = ((g.size - W) / 2) + 'px';
        };
        const hit = this._snapCache.get(key);
        if (hit) { place(hit); return; }
        const im = new Image();
        im.onload = () => {
            let out = rawUrl;
            const nat = im.naturalWidth || 0;
            let n = nat || N, t = 0;
            if (auto) {
                t = Math.max(1, Math.ceil(shownW / Math.max(1, nat) - 0.2)); // never shrink the planet by more than ~1/5 texel
                n = Math.max(1, Math.min(nat, Math.round(shownW / t)));
            } else {
                n = nat > N ? N : (nat || N);
            }
            if (nat > n) {
                const c = document.createElement('canvas');
                c.width = c.height = n;
                const ctx = c.getContext('2d');
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(im, 0, 0, n, n);
                out = c.toDataURL();
            }
            const entry = { url: out, n: n, t: t };
            if (this._snapCache.size > 600) this._snapCache.delete(this._snapCache.keys().next().value);
            this._snapCache.set(key, entry);
            if (imgEl._rawUrl === rawUrl) place(entry);
        };
        im.src = rawUrl;
    },

    /** True when global PERF / reduced-motion says planet spin should freeze. */
    isPlanetSpinAllowed() {
        try {
            const root = document.documentElement;
            if (root.getAttribute('data-vf-perf-anim') === 'off') return false;
            if (root.getAttribute('data-vf-performance') != null) return false;
            if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) {
                return false;
            }
            // Combat owns the main thread (runtime: spin tick spikes >200ms while
            // GameLoop JS stayed cheap). Decorative planet spin waits outside fights.
            if (root.classList.contains('vf-game-shown')) return false;
            // Map spin is allowed again — round-robin budget in startPlanetSpin caps cost.
        } catch (e) { /* allow */ }
        return true;
    },

    /** Keep spin detail aligned with map node art (same grid as planetIconHtml). */
    clampSpinDetail(detail) {
        const d = Math.max(1, Math.round(Number(detail) || 1));
        const gp = (typeof uiAppearanceManager !== 'undefined' && uiAppearanceManager.getGlobalPixelPx)
            ? uiAppearanceManager.getGlobalPixelPx() : 0;
        return Math.min(8, d);
    },

    /** Keep a small LRU of spin frame data-URLs (full turns are hundreds of ~200KB blobs). */
    rememberSpinFrameUrl(model, frame, url) {
        if (!model) return;
        model.frameUrls = model.frameUrls || {};
        model.frameUrlOrder = model.frameUrlOrder || [];
        if (!model.frameUrls[frame]) {
            model.frameUrls[frame] = url;
            model.frameUrlOrder.push(frame);
            while (model.frameUrlOrder.length > 12) {
                const drop = model.frameUrlOrder.shift();
                delete model.frameUrls[drop];
            }
        }
        return model.frameUrls[frame];
    },

    startPlanetSpin(periodMs) {
        this.spinPeriod = periodMs || this.spinPeriod || 60000;
        if (this._spinTimer) return;
        this._spinCursor = 0;
        const tick = () => {
            if (!this.isPlanetSpinAllowed()) return;
            const els = document.querySelectorAll('[data-planet-spin]');
            if (!els.length) {
                clearInterval(this._spinTimer);
                this._spinTimer = null;
                return;
            }
            if (document.hidden) return;
            // Round-robin with a short frame budget: same detail/quality as before,
            // but never rebuild every planet in one tick (that froze the shell).
            const n = els.length;
            // Placeholders (data-spin-frame=-1) get extra budget so coarse first paints upgrade fast.
            let pendingUpgrade = 0;
            for (let i = 0; i < n; i++) {
                if (els[i] && els[i].getAttribute('data-spin-frame') === '-1') pendingUpgrade++;
            }
            const budgetMs = pendingUpgrade ? 14 : 6;
            const maxUpdates = pendingUpgrade ? 2 : 2;
            const t0 = performance.now();
            let updated = 0;
            for (let tried = 0; tried < n && updated < maxUpdates && performance.now() - t0 < budgetMs; tried++) {
                // Prefer placeholders so zoomed map nodes leave detail-1 ASAP.
                let el = null;
                if (pendingUpgrade > 0) {
                    for (let j = 0; j < n; j++) {
                        const cand = els[(this._spinCursor + tried + j) % n];
                        if (cand && cand.getAttribute('data-spin-frame') === '-1') { el = cand; break; }
                    }
                }
                if (!el) el = els[(this._spinCursor + tried) % n];
                if (!el || !el.isConnected) continue;
                // Inside the galaxy-map SVG, getBoundingClientRect is unreliable
                // (viewBox / foreignObject often reports planets far off-screen
                // while they are clearly visible). Never cull those — the
                // round-robin budget already caps the work.
                const onMap = !!el.closest('.galaxy-map-svg');
                if (!onMap) {
                    try {
                        const rect = el.getBoundingClientRect();
                        if (rect.width < 2 || rect.height < 2) continue;
                        if (rect.bottom < -40 || rect.right < -40
                            || rect.top > innerHeight + 40 || rect.left > innerWidth + 40) continue;
                    } catch (e) { /* still try */ }
                }
                const [id, d, l] = String(el.getAttribute('data-planet-spin')).split('|');
                const detail = this.clampSpinDetail(d);
                const upgrading = el.getAttribute('data-spin-frame') === '-1';
                if (performance.now() - t0 > budgetMs && !this.hasSpinModel(id, detail, l)) continue;
                const model = this.getPlanetSpinModel(id, detail, l);
                if (!model) continue;
                const f = this.getPlanetSpinIndex(id, model);
                const fk = model.uid + ':' + f;
                // Fine grids advance slowly; coarse map icons stay on the shared period.
                // Upgrades from the placeholder always go through immediately.
                if (!upgrading && model.n > 72 && el._spinFrame != null && el._spinFrame !== fk) {
                    const nowT = performance.now();
                    if (el._lastSpinT && nowT - el._lastSpinT < 900) continue;
                    el._lastSpinT = nowT;
                }
                if (el._spinFrame == null) el._spinFrame = model.uid + ':' + el.getAttribute('data-spin-frame');
                if (el._spinFrame === fk) continue;
                el._spinFrame = fk;
                el.setAttribute('data-spin-frame', String(f));
                const imgEl = el.querySelector('img.gm-planet-img');
                if (imgEl) {
                    const conv = this.planetSvgToImg(this.getPlanetSpinFrame(model, f));
                    let url = model.frameUrls && model.frameUrls[f];
                    if (!url) url = this.rememberSpinFrameUrl(model, f, conv.url);
                    // Match icon box to the (possibly finer) frame's scale after an upgrade.
                    const px = Number(el.getAttribute('data-planet-px')) || imgEl.clientWidth || 48;
                    const big = px * (conv.scale || model.frameScale || 1);
                    const gm = (typeof galaxyMapManager !== 'undefined' && galaxyMapManager.mapScreenScale && el.closest('.galaxy-map-svg')) ? galaxyMapManager : null;
                    const live = gm ? gm.mapScreenScale() : 0;
                    const gpOn = typeof uiAppearanceManager !== 'undefined' && uiAppearanceManager.getGlobalPixelPx
                        && uiAppearanceManager.getGlobalPixelPx() > 0;
                    if (live > 0) this.snapPixelImg(imgEl, url, big * live, gpOn ? null : { live: live, size: px });
                    else if (imgEl.getAttribute('src') !== url) imgEl.src = url;
                    const off = -(big - px) / 2;
                    imgEl.style.width = big + 'px';
                    imgEl.style.height = big + 'px';
                    imgEl.style.left = off + 'px';
                    imgEl.style.top = off + 'px';
                    if (conv.scale) model.frameScale = conv.scale;
                    updated++;
                    continue;
                }
                const svgEl = el.querySelector('svg');
                const w = svgEl ? svgEl.getAttribute('width') : null;
                const h = svgEl ? svgEl.getAttribute('height') : null;
                let svg = this.getPlanetSpinFrame(model, f);
                if (w) svg = svg.replace(/width="[^"]*"/, `width="${w}"`);
                if (h) svg = svg.replace(/height="[^"]*"/, `height="${h}"`);
                el.innerHTML = svg;
                updated++;
            }
            this._spinCursor = (this._spinCursor + Math.max(1, updated || 1)) % Math.max(1, n);
        };
        // ~2 Hz: 60s axial turn still reads fine; half the decode/repaint of the old 5 Hz.
        this._spinTimer = setInterval(tick, 450);
    }
});
