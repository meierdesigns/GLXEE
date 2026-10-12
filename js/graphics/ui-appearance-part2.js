"use strict";

// UIAppearanceManager members, continued from ui-appearance.js (kept under ~500 lines per file).
extendClass(UIAppearanceManager, {
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
                fxScale: this.fxScale,
                scanSize: this.scanSize,
                scanSpeed: this.scanSpeed,
                scanWarp: this.scanWarp,
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
    },
    setBorderWeight(weight) {
        if (!this.borderWeights[weight]) return;
        this.borderWeight = weight;
        this.persist();
        this.apply();
    },
    setIndicatorWeight(weight) {
        const key = String(weight);
        if (!this.indicatorWeights[key]) return;
        this.indicatorWeight = key;
        this.persist();
        this.apply();
    },
    setShipRenderStyle(style) {
        const val = String(style || '').toUpperCase();
        if (this.shipRenderStyles.indexOf(val) === -1) return;
        this.shipRenderStyle = val;
        this.persist();
        this.apply();
    },
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
    },
    setShotSize(kind, size) {
        const id = String(kind || '').toLowerCase();
        const val = String(size || '').toUpperCase();
        if (!this.shotSizes[id] || !this.shotSizeScaleSteps[val]) return;
        this.shotSizes[id] = val;
        delete this.sizePx['shot:' + id];
        this.persist();
    },
    setPlayerSize(size) {
        const val = String(size || '').toUpperCase();
        if (!this.playerSizeScaleSteps[val]) return;
        this.playerSize = val;
        delete this.sizePx.player;
        this.persist();
        this.applyPlayerSize();
    },
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
    },
    setUiScale(scale) {
        const value = String(scale || '');
        if (!this.uiScaleOptions.includes(value)) return;
        this.uiScale = value;
        this.persist();
        this.apply();
        if (window.viewportFit && typeof window.viewportFit.scheduleUpdate === 'function') {
            window.viewportFit.scheduleUpdate();
        }
    },
    setFont(fontId) {
        if (!this.fonts[fontId]) return;
        this.font = fontId;
        this.persist();
        this.apply();
    },
    getFontFamilyOptions() {
        return ['GLOBAL'].concat(Object.keys(this.fonts));
    },
    setFontFamily(type, fontId) {
        if (!this.fontFamilies[type]) return;
        if (fontId !== 'GLOBAL' && !this.fonts[fontId]) return;
        this.fontFamilies[type] = fontId;
        this.persist();
        this.apply();
    },
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
    },
    setControlsHints(value) {
        const next = String(value || '').toUpperCase() === 'OFF' ? 'OFF' : 'ON';
        this.controlsHints = next;
        this.persist();
        this.apply();
        if (window.viewportFit && typeof window.viewportFit.scheduleUpdate === 'function') {
            window.viewportFit.scheduleUpdate();
        }
    },
    toggleControlsHints() {
        this.setControlsHints(this.controlsHints === 'ON' ? 'OFF' : 'ON');
        return this.controlsHints;
    },
    setGuiVoxel(value) {
        const val = String(value || '').toUpperCase();
        if (val !== 'ON' && val !== 'OFF') return;
        this.guiVoxel = val;
        this.persist();
        this.apply();
    },
    setFxArea(area) {
        const val = String(area || '').toUpperCase();
        if (['ALL', 'SCREEN', 'FRAME'].indexOf(val) === -1) return;
        this.fxArea = val;
        this.persist();
        this.applyFxArea();
    },
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
    },
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
    },
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
        if (key === 'fxScale') {
            const n = Number(String(val).replace('%', ''));
            if (!Number.isFinite(n)) return;
            this.fxScale = Math.max(25, Math.min(400, Math.round(n)));
            this.persist();
            this.apply();
            return;
        }
        if (key === 'scanSize' || key === 'scanSpeed' || key === 'scanWarp') {
            const n = Number(String(val).replace('%', ''));
            if (!Number.isFinite(n)) return;
            this[key] = key === 'scanSize' ? Math.max(25, Math.min(400, Math.round(n))) : Math.max(0, Math.min(key === 'scanWarp' ? 100 : 300, Math.round(n)));
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
    },
    /** SVG pixelate filter: one sample per c x c block, then dilated back to full blocks. */
    /** SVG pixelate + top-left light filter (built by the boot script in index.html). */
    ensureFramePxFilter(c) {
        const odd = Math.floor(c / 2) * 2 + 1;
        if (this._framePxBuilt === odd && document.getElementById('vfFramePx')) return;
        if (typeof window.vfBuildFramePxFilter === 'function') window.vfBuildFramePxFilter(odd);
        this._framePxBuilt = odd;
    },
    applyScanWarp() {
        // The filter re-rasterises the whole backdrop per seed change, so it is throttled
        // (>= 100 ms), paused while hidden and skipped when the heavy/anim perf switches are off.
        const disp = document.getElementById('vfScanWarpDisp');
        const scale = String(Math.round((this.scanWarp / 100) * 40 * (this.fxScale / 100) * 10) / 10);
        if (disp && disp.getAttribute('scale') !== scale) disp.setAttribute('scale', scale);
        const root = document.documentElement;
        const allowed = root.getAttribute('data-vf-perf-heavy') !== 'off' && root.getAttribute('data-vf-perf-anim') !== 'off';
        const animated = allowed && this.scanWarp > 0 && this.scanSpeed > 0;
        const every = Math.max(100, Math.round(12000 / Math.max(10, this.scanSpeed)));
        if (this._scanWarpTimer && (!animated || this._scanWarpEvery !== every)) {
            clearInterval(this._scanWarpTimer);
            this._scanWarpTimer = null;
        }
        if (animated && !this._scanWarpTimer) {
            const noise = document.getElementById('vfScanWarpNoise');
            this._scanWarpEvery = every;
            this._scanWarpTimer = setInterval(() => {
                if (document.hidden || !noise) return;
                this._scanWarpSeed = ((this._scanWarpSeed || 0) + 1) % 1000;
                noise.setAttribute('seed', String(this._scanWarpSeed));
            }, every);
        }
    },
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
            // Scanline warp: rows are pushed sideways by a horizontally stretched noise map.
            '<div class="vf-fx-scanwarp"></div>',
            '<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><filter id="vfScanWarpFx" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">' +
                '<feTurbulence id="vfScanWarpNoise" type="fractalNoise" baseFrequency="0.0015 0.22" numOctaves="1" seed="1" result="map"/>' +
                '<feColorMatrix in="map" type="matrix" values="1 0 0 0 0  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 1" result="hmap"/>' +
                '<feDisplacementMap id="vfScanWarpDisp" in="SourceGraphic" in2="hmap" scale="0" xChannelSelector="R" yChannelSelector="G"/>' +
            '</filter></svg>',
            '<div class="vf-fx-scanlines"></div>',
            '<div class="vf-fx-vignette"></div>',
            '<div class="vf-fx-noise"></div>',
            '<div class="vf-fx-flicker"></div>'
        ].join('');
        // On <html>, not <body>: the body is scaled/offset by the stage fit, which would skew the overlay and its clip.
        document.documentElement.appendChild(el);
        return el;
    },
});
