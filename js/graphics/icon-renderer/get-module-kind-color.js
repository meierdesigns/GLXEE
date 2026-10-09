"use strict";

// IconRenderer methods, split from icon-renderer.js.
extendClass(IconRenderer, {
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
    },

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
    },

    clearCache() {
        this._cache = {};
        this._colorCache = {};
    },

    escapeAttr(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    },

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
    },

    applyTip(el, key, tipLabel) {
        if (!el) return;
        const label = tipLabel != null ? String(tipLabel) : this.labelFor(key);
        if (!label) return;
        el.setAttribute('data-ui-tip', label);
        el.classList.add('ui-icon-tip');
        if (el.removeAttribute) el.removeAttribute('title');
        if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', label);
    },

    toDataUrl(key, size, tint, contrast, brightness, saturation) {
        const raw = contrast === false;
        const ic = raw ? false : (Number.isFinite(Number(contrast)) ? Number(contrast) : this.getIconContrast());
        const ib = raw ? false : (Number.isFinite(Number(brightness)) ? Number(brightness) : this.getIconBrightness());
        const is = raw ? false : (Number.isFinite(Number(saturation)) ? Number(saturation) : this.getIconSaturation());
        key = this.detailKey(key, size);
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
        if (!png) {
            // Procedural sprites: emit SVG so the browser rasterizes at the final size (no blur).
            const svgKey = key + '|svg|' + (tint || '') + (raw ? '|raw' : ('|ic' + Math.round(ic) + '|ib' + Math.round(ib) + '|is' + Math.round(is)));
            if (this._cache[svgKey]) return { url: this._cache[svgKey], cssSize: logical };
            const sprite = this.getSprite(key);
            if (!sprite) return { url: '', cssSize: logical };
            const svgUrl = this.spriteToSvgUrl(sprite, tint, raw ? false : ic, raw ? false : ib, raw ? false : is);
            this._cache[svgKey] = svgUrl;
            return { url: svgUrl, cssSize: logical };
        }
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
    },

    /**
     * CSS size whose real screen pixels are a whole multiple of the 16px
     * sprite grid. At fractional display scaling (e.g. 125%) 32 CSS px are
     * 40 device px = 2.5 per sprite pixel, so pixels alternate 2/3 px wide
     * and look distorted. Snap to 16·k device px instead (k ≥ 1).
     */
    devicePixelSnap(cssPx) {
        let dpr = 1;
        try { dpr = Number(window.devicePixelRatio) || 1; } catch (e) { dpr = 1; }
        if (!(dpr > 0)) dpr = 1;
        const k = Math.max(1, Math.round((cssPx * dpr) / 16));
        return Math.round((16 * k / dpr) * 1000) / 1000;
    },

    /** Resource icons: fixed resource color (16x16 sprite grid, shown at 16·k px), never theme/faction tinted. */
    resourceIconColor(key) {
        const ids = { menuCredits: 'credits', resScrap: 'scrap', resOre: 'ore', resCrystal: 'crystal', resVoltex: 'voltex' };
        const id = ids[key];
        if (!id) return null;
        if (id === 'credits') return '#e8c85a';
        try {
            if (typeof economyConfig !== 'undefined' && economyConfig.getResourceColor) return economyConfig.getResourceColor(id);
        } catch (e) { /* ignore */ }
        return null;
    },

    imgHtml(key, size, className, tint, tipLabel) {
        const resTint = this.resourceIconColor(key);
        if (resTint) tint = resTint;
        const resolvedTint = tint === undefined ? this.getThemeTint() : tint;
        // HTML UI icons: nearest-neighbor only — no contrast/brightness/saturation remapping
        const packed = this.toDataUrl(key, size || 16, resolvedTint || null, false, false, false);
        const url = packed && packed.url;
        if (!url) return '';
        const px = this.devicePixelSnap((packed && packed.cssSize) || size || 16);
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
    },

    drawToCanvas(canvas, key, tint, contrast, brightness, saturation) {
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        if (ctx.imageSmoothingQuality) ctx.imageSmoothingQuality = 'low';
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const size = Math.min(canvas.width, canvas.height);
        this.drawKey(ctx, key, 0, 0, size, tint, contrast, brightness, saturation);
        this.applyTip(canvas, key);
    },

    /** Icon key + UI tint for a weapon id (weapons share shot sprites, the tint tells them apart). */
    weaponIconInfo(weaponId) {
        let id = String(weaponId || 'laser').toLowerCase().replace(/[\s-]+/g, '_');
        // Display names like "LASER" / "Rapid Fire" → config ids.
        if (id === 'normal') id = 'laser';
        if (id === 'rapidfire' || id === 'rapid_fire') id = 'rapid';
        if (id === 'spreadshot' || id === 'spread_shot') id = 'spread';
        const wcm = typeof weaponConfigManager !== 'undefined' ? weaponConfigManager : null;
        const w = wcm && wcm.getWeapon ? wcm.getWeapon(id) : null;
        const resolved = (w && w.id) || id;
        const key = (w && w.iconKey) || ('shot' + resolved.charAt(0).toUpperCase() + resolved.slice(1).replace(/_([a-z])/g, (_, c) => c.toUpperCase()));
        const tint = wcm && wcm.getWeaponUiColor ? wcm.getWeaponUiColor(resolved) : null;
        const name = String((w && w.name) || resolved).toUpperCase();
        return { key, tint, name, id: resolved };
    },

    /** HTML weapon icon: tinted per weapon and tilted 45° (see .ui-weapon-tilt). */
    weaponImgHtml(weaponId, size, className, tipLabel) {
        const info = this.weaponIconInfo(weaponId);
        const tip = tipLabel === undefined ? info.name : tipLabel;
        return `<span class="ui-weapon-tilt">${this.imgHtml(info.key, size, className, info.tint, tip)}</span>`;
    },

    /** Canvas weapon icon, same look as weaponImgHtml. */
    drawWeapon(ctx, weaponId, x, y, size, tintOverride) {
        const info = this.weaponIconInfo(weaponId);
        const cx = x + size / 2;
        const cy = y + size / 2;
        // Rotated square must fit the box: shrink by 1/√2.
        const inner = Math.max(8, Math.round(size / Math.SQRT2));
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.translate(cx, cy);
        ctx.rotate(Math.PI / 4);
        this.drawKey(ctx, info.key, -inner / 2, -inner / 2, inner, tintOverride || info.tint);
        ctx.restore();
    },

    drawWeaponToCanvas(canvas, weaponId) {
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        this.drawWeapon(ctx, weaponId, 0, 0, Math.min(canvas.width, canvas.height));
        this.applyTip(canvas, this.weaponIconInfo(weaponId).key, this.weaponIconInfo(weaponId).name);
    },
});
