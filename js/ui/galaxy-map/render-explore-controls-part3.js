"use strict";

// GalaxyMapManager members, continued from render-explore-controls.js (kept under ~500 lines per file).
extendClass(GalaxyMapManager, {
    galaxyNebulaSvg(W, H, x0, y0) {
        const gid = String(this.galaxyId || '');
        this._nebulaCache = this._nebulaCache || {};
        const detail = this.getMapDetail ? this.getMapDetail() : 1;
        // Zoomed in: a finer copy over the visible area (plus margin), on top
        // of the coarse field with a hole cut where the fine one sits.
        let fine = null;
        if (this.getMapViewBox) {
            const v = this.getMapViewBox(W, H, typeof GM_MAP_PAD !== 'undefined' ? GM_MAP_PAD : 48);
            // The patch snaps to a tile grid, so small pans reuse the same finished patch
            // (no recompute while dragging); only crossing a tile edge builds a new one.
            const tile = 8 * Math.pow(2, Math.max(0, Math.round(Math.log2(Math.max(8, v[2] * 0.25) / 8))));
            const mx = v[2] * 0.1, my = v[3] * 0.1;
            fine = { x: Math.floor((v[0] - mx) / tile) * tile, y: Math.floor((v[1] - my) / tile) * tile };
            fine.w = Math.ceil((v[0] + v[2] + mx) / tile) * tile - fine.x;
            fine.h = Math.ceil((v[1] + v[3] + my) / tile) * tile - fine.y;
            // Screen pixels per map unit right now: the cell size follows it.
            const svgEl = typeof document !== 'undefined' ? document.querySelector('.galaxy-map-svg') : null;
            fine.spx = ((svgEl && svgEl.clientWidth) || 900) / Math.max(1, v[2]);
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
        })).map((sn, si) => {
            // Only some suns carry a nebula (stable per galaxy and sun).
            let h = 2166136261;
            String(gid).split('').concat(['#', String(si)]).forEach((ch) => { h = Math.imul(h ^ ch.charCodeAt(0), 16777619); });
            sn.neb = ((h >>> 0) % 100) < 45;
            return sn;
        });
        if (suns.length && !suns.some((sn) => sn.neb)) suns[0].neb = true;
        const sunLight = (x, y) => {
            let best = 0, rgb = null;
            suns.forEach((sn) => {
                if (!sn.neb) return;
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
        // Everything the nebula picture depends on: same signature = same picture, so a stored copy is valid.
        const nebSig = (() => {
            const raw = JSON.stringify([NEB_VERSION, gid, W, H, NEB_SCALE, layers.map((l) => [l.rgb, l.cover, l.sc, l.off, l.ang, !!l.dust]),
                suns.map((sn) => [Math.round(sn.x), Math.round(sn.y), Math.round(sn.reach), sn.rgb, !!sn.neb])]);
            let h = 2166136261;
            for (let i = 0; i < raw.length; i++) { h ^= raw.charCodeAt(i); h = Math.imul(h, 16777619); }
            return (h >>> 0).toString(36);
        })();
        const paint = (jobKey, cell, bx, by, cols, rows, oct, opaque) => {
            const tag = (href) => `<image data-neb-key="${jobKey}"${href ? ` href="${href}"` : ''} x="${bx}" y="${by}" width="${cols * cell}" height="${rows * cell}" preserveAspectRatio="none" style="image-rendering:pixelated;image-rendering:crisp-edges"/>`;
            if (this._nebUrls[jobKey]) return tag(this._nebUrls[jobKey]);
            // The finished coarse field is kept across reloads (keyed by everything that shapes it).
            const storeKey = opaque ? null : 'vf-neb:' + jobKey + ':' + nebSig;
            if (storeKey) {
                try {
                    const saved = localStorage.getItem(storeKey);
                    if (saved && saved.indexOf('data:image/png') === 0) {
                        this._nebUrls[jobKey] = saved;
                        return tag(saved);
                    }
                } catch (e) { /* storage unavailable */ }
            }
            if (typeof document === 'undefined' || this._nebJobs[jobKey]) return tag('');
            // Only the newest fine patch keeps computing.
            if (opaque) Object.keys(this._nebJobs).forEach((k) => { if (this._nebJobs[k].opaque) this._nebJobs[k].cancel = true; });
            const cv = document.createElement('canvas');
            cv.width = cols;
            cv.height = rows;
            const ctx = cv.getContext('2d');
            const img = ctx.createImageData(cols, rows);
            const px = img.data;
            const lerpTone = (arr, f) => { const x = f * (arr.length - 1), i = Math.min(arr.length - 2, Math.floor(x)); return arr[i] + (arr[i + 1] - arr[i]) * (x - i); };
            const toneAlpha = [0.05, 0.08, 0.12, 0.16];
            const job = { opaque: !!opaque, cancel: false };
            this._nebJobs[jobKey] = job;
            let r = 0;
            const slice = () => {
                if (job.cancel) { delete this._nebJobs[jobKey]; return; }
                const until = performance.now() + (opaque ? NEB_SLICE_FINE_MS : NEB_SLICE_COARSE_MS);
                for (; r < rows && performance.now() < until; r++) paintRow(r);
                if (r < rows) { setTimeout(slice, 0); return; }
                ctx.putImageData(img, 0, 0);
                // Stored (coarse) copies need a data URL; fine patches use an async blob URL instead of a
                // synchronous PNG encode + base64 string, which stalled a frame.
                if (storeKey || !cv.toBlob || typeof URL === 'undefined' || !URL.createObjectURL) { finish(cv.toDataURL()); return; }
                cv.toBlob((blob) => {
                    if (!blob) { finish(cv.toDataURL()); return; }
                    finish(URL.createObjectURL(blob));
                });
            };
            const finish = (url) => {
                this._nebUrls[jobKey] = url;
                if (storeKey) {
                    try {
                        // Keep a few galaxies only; drop the oldest.
                        const mine = [];
                        for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.indexOf('vf-neb:') === 0 && k !== storeKey) mine.push(k); }
                        mine.slice(0, Math.max(0, mine.length - 5)).forEach((k) => localStorage.removeItem(k));
                        localStorage.setItem(storeKey, url);
                    } catch (e) { /* quota / storage unavailable */ }
                }
                const fines = Object.keys(this._nebUrls).filter((k) => k.indexOf('|f') !== -1);
                if (fines.length > 4) fines.slice(0, fines.length - 4).forEach((k) => {
                    if (k === jobKey) return;
                    if (String(this._nebUrls[k]).indexOf('blob:') === 0) { try { URL.revokeObjectURL(this._nebUrls[k]); } catch (e) { /* ignore */ } }
                    delete this._nebUrls[k];
                });
                delete this._nebJobs[jobKey];
                if (opaque) this._nebLastFine = { key: jobKey, tag: tag(url) };
                document.querySelectorAll(`image[data-neb-key="${jobKey}"]`).forEach((el) => el.setAttribute('href', url));
            };
            // Swirl centres that can touch this patch, found once (not per pixel).
            const swirls = [];
            {
                const gxa = Math.floor(bx / SWIRL_CELL) - 1, gxb = Math.floor((bx + cols * cell) / SWIRL_CELL) + 1;
                const gya = Math.floor(by / SWIRL_CELL) - 1, gyb = Math.floor((by + rows * cell) / SWIRL_CELL) + 1;
                for (let gy = gya; gy <= gyb; gy++) {
                    for (let gx = gxa; gx <= gxb; gx++) {
                        const hh = swirlHash(gx, gy);
                        if (hh.p > 0.16) continue;
                        const R0 = SWIRL_CELL * (0.14 + hh.c * 0.12);
                        swirls.push({ sx: (gx + hh.a) * SWIRL_CELL, sy: (gy + hh.b) * SWIRL_CELL, R2: R0 * R0, k: hh.dir * (0.45 + hh.c * 0.5) });
                    }
                }
            }
            // Slow fields (wisps, banks, veils …) vary over hundreds of map units: sampled on a lattice
            // every BLK cells and interpolated per pixel (no blocks), then cut into hard steps.
            const BLK = 8;
            const lat = new Map();
            const latAt = (bi, bj) => {
                const key = bi * 100003 + bj;
                let o = lat.get(key);
                if (o) return o;
                const x = bx + bi * BLK * cell, y = by + bj * BLK * cell;
                const d = Math.hypot((x - cxm) / W, (y - cym) / H) + (fbm(x * 0.0014 + 40, y * 0.0014, 2) - 0.5) * 0.9;
                o = {
                    envBase: (0.3 + 0.7 * sstep(0.15, 0.75, d)) * (1 - sstep(0.9, 2.0, d)),
                    wisp: sstep(0.2, 0.6, fbm(x * 0.0007 + 130, y * 0.0007 + 60, 2)),
                    free: sstep(0.52, 0.68, fbm(x * 0.0011 + 500, y * 0.0011 + 320, 2)),
                    grain: sstep(0.4, 0.6, fbm(x * 0.0009 + 900, y * 0.0009 + 700, 2)),
                    bank: sstep(0.4, 0.62, fbm(x * 0.0005 + 1300, y * 0.0005 + 800, 2)),
                    gm: sstep(0.6, 0.74, fbm(x * 0.0016 + 210, y * 0.0016 + 90, 2)),
                    veil: layers.map((_, li) => sstep(0.3, 0.7, fbm(x * 0.0026 + 60 * li, y * 0.0026 + 20, 2)))
                };
                if (lat.size > 6000) lat.clear();
                lat.set(key, o);
                return o;
            };
            const lw = { sl: null, wisp: 0, wispK: 0, envNear: 0, grain: 0, bank: 0, gm: 0, veil: [], ang: 0 };
            const lowAt = (r, c, x, y) => {
                const bi = Math.floor(c / BLK), bj = Math.floor(r / BLK);
                const fx = (c - bi * BLK) / BLK, fy = (r - bj * BLK) / BLK;
                const A = latAt(bi, bj), B = latAt(bi + 1, bj), C = latAt(bi, bj + 1), D = latAt(bi + 1, bj + 1);
                const mix = (k) => (A[k] * (1 - fx) + B[k] * fx) * (1 - fy) + (C[k] * (1 - fx) + D[k] * fx) * fy;
                const slRaw = suns.length ? sunLight(x, y) : { k: 0, rgb: null };
                // Hard steps only (pixel art): sun light comes in 5 levels, never as a smooth gradient.
                const sl = lw.sl && lw.sl.rgb === slRaw.rgb ? lw.sl : (lw.sl = { k: 0, rgb: slRaw.rgb });
                sl.k = Math.round(slRaw.k * 14) / 14; sl.rgb = slRaw.rgb;
                lw.wisp = mix('wisp') * 0.5;
                lw.wispK = lw.wisp / 0.5;
                const freeCloud = Math.max(mix('free') * 0.35, lw.wisp);
                const sunFade = suns.length ? Math.max(Math.min(1, Math.pow(sl.k, NEB_SUN_FALLOFF) * 2.2), freeCloud) : 1;
                lw.envNear = mix('envBase') * sunFade;
                lw.grain = mix('grain');
                lw.bank = 0.02 + 0.98 * mix('bank');
                lw.gm = Math.round(mix('gm') * 8) / 8;
                for (let li = 0; li < layers.length; li++) {
                    const v = (A.veil[li] * (1 - fx) + B.veil[li] * fx) * (1 - fy) + (C.veil[li] * (1 - fx) + D.veil[li] * fx) * fy;
                    lw.veil[li] = 0.08 + 0.92 * Math.round(v * 10) / 10;
                }
                lw.ang = Math.atan2((y - cym) / H, (x - cxm) / W);
                return lw;
            };
            const paintRow = (r) => {
                const y = by + r * cell;
                for (let c = 0; c < cols; c++) {
                    const x = bx + c * cell;
                    const lw = lowAt(r, c, x, y);
                    const sl = lw.sl, wisp = lw.wisp, wispK = lw.wispK, envNear = lw.envNear;
                    if (envNear < 0.02 && sl.k < 0.05 && wisp < 0.02) continue;
                    const th = (bayer[(r % 4) * 4 + (c % 4)] / 16 - 0.5) * 0.04;
                    // Static vortices: coordinates twist around scattered centres, so clouds curl into swirls.
                    let wx = x, wy = y;
                    for (let si = 0; si < swirls.length; si++) {
                        const sw = swirls[si];
                        const dx = x - sw.sx, dy = y - sw.sy;
                        const d2 = (dx * dx + dy * dy) / sw.R2;
                        if (d2 > 4) continue;
                        const ang = sw.k * Math.exp(-d2);
                        const ca = Math.cos(ang), sa = Math.sin(ang);
                        wx = sw.sx + dx * ca - dy * sa; wy = sw.sy + dx * sa + dy * ca;
                    }
                    let R = 0, G = 0, B = 0, A = 0;
                    for (let li = 0; li < layers.length; li++) {
                        const L = layers[li];
                        let env = Math.max(envNear, sl.k * 0.9, wisp * 2.2);
                        if (L.ang != null && layers.length > 2) {
                            env *= 0.6 + 0.4 * Math.max(0, Math.cos(lw.ang - L.ang));
                        }
                        // Even the densest cloud cannot reach the lowest tone below this: skip the noise work.
                        if (env < 0.02 || (env * lw.bank < 0.06 && sl.k < 0.55)) continue;
                        const grain = lw.grain;
                        const cloudV = (mul) => {
                            const X = wx * L.sc * mul + L.off, Y = wy * L.sc * mul * 1.3 + L.off;
                            const q = fbm(X * 0.8, Y * 0.8, 2);
                            const base = fbm(X + q * 2.4, Y - q * 2.4, oct);
                            const ridge = 1 - Math.abs(fbm(X * 2.6 + 3, Y * 2.6 - q, oct - 1) * 2 - 1);
                            return base * 0.88 + ridge * ridge * ridge * 0.08;
                        };
                        let cv = grain < 0.02 ? cloudV(0.45) : grain > 0.98 ? cloudV(1.5) : cloudV(0.45) * (1 - grain) + cloudV(1.5) * grain;
                        // Big dark voids and bright banks: contrast + a very low-frequency density mask.
                        cv = 0.5 + (cv - 0.5) * 1.5;
                        const bank = lw.bank;
                        const v = (cv - (1 - L.cover) * 1.05 * (1 - wispK * 0.7)) * env * bank + sl.k * 0.12;
                        // Many soft tone steps (dithered at the edges) instead of four flat plateaus with hard contours.
                        const tt = (v + th - 0.17) / 0.3;
                        if (tt <= 0) continue;
                        let f = Math.min(1, Math.round(tt * 12) / 12);
                        if (L.dust && f > 1 / 3) f = 1 / 3;
                        // Tone colour; near a sun lifted a level and tinted by it.
                        // Self-luminous pockets: a few scattered clouds glow on their own, not tied to a sun.
                        const gm = lw.gm;
                        const lit = Math.max(sl.k, gm * 0.55);
                        const lift = lerpTone([0, 6, 14, 22], f) + lit * 14 + gm * lerpTone([4, 10, 16, 20], f);
                        const mulc = lerpTone([1, 1.1, 1.15, 1.1], f);
                        let cr = L.rgb[0] * mulc + lift, cg = L.rgb[1] * mulc + lift, cb = L.rgb[2] * mulc + lift;
                        if (sl.rgb && lit > 0.02) {
                            const t = Math.min(0.9, sl.k * 1.6);
                            cr += (sl.rgb[0] - cr) * t; cg += (sl.rgb[1] - cg) * t; cb += (sl.rgb[2] - cb) * t;
                        }
                        // Far from every sun the cloud is dim; only self-luminous pockets keep their glow.
                        const shine = 0.35 + 0.65 * Math.round(Math.min(1, Math.max(sl.k * 1.8, gm)) * 10) / 10;
                        cr *= shine; cg *= shine; cb *= shine;
                        // Translucent veils: alpha swells and thins across the cloud, so stars shine through the thin parts.
                        const veil = lw.veil[li];
                        const a = 0.34 * veil * Math.min(0.6, (L.dust ? lerpTone([0.11, 0.16], Math.min(1, f * 3)) : lerpTone(toneAlpha, f) * Math.min(1, f * 6)) * (1 + lit * 1.4 + gm * 0.6) * (1 + wispK * 1.6));
                        // Porter-Duff "over".
                        R = cr * a + R * (1 - a); G = cg * a + G * (1 - a); B = cb * a + B * (1 - a);
                        A = a + A * (1 - a);
                    }
                    const o = (r * cols + c) * 4;
                    // Soft cap: overlapping layers + suns must never wash out to white.
                    if (A > 0) {
                        const mx = Math.max(R, G, B) / A;
                        if (mx > 150) { const k = 150 / mx; R *= k; G *= k; B *= k; }
                    }
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
            // Target: about 2 screen pixels per cell, as fine as the budget allows.
            const unit = this.mapPixelUnitGlobal();
            const want = Math.max(unit, Math.sqrt(fine.w * fine.h / NEB_PIXEL_BUDGET));
            // Cell = 8 / 2^k: nests exactly in the coarse 8-unit grid (patch
            // origin is a multiple of 8), so pixels never shift between patches.
            const cell = 8 / Math.pow(2, Math.max(0, Math.round(Math.log2(8 / want))));
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
});
