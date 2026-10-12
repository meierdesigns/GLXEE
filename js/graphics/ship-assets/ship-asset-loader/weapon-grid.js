"use strict";

import { extendClass } from '../../../core/extend-class-module.js';

import { ShipAssetLoader } from './core.js';

extendClass(ShipAssetLoader, {
    /** 15-step module ramp from the ship's faction colours (14–15 = accent glow). */
    getWeaponShadeRamp(factionStyle, weaponId) {
        const toRgb = (h) => {
            const m = /^#?([0-9a-f]{6})$/i.exec(String(h || ''));
            if (!m) return null;
            const n = parseInt(m[1], 16);
            return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
        };
        const toHex = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
        const mix = (a, b, t) => [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * t);
        const hull = factionStyle && toRgb(factionStyle.hull);
        const edge = (factionStyle && toRgb(factionStyle.edge)) || (hull && mix(hull, [0, 0, 0], 0.6));
        const ramp = [null];
        const dark = hull ? mix(edge, [0, 0, 0], 0.45) : [36, 36, 36];
        const mid = hull ? mix(hull, [0, 0, 0], 0.28) : [120, 120, 120];
        const light = hull ? mix(hull, [255, 255, 255], 0.3) : [230, 230, 230];
        for (let i = 1; i <= 13; i++) {
            const t = (i - 1) / 12;
            ramp.push(toHex(t < 0.5 ? mix(dark, mid, t * 2) : mix(mid, light, (t - 0.5) * 2)));
        }
        // Glow in the ship's own accent colour, not the weapon's UI tint.
        const glow = (factionStyle && toRgb(factionStyle.accent)) || (hull && mix(hull, [255, 255, 255], 0.55)) || [255, 255, 255];
        ramp.push(toHex(glow));
        ramp.push(toHex(mix(glow, [255, 255, 255], 0.55)));
        return ramp;
    },

    /**
     * Gun art built at the target resolution (muzzle at row 0): mount plate,
     * receiver, then per-weapon barrels with cylinder shading. Shades 1–13
     * are housing, 14–15 glow in the weapon colour.
     */
    generateWeaponGrid(weaponId, cols, rows) {
        const key = String(weaponId || '') + '|' + cols + 'x' + rows;
        if (!this._weaponGridCache) this._weaponGridCache = new Map();
        const hit = this._weaponGridCache.get(key);
        if (hit) return hit;
        const W = cols;
        const H = rows;
        const g = Array.from({ length: H }, () => new Array(W).fill(0));
        const set = (r, c, v) => {
            r = Math.round(r); c = Math.round(c);
            if (r >= 0 && c >= 0 && r < H && c < W) g[r][c] = Math.max(1, Math.min(15, Math.round(v)));
        };
        // Cylinder shading across the width: lit left, dark right edge.
        const cyl = (c0, c1, r0, r1, base) => {
            c0 = Math.round(c0); c1 = Math.round(c1); r0 = Math.round(r0); r1 = Math.round(r1);
            const w = Math.max(1, c1 - c0);
            for (let r = r0; r < r1; r++) {
                for (let c = c0; c < c1; c++) {
                    const t = (c - c0 + 0.5) / w;
                    const d = w < 3 ? (t < 0.5 ? 2 : -1) : (t < 0.2 ? 1 : t < 0.45 ? 3 : t < 0.8 ? 0 : -3);
                    set(r, c, Math.min(13, base + d));
                }
            }
        };
        const fill = (c0, c1, r0, r1, v) => {
            for (let r = Math.round(r0); r < Math.round(r1); r++) {
                for (let c = Math.round(c0); c < Math.round(c1); c++) set(r, c, v);
            }
        };
        // Centred span of a width fraction, kept symmetric on the grid.
        const span = (f) => {
            let w = Math.max(1, Math.round(W * f));
            if ((W - w) % 2) w += (w < W ? 1 : -1);
            const c0 = (W - w) / 2;
            return [c0, c0 + w];
        };
        // Mirrored pair: centre offset `off` and width `f` (fractions of W).
        const pair = (off, f, fn) => {
            const w = Math.max(1, Math.round(W * f));
            const c0 = Math.max(0, Math.round(W / 2 - W * off - w / 2));
            fn(c0, c0 + w);
            fn(W - c0 - w, W - c0);
        };
        const baseTop = Math.round(H * 0.86);
        const recvTop = Math.round(H * 0.62);
        const barrelTop = (f) => Math.round(H * f);

        // Mount plate with bolts.
        let [b0, b1] = span(0.94);
        cyl(b0, b1, baseTop, H, 5);
        set(H - 2, b0 + 1, 2); set(H - 2, b1 - 2, 2);
        // Receiver block with a panel seam and a status light.
        [b0, b1] = span(0.66);
        cyl(b0, b1, recvTop, baseTop, 8);
        fill(b0, b1, recvTop + Math.round((baseTop - recvTop) / 2), recvTop + Math.round((baseTop - recvTop) / 2) + 1, 4);
        set(recvTop + 1, b0 + 1, 14);

        const id = String(weaponId || 'laser');
        const tip = (c0, c1, r, v) => fill(c0, c1, r, r + Math.max(1, Math.round(H * 0.04)), v || 15);
        switch (id) {
            case 'laser_twin':
                pair(0.17, 0.18, (c0, c1) => { cyl(c0, c1, barrelTop(0.04), recvTop, 9); tip(c0, c1, barrelTop(0.04), 14); });
                break;
            case 'railgun': {
                pair(0.2, 0.14, (c0, c1) => cyl(c0, c1, 0, recvTop, 9));
                const [g0, g1] = span(0.14);
                for (let r = barrelTop(0.06); r < recvTop; r += 2) fill(g0, g1, r, r + 1, 14);
                const [x0, x1] = span(0.6);
                for (let r = barrelTop(0.2); r < recvTop; r += Math.max(3, Math.round(H * 0.12))) cyl(x0, x1, r, r + 1, 6);
                break;
            }
            case 'spread': {
                const [c0, c1] = span(0.2);
                cyl(c0, c1, barrelTop(0.08), recvTop, 9);
                tip(c0, c1, barrelTop(0.08));
                const top = barrelTop(0.2);
                const w = Math.max(1, Math.round(W * 0.14));
                for (let r = top; r < recvTop; r++) {
                    const k = (recvTop - r) / Math.max(1, recvTop - top);
                    const off = Math.round(W * (0.14 + k * 0.28));
                    const l0 = Math.round(W / 2 - off - w / 2);
                    cyl(l0, l0 + w, r, r + 1, 8);
                    cyl(W - l0 - w, W - l0, r, r + 1, 8);
                    if (r === top) { fill(l0, l0 + w, r, r + 1, 15); fill(W - l0 - w, W - l0, r, r + 1, 15); }
                }
                break;
            }
            case 'rapid': {
                [0.07, 0.21].forEach((off) => pair(off, 0.1, (c0, c1) => { cyl(c0, c1, barrelTop(0.05), recvTop, 9); tip(c0, c1, barrelTop(0.05), 14); }));
                const [r0, r1] = span(0.62);
                [0.22, 0.42].forEach((f) => cyl(r0, r1, barrelTop(f), barrelTop(f) + Math.max(1, Math.round(H * 0.05)), 6));
                break;
            }
            case 'burst':
                pair(0.17, 0.26, (c0, c1) => {
                    cyl(c0, c1, barrelTop(0.2), recvTop, 8);
                    cyl(c0 - 1, c1 + 1, barrelTop(0.14), barrelTop(0.2), 10);
                    tip(c0, c1, barrelTop(0.14), 14);
                });
                break;
            case 'plasma': {
                const [c0, c1] = span(0.32);
                cyl(c0, c1, barrelTop(0.22), recvTop, 8);
                for (let r = barrelTop(0.3); r < recvTop - 1; r += 3) fill(c0 + 1, c1 - 1, r, r + 1, 14);
                const [m0, m1] = span(0.46);
                cyl(m0, m1, barrelTop(0.16), barrelTop(0.22), 10);
                fill(c0 + 1, c1 - 1, barrelTop(0.16), barrelTop(0.2), 15);
                // Glowing orb chamber in the receiver.
                const cy = recvTop + (baseTop - recvTop) * 0.35;
                const rad = Math.max(1.2, W * 0.16);
                for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
                    const d = Math.hypot(c + 0.5 - W / 2, r + 0.5 - cy);
                    if (d < rad) set(r, c, d < rad * 0.5 ? 15 : 14);
                }
                break;
            }
            case 'claw_beam': {
                const top = barrelTop(0.06);
                const w = Math.max(1, Math.round(W * 0.14));
                for (let r = top; r < recvTop; r++) {
                    const k = (r - top) / Math.max(1, recvTop - top);
                    const off = Math.round(W * (0.3 - Math.sin(k * Math.PI) * 0.1 - (1 - k) * 0.12));
                    const l0 = Math.round(W / 2 - off - w / 2);
                    cyl(l0, l0 + w, r, r + 1, 9);
                    cyl(W - l0 - w, W - l0, r, r + 1, 9);
                }
                const [g0, g1] = span(0.08);
                fill(g0, g1, barrelTop(0.12), recvTop, 14);
                fill(g0, g1, barrelTop(0.12), barrelTop(0.16), 15);
                break;
            }
            case 'spike_burst':
                [[0, 0.16, 0.02], [0.18, 0.12, 0.18], [0.34, 0.1, 0.34]].forEach(([off, f, t]) => {
                    const fn = (c0, c1) => { cyl(c0, c1, barrelTop(t), recvTop, 9); tip(c0, c1, barrelTop(t), 15); };
                    if (off === 0) { const [c0, c1] = span(f); fn(c0, c1); } else pair(off, f, fn);
                });
                break;
            case 'ion': {
                const [c0, c1] = span(0.2);
                cyl(c0, c1, barrelTop(0.04), recvTop, 9);
                tip(c0, c1, barrelTop(0.04));
                const [r0, r1] = span(0.5);
                for (let r = barrelTop(0.14); r < recvTop - 1; r += Math.max(3, Math.round(H * 0.09))) fill(r0, r1, r, r + 1, 14);
                break;
            }
            case 'wave': {
                const [c0, c1] = span(0.2);
                cyl(c0, c1, barrelTop(0.2), recvTop, 9);
                const top = barrelTop(0.02);
                const flare = barrelTop(0.22);
                for (let r = top; r < flare; r++) {
                    const k = 1 - (r - top) / Math.max(1, flare - top);
                    const [d0, d1] = span(0.2 + k * 0.72);
                    cyl(d0, d1, r, r + 1, 8);
                    if (d1 - d0 > 4) fill(d0 + 2, d1 - 2, r, r + 1, k > 0.6 ? 15 : 14);
                }
                break;
            }
            case 'nova': {
                const [c0, c1] = span(0.22);
                cyl(c0, c1, barrelTop(0.18), recvTop, 9);
                const cy = barrelTop(0.1);
                const arm = Math.max(2, Math.round(W * 0.3));
                const [s0, s1] = span(0.1);
                fill(s0, s1, cy - arm * 0.7, cy + arm * 0.7, 15);
                fill(W / 2 - arm, W / 2 + arm, cy - 0.5, cy + 0.5, 14);
                for (let i = -arm * 0.6; i <= arm * 0.6; i++) { set(cy + i, W / 2 + i, 14); set(cy + i, W / 2 - 1 - i, 14); }
                break;
            }
            case 'missile': {
                const [p0, p1] = span(0.84);
                cyl(p0, p1, barrelTop(0.12), recvTop, 7);
                const tubes = W >= 10 ? 3 : 2;
                const tw = (p1 - p0) / tubes;
                for (let i = 0; i < tubes; i++) {
                    const t0 = Math.round(p0 + i * tw + 1);
                    const t1 = Math.max(t0 + 1, Math.round(p0 + (i + 1) * tw - 1));
                    fill(t0, t1, barrelTop(0.12), barrelTop(0.12) + 1, 2);
                    fill(t0, t1, barrelTop(0.06), barrelTop(0.12), 14);
                    set(barrelTop(0.04), (t0 + t1 - 1) / 2, 15);
                    fill(t0, t1, barrelTop(0.3), barrelTop(0.3) + 1, 4);
                }
                break;
            }
            case 'pierce': {
                const [c0, c1] = span(0.12);
                cyl(c0, c1, 0, recvTop, 10);
                fill(c0, c1, 0, barrelTop(0.06), 15);
                const [k0, k1] = span(0.44);
                cyl(k0, k1, barrelTop(0.4), barrelTop(0.46), 7);
                cyl(span(0.3)[0], span(0.3)[1], barrelTop(0.2), barrelTop(0.24), 7);
                break;
            }
            default: {
                // laser: one long emitter with cooling fins and a lens tip.
                const [c0, c1] = span(0.24);
                cyl(c0, c1, barrelTop(0.04), recvTop, 9);
                tip(c0, c1, barrelTop(0.04));
                const [f0, f1] = span(0.44);
                for (let r = barrelTop(0.3); r < recvTop - 1; r += Math.max(3, Math.round(H * 0.08))) cyl(f0, f1, r, r + 1, 6);
            }
        }
        this._weaponGridCache.set(key, g);
        return g;
    },

    drawDetailedWeaponModule(ctx, x, y, width, height, weaponId, factionStyle, colorOverlay, intensity, shadeBias, mirror, face, visualId = null) {
        // Larger than the mount frame, seated on its base so the receiver
        // stays on the hull and the barrel reaches forward.
        const k = this.WEAPON_DRAW_SCALE[face === 'left' || face === 'right' ? 'wing' : 'body'];
        const w2 = width * k.x;
        const h2 = height * k.y;
        const x2 = x - (w2 - width) / 2;
        const y2 = y + height - h2;
        // Same ship-wide voxel as the hull (follows the VOXEL SIZE setting).
        const cell = this.hullPartResolution(w2, h2).cell;
        let cols = Math.max(4, Math.round(w2 / cell));
        // Keep the gun horizontally centred on its slot: the grid origin snaps
        // to the ship's voxel lattice, so pick the column parity that puts the
        // grid's centre line on the slot's centre line.
        const anchor = this._shipVoxelAnchor;
        if (anchor && anchor.x != null) {
            const t = (x + width / 2 - anchor.x) / cell;
            const frac = t - Math.floor(t);
            const wantOdd = frac > 0.25 && frac < 0.75;
            if ((cols % 2 === 1) !== wantOdd) cols += 1;
        }
        const rows = Math.max(8, Math.round(h2 / cell));
        const template = this.generateWeaponGrid(weaponId, cols, rows);
        const ramp = this.getWeaponShadeRamp(factionStyle, weaponId);
        const skin = visualId ? this.getNamedModuleTemplate(visualId) : null;
        const colors = [null];
        const colorIndex = new Map();
        const grid = [];
        for (let row = 0; row < rows; row++) {
            const line = new Array(cols).fill(0);
            for (let col = 0; col < cols; col++) {
                let idx = template[row][col];
                if (!idx) continue;
                if (skin && idx < 14) {
                    const pv = skin[Math.min(7, Math.floor((row * 8) / rows))][Math.min(7, Math.floor((col * 8) / cols))] || 0;
                    idx = Math.max(1, Math.min(13, Math.round(idx * 0.6 + pv * 0.4)));
                }
                let color = ramp[idx];
                if (!color) continue;
                // Whole gun takes the ship's hull tint, like every other part.
                color = this.applyHullOverlayHex(color, colorOverlay, intensity, shadeBias);
                if (!colorIndex.has(color)) {
                    colorIndex.set(color, colors.length);
                    colors.push(color);
                }
                line[mirror ? cols - 1 - col : col] = colorIndex.get(color);
            }
            grid.push(line);
        }
        // Dark contour so the gun reads against the hull.
        const outlineHex = (factionStyle && factionStyle.edge) ? this.shiftModuleHex(factionStyle.edge, -0.7) : '#151515';
        colors.push(outlineHex);
        const o = colors.length - 1;
        const filled = (r, c) => r >= 0 && c >= 0 && r < rows && c < cols && grid[r][c] && grid[r][c] !== o;
        const edgeCells = [];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (grid[r][c]) continue;
                if (filled(r - 1, c) || filled(r + 1, c) || filled(r, c - 1) || filled(r, c + 1)) edgeCells.push([r, c]);
            }
        }
        edgeCells.forEach(([r, c]) => { grid[r][c] = o; });
        ctx.imageSmoothingEnabled = false;
        this.drawPixelGridHull(ctx, grid, colors, x2, y2, w2, h2, cell);
    },

    drawMappedImage(ctx, image, bounds, x, y, width, height) {
        const targetW = Math.max(1, Math.round(width));
        const targetH = Math.max(1, Math.round(height));
        for (let row = 0; row < targetH; row++) {
            const sy = bounds.y + Math.min(
                bounds.h - 1,
                Math.floor(row * bounds.h / targetH)
            );
            for (let col = 0; col < targetW; col++) {
                const sx = bounds.x + Math.min(
                    bounds.w - 1,
                    Math.floor(col * bounds.w / targetW)
                );
                ctx.drawImage(image, sx, sy, 1, 1, x + col, y + row, 1, 1);
            }
        }
    },

    getOpaqueSpriteBounds(image) {
        if (!image || !image.width || !image.height) return null;
        const cached = this._spriteBounds.get(image);
        if (cached) return cached;
        try {
            const canvas = document.createElement('canvas');
            canvas.width = image.width;
            canvas.height = image.height;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(image, 0, 0);
            const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
            let minX = canvas.width;
            let minY = canvas.height;
            let maxX = -1;
            let maxY = -1;
            for (let y = 0; y < canvas.height; y++) {
                for (let x = 0; x < canvas.width; x++) {
                    if (data[(y * canvas.width + x) * 4 + 3] < 16) continue;
                    minX = Math.min(minX, x);
                    minY = Math.min(minY, y);
                    maxX = Math.max(maxX, x);
                    maxY = Math.max(maxY, y);
                }
            }
            const bounds = maxX < 0
                ? null
                : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
            this._spriteBounds.set(image, bounds);
            return bounds;
        } catch (e) {
            return null;
        }
    },

    // Check if ship is an enemy ship
    isEnemyShip(shipModel) {
        if (!shipModel) return false;
        if (shipModel.forceEnemyOrientation) return true;

        // Check by sprite name patterns
        const spriteName = this.getSpriteNameForShip(shipModel);
        if (spriteName) {
            return spriteName.includes('enemy-') || spriteName.includes('enemy_');
        }

        // Check by ship type/name patterns
        const shipName = shipModel.name ? shipModel.name.toLowerCase() : '';
        return shipName.includes('enemy') || shipName.includes('fighter') ||
               shipName.includes('battleship') || shipName.includes('cruiser') ||
               shipName.includes('interceptor') || shipName.includes('scout') ||
               shipName.includes('destroyer') || shipName.includes('carrier') ||
               shipName.includes('frigate') || shipName.includes('corvette') ||
               shipName.includes('gunship') || shipName.includes('dreadnought') ||
               shipName.includes('bomber') || shipName.includes('stealth');
    },
});
