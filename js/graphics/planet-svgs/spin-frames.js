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
        built.moons = feat.moons;
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

    startPlanetSpin(periodMs) {
        this.spinPeriod = periodMs || this.spinPeriod || 60000;
        if (this._spinTimer) return;
        const tick = () => {
            const els = document.querySelectorAll('[data-planet-spin]');
            if (!els.length) {
                clearInterval(this._spinTimer);
                this._spinTimer = null;
                return;
            }
            if (document.hidden) return;
            // New high-detail models are built a few per tick (frame budget) so the
            // map never freezes; planets show a cheap low-detail globe meanwhile.
            const t0 = performance.now();
            els.forEach((el) => {
                const [id, d, l] = String(el.getAttribute('data-planet-spin')).split('|');
                if (performance.now() - t0 > 10 && !this.hasSpinModel(id, Number(d) || 1, l)) return;
                const model = this.getPlanetSpinModel(id, Number(d) || 1, l);
                if (!model) return;
                const f = this.getPlanetSpinIndex(id, model);
                // Fresh elements already carry the current frame (data-spin-frame);
                // a new light direction (l) is a different model, so redraw.
                const fk = model.uid + ':' + f;
                if (el._spinFrame == null) el._spinFrame = model.uid + ':' + el.getAttribute('data-spin-frame');
                if (el._spinFrame === fk) return;
                el._spinFrame = fk;
                // Map planets are <img> (rasterised once, cheap to zoom): swap src.
                const imgEl = el.querySelector('img.gm-planet-img');
                if (imgEl) {
                    model.frameUrls = model.frameUrls || {};
                    if (!model.frameUrls[f]) model.frameUrls[f] = this.planetSvgToImg(this.getPlanetSpinFrame(model, f)).url;
                    imgEl.src = model.frameUrls[f];
                    return;
                }
                const svgEl = el.querySelector('svg');
                const w = svgEl ? svgEl.getAttribute('width') : null;
                const h = svgEl ? svgEl.getAttribute('height') : null;
                let svg = this.getPlanetSpinFrame(model, f);
                if (w) svg = svg.replace(/width="[^"]*"/, `width="${w}"`);
                if (h) svg = svg.replace(/height="[^"]*"/, `height="${h}"`);
                el.innerHTML = svg;
            });
        };
        this._spinTimer = setInterval(tick, 100);
    }
});
