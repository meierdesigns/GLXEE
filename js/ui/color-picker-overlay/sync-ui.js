"use strict";

// ColorPickerOverlay methods, split from color-picker-overlay.js.
extendClass(ColorPickerOverlay, {
    syncUi() {
        if (!this.el) return;
        const hex = this.currentHex();
        const rgb = this.hexToRgb(hex);
        const hueColor = this.rgbToHex(...Object.values(this.hsvToRgb(this.h, 1, 1)));

        const sv = this.el.querySelector('[data-cp="sv"]');
        const cursor = this.el.querySelector('[data-cp="sv-cursor"]');
        const preview = this.el.querySelector('[data-cp="preview"]');
        const hueThumb = this.el.querySelector('[data-cp="hue-thumb"]');
        const hexInput = this.el.querySelector('[data-cp="hex"]');
        const rIn = this.el.querySelector('[data-cp="r"]');
        const gIn = this.el.querySelector('[data-cp="g"]');
        const bIn = this.el.querySelector('[data-cp="b"]');

        if (sv) sv.style.backgroundColor = hueColor;
        if (cursor) {
            cursor.style.left = `${(this.s * 100).toFixed(2)}%`;
            cursor.style.top = `${((1 - this.v) * 100).toFixed(2)}%`;
        }
        if (preview) preview.style.backgroundColor = hex;
        if (hueThumb) hueThumb.style.left = `${((this.h / 360) * 100).toFixed(2)}%`;
        if (hexInput && document.activeElement !== hexInput) hexInput.value = hex.toUpperCase();
        if (rIn && document.activeElement !== rIn) rIn.value = String(rgb.r);
        if (gIn && document.activeElement !== gIn) gIn.value = String(rgb.g);
        if (bIn && document.activeElement !== bIn) bIn.value = String(rgb.b);
    },

    beginDrag(kind, e) {
        e.preventDefault();
        e.stopPropagation();
        this._dragging = kind;
        if (e.currentTarget && e.currentTarget.setPointerCapture) {
            try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
        }
        this.handleDrag(e);
    },

    endDrag() {
        this._dragging = null;
    },

    handleDrag(e) {
        if (!this._dragging || !this.el) return;
        if (this._dragging === 'sv') {
            const sv = this.el.querySelector('[data-cp="sv"]');
            const rect = sv.getBoundingClientRect();
            const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
            this.s = x;
            this.v = 1 - y;
            this.syncUi();
            this.emitChange();
            return;
        }
        if (this._dragging === 'hue') {
            const hue = this.el.querySelector('[data-cp="hue"]');
            const rect = hue.getBoundingClientRect();
            const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            this.h = x * 360;
            this.syncUi();
            this.emitChange();
        }
    },

    applyRgbInputs() {
        if (!this.el) return;
        const r = Number(this.el.querySelector('[data-cp="r"]').value);
        const g = Number(this.el.querySelector('[data-cp="g"]').value);
        const b = Number(this.el.querySelector('[data-cp="b"]').value);
        this.setFromHex(this.rgbToHex(r, g, b), true);
    },

    applyHexInput() {
        if (!this.el) return;
        const raw = this.el.querySelector('[data-cp="hex"]').value;
        this.setFromHex(this.normalizeHex(raw), true);
    },

    /**
     * Bind a swatch element so clicks open the overlay instead of a native picker.
     * Works with button/div swatches, or input[type=color] (native dialog suppressed).
     */
    bindSwatch(el, opts = {}) {
        if (!el) return;
        const getValue = opts.getValue || (() => el.value || el.dataset.color || '#ffffff');
        const setValue = opts.setValue || ((hex) => {
            if ('value' in el) el.value = hex;
            el.dataset.color = hex;
            el.style.backgroundColor = hex;
        });
        const onChange = opts.onChange || null;

        const openFrom = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.open(getValue(), {
                anchor: el,
                onChange: (hex) => {
                    setValue(hex);
                    if (onChange) onChange(hex);
                }
            });
        };

        el.addEventListener('click', openFrom);
        el.addEventListener('pointerdown', (e) => {
            // Block native color dialog before it opens
            if (el.tagName === 'INPUT' && el.type === 'color') {
                e.preventDefault();
            }
        });
        setValue(this.normalizeHex(getValue()));
    },
});
