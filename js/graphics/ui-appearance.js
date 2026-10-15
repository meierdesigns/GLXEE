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
        // Must match the base widths in faction-ship-styles/core.js displaySizeForClass() —
        // that function is what actually draws enemies, so the slider's px readout has to
        // agree with the same base table or the two diverge (slider shows a different size
        // than what's on screen).
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
        this.fxScale = 100;
        // Scanline line pitch (%) and drift speed (%, 0 = static, no distortion).
        this.scanSize = 100;
        this.scanSpeed = 100;
        // Scanline warp: horizontal row-wise wobble of the picture (%, 0 = off).
        this.scanWarp = 0;
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
        if (fxKey === 'fxScale') return this.fxScale;
        if (fxKey === 'scanSize') return this.scanSize;
        if (fxKey === 'scanSpeed') return this.scanSpeed;
        if (fxKey === 'scanWarp') return this.scanWarp;
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
            ['scanSize', 'scanSpeed', 'scanWarp'].forEach((k) => {
                if (data[k] != null && Number.isFinite(Number(data[k]))) {
                    this[k] = k === 'scanSize' ? Math.max(25, Math.min(400, Math.round(Number(data[k])))) : Math.max(0, Math.min(k === 'scanWarp' ? 100 : 300, Math.round(Number(data[k]))));
                }
            });
            if (Number.isFinite(Number(data.fxScale))) this.fxScale = Math.max(25, Math.min(400, Math.round(Number(data.fxScale))));
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
}
