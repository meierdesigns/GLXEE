"use strict";

/**
 * Renders pixel icon sprites to canvas / data-URL for HUD and HTML UI.
 */
class IconRenderer {
    constructor() {
        this._cache = {};
        this._colorCache = {};
    }

    getSprite(key) {
        if (typeof IconSprites === 'undefined' || !IconSprites) return null;
        // "key@2x" / "key@4x": the sprite smoothed up with Scale2x (EPX),
        // for large or zoomed-in icons that should look finer, not blockier.
        const m = /^(.+)@([24])x$/.exec(String(key || ''));
        if (!m) return IconSprites[key] || null;
        this._hiRes = this._hiRes || {};
        if (this._hiRes[key]) return this._hiRes[key];
        let sprite = IconSprites[m[1]] || null;
        if (!sprite) return null;
        let n = Number(m[2]);
        // Hand-drawn 32x32 art (e.g. factionTerranHi) replaces the first doubling.
        if (IconSprites[m[1] + 'Hi']) { sprite = IconSprites[m[1] + 'Hi']; n /= 2; }
        for (; n > 1; n /= 2) sprite = this.scale2x(sprite);
        this._hiRes[key] = sprite;
        return sprite;
    }

    /** Large draws of sprites with hand-drawn 32x32 art get the @2x/@4x key. */
    detailKey(key, size) {
        const k = String(key || '');
        // VOXEL combat: keep authored pixels as hard blocks — no Scale2x slopes.
        const voxel = typeof window !== 'undefined' && window.combatVoxels && window.combatVoxels.cell
            && window.combatVoxels.cell();
        if (voxel) return k.replace(/@[24]x$/, '');
        if (/@[24]x$/.test(k) || typeof IconSprites === 'undefined' || !IconSprites[k + 'Hi']) return key;
        const s = Number(size) || 16;
        return s >= 48 ? k + '@4x' : (s >= 24 ? k + '@2x' : key);
    }

    /** Scale2x: doubles a pixel matrix, rounding diagonal steps into slopes. */
    scale2x(src) {
        const h = src.length, w = src[0].length;
        const at = (x, y) => (y < 0 || y >= h || x < 0 || x >= w) ? src[Math.max(0, Math.min(h - 1, y))][Math.max(0, Math.min(w - 1, x))] : src[y][x];
        const out = Array.from({ length: h * 2 }, () => new Array(w * 2).fill(0));
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const P = src[y][x], A = at(x, y - 1), B = at(x + 1, y), C = at(x - 1, y), D = at(x, y + 1);
                out[y * 2][x * 2] = (C === A && C !== D && A !== B) ? A : P;
                out[y * 2][x * 2 + 1] = (A === B && A !== C && B !== D) ? B : P;
                out[y * 2 + 1][x * 2] = (D === C && D !== B && C !== A) ? C : P;
                out[y * 2 + 1][x * 2 + 1] = (B === D && B !== A && D !== C) ? D : P;
            }
        }
        return out;
    }

    /** Prefer accepted PNG override from spriteLoader when present. */
    getPngOverride(key) {
        if (typeof spriteLoader === 'undefined' || !spriteLoader || !spriteLoader.getSprite) return null;
        const k = String(key || '').replace(/@[24]x$/, '');
        let img = spriteLoader.getSprite(k);
        if (img) return img;
        // factionTerran ↔ faction-terran / faction_terran
        if (/^faction[A-Z]/.test(k)) {
            const id = k.slice(7).toLowerCase();
            img = spriteLoader.getSprite('faction-' + id) || spriteLoader.getSprite('faction_' + id);
            if (img) return img;
        }
        if (k.indexOf('faction-') === 0) {
            const id = k.slice(8);
            const camel = 'faction' + id.charAt(0).toUpperCase() + id.slice(1);
            img = spriteLoader.getSprite(camel) || spriteLoader.getSprite('faction_' + id);
            if (img) return img;
        }
        return null;
    }

    drawPng(ctx, img, x, y, size) {
        if (!img) return;
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(img, x, y, size, size);
        ctx.restore();
    }

    drawKey(ctx, key, x, y, size, tint, contrast, brightness, saturation) {
        key = this.detailKey(key, size);
        const voxel = typeof window !== 'undefined' && window.combatVoxels && window.combatVoxels.cell
            && window.combatVoxels.cell();
        // VOXEL: prefer indexed hard cells over PNG stretch.
        const png = voxel ? null : this.getPngOverride(key);
        if (png) {
            this.drawPng(ctx, png, x, y, size);
            return true;
        }
        const sprite = this.getSprite(key);
        if (!sprite) return false;
        if (voxel) {
            const cell = voxel;
            x = Math.round(x / cell) * cell;
            y = Math.round(y / cell) * cell;
            size = Math.max(cell, Math.round(size / cell) * cell);
        }
        this.drawSprite(ctx, sprite, x, y, size, tint, contrast, brightness, saturation);
        return true;
    }

    getGray(index) {
        // Continuous 1–15 ramp (sprites use 8/10/12/15 as highlights).
        // Floor lifted so tinted icons stay readable on near-black UI.
        const shades = [
            null,
            '#2c2c2c', '#383838', '#454545', '#545454', '#646464',
            '#757575', '#888888', '#9a9a9a', '#adadad', '#bfbfbf',
            '#d0d0d0', '#dedede', '#e8e8e8', '#f0f0f0', '#f8f8f8'
        ];
        return shades[index] || null;
    }

    getIconContrast() {
        try {
            if (typeof colorManager !== 'undefined' && colorManager.currentColors) {
                const c = Number(colorManager.currentColors.iconContrast);
                if (Number.isFinite(c)) return Math.max(0, Math.min(100, c));
            }
            if (typeof colorPaletteSystem !== 'undefined' && colorPaletteSystem.palettes) {
                const id = colorPaletteSystem.currentPalette;
                const p = colorPaletteSystem.palettes[id];
                const c = Number(p && p.iconContrast);
                if (Number.isFinite(c)) return Math.max(0, Math.min(100, c));
            }
            const root = getComputedStyle(document.documentElement);
            const v = Number(root.getPropertyValue('--theme-icon-contrast').trim());
            if (Number.isFinite(v)) return Math.max(0, Math.min(100, v));
        } catch (e) { /* ignore */ }
        return 65;
    }

    getIconBrightness() {
        try {
            if (typeof colorManager !== 'undefined' && colorManager.currentColors) {
                const c = Number(colorManager.currentColors.iconBrightness);
                if (Number.isFinite(c)) return Math.max(0, Math.min(100, c));
            }
            if (typeof colorPaletteSystem !== 'undefined' && colorPaletteSystem.palettes) {
                const id = colorPaletteSystem.currentPalette;
                const p = colorPaletteSystem.palettes[id];
                const c = Number(p && p.iconBrightness);
                if (Number.isFinite(c)) return Math.max(0, Math.min(100, c));
            }
            const root = getComputedStyle(document.documentElement);
            const v = Number(root.getPropertyValue('--theme-icon-brightness').trim());
            if (Number.isFinite(v)) return Math.max(0, Math.min(100, v));
        } catch (e) { /* ignore */ }
        return 50;
    }

    getIconSaturation() {
        try {
            if (typeof colorManager !== 'undefined' && colorManager.currentColors) {
                const c = Number(colorManager.currentColors.iconSaturation);
                if (Number.isFinite(c)) return Math.max(0, Math.min(100, c));
            }
            if (typeof colorPaletteSystem !== 'undefined' && colorPaletteSystem.palettes) {
                const id = colorPaletteSystem.currentPalette;
                const p = colorPaletteSystem.palettes[id];
                const c = Number(p && p.iconSaturation);
                if (Number.isFinite(c)) return Math.max(0, Math.min(100, c));
            }
            const root = getComputedStyle(document.documentElement);
            const v = Number(root.getPropertyValue('--theme-icon-saturation').trim());
            if (Number.isFinite(v)) return Math.max(0, Math.min(100, v));
        } catch (e) { /* ignore */ }
        return 50;
    }

    /**
     * Icon-specific contrast: lifts near-black pixels and stretches range
     * so tinted sprites stay readable on dark theme backgrounds.
     */
    applyIconContrast(hex, contrast) {
        if (!hex || hex.charAt(0) !== '#') return hex;
        const c = Number.isFinite(Number(contrast)) ? Number(contrast) : this.getIconContrast();
        const t = Math.max(0, Math.min(100, c)) / 100;
        const key = hex + '|ic|' + Math.round(c);
        if (this._colorCache[key]) return this._colorCache[key];
        const n = parseInt(hex.slice(1), 16);
        let r = (n >> 16) & 255;
        let g = (n >> 8) & 255;
        let b = n & 255;
        const floor = Math.round(t * 58);
        const scale = 0.5 + t * 1.2;
        const remap = (v) => {
            const lifted = floor + (v / 255) * (255 - floor);
            const mid = 128;
            return Math.max(0, Math.min(255, Math.round(mid + (lifted - mid) * scale)));
        };
        r = remap(r);
        g = remap(g);
        b = remap(b);
        const out = '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
        this._colorCache[key] = out;
        return out;
    }

    /**
     * Overall icon color brightness (independent of contrast).
     * 50 = neutral, 0 = darker, 100 = brighter.
     */
    applyIconBrightness(hex, brightness) {
        if (!hex || hex.charAt(0) !== '#') return hex;
        const bRaw = Number.isFinite(Number(brightness)) ? Number(brightness) : this.getIconBrightness();
        const b = Math.max(0, Math.min(100, bRaw));
        if (b === 50) return hex;
        const key = hex + '|ib|' + Math.round(b);
        if (this._colorCache[key]) return this._colorCache[key];
        const n = parseInt(hex.slice(1), 16);
        let r = (n >> 16) & 255;
        let g = (n >> 8) & 255;
        let bl = n & 255;
        const t = (b - 50) / 50;
        const channel = (v) => {
            if (t >= 0) return Math.max(0, Math.min(255, Math.round(v + (255 - v) * t)));
            return Math.max(0, Math.min(255, Math.round(v * (1 + t))));
        };
        r = channel(r);
        g = channel(g);
        bl = channel(bl);
        const out = '#' + ((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1);
        this._colorCache[key] = out;
        return out;
    }

    /**
     * Icon color saturation (independent of contrast/brightness).
     * 50 = neutral, 0 = grayscale, 100 = boosted chroma.
     */
    applyIconSaturation(hex, saturation) {
        if (!hex || hex.charAt(0) !== '#') return hex;
        const sRaw = Number.isFinite(Number(saturation)) ? Number(saturation) : this.getIconSaturation();
        const s = Math.max(0, Math.min(100, sRaw));
        if (s === 50) return hex;
        const key = hex + '|is|' + Math.round(s);
        if (this._colorCache[key]) return this._colorCache[key];
        const n = parseInt(hex.slice(1), 16);
        let r = (n >> 16) & 255;
        let g = (n >> 8) & 255;
        let b = n & 255;
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        const t = (s - 50) / 50;
        const factor = 1 + t;
        const channel = (v) => Math.max(0, Math.min(255, Math.round(gray + (v - gray) * factor)));
        r = channel(r);
        g = channel(g);
        b = channel(b);
        const out = '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
        this._colorCache[key] = out;
        return out;
    }

    applyIconLook(hex, contrast, brightness, saturation) {
        let color = this.applyIconContrast(hex, contrast);
        color = this.applyIconBrightness(color, brightness);
        color = this.applyIconSaturation(color, saturation);
        return color;
    }

    drawSprite(ctx, sprite, x, y, size, tint, contrast, brightness, saturation) {
        if (!sprite || !sprite.length) return;
        ctx.imageSmoothingEnabled = false;
        if (ctx.mozImageSmoothingEnabled !== undefined) ctx.mozImageSmoothingEnabled = false;
        if (ctx.webkitImageSmoothingEnabled !== undefined) ctx.webkitImageSmoothingEnabled = false;
        if (ctx.msImageSmoothingEnabled !== undefined) ctx.msImageSmoothingEnabled = false;
        const cols = sprite[0].length;
        const rows = sprite.length;
        const raw = contrast === false;
        const ic = raw ? 50 : (Number.isFinite(Number(contrast)) ? Number(contrast) : this.getIconContrast());
        const ib = raw ? 50 : (Number.isFinite(Number(brightness)) ? Number(brightness) : this.getIconBrightness());
        const is = raw ? 50 : (Number.isFinite(Number(saturation)) ? Number(saturation) : this.getIconSaturation());
        const cv = typeof window !== 'undefined' ? window.combatVoxels : null;
        const cell = cv && cv.cell ? cv.cell() : null;
        const x0 = cell ? Math.round(x / cell) * cell : Math.round(x);
        const y0 = cell ? Math.round(y / cell) * cell : Math.round(y);
        const dim = cell
            ? Math.max(cell, Math.round(size / cell) * cell)
            : Math.max(1, Math.round(size));
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const idx = sprite[r][c];
                if (!idx) continue;
                let color = this.getGray(idx);
                if (!color) continue;
                if (tint) color = this.tintColor(color, tint);
                if (!raw) color = this.applyIconLook(color, ic, ib, is);
                const px = x0 + Math.floor((c * dim) / cols);
                const py = y0 + Math.floor((r * dim) / rows);
                const pw = (x0 + Math.floor(((c + 1) * dim) / cols)) - px;
                const ph = (y0 + Math.floor(((r + 1) * dim) / rows)) - py;
                if (pw < 1 || ph < 1) continue;
                if (cv && cv.fill) cv.fill(ctx, px, py, pw, ph, color, 1);
                else {
                    ctx.fillStyle = color;
                    ctx.fillRect(px, py, pw, ph);
                }
            }
        }
    }

    /**
     * Vector version of drawSprite: one <rect> per sprite cell with crispEdges,
     * so the icon stays sharp at any CSS size / devicePixelRatio.
     */
    spriteToSvgUrl(sprite, tint, contrast, brightness, saturation) {
        if (!sprite || !sprite.length) return '';
        const cols = sprite[0].length;
        const rows = sprite.length;
        const raw = contrast === false;
        const ic = raw ? 50 : (Number.isFinite(Number(contrast)) ? Number(contrast) : this.getIconContrast());
        const ib = raw ? 50 : (Number.isFinite(Number(brightness)) ? Number(brightness) : this.getIconBrightness());
        const is = raw ? 50 : (Number.isFinite(Number(saturation)) ? Number(saturation) : this.getIconSaturation());
        let rects = '';
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const idx = sprite[r][c];
                if (!idx) continue;
                let color = this.getGray(idx);
                if (!color) continue;
                if (tint) color = this.tintColor(color, tint);
                if (!raw) color = this.applyIconLook(color, ic, ib, is);
                rects += `<rect x="${c}" y="${r}" width="1" height="1" fill="${color}"/>`;
            }
        }
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${cols} ${rows}" shape-rendering="crispEdges">${rects}</svg>`;
        return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    }

    tintColor(hex, tint) {
        const key = hex + '|' + tint;
        if (this._colorCache[key]) return this._colorCache[key];
        const n = parseInt(hex.slice(1), 16);
        const g = (n >> 8) & 255;
        const t = tint.replace('#', '');
        const tn = parseInt(t.length === 3 ? t.split('').map((c) => c + c).join('') : t, 16);
        const tr = (tn >> 16) & 255;
        const tg = (tn >> 8) & 255;
        const tb = tn & 255;
        const f = g / 255;
        const rr = Math.round(tr * f);
        const gg = Math.round(tg * f);
        const bb = Math.round(tb * f);
        const out = '#' + ((1 << 24) + (rr << 16) + (gg << 8) + bb).toString(16).slice(1);
        this._colorCache[key] = out;
        return out;
    }
}
