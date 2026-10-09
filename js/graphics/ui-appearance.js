"use strict";

/**
 * UI Appearance — border weight, typography, retro FX (independent of color themes).
 * Typography uses three sizes: LG (titles), MD (values), SM (labels).
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
            text: ['8', '9', '10', '11', '12', '14', '16', '18'],
            small: ['7', '8', '9', '10', '11', '12'],
            // In-game HUD: size in % of the menu sizes.
            game: ['70', '85', '100', '115', '130', '150']
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
        this.fxMax = { glow: 2.2, scanlines: 1.0, crt: 1.25, chroma: 1.1, vignette: 1.0, noise: 1.0, flicker: 1.0, bloom: 1.0, bloomSpread: 1.0, bloomThreshold: 1.0, hdr: 1.0 };
        this.fxLevels = {
            glow: fxSteps(2.2),
            scanlines: fxSteps(1.0),
            crt: fxSteps(1.25),
            chroma: fxSteps(1.1),
            vignette: fxSteps(1.0),
            noise: fxSteps(1.0),
            flicker: fxSteps(1.0),
            bloom: fxSteps(1.0),
            bloomSpread: fxSteps(1.0),
            bloomThreshold: fxSteps(1.0),
            hdr: fxSteps(1.0)
        };
        this.shipRenderStyles = ['FLAT', 'VOXEL'];
        // Shared combat lattice cell in logical playfield px (VOXEL mode).
        // Below 1 = finer than the old minimum ('0.5' is twice as fine as '1').
        this.voxelSizeOptions = ['0.25', '0.5', '0.75', '1', '2', '3', '4', '5', '6', '7', '8'];
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
        // 3 sizes: lg (h1) / md (h2+text) / sm (small)
        this.fontSizes = {
            h1: '20',
            h2: '14',
            text: '14',
            small: '11',
            game: '100'
        };
        // Per-size family override ('GLOBAL' follows the main font).
        this.fontFamilies = { h1: 'GLOBAL', h2: 'GLOBAL', text: 'GLOBAL', small: 'GLOBAL', game: 'GLOBAL' };
        this.controlsHints = 'ON';
        this.glow = 'OFF';
        this.scanlines = 'OFF';
        this.crt = 'OFF';
        this.chroma = 'OFF';
        this.vignette = 'OFF';
        this.noise = 'OFF';
        this.flicker = 'OFF';
        this.bloom = 'OFF';
        this.bloomSpread = 'OFF';
        this.bloomThreshold = 'OFF';
        this.hdr = 'OFF';
        this.arcade = 'OFF';
        // Where the FX overlay shows: inside the screen, on the frame outside it, or both.
        this.fxArea = 'SCREEN';
        // Pixel-lattice GUI lines (independent of the ship render style).
        this.guiVoxel = 'ON';
        // GUI voxel tuning: lattice cell (AUTO follows Voxel Size) and which parts it affects.
        this.guiVoxelCell = 'AUTO';
        // Pixel grid (px) for the frame outside the screen; OFF = smooth.
        this.framePx = 'OFF';
        // Corner radius of the pixel frame's screen opening, in grid cells.
        this.frameRound = '3';
        this.guiVoxelParts = { lines: 'ON', corners: 'ON', text: 'ON', images: 'ON', svg: 'ON' };
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
        if (fxKey === 'arcade' || fxKey === 'guiVoxel') return ['OFF', 'ON'];
        if (fxKey === 'frameRound') return ['0', '1', '2', '3', '4', '5', '6', '7', '8'];
        if (fxKey === 'framePx') return ['OFF', '3', '5', '7', '9', '13', '17'];
        if (fxKey === 'gvCell') return ['AUTO', '1', '2', '3', '4', '5', '6', '7', '8'];
        if (this.gvPartKey(fxKey)) return ['OFF', 'ON'];
        if (fxKey === 'fxArea') return ['SCREEN', 'FRAME', 'ALL'];
        return this.fxLevels[fxKey] ? Object.keys(this.fxLevels[fxKey]) : ['OFF'];
    }

    /** 'gvCorners' -> 'corners' for the GUI-voxel part toggles, else ''. */
    gvPartKey(fxKey) {
        const m = /^gv(Lines|Corners|Text|Images|Svg)$/.exec(String(fxKey));
        return m ? m[1].toLowerCase() : '';
    }

    /** Fx keys that are choice rows (cycle options) rather than 0–100 sliders. */
    isEnumFx(fxKey) {
        return fxKey === 'arcade' || fxKey === 'guiVoxel' || fxKey === 'fxArea'
            || fxKey === 'gvCell' || fxKey === 'framePx' || fxKey === 'frameRound' || !!this.gvPartKey(fxKey);
    }

    getGuiVoxelCell() {
        // The GUI lattice stays on whole pixels even when the ship voxels go finer than 1.
        return this.guiVoxelCell === 'AUTO' ? Math.max(1, this.getVoxelSize()) : Number(this.guiVoxelCell);
    }

    getFxValue(fxKey) {
        if (fxKey === 'gvCell') return this.guiVoxelCell;
        if (fxKey === 'framePx') return this.framePx;
        if (fxKey === 'frameRound') return this.frameRound;
        if (this.gvPartKey(fxKey)) return this.guiVoxelParts[this.gvPartKey(fxKey)];
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
                ['h1', 'h2', 'text', 'small', 'game'].forEach((key) => {
                    const val = String(data.fontSizes[key] || '');
                    if (this.fontSizeOptions[key].includes(val)) {
                        this.fontSizes[key] = val;
                    }
                });
            }
            if (data.fontFamilies && typeof data.fontFamilies === 'object') {
                Object.keys(this.fontFamilies).forEach((key) => {
                    const f = data.fontFamilies[key];
                    if (f === 'GLOBAL' || this.fonts[f]) this.fontFamilies[key] = f;
                });
            }
            if (data.controlsHints === 'ON' || data.controlsHints === 'OFF') {
                this.controlsHints = data.controlsHints;
            }
            ['glow', 'scanlines', 'crt', 'chroma', 'vignette', 'noise', 'flicker', 'bloom', 'bloomSpread', 'bloomThreshold', 'hdr'].forEach((key) => {
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
            if (data.guiVoxelCell === 'AUTO' || /^[1-8]$/.test(String(data.guiVoxelCell))) {
                this.guiVoxelCell = String(data.guiVoxelCell);
            }
            if (data.guiVoxelParts && typeof data.guiVoxelParts === 'object') {
                Object.keys(this.guiVoxelParts).forEach((k) => {
                    if (data.guiVoxelParts[k] === 'ON' || data.guiVoxelParts[k] === 'OFF') this.guiVoxelParts[k] = data.guiVoxelParts[k];
                });
            }
            if (data.framePx === 'OFF' || /^(3|5|7|9|13|17)$/.test(String(data.framePx))) {
                this.framePx = String(data.framePx);
            }
            if (/^[0-8]$/.test(String(data.frameRound))) this.frameRound = String(data.frameRound);
            if (data.guiVoxel === 'ON' || data.guiVoxel === 'OFF') {
                this.guiVoxel = data.guiVoxel;
            }
            if (['ALL', 'SCREEN', 'FRAME'].indexOf(data.fxArea) !== -1) {
                this.fxArea = data.fxArea;
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
                fontFamilies: this.fontFamilies,
                controlsHints: this.controlsHints,
                glow: this.glow,
                scanlines: this.scanlines,
                crt: this.crt,
                chroma: this.chroma,
                vignette: this.vignette,
                noise: this.noise,
                flicker: this.flicker,
                bloom: this.bloom,
                bloomSpread: this.bloomSpread,
                bloomThreshold: this.bloomThreshold,
                hdr: this.hdr,
                arcade: this.arcade,
                fxArea: this.fxArea,
                guiVoxel: this.guiVoxel,
                guiVoxelCell: this.guiVoxelCell,
                framePx: this.framePx,
                frameRound: this.frameRound,
                guiVoxelParts: Object.assign({}, this.guiVoxelParts)
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

    getFontFamilyOptions() {
        return ['GLOBAL'].concat(Object.keys(this.fonts));
    }

    setFontFamily(type, fontId) {
        if (!this.fontFamilies[type]) return;
        if (fontId !== 'GLOBAL' && !this.fonts[fontId]) return;
        this.fontFamilies[type] = fontId;
        this.persist();
        this.apply();
    }

    setFontSize(type, size) {
        const val = String(size);
        if (!this.fontSizeOptions[type] || !this.fontSizeOptions[type].includes(val)) return;
        this.fontSizes[type] = val;
        // md is shared: changing h2 or text keeps both in sync (3-size scale).
        if (type === 'h2' || type === 'text') {
            this.fontSizes.h2 = val;
            this.fontSizes.text = val;
        }
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

    setGuiVoxel(value) {
        const val = String(value || '').toUpperCase();
        if (val !== 'ON' && val !== 'OFF') return;
        this.guiVoxel = val;
        this.persist();
        this.apply();
    }

    setFxArea(area) {
        const val = String(area || '').toUpperCase();
        if (['ALL', 'SCREEN', 'FRAME'].indexOf(val) === -1) return;
        this.fxArea = val;
        this.persist();
        this.applyFxArea();
    }

    /** Screen opening rect via an invisible probe (the frame's own hole elements can collapse to 0x0). */
    measureScreenOpening() {
        const bezel = document.getElementById('vf-bezel');
        if (!bezel) return null;
        let probe = document.getElementById('vfFxProbe');
        if (!probe) {
            probe = document.createElement('b');
            probe.id = 'vfFxProbe';
            probe.setAttribute('aria-hidden', 'true');
            probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;'
                + 'left:var(--fr-ol);right:var(--fr-or);top:var(--fr-ot);bottom:var(--fr-ob);border-radius:var(--fr-hole-r)';
            bezel.appendChild(probe);
        }
        const r = probe.getBoundingClientRect();
        if (!r.width || !r.height) return null;
        return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width,
            radius: Math.max(0, parseFloat(getComputedStyle(probe).borderTopLeftRadius) || 0) };
    }

    /** Clip the FX overlay to the screen opening (inside), the frame (outside) or nothing (all). */
    applyFxArea() {
        const ov = document.getElementById('vfFxOverlay');
        if (!ov) return;
        // Clip each layer, not the container: a clip-path on the container becomes a
        // backdrop root and the layers' backdrop-filters (chroma/bloom/HDR/CRT) would see nothing.
        const layers = ov.children;
        const setClip = (v) => {
            for (let i = 0; i < layers.length; i++) layers[i].style.clipPath = v;
        };
        ov.style.clipPath = '';
        const r = this.measureScreenOpening();
        const rad = r ? r.radius : 0;
        if (this.fxArea === 'ALL' || !r || !r.width) {
            setClip('');
            return;
        }
        const W = window.innerWidth, H = window.innerHeight;
        const x1 = Math.round(r.left), y1 = Math.round(r.top);
        const x2 = Math.round(r.right), y2 = Math.round(r.bottom);
        setClip(this.fxArea === 'SCREEN'
            ? `inset(${y1}px ${W - x2}px ${H - y2}px ${x1}px round ${rad}px)`
            : `polygon(evenodd, 0 0, ${W}px 0, ${W}px ${H}px, 0 ${H}px, 0 0, ${x1}px ${y1}px, ${x1}px ${y2}px, ${x2}px ${y2}px, ${x2}px ${y1}px, ${x1}px ${y1}px)`);
    }

    setFx(fxKey, value) {
        const key = String(fxKey || '');
        const val = String(value || '').toUpperCase();
        if (key === 'guiVoxel') return this.setGuiVoxel(val);
        if (key === 'frameRound') {
            if (!this.getFxOptions('frameRound').includes(val)) return;
            this.frameRound = val;
            this.persist();
            this.apply();
            return;
        }
        if (key === 'framePx') {
            if (val !== 'OFF' && !this.getFxOptions('framePx').includes(val)) return;
            this.framePx = val;
            this.persist();
            this.apply();
            return;
        }
        if (key === 'gvCell') {
            if (val !== 'AUTO' && !/^[1-8]$/.test(val)) return;
            this.guiVoxelCell = val;
            this.persist();
            this.apply();
            return;
        }
        if (this.gvPartKey(key)) {
            if (val !== 'ON' && val !== 'OFF') return;
            this.guiVoxelParts[this.gvPartKey(key)] = val;
            this.persist();
            this.apply();
            return;
        }
        if (key === 'fxArea') return this.setFxArea(val);
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

    /** SVG pixelate filter: one sample per c x c block, then dilated back to full blocks. */
    /** SVG pixelate + top-left light filter (built by the boot script in index.html). */
    ensureFramePxFilter(c) {
        const odd = Math.floor(c / 2) * 2 + 1;
        if (this._framePxBuilt === odd && document.getElementById('vfFramePx')) return;
        if (typeof window.vfBuildFramePxFilter === 'function') window.vfBuildFramePxFilter(odd);
        this._framePxBuilt = odd;
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
            // Bloom: only pixels above the cut-off glow. Threshold -> blur -> gain -> added to the picture.
            '<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><filter id="vfBloomFx" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">' +
                '<feComponentTransfer in="SourceGraphic" result="bright"><feFuncR id="vfBloomTR" type="linear" slope="3" intercept="-1"/><feFuncG id="vfBloomTG" type="linear" slope="3" intercept="-1"/><feFuncB id="vfBloomTB" type="linear" slope="3" intercept="-1"/></feComponentTransfer>' +
                '<feGaussianBlur id="vfBloomBlur" in="bright" stdDeviation="6" result="soft"/>' +
                '<feComponentTransfer in="soft" result="glow"><feFuncR id="vfBloomGR" type="linear" slope="1"/><feFuncG id="vfBloomGG" type="linear" slope="1"/><feFuncB id="vfBloomGB" type="linear" slope="1"/></feComponentTransfer>' +
                '<feComposite in="SourceGraphic" in2="glow" operator="arithmetic" k1="0" k2="1" k3="1" k4="0"/>' +
            '</filter></svg>',
            '<div class="vf-fx-hdr"></div>',
            '<div class="vf-fx-hdr-shadow"></div>',
            '<div class="vf-fx-bloom"></div>',
            '<div class="vf-fx-crt"></div>',
            '<div class="vf-fx-scanlines"></div>',
            '<div class="vf-fx-vignette"></div>',
            '<div class="vf-fx-noise"></div>',
            '<div class="vf-fx-flicker"></div>'
        ].join('');
        // On <html>, not <body>: the body is scaled/offset by the stage fit, which would skew the overlay and its clip.
        document.documentElement.appendChild(el);
        return el;
    }

    apply() {
        const root = document.documentElement;
        const bw = this.borderWeights[this.borderWeight] || this.borderWeights.NORMAL;
        const font = this.fonts[this.font] || this.fonts.COURIER;
        // One stroke size everywhere — weight never mixes thin/thick contours.
        let stroke = bw.width || '2px';
        // VOXEL: GUI contours sit on the same lattice as the playfield.
        if (this.guiVoxel === 'ON') {
            const cell = this.getGuiVoxelCell();
            if (this.guiVoxelParts.lines === 'ON') {
                const steps = Math.max(1, Math.round(parseFloat(stroke) / cell));
                stroke = (steps * cell) + 'px';
            }
            root.style.setProperty('--ui-voxel', cell + 'px');
        }
        root.style.setProperty('--ui-border-width', stroke);
        root.style.setProperty('--ui-border-width-thin', stroke);
        root.style.setProperty('--ui-border-width-thick', stroke);
        // Selection/indicator strokes follow the same contour weight.
        root.style.setProperty('--ui-indicator-width', stroke);
        root.style.setProperty('--ui-font-family', font);
        root.style.setProperty('--gui-zoom', String(Number(this.uiScale) / 100));
        // 3-size scale: lg=h1, md=h2 (+ text alias), sm=small
        this.fontSizes.text = this.fontSizes.h2;
        const lgPx = Number(this.fontSizes.h1) || 20;
        const mdPx = Number(this.fontSizes.h2) || 14;
        const smPx = Number(this.fontSizes.small) || 11;
        root.style.setProperty('--font-lg', lgPx + 'px');
        root.style.setProperty('--font-md', mdPx + 'px');
        root.style.setProperty('--font-sm', smPx + 'px');
        root.style.setProperty('--font-h1', lgPx + 'px');
        root.style.setProperty('--font-h2', mdPx + 'px');
        root.style.setProperty('--font-text', mdPx + 'px');
        root.style.setProperty('--font-small', smPx + 'px');
        root.style.setProperty('--font-text-small', smPx + 'px');
        Object.keys(this.fontFamilies).forEach((k) => {
            const id = this.fontFamilies[k];
            root.style.setProperty('--ui-font-' + k, id === 'GLOBAL' ? font : (this.fonts[id] || font));
        });
        root.style.setProperty('--ui-font-lg', root.style.getPropertyValue('--ui-font-h1') || font);
        root.style.setProperty('--ui-font-md', root.style.getPropertyValue('--ui-font-h2') || font);
        root.style.setProperty('--ui-font-sm', root.style.getPropertyValue('--ui-font-small') || font);
        root.style.setProperty('--font-base', mdPx + 'px');
        // In-game HUD: menu sizes × IN-GAME % (see .game-container in styles.css).
        const gk = Number(this.fontSizes.game) / 100 || 1;
        const gfam = this.fontFamilies.game;
        root.style.setProperty('--game-font-family', gfam === 'GLOBAL' ? font : (this.fonts[gfam] || font));
        const gLg = (lgPx * gk).toFixed(1) + 'px';
        const gMd = (mdPx * gk).toFixed(1) + 'px';
        const gSm = (smPx * gk).toFixed(1) + 'px';
        root.style.setProperty('--game-font-lg', gLg);
        root.style.setProperty('--game-font-md', gMd);
        root.style.setProperty('--game-font-sm', gSm);
        root.style.setProperty('--game-font-h1', gLg);
        root.style.setProperty('--game-font-h2', gMd);
        root.style.setProperty('--game-font-text', gMd);
        root.style.setProperty('--game-font-small', gSm);
        root.setAttribute('data-game-font', gfam === 'GLOBAL' ? 'global' : 'custom');
        root.setAttribute('data-ui-controls', this.controlsHints === 'OFF' ? 'off' : 'on');

        const glow = this.fxLevel('glow');
        const scan = this.fxLevel('scanlines');
        const crt = this.fxLevel('crt');
        const chroma = this.fxLevel('chroma');
        const arcadeOn = this.arcade === 'ON';
        const effectiveGlow = glow;

        root.style.setProperty('--vf-glow', String(effectiveGlow));
        root.style.setProperty('--vf-scan', String(scan));
        root.style.setProperty('--vf-crt', String(crt));
        root.style.setProperty('--vf-chroma', String(chroma));
        root.style.setProperty('--vf-vignette', String(this.fxLevel('vignette')));
        root.style.setProperty('--vf-noise', String(this.fxLevel('noise')));
        root.style.setProperty('--vf-flicker', String(this.fxLevel('flicker')));
        root.style.setProperty('--vf-bloom', String(this.fxLevel('bloom')));
        root.style.setProperty('--vf-bloom-spread', String(this.fxLevel('bloomSpread')));
        root.style.setProperty('--vf-bloom-thr', String(this.fxLevel('bloomThreshold')));
        root.style.setProperty('--vf-hdr', String(this.fxLevel('hdr')));
        root.setAttribute('data-vf-hdr', this.hdr === 'OFF' ? 'off' : 'on');

        const glowAttr = effectiveGlow > 0
            ? (this.glow === 'OFF' ? 'low' : this.glow.toLowerCase())
            : 'off';
        root.setAttribute('data-vf-glow', glowAttr);
        root.setAttribute('data-vf-scanlines', this.scanlines === 'OFF' ? 'off' : this.scanlines.toLowerCase());
        root.setAttribute('data-vf-crt', this.crt === 'OFF' ? 'off' : this.crt.toLowerCase());
        ['vignette', 'noise', 'flicker', 'bloom'].forEach((k) => {
            root.setAttribute('data-vf-' + k, this[k] === 'OFF' ? 'off' : 'on');
        });
        root.setAttribute('data-vf-chroma', this.chroma === 'OFF' ? 'off' : this.chroma.toLowerCase());
        root.setAttribute('data-vf-arcade', arcadeOn ? 'on' : 'off');
        root.setAttribute('data-vf-ship-render', String(this.shipRenderStyle || 'FLAT').toUpperCase());
        Object.keys(this.guiVoxelParts).forEach((k) => {
            root.setAttribute('data-vf-gv-' + k, this.guiVoxelParts[k] === 'ON' ? 'on' : 'off');
        });
        root.setAttribute('data-vf-frame-px', this.framePx === 'OFF' ? 'off' : 'on');
        if (this.framePx !== 'OFF') {
            this.ensureFramePxFilter(Number(this.framePx));
            // Odd cell actually used by the filter; frame bands are widened to at least one cell.
            const odd = Math.floor(Number(this.framePx) / 2) * 2 + 1;
            root.style.setProperty('--fr-px', odd + 'px');
            const rad = odd * 2 * Number(this.frameRound);
            root.style.setProperty('--fr-rad', rad + 'px');
            // Outer corner radius of the whole frame: concentric with the opening (+ band width).
            root.style.setProperty('--fr-out', (rad > 0 ? rad + odd * 3 : 0) + 'px');
        } else {
            root.style.removeProperty('--fr-px');
            root.style.removeProperty('--fr-rad');
            root.style.removeProperty('--fr-out');
        }
        root.setAttribute('data-vf-gui-voxel', this.guiVoxel === 'ON' ? 'on' : 'off');
        root.setAttribute('data-vf-voxel-size', String(this.getVoxelSize()));
        // One shared lattice for the whole playfield (ships, terrain, FX…).
        window.PLAYFIELD_VOXEL_CELL = this.getVoxelSize();
        if (typeof window.viewportFit !== 'undefined' && window.viewportFit.scheduleUpdate) {
            window.viewportFit.scheduleUpdate();
        }

        this.ensureFxOverlay();
        this.applyFxArea();
        if (!this._fxAreaBound) {
            this._fxAreaBound = true;
            const refit = () => this.applyFxArea();
            window.addEventListener('resize', refit);
            if (window.ResizeObserver) {
                const ro = new ResizeObserver(refit);
                ['#vf-bezel', 'body'].forEach((sel) => {
                    const el = document.querySelector(sel);
                    if (el) ro.observe(el);
                });
            }
            // Bezel size settles after boot / layout changes: re-measure a few times.
            [50, 300, 1000, 2500].forEach((ms) => setTimeout(refit, ms));
        }
        requestAnimationFrame(() => this.applyFxArea());
        // Chroma = real channel split: up to ~5 px red/blue offset at full strength.
        const isVoxel = String(this.shipRenderStyle).toUpperCase() === 'VOXEL';
        // VOXEL keeps whole-pixel offsets so the lattice stays crisp.
        const shift = isVoxel ? Math.round(chroma * 4.5) : Math.round(chroma * 4.5 * 10) / 10;
        const r = document.getElementById('vfChromaR');
        const b = document.getElementById('vfChromaB');
        const crtDisp = document.getElementById('vfCrtDisp');
        // Bloom values: cut-off 0.25..0.85, glow width 1..30 px, strength up to x3.
        const thr = 0.25 + 0.6 * this.fxLevel('bloomThreshold');
        const bs = document.getElementById('vfBloomBlur');
        if (bs) bs.setAttribute('stdDeviation', String(Math.round((1 + 29 * this.fxLevel('bloomSpread')) * 10) / 10));
        ['R', 'G', 'B'].forEach((c) => {
            const t = document.getElementById('vfBloomT' + c);
            if (t) { t.setAttribute('slope', String(1 / (1 - thr))); t.setAttribute('intercept', String(-thr / (1 - thr))); }
            const g = document.getElementById('vfBloomG' + c);
            if (g) g.setAttribute('slope', String(Math.round(3 * this.fxLevel('bloom') * 100) / 100));
        });
        // No pixel warp: displacement made the whole screen ripple and
        // smashed HUD / playfield text. CRT look stays via phosphor + contrast only.
        if (crtDisp) crtDisp.setAttribute('scale', '0');
        if (r) { r.setAttribute('dx', String(shift)); r.setAttribute('dy', String(shift * 0.25)); }
        if (b) { b.setAttribute('dx', String(-shift)); b.setAttribute('dy', String(-shift * 0.25)); }
    }
}

const uiAppearanceManager = new UIAppearanceManager();
