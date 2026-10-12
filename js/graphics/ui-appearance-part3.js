"use strict";

// UIAppearanceManager members, continued from ui-appearance.js (kept under ~500 lines per file).
extendClass(UIAppearanceManager, {
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
        // viewport-fit owns --font-base once it has laid out the stage; resetting it here made every refresh flash small text.
        if (!root.style.getPropertyValue('--app-scale')) root.style.setProperty('--font-base', mdPx + 'px');
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
        root.style.setProperty('--vf-fx-scale', String(this.fxScale / 100));
        root.style.setProperty('--vf-scan-size', String(this.scanSize / 100));
        root.style.setProperty('--vf-scan-dur', (2 * 100 / Math.max(1, this.scanSpeed)) + 's');
        root.setAttribute('data-vf-scan-drift', this.scanSpeed > 0 ? 'on' : 'off');
        root.setAttribute('data-vf-scanwarp', this.scanWarp > 0 ? 'on' : 'off');
        this.applyScanWarp();
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
        this.applyScanWarp();
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
    },
});

const uiAppearanceManager = new UIAppearanceManager();
