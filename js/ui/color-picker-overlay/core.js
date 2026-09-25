"use strict";

/**
 * In-game color picker overlay (replaces native input[type=color]).
 * Usage: colorPickerOverlay.open(hex, { anchor, onChange, onClose })
 */
class ColorPickerOverlay {
    constructor() {
        this.el = null;
        this.anchor = null;
        this.onChange = null;
        this.onClose = null;
        this.h = 210;
        this.s = 0.77;
        this.v = 0.93;
        this._dragging = null;
        this._boundDoc = false;
        this._onPointerMove = (e) => this.handleDrag(e);
        this._onPointerUp = () => this.endDrag();
        this._onKey = (e) => {
            if (e.key === 'Escape' && this.isOpen()) {
                e.preventDefault();
                e.stopPropagation();
                this.close();
            }
        };
        this._onResize = () => {
            if (this.isOpen()) this.positionNearAnchor();
        };
    }

    _onOutside = (e) => {
        if (!this.isOpen()) return;
        if (this.el.contains(e.target)) return;
        if (this.anchor && this.anchor.contains && this.anchor.contains(e.target)) return;
        if (this.anchor && e.target === this.anchor) return;
        this.close();
    };

    isOpen() {
        return !!(this.el && this.el.isConnected && !this.el.hidden);
    }

    ensureEl() {
        if (this.el && this.el.isConnected) return this.el;

        const root = document.createElement('div');
        root.className = 'vf-color-picker';
        root.hidden = true;
        root.setAttribute('role', 'dialog');
        root.setAttribute('aria-label', 'Color picker');
        root.innerHTML = `
            <div class="vf-cp-sv" data-cp="sv">
                <div class="vf-cp-sv-white"></div>
                <div class="vf-cp-sv-black"></div>
                <div class="vf-cp-cursor" data-cp="sv-cursor"></div>
            </div>
            <div class="vf-cp-row">
                <div class="vf-cp-preview" data-cp="preview"></div>
                <div class="vf-cp-hue" data-cp="hue">
                    <div class="vf-cp-hue-thumb" data-cp="hue-thumb"></div>
                </div>
            </div>
            <div class="vf-cp-rgb">
                <label class="vf-cp-channel"><span>R</span><input type="number" min="0" max="255" data-cp="r"></label>
                <label class="vf-cp-channel"><span>G</span><input type="number" min="0" max="255" data-cp="g"></label>
                <label class="vf-cp-channel"><span>B</span><input type="number" min="0" max="255" data-cp="b"></label>
            </div>
            <div class="vf-cp-hex-row">
                <span class="vf-cp-hex-label">HEX</span>
                <input type="text" class="vf-cp-hex" data-cp="hex" maxlength="7" spellcheck="false">
            </div>
        `;

        root.addEventListener('pointerdown', (e) => e.stopPropagation());
        root.addEventListener('click', (e) => e.stopPropagation());

        const sv = root.querySelector('[data-cp="sv"]');
        const hue = root.querySelector('[data-cp="hue"]');
        sv.addEventListener('pointerdown', (e) => this.beginDrag('sv', e));
        hue.addEventListener('pointerdown', (e) => this.beginDrag('hue', e));

        ['r', 'g', 'b'].forEach((ch) => {
            const input = root.querySelector(`[data-cp="${ch}"]`);
            input.addEventListener('change', () => this.applyRgbInputs());
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.applyRgbInputs();
                }
            });
        });

        const hexInput = root.querySelector('[data-cp="hex"]');
        hexInput.addEventListener('change', () => this.applyHexInput());
        hexInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.applyHexInput();
            }
        });

        document.body.appendChild(root);
        this.el = root;
        return root;
    }

    bindDoc() {
        if (this._boundDoc) return;
        this._boundDoc = true;
        document.addEventListener('pointermove', this._onPointerMove, true);
        document.addEventListener('pointerup', this._onPointerUp, true);
        document.addEventListener('pointercancel', this._onPointerUp, true);
        document.addEventListener('keydown', this._onKey, true);
        document.addEventListener('pointerdown', this._onOutside, true);
        window.addEventListener('resize', this._onResize);
        window.addEventListener('scroll', this._onResize, true);
    }

    unbindDoc() {
        if (!this._boundDoc) return;
        this._boundDoc = false;
        document.removeEventListener('pointermove', this._onPointerMove, true);
        document.removeEventListener('pointerup', this._onPointerUp, true);
        document.removeEventListener('pointercancel', this._onPointerUp, true);
        document.removeEventListener('keydown', this._onKey, true);
        document.removeEventListener('pointerdown', this._onOutside, true);
        window.removeEventListener('resize', this._onResize);
        window.removeEventListener('scroll', this._onResize, true);
    }

    open(hex, opts = {}) {
        this.ensureEl();
        this.anchor = opts.anchor || null;
        this.onChange = typeof opts.onChange === 'function' ? opts.onChange : null;
        this.onClose = typeof opts.onClose === 'function' ? opts.onClose : null;
        this.setFromHex(hex || '#ffffff', false);
        this.el.hidden = false;
        this.bindDoc();
        this.syncUi();
        this.positionNearAnchor();
        const hexInput = this.el.querySelector('[data-cp="hex"]');
        if (hexInput) {
            try { hexInput.focus({ preventScroll: true }); } catch (_) { /* ignore */ }
        }
    }

    close() {
        this.endDrag();
        if (this.el) this.el.hidden = true;
        this.unbindDoc();
        const cb = this.onClose;
        this.onClose = null;
        this.onChange = null;
        this.anchor = null;
        if (cb) {
            try { cb(); } catch (_) { /* ignore */ }
        }
    }

    positionNearAnchor() {
        if (!this.el || !this.anchor) {
            if (this.el) {
                this.el.style.left = '50%';
                this.el.style.top = '50%';
                this.el.style.transform = 'translate(-50%, -50%)';
            }
            return;
        }
        const rect = this.anchor.getBoundingClientRect();
        const panel = this.el.getBoundingClientRect();
        const gap = 10;
        let left = rect.left;
        let top = rect.bottom + gap;
        if (left + panel.width > window.innerWidth - 8) {
            left = Math.max(8, window.innerWidth - panel.width - 8);
        }
        if (top + panel.height > window.innerHeight - 8) {
            top = Math.max(8, rect.top - panel.height - gap);
        }
        this.el.style.transform = 'none';
        this.el.style.left = `${Math.round(left)}px`;
        this.el.style.top = `${Math.round(top)}px`;
    }

    normalizeHex(color) {
        if (typeof colorPaletteSystem !== 'undefined' && colorPaletteSystem.normalizeHex) {
            return colorPaletteSystem.normalizeHex(color).toLowerCase();
        }
        if (!color || typeof color !== 'string') return '#ffffff';
        let h = color.trim();
        if (h.charAt(0) !== '#') h = '#' + h;
        if (/^#[0-9a-fA-F]{3}$/.test(h)) {
            h = '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
        }
        if (!/^#[0-9a-fA-F]{6}$/.test(h)) return '#ffffff';
        return h.toLowerCase();
    }

    hexToRgb(hex) {
        const h = this.normalizeHex(hex).slice(1);
        const n = parseInt(h, 16);
        return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    }

    rgbToHex(r, g, b) {
        const to = (x) => Math.max(0, Math.min(255, Math.round(Number(x) || 0)));
        return '#' + ((1 << 24) + (to(r) << 16) + (to(g) << 8) + to(b)).toString(16).slice(1);
    }

    rgbToHsv(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const d = max - min;
        let h = 0;
        const s = max === 0 ? 0 : d / max;
        const v = max;
        if (d !== 0) {
            switch (max) {
                case r: h = ((g - b) / d + (g < b ? 6 : 0)); break;
                case g: h = ((b - r) / d + 2); break;
                default: h = ((r - g) / d + 4); break;
            }
            h *= 60;
        }
        return { h, s, v };
    }

    hsvToRgb(h, s, v) {
        h = ((h % 360) + 360) % 360;
        s = Math.max(0, Math.min(1, s));
        v = Math.max(0, Math.min(1, v));
        const c = v * s;
        const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
        const m = v - c;
        let rp = 0, gp = 0, bp = 0;
        if (h < 60) { rp = c; gp = x; }
        else if (h < 120) { rp = x; gp = c; }
        else if (h < 180) { gp = c; bp = x; }
        else if (h < 240) { gp = x; bp = c; }
        else if (h < 300) { rp = x; bp = c; }
        else { rp = c; bp = x; }
        return {
            r: Math.round((rp + m) * 255),
            g: Math.round((gp + m) * 255),
            b: Math.round((bp + m) * 255)
        };
    }

    currentHex() {
        const rgb = this.hsvToRgb(this.h, this.s, this.v);
        return this.rgbToHex(rgb.r, rgb.g, rgb.b);
    }

    setFromHex(hex, emit) {
        const rgb = this.hexToRgb(hex);
        const hsv = this.rgbToHsv(rgb.r, rgb.g, rgb.b);
        this.h = hsv.h;
        this.s = hsv.s;
        this.v = hsv.v;
        this.syncUi();
        if (emit) this.emitChange();
    }

    emitChange() {
        if (!this.onChange) return;
        try { this.onChange(this.currentHex()); } catch (_) { /* ignore */ }
    }
}
