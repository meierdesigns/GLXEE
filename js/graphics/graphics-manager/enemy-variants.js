"use strict";

// Enemy ship variants: every faction ship gets a seeded livery (colour shift +
// paint pattern) so a wave doesn't look like one ship copied N times.
// Renegades (contract targets, outlaw gangs) get their own markings: a dark,
// washed-out hull, a red hazard slash, a crossed-out faction badge and a
// blinking beacon. Each variant is rendered once into a small canvas and
// reused every frame.

const ENEMY_LIVERIES = ['plain', 'spine', 'twin', 'nose', 'tips', 'band', 'chevron', 'split'];
const ENEMY_VARIANT_CACHE_MAX = 400;
const ENEMY_AREAS = ['back', 'wings', 'nose', 'center'];

extendClass(GraphicsManager, {
    /** Stable per-ship variant: { seed, livery, hue, light, sat }. */
    getEnemyVariant(enemy) {
        if (enemy._variant) return enemy._variant;
        let seed = enemy.variantSeed;
        if (seed == null) seed = enemy.variantSeed = (Math.random() * 0xffffffff) >>> 0;
        const r = (n) => ((seed >>> n) & 255) / 255;
        // Champions always carry a paint job; escorts are sometimes plain.
        const liv = ENEMY_LIVERIES[(seed % (ENEMY_LIVERIES.length - (enemy.champion ? 1 : 0))) + (enemy.champion ? 1 : 0)];
        enemy._variant = {
            seed: seed,
            livery: liv,
            // Small hue / brightness / saturation drift keeps the faction readable.
            hue: Math.round((r(3) - 0.5) * 36),
            light: 0.86 + r(11) * 0.28,
            sat: 0.8 + r(19) * 0.45,
            paint: r(7) < 0.5 ? 'accent' : (r(7) < 0.8 ? 'light' : 'dark'),
            // Per-area styles (nose / back / wings / center): each hull area
            // gets its own colour shift so the sections read as separate parts.
            areas: ENEMY_AREAS.map((a, i) => {
                const h = Math.imul(seed ^ (0x9e3779b9 * (i + 1)), 0x85ebca6b) >>> 0;
                const q = (n) => ((h >>> n) & 255) / 255;
                return {
                    id: a,
                    hue: Math.round((q(0) - 0.5) * 120),
                    light: 0.7 + q(8) * 0.55,
                    sat: 0.7 + q(16) * 0.7
                };
            })
        };
        return enemy._variant;
    },

    /**
     * Draw a faction ship through the variant cache. Returns false when the
     * ship can't be baked (no loader), so the caller falls back.
     */
    drawEnemyVariant(ctx, enemy, model, x, y, scale) {
        if (!this.shipAssetLoader || !this.shipAssetLoader.isLoaded()) return false;
        if (typeof document === 'undefined') return false;
        const v = this.getEnemyVariant(enemy);
        const w = Math.max(1, Math.ceil((model.width || enemy.width) * scale));
        const h = Math.max(1, Math.ceil((model.height || enemy.height) * scale));
        const key = (model.factionSpriteKey || model.name) + '|' + w + 'x' + h + '|' + v.livery + '|' + v.hue + '|' +
            v.light.toFixed(2) + '|' + v.sat.toFixed(2) + '|' + v.paint + '|' + v.seed + '|' + (enemy.renegade ? 'R' + (enemy.renegadeColor || '') : '');
        if (!this._variantCache) this._variantCache = new Map();
        let img = this._variantCache.get(key);
        if (!img) {
            img = this.bakeEnemyVariant(model, w, h, scale, v, enemy);
            if (this._variantCache.size > ENEMY_VARIANT_CACHE_MAX) this._variantCache.clear();
            this._variantCache.set(key, img);
        }
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, Math.round(x), Math.round(y));
        ctx.restore();
        return true;
    },

    bakeEnemyVariant(model, w, h, scale, v, enemy) {
        const base = document.createElement('canvas');
        base.width = w;
        base.height = h;
        const bctx = base.getContext('2d');
        bctx.imageSmoothingEnabled = false;
        this.shipAssetLoader.renderShip(bctx, model, 0, 0, scale, null, 0);

        const out = document.createElement('canvas');
        out.width = w;
        out.height = h;
        const o = out.getContext('2d');
        o.imageSmoothingEnabled = false;
        o.filter = enemy.renegade
            // Renegade: stripped of faction colours, dark and grimy.
            ? 'grayscale(0.7) brightness(0.62) contrast(1.25)'
            : `hue-rotate(${v.hue}deg) brightness(${v.light.toFixed(2)}) saturate(${v.sat.toFixed(2)})`;
        o.drawImage(base, 0, 0);
        if (!enemy.renegade) this.paintAreaStyles(o, base, w, h, v);
        o.filter = 'none';

        // Paint only on hull pixels.
        o.globalCompositeOperation = 'source-atop';
        const colors = model.colors || [];
        const accent = colors[3] || '#c8d0d8';
        const edge = colors[1] || '#202020';
        const paint = enemy.renegade ? (enemy.renegadeColor || '#ff3a2a')
            : (v.paint === 'accent' ? accent : (v.paint === 'light' ? '#e8e4d8' : edge));
        o.fillStyle = paint;
        o.globalAlpha = enemy.renegade ? 0.9 : 0.75;
        const px = Math.max(1, Math.round(Math.min(w, h) / 14));
        const cx = Math.floor(w / 2);
        if (enemy.renegade) {
            this.paintRenegadeMarks(o, w, h, px, v.seed);
        } else {
            this.paintLivery(o, v.livery, w, h, px, cx);
        }
        o.globalAlpha = 1;
        o.globalCompositeOperation = 'source-over';
        return out;
    },

    /** Redraw each hull area with its own hue / brightness shift. */
    paintAreaStyles(o, base, w, h, v) {
        const rects = {
            back:   [0, 0, w, Math.round(h * 0.26)],
            wings:  null, // outer thirds, drawn as two rects
            nose:   [0, Math.round(h * 0.7), w, h],
            center: [Math.round(w * 0.36), Math.round(h * 0.26), Math.round(w * 0.28), Math.round(h * 0.44)]
        };
        const wingW = Math.round(w * 0.3);
        v.areas.forEach((a) => {
            const list = a.id === 'wings'
                ? [[0, Math.round(h * 0.2), wingW, Math.round(h * 0.6)], [w - wingW, Math.round(h * 0.2), wingW, Math.round(h * 0.6)]]
                : [rects[a.id]];
            o.filter = `hue-rotate(${v.hue + a.hue}deg) brightness(${(v.light * a.light).toFixed(2)}) saturate(${(v.sat * a.sat).toFixed(2)})`;
            list.forEach(([x, y, rw, rh]) => {
                if (rw <= 0 || rh <= 0) return;
                o.clearRect(x, y, rw, rh);
                o.drawImage(base, x, y, rw, rh, x, y, rw, rh);
            });
        });
    },

    paintLivery(o, livery, w, h, px, cx) {
        switch (livery) {
            case 'spine':   // one stripe down the centre
                o.fillRect(cx - px, 0, px * 2, h);
                break;
            case 'twin':    // two racing stripes
                o.fillRect(cx - px * 3, 0, px, h);
                o.fillRect(cx + px * 2, 0, px, h);
                break;
            case 'nose':    // painted nose (enemies face down: nose at the bottom)
                o.fillRect(0, Math.round(h * 0.72), w, h);
                break;
            case 'tips':    // painted wing tips
                o.fillRect(0, 0, Math.round(w * 0.2), h);
                o.fillRect(w - Math.round(w * 0.2), 0, w, h);
                break;
            case 'band':    // cross band over the wings
                o.fillRect(0, Math.round(h * 0.4), w, px * 2);
                break;
            case 'chevron': // stepped V pointing at the nose
                for (let i = 0; i < Math.ceil(w / 2 / px); i++) {
                    const yy = Math.round(h * 0.3) + i * px;
                    o.fillRect(cx - (i + 1) * px, h - yy - px, px, px);
                    o.fillRect(cx + i * px, h - yy - px, px, px);
                }
                break;
            case 'split':   // one half painted (asymmetric)
                o.globalAlpha *= 0.55;
                o.fillRect(0, 0, cx, h);
                break;
            default:
                break;
        }
    },

    /** Hazard slash, crossed-out badge and scorch marks. */
    paintRenegadeMarks(o, w, h, px, seed) {
        // Diagonal hazard slash across the hull.
        const step = px;
        const red = o.fillStyle;
        for (let i = 0; i < w; i += step) {
            const yy = Math.round(i * h / w);
            o.fillStyle = Math.floor(i / (step * 2)) % 2 === 0 ? red : '#05060a';
            o.fillRect(i, yy, step, step * 2);
        }
        // Crossed-out faction badge at the centre: an X.
        const cx = Math.floor(w / 2), cy = Math.floor(h * 0.45);
        const r = Math.max(2, px * 2);
        o.fillStyle = '#05060a';
        o.fillRect(cx - r - px, cy - r - px, (r + px) * 2, (r + px) * 2);
        o.fillStyle = '#ff3a2a';
        for (let i = -r; i <= r; i += px) {
            o.fillRect(cx + i, cy + i, px, px);
            o.fillRect(cx + i, cy - i, px, px);
        }
        // Scorch / patch marks.
        o.fillStyle = '#05060a';
        o.globalAlpha = 0.6;
        for (let k = 0; k < 4; k++) {
            const s = (seed >>> (k * 7)) & 127;
            o.fillRect(Math.round((s / 127) * (w - px * 2)), Math.round((((seed >>> (k * 5 + 3)) & 127) / 127) * (h - px * 2)), px * 2, px);
        }
    },

    /** Blinking red beacon above a renegade (per frame, cheap). */
    drawRenegadeBeacon(ctx, enemy) {
        const t = (typeof performance !== 'undefined' ? performance.now() : Date.now());
        if (Math.floor(t / 350) % 2) return;
        const x = Math.round(enemy.x + enemy.width / 2);
        const y = Math.round(enemy.y - 3);
        ctx.save();
        ctx.fillStyle = '#05060a';
        ctx.fillRect(x - 2, y - 2, 4, 4);
        ctx.fillStyle = enemy.renegadeColor || '#ff3a2a';
        ctx.fillRect(x - 1, y - 1, 2, 2);
        ctx.restore();
    },
});
