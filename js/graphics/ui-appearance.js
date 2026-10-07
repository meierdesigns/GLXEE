"use strict";

/**
 * UI Appearance — border weight, typography, retro FX (independent of color themes).
 * Typography uses three types: H1, H2 Labels, Text.
 */
class UIAppearanceManager {
    constructor() {
        this.storageKey = 'vf_uiAppearance';
        this.borderWeights = {
            // Pixel look: even widths on the 2px grid. Within a weight every
            // contour token matches; each step up is clearly thicker.
            THIN: { width: '2px', thin: '2px', thick: '2px' },
            NORMAL: { width: '4px', thin: '4px', thick: '4px' },
            THICK: { width: '6px', thin: '6px', thick: '6px' },
            HEAVY: { width: '8px', thin: '8px', thick: '8px' }
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
        // Effect strength is any whole percent 0–100 (stored as 'N%' / 'OFF'); these
        // are the 100% values.
        this.fxMax = { glow: 2.2, scanlines: 1.0, crt: 1.25, chroma: 1.1 };
        this.fxLevels = {
            glow: fxSteps(2.2),
            scanlines: fxSteps(1.0),
            crt: fxSteps(1.25),
            chroma: fxSteps(1.1)
        };
        this.shipRenderStyles = ['FLAT', 'VOXEL'];
        // Shared combat lattice cell in logical playfield px (VOXEL mode).
        this.voxelSizeOptions = ['1', '2', '3', '4'];
        this.voxelSize = '1';
        // Per-class scale steps — wide gaps so S→XXL is obvious on the field.
        this.enemySizeScaleSteps = {
            S: 0.5,
            M: 0.85,
            L: 1.35,
            XL: 2.0,
            XXL: 2.9
        };
        this.enemyClassIds = ['scout', 'assault', 'heavy', 'elite', 'capital'];
        this.enemyClassSizes = {
            scout: 'L',
            assault: 'L',
            heavy: 'L',
            elite: 'L',
            capital: 'L'
        };
        // Shot size steps — wide gaps so S→XXL is obvious on the field.
        this.shotSizeScaleSteps = {
            S: 0.45,
            M: 0.7,
            L: 1,
            XL: 2.2,
            XXL: 3.6
        };
        this.shotSizeIds = ['player', 'enemy', 'boss'];
        this.shotSizes = {
            player: 'L',
            enemy: 'L',
            boss: 'L'
        };
        // Player hull size (independent of enemy class sizes).
        this.playerSizeScaleSteps = {
            S: 0.55,
            M: 0.8,
            L: 1,
            XL: 1.5,
            XXL: 2.1
        };
        this.playerSize = 'L';
        // Exact pixel sizes set from the SIZES overlay (override the S–XXL steps).
        // Keys: 'player', 'enemy:<class>', 'shot:<kind>'. Value = width in px.
        this.sizePx = {};
        // Shot speed per shooter, in percent of the weapon's own speed (SIZES overlay).
        this.shotSpeeds = { player: 100, enemy: 100, boss: 100 };
        this.shotSpeedRange = { min: 20, max: 300 };
        this.enemyBaseWidths = { scout: 36, assault: 48, heavy: 58, elite: 70, capital: 84 };
        this.shotRefWidth = 4;
        this.playerRefWidth = 18;
        this.sizePxRange = { min: 1, max: 200 };
        this.uiScaleOptions = ['50', '55', '60', '65', '70', '75', '80', '85', '90', '95', '100', '105', '110', '115', '120', '125'];
        this.borderWeight = 'NORMAL';
        this.indicatorWeight = '2';
        this.shipRenderStyle = 'VOXEL';
        this.voxelSize = '1';
        this.uiScale = '75';
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

    getVoxelSizeOptions() {
        return this.voxelSizeOptions.slice();
    }

    getVoxelSize() {
        const n = Number(this.voxelSize);
        return Number.isFinite(n) && n > 0 ? n : 1;
    }

    setVoxelSize(size) {
        const key = String(size || '');
        if (this.voxelSizeOptions.indexOf(key) === -1) return;
        this.voxelSize = key;
        this.persist();
        this.apply();
        if (typeof graphicsManager !== 'undefined' && graphicsManager._voxelShipBake) {
            graphicsManager._voxelShipBake = Object.create(null);
        }
    }

    getEnemySizeOptions() {
        return Object.keys(this.enemySizeScaleSteps);
    }

    getEnemyClassSize(enemyClass) {
        const cls = String(enemyClass || 'assault').toLowerCase();
        return this.enemyClassSizes[cls] || 'L';
    }

    getEnemySizeMul(enemyClass) {
        const px = this.sizePx['enemy:' + String(enemyClass || 'assault').toLowerCase()];
        if (px > 0) return px / (this.enemyBaseWidths[String(enemyClass || 'assault').toLowerCase()] || 48);
        const step = this.getEnemyClassSize(enemyClass);
        const mul = this.enemySizeScaleSteps[step];
        return Number.isFinite(mul) ? mul : 1.35;
    }

    getShotSizeOptions() {
        return Object.keys(this.shotSizeScaleSteps);
    }

    getShotSize(kind) {
        const id = String(kind || 'player').toLowerCase();
        return this.shotSizes[id] || 'L';
    }

    getShotSizeMul(kind) {
        const px = this.sizePx['shot:' + String(kind || 'player').toLowerCase()];
        if (px > 0) return px / this.shotRefWidth;
        const step = this.getShotSize(kind);
        const mul = this.shotSizeScaleSteps[step];
        return Number.isFinite(mul) ? mul : 1;
    }

    getPlayerSizeOptions() {
        return Object.keys(this.playerSizeScaleSteps);
    }

    getPlayerSize() {
        return this.playerSize || 'L';
    }

    getPlayerSizeMul() {
        if (this.sizePx.player > 0) return this.sizePx.player / this.playerRefWidth;
        const mul = this.playerSizeScaleSteps[this.getPlayerSize()];
        return Number.isFinite(mul) ? mul : 1;
    }

    /** Current width in px for an overlay row (kind: 'player' | 'enemy' | 'shot'). */
    getSizePx(kind, id) {
        if (kind === 'player') return Math.round(this.playerRefWidth * this.getPlayerSizeMul() * 10) / 10;
        if (kind === 'shot') return Math.round(this.shotRefWidth * this.getShotSizeMul(id) * 10) / 10;
        const cls = String(id || 'assault').toLowerCase();
        return Math.round((this.enemyBaseWidths[cls] || 48) * this.getEnemySizeMul(cls) * 10) / 10;
    }

    setSizePx(kind, id, px) {
        const v = Math.max(this.sizePxRange.min, Math.min(this.sizePxRange.max, Number(px)));
        if (!(v > 0)) return;
        if (kind === 'player') {
            this.sizePx.player = v;
            this.persist();
            this.applyPlayerSize();
        } else if (kind === 'shot') {
            this.sizePx['shot:' + String(id).toLowerCase()] = v;
            this.persist();
        } else {
            this.sizePx['enemy:' + String(id).toLowerCase()] = v;
            this.persist();
            if (typeof enemyManager !== 'undefined' && enemyManager.refreshEnemySizes) {
                enemyManager.refreshEnemySizes();
            }
        }
    }

    getShotSpeedPct(kind) {
        const v = Number(this.shotSpeeds[String(kind || 'enemy').toLowerCase()]);
        return Number.isFinite(v) && v > 0 ? v : 100;
    }

    getShotSpeedMul(kind) {
        return this.getShotSpeedPct(kind) / 100;
    }

    setShotSpeedPct(kind, pct) {
        const id = String(kind || '').toLowerCase();
        if (!(id in this.shotSpeeds)) return;
        const v = Math.round(Math.max(this.shotSpeedRange.min, Math.min(this.shotSpeedRange.max, Number(pct))));
        if (!(v > 0)) return;
        this.shotSpeeds[id] = v;
        this.persist();
    }

    getUiScaleOptions() {
        return this.uiScaleOptions.slice();
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

    /** Whole percent 0–100 of a glow/scanlines/crt/chroma effect. */
    getFxPercent(fxKey) {
        const m = /^(\d+)%$/.exec(String(this[fxKey] || ''));
        return m ? Math.max(0, Math.min(100, Number(m[1]))) : 0;
    }

    fxLevel(fxKey) {
        return (this.fxMax[fxKey] || 0) * this.getFxPercent(fxKey) / 100;
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
            if (data.voxelSize != null && this.voxelSizeOptions.indexOf(String(data.voxelSize)) !== -1) {
                this.voxelSize = String(data.voxelSize);
            }
            // Migrate legacy single enemySize → all five classes.
            if (data.enemySize && this.enemySizeScaleSteps[data.enemySize]) {
                this.enemyClassIds.forEach((cls) => {
                    this.enemyClassSizes[cls] = data.enemySize;
                });
            }
            if (data.enemyClassSizes && typeof data.enemyClassSizes === 'object') {
                this.enemyClassIds.forEach((cls) => {
                    const step = String(data.enemyClassSizes[cls] || '').toUpperCase();
                    if (this.enemySizeScaleSteps[step]) this.enemyClassSizes[cls] = step;
                });
            }
            if (data.shotSizes && typeof data.shotSizes === 'object') {
                this.shotSizeIds.forEach((id) => {
                    const step = String(data.shotSizes[id] || '').toUpperCase();
                    if (this.shotSizeScaleSteps[step]) this.shotSizes[id] = step;
                });
            } else if (data.shotSize && this.shotSizeScaleSteps[String(data.shotSize).toUpperCase()]) {
                const legacy = String(data.shotSize).toUpperCase();
                this.shotSizeIds.forEach((id) => { this.shotSizes[id] = legacy; });
            }
            if (data.playerSize && this.playerSizeScaleSteps[String(data.playerSize).toUpperCase()]) {
                this.playerSize = String(data.playerSize).toUpperCase();
            }
            if (data.shotSpeeds && typeof data.shotSpeeds === 'object') {
                Object.keys(this.shotSpeeds).forEach((id) => {
                    const v = Number(data.shotSpeeds[id]);
                    if (Number.isFinite(v) && v >= this.shotSpeedRange.min && v <= this.shotSpeedRange.max) this.shotSpeeds[id] = Math.round(v);
                });
            }
            if (data.sizePx && typeof data.sizePx === 'object') {
                Object.keys(data.sizePx).forEach((k) => {
                    const v = Number(data.sizePx[k]);
                    if (v > 0) this.sizePx[k] = v;
                });
            }
            const uiScale = String(data.uiScale || '');
            if (this.uiScaleOptions.includes(uiScale)) {
                this.uiScale = uiScale;
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
                const pct = /^(\d+)%$/.exec(val);
                if (this.fxLevels[key] && pct) {
                    const n = Math.max(0, Math.min(100, Number(pct[1])));
                    this[key] = n > 0 ? `${n}%` : 'OFF';
                } else if (this.fxLevels[key] && val === 'OFF') {
                    this[key] = 'OFF';
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
                voxelSize: this.voxelSize,
                enemyClassSizes: Object.assign({}, this.enemyClassSizes),
                shotSizes: Object.assign({}, this.shotSizes),
                playerSize: this.playerSize,
                sizePx: Object.assign({}, this.sizePx),
                shotSpeeds: Object.assign({}, this.shotSpeeds),
                uiScale: this.uiScale,
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
        this.apply();
    }

    setEnemyClassSize(enemyClass, size) {
        const cls = String(enemyClass || '').toLowerCase();
        const val = String(size || '').toUpperCase();
        if (!this.enemyClassSizes[cls] || !this.enemySizeScaleSteps[val]) return;
        this.enemyClassSizes[cls] = val;
        delete this.sizePx['enemy:' + cls];
        this.persist();
        if (typeof enemyManager !== 'undefined' && enemyManager.refreshEnemySizes) {
            enemyManager.refreshEnemySizes();
        }
    }

    setShotSize(kind, size) {
        const id = String(kind || '').toLowerCase();
        const val = String(size || '').toUpperCase();
        if (!this.shotSizes[id] || !this.shotSizeScaleSteps[val]) return;
        this.shotSizes[id] = val;
        delete this.sizePx['shot:' + id];
        this.persist();
    }

    setPlayerSize(size) {
        const val = String(size || '').toUpperCase();
        if (!this.playerSizeScaleSteps[val]) return;
        this.playerSize = val;
        delete this.sizePx.player;
        this.persist();
        this.applyPlayerSize();
    }

    applyPlayerSize() {
        if (typeof playerManager !== 'undefined' && playerManager.applyFixedFootprint) {
            const p = playerManager.player;
            const cx = p ? p.x + p.width / 2 : null;
            const cy = p ? p.y + p.height / 2 : null;
            playerManager.applyFixedFootprint();
            if (p && cx != null) {
                p.x = cx - p.width / 2;
                p.y = cy - p.height / 2;
                if (typeof game !== 'undefined' && game) {
                    const W = game.internalWidth || game.baseWidth || 200;
                    const H = game.internalHeight || game.baseHeight || 300;
                    p.x = Math.max(0, Math.min(W - p.width, p.x));
                    p.y = Math.max(p.minY || 0, Math.min((p.maxY != null ? p.maxY : H - p.height), p.y));
                    p.maxY = H - p.height;
                }
            }
        }
    }

    setUiScale(scale) {
        const value = String(scale || '');
        if (!this.uiScaleOptions.includes(value)) return;
        this.uiScale = value;
        this.persist();
        this.apply();
        if (window.viewportFit && typeof window.viewportFit.scheduleUpdate === 'function') {
            window.viewportFit.scheduleUpdate();
        }
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
        if (!this.fxLevels[key]) return;
        const pct = /^(\d+)%?$/.exec(val);
        if (pct) {
            const n = Math.max(0, Math.min(100, Number(pct[1])));
            this[key] = n > 0 ? `${n}%` : 'OFF';
        } else if (val === 'OFF') {
            this[key] = 'OFF';
        } else {
            return;
        }
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
            '<div class="vf-fx-chroma"></div>',
            // Channel-split filter for the chroma layer's backdrop: red and blue
            // are shifted apart horizontally (see apply()), green stays put.
            '<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><filter id="vfChromaFx" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">' +
                '<feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r"/>' +
                '<feOffset id="vfChromaR" in="r" dx="0" dy="0" result="ro"/>' +
                '<feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g"/>' +
                '<feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b"/>' +
                '<feOffset id="vfChromaB" in="b" dx="0" dy="0" result="bo"/>' +
                '<feBlend in="ro" in2="g" mode="screen" result="rg"/>' +
                '<feBlend in="rg" in2="bo" mode="screen"/>' +
            '</filter></svg>',
            // CRT pixel warp: a fine noise map at roughly the phosphor-cell size
            // (~9x6 px) displaces the picture, so it ripples and bends in pixel-sized
            // steps (strength set in apply()).
            '<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><filter id="vfCrtFx" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">' +
                '<feTurbulence type="fractalNoise" baseFrequency="0.11 0.17" numOctaves="1" seed="3" result="map"/>' +
                '<feDisplacementMap id="vfCrtDisp" in="SourceGraphic" in2="map" scale="0" xChannelSelector="R" yChannelSelector="G"/>' +
            '</filter></svg>',
            '<div class="vf-fx-crt"></div>',
            '<div class="vf-fx-scanlines"></div>'
        ].join('');
        document.body.appendChild(el);
        return el;
    }

    apply() {
        const root = document.documentElement;
        const bw = this.borderWeights[this.borderWeight] || this.borderWeights.NORMAL;
        const font = this.fonts[this.font] || this.fonts.COURIER;
        // One stroke size everywhere — weight never mixes thin/thick contours.
        const stroke = bw.width || '2px';
        root.style.setProperty('--ui-border-width', stroke);
        root.style.setProperty('--ui-border-width-thin', stroke);
        root.style.setProperty('--ui-border-width-thick', stroke);
        // Selection/indicator strokes follow the same contour weight.
        root.style.setProperty('--ui-indicator-width', stroke);
        root.style.setProperty('--ui-font-family', font);
        root.style.setProperty('--gui-zoom', String(Number(this.uiScale) / 100));
        root.style.setProperty('--font-h1', `${this.fontSizes.h1}px`);
        root.style.setProperty('--font-h2', `${this.fontSizes.h2}px`);
        root.style.setProperty('--font-text', `${this.fontSizes.text}px`);
        root.style.setProperty('--font-base', `${this.fontSizes.text}px`);
        root.setAttribute('data-ui-controls', this.controlsHints === 'OFF' ? 'off' : 'on');

        const glow = this.fxLevel('glow');
        const scan = this.fxLevel('scanlines');
        const crt = this.fxLevel('crt');
        const chroma = this.fxLevel('chroma');
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
        root.setAttribute('data-vf-ship-render', String(this.shipRenderStyle || 'FLAT').toUpperCase());
        root.setAttribute('data-vf-voxel-size', String(this.getVoxelSize()));
        // One shared lattice for the whole playfield (ships, terrain, FX…).
        window.PLAYFIELD_VOXEL_CELL = this.getVoxelSize();
        if (typeof window.viewportFit !== 'undefined' && window.viewportFit.scheduleUpdate) {
            window.viewportFit.scheduleUpdate();
        }

        this.ensureFxOverlay();
        // Chroma = real channel split: up to ~5 px red/blue offset at full strength.
        const shift = Math.round(chroma * arcadeBoost * 4.5 * 10) / 10;
        const r = document.getElementById('vfChromaR');
        const b = document.getElementById('vfChromaB');
        const crtDisp = document.getElementById('vfCrtDisp');
        if (crtDisp) crtDisp.setAttribute('scale', String(Math.round(crt * 7 * 10) / 10));
        if (r) { r.setAttribute('dx', String(shift)); r.setAttribute('dy', String(shift * 0.25)); }
        if (b) { b.setAttribute('dx', String(-shift)); b.setAttribute('dy', String(-shift * 0.25)); }
    }
}

const uiAppearanceManager = new UIAppearanceManager();
