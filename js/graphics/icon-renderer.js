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
        return IconSprites[key] || null;
    }

    /** Prefer accepted PNG override from spriteLoader when present. */
    getPngOverride(key) {
        if (typeof spriteLoader === 'undefined' || !spriteLoader || !spriteLoader.getSprite) return null;
        const k = String(key || '');
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
        const png = this.getPngOverride(key);
        if (png) {
            this.drawPng(ctx, png, x, y, size);
            return true;
        }
        const sprite = this.getSprite(key);
        if (!sprite) return false;
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
        const x0 = Math.round(x);
        const y0 = Math.round(y);
        const dim = Math.max(1, Math.round(size));
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
                ctx.fillStyle = color;
                ctx.fillRect(px, py, pw, ph);
            }
        }
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

    /**
     * Global category color code — weapon/defense/ability/energy icons use a
     * consistent hue everywhere they appear (loadout chips, hangar, ship
     * editor, ...) instead of all sharing the same neutral theme tint, so a
     * category reads at a glance regardless of which screen shows it.
     */
    getModuleKindColor(kind) {
        const colors = {
            weapon: '#ff6a4a',
            defense: '#4ac8ff',
            ability: '#c08cff',
            energy: '#ffd24a'
        };
        return colors[String(kind || '').toLowerCase()] || null;
    }

    getThemeTint() {
        try {
            if (typeof colorManager !== 'undefined' && colorManager.getCurrentOverlayColor) {
                const c = colorManager.getCurrentOverlayColor();
                if (c && c.charAt(0) === '#') return c;
            }
            const root = getComputedStyle(document.documentElement);
            const props = ['--color-basecolor', '--current-primary', '--color-primary', '--color-text'];
            for (let i = 0; i < props.length; i++) {
                const v = root.getPropertyValue(props[i]).trim();
                if (!v) continue;
                if (v.charAt(0) === '#') return v;
                const probe = document.createElement('div');
                probe.style.color = v;
                probe.style.display = 'none';
                document.body.appendChild(probe);
                const rgb = getComputedStyle(probe).color;
                document.body.removeChild(probe);
                const m = rgb && rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
                if (m) {
                    const hex = '#' + [m[1], m[2], m[3]].map((n) => {
                        const h = Number(n).toString(16);
                        return h.length === 1 ? '0' + h : h;
                    }).join('');
                    return hex;
                }
            }
        } catch (e) { /* ignore */ }
        return '#80ff80';
    }

    clearCache() {
        this._cache = {};
        this._colorCache = {};
    }

    escapeAttr(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    /**
     * Human label for icon keys (tooltips / a11y).
     * Optional override via IconLabels[key].
     */
    labelFor(key) {
        const k = String(key || '');
        if (!k) return '';
        if (typeof IconLabels !== 'undefined' && IconLabels && IconLabels[k]) {
            return String(IconLabels[k]);
        }
        let s = k;
        if (s.indexOf('ability_') === 0) s = s.slice(8);
        else if (s.indexOf('shot') === 0 && s.length > 4 && s.charAt(4) === s.charAt(4).toUpperCase()) {
            s = 'SHOT_' + s.slice(4);
        } else if (s.indexOf('stat') === 0 && s.length > 4) s = s.slice(4);
        else if (s.indexOf('menu') === 0 && s.length > 4) s = s.slice(4);
        else if (s.indexOf('hs') === 0 && s.length > 2 && s.charAt(2) === s.charAt(2).toUpperCase()) {
            s = s.slice(2);
        } else if (s.indexOf('res') === 0 && s.length > 3 && s.charAt(3) === s.charAt(3).toUpperCase()) {
            s = s.slice(3);
        } else if (s.indexOf('galaxy') === 0 && s.length > 6) s = s.slice(6);
        else if (s.indexOf('faction') === 0 && s.length > 7) s = s.slice(7);
        s = s
            .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
            .replace(/[_-]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .toUpperCase();
        return s || k.toUpperCase();
    }

    applyTip(el, key, tipLabel) {
        if (!el) return;
        const label = tipLabel != null ? String(tipLabel) : this.labelFor(key);
        if (!label) return;
        el.setAttribute('data-ui-tip', label);
        el.classList.add('ui-icon-tip');
        if (el.removeAttribute) el.removeAttribute('title');
        if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', label);
    }

    toDataUrl(key, size, tint, contrast, brightness, saturation) {
        const raw = contrast === false;
        const ic = raw ? false : (Number.isFinite(Number(contrast)) ? Number(contrast) : this.getIconContrast());
        const ib = raw ? false : (Number.isFinite(Number(brightness)) ? Number(brightness) : this.getIconBrightness());
        const is = raw ? false : (Number.isFinite(Number(saturation)) ? Number(saturation) : this.getIconSaturation());
        const png = this.getPngOverride(key);
        const cssSize = Math.max(1, Math.round(size || 16));
        // Snap to sprite grid (16) then ≥2× backing for HiDPI / fractional DPR
        const grid = 16;
        const logical = Math.max(grid, Math.round(cssSize / grid) * grid);
        let dpr = 1;
        try {
            dpr = (typeof window !== 'undefined' && window.devicePixelRatio) ? Number(window.devicePixelRatio) : 1;
        } catch (e) { dpr = 1; }
        if (!Number.isFinite(dpr) || dpr < 1) dpr = 1;
        const scale = Math.max(2, Math.ceil(dpr));
        const canvasSize = logical * scale;
        const cacheKey = key + '|' + canvasSize + '|' + (tint || '') + (raw ? '|raw' : ('|ic' + Math.round(ic) + '|ib' + Math.round(ib) + '|is' + Math.round(is))) + (png ? '|png' : '') + '|nn2';
        if (this._cache[cacheKey]) return { url: this._cache[cacheKey], cssSize: logical };
        const canvas = document.createElement('canvas');
        canvas.width = canvasSize;
        canvas.height = canvasSize;
        const ctx = canvas.getContext('2d', { alpha: true, willReadFrequently: false });
        ctx.imageSmoothingEnabled = false;
        if (ctx.mozImageSmoothingEnabled !== undefined) ctx.mozImageSmoothingEnabled = false;
        if (ctx.webkitImageSmoothingEnabled !== undefined) ctx.webkitImageSmoothingEnabled = false;
        if (ctx.msImageSmoothingEnabled !== undefined) ctx.msImageSmoothingEnabled = false;
        if (png) {
            this.drawPng(ctx, png, 0, 0, canvasSize);
        } else {
            const sprite = this.getSprite(key);
            if (!sprite) return { url: '', cssSize: logical };
            this.drawSprite(ctx, sprite, 0, 0, canvasSize, tint, ic, ib, is);
        }
        const url = canvas.toDataURL('image/png');
        this._cache[cacheKey] = url;
        return { url, cssSize: logical };
    }

    imgHtml(key, size, className, tint, tipLabel) {
        const resolvedTint = tint === undefined ? this.getThemeTint() : tint;
        // HTML UI icons: nearest-neighbor only — no contrast/brightness/saturation remapping
        const packed = this.toDataUrl(key, size || 16, resolvedTint || null, false, false, false);
        const url = packed && packed.url;
        if (!url) return '';
        const px = (packed && packed.cssSize) || size || 16;
        const cls = className ? ` class="${className}"` : '';
        const ag = key ? ` data-ag-key="${String(key).replace(/"/g, '')}"` : '';
        const label = tipLabel === false
            ? ''
            : (tipLabel != null ? String(tipLabel) : this.labelFor(key));
        const tipAttr = label ? ` data-ui-tip="${this.escapeAttr(label)}"` : '';
        const alt = this.escapeAttr(label || '');
        const img = `<img${cls}${ag} src="${url}" width="${px}" height="${px}" alt="${alt}" draggable="false" style="image-rendering:-moz-crisp-edges;image-rendering:pixelated;image-rendering:crisp-edges;width:${px}px;height:${px}px">`;
        if (!label) return img;
        return `<span class="ui-icon-tip"${tipAttr} role="img" aria-label="${alt}">${img}</span>`;
    }

    drawToCanvas(canvas, key, tint, contrast, brightness, saturation) {
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const size = Math.min(canvas.width, canvas.height);
        this.drawKey(ctx, key, 0, 0, size, tint, contrast, brightness, saturation);
        this.applyTip(canvas, key);
    }
}

const iconRenderer = new IconRenderer();
window.iconRenderer = iconRenderer;
