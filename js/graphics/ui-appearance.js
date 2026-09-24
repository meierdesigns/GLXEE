"use strict";

/**
 * UI Appearance — border weight, typography, retro FX (independent of color themes).
 * Typography uses three types: H1, H2 Labels, Text.
 */
class UIAppearanceManager {
    constructor() {
        this.storageKey = 'vf_uiAppearance';
        this.borderWeights = {
            THIN: { width: '1px', thin: '1px', thick: '2px' },
            NORMAL: { width: '2px', thin: '1px', thick: '3px' },
            THICK: { width: '3px', thin: '2px', thick: '4px' },
            HEAVY: { width: '4px', thin: '2px', thick: '5px' }
        };
        this.indicatorWeights = {
            '1': '1px',
            '2': '2px',
            '3': '3px',
            '4': '4px',
            '5': '5px',
            '6': '6px'
        };
        this.fonts = {
            COURIER: "'Courier New', Courier, monospace",
            MONO: "ui-monospace, 'Cascadia Code', Consolas, monospace",
            SYSTEM: "system-ui, -apple-system, 'Segoe UI', sans-serif",
            SERIF: "'Times New Roman', Times, Georgia, serif"
        };
        this.fontSizeOptions = {
            h1: ['20', '24', '28', '32', '36', '40', '48'],
            h2: ['10', '11', '12', '14', '16', '18', '20', '24'],
            text: ['8', '9', '10', '11', '12', '14', '16', '18']
        };
        const fxSteps = (max) => {
            const levels = { OFF: 0 };
            for (let percent = 10; percent <= 100; percent += 10) {
                levels[`${percent}%`] = max * percent / 100;
            }
            return levels;
        };
        this.fxLevels = {
            glow: fxSteps(2.2),
            scanlines: fxSteps(1.0),
            crt: fxSteps(1.25),
            chroma: fxSteps(1.1)
        };
        this.shipRenderStyles = ['FLAT', 'VOXEL'];
        this.borderWeight = 'NORMAL';
        this.indicatorWeight = '2';
        this.shipRenderStyle = 'FLAT';
        this.font = 'COURIER';
        this.fontSizes = {
            h1: '28',
            h2: '14',
            text: '12'
        };
        this.controlsHints = 'ON';
        this.glow = 'OFF';
        this.scanlines = 'OFF';
        this.crt = 'OFF';
        this.chroma = 'OFF';
        this.arcade = 'OFF';
        this.load();
        this.apply();
    }

    getControlsHintsOptions() {
        return ['ON', 'OFF'];
    }

    getBorderWeightOptions() {
        return Object.keys(this.borderWeights);
    }

    getIndicatorWeightOptions() {
        return Object.keys(this.indicatorWeights);
    }

    getShipRenderStyleOptions() {
        return this.shipRenderStyles.slice();
    }

    getFontOptions() {
        return Object.keys(this.fonts);
    }

    getFontSizeOptions(type) {
        return this.fontSizeOptions[type] ? this.fontSizeOptions[type].slice() : [];
    }

    getFxOptions(fxKey) {
        if (fxKey === 'arcade') return ['OFF', 'ON'];
        return this.fxLevels[fxKey] ? Object.keys(this.fxLevels[fxKey]) : ['OFF'];
    }

    getFxValue(fxKey) {
        return this[fxKey] || 'OFF';
    }

    load() {
        try {
            const raw = localStorage.getItem(this.storageKey);
            if (!raw) return;
            const data = JSON.parse(raw);
            if (data.borderWeight && this.borderWeights[data.borderWeight]) {
                this.borderWeight = data.borderWeight;
            }
            if (data.indicatorWeight != null) {
                const iw = String(data.indicatorWeight);
                if (this.indicatorWeights[iw]) this.indicatorWeight = iw;
            }
            if (data.shipRenderStyle && this.shipRenderStyles.indexOf(data.shipRenderStyle) !== -1) {
                this.shipRenderStyle = data.shipRenderStyle;
            }
            if (data.font && this.fonts[data.font]) {
                this.font = data.font;
            }
            if (data.fontSizes && typeof data.fontSizes === 'object') {
                ['h1', 'h2', 'text'].forEach((key) => {
                    const val = String(data.fontSizes[key] || '');
                    if (this.fontSizeOptions[key].includes(val)) {
                        this.fontSizes[key] = val;
                    }
                });
            }
            if (data.controlsHints === 'ON' || data.controlsHints === 'OFF') {
                this.controlsHints = data.controlsHints;
            }
            ['glow', 'scanlines', 'crt', 'chroma'].forEach((key) => {
                const val = String(data[key] || '').toUpperCase();
                if (this.fxLevels[key] && Object.prototype.hasOwnProperty.call(this.fxLevels[key], val)) {
                    this[key] = val;
                } else if (this.fxLevels[key]) {
                    const legacy = { LOW: '20%', MED: '40%', HIGH: '70%', MAX: '100%' };
                    this[key] = legacy[val] || 'OFF';
                }
            });
            if (data.arcade === 'ON' || data.arcade === 'OFF') {
                this.arcade = data.arcade;
            }
        } catch (e) {
            /* ignore */
        }
    }

    persist() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify({
                borderWeight: this.borderWeight,
                indicatorWeight: this.indicatorWeight,
                shipRenderStyle: this.shipRenderStyle,
                font: this.font,
                fontSizes: this.fontSizes,
                controlsHints: this.controlsHints,
                glow: this.glow,
                scanlines: this.scanlines,
                crt: this.crt,
                chroma: this.chroma,
                arcade: this.arcade
            }));
        } catch (e) {
            /* ignore */
        }
    }

    setBorderWeight(weight) {
        if (!this.borderWeights[weight]) return;
        this.borderWeight = weight;
        this.persist();
        this.apply();
    }

    setIndicatorWeight(weight) {
        const key = String(weight);
        if (!this.indicatorWeights[key]) return;
        this.indicatorWeight = key;
        this.persist();
        this.apply();
    }

    setShipRenderStyle(style) {
        const val = String(style || '').toUpperCase();
        if (this.shipRenderStyles.indexOf(val) === -1) return;
        this.shipRenderStyle = val;
        this.persist();
    }

    setFont(fontId) {
        if (!this.fonts[fontId]) return;
        this.font = fontId;
        this.persist();
        this.apply();
    }

    setFontSize(type, size) {
        const val = String(size);
        if (!this.fontSizeOptions[type] || !this.fontSizeOptions[type].includes(val)) return;
        this.fontSizes[type] = val;
        this.persist();
        this.apply();
    }

    setControlsHints(value) {
        const next = String(value || '').toUpperCase() === 'OFF' ? 'OFF' : 'ON';
        this.controlsHints = next;
        this.persist();
        this.apply();
        if (window.viewportFit && typeof window.viewportFit.scheduleUpdate === 'function') {
            window.viewportFit.scheduleUpdate();
        }
    }

    toggleControlsHints() {
        this.setControlsHints(this.controlsHints === 'ON' ? 'OFF' : 'ON');
        return this.controlsHints;
    }

    setFx(fxKey, value) {
        const key = String(fxKey || '');
        const val = String(value || '').toUpperCase();
        if (key === 'arcade') {
            if (val !== 'ON' && val !== 'OFF') return;
            this.arcade = val;
            this.persist();
            this.apply();
            return;
        }
        if (!this.fxLevels[key] || !Object.prototype.hasOwnProperty.call(this.fxLevels[key], val)) return;
        this[key] = val;
        this.persist();
        this.apply();
    }

    ensureFxOverlay() {
        let el = document.getElementById('vfFxOverlay');
        if (el) return el;
        el = document.createElement('div');
        el.id = 'vfFxOverlay';
        el.className = 'vf-fx-overlay';
        el.setAttribute('aria-hidden', 'true');
        el.innerHTML = [
            '<div class="vf-fx-scanlines"></div>',
            '<div class="vf-fx-crt"></div>',
            '<div class="vf-fx-chroma"></div>'
        ].join('');
        document.body.appendChild(el);
        return el;
    }

    apply() {
        const root = document.documentElement;
        const bw = this.borderWeights[this.borderWeight] || this.borderWeights.NORMAL;
        const iw = this.indicatorWeights[this.indicatorWeight] || this.indicatorWeights['2'];
        const font = this.fonts[this.font] || this.fonts.COURIER;
        root.style.setProperty('--ui-border-width', bw.width);
        root.style.setProperty('--ui-border-width-thin', bw.thin);
        root.style.setProperty('--ui-border-width-thick', bw.thick);
        root.style.setProperty('--ui-indicator-width', iw);
        root.style.setProperty('--ui-font-family', font);
        root.style.setProperty('--font-h1', `${this.fontSizes.h1}px`);
        root.style.setProperty('--font-h2', `${this.fontSizes.h2}px`);
        root.style.setProperty('--font-text', `${this.fontSizes.text}px`);
        root.style.setProperty('--font-base', `${this.fontSizes.text}px`);
        root.setAttribute('data-ui-controls', this.controlsHints === 'OFF' ? 'off' : 'on');

        const glow = this.fxLevels.glow[this.glow] || 0;
        const scan = this.fxLevels.scanlines[this.scanlines] || 0;
        const crt = this.fxLevels.crt[this.crt] || 0;
        const chroma = this.fxLevels.chroma[this.chroma] || 0;
        const arcadeOn = this.arcade === 'ON';
        const arcadeBoost = arcadeOn ? 1.55 : 1;
        const effectiveGlow = glow > 0
            ? glow * arcadeBoost
            : (arcadeOn ? 0.85 : 0);

        root.style.setProperty('--vf-glow', String(effectiveGlow));
        root.style.setProperty('--vf-scan', String(scan));
        root.style.setProperty('--vf-crt', String(crt));
        root.style.setProperty('--vf-chroma', String(chroma * arcadeBoost));

        const glowAttr = effectiveGlow > 0
            ? (this.glow === 'OFF' ? 'low' : this.glow.toLowerCase())
            : 'off';
        root.setAttribute('data-vf-glow', glowAttr);
        root.setAttribute('data-vf-scanlines', this.scanlines === 'OFF' ? 'off' : this.scanlines.toLowerCase());
        root.setAttribute('data-vf-crt', this.crt === 'OFF' ? 'off' : this.crt.toLowerCase());
        root.setAttribute('data-vf-chroma', this.chroma === 'OFF' ? 'off' : this.chroma.toLowerCase());
        root.setAttribute('data-vf-arcade', arcadeOn ? 'on' : 'off');

        this.ensureFxOverlay();
    }
}

const uiAppearanceManager = new UIAppearanceManager();
