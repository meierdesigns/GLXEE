"use strict";

// Start screen background: the pilot's home station as pixel art.
// Look follows the profile's faction; size/detail follows its station upgrade
// levels. Hovering a pilot on the scoreboard previews that pilot's station.
class StartStationBackdrop {
    static cloneDefaults() {
        const d = StartStationBackdrop.DEFAULT_ADJUST;
        return {
            station: { ...d.station },
            ship: { ...d.ship },
            planet: { ...d.planet }
        };
    }

    constructor() {
        this.W = 320;
        this.H = 180;
        this.palettes = {
            terran: { hull: '#3A6EA5', edge: '#1a3048', accent: '#7ec8ff' },
            kronax: { hull: '#C44B2F', edge: '#4a1810', accent: '#ff7a4a' },
            machine: { hull: '#2F8F6B', edge: '#0e3028', accent: '#50e0a8' },
            pirate: { hull: '#8B6914', edge: '#3a2e08', accent: '#d4a84a' },
            voidborn: { hull: '#7B2E86', edge: '#3a1238', accent: '#f09cff' }
        };
        this.el = document.createElement('div');
        this.el.className = 'start-station-backdrop';
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.W;
        this.canvas.height = this.H;
        this.canvas.className = 'start-station-canvas';
        this.el.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');
        this.baseProfile = null;
        this.shownKey = null;
        this.fadeTimer = 0;
        // Idle animation (float/rotate/blink, stepped to a low rate to match the pixel-art look).
        this._faction = 'pirate';
        this._tier = 0;
        this._seed = 'none';
        this._planetId = null;
        // The player's actual ship, rasterised once from the game's own ship renderer
        // and cached as an <img> so the ~12fps redraw loop can drawImage() it every
        // frame without re-rendering the ship model each time.
        this._shipImg = null;
        this._shipImgKey = null;
        // The decorative planet, animated the same way the galaxy/planet map spins
        // its globes (PlanetSVGManager's spin-frame model) instead of a static
        // image: _planetSpinModel/_planetSpinId identify the current planet's
        // rotation model, _planetFrameCache holds one rasterised <img> per frame
        // index (built lazily, on demand) so repeat frames (a full turn loops)
        // are free, and _planetCurFrame is the last frame actually ready to draw
        // (kept on screen while the next one is still decoding, so it never
        // flashes blank mid-rotation).
        this._planetSpinModel = null;
        this._planetSpinId = null;
        this._planetFrameCache = {};
        this._planetFrameLoading = {};
        this._planetCurFrame = null;
        this._raf = 0;
        this._lastFrameT = 0;
        this._frameInterval = 1000 / 12;
        // Dev-mode layout overrides (drag to move, wheel to scale) per element — session-only
        // for now; "adjust" holds the live values, _hit the last-drawn screen position/radius
        // of each element (refreshed every draw) used to hit-test pointer/wheel input against.
        this.adjust = StartStationBackdrop.cloneDefaults();
        this._hit = {};
        this.devResMult = 1;
        this._dragKey = null;
        this._dragLast = null;
        this._initDevControls();
        // The canvas's logical resolution tracks the column's real on-screen size (instead of a
        // fixed 320x180 stretched via object-fit:cover), so a tall narrow column doesn't crop the
        // scene down to a thin vertical sliver.
        if (typeof ResizeObserver !== 'undefined') {
            this._ro = new ResizeObserver(() => this._syncSize());
            this._ro.observe(this.el);
        }
        this._startLoop();
    }

    /** True only while the start screen's own dev mode (Shift+C) is on. */
    get devMode() {
        return typeof startScreenManager !== 'undefined' && !!startScreenManager.devMode;
    }

    /** Converts a pointer/wheel event's client coords to this canvas's logical (CSS-pixel) space. */
    _eventToLocal(e) {
        const rect = this.canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return { x: 0, y: 0 };
        return {
            x: (e.clientX - rect.left) * (this.W / rect.width),
            y: (e.clientY - rect.top) * (this.H / rect.height)
        };
    }

    /** Nearest adjustable element to a point, within its own last-drawn radius (generous hit area). */
    _hitTest(x, y) {
        let best = null, bestD = Infinity;
        Object.keys(this._hit).forEach((key) => {
            const h = this._hit[key];
            if (!h) return;
            const d = Math.hypot(x - h.x, y - h.y);
            const within = d <= Math.max(h.r, 24) * 1.4;
            if (within && d < bestD) { bestD = d; best = key; }
        });
        return best;
    }

    /** The 8 corner/edge-midpoint handle points for an element's current bounding box
     * (same layout _drawDevOverlay renders), used both to draw and to hit-test them. */
    _handlePoints(h) {
        const x0 = h.x - h.r, y0 = h.y - h.r, s = h.r * 2;
        return [
            [x0, y0], [x0 + s / 2, y0], [x0 + s, y0],
            [x0, y0 + s / 2], [x0 + s, y0 + s / 2],
            [x0, y0 + s], [x0 + s / 2, y0 + s], [x0 + s, y0 + s]
        ];
    }

    /** Which handle (if any) of the currently SELECTED element a point lands on. */
    _handleHitTest(x, y) {
        if (!this.selectedKey) return -1;
        const h = this._hit[this.selectedKey];
        if (!h) return -1;
        const pts = this._handlePoints(h);
        for (let i = 0; i < pts.length; i++) {
            if (Math.hypot(x - pts[i][0], y - pts[i][1]) <= 9) return i;
        }
        return -1;
    }

    _initDevControls() {
        // The currently *selected* element (persists after the click/drag ends, so its
        // bounding box + corner/edge handles stay visible until something else is picked
        // or empty space is clicked) — separate from _dragKey, which only matters mid-drag.
        this.selectedKey = null;
        // Resizing (handle drag) is a separate mode from moving (body drag): grabbing a
        // handle scales uniformly from the element's own center, like a ship-editor zone
        // resize, instead of the free per-axis drag the body itself does.
        this._dragHandle = null;
        this.canvas.addEventListener('pointerdown', (e) => {
            if (!this.devMode) return;
            const p = this._eventToLocal(e);
            const hIdx = this._handleHitTest(p.x, p.y);
            if (hIdx >= 0) {
                e.preventDefault();
                const h = this._hit[this.selectedKey];
                this._dragHandle = {
                    key: this.selectedKey,
                    cx: h.x, cy: h.y,
                    startR: Math.max(8, Math.hypot(p.x - h.x, p.y - h.y)),
                    startScale: this.adjust[this.selectedKey].scale
                };
                this.canvas.setPointerCapture(e.pointerId);
                return;
            }
            const key = this._hitTest(p.x, p.y);
            this.selectedKey = key;
            this._syncDevPanel();
            if (!key) return;
            e.preventDefault();
            this._dragKey = key;
            this._dragLast = p;
            this.canvas.setPointerCapture(e.pointerId);
        });
        this.canvas.addEventListener('pointermove', (e) => {
            if (!this.devMode) return;
            if (this._dragHandle) {
                const p = this._eventToLocal(e);
                const dh = this._dragHandle;
                const r = Math.max(8, Math.hypot(p.x - dh.cx, p.y - dh.cy));
                this.adjust[dh.key].scale = Math.max(0.2, Math.min(10, dh.startScale * (r / dh.startR)));
                this.draw(this._faction, this._tier, this._seed, this._lastFrameT);
                this._syncDevPanel();
                return;
            }
            if (!this._dragKey) return;
            const p = this._eventToLocal(e);
            const a = this.adjust[this._dragKey];
            a.dx += p.x - this._dragLast.x;
            a.dy += p.y - this._dragLast.y;
            this._dragLast = p;
            this.draw(this._faction, this._tier, this._seed, this._lastFrameT);
            this._syncDevPanel();
        });
        const endDrag = () => { this._dragKey = null; this._dragLast = null; this._dragHandle = null; };
        this.canvas.addEventListener('pointerup', endDrag);
        this.canvas.addEventListener('pointercancel', endDrag);
        this.canvas.addEventListener('wheel', (e) => {
            if (!this.devMode) return;
            const p = this._eventToLocal(e);
            const key = this._hitTest(p.x, p.y);
            if (!key) return;
            e.preventDefault();
            const a = this.adjust[key];
            a.scale = Math.max(0.2, Math.min(10, a.scale * (1 - e.deltaY * 0.001)));
            this.draw(this._faction, this._tier, this._seed, this._lastFrameT);
            this._syncDevPanel();
        }, { passive: false });

        // Small floating dev panel: resolution slider + current values + reset/copy.
        // Hidden unless dev mode is actually on (checked every frame via the draw loop).
        this.devPanel = document.createElement('div');
        this.devPanel.className = 'start-station-dev-panel';
        this.devPanel.hidden = true;
        this.devPanel.innerHTML =
            '<div class="start-station-dev-row">' +
            '<label>RES <input type="range" id="ssdRes" min="0.4" max="2" step="0.05" value="1"><span id="ssdResOut">1.00x</span></label>' +
            '</div>' +
            '<div class="start-station-dev-vals" id="ssdVals"></div>' +
            '<div class="start-station-dev-row">' +
            '<button type="button" id="ssdReset">RESET</button>' +
            '<button type="button" id="ssdCopy">COPY VALUES</button>' +
            '</div>';
        this.el.appendChild(this.devPanel);
        const resInput = this.devPanel.querySelector('#ssdRes');
        const resOut = this.devPanel.querySelector('#ssdResOut');
        resInput.addEventListener('input', () => {
            this.devResMult = Number(resInput.value) || 1;
            resOut.textContent = this.devResMult.toFixed(2) + 'x';
            this.W = 0; this.H = 0; // force _syncSize to re-apply at the new multiplier
            this._syncSize();
        });
        this.devPanel.querySelector('#ssdReset').addEventListener('click', () => {
            this.adjust = StartStationBackdrop.cloneDefaults();
            this.devResMult = 1;
            resInput.value = '1';
            resOut.textContent = '1.00x';
            this.W = 0; this.H = 0;
            this._syncSize();
            this._syncDevPanel();
        });
        this.devPanel.querySelector('#ssdCopy').addEventListener('click', () => {
            const text = 'Station backdrop dev values:\n' + JSON.stringify(this.adjust, null, 2) + '\nres: ' + this.devResMult;
            console.log(text);
            if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).catch(() => {});
        });
    }

    _syncDevPanel() {
        if (!this.devPanel) return;
        const on = this.devMode;
        if (this.devPanel.hidden === on) this.devPanel.hidden = !on;
        if (!on) return;
        const vals = this.devPanel.querySelector('#ssdVals');
        if (vals) {
            vals.innerHTML = Object.keys(this.adjust).map((k) => {
                const a = this.adjust[k];
                const sel = k === this.selectedKey;
                return `<div class="start-station-dev-val${sel ? ' is-selected' : ''}">` +
                    `${sel ? '▶ ' : '&nbsp;&nbsp;'}${k.toUpperCase()}: dx ${a.dx.toFixed(0)} dy ${a.dy.toFixed(0)} scale ${a.scale.toFixed(2)}` +
                    `</div>`;
            }).join('');
        }
    }

    _syncSize() {
        // Match the container's aspect ratio (fixes the old crop-to-a-sliver bug) at the
        // real 1:1 CSS-pixel resolution, but the canvas's actual backing buffer also needs
        // to account for devicePixelRatio — on any HiDPI/scaled display, a buffer sized in
        // plain CSS pixels gets stretched over more physical pixels by the browser itself,
        // which (combined with `image-rendering: pixelated`) is exactly the blockiness that
        // made the station look lower-res than the separately-rasterised ship image. All
        // draw() math still works in plain CSS-pixel units (this.W/this.H); the extra
        // resolution is handled by scaling the 2D context to match.
        const w = Math.round(this.el.clientWidth), h = Math.round(this.el.clientHeight);
        if (w < 10 || h < 10 || (w === this.W && h === this.H)) return;
        if (window.vfResizing) { this._deferSync(); return; }
        this.W = w;
        this.H = h;
        // devResMult is the dev-panel's resolution slider (1 = native devicePixelRatio);
        // below 1 intentionally under-samples the backing buffer (CSS still stretches it
        // to the same on-screen size) to preview lower-res/perf-constrained rendering.
        const dpr = (window.devicePixelRatio || 1) * (this.devResMult || 1);
        this.canvas.width = Math.round(w * dpr);
        this.canvas.height = Math.round(h * dpr);
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.draw(this._faction, this._tier, this._seed, this._lastFrameT);
    }

    /** Resize in progress: apply the new backing-store size once, after the drag ends. */
    _deferSync() {
        if (this._rsBound) return;
        this._rsBound = true;
        window.addEventListener('vf-resize-end', () => { this._rsBound = false; this._syncSize(); }, { once: true });
    }

    _startLoop() {
        if (this._raf) return;
        const tick = (now) => {
            if (!this.canvas.isConnected) {
                this._raf = 0;
                return;
            }
            this._raf = requestAnimationFrame(tick);
            // Pause while the start screen is off-DOM or covered / display:none.
            try {
                const host = this.el.closest('.start-screen, .start-screen-overlay') || this.el;
                if (host.classList.contains('hidden')) return;
                const st = getComputedStyle(host);
                if (st.display === 'none' || st.visibility === 'hidden') return;
            } catch (e) { /* draw anyway */ }
            if (document.hidden || window.vfResizing) return;
            if (now - this._lastFrameT < this._frameInterval) return;
            this._lastFrameT = now;
            this.draw(this._faction, this._tier, this._seed, now);
        };
        this._raf = requestAnimationFrame(tick);
    }

    _stopLoop() {
        if (this._raf) cancelAnimationFrame(this._raf);
        this._raf = 0;
    }

    /** Sum of all station upgrade levels -> 0..5 build stage. */
    static tierOf(profile) {
        const ups = (profile && profile.homeStation && profile.homeStation.upgrades) || {};
        let sum = 0;
        Object.keys(ups).forEach((k) => { sum += Math.max(0, Number(ups[k]) || 0); });
        const tier = sum >= 30 ? 5 : sum >= 18 ? 4 : sum >= 9 ? 3 : sum >= 4 ? 2 : sum >= 1 ? 1 : 0;
        return { sum, tier };
    }

    /** The station shown when nothing is hovered. */
    setBase(profile) {
        this.baseProfile = profile || null;
        this.show(this.baseProfile);
    }

    hover(profile) {
        this.show(profile || this.baseProfile);
    }

    /** Planet the profile's ship currently sits at (if any), for the decorative planet below the station. */
    static currentPlanetId(profile) {
        if (!profile || typeof profileManager === 'undefined' || !profileManager.getShipLocation) return null;
        const galaxyId = profileManager.getCurrentGalaxyId ? profileManager.getCurrentGalaxyId(profile) : 'milky_way';
        const loc = profileManager.getShipLocation(galaxyId, profile);
        return (loc && loc.kind === 'planet' && loc.id) ? String(loc.id) : null;
    }

    /** Rasterises the profile's actual active ship (not a generic shape) once and caches it. */
    _loadShipImage(profile) {
        if (typeof shipRenderer === 'undefined' || !shipRenderer.renderShipPreview || typeof shipConfigManager === 'undefined' || !shipConfigManager.getMergedModel) {
            return;
        }
        // Ship sprites load asynchronously and the start screen mounts very early in boot —
        // if they aren't ready yet, renderShipPreview() silently draws nothing, caching a
        // blank image. Wait for 'vf-sprites-loaded' and retry once instead of giving up.
        if (typeof spriteLoader !== 'undefined' && spriteLoader.isLoaded && !spriteLoader.isLoaded()) {
            if (!this._shipRetryBound) {
                this._shipRetryBound = true;
                window.addEventListener('vf-sprites-loaded', () => {
                    this._shipRetryBound = false;
                    this._shipImgKey = null;
                    this._loadShipImage(profile);
                    this.draw(this._faction, this._tier, this._seed, this._lastFrameT);
                }, { once: true });
            }
            return;
        }
        const shipId = (profile && profile.activeShipId)
            || (typeof profileManager !== 'undefined' && profileManager.getStarterShipId && profileManager.getStarterShipId())
            || 'player_scrap';
        const previewFaction = (profile && profile.faction) || null;
        const cacheKey = shipId + '|' + (previewFaction || '');
        if (this._shipImgKey === cacheKey) return;
        try {
            const model = shipConfigManager.getMergedModel(shipId);
            if (!model) { this._shipImgKey = null; return; }
            // getMergedModel() remaps stock hulls to the globally ACTIVE profile's faction
            // (js/core/ship-config/create-ship.js). Scoreboard hover must skin the ship for
            // the previewed pilot instead — always overwrite with their faction (stock hulls
            // only; custom hulls keep their baked-in faction).
            const cfg = shipConfigManager.getConfig && shipConfigManager.getConfig(shipId);
            if (previewFaction && !(cfg && cfg.custom)) {
                model.faction = previewFaction;
            }
            const inner = document.createElement('canvas');
            inner.width = 44; inner.height = 60;
            shipRenderer.renderShipPreview(inner, model, 1);
            const img = new Image();
            img.onload = () => { if (this._shipImgKey === cacheKey) this._shipImg = img; };
            img.src = inner.toDataURL();
            this._shipImgKey = cacheKey;
        } catch (err) { this._shipImgKey = null; }
    }

    /**
     * Builds (once per planet/faction) the same rotation model the galaxy/planet
     * map spins its globes from (PlanetSVGManager.getPlanetSpinModel) at a high
     * detail grid (12). Falls back to a faction-themed planet, registered as its
     * own synthetic spec first (getPlanetSpinModel needs a registered planet,
     * not just an ad-hoc SVG), when the profile hasn't actually visited anywhere
     * yet. Actual per-frame rasterising happens lazily in _currentPlanetFrame(),
     * called from the draw loop.
     */
    _loadPlanetImage(planetId, faction) {
        if (typeof planetSVGManager === 'undefined' || !planetSVGManager.getPlanetSpinModel) return;
        const pal = this.palettes[faction] || this.palettes.pirate;
        let id = planetId;
        try {
            if (id) {
                planetSVGManager.getPlanetSVG(id); // ensures it's registered (sets planetSpecs[id])
            } else {
                id = 'backdrop-' + faction;
                if (!(planetSVGManager.planetSpecs && planetSVGManager.planetSpecs[id])) {
                    const style = planetSVGManager.resolveIconStyle ? planetSVGManager.resolveIconStyle(null, faction) : 'banded';
                    planetSVGManager.createPixelPlanetSVG(id, style, faction, pal.hull, {}, 1);
                }
            }
            const model = planetSVGManager.getPlanetSpinModel(id, (typeof uiAppearanceManager !== 'undefined' && uiAppearanceManager.getGlobalPixelPx && uiAppearanceManager.getGlobalPixelPx() > 0) ? Math.max(1, Math.min(12, Math.round(window.innerHeight / (18 * uiAppearanceManager.getGlobalPixelPx())))) : 12);
            if (!model || model === this._planetSpinModel) return;
            this._planetSpinId = id;
            this._planetSpinModel = model;
            this._planetFrameCache = {};
            this._planetFrameLoading = {};
            // Keep the last drawn frame until the new planet's first raster is ready —
            // clearing here made the globe vanish for a beat on every scoreboard hover.
        } catch (err) { /* keep whatever was already showing */ }
    }

    /**
     * The planet frame to draw this tick: looks up the model's current
     * wall-clock rotation index and lazily rasterises+caches that frame as an
     * <img> (cheap again next time this same index comes up, which happens
     * once per full rotation). Returns the last frame that finished loading
     * while a new one is still decoding, so the planet never blanks out
     * mid-turn — and null only before the very first frame has ever loaded.
     */
    _currentPlanetFrame() {
        const model = this._planetSpinModel;
        const id = this._planetSpinId;
        if (!model || !id || typeof planetSVGManager === 'undefined') return this._planetCurFrame;
        // A rotation can be ~500 frames of 300KB SVG each: rasterising a new one every ~120ms (and re-rasterising
        // the SVG on every drawImage) was the idle CPU cost of this screen. Step the spin so one rotation is at most
        // 128 frames, and keep every frame as a bitmap — after the first lap nothing is regenerated.
        const step = Math.max(1, Math.ceil(model.count / 128));
        const f = (Math.floor(planetSVGManager.getPlanetSpinIndex(id, model) / step) * step) % model.count;
        const cached = this._planetFrameCache[f];
        if (cached) {
            this._planetCurFrame = cached;
            return cached;
        }
        if (!this._planetFrameLoading[f]) {
            const cache = this._planetFrameCache, loading = this._planetFrameLoading;
            loading[f] = true;
            try {
                const svg = planetSVGManager.getPlanetSpinFrame(model, f);
                const conv = planetSVGManager.planetSvgToImg(svg);
                const img = new Image();
                const store = (src) => {
                    loading[f] = false;
                    if (this._planetFrameCache !== cache) return;   // faction / planet changed while decoding
                    cache[f] = { img: src, scale: conv.scale };
                    this.draw(this._faction, this._tier, this._seed, this._lastFrameT);
                };
                img.onload = () => {
                    if (typeof createImageBitmap === 'function') {
                        createImageBitmap(img).then(store, () => store(img));
                    } else store(img);
                };
                img.src = conv.url;
            } catch (err) { this._planetFrameLoading[f] = false; }
        }
        return this._planetCurFrame;
    }

    show(profile) {
        const faction = String((profile && profile.faction) || 'pirate');
        const { sum, tier } = StartStationBackdrop.tierOf(profile);
        const planetId = StartStationBackdrop.currentPlanetId(profile);
        const key = `${profile ? profile.id : '-'}|${faction}|${tier}|${planetId}`;
        if (key === this.shownKey) return;
        this.shownKey = key;
        this._faction = faction;
        this._tier = tier;
        this._planetId = planetId;
        this._seed = profile ? String(profile.id || profile.name) : 'none';
        this._loadShipImage(profile);
        this._loadPlanetImage(planetId, faction);
        // Quick fade-swap so the change reads as a different station
        this.canvas.classList.add('is-swapping');
        clearTimeout(this.fadeTimer);
        this.fadeTimer = setTimeout(() => {
            this.draw(this._faction, this._tier, this._seed, this._lastFrameT);
            this.canvas.classList.remove('is-swapping');
        }, 110);
    }

    /** Blends a hex color toward black (amt > 0) or white (amt < 0) by |amt| (0..1). */
    darken(hex, amt) {
        const h = String(hex || '#808080').replace('#', '');
        const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16);
        const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
        const toward = amt >= 0 ? 0 : 255;
        const k = Math.min(1, Math.abs(amt));
        const mix = (v) => Math.round(v + (toward - v) * k);
        return '#' + [mix(r), mix(g), mix(b)].map((v) => v.toString(16).padStart(2, '0')).join('');
    }

    rngFor(seed) {
        let h = 2166136261;
        for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
        return () => {
            h += 0x6D2B79F5;
            let t = Math.imul(h ^ (h >>> 15), 1 | h);
            t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    draw(faction, tier, seed, t) {
        const pal = this.palettes[faction] || this.palettes.pirate;
        const c = this.ctx;
        const rnd = this.rngFor(seed);
        const tt = (t || 0) / 1000;
        c.clearRect(0, 0, this.W, this.H);
        // Pushed up and further toward the left of the full-bleed backdrop, so it
        // reads as a background element sitting left of the menu rather than the
        // screen's focal point.
        const sAdj = this.adjust.station;
        const cx = Math.round(this.W * 0.24) + sAdj.dx;
        const cy = Math.round(this.H * 0.32) + sAdj.dy;
        // Slow vertical float, like the station drifting in zero-g.
        // Frozen while a dev-mode drag/resize is active: the idle float animation kept
        // nudging the element's own center every frame, fighting the pointer's drag delta
        // (dx/dy tracks the cursor, but the drawn position also drifted from bob/shipBob
        // underneath it) — that mismatch is what read as "buggy" jitter while dragging.
        const devEditing = !!(this._dragKey || this._dragHandle);
        const bob = devEditing ? 0 : Math.sin(tt * 0.7) * 3;

        // deep space: stars (fixed layout, slight counter-parallax), scaled to the actual canvas area
        const srnd = this.rngFor('stars');
        const starDrift = bob * 0.25;
        c.fillStyle = '#02040a';
        c.fillRect(0, 0, this.W, this.H);
        const starCount = Math.round((this.W * this.H) / 420);
        for (let i = 0; i < starCount; i++) {
            const big = srnd() < 0.12;
            c.fillStyle = big ? pal.accent : (srnd() < 0.5 ? '#9aa6c8' : '#4a5578');
            c.fillRect(Math.floor(srnd() * this.W), Math.floor(srnd() * this.H + starDrift), big ? 2 : 1, big ? 2 : 1);
        }
        // A real planet: a sphere whose cap rises from the bottom edge, rendered with
        // PlanetSVGManager's chunky ordered-dither pixel-art and spun the same way the
        // galaxy/planet map animates its globes (_currentPlanetFrame(), detail 12)
        // instead of a smooth canvas gradient or a static image. Styled after the
        // actual planet the profile's ship is currently at (falls back to a
        // faction-themed placeholder otherwise).
        // Bigger, more dominant planet. Size from the shorter axis so a wide
        // screen doesn't push a W-sized disc mostly off the left edge (only a
        // thin crescent + bottom strip stayed visible). Cap fraction is high
        // enough that the globe reads as a planet, not a flat horizon line.
        const pAdj = this.adjust.planet;
        const pr = Math.min(this.W, this.H) * 0.82 * pAdj.scale;
        const capFrac = 0.58;
        // Keep the disc mostly on-screen: centre sits near the station column,
        // but never so far left that (planetCx - pr) eats most of the sphere.
        const planetCx = Math.round(Math.max(pr * 0.7, Math.min(this.W * 0.36, cx))) + pAdj.dx;
        const pcy = this.H + pr * (1 - capFrac) + bob * 0.4 + pAdj.dy;
        this._hit.planet = { x: planetCx, y: pcy - pr * (1 - capFrac), r: pr * capFrac + 20 };
        const planetFrame = this._currentPlanetFrame();
        if (planetFrame) {
            // planetSvgToImg() pads the viewBox by a margin (so rings/moons outside
            // the disc aren't clipped) — the raster is `scale`× bigger than the disc
            // itself, so it's sized up to match before drawing at radius pr.
            const dr = pr * planetFrame.scale;
            c.save();
            c.beginPath();
            c.arc(planetCx, pcy, pr, 0, Math.PI * 2);
            c.clip();
            c.imageSmoothingEnabled = false;
            c.drawImage(planetFrame.img, planetCx - dr, pcy - dr, dr * 2, dr * 2);
            c.restore();
        }
        // Everything below is drawn in fixed "station units"; scale it with however
        // big the column actually is so a wide/tall column gets a bigger, more
        // detailed station instead of the same small silhouette floating in more
        // empty space.
        const fit = Math.max(0.9, Math.min(7.5, Math.min(this.W, this.H) / 90)) * sAdj.scale;
        // soft faction-colored halo behind the station, breathing gently
        const haloR = (92 + Math.sin(tt * 0.9) * 6) * fit;
        this._hit.station = { x: cx, y: cy + bob, r: haloR };
        const g = c.createRadialGradient(cx, cy + bob, 4, cx, cy + bob, haloR);
        g.addColorStop(0, pal.accent + '38');
        g.addColorStop(1, pal.accent + '00');
        c.fillStyle = g;
        c.fillRect(0, 0, this.W, this.H);
        // the station itself floats a little and scales with the available space
        c.save();
        c.translate(cx, cy + bob);
        const zoom = (1.05 - tier * 0.09) * fit;
        c.scale(zoom, zoom);
        c.translate(-cx, -cy);

        const r = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), w, h); };
        // block with dark outline, lit top edge, panel seams and a grid of lit windows.
        // The station used to read as "low-res" next to the finely-shaded ship sprite not
        // because of canvas resolution (verified fine at 1:1 CSS-pixel/devicePixelRatio) but
        // because each hull block was one big flat-colored rectangle with only a couple of
        // window dots. Splitting it into shaded halves, thin seam lines and a denser window
        // grid gives it the same per-pixel detail density as the ship art, at the same style.
        const block = (x, y, w, h, col) => {
            const base = col || pal.hull;
            r(x - 1, y - 1, w + 2, h + 2, '#05060a');
            r(x, y, w, h, base);
            // lower half shaded darker so the block reads as a lit 3D panel, not a flat chip
            if (h > 4) r(x, y + Math.ceil(h / 2), w, Math.floor(h / 2), this.darken(base, 0.22));
            r(x, y, w, 1, pal.accent + '99');
            r(x, y + h - 1, w, 1, pal.edge);
            // seams (vertical and, on taller panels, horizontal too) carve big panels
            // into a visible grid of smaller sub-plates instead of one flat chip
            if (w > 6) {
                const seam = this.darken(base, 0.4) + '99';
                for (let sx = x + 4; sx < x + w - 1; sx += 4) r(sx, y + 1, 1, h - 2, seam);
            }
            if (h > 8) {
                const seamH = this.darken(base, 0.4) + '77';
                for (let sy = y + 4; sy < y + h - 1; sy += 4) r(x + 1, sy, w - 2, 1, seamH);
            }
            // dense window grid for fine surface detail — every 2 units, not 3
            for (let wy = y + 1; wy <= y + h - 2; wy += 2) {
                for (let wx = x + 1; wx <= x + w - 2; wx += 2) {
                    if (rnd() < 0.55) r(wx, wy, 1, 1, pal.accent);
                    else if (rnd() < 0.2) r(wx, wy, 1, 1, '#fff');
                }
            }
        };
        const line = (x0, y0, x1, y1, col, th) => {
            const n = Math.max(1, Math.abs(x1 - x0), Math.abs(y1 - y0));
            for (let i = 0; i <= n; i++) r(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, th, th, col);
        };
        // Rings slowly rotate (segmented rings: a faction-colored ring station turning on its axis).
        const ring = (rad, th, col, gapEvery, spin) => {
            const off = spin ? tt * 14 : 0;
            for (let a = 0; a < 360; a += 1.5) {
                if (gapEvery && Math.floor((a + off) / 15) % gapEvery === 0) continue;
                const rad2 = (a + off) * Math.PI / 180;
                r(cx + Math.cos(rad2) * rad, cy + Math.sin(rad2) * rad * 0.82, th, th, col);
            }
        };
        // Each light has its own blink phase (derived from the seeded rnd stream) so the
        // station reads as alive instead of a static silhouette.
        const blinkAlpha = (phase, speed) => {
            const v = 0.45 + 0.55 * Math.max(0, Math.sin(tt * speed + phase));
            return Math.round(v * 255).toString(16).padStart(2, '0');
        };
        const lights = (n, spread) => {
            for (let i = 0; i < n; i++) {
                const phase = rnd() * Math.PI * 2;
                const speed = 1.4 + rnd() * 1.8;
                const col = rnd() < 0.5 ? pal.accent : '#fff';
                r(cx + (rnd() - 0.5) * spread, cy + (rnd() - 0.5) * spread * 0.7, 2, 2, col + blinkAlpha(phase, speed));
            }
        };
        if (faction === 'terran') {
            // vertical spine + horizontal truss with habitat blocks
            const span = 34 + tier * 12;
            block(cx - 8, cy - 22, 16, 44, pal.hull);
            block(cx - span, cy - 3, span * 2, 6, pal.edge);
            for (let i = 0; i <= tier + 1; i++) {
                const ox = 14 + i * 14;
                if (ox > span) break;
                block(cx - ox - 10, cy - 12 - (i & 1) * 6, 10, 12 + (i & 1) * 6, pal.hull);
                block(cx + ox, cy - 12 - (i & 1) * 6, 10, 12 + (i & 1) * 6, pal.hull);
            }
            if (tier >= 2) {
                [-1, 1].forEach((s) => {
                    for (let k = 0; k < 2 + (tier >> 1); k++) {
                        block(cx + s * (span - 8) - 6, cy + 8 + k * 9, 12, 7, '#1d4e86');
                        r(cx + s * (span - 8) - 6, cy + 8 + k * 9 + 3, 12, 1, pal.accent + '66');
                    }
                });
            }
            if (tier >= 3) {
                line(cx, cy - 22, cx, cy - 36 - tier * 2, pal.accent, 1);
                r(cx - 1, cy - 38 - tier * 2, 3, 3, '#ff4a4a');
            }
        } else if (faction === 'kronax') {
            // armored core with radiating spikes
            const spikes = 4 + tier * 2;
            const len = 22 + tier * 9;
            for (let i = 0; i < spikes; i++) {
                const a = (i / spikes) * Math.PI * 2 + 0.3;
                const x1 = cx + Math.cos(a) * len, y1 = cy + Math.sin(a) * len * 0.82;
                line(cx, cy, x1, y1, '#05060a', 5);
                line(cx, cy, x1, y1, pal.hull, 3);
                line(cx + Math.cos(a) * len * 0.5, cy + Math.sin(a) * len * 0.41, x1, y1, pal.accent, 1);
            }
            block(cx - 10, cy - 8, 20, 16, pal.hull);
            r(cx - 4, cy - 3, 8, 6, pal.accent);
            r(cx - 2, cy - 1, 4, 2, '#fff');
            if (tier >= 3) ring(len * 0.55, 2, pal.edge, 3, true);
        } else if (faction === 'machine') {
            // circuit grid of nodes joined by traces
            const nodes = [[0, 0]];
            const rings = 1 + (tier >> 1) + (tier > 0 ? 1 : 0);
            for (let rr = 1; rr <= rings; rr++) {
                const d = rr * 24;
                [[d, 0], [-d, 0], [0, d * 0.8], [0, -d * 0.8], [d, d * 0.8], [-d, -d * 0.8]].forEach((n) => {
                    if (rnd() < 0.5 + tier * 0.1) nodes.push(n);
                });
            }
            nodes.forEach((n) => {
                if (n[0] || n[1]) {
                    line(cx, cy, cx + n[0], cy + n[1], '#05060a', 3);
                    line(cx, cy, cx + n[0], cy + n[1], pal.edge, 1);
                }
            });
            nodes.forEach((n, i) => {
                const s = i === 0 ? 20 : 12;
                block(cx + n[0] - s / 2, cy + n[1] - s / 2, s, s, i === 0 ? pal.hull : pal.edge);
                r(cx + n[0] - 1, cy + n[1] - 1, 3, 3, pal.accent);
            });
        } else if (faction === 'voidborn') {
            // concentric rings around a glowing core — each ring built from individual
            // hull segments (not one flat stroke) so it reads with the same panel/rivet
            // density as the rest of the station instead of a bare circle outline.
            const radii = [14, 26, 38, 50].slice(0, 1 + Math.min(3, (tier + 1) >> 1));
            const segRing = (rad, spin) => {
                const off = spin ? tt * 14 : 0;
                const segN = Math.max(10, Math.round(rad * 0.9));
                for (let i = 0; i < segN; i++) {
                    const a = (i / segN) * 360 + off;
                    if (Math.floor(a / 15) % 7 === 0) continue; // gaps
                    const rad2 = a * Math.PI / 180;
                    const sx = cx + Math.cos(rad2) * rad, sy = cy + Math.sin(rad2) * rad * 0.82;
                    const shaded = (i % 2 === 0) ? pal.hull : this.darken(pal.hull, 0.22);
                    r(sx - 1, sy - 1, 3, 3, '#05060a');
                    r(sx, sy, 1, 1, shaded);
                    // every third segment carries a small rivet/light for fine surface detail
                    if (i % 3 === 0) r(sx, sy, 1, 1, pal.accent + (rnd() < 0.5 ? 'cc' : '55'));
                }
            };
            radii.forEach((rad, i) => {
                ring(rad, 4, '#05060a', 0, false);
                ring(rad, 2, i % 2 ? pal.accent : pal.hull, 6 + i, true);
                segRing(rad, i % 2 === 0);
            });
            // radial spokes tying the rings back to the core, like structural struts
            const spokeN = 4 + tier;
            for (let i = 0; i < spokeN; i++) {
                const a = (i / spokeN) * Math.PI * 2 + 0.4;
                const outer = radii[radii.length - 1];
                line(cx + Math.cos(a) * 8, cy + Math.sin(a) * 8 * 0.82, cx + Math.cos(a) * outer, cy + Math.sin(a) * outer * 0.82, this.darken(pal.hull, 0.3) + '77', 1);
            }
            r(cx - 6, cy - 6, 12, 12, '#05060a');
            r(cx - 4, cy - 4, 8, 8, pal.accent);
            r(cx - 2, cy - 2, 4, 4, '#fff');
            // fine core surface texture (was a flat two-tone square)
            for (let wy = -3; wy <= 2; wy++) {
                for (let wx = -3; wx <= 2; wx++) {
                    if ((wx + wy) % 2 === 0) r(cx + wx, cy + wy, 1, 1, pal.accent + '33');
                }
            }
            for (let k = 0; k < 3 + tier * 2; k++) {
                const a = rnd() * Math.PI * 2, d = 20 + rnd() * (30 + tier * 6);
                r(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.82, 3, 3, pal.hull);
            }
        } else {
            // pirate: scrap pile of mismatched hull plates
            const n = 7 + tier * 5;
            block(cx - 12, cy - 8, 24, 16, pal.hull);
            for (let i = 0; i < n; i++) {
                const w = 8 + Math.floor(rnd() * 14), h = 5 + Math.floor(rnd() * 9);
                const x = cx + (rnd() - 0.5) * (50 + tier * 22) - w / 2;
                const y = cy + (rnd() - 0.5) * (30 + tier * 11) - h / 2;
                block(x, y, w, h, rnd() < 0.5 ? pal.hull : pal.edge);
            }
            // Drawn in the same scaled "station unit" space as everything else above,
            // so these fine mast lines got multiplied by the full station zoom (up to
            // 7.5x) just like the ship sprite used to (see the ship's own comment below) —
            // at a big/wide window that turned two subtle ~20px antenna strokes into a
            // single huge black X dominating the whole backdrop. mastScale keeps them
            // capped to how they already looked at a normal, moderate zoom instead of
            // ballooning further once the station itself gets drawn bigger.
            const mastScale = Math.min(1, 2.5 / zoom);
            for (let i = 0; i < 2 + (tier >> 1); i++) {
                const ax = cx + (rnd() - 0.5) * 40 * mastScale;
                line(ax, cy - 14 * mastScale, ax + (rnd() - 0.5) * 20 * mastScale, cy - (34 + tier * 2) * mastScale, '#05060a', 2 * mastScale);
            }
            r(cx - 2, cy - 2, 4, 4, '#ff4a4a');
        }

        lights(Math.round((6 + tier * 4) * Math.min(3, fit)), 70 + tier * 14);
        c.restore();
        // The player's real ship, drawn OUTSIDE the station's zoom transform (not inside
        // the c.scale(zoom) block above) so it keeps a sane, fixed on-screen size instead
        // of ballooning with however big the station itself has been scaled up to — a
        // small "station unit" size multiplied by a big zoom was rendering the hangar
        // preview sprite at near full-screen size, exposing it as a blown-up, wrong-looking
        // blob instead of a small ship. It also floats independently, on its own gentle
        // bob, rather than being pinned rigidly to the station's own float phase.
        if (this._shipImg && this._shipImgKey) {
            // The 2.2 cap this used right after decoupling from the station's zoom made it
            // readable at small/default sizes but left it a tiny dot once the station itself
            // got much bigger (fit up to 7.5) — the cap didn't grow with it. Use a higher cap
            // so the ship keeps scaling (just a bit less aggressively than the station) instead
            // of flattening out early, with a hard ceiling so it still can't balloon into a
            // distorted blob like it did when it shared the station's full zoom outright.
            const shAdj = this.adjust.ship;
            // baseFit (screen-responsive only) places the ship's ANCHOR relative to the
            // station; shAdj.scale (the resize handles) must only affect its SIZE, not
            // feed back into that placement math too — it used to multiply both, so
            // resizing also dragged the anchor itself further from the station with it,
            // which is what showed up as "falscher Pivot": the handles assumed a fixed
            // center while the actual drawn center kept sliding as you resized.
            const baseFit = Math.min(5, fit);
            const shipBob = devEditing ? 0 : Math.sin(tt * 1.3 + 0.6) * 4;
            const sh = Math.min(400, 20 * baseFit * shAdj.scale);
            const sw = sh * (this._shipImg.width / this._shipImg.height || 0.73);
            const sy = cy + bob + (34 * baseFit) + shipBob + shAdj.dy;
            const sx = Math.max(sw / 2 + 4, cx - (28 + tier * 2) * baseFit) + shAdj.dx;
            this._hit.ship = { x: sx, y: sy, r: Math.max(sw, sh) / 2 };
            c.save();
            c.imageSmoothingEnabled = false;
            c.drawImage(this._shipImg, sx - sw / 2, sy - sh / 2, sw, sh);
            c.restore();
        } else {
            this._hit.ship = null;
        }
        if (this.devMode) this._drawDevOverlay(c);
        this._syncDevPanel();
    }

    /** Dashed bounding box + corner/edge handles around the selected element, and a
     * light hover-style dot on the others, so edges/size are visible while dev-editing. */
    _drawDevOverlay(c) {
        const colors = { station: '#7ec8ff', ship: '#ffd25a', planet: '#ff9c6a' };
        Object.keys(this._hit).forEach((key) => {
            const h = this._hit[key];
            if (!h) return;
            const selected = key === this.selectedKey;
            const col = colors[key] || '#fff';
            c.save();
            if (selected) {
                const x0 = h.x - h.r, y0 = h.y - h.r, s = h.r * 2;
                c.strokeStyle = col;
                c.lineWidth = 1.5;
                c.setLineDash([6, 4]);
                c.strokeRect(x0, y0, s, s);
                c.setLineDash([]);
                // corner + edge-midpoint handles — drag one to resize proportionally
                // (uniform scale from the element's center), drag the body to move.
                const pts = this._handlePoints(h);
                c.fillStyle = col;
                pts.forEach(([px, py]) => { c.fillRect(px - 3, py - 3, 6, 6); c.strokeRect(px - 3, py - 3, 6, 6); });
                // label with the element name + current scale, above the box
                c.font = '11px monospace';
                c.textBaseline = 'bottom';
                const label = `${key.toUpperCase()}  ${this.adjust[key].scale.toFixed(2)}x`;
                const tw = c.measureText(label).width;
                c.fillStyle = 'rgba(3,5,11,.82)';
                c.fillRect(x0, y0 - 18, tw + 8, 16);
                c.fillStyle = col;
                c.fillText(label, x0 + 4, y0 - 2);
            } else {
                c.fillStyle = col + 'aa';
                c.beginPath();
                c.arc(h.x, h.y, 3, 0, Math.PI * 2);
                c.fill();
            }
            c.restore();
        });
    }
}
// Dev-mode layout baseline — picked via the dev panel's drag/scale handles, then
// "COPY VALUES" pasted back in here as the new default once a good composition was
// found. RESET in dev mode returns to these, not to a bare identity transform.
StartStationBackdrop.DEFAULT_ADJUST = {
    station: { dx: 0, dy: 0, scale: 1 },
    ship: { dx: -1.7306609313578178, dy: 25.100620544578646, scale: 2.7447264773653126 },
    planet: { dx: 0, dy: 0, scale: 1 }
};

extendClass(StartScreenManager, {
    /** Mounts the station as a full-bleed backdrop behind the main menu content. */
    mountStationBackdrop(content, base) {
        if (!this._stationBackdrop) this._stationBackdrop = new StartStationBackdrop();
        const bd = this._stationBackdrop;
        // Insert once the content is attached to the start-screen host.
        queueMicrotask(() => {
            if (!content.parentNode) return;
            content.parentNode.insertBefore(bd.el, content);
        });
        bd.shownKey = null;
        bd.setBase(base);
        return bd;
    }
});
