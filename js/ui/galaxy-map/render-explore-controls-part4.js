"use strict";

// GalaxyMapManager members, continued from render-explore-controls.js (kept under ~500 lines per file).
extendClass(GalaxyMapManager, {
    /**
     * Pixel suns behind the map (planetConfigManager.getGalaxySuns): stepped
     * glow squares, a pixel disc and a bright core, gently pulsing.
     */
    galaxySunsSvg(W, H, pad) {
        if (typeof planetConfigManager === 'undefined' || !planetConfigManager.getGalaxySuns) return '';
        const suns = planetConfigManager.getGalaxySuns(this.galaxyId) || [];
        this.prepareSunDrift(W, H, pad);
        // Parse #rrggbb once (canvas can't use CSS vars / color-mix).
        const hexRgb = (hex, fallback) => {
            const m = /^#([0-9a-f]{6})$/i.exec(String(hex || '').trim());
            if (!m) return fallback;
            const n = parseInt(m[1], 16);
            return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
        };
        const bakeSun = (i, r, px, detail, color, glow) => {
            // One pixelated sprite per sun (glow + disc + granulation). SVG rect
            // strips per ring were hundreds of nodes and forced continuous
            // animation repaints — the baked image keeps the look, not the cost.
            const cell = Math.max(px, (2 * r * 2.6) / 96);
            const n = Math.max(8, Math.round((2 * r * 2.6) / cell));
            const octaves = Math.max(2, Math.min(4, 2 + Math.floor(Math.log2(Math.max(1, detail)))));
            const skey = `${this.galaxyId}|${i}|${n}|${octaves}|${color}|${glow}`;
            this._sunSurf = this._sunSurf || {};
            let url = this._sunSurf[skey];
            if (!url && typeof document !== 'undefined') {
                const cv = document.createElement('canvas');
                cv.width = n; cv.height = n;
                const cx2 = cv.getContext('2d');
                const img = cx2.createImageData(n, n);
                const sunRgb = hexRgb(color, [255, 160, 64]);
                const glowRgb = hexRgb(glow, [255, 120, 40]);
                const hash = (x, y) => {
                    let h = Math.imul(x * 374761393 + y * 668265263 + (i + 1) * 982451653, 1274126177);
                    h = Math.imul(h ^ (h >>> 13), 1103515245);
                    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
                };
                const vnoise = (x, y) => {
                    const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
                    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
                    return (hash(x0, y0) * (1 - u) + hash(x0 + 1, y0) * u) * (1 - v)
                        + (hash(x0, y0 + 1) * (1 - u) + hash(x0 + 1, y0 + 1) * u) * v;
                };
                const half = n / 2;
                const rCell = r / cell;
                for (let yy = 0; yy < n; yy++) {
                    for (let xx = 0; xx < n; xx++) {
                        const dx = xx + 0.5 - half, dy = yy + 0.5 - half;
                        const q = Math.hypot(dx, dy) / rCell;
                        const k = (yy * n + xx) * 4;
                        let rr = 0, gg = 0, bb = 0, aa = 0;
                        if (q <= 2.6) {
                            if (q > 1.0) {
                                const t = q <= 1.7 ? 0.2 : 0.12 * (1 - (q - 1.7) / 0.9);
                                rr = glowRgb[0]; gg = glowRgb[1]; bb = glowRgb[2];
                                aa = Math.max(0, Math.round(255 * t));
                            } else {
                                const limb = 1 - q * 0.35;
                                rr = Math.round(sunRgb[0] * limb);
                                gg = Math.round(sunRgb[1] * limb);
                                bb = Math.round(sunRgb[2] * limb);
                                aa = 255;
                                if (q < 0.72) {
                                    rr = Math.round(rr * 0.4 + 255 * 0.6);
                                    gg = Math.round(gg * 0.4 + 255 * 0.6);
                                    bb = Math.round(bb * 0.4 + 255 * 0.6);
                                }
                                if (q < 0.38) { rr = gg = bb = 255; }
                                let v = 0, amp = 0.5, f = 3, tot = 0;
                                for (let o = 0; o < octaves; o++) {
                                    v += vnoise(dx / rCell * f + 40 * i, dy / rCell * f) * amp;
                                    tot += amp; amp *= 0.55; f *= 2;
                                }
                                v /= tot;
                                if (v < 0.34) { rr = Math.round(rr * 0.55); gg = Math.round(gg * 0.55); bb = Math.round(bb * 0.55); }
                                else if (v > 0.66) {
                                    rr = Math.min(255, rr + 40);
                                    gg = Math.min(255, gg + 40);
                                    bb = Math.min(255, bb + 28);
                                }
                            }
                        }
                        img.data[k] = rr; img.data[k + 1] = gg; img.data[k + 2] = bb; img.data[k + 3] = aa;
                    }
                }
                cx2.putImageData(img, 0, 0);
                url = this._sunSurf[skey] = cv.toDataURL();
                const keys = Object.keys(this._sunSurf);
                if (keys.length > 24) delete this._sunSurf[keys[0]];
            }
            const side = n * cell;
            return url
                ? `<image class="gm-sun-sprite" href="${url}" x="${(-side / 2).toFixed(2)}" y="${(-side / 2).toFixed(2)}" width="${side.toFixed(2)}" height="${side.toFixed(2)}" preserveAspectRatio="none"/>`
                : '';
        };
        return suns.map((s, i) => {
            const pose = this._sunDrift[i];
            const at = this.sunDriftPos(pose, performance.now() / 1000);
            const r = pose.r;
            const detail = this.getMapDetail ? this.getMapDetail() : 1;
            const px = 8 / Math.pow(2, Math.max(0, Math.round(Math.log2(8 / this.mapPixelUnitGlobal()))));
            const delay = `animation-delay:${(-i * 1.7).toFixed(1)}s`;
            const sprite = bakeSun(i, r, px, detail, s.color, s.glow);
            return `
                <g class="gm-sun gm-sun-${s.kind}" data-sun="${i}" transform="translate(${at.x.toFixed(1)},${at.y.toFixed(1)})" style="--sun:${s.color};--sun-glow:${s.glow}">
                    <title>${s.kind.toUpperCase()} STAR</title>
                    <g class="gm-sun-body" style="${delay}">${sprite}</g>
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
    /**
     * Light spec for a planet at x, y: every sun within reach adds a light
     * ("10" = one sun, "10+3:40" = a second at 40% strength). A sun counts
     * while the planet is inside ~2.6 of its radii (its weight r²/d² ≥ 0.15);
     * the strongest one always counts. null = default light.
     */
    planetLightDir(x, y) {
        const drift = this._sunDrift || [];
        if (!drift.length) return null;
        const t = performance.now() / 1000;
        const list = drift.map((pose) => {
            const p = this.sunDriftPos(pose, t);
            const dx = p.x - x;
            const dy = p.y - y;
            const d = Math.hypot(dx, dy) || 1;
            const w = (pose.r * pose.r) / (d * d);
            const step = ((Math.round(Math.atan2(dy, dx) / (Math.PI * 2) * 16) % 16) + 16) % 16;
            return { w: w, step: step };
        }).sort((a, b) => b.w - a.w);
        const top = list[0];
        if (!top) return null;
        const lights = [];
        list.forEach((l, i) => {
            if (i > 0 && l.w < 0.15) return;
            const rel = Math.max(0.2, Math.min(1, l.w / top.w));
            const found = lights.find((o) => o.step === l.step);
            if (found) { found.w = Math.min(1, found.w + rel); return; }
            if (lights.length < 3) lights.push({ step: l.step, w: rel });
        });
        return lights.map((l) => l.step + (l.w < 0.95 ? ':' + (Math.round(l.w * 10) * 10) : '')).join('+');
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
            // Decorative sun drift: skip while pixel-size is on (idle map stays static, less SVG thrash).
            try {
                if (document.documentElement.getAttribute('data-vf-pixel-size') === 'on') return;
                if (document.documentElement.getAttribute('data-vf-perf-anim') === 'off') return;
            } catch (e) { /* */ }
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
        }, 2000);
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
        let width = (o.width || 2.6) / this.getLineDetail();
        // Fine grid (smoother diagonals), but never more than ~8 px across.
        let p = Math.max(1 / d, width / 8);
        // Global Pixel Size: brush cell = lattice / vfMapPx cell.
        // Width is N cells (from design width at GM_PIXEL_U0), not a fixed map
        // length — otherwise zoom-in makes beams look chunkier on screen.
        const uL = this.mapPxLatticeUnit ? this.mapPxLatticeUnit() : 0;
        if (uL > 0) {
            const cells = Math.max(1, Math.round((o.width || 2.6) / GM_PIXEL_U0));
            width = cells * uL;
            p = uL;
        }
        const rad = width / 2 / p;          // brush radius in pixels
        // Energy beam: white-hot centre, coloured core, glow, faint halo.
        // On the lattice, keep glow/halo proportional to the core (fixed +1.6/+3.6
        // cell padding made close-zoom routes look several gp too thick).
        const hotRad = Math.max(0.5, rad * 0.4);
        const glowRad = uL > 0 ? Math.max(rad + 0.5, rad * 1.55) : rad + 1.6;
        const haloRad = uL > 0 ? Math.max(rad + 1, rad * 2.35) : rad + 3.6;
        // Route preview: thin dashes with wide gaps, marching towards the target.
        if (o.run) {
            // Dashes are cells on the line's grid (like the packets), marched by F frames.
            const dash = width * 5, period = dash + width * 8;
            const F = 8, dur = 1.2;
            const cRad = Math.max(0.71, rad), gRad = Math.max(cRad + 0.71, rad * 2.4);
            const G = Math.ceil(gRad);
            const frame = (shift) => {
                const core = new Map(), glow = new Map();
                const put = (map, gx, gy) => { let row = map.get(gy); if (!row) { row = new Set(); map.set(gy, row); } row.add(gx); };
                let trav = 0;
                for (let i = 0; i < points.length - 1; i++) {
                    const a = points[i], b = points[i + 1];
                    const len = Math.hypot(b.x - a.x, b.y - a.y);
                    const n = Math.max(1, Math.ceil(len / (p * 0.5)));
                    for (let s = 0; s <= n; s++) {
                        const m = (((trav + len * s / n - shift) % period) + period) % period;
                        if (m >= dash) continue;
                        const cx = (a.x + (b.x - a.x) * s / n) / p, cy = (a.y + (b.y - a.y) * s / n) / p;
                        const bx = Math.floor(cx), by = Math.floor(cy);
                        for (let yy = -G; yy <= G; yy++) {
                            for (let xx = -G; xx <= G; xx++) {
                                const gx = bx + xx, gy = by + yy;
                                const dd = Math.hypot(gx + 0.5 - cx, gy + 0.5 - cy);
                                if (dd <= cRad) put(core, gx, gy);
                                else if (dd <= gRad) put(glow, gx, gy);
                            }
                        }
                    }
                    trav += len;
                }
                return { core, glow };
            };
            const cellPath = (map, skip) => {
                let out = '';
                map.forEach((row, gy) => {
                    const xs = Array.from(row).filter((x) => !(skip && skip.get(gy) && skip.get(gy).has(x))).sort((m, q) => m - q);
                    for (let k = 0; k < xs.length;) {
                        let e = k;
                        while (e + 1 < xs.length && xs[e + 1] === xs[e] + 1) e++;
                        out += `M${+(xs[k] * p).toFixed(3)} ${+(gy * p).toFixed(3)}h${+((e - k + 1) * p).toFixed(3)}v${+p.toFixed(3)}h${-+((e - k + 1) * p).toFixed(3)}z`;
                        k = e + 1;
                    }
                });
                return out;
            };
            let frames = '';
            for (let k = 0; k < F; k++) {
                const fr = frame(k * period / F);
                const st = `animation-duration:${dur}s;animation-delay:${((k / F - 1) * dur).toFixed(3)}s`;
                const f0 = k ? '' : ' gm-pxflow-f0';
                frames += `<path class="gm-run-glow gm-run-cells${f0}" d="${cellPath(fr.glow, fr.core)}" style="${st}"/>` +
                    `<path class="gm-run-core gm-run-cells${f0}" d="${cellPath(fr.core)}" style="${st}"/>`;
            }
            return `<g class="${cls} gm-pxline gm-pxline-run" shape-rendering="crispEdges">${frames}</g>`;
        }
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
        // Row runs → one compact path per layer.
        // Data packets use two parallel lanes, one for each direction.
        // Pulse spacing is in map units so slices of one line stay in phase.
        let flow = '';
        if ((!o.dash || o.traffic) && !o.noFlow) {
            const fp = rg
                ? [{ x: points[0].x + rx * rg[0], y: points[0].y + ry * rg[0] }, { x: points[0].x + rx * rg[1], y: points[0].y + ry * rg[1] }]
                : points;
            const off = rg ? Math.sqrt(rl2) * rg[0] : 0;
            // Short, separated packets make the bidirectional traffic
            // readable as data travelling over the route.
            const pattern = o.traffic ? [1.6, 14] : [1.8, 8, 2.8, 11];
            const period = pattern.reduce((m, v) => m + v, 0) * width;
            const dashes = pattern.map((v) => (v * width).toFixed(2)).join(' ');
            const packetWidth = o.traffic
                ? Math.max(p, width * 0.45)
                : Math.max(p, rad * 1.25 * p);
            const laneOffset = o.traffic
                ? Math.max(packetWidth * 1.2, p)
                : Math.max(packetWidth * 1.4, p * 1.5);
            const lanePts = (side) => fp.map((q, i) => {
                const prev = fp[Math.max(0, i - 1)];
                const next = fp[Math.min(fp.length - 1, i + 1)];
                const dx = next.x - prev.x;
                const dy = next.y - prev.y;
                const length = Math.hypot(dx, dy) || 1;
                return { x: q.x - dy / length * laneOffset * side, y: q.y + dx / length * laneOffset * side };
            });
            // Packets are cells on the line's own grid (not vector strokes), so they share
            // its pixel size. The march is F pre-built frames shown one after another.
            // 8 frames (was 16): half the animated path nodes, still stepped/pixel-art.
            const F = 8;
            const dur = o.traffic ? 5.4 : 3.2;
            const on = [];
            let acc = 0;
            pattern.forEach((v, i) => { if (i % 2 === 0) on.push([acc * width, (acc + v) * width]); acc += v; });
            const isOn = (s) => {
                const m = ((s % period) + period) % period;
                return on.some((iv) => m >= iv[0] && m < iv[1]);
            };
            const pr = Math.max(0.71, packetWidth / 2 / p);
            const PR = Math.ceil(pr);
            const laneCells = (pts, shift) => {
                const cells = new Map();
                let trav = off;
                for (let i = 0; i < pts.length - 1; i++) {
                    const a = pts[i], b = pts[i + 1];
                    const len = Math.hypot(b.x - a.x, b.y - a.y);
                    const n = Math.max(1, Math.ceil(len / (p * 0.5)));
                    for (let s = 0; s <= n; s++) {
                        if (!isOn(trav + len * s / n - shift)) continue;
                        const cx = (a.x + (b.x - a.x) * s / n) / p;
                        const cy = (a.y + (b.y - a.y) * s / n) / p;
                        const bx = Math.floor(cx), by = Math.floor(cy);
                        for (let yy = -PR; yy <= PR; yy++) {
                            for (let xx = -PR; xx <= PR; xx++) {
                                const gx = bx + xx, gy = by + yy;
                                if (Math.hypot(gx + 0.5 - cx, gy + 0.5 - cy) > pr) continue;
                                let row = cells.get(gy);
                                if (!row) { row = new Set(); cells.set(gy, row); }
                                row.add(gx);
                            }
                        }
                    }
                    trav += len;
                }
                return cells;
            };
            const flowClass = o.traffic ? ' gm-post-traffic' : '';
            [[-1, 1, 0, ''], [1, -1, period / 2, ' gm-pxline-flow-reverse']].forEach(([side, dir, base, rev]) => {
                const pts = lanePts(side);
                for (let k = 0; k < F; k++) {
                    const d = toPath(laneCells(pts, base + dir * k * period / F));
                    if (!d) continue;
                    flow += `<path class="gm-pxline-flow gm-pxflow-cells${k ? '' : ' gm-pxflow-f0'}${rev}${flowClass}" d="${d}" style="animation-duration:${dur}s;animation-delay:${((k / F - 1) * dur).toFixed(3)}s"/>`;
                }
            });
        }
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
        const size = this.planetNodeSize(planetId);
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
        if (typeof profileManager === 'undefined') return '';
        let out = '';
        // Straight radial tethers only: routePath detours break when gm-lane-rot
        // spins the polyline around the planet (free end leaves the station).
        const W = typeof GM_MAP_W !== 'undefined' ? GM_MAP_W : 640;
        const H = typeof GM_MAP_H !== 'undefined' ? GM_MAP_H : 320;
        const pad = typeof GM_MAP_PAD !== 'undefined' ? GM_MAP_PAD : 48;
        const SX = (W - pad * 2) * 2.0, SY = (H - pad * 2) * 2.0;
        (this.getTradingPosts() || []).forEach((post) => {
            const open = profileManager.isTradingPostUnlocked ? profileManager.isTradingPostUnlocked(post) : true;
            (post.anchors || [post.planetId]).forEach((pid) => {
                const pn = this.nodeById && this.nodeById[pid];
                if (!pn) return;
                let cx = W / 2 + (pn.x - 0.5) * SX;
                let cy = H / 2 + (pn.y - 0.5) * SY;
                let sx = W / 2 + (post.x - 0.5) * SX;
                let sy = H / 2 + (post.y - 0.5) * SY;
                if (this.latticeMapPt) {
                    const pL = this.latticeMapPt(cx, cy);
                    const sL = this.latticeMapPt(sx, sy);
                    cx = pL.x; cy = pL.y; sx = sL.x; sy = sL.y;
                }
                const dx = sx - cx, dy = sy - cy;
                const dist = Math.hypot(dx, dy);
                if (dist < 1) return;
                const ux = dx / dist, uy = dy / dist;
                const planetR = this.planetSurfaceRadius(pid) * this.nodeObjScale() * 0.88;
                // Station art: 18×18 cells centred on 0, scaled by planetPixelSize * 0.42.
                const pp = (this.planetPixelSize ? this.planetPixelSize(pid) : 2) * this.nodeObjScale();
                const stationR = Math.max(4, 9 * pp * 0.42 * 0.92);
                if (dist <= planetR + stationR + 1) return;
                const p = [
                    { x: cx + ux * planetR, y: cy + uy * planetR },
                    { x: sx - ux * stationR, y: sy - uy * stationR }
                ];
                out += `<g class="gm-lane-rot" data-post="${post.id}" data-a="${post.orbitA == null ? 0 : post.orbitA}" data-cx="${cx.toFixed(2)}" data-cy="${cy.toFixed(2)}">`
                    + this.pixelLineSvg(p, 'gm-edge gm-post-lane ' + (open ? 'lit' : 'dim'), { dash: [2, 1], traffic: true }) + '</g>';
            });
        });
        return out;
    },
    /**
     * Active mission mark on the target planet. Combat raids/hunts show a
     * minimal fleet in space (same spirit as planetBattleSvg explosions on
     * invaded worlds); other mission types keep a small icon pin + tooltip.
     */
    missionMarkerSvg(planetId, size) {
        if (typeof profileManager === 'undefined' || !profileManager.getActiveProfile) return '';
        const p = profileManager.getActiveProfile();
        const m = p && p.activeMission;
        if (!m || !m.planetId || String(m.planetId) !== String(planetId)) return '';
        if (m.galaxyId && this.galaxyId && String(m.galaxyId) !== String(this.galaxyId)) return '';
        const cfg = (typeof planetConfigManager !== 'undefined' && planetConfigManager.getConfig)
            ? planetConfigManager.getConfig(m.planetId) : null;
        const planet = String((cfg && cfg.name) || m.planetId || '').toUpperCase();
        const type = String(m.type || 'MISSION').toUpperCase();
        const reward = Object.keys(m.reward || {}).map((k) =>
            m.reward[k] + ' ' + (k === 'credits' ? 'CR' : k.toUpperCase())).join(' · ');
        const objective = 'Complete the ' + String(m.type || 'mission').toLowerCase() + ' on ' + planet + '.';
        const tipHead = type;
        const tipBody = (planet + ' — ' + objective
            + (reward ? '\nREWARD ' + reward : ''));
        const esc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, (ch) =>
            ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
        const fStyle = m.factionId && typeof factionShipStyles !== 'undefined' && factionShipStyles.getFactionStyle
            ? factionShipStyles.getFactionStyle(m.factionId) : null;
        const accent = (fStyle && fStyle.accent) || 'var(--color-primary)';
        const f = size / 2 + 10;
        const icon = (typeof iconRenderer !== 'undefined' && iconRenderer.imgHtml)
            ? iconRenderer.imgHtml('navScroll', 12, 'gm-mission-mark-ico', accent, false)
            : '';
        const iconPin = (oy) =>
            `<g class="gm-mission-sign" transform="translate(0,${oy})">` +
            `<rect class="gm-mission-sign-board" x="-9" y="-9" width="18" height="18"/>` +
            `<rect class="gm-mission-sign-board-in" x="-7" y="-7" width="14" height="14"/>` +
            `<foreignObject class="gm-mission-sign-fo" x="-8" y="-8" width="16" height="16">` +
            `<div xmlns="http://www.w3.org/1999/xhtml" class="gm-mission-sign-icon"` +
            ` data-ui-tip-head="${esc(tipHead)}" data-ui-tip="${esc(tipBody)}"` +
            ` aria-label="${esc(tipHead)}">${icon}</div></foreignObject>` +
            `</g>`;
        const fleetType = (type === 'RAID' || type === 'HUNT');
        if (fleetType) {
            return `<g class="gm-mission-mark is-fleet" style="--fac:${accent}">` +
                this.missionFleetSvg(planetId) +
                iconPin(f + 14) +
                `</g>`;
        }
        return `<g class="gm-mission-mark" style="--fac:${accent}">` +
            iconPin(-(f + 14)) +
            `<line class="gm-mission-sign-pole" x1="0" y1="${-(f + 5)}" x2="0" y2="${-f}"/>` +
            `<circle class="gm-mission-sign-dot" cx="0" cy="${-f}" r="2.5"/>` +
            `</g>`;
    },
    /**
     * Tiny chevron fleet in space around a raid/hunt planet — outside the
     * disc, seeded per planet, pulsing like the invasion battle pixels.
     */
    missionFleetSvg(planetId) {
        const k = this.getMapObjectScale();
        const cell = Math.max(1.5, (this.planetPixelSize ? this.planetPixelSize(planetId) : 2) * k);
        const r = this.planetSurfaceRadius(planetId) * k;
        let seed = 0xF1EE7;
        for (const ch of String(planetId)) seed = (Math.imul(seed, 31) + ch.charCodeAt(0)) >>> 0;
        const rnd = () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) >>> 8) / 16777216;
        const n = 5 + Math.floor(rnd() * 3);
        let out = '<g class="gm-fleet" shape-rendering="crispEdges">';
        for (let i = 0; i < n; i++) {
            const a = rnd() * Math.PI * 2;
            const d = r + cell * (2.2 + rnd() * 4.5);
            const x = Math.cos(a) * d;
            const y = Math.sin(a) * d;
            // Nose along the orbit tangent so the pack reads as flying, not stuck.
            const deg = (a * 180 / Math.PI) + 90 + (rnd() - 0.5) * 28;
            const s = (0.55 + rnd() * 0.35) * Math.max(0.85, cell / 2);
            const delay = (rnd() * 2.8).toFixed(2);
            out += `<g class="gm-fleet-ship" transform="translate(${x.toFixed(2)},${y.toFixed(2)}) rotate(${deg.toFixed(1)}) scale(${s.toFixed(2)})" style="--bd:${delay}s">` +
                `<path d="M0 -4 L3 3 L0 1.5 L-3 3 Z"/>` +
                `</g>`;
        }
        return out + '</g>';
    },

    /** "UNDER ATTACK" marker on the planet of an active invasion (invasion-scenario.js). */
    invasionMarkerSvg(planetId, size) {
        if (typeof profileManager === 'undefined' || !profileManager.getInvadedPlanetId) return '';
        if (profileManager.getInvadedPlanetId(this.galaxyId) !== planetId) return '';
        const inv = profileManager.getActiveInvasion(null, this.galaxyId);
        const st = typeof factionShipStyles !== 'undefined' && factionShipStyles.getFactionStyle
            ? factionShipStyles.getFactionStyle(inv.attacker) : null;
        const accent = (st && st.accent) || '#ff4a3a';
        const emblem = typeof profileSelectionManager !== 'undefined' && profileSelectionManager.getFactionEmblemHtml
            ? profileSelectionManager.getFactionEmblemHtml(inv.attacker, 14) : '';
        const f = size / 2 + 12;
        return `<g class="gm-invasion" style="--fac:${accent}">` +
            `<title>${String(inv.attacker).toUpperCase()} INVASION · ${inv.ally ? 'DEFEND YOUR ' + String(inv.defender).toUpperCase() + ' ALLIES HERE' : 'WIN A STAGE HERE TO REPEL IT'}</title>` +
            `<rect class="gm-invasion-ring" x="${-f}" y="${-f}" width="${f * 2}" height="${f * 2}"/>` +
            `<rect class="gm-invasion-ring gm-invasion-ring-2" x="${-f - 6}" y="${-f - 6}" width="${f * 2 + 12}" height="${f * 2 + 12}"/>` +
            this.planetBattleSvg(planetId) +
            `<text class="gm-invasion-label gm-vec-text" x="0" y="${f + 14}">UNDER ATTACK</text>` +
            `<g class="gm-stage-anchor gm-px-only" data-r="${f + 14}" transform="translate(0,${f + 14})">${this.pixelTextGroup('UNDER ATTACK', 0, 0, 'middle')}</g>` +
            `<foreignObject x="${f - 10}" y="${-f - 10}" width="20" height="20">` +
            `<div xmlns="http://www.w3.org/1999/xhtml" class="gm-invasion-emblem" data-fac="${inv.attacker}">${emblem}</div></foreignObject>` +
            `</g>`;
    },
    /**
     * Fighting on an invaded planet: small pixel explosions where the factions
     * clash, in planet-pixel cells so they match the planet art's coarseness.
     */
    planetBattleSvg(planetId) {
        const k = this.getMapObjectScale();
        const cell = (this.planetPixelSize ? this.planetPixelSize(planetId) : 2) * k;
        const r = this.planetSurfaceRadius(planetId) * k;
        // Stable spots per planet (seeded), inside the disc.
        let seed = 0;
        for (const ch of String(planetId)) seed = (Math.imul(seed, 31) + ch.charCodeAt(0)) >>> 0;
        const rnd = () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) >>> 8) / 16777216;
        // Single planet pixels that flare up and fade out, one at a time.
        let out = '<g class="gm-battle" shape-rendering="crispEdges">';
        for (let i = 0; i < 14; i++) {
            const a = rnd() * Math.PI * 2;
            const d = Math.sqrt(rnd()) * (r - cell * 1.5);
            const x = Math.floor(Math.cos(a) * d / cell) * cell;
            const y = Math.floor(Math.sin(a) * d / cell) * cell;
            const delay = (rnd() * 3.2).toFixed(2);
            out += `<rect class="gm-battle-px" x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${cell.toFixed(2)}" height="${cell.toFixed(2)}" style="--bd:${delay}s"/>`;
        }
        return out + '</g>';
    },
    /** Emblems of the factions fighting on a planet, in a row above it. */
    planetFactionsSvg(planetId, size) {
        if (typeof planetConfigManager === 'undefined' || !planetConfigManager.getPlanetFactions) return '';
        // Factions are only known on reachable planets.
        if (this.isUnlocked && !this.isUnlocked(planetId)) return '';
        // Liberated planet: the player's own emblem flies over it again.
        const own = this.isCleared && this.isCleared(planetId) && planetConfigManager.getPlayerFaction
            ? planetConfigManager.getPlayerFaction() : null;
        // Otherwise only the factions attacking the player here (never the own side).
        const factions = own ? [own] : planetConfigManager.getHostileFactions
            ? planetConfigManager.getHostileFactions(planetId)
            : planetConfigManager.getPlanetFactions(planetId);
        if (!factions.length) return '';
        const visibleFactions = factions.slice(0, 1);
        if (typeof profileSelectionManager === 'undefined' || !profileSelectionManager.getFactionEmblemHtml) return '';
        // Bare faction icons — no boxes around them.
        const names = visibleFactions.map((f) =>
            `<span class="gm-node-faction-icon" title="${String(f).toUpperCase()}">${profileSelectionManager.getFactionEmblemHtml(f, 16, (uiAppearanceManager.getGlobalPixelPx && uiAppearanceManager.getGlobalPixelPx() > 0) ? 1 : this.getMapDetail())}</span>`
        ).join('');
        const w = 80;
        const h = 18;
        // Shrinks with the planet when zoomed in (same object scale).
        const k = this.getMapObjectScale();
        // Anchored on the visible disc edge (the icon box has empty margin).
        const top = this.planetSurfaceRadius(planetId) * k;
        return `<g transform="translate(0,${-top}) scale(${k.toFixed(4)})">` +
            `<foreignObject x="${-w / 2}" y="${-h - 4}" width="${w}" height="${h}">` +
            `<div xmlns="http://www.w3.org/1999/xhtml" class="gm-node-factions">${names}</div></foreignObject></g>`;
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
        // Global Pixel Size: thin with lattice (GM_PIXEL_U0 / uL) so baked width
        // stays ~N screen cells as zoom changes — returning 1 froze map-unit
        // thickness and made routes chunky when zoomed in.
        const gp = (typeof uiAppearanceManager !== 'undefined' && uiAppearanceManager.getGlobalPixelPx)
            ? uiAppearanceManager.getGlobalPixelPx() : 0;
        if (gp > 0) {
            const uL = this.mapPxLatticeUnit ? this.mapPxLatticeUnit() : 0;
            if (uL > 0) {
                const raw = Math.max(1, Math.min(12, GM_PIXEL_U0 / uL));
                return Math.pow(2, Math.round(Math.log2(raw) * 4) / 4);
            }
            return 1;
        }
        const z = (typeof this.mapZoom === 'number' && Number.isFinite(this.mapZoom)) ? this.mapZoom : 1;
        return Math.pow(2, Math.round(Math.log2(Math.max(1, Math.min(12, z))) * 4) / 4);
    },
    /** Stage counter size: big when zoomed out (readable), settling down as you zoom in. */
    stageTextScale() {
        // Global Pixel Size: local glyph cell (F=1) == one vfMapPx / lattice cell.
        if (this.mapPxLatticeUnit) {
            const u = this.mapPxLatticeUnit();
            if (u > 0) return u;
        }
        const gpS = (typeof uiAppearanceManager !== 'undefined' && uiAppearanceManager.getGlobalPixelPx)
            ? uiAppearanceManager.getGlobalPixelPx() : 0;
        if (gpS > 0) {
            const live = (this.mapScreenScale && this.mapScreenScale()) || this._pxScreenScale || 0;
            if (live > 0) return gpS / live;
            return GM_PIXEL_U0;
        }
        const z = (typeof this.mapZoom === 'number' && Number.isFinite(this.mapZoom)) ? Math.max(1, this.mapZoom) : 1;
        return 1 + 1.5 / z;
    },
    /** Screen px per map unit right now (zoom included), read from the live SVG; 0 if unavailable. */
    mapScreenScale() {
        const svgEl = document.querySelector('.galaxy-map-svg');
        if (!svgEl || !svgEl.clientWidth) return 0;
        let live = 0;
        // Exact px per user unit (viewBox + preserveAspectRatio letterboxing included).
        try {
            const m = svgEl.getScreenCTM();
            if (m && m.a > 0) live = m.a;
        } catch (e) { /* fall back below */ }
        if (!(live > 0)) {
            const vb = svgEl.viewBox && svgEl.viewBox.baseVal;
            live = vb && vb.width > 0 && vb.height > 0
                ? Math.min(svgEl.clientWidth / vb.width, svgEl.clientHeight / vb.height) : 0;
        }
        // Cache for mapPixelUnitGlobal during bake (before CTM is ready on remount).
        if (live > 0) this._pxScreenScale = live;
        return live;
    },
    /** Map units per Global Pixel cell (same cell CSS size as vfMapPx). */
    mapPxLatticeUnit() {
        if (typeof uiAppearanceManager === 'undefined' || !uiAppearanceManager.getGlobalPixelPx
            || !(uiAppearanceManager.getGlobalPixelPx() > 0)) return 0;
        const live = this.mapScreenScale() || this._pxScreenScale || 0;
        if (!(live > 0)) return 0;
        const cellCss = uiAppearanceManager.getMapPxCellCss
            ? uiAppearanceManager.getMapPxCellCss()
            : uiAppearanceManager.getGlobalPixelPx();
        return cellCss > 0 ? cellCss / live : 0;
    },
    /**
     * Snap a map point onto the Global Pixel Size lattice (same grid as vfMapPx).
     */
    latticeMapPt(x, y) {
        const u = this.mapPxLatticeUnit();
        if (!(u > 0)) return { x: x, y: y };
        return { x: Math.round(x / u) * u, y: Math.round(y / u) * u };
    },
    /** Ship centre on the same lattice as planets (no half-cell offset — that broke the grid). */
    latticeShipPt(x, y) {
        return this.latticeMapPt(x, y);
    },
    /**
     * Global Pixel Size: faction crests are 16x16 sprites, shown with one sprite pixel per grid cell
     * (16 cells wide) so they stay recognisable; reset to the normal sizes when the setting is off.
     */
    snapMapEmblems() {
        const svg = document.querySelector('.galaxy-map-svg');
        if (!svg) return;
        const gp = (typeof uiAppearanceManager !== 'undefined' && uiAppearanceManager.getGlobalPixelPx) ? uiAppearanceManager.getGlobalPixelPx() : 0;
        const live = gp > 0 ? this.mapScreenScale() : 0;
        const on = gp > 0 && live > 0;
        // Cells across the sprite: 16 at normal size, fewer when zoomed out so the crest shrinks with its planet.
        const cellsFor = (origMapSize) => {
            const o = origMapSize * live / gp;
            return o >= 12 ? 16 : o >= 6 ? 8 : 4;
        };
        const D = on ? cellsFor(16) * gp / live : 0;
        const psm = typeof profileSelectionManager !== 'undefined' ? profileSelectionManager : null;
        svg.querySelectorAll('.gm-node-faction-icon').forEach((el) => {
            el.style.width = on ? D + 'px' : '';
            el.style.height = on ? D + 'px' : '';
            const im = el.querySelector('img');
            if (im) { im.style.width = on ? D + 'px' : ''; im.style.height = on ? D + 'px' : ''; }
        });
        svg.querySelectorAll('.gm-invasion-emblem').forEach((el) => {
            const fo = el.closest('foreignObject');
            if (!fo) return;
            if (el.dataset.orig == null) {
                el.dataset.orig = el.innerHTML;
                el.dataset.fo = [fo.getAttribute('x'), fo.getAttribute('y'), fo.getAttribute('width'), fo.getAttribute('height')].join(',');
            }
            const o = el.dataset.fo.split(',').map(Number);
            if (on && psm && psm.getFactionEmblemHtml && el.dataset.fac) {
                if (el.dataset.px !== '1') { el.innerHTML = psm.getFactionEmblemHtml(el.dataset.fac, 16, 1); el.dataset.px = '1'; }
                const Di = cellsFor(Math.max(1, o[2] - 8)) * gp / live;
                const B = Di + 8, cx = o[0] + o[2] / 2, cy = o[1] + o[3] / 2;
                fo.setAttribute('x', cx - B / 2); fo.setAttribute('y', cy - B / 2);
                fo.setAttribute('width', B); fo.setAttribute('height', B);
                el.style.width = B + 'px'; el.style.height = B + 'px';
                const im = el.querySelector('img');
                if (im) { im.style.width = Di + 'px'; im.style.height = Di + 'px'; }
            } else if (el.dataset.px === '1') {
                el.innerHTML = el.dataset.orig; el.dataset.px = '';
                ['x', 'y', 'width', 'height'].forEach((a, i) => fo.setAttribute(a, o[i]));
                el.style.width = ''; el.style.height = '';
            }
        });
    },
    /** Lattice geometry of a planet icon: cell size u (map units) and the node centre / icon box size. */
    planetLatticeGeo(iconEl, size, live) {
        // Screen filter (gp≥2) or quantized bitmap (gp=1) owns pixel size — keep icon box from layout.
        return null;
    },
    /** Global Pixel Size: snap every planet image on the map to the global pixel grid. */
    snapMapPlanets() {
        const svg = document.querySelector('.galaxy-map-svg');
        const gp0 = (typeof uiAppearanceManager !== 'undefined' && uiAppearanceManager.getGlobalPixelPx) ? uiAppearanceManager.getGlobalPixelPx() : 0;
        this.snapMapEmblems();
        if (gp0 > 0 && uiAppearanceManager.ensureMapPxFilter) {
            const area = (svg && svg.closest && svg.closest('#gmMapArea')) || document.getElementById('gmMapArea') || svg;
            uiAppearanceManager.ensureMapPxFilter(gp0, area);
        }
        if (svg) {
            svg.querySelectorAll('.gm-px-txt').forEach((g) => {
                g.innerHTML = this.pixelTextSvg(g.dataset.s, +g.dataset.x, +g.dataset.y, g.dataset.a);
            });
            const kS = (this.getMapObjectScale() * this.stageTextScale()).toFixed(4);
            svg.querySelectorAll('.gm-stage-anchor').forEach((g) => g.setAttribute('transform', `translate(0,${g.getAttribute('data-r')}) scale(${kS})`));
        }
        const live = this.mapScreenScale();
        if (!svg || !(live > 0) || typeof planetSVGManager === 'undefined' || !planetSVGManager.snapPixelImg) return;
        svg.querySelectorAll('.gm-planet-icon-img').forEach((el) => {
            const im = el.querySelector('img.gm-planet-img');
            if (!im) return;
            const raw = im._rawUrl || im.getAttribute('src');
            const px = Number(el.getAttribute('data-planet-px')) || 0;
            const w = px * (im._frameK || 1.6);
            // gp>0: null geo → quantize bitmap only, keep CSS size from planetIconHtml.
            if (raw && px > 0) planetSVGManager.snapPixelImg(im, raw, w * live, gp0 > 0 ? null : { live: live, size: px });
        });
    },
    /** Scale bucket for art re-bake. Always 0: zoom-driven re-bake coarsened GP pixels on zoom-out. */
    getMapScaleKey() {
        return 0;
    },
    /** Mild zoom-only curve when Global Pixel Size is off (cap 4 = art budget). */
    _zoomDetailCurve(z) {
        const zc = Math.max(0.35, Math.min(12, Number(z) || 1));
        // Gentler than before (was *2.2 → detail 8): 1→2→3→4 without hammering spin.
        return Math.max(1, Math.min(4, 1 + Math.log2(Math.max(1, zc)) * 1.35));
    },
    /** Continuous map detail (no rounding) — drives --gm-px every zoom frame. */
    getMapDetailFloat() {
        const z = (typeof this.mapZoom === 'number' && Number.isFinite(this.mapZoom)) ? this.mapZoom : 1;
        const zoomCurve = this._zoomDetailCurve(z);
        const gp = (typeof uiAppearanceManager !== 'undefined' && uiAppearanceManager.getGlobalPixelPx)
            ? uiAppearanceManager.getGlobalPixelPx() : 0;
        if (gp > 0) {
            // Ratchet: refine when zooming in, never coarsen on zoom-out (pixels stay gp-sized).
            // gp 1/2 hit detail 4 almost immediately (GM_PIXEL_U0·s/gp) and rebuilt stars/lines/
            // planet icons into stutter — keep the art budget lower there.
            const detailCap = gp <= 1 ? 2 : (gp <= 2 ? 3 : 4);
            try {
                const s = this.mapScreenScale() || this._pxScreenScale || 0;
                if (s > 0) {
                    const need = Math.max(1, Math.min(detailCap, GM_PIXEL_U0 * s / gp));
                    this._pxDetailPeak = Math.max(this._pxDetailPeak || 1, need);
                    return this._pxDetailPeak;
                }
            } catch (e) { /* fall through */ }
            return this._pxDetailPeak || Math.min(2, detailCap);
        }
        return zoomCurve;
    },
    getMapDetail() {
        // Integer detail for art rebuilds; CSS pixel size uses getMapDetailFloat.
        return Math.max(1, Math.min(4, Math.round(this.getMapDetailFloat())));
    },
    /** Reset GP detail ratchet when Pixel Size changes. */
    resetPixelSizeDetailPeak() {
        this._pxDetailPeak = 0;
        this._pxDetailFloatKey = null;
        this._pxDetailFloat = null;
        this._mapArtDetail = -1;
        this._mapArtSKey = null;
    },
    /**
     * Keep map objects visually proportional while the camera zooms.
     * Without this compensation, planets and stations grow linearly with the
     * viewBox and become oversized pixel blocks before their finer art loads.
     */
    /** Object scale the planet nodes were last rendered with (lines match it). */
    nodeObjScale() {
        return this._nodeObjScale || this.getMapObjectScale();
    },
    getMapObjectScale() {
        // Constant: objects are only baked once per full render, while zooming
        // later just scales the view. A zoom-dependent factor here made planets
        // come out smaller after a reload at high zoom than the same zoom reached
        // by scrolling.
        return 1;
    },
});
