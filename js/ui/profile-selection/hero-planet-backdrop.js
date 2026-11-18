"use strict";

// Animated faction home-planet, mounted behind the faction-pick card of the
// "new profile" wizard. Spins via PlanetSVGManager.getHeroPlanetSpinModel
// (hero-planet.js), same lazy-frame-rasterize-cache pattern as
// StartStationBackdrop (js/ui/start-screen/station-backdrop.js), plus a soft
// per-faction atmosphere glow drawn underneath it. Only animates while
// mounted (mount()/unmount() start/stop its own rAF loop).
class HeroPlanetBackdrop {
    constructor() {
        this.el = document.createElement('canvas');
        this.el.className = 'hero-planet-canvas';
        this.ctx = this.el.getContext('2d');
        this.W = 0;
        this.H = 0;
        this._container = null;
        this._faction = null;
        this._spinModel = null;
        this._spinId = null;
        this._frameCache = {};
        this._frameLoading = {};
        this._curFrame = null;
        this._raf = 0;
        this._lastT = 0;
        this._accum = 0;
        // Card peek stays cheap; stage homeworld (orbits + defense demo) needs smoother motion.
        this._frameInterval = 1000 / 8;
        this._reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
        // 'card' = wizard preview (planet peeks left of crest). 'stage' = full pane, centered.
        this._layout = 'card';
        this._orbitFleet = null;
        this._focusShipId = null; // SETUP kit hull — that ship leads the defense demo
        this._camX = null;
        this._camY = null;
        this._camZ = null;
        this._fgBake = null;
        this._orbitSpriteCache = null;
        this._weaponDemo = null;
        this._demoLastT = 0;
        this._staticLayer = null;
        this._staticKey = '';
        this._stageCache = null;
        this._planetLayer = null;
        this._planetLayerKey = '';
        this._spinHold = 0;
        if (typeof ResizeObserver !== 'undefined') {
            this._ro = new ResizeObserver(() => this._syncSize());
        }
    }

    /** SETUP step: focus defense on the chosen start-profile hull (interceptor, heavy, …). */
    setFocusShip(shipId) {
        const next = shipId ? String(shipId) : null;
        if (next !== this._focusShipId) this._userZoom = 1;
        this._focusShipId = next;
        this._orbitFleet = null;
        this._orbitSpriteCache = null;
        this._weaponDemo = null;
        this._camX = this._camY = this._camZ = null;
        if (this.el && this.el.isConnected && this.draw) this.draw(false);
    }

    setLayout(mode) {
        const next = (mode === 'stage') ? 'stage' : 'card';
        if (next === this._layout) return;
        this._layout = next;
        // Stage defense scene: 20fps so orbits / dives don't stutter. Card peek stays 8fps.
        this._frameInterval = next === 'stage' ? (1000 / 20) : (1000 / 8);
        this._staticLayer = null;
        this._staticKey = '';
        this._planetLayer = null;
        this._planetLayerKey = '';
        // Stage needs a cheaper spin model than the card peek.
        if (this._faction) {
            const keep = this._faction;
            this._faction = null;
            this.setFaction(keep);
        }
        if (this.el.isConnected) this.draw();
    }

    mount(container) {
        if (!container) return;
        this._container = container;
        if (this.el.parentNode !== container) {
            // Only promote static hosts — never clobber fixed/absolute
            // (launch-cutscene uses position:fixed; inline relative collapsed it to 0×0).
            const pos = (typeof getComputedStyle === 'function')
                ? getComputedStyle(container).position
                : (container.style.position || 'static');
            if (!pos || pos === 'static') container.style.position = 'relative';
            container.insertBefore(this.el, container.firstChild);
        }
        if (this._ro) this._ro.observe(container);
        this._bindZoomWheel(container);
        this._bindAssetReady();
        // draw() (called by _startLoop()/below) always re-measures the
        // element's own box first — see draw() — so a stale mid-transition
        // size here self-corrects on the very next paint instead of only
        // resyncing when ResizeObserver happens to fire.
        if (!this._reduceMotion) this._startLoop();
        else this.draw();
    }

    /**
     * After a page refresh, ship/sprite assets arrive late. Orbit hulls baked
     * too early can miss the enemy nose-down flip and stick in _orbitSpriteCache
     * upside-down until a faction swap. Drop the cache when assets finish.
     */
    _bindAssetReady() {
        if (this._assetReadyBound || typeof window === 'undefined') return;
        this._assetReadyBound = true;
        const bump = () => {
            this._orbitSpriteCache = null;
            this._fgBake = null;
            if (this.el && this.el.isConnected && this.draw) this.draw(false);
        };
        window.addEventListener('vf-ships-loaded', bump);
        window.addEventListener('vf-sprites-loaded', bump);
        this._assetReadyBump = bump;
    }

    /** SETUP: mouse wheel over the backdrop (not over a scrolling panel) zooms the camera in / out. */
    _bindZoomWheel(container) {
        if (this._wheelHost === container) return;
        if (this._wheelHost && this._onWheel) this._wheelHost.removeEventListener('wheel', this._onWheel);
        this._wheelHost = container;
        this._onWheel = (e) => {
            if (!this._focusShipId) return;
            for (let n = e.target; n && n !== container; n = n.parentElement) {
                if (n.scrollHeight > n.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(n).overflowY)) return;
            }
            // Only the left backdrop area: ignore wheel over the right-hand panels.
            const r = this.el.getBoundingClientRect();
            if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
            e.preventDefault();
            const z = (this._userZoom || 1) * (e.deltaY < 0 ? 1.15 : 1 / 1.15);
            this._userZoom = Math.max(0.6, Math.min(4, z));
        };
        container.addEventListener('wheel', this._onWheel, { passive: false });
    }

    unmount() {
        if (this._ro) this._ro.disconnect();
        this._stopLoop();
        if (this._assetReadyBump && typeof window !== 'undefined') {
            window.removeEventListener('vf-ships-loaded', this._assetReadyBump);
            window.removeEventListener('vf-sprites-loaded', this._assetReadyBump);
            this._assetReadyBump = null;
            this._assetReadyBound = false;
        }
        if (this.el.parentNode) this.el.parentNode.removeChild(this.el);
    }

    /** Global Pixel Size: spin detail so one art cell is gp screen px; else the given default. */
    _pixelDetail(def) {
        const gp = (typeof uiAppearanceManager !== 'undefined' && uiAppearanceManager.getGlobalPixelPx)
            ? uiAppearanceManager.getGlobalPixelPx() : 0;
        // Stage homeworld: hard-cap detail — @16 a ringed globe is ~288² cells per spin frame.
        const cap = this._layout === 'stage' ? 6 : 10;
        const base = Math.min(cap, def || cap);
        if (!(gp > 0)) return base;
        const w = this.W || (this.el && this.el.clientWidth) || window.innerHeight;
        return Math.max(1, Math.min(cap, Math.round(w / (18 * gp))));
    }

    setFaction(factionId) {
        const faction = String(factionId || 'pirate').toLowerCase();
        if (faction === this._faction) return;
        this._faction = faction;
        this._orbitFleet = null;
        this._fgBake = null;
        this._orbitSpriteCache = null;
        this._weaponDemo = null;
        // Keep _focusShipId — SETUP kit persists across faction recolour.
        this._demoLastT = 0;
        this._staticLayer = null;
        this._staticKey = '';
        this._stageCache = null;
        this._planetLayer = null;
        this._planetLayerKey = '';
        this._spinHold = 0;
        if (typeof planetSVGManager === 'undefined' || !planetSVGManager.getHeroPlanetSpinModel) return;
        try {
            const model = planetSVGManager.getHeroPlanetSpinModel(faction, this._pixelDetail(6));
            if (!model || model === this._spinModel) return;
            this._spinId = 'hero-' + faction;
            this._spinModel = model;
            this._frameCache = {};
            this._frameLoading = {};
            this._frameIdx = 0;
            // Keep showing the previous faction's frame while the new one rasterizes: _currentFrame()
            // already falls back to it on a cache miss, and the vf-fswap fade (CSS) dips the canvas's
            // opacity right as this swap happens, so the old planet reads as a quick crossfade out
            // instead of popping to an empty ring for however long the new raster takes to decode.
        } catch (err) { /* keep whatever was already showing */ }
        if (this._reduceMotion) this.draw();
    }

    _syncSize() {
        const parent = this.el.parentNode;
        if (!parent) return;
        const w = Math.round(parent.clientWidth);
        const h = Math.round(parent.clientHeight);
        if (w < 10 || h < 10 || (w === this.W && h === this.H)) return;
        this.W = w;
        this.H = h;
        this._fgBake = null;
        this._orbitSpriteCache = null;
        this._weaponDemo = null;
        this._staticLayer = null;
        this._staticKey = '';
        this._stageCache = null;
        this._planetLayer = null;
        this._planetLayerKey = '';
        // Stage: 1× CSS pixels. Retina just multiplies fill cost on a full-pane canvas.
        const dpr = this._layout === 'stage' ? 1 : Math.min(1.25, window.devicePixelRatio || 1);
        this.el.width = Math.round(w * dpr);
        this.el.height = Math.round(h * dpr);
        this.el.style.width = w + 'px';
        this.el.style.height = h + 'px';
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        // draw() itself calls _syncSize() first thing now (see draw()), so
        // it doesn't need a trigger from here too — doing both caused a
        // harmless but wasteful double-paint on every resize frame.
        if (!this._inDraw) this.draw();
    }

    _startLoop() {
        if (this._raf || this._idleTimer) return;
        this._lastT = 0;
        this._accum = 0;
        this._visOk = true;
        this._visCheckAt = 0;
        const schedule = (delay) => {
            if (this._idleTimer) {
                clearTimeout(this._idleTimer);
                this._idleTimer = 0;
            }
            if (delay > 16) {
                this._idleTimer = setTimeout(() => {
                    this._idleTimer = 0;
                    this._raf = requestAnimationFrame(tick);
                }, delay);
            } else {
                this._raf = requestAnimationFrame(tick);
            }
        };
        const tick = (now) => {
            this._raf = 0;
            if (!this.el.isConnected) {
                if (this._idleTimer) { clearTimeout(this._idleTimer); this._idleTimer = 0; }
                return;
            }
            if (document.hidden || document.documentElement.hasAttribute('data-vf-performance')) {
                schedule(1000);
                return;
            }
            // Avoid getComputedStyle on the hot path — opacity fades are brief; skip only when display:none via offsetParent.
            if (!this.el.offsetParent && this.el.style.position !== 'fixed') {
                schedule(500);
                return;
            }
            // Pace draws to _frameInterval without keeping a 60 Hz rAF chain alive.
            if (!this._lastT) this._lastT = now;
            const wait = this._frameInterval - (now - this._lastT);
            if (wait > 0) {
                schedule(wait);
                return;
            }
            this._lastT = now;
            try { this.draw(true); } catch (err) { /* keep the stage loop alive */ }
            schedule(this._frameInterval);
        };
        this._raf = requestAnimationFrame(tick);
    }

    _stopLoop() {
        if (this._raf) cancelAnimationFrame(this._raf);
        this._raf = 0;
        if (this._idleTimer) {
            clearTimeout(this._idleTimer);
            this._idleTimer = 0;
        }
    }

    /**
     * Lazily rasterizes+caches the spin frame to show; returns the last good frame while a new one decodes.
     * Does NOT use planetSVGManager.getPlanetSpinIndex()'s wall-clock formula: that spreads a planet's
     * ~600+ frames over a shared 60s spinPeriod, which at this backdrop's 12fps draw rate lands on a
     * brand-new, never-cached frame almost every tick — the async rasterize+decode for one frame never
     * catches up before "now" has already moved to a different frame, so the sphere never finishes its
     * first paint. Instead this keeps its own pointer, and only moves on to the NEXT frame once the
     * current one has actually finished loading (one in-flight load at a time, always in order), so
     * playback is paced to whatever this backdrop can actually keep loaded rather than the wall clock.
     */
    /** Rasterizes+caches spin frame `f` of `model` if it isn't already cached or in flight. */
    _loadFrame(model, f) {
        if (this._frameCache[f] || this._frameLoading[f] || typeof planetSVGManager === 'undefined') return;
        // Only one spin decode in flight — getPlanetSpinFrame is sync main-thread work.
        for (const k in this._frameLoading) {
            if (this._frameLoading[k]) return;
        }
        const loading = this._frameLoading;
        const cache = this._frameCache;
        loading[f] = true;
        const run = () => {
            if (this._spinModel !== model || this._frameCache !== cache) {
                loading[f] = false;
                return;
            }
            try {
                const svg = planetSVGManager.getPlanetSpinFrame(model, f);
                const conv = planetSVGManager.planetSvgToImg(svg, 0.45);
                const img = new Image();
                const store = (src) => {
                    loading[f] = false;
                    if (this._spinModel !== model || this._frameCache !== cache) return;
                    cache[f] = { img: src, scale: conv.scale };
                    if (!this._raf) this.draw();
                };
                img.onload = () => {
                    if (typeof createImageBitmap === 'function') createImageBitmap(img).then(store, () => store(img));
                    else store(img);
                };
                img.onerror = () => { loading[f] = false; };
                img.src = conv.url;
            } catch (err) { loading[f] = false; }
        };
        // Defer heavy SVG build off the paint frame when possible.
        if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 120 });
        else setTimeout(run, 0);
    }

    _currentFrame(advance) {
        const model = this._spinModel;
        const id = this._spinId;
        if (!model || !id || typeof planetSVGManager === 'undefined') return this._curFrame;
        if (this._frameIdx == null) this._frameIdx = 0;
        // Few slots + hold: stage stays readable without decoding dozens of heavy frames/sec.
        const maxSlots = this._layout === 'stage' ? 36 : 64;
        const step = Math.max(1, Math.ceil(model.count / maxSlots));
        const slots = Math.max(1, Math.ceil(model.count / step));
        const slot = this._frameIdx % slots;
        const f = slot * step;
        const cached = this._frameCache[f];
        if (cached) {
            this._curFrame = cached;
            if (advance) {
                this._spinHold = (this._spinHold || 0) + 1;
                const hold = this._layout === 'stage' ? 3 : 2;
                if (this._spinHold >= hold) {
                    this._spinHold = 0;
                    this._frameIdx = (slot + 1) % slots;
                    // Prefetch only the next slot — never more than one in flight.
                    this._loadFrame(model, ((slot + 1) % slots) * step);
                }
            }
            return cached;
        }
        this._loadFrame(model, f);
        return this._curFrame;
    }

    /**
     * Paints the atmosphere rings and the planet disc, in that order, all
     * centered on the same (cx, cy, r) from _stageRect() — one shared
     * geometry so none of them can ever drift apart or end up on different
     * centers, radii or clip bounds.
     *
     *   atmosphere: the same baked dithered halo the galaxy map uses
     *   (applyAtmosphere in planet-svgs/apply-rings.js) — it's part of the
     *   rasterized spin frame itself (planetSvgToImg's margin keeps the
     *   halo pixels outside the disc box), not a separate canvas gradient
     *   or stroke drawn on top. A synthetic canvas ring/gradient was tried
     *   here before and never quite matched the map's look, so this just
     *   stops clipping the frame draw to the disc radius and lets the
     *   planet's own halo show, same as everywhere else in the game.
     *
     *   disc: an opaque ambient base (so the full circle is always visible,
     *   including the sphere's own near-black unlit night side) with the
     *   actual spin frame drawn on top at slightly reduced opacity, so the
     *   base still shows through everywhere, lit side included.
     */
    draw(advance) {
        const c = this.ctx;
        // ResizeObserver owns size. Reading clientWidth every paint forces layout thrash.
        if (!this.W || !this.H) {
            this._inDraw = true;
            this._syncSize();
            this._inDraw = false;
        }
        if (!this.W || !this.H) return;
        c.clearRect(0, 0, this.W, this.H);
        const pal = (typeof factionShipStyles !== 'undefined' && factionShipStyles.getFactionStyle)
            ? factionShipStyles.getFactionStyle(this._faction) : null;
        const accent = (pal && (pal.accent || pal.hull)) || '#7ec8ff';
        const hull = (pal && pal.hull) || accent;
        const stage = this._stageRect();
        const frame = this._currentFrame(advance);
        const cx = stage.cx, cy = stage.cy, r = stage.r;
        const stageLayout = this._layout === 'stage';
        const orbit = stageLayout ? this._orbitPositions(cx, cy, r) : null;

        c.save();
        c.beginPath();
        c.rect(stage.x, stage.y, stage.w, stage.h);
        c.clip();

        // SETUP: camera follows + zooms the kit hull you play.
        if (stageLayout && this._focusShipId) {
            this._applyFocusCamera(c, orbit, cx, cy);
        }

        if (stageLayout) {
            this._blitStaticLayer(c, accent, hull, cx, cy, r);
            this._drawOrbitShips(c, orbit, false);
        }

        this._blitPlanet(c, frame, accent, cx, cy, r);

        if (stageLayout) {
            this._drawOrbitShips(c, orbit, true);
            // Rival hostiles dive in; own faction ships shoot them.
            this._tickWeaponDemo(advance);
            this._drawWeaponDemo(c, accent);
            this._drawForegroundShips(c);
        }
        c.restore();
    }

    /**
     * SETUP camera: ease toward the chosen kit hull and zoom in so YOU is readable.
     * Target sits mostly on the ship, with a little planet still in frame.
     */
    _applyFocusCamera(c, orbit, planetCx, planetCy) {
        const focus = (orbit || []).find((s) => s && s.ship && s.ship.isFocus);
        const wantZ = 1.45 * (this._userZoom || 1);
        let tx = planetCx;
        let ty = planetCy;
        if (focus) {
            tx = focus.sx * 0.55 + planetCx * 0.45;
            ty = focus.sy * 0.55 + planetCy * 0.45;
        }
        if (this._camX == null || this._camY == null || this._camZ == null) {
            this._camX = tx;
            this._camY = ty;
            this._camZ = 1;
        }
        const ease = this._reduceMotion ? 1 : 0.14;
        this._camX += (tx - this._camX) * ease;
        this._camY += (ty - this._camY) * ease;
        this._camZ += (wantZ - this._camZ) * ease;
        const z = this._camZ;
        c.translate(this.W * 0.5, this.H * 0.5);
        c.scale(z, z);
        c.translate(-this._camX, -this._camY);
    }

    /** Planet disc + halo; only recompose when the spin bitmap / seat changes. */
    _blitPlanet(c, frame, accent, cx, cy, r) {
        if (!frame) {
            c.lineWidth = Math.max(1.5, r * 0.03);
            c.strokeStyle = accent + 'b0';
            c.beginPath();
            c.arc(cx, cy, r, 0, Math.PI * 2);
            c.stroke();
            return;
        }
        const key = [this._faction, Math.round(cx), Math.round(cy), Math.round(r), this._frameIdx | 0].join('|');
        if (!this._planetLayer || this._planetLayerKey !== key) {
            const layer = this._planetLayer || document.createElement('canvas');
            layer.width = Math.max(1, this.W);
            layer.height = Math.max(1, this.H);
            const lc = layer.getContext('2d');
            lc.setTransform(1, 0, 0, 1, 0, 0);
            lc.clearRect(0, 0, layer.width, layer.height);
            lc.imageSmoothingEnabled = false;
            const dr = r * frame.scale;
            lc.save();
            lc.beginPath();
            lc.arc(cx, cy, r, 0, Math.PI * 2);
            lc.clip();
            lc.fillStyle = accent + '2a';
            lc.fill();
            lc.restore();
            lc.globalAlpha = 0.85;
            lc.drawImage(frame.img, cx - dr, cy - dr, dr * 2, dr * 2);
            lc.globalAlpha = 1;
            this._planetLayer = layer;
            this._planetLayerKey = key;
        }
        c.drawImage(this._planetLayer, 0, 0);
    }

    /** Soft faction lattice behind the homeworld disc (no crest watermarks). */
    _drawFactionBg(c, accent, hull, cx, cy, r) {
        c.save();
        c.imageSmoothingEnabled = false;
        const step = Math.max(22, Math.round(r * 0.22));
        c.globalAlpha = 0.07;
        c.strokeStyle = accent;
        c.lineWidth = 1;
        for (let x = (Math.round(cx) % step); x < this.W; x += step) {
            c.beginPath();
            c.moveTo(x + 0.5, 0);
            c.lineTo(x + 0.5, this.H);
            c.stroke();
        }
        for (let y = (Math.round(cy) % step); y < this.H; y += step) {
            c.beginPath();
            c.moveTo(0, y + 0.5);
            c.lineTo(this.W, y + 0.5);
            c.stroke();
        }
        // Diagonal hatch wedges in the corners.
        c.globalAlpha = 0.1;
        c.fillStyle = hull;
        const hatch = Math.max(10, Math.round(step * 0.55));
        for (let i = 0; i < 5; i++) {
            const o = i * hatch;
            c.fillRect(o, 8, hatch - 2, 2);
            c.fillRect(this.W - o - hatch, this.H - 10, hatch - 2, 2);
            c.fillRect(8, this.H - o - hatch, 2, hatch - 2);
            c.fillRect(this.W - 10, o, 2, hatch - 2);
        }
        c.restore();
    }

    /** Grid + orbit rings are static per size/faction — bake once, blit every frame. */
    _blitStaticLayer(c, accent, hull, cx, cy, r) {
        const key = [this._faction, this.W, this.H, Math.round(cx), Math.round(cy), Math.round(r)].join('|');
        if (!this._staticLayer || this._staticKey !== key) {
            const layer = document.createElement('canvas');
            layer.width = Math.max(1, this.W);
            layer.height = Math.max(1, this.H);
            const lc = layer.getContext('2d');
            lc.imageSmoothingEnabled = false;
            this._drawFactionBg(lc, accent, hull, cx, cy, r);
            this._drawOrbitRings(lc, accent, cx, cy, r);
            this._staticLayer = layer;
            this._staticKey = key;
        }
        c.drawImage(this._staticLayer, 0, 0);
    }

    /**
     * Faction crest placements in the near foreground (replaces the old oversized
     * hulls). Layouts differ per faction; crests sit near edges, slightly cropped.
     */
    _foregroundCrestLayout() {
        const layouts = HeroPlanetBackdrop.FOREGROUND_CRESTS;
        return layouts[this._faction] || layouts.terran || [];
    }

    /**
     * Fine crest matrix: hand-drawn Hi art (32²) → Scale2x twice (128²) → rim shade.
     * Much denser than a plain @4x blit so large homeworld Wappen keep readable detail.
     */
    _fineCrestSprite(baseKey) {
        if (!baseKey || typeof IconSprites === 'undefined') return null;
        const ir = typeof iconRenderer !== 'undefined' ? iconRenderer : null;
        if (!ir || !ir.scale2x) return null;
        this._crestSpriteCache = this._crestSpriteCache || Object.create(null);
        if (this._crestSpriteCache[baseKey]) return this._crestSpriteCache[baseKey];
        let sprite = IconSprites[baseKey + 'Hi'] || IconSprites[baseKey] || null;
        if (!sprite) return null;
        // Hi is 32² → 128²; 16² base → 64². Extra Scale2x pass keeps slopes soft at hero size.
        sprite = ir.scale2x(ir.scale2x(sprite));
        if (IconSprites[baseKey + 'Hi']) sprite = ir.scale2x(sprite); // 32→256 for max fine detail
        const h = sprite.length, w = sprite[0].length;
        const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : sprite[y][x];
        const out = sprite.map((row) => row.slice());
        const rim = 4;
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const v = sprite[y][x];
                if (!v) {
                    let near = false;
                    for (let d = 1; d <= 2 && !near; d++) {
                        near = at(x - d, y) || at(x + d, y) || at(x, y - d) || at(x, y + d);
                    }
                    if (near) out[y][x] = 1;
                    continue;
                }
                let lit = false, shade = false;
                for (let d = 1; d <= rim; d++) {
                    if (!at(x - d, y) || !at(x, y - d)) lit = true;
                    if (!at(x + d, y) || !at(x, y + d)) shade = true;
                }
                if (lit && !shade) out[y][x] = Math.min(15, v + 4);
                else if (shade && !lit) out[y][x] = Math.max(2, v - 5);
            }
        }
        this._crestSpriteCache[baseKey] = out;
        return out;
    }

    /** Bake faction crest(s) once; blit integer pixels each frame. */
    _ensureFgBake() {
        const layout = this._foregroundCrestLayout();
        const key = 'crestFine3|' + this._faction + '|' + this.W + 'x' + this.H + '|' + layout.length;
        if (this._fgBake && this._fgBake.key === key) return this._fgBake.ships;
        const ir = typeof iconRenderer !== 'undefined' ? iconRenderer : null;
        const fss = typeof factionShipStyles !== 'undefined' ? factionShipStyles : null;
        const pal = fss && fss.getFactionStyle ? fss.getFactionStyle(this._faction) : null;
        const accent = (pal && (pal.accent || pal.hull)) || '#c8a050';
        const baseKey = fss && fss.emblemCamelKey ? fss.emblemCamelKey(this._faction) : null;
        const fine = this._fineCrestSprite(baseKey);
        const base = Math.min(this.W, this.H);
        const ships = layout.map((spec) => {
            const size = Math.max(96, Math.round((spec.scale != null ? spec.scale : 0.55) * base));
            // Snap to sprite cell grid so NN blit stays crisp.
            const cells = fine ? fine.length : 64;
            const snap = Math.max(cells, Math.round(size / cells) * cells);
            const canvas = document.createElement('canvas');
            canvas.width = snap;
            canvas.height = snap;
            const bc = canvas.getContext('2d');
            bc.imageSmoothingEnabled = false;
            try {
                if (fine && ir && ir.drawSprite) {
                    ir.drawSprite(bc, fine, 0, 0, snap, accent);
                } else if (ir && baseKey && ir.drawKey) {
                    ir.drawKey(bc, baseKey, 0, 0, snap, accent);
                } else {
                    bc.fillStyle = accent;
                    bc.fillRect(Math.floor(snap * 0.2), Math.floor(snap * 0.2), Math.floor(snap * 0.6), Math.floor(snap * 0.6));
                }
            } catch (err) { /* keep stage alive */ }
            return {
                canvas,
                cw: snap, ch: snap,
                ax: spec.ax != null ? spec.ax : 0.5,
                ay: spec.ay != null ? spec.ay : 0.75,
                alpha: spec.alpha != null ? spec.alpha : 0.92,
                bobAmp: Math.max(1, Math.round(snap * 0.008))
            };
        });
        this._fgBake = { key, ships };
        return ships;
    }

    _drawForegroundShips(c) {
        // SETUP focus mode: only the kit hull — no crest overlays competing with it.
        if (this._focusShipId) return;
        const crests = this._ensureFgBake();
        if (!crests.length) return;
        const t = this._reduceMotion ? 0 : Date.now();
        c.imageSmoothingEnabled = false;
        crests.forEach((s, i) => {
            const bob = this._reduceMotion ? 0
                : Math.round(Math.sin(t / 2200 + i * 1.7) * s.bobAmp);
            const sx = Math.round(this.W * s.ax) - Math.floor(s.cw / 2);
            const sy = Math.round(this.H * s.ay) - Math.floor(s.ch / 2) + bob;
            c.save();
            c.globalAlpha = s.alpha;
            c.drawImage(s.canvas, sx, sy);
            c.restore();
        });
    }

    /**
     * Homeworld stage showcase: hostiles dive toward the planet; orbiting
     * friendlies cycle every gun the wizard lists for this faction
     * (PREFERRED + BONUS affinity — same chips as the focus strip).
     */
    _profileMgr() {
        return (typeof profileSelectionManager !== 'undefined' && profileSelectionManager)
            || (typeof window !== 'undefined' && window.profileSelectionManager)
            || null;
    }

    /** Guns mounted on the chosen SETUP kit (nose + weapon2), in slot order. */
    _kitWeaponIds() {
        const psm = this._profileMgr();
        const out = [];
        const add = (wid) => {
            const id = String(wid || '').toLowerCase();
            if (!id || out.indexOf(id) !== -1) return;
            out.push(id);
        };
        if (psm && this._focusShipId) {
            try {
                const cfg = (typeof shipConfigManager !== 'undefined' && shipConfigManager.getConfig)
                    ? shipConfigManager.getConfig(this._focusShipId) : null;
                const core = (cfg && (cfg.defaultWeapon || cfg.weapon)) || 'laser';
                if (typeof psm.startWeaponSlots === 'function') {
                    (psm.startWeaponSlots(core) || []).forEach(add);
                } else {
                    add(core);
                    const kit = psm.currentKit && psm.currentKit();
                    if (kit && kit.bonus && kit.bonus.weapon2) add(kit.bonus.weapon2);
                }
            } catch (err) { /* fall through */ }
        }
        return out.length ? out : this._preferredWeapons().slice(0, 2);
    }

    _preferredWeapons() {
        const fid = this._faction;
        const out = [];
        const add = (wid) => {
            const id = String(wid || '').toLowerCase();
            if (!id || out.indexOf(id) !== -1) return;
            out.push(id);
        };
        if (this._focusShipId) {
            this._kitWeaponIds().forEach(add);
            if (out.length) return out;
        }
        if (typeof factionShipStyles !== 'undefined' && factionShipStyles.getFactionDefaultWeapons) {
            (factionShipStyles.getFactionDefaultWeapons(fid) || []).forEach(add);
        }
        const wcm = typeof weaponConfigManager !== 'undefined' ? weaponConfigManager : null;
        if (wcm && wcm.getFactionWeaponAffinity) {
            (wcm.getFactionWeaponAffinity(fid) || []).forEach(add);
        }
        // Kit second-guns from the wizard start kits (e.g. railgun / laser_twin).
        const psm = this._profileMgr();
        if (psm && typeof psm.kitDefs === 'function') {
            try {
                const defs = psm.kitDefs();
                const pack = defs && defs[fid];
                if (pack && pack.length) {
                    pack.forEach((kit) => {
                        const w2 = kit && kit.bonus && kit.bonus.weapon2;
                        if (w2) add(w2);
                    });
                }
            } catch (err) { /* ignore */ }
        }
        // Doctrine seconds even if kitDefs isn't mounted yet (faction-pick stage).
        const doctrineExtra = {
            terran: ['railgun', 'laser_twin'],
            kronax: ['plasma', 'spike_burst'],
            voidborn: ['ion', 'pierce'],
            pirate: ['burst', 'rapid'],
            machine: ['pierce']
        }[fid];
        if (doctrineExtra) doctrineExtra.forEach(add);
        return out.length ? out : ['laser'];
    }

    /**
     * Hardpoint offsets for the focus hull: nose on the aim axis, extras on the wings.
     * Returns [{ wid, lat, fwd }] in ship-local px (fwd along aim, lat perpendicular).
     */
    _focusHardpoints(ship) {
        const guns = this._kitWeaponIds();
        const sw = (ship && ship._sw) || 24;
        const sh = (ship && ship._sh) || 18;
        const n = Math.max(1, guns.length);
        const pts = [];
        for (let i = 0; i < n; i++) {
            const wid = guns[i] || guns[0] || 'laser';
            if (n === 1) {
                pts.push({ wid, lat: 0, fwd: sh * 0.48 });
            } else if (i === 0) {
                pts.push({ wid, lat: 0, fwd: sh * 0.48 });
            } else {
                const side = (i % 2 === 1) ? -1 : 1;
                const row = Math.floor((i - 1) / 2);
                pts.push({
                    wid,
                    lat: side * sw * (0.32 + row * 0.08),
                    fwd: sh * (0.12 - row * 0.06)
                });
            }
        }
        return pts;
    }

    /** Faction playstyle ratings (1–5) from the onboarding focus strip. */
    _factionRatings() {
        const id = this._faction || 'terran';
        const table = (typeof ProfileSelectionManager !== 'undefined'
            && ProfileSelectionManager.prototype
            && ProfileSelectionManager.prototype.FACTION_RATINGS)
            ? ProfileSelectionManager.prototype.FACTION_RATINGS
            : {
                terran: { damage: 3, defense: 3, speed: 3, evasion: 3, economy: 3 },
                kronax: { damage: 5, defense: 3, speed: 4, evasion: 2, economy: 2 },
                voidborn: { damage: 3, defense: 2, speed: 4, evasion: 5, economy: 2 },
                pirate: { damage: 3, defense: 2, speed: 3, evasion: 3, economy: 5 },
                machine: { damage: 3, defense: 5, speed: 2, evasion: 2, economy: 4 }
            };
        return table[id] || table.terran;
    }

    /** Map a 1–5 rating onto a movement / fire multiplier (≈0.55 … 1.55). */
    _statMul(key, def) {
        const R = this._factionRatings();
        const n = Math.max(1, Math.min(5, Number(R && R[key]) || (def != null ? def : 3)));
        return 0.55 + ((n - 1) / 4) * 1.0;
    }

    _weaponFx(wid) {
        const id = String(wid || 'laser').toLowerCase();
        const wcm = typeof weaponConfigManager !== 'undefined' ? weaponConfigManager : null;
        const live = wcm && wcm.getWeapon ? wcm.getWeapon(id) : null;
        const uiColor = wcm && wcm.getWeaponUiColor ? wcm.getWeaponUiColor(id) : null;
        // Shape / feel per family — counts/spread/speed come from the live registry when present.
        const kinds = {
            laser: 'beam', laser_twin: 'beam', twin_laser: 'beam', railgun: 'beam',
            pierce: 'beam', claw_beam: 'beam',
            wave: 'wave',
            missile: 'missile',
            plasma: 'blob', nova: 'nova',
            spread: 'pellet', rapid: 'pellet', burst: 'pellet',
            spike_burst: 'pellet', ion: 'pellet'
        };
        const kind = kinds[id] || (live && live.pierce ? 'beam'
            : (live && Number(live.bulletCount) > 1 ? 'pellet' : 'beam'));
        const count = Math.max(1, Math.round(Number((live && live.bulletCount) || (kind === 'pellet' ? 2 : 1))));
        const spread = Number((live && live.spreadAngle) || (count > 1 ? 0.28 : 0));
        const spacing = Number((live && live.bulletSpacing) || 0);
        const speed = Math.max(3.2, Number((live && live.speed) || 10) * 0.55);
        const w = Math.max(2, Math.round(Number((live && live.width) || 2) + (kind === 'blob' || kind === 'nova' ? 4 : 1)));
        const h = Math.max(3, Math.round(Number((live && live.height) || 8) * (kind === 'beam' ? 1.1 : 0.9)));
        const color = uiColor
            || ({ laser: '#4da6ff', laser_twin: '#7ec8ff', railgun: '#d8ecff', pierce: '#a8ffd8',
                claw_beam: '#ff4a2a', wave: '#d65cff', missile: '#3dff9c', plasma: '#ff7a3d',
                nova: '#ffb3f2', spread: '#ffd84a', rapid: '#e8b43a', burst: '#ffa640',
                spike_burst: '#ffab5c', ion: '#ff7ae6' })[id]
            || '#7ec8ff';
        return { id, color, kind, count, spread, spacing, speed, w, h };
    }

    /** Per-class doctrine gun — prototypes keep their kit; escorts pick by hull role. */
    _classWeapon(cls, ship) {
        if (ship && ship.isFocus) {
            const kit = this._kitWeaponIds();
            if (kit.length) return kit[0];
        }
        const fid = this._faction || 'terran';
        const byFaction = {
            terran:   { scout: 'laser', assault: 'laser_twin', heavy: 'railgun', elite: 'railgun', capital: 'laser_twin' },
            kronax:   { scout: 'spike_burst', assault: 'claw_beam', heavy: 'plasma', elite: 'claw_beam', capital: 'plasma' },
            voidborn: { scout: 'ion', assault: 'wave', heavy: 'nova', elite: 'pierce', capital: 'wave' },
            pirate:   { scout: 'rapid', assault: 'spread', heavy: 'burst', elite: 'spread', capital: 'burst' },
            machine:  { scout: 'pierce', assault: 'missile', heavy: 'missile', elite: 'pierce', capital: 'missile' }
        };
        const table = byFaction[fid] || byFaction.terran;
        return table[cls] || table.assault || this._preferredWeapons()[0] || 'laser';
    }

    /** Fire profile for a fleet seat (faction + class + optional start-kit prototype). */
    _shipFireProfile(ship) {
        const cls = (ship && ship.cls) || 'assault';
        const pid = ship && ship.playerShipId;
        if (typeof flightProfiles !== 'undefined' && flightProfiles.resolveFire) {
            return flightProfiles.resolveFire(this._faction, cls, pid);
        }
        if (typeof flightProfiles !== 'undefined' && flightProfiles.resolve) {
            return flightProfiles.resolve(this._faction, cls);
        }
        return { fireStyle: 'volley', fireRateMul: 1, spreadMul: 1, shotCountMul: 1, aimJitter: 0.05, speedMul: 1 };
    }

    /**
     * Spawn one volley from a hull. Fire cone / count / cadence come from
     * faction fireStyle + class/prototype multipliers — not a flat down-beam.
     */
    _emitShipShots(demo, ship, ax, ay, inbound, dmgMul) {
        const fire = this._shipFireProfile(ship);
        const style = fire.fireStyle || 'volley';
        const wid = ship.weapon || this._classWeapon(ship.cls, ship);
        const fx = this._weaponFx(wid);
        const spreadMul = Number(fire.spreadMul != null ? fire.spreadMul : 1);
        const countMul = Number(fire.shotCountMul != null ? fire.shotCountMul : 1);
        const jitter = Number(fire.aimJitter != null ? fire.aimJitter : 0.05);
        let count = Math.max(1, Math.round(fx.count * countMul));
        let spread = (fx.spread || (count > 1 ? 0.22 : 0)) * spreadMul;
        // Faction doctrine reshapes the cone before class muls settle it.
        if (style === 'spray') { count = Math.max(count, 3); spread = Math.max(spread, 0.38) * 1.25; }
        else if (style === 'volley') { count = Math.max(count, 2); spread = Math.max(0.12, spread * 0.7); }
        else if (style === 'claw') { count = 1; spread = 0; }
        else if (style === 'arc') { count = Math.max(count, 2); spread = Math.max(spread, 0.3); }
        else if (style === 'salvo') { count = Math.max(count, 2); spread = Math.max(0.06, spread * 0.45); }
        else if (style === 'steady') { count = Math.max(1, Math.min(2, count)); spread *= 0.6; }

        // Aim: pick nearest inbound under the nose; jitter / lead by doctrine.
        let aimX = 0;
        let aimY = 1;
        const target = (inbound || []).reduce((best, e) => {
            if (!e || e.y <= ay + 4) return best;
            const d = Math.hypot(e.x - ax, e.y - ay);
            if (!best || d < best.d) return { e, d };
            return best;
        }, null);
        if (target && target.e) {
            const dx = target.e.x - ax;
            const dy = Math.max(12, target.e.y - ay);
            const len = Math.hypot(dx, dy) || 1;
            aimX = dx / len;
            aimY = dy / len;
            if (style === 'claw' || style === 'salvo') {
                // Lead a little for heavy / machine lock shots.
                aimX += (target.e.vx || 0) * 0.02;
            } else if (style === 'spray' || style === 'skitter') {
                aimX += (Math.random() - 0.5) * jitter * 2.5;
            } else {
                aimX += (Math.random() - 0.5) * jitter;
            }
            const n = Math.hypot(aimX, aimY) || 1;
            aimX /= n;
            aimY /= n;
        } else {
            aimX = (Math.random() - 0.5) * jitter;
            aimY = 1;
            const n = Math.hypot(aimX, aimY) || 1;
            aimX /= n;
            aimY /= n;
        }

        const hardpoints = ship.isFocus
            ? this._focusHardpoints(ship)
            : this._classHardpoints(ship, wid);
        const shotSpeed = fx.speed * (0.85 + (dmgMul || 1) * 0.35);
        hardpoints.forEach((hp, hi) => {
            const hpWid = hp.wid || wid;
            const hfx = hi === 0 ? fx : this._weaponFx(hpWid);
            const muzzleX = ax + (hp.lat || 0);
            const muzzleY = ay + (hp.fwd != null ? hp.fwd : (ship._sh || 18) * 0.45);
            const useCount = hi === 0 ? count : Math.max(1, Math.round(hfx.count * Math.min(1.2, countMul)));
            const useSpread = hi === 0 ? spread : (hfx.spread || spread) * spreadMul;
            const gap = hfx.spacing || (hfx.kind === 'beam' && useCount > 1 ? 5 : 0);
            for (let i = 0; i < useCount; i++) {
                const t = useCount === 1 ? 0 : (i - (useCount - 1) / 2);
                const ang = t * useSpread;
                // Rotate aim by spread angle around +Y.
                const cos = Math.cos(ang);
                const sin = Math.sin(ang);
                let dirX = aimX * cos - aimY * sin;
                let dirY = aimX * sin + aimY * cos;
                if (style === 'arc') {
                    // Seed a lateral wave so voidborn shots snake.
                    dirX += (i % 2 === 0 ? -1 : 1) * 0.12;
                    const nn = Math.hypot(dirX, dirY) || 1;
                    dirX /= nn;
                    dirY /= nn;
                }
                let vx = dirX * shotSpeed * (hfx.kind === 'missile' ? 0.75 : 1);
                let vy = dirY * shotSpeed * (hfx.kind === 'missile' ? 0.75 : 1);
                let px = muzzleX + (useSpread < 0.05 ? t * gap : 0);
                let py = muzzleY;
                if (hfx.kind === 'nova') {
                    vx = dirX * shotSpeed + t * 0.55;
                    vy = dirY * shotSpeed;
                    px = ax + t * 4;
                    py = ay + 6;
                }
                demo.shots.push({
                    x: px,
                    y: py,
                    vx, vy,
                    w: hfx.w,
                    h: hfx.h,
                    kind: hfx.kind,
                    color: hfx.color,
                    weapon: hpWid,
                    fireStyle: style,
                    wavePhase: Math.random() * Math.PI * 2,
                    waveAmp: style === 'arc' || hfx.kind === 'wave' ? (2.2 + Math.random() * 1.4) : 0,
                    home: style === 'salvo' && hfx.kind === 'missile',
                    target: target && target.e,
                    life: hfx.kind === 'missile' ? 110 : (hfx.kind === 'nova' ? 70 : 90)
                });
            }
        });
        ship.weapon = wid;
        ship.aimDirX = aimX;
        ship.aimDirY = aimY;
        ship.muzzle = style === 'claw' ? 12 : (style === 'spray' ? 6 : 8);
    }

    /** Escort hardpoints by class — capital/elite get wing guns, scouts a single nose. */
    _classHardpoints(ship, wid) {
        const sw = (ship && ship._sw) || 24;
        const sh = (ship && ship._sh) || 18;
        const cls = (ship && ship.cls) || 'assault';
        const primary = wid || ship.weapon || 'laser';
        if (cls === 'scout') {
            return [{ wid: primary, lat: 0, fwd: sh * 0.48 }];
        }
        if (cls === 'heavy') {
            return [{ wid: primary, lat: 0, fwd: sh * 0.4 }];
        }
        if (cls === 'elite') {
            return [
                { wid: primary, lat: -sw * 0.28, fwd: sh * 0.35 },
                { wid: primary, lat: sw * 0.28, fwd: sh * 0.35 }
            ];
        }
        if (cls === 'capital') {
            const secondary = (this._preferredWeapons()[1]) || primary;
            return [
                { wid: primary, lat: -sw * 0.38, fwd: sh * 0.2 },
                { wid: primary, lat: sw * 0.38, fwd: sh * 0.2 },
                { wid: secondary, lat: 0, fwd: sh * 0.48 }
            ];
        }
        // assault: nose + optional faction second
        const second = (this._preferredWeapons()[1]) || null;
        if (second && second !== primary) {
            return [
                { wid: primary, lat: 0, fwd: sh * 0.48 },
                { wid: second, lat: 0, fwd: sh * 0.2 }
            ];
        }
        return [{ wid: primary, lat: 0, fwd: sh * 0.45 }];
    }

    _ensureWeaponDemo() {
        if (this._weaponDemo && this._weaponDemo.faction === this._faction) return this._weaponDemo;
        const speedMul = this._statMul('speed');
        const evadeMul = this._statMul('evasion');
        const dmgMul = this._statMul('damage');
        this._weaponDemo = {
            faction: this._faction,
            weapons: this._preferredWeapons(),
            wIdx: 0,
            enemies: [],
            allies: [],
            shots: [],
            scraps: [],
            nextEnemyAt: 0,
            nextAllyAt: 500,
            speedMul,
            evadeMul,
            dmgMul
        };
        return this._weaponDemo;
    }

    /** Spawn one rival hostile — from below the planet, climbing into its disc. */
    _spawnDemoRival(demo, W, H, planetX, planetY, speedMul) {
        const spd = (0.45 + Math.random() * 0.35) * (0.85 + (speedMul || 1) * 0.25);
        const stage = this._stageRect();
        const planetR = Math.max(24, (stage && stage.r) || 40);
        // Spawn under the planet so the climb hits the disc, not empty space beside it.
        const sx = Math.round(planetX + (Math.random() - 0.5) * planetR * 0.9);
        const sy = H - 10;
        const rival = this._demoRivalFaction();
        const cls = (['scout', 'assault', 'heavy'])[Math.floor(Math.random() * 3)];
        const disp = (typeof factionShipStyles !== 'undefined' && factionShipStyles.displaySizeForClass)
            ? factionShipStyles.displaySizeForClass(cls)
            : { width: 32, height: 24 };
        const mul = 0.95;
        const fp = (typeof flightProfiles !== 'undefined' && flightProfiles.resolve)
            ? flightProfiles.resolve(rival, cls)
            : { speedMul: 1, wobbleAmp: 0.2, wobbleFreq: 0.8, driftStyle: 'steady' };
        const style = fp.driftStyle || 'steady';
        let diveMul = 1.15;
        if (style === 'charge') diveMul = 1.55;
        else if (style === 'lockstep') diveMul = 0.78;
        else if (style === 'weave') diveMul = 1.05;
        else if (style === 'skitter') diveMul = 1.25;
        const dive = spd * (fp.speedMul || 1) * diveMul;
        const wobble = Number(fp.wobbleAmp != null ? fp.wobbleAmp : 0.2);
        const freq = Number(fp.wobbleFreq != null ? fp.wobbleFreq : 0.8);
        const evade = Number(fp.evasionFreqMul != null ? fp.evasionFreqMul : 1);
        demo.enemies.push({
            x: sx,
            y: sy,
            homeX: sx,
            targetX: planetX,
            w: Math.max(26, Math.round(disp.width * mul)),
            h: Math.max(20, Math.round(disp.height * mul)),
            vx: 0,
            vy: -dive,
            strafeAmp: (6 + Math.random() * 8) * (0.25 + wobble * 4.2),
            strafePhase: Math.random() * Math.PI * 2,
            strafeSpeed: (0.018 + Math.random() * 0.016) * freq * evade,
            hp: 1,
            faction: rival,
            cls,
            fp
        });
    }

    _tickWeaponDemo(advance) {
        if (this._reduceMotion || !advance) return;
        const now = Date.now();
        if (!this._demoLastT) this._demoLastT = now;
        const dt = Math.min(48, now - this._demoLastT);
        this._demoLastT = now;
        const demo = this._ensureWeaponDemo();
        const W = this.W;
        const H = this.H;
        if (W < 40 || H < 40) return;
        const stage = this._stageRect();
        const planetX = stage.cx;
        const planetY = stage.cy;
        const planetR = Math.max(24, stage.r || 40);
        // Only open fire once hostiles are close to the rim — not across the whole stage.
        const fireRange = planetR * 1.75;
        const speedMul = demo.speedMul || 1;
        const evadeMul = demo.evadeMul || 1;
        const dmgMul = demo.dmgMul || 1;

        if (now >= demo.nextEnemyAt && demo.enemies.length < 3) {
            this._spawnDemoRival(demo, W, H, planetX, planetY, speedMul);
            // Kick-start: first wave drops two rivals so the fight reads immediately.
            if (demo.enemies.length === 1) this._spawnDemoRival(demo, W, H, planetX, planetY, speedMul);
            demo.nextEnemyAt = now + Math.round((900 + Math.random() * 500) / Math.max(0.7, speedMul));
        }

        // Impact on the planet's lower face (not center) so climbs don't slip past the sides.
        const impactY = planetY + planetR * 0.88;
        // Refresh orbit seats so every faction hull can aim from its live path.
        this._orbitPositions(planetX, planetY, planetR);
        const fleet = this._ensureOrbitFleet();
        const steps = Math.max(1, Math.round(dt / 16.67));
        for (let s = 0; s < steps; s++) {
            demo.enemies.forEach((e) => {
                // Faction dive signatures: lockstep = straight, weave/skitter = lateral, charge = fast climb.
                const tx = e.targetX != null ? e.targetX : planetX;
                const style = (e.fp && e.fp.driftStyle) || 'steady';
                const homeLerp = style === 'lockstep' ? 0.045 : (style === 'charge' ? 0.035 : 0.02);
                e.homeX = (e.homeX != null ? e.homeX : e.x) + (tx - e.homeX) * homeLerp;
                e.strafePhase = (e.strafePhase || 0) + (e.strafeSpeed || 0.04);
                let lat = Math.sin(e.strafePhase) * (e.strafeAmp || 12);
                if (style === 'weave') lat += Math.sin(e.strafePhase * 2.1) * (e.strafeAmp || 12) * 0.45;
                else if (style === 'skitter') lat += Math.sin(e.strafePhase * 3.3) * (e.strafeAmp || 12) * 0.35;
                else if (style === 'lockstep') lat *= 0.12;
                else if (style === 'charge') lat *= 0.28;
                e.x = e.homeX + lat;
                e.y += e.vy || -0.5;
            });
            demo.enemies = demo.enemies.filter((e) => {
                if (e.hp <= 0) return false;
                // Hit the planet underside — remove before they can climb past.
                return e.y > impactY;
            });

            const inbound = demo.enemies.filter((e) => {
                return e.y < planetY + fireRange && e.y > impactY
                    && Math.abs(e.x - planetX) < planetR * 1.4;
            });

            (fleet.ships || []).forEach((ship) => {
                if (ship.muzzle > 0) ship.muzzle -= 1;
                const fire = this._shipFireProfile(ship);
                const rateMul = Math.max(0.45, speedMul * (fire.fireRateMul || 1) * ((ship.fp && ship.fp.speedMul) || 1));
                ship.cooldown = (ship.cooldown || 0) - 18 * rateMul;
                if (ship.cooldown > 0) return;
                const ax = ship._sx;
                const ay = ship._sy;
                if (ax == null || ay == null) return;
                // Fire arc: spray/arc ships engage wider; claw/salvo wait for a tighter lane.
                const style = fire.fireStyle || 'volley';
                const laneW = style === 'spray' ? 130 : (style === 'arc' ? 110 : (style === 'claw' || style === 'salvo' ? 70 : 95));
                const below = inbound.some((e) => e.y > ay + 8 && Math.abs(e.x - ax) < laneW);
                if (!below) return;
                const wid = ship.weapon || this._classWeapon(ship.cls, ship);
                ship.weapon = wid;
                const cdBase = (typeof weaponConfigManager !== 'undefined' && weaponConfigManager.getWeapon)
                    ? Number((weaponConfigManager.getWeapon(wid) || {}).cooldown) || 320
                    : 320;
                const styleCd = style === 'spray' ? 0.55
                    : style === 'claw' ? 1.35
                    : style === 'salvo' ? 1.15
                    : style === 'arc' ? 0.85
                    : 1;
                ship.cooldown = Math.round(
                    (cdBase * (ship.isFocus ? 0.28 : 0.4) * styleCd)
                    / Math.max(0.55, rateMul)
                    + (ship.cls === 'capital' && !ship.isFocus ? 70 : 0)
                    + (ship.cls === 'heavy' && !ship.isFocus ? 40 : 0)
                );
                this._emitShipShots(demo, ship, ax, ay, inbound, dmgMul);
            });
            demo.allies = [];

            demo.shots.forEach((sh) => {
                // Arc / wave: lateral sine. Salvo missiles gently home on their dive target.
                if (sh.waveAmp) {
                    sh.wavePhase = (sh.wavePhase || 0) + 0.22;
                    sh.x += Math.sin(sh.wavePhase) * sh.waveAmp * 0.35;
                }
                if (sh.home && sh.target && sh.target.hp > 0) {
                    const dx = sh.target.x - sh.x;
                    const dy = sh.target.y - sh.y;
                    const len = Math.hypot(dx, dy) || 1;
                    sh.vx += (dx / len) * 0.18;
                    sh.vy += (dy / len) * 0.18;
                    const spd = Math.hypot(sh.vx, sh.vy) || 1;
                    const cap = Math.max(2.5, Math.hypot(sh.vx, sh.vy));
                    sh.vx = (sh.vx / spd) * Math.min(cap, spd);
                    sh.vy = (sh.vy / spd) * Math.min(cap, spd);
                }
                sh.x += sh.vx;
                sh.y += sh.vy;
                sh.life -= 1;
            });
            demo.shots = demo.shots.filter((sh) => {
                if (sh.life <= 0 || sh.y < -20 || sh.y > H + 20 || sh.x < -20 || sh.x > W + 20) return false;
                // Cull shots that reach the planet disc.
                if (Math.hypot(sh.x - planetX, sh.y - planetY) < planetR * 0.85) return false;
                for (let i = 0; i < demo.enemies.length; i++) {
                    const e = demo.enemies[i];
                    if (Math.abs(sh.x - e.x) < (e.w + sh.w) * 0.55
                        && Math.abs(sh.y - e.y) < (e.h + sh.h) * 0.55) {
                        e.hp -= 1;
                        for (let p = 0; p < 3; p++) {
                            demo.scraps.push({
                                x: e.x,
                                y: e.y,
                                vx: (Math.random() - 0.5) * 2.8,
                                vy: (Math.random() - 0.5) * 2.8,
                                life: 8 + Math.floor(Math.random() * 6),
                                color: '#94a3b8'
                            });
                        }
                        return false;
                    }
                }
                return true;
            });

            demo.scraps.forEach((p) => {
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.08;
                p.life -= 1;
            });
            if (demo.scraps.length > 24) demo.scraps.length = 24;
            demo.scraps = demo.scraps.filter((p) => p.life > 0);
        }
    }

    _drawWeaponDemo(c, accent) {
        const demo = this._weaponDemo;
        if (!demo) return;
        c.imageSmoothingEnabled = false;

        demo.enemies.forEach((e) => {
            const sprite = this._orbitHullSprite(e.cls || 'assault', e.w, e.h, e.faction || this._demoRivalFaction());
            c.save();
            c.translate(Math.round(e.x), Math.round(e.y));
            // Orbit hulls bake nose-down; divers climb +planet (−Y) so flip them nose-up.
            c.scale(1, -1);
            c.drawImage(sprite, -Math.floor(e.w / 2), -Math.floor(e.h / 2));
            c.restore();
        });

        // Allies are the orbiting faction hulls (drawn in _drawOrbitShips).

        demo.shots.forEach((sh) => {
            c.save();
            c.translate(Math.round(sh.x), Math.round(sh.y));
            c.rotate(Math.atan2(sh.vy || 1, sh.vx || 0) - Math.PI / 2);
            c.fillStyle = sh.color || accent;
            if (sh.kind === 'beam') {
                c.fillRect(-Math.floor(sh.w / 2), 0, sh.w, sh.h);
                c.globalAlpha = 0.55;
                c.fillStyle = '#fff';
                c.fillRect(-Math.max(1, Math.floor(sh.w / 4)), 0, Math.max(1, Math.floor(sh.w / 2)), Math.max(3, Math.floor(sh.h * 0.55)));
            } else if (sh.kind === 'wave') {
                c.fillRect(-Math.floor(sh.w / 2), 0, sh.w, sh.h);
                c.globalAlpha = 0.45;
                c.fillRect(-Math.floor(sh.w / 2) - 4, 2, sh.w + 8, Math.max(2, sh.h - 2));
                c.globalAlpha = 0.3;
                c.fillRect(-Math.floor(sh.w / 2) - 8, 4, sh.w + 16, Math.max(2, sh.h - 3));
            } else if (sh.kind === 'missile') {
                c.fillRect(-Math.floor(sh.w / 2), 0, sh.w, sh.h);
                c.fillStyle = '#f87171';
                c.fillRect(-1, sh.h, 2, 4);
                c.fillStyle = '#fbbf24';
                c.fillRect(-2, sh.h + 3, 4, 2);
            } else if (sh.kind === 'blob' || sh.kind === 'nova') {
                const r = Math.max(2, Math.floor(sh.w / 2));
                c.beginPath();
                c.arc(0, 0, r, 0, Math.PI * 2);
                c.fill();
                c.globalAlpha = 0.4;
                c.fillStyle = '#fff';
                c.beginPath();
                c.arc(0, 0, Math.max(1, Math.floor(r * 0.45)), 0, Math.PI * 2);
                c.fill();
            } else {
                // Pellets (spread / rapid / burst / ion / spike).
                c.fillRect(-Math.floor(sh.w / 2), 0, sh.w, sh.h);
                c.globalAlpha = 0.5;
                c.fillStyle = '#fff8d0';
                c.fillRect(-Math.max(1, Math.floor(sh.w / 2) - 1), 0, Math.max(1, sh.w - 2), Math.max(2, Math.floor(sh.h * 0.4)));
            }
            c.restore();
        });

        demo.scraps.forEach((p) => {
            c.fillStyle = p.color || accent;
            c.globalAlpha = Math.max(0.2, p.life / 18);
            c.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
            c.globalAlpha = 1;
        });
    }

    /** Fixed rival per host faction so demo hostiles read as one opposing fleet. */
    _demoRivalFaction() {
        return ({
            terran: 'kronax',
            kronax: 'terran',
            voidborn: 'machine',
            pirate: 'terran',
            machine: 'voidborn'
        })[this._faction] || 'pirate';
    }

    _orbitHullSprite(cls, w, h, factionId, playerShipId) {
        if (!this._orbitSpriteCache) this._orbitSpriteCache = Object.create(null);
        const fid = factionId || this._faction;
        const pid = playerShipId ? String(playerShipId) : '';
        const key = fid + '|' + (pid || cls) + '|' + w + 'x' + h;
        let sprite = this._orbitSpriteCache[key];
        if (sprite) return sprite;
        const gm = typeof graphicsManager !== 'undefined' ? graphicsManager : null;
        const loader = gm && gm.shipAssetLoader;
        const assetsReady = !!(loader && (!loader.isLoaded || loader.isLoaded()));
        const pal = (typeof factionShipStyles !== 'undefined' && factionShipStyles.getFactionStyle)
            ? factionShipStyles.getFactionStyle(fid) : null;
        const accent = (pal && (pal.accent || pal.hull)) || '#c8a050';
        const hull = (pal && pal.hull) || accent;
        const edge = (pal && pal.edge) || '#1a2030';
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(4, w);
        canvas.height = Math.max(4, h);
        const bc = canvas.getContext('2d');
        bc.imageSmoothingEnabled = false;
        // Stage fleet fires +Y (down): every hull must bake nose-down. Player
        // kit models default nose-up; force enemy orientation so refresh/warm
        // paths and prototypes all face the same way as escort class hulls.
        let ok = false;
        let solid = 0;
        if (pid && typeof shipConfigManager !== 'undefined' && shipConfigManager.getMergedModel) {
            try {
                const model = Object.assign({}, shipConfigManager.getMergedModel(pid), {
                    id: pid,
                    faction: fid,
                    factionPreview: true,
                    forceEnemyOrientation: true,
                    type: 'enemy'
                });
                // Bake kit guns onto the defender so shots leave visible hardpoints.
                if (pid === this._focusShipId) {
                    const guns = this._kitWeaponIds();
                    model.previewSingleGun = true;
                    model.previewCoreGun = guns[0] || null;
                    model.previewWeapon2 = guns[1] || null;
                    const psm = this._profileMgr();
                    if (psm && typeof psm.startWingRows === 'function') {
                        try { model.previewWingRows = psm.startWingRows(); } catch (e) { /* ignore */ }
                    }
                }
                if (typeof shipLoadoutManager !== 'undefined' && shipLoadoutManager.applyLayoutToModel) {
                    try { shipLoadoutManager.applyLayoutToModel(model, pid); } catch (e) { /* ignore */ }
                }
                const mw = Math.max(1, model.width || 20);
                const mh = Math.max(1, model.height || 16);
                const scale = Math.max(0.5, Math.min(canvas.width / mw, canvas.height / mh) * 0.92);
                const ox = Math.floor((canvas.width - mw * scale) / 2);
                const oy = Math.floor((canvas.height - mh * scale) / 2);
                if (loader && loader.renderShip) {
                    loader.renderShip(bc, model, ox, oy, scale, null, 0, {
                        showThrusterGlow: false, allowColorMountSprites: true
                    });
                    ok = true;
                }
            } catch (err) { ok = false; }
        }
        if (!ok) {
            const enemy = {
                x: 0, y: 0, width: canvas.width, height: canvas.height,
                type: 'spaceship',
                faction: fid,
                enemyClass: cls,
                hullSeed: 1,
                tier: cls === 'capital' ? 3 : 1,
                level: cls === 'capital' ? 5 : 1,
                skipGuns: true,
                variantSeed: 1
            };
            try {
                if (gm && gm.renderEnemyShip) {
                    gm.renderEnemyShip(bc, enemy, 1);
                    ok = true;
                }
            } catch (err) { ok = false; }
        }
        if (!ok) {
            const cw = canvas.width, ch = canvas.height;
            const bw = Math.max(3, Math.floor(cw * 0.45));
            const bh = Math.max(4, Math.floor(ch * 0.7));
            const bx = Math.floor((cw - bw) / 2);
            const by = Math.floor((ch - bh) / 2);
            bc.fillStyle = edge;
            bc.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
            bc.fillStyle = hull;
            bc.fillRect(bx, by, bw, bh);
            // Nose marker at the BOTTOM (stage fires +Y).
            bc.fillStyle = accent;
            bc.fillRect(bx + Math.floor(bw / 2) - 1, by + bh - 2, 2, 2);
        }
        // Count opaque pixels — empty/stub bakes must not stick in the cache
        // across a refresh before ship assets finish loading.
        try {
            const data = bc.getImageData(0, 0, canvas.width, canvas.height).data;
            for (let i = 3; i < data.length; i += 16) {
                if (data[i] > 16) solid += 1;
            }
        } catch (e) { solid = ok ? 8 : 0; }
        if (assetsReady && solid > 2) {
            this._orbitSpriteCache[key] = canvas;
        } else {
            // Keep listening; next draw retries once assets/styles are up.
            this._bindAssetReady();
        }
        return canvas;
    }

    _drawOrbitRings(c, accent, cx, cy, r) {
        c.save();
        c.strokeStyle = accent;
        c.lineWidth = 1;
        // One soft lane — multi-ring stacks competed with planetary rings / atmosphere.
        c.globalAlpha = 0.14;
        c.beginPath();
        c.ellipse(cx, cy, r * 1.42, r * 1.42 * 0.56, -0.18, 0, Math.PI * 2);
        c.stroke();
        c.restore();
    }

    _ensureOrbitFleet() {
        const focusKey = this._focusShipId || '';
        if (this._orbitFleet
            && this._orbitFleet.faction === this._faction
            && this._orbitFleet.focus === focusKey) return this._orbitFleet;
        const fss = typeof factionShipStyles !== 'undefined' ? factionShipStyles : null;
        const ratingSpeed = this._statMul('speed');
        const mk = (cls, i, opts) => {
            const o = opts || {};
            const disp = o.disp || (fss && fss.displaySizeForClass
                ? fss.displaySizeForClass(cls)
                : { width: 36 + i * 12, height: 28 + i * 8 });
            const pid = o.playerShipId || null;
            const fp = (typeof flightProfiles !== 'undefined' && flightProfiles.resolveFire)
                ? flightProfiles.resolveFire(this._faction, cls, pid)
                : ((typeof flightProfiles !== 'undefined' && flightProfiles.resolve)
                    ? flightProfiles.resolve(this._faction, cls)
                    : { speedMul: 1, wobbleAmp: 0.2, wobbleFreq: 0.8, formationTightness: 0.7, fireStyle: 'volley' });
            const base = o.baseSpeed != null ? o.baseSpeed : (0.00034 + i * 0.00004);
            const tempo = base * ratingSpeed * fp.speedMul;
            const seat = {
                kind: 'ship',
                cls,
                playerShipId: pid,
                orbit: o.orbit != null ? o.orbit : (1.22 + i * 0.08),
                speed: (i % 2 === 0 ? 1 : -1) * tempo * (o.tempoMul || 1),
                phase: o.phase != null ? o.phase : (i * 1.1),
                tilt: o.tilt != null ? o.tilt : (0.46 + (i % 3) * 0.05),
                sizeMul: o.sizeMul != null ? o.sizeMul : 1.35,
                baseW: disp.width,
                baseH: disp.height,
                fp,
                weapon: null,
                cooldown: 40 + i * 55 + Math.floor(Math.random() * 60),
                muzzle: 0,
                aimDirX: 0,
                aimDirY: 1,
                isFocus: !!o.isFocus
            };
            seat.weapon = this._classWeapon(cls, seat);
            return seat;
        };
        let ships;
        if (this._focusShipId) {
            // SETUP: single chosen kit hull — one defender, always in front of the planet.
            const role = ({
                player_scrap: 'scout',
                player_interceptor: 'assault',
                player_heavy: 'heavy',
                player_assault: 'elite'
            })[this._focusShipId] || 'assault';
            const cfg = (typeof shipConfigManager !== 'undefined' && shipConfigManager.getConfig)
                ? shipConfigManager.getConfig(this._focusShipId) : null;
            const focusDisp = {
                width: Math.max(22, Math.min(36, Number((cfg && cfg.width) || 28))),
                height: Math.max(18, Math.min(28, Number((cfg && cfg.height) || 22)))
            };
            ships = [
                mk(role, 0, {
                    playerShipId: this._focusShipId,
                    disp: focusDisp,
                    orbit: 1.38,
                    tilt: 0.52,
                    sizeMul: 1.85,
                    baseSpeed: 0.00018,
                    phase: Math.PI * 0.55,
                    isFocus: true
                }),
                mk('scout', 1, { orbit: 1.62, sizeMul: 0.55, phase: 2.5, tempoMul: 1.2 }),
                mk('scout', 2, { orbit: 1.68, sizeMul: 0.5, phase: 4.7, tempoMul: 1.1 }),
                mk('assault', 3, { orbit: 1.78, sizeMul: 0.58, phase: 1.2, tempoMul: 0.95 })
            ];
        } else {
            // Faction homeworld: full class ladder.
            const classes = (fss && fss.classes)
                ? fss.classes.slice()
                : ['scout', 'assault', 'heavy', 'elite', 'capital'];
            ships = classes.map((cls, i) => mk(cls, i, {
                orbit: cls === 'capital' ? 1.48 : (1.22 + i * 0.08),
                sizeMul: cls === 'capital' ? 1.85 : 1.35,
                baseSpeed: cls === 'capital' ? 0.00022 : undefined,
                tilt: cls === 'capital' ? 0.42 : undefined,
                phase: (i / Math.max(1, classes.length)) * Math.PI * 2 + i * 0.55
            }));
        }
        this._orbitFleet = { faction: this._faction, focus: focusKey, ships };
        return this._orbitFleet;
    }

    _orbitPositions(cx, cy, r) {
        const fleet = this._ensureOrbitFleet();
        const t = this._reduceMotion ? 0 : Date.now();
        // Stage defense: own fleet must read clearly against the dark grid.
        const scale = Math.max(0.85, Math.min(1.25, (r * 0.55) / 48));
        const n = fleet.ships.length || 1;
        const out = fleet.ships.map((s, i) => {
            // Faction flightProfiles drive lane width, weave amp, and tempo.
            const fp = s.fp || {};
            const tight = Number(fp.formationTightness != null ? fp.formationTightness : 0.7);
            const wobble = Number(fp.wobbleAmp != null ? fp.wobbleAmp : 0.2);
            const freq = Number(fp.wobbleFreq != null ? fp.wobbleFreq : 0.8);
            const evade = Number(fp.evasionFreqMul != null ? fp.evasionFreqMul : 1);
            const spd = Number(fp.speedMul != null ? fp.speedMul : 1);
            const style = fp.driftStyle || 'steady';
            const lane = (i - (n - 1) / 2) / Math.max(1, n - 1);
            const laneSpread = s.isFocus ? 0.12 : (0.38 + (1 - tight) * 0.95);
            const baseX = cx + lane * r * laneSpread;
            const baseY = cy + r * (s.isFocus ? 0.78 : (0.58 + (i % 3) * (0.08 + (1 - tight) * 0.07)));
            let strafeAmp = r * (s.isFocus ? 0.16 : 0.10) * (0.35 + wobble * 2.5);
            let surgeAmp = r * (s.isFocus ? 0.07 : 0.05) * (0.5 + wobble * 1.6);
            let strafeHz = (0.0005 + i * 0.00007) * freq * evade * (0.7 + spd * 0.45);
            let surgeHz = (0.00035 + i * 0.00005) * freq * (0.75 + spd * 0.35);
            if (style === 'charge') {
                surgeAmp *= 1.85; strafeAmp *= 0.32; surgeHz *= 1.45;
            } else if (style === 'weave') {
                strafeAmp *= 1.75; surgeAmp *= 1.25; strafeHz *= 1.35;
            } else if (style === 'skitter') {
                strafeAmp *= 1.3; strafeHz *= 1.7; surgeHz *= 1.55;
            } else if (style === 'lockstep') {
                strafeAmp *= 0.12; surgeAmp *= 0.18; strafeHz *= 0.35; surgeHz *= 0.4;
            } else {
                strafeAmp *= 0.85; surgeAmp *= 0.9;
            }
            let strafe = this._reduceMotion ? 0
                : Math.sin(t * strafeHz + s.phase) * strafeAmp;
            let surge = this._reduceMotion ? 0
                : Math.sin(t * surgeHz + s.phase * 1.3) * surgeAmp;
            if (!this._reduceMotion && style === 'weave') {
                strafe += Math.sin(t * strafeHz * 2.15 + s.phase) * strafeAmp * 0.4;
            } else if (!this._reduceMotion && style === 'skitter') {
                strafe += Math.sin(t * strafeHz * 3.4 + s.phase * 0.7) * strafeAmp * 0.28;
                surge += Math.sin(t * surgeHz * 2.6 + s.phase) * surgeAmp * 0.35;
            }
            const sx = baseX + strafe;
            const sy = baseY + surge;
            const mul = scale * (s.sizeMul || 1);
            const w = Math.max(s.isFocus ? 42 : 22, Math.round(s.baseW * mul));
            const h = Math.max(s.isFocus ? 32 : 16, Math.round(s.baseH * mul));
            // Always in front of the disc — no orbit flip behind the planet.
            s._front = true;
            s._sx = sx;
            s._sy = sy;
            s._sw = w;
            s._sh = h;
            return {
                kind: s.kind || 'ship',
                cls: s.cls,
                ship: s,
                sx: Math.round(sx),
                sy: Math.round(sy),
                w, h,
                front: true,
                muzzle: s.muzzle || 0,
                alpha: 1
            };
        });
        // SETUP: the other hulls keep their distance from the chosen one.
        const foc = out.find((o) => o.ship.isFocus);
        if (foc) {
            const minD = Math.max(foc.w, foc.h) * 2.6 + r * 0.35;
            out.forEach((o) => {
                if (o === foc) return;
                let dx = o.sx - foc.sx;
                let dy = o.sy - foc.sy;
                let d = Math.hypot(dx, dy);
                if (d >= minD) return;
                if (d < 1) { dx = 1; dy = -0.4; d = Math.hypot(dx, dy); }
                o.sx = Math.round(foc.sx + dx / d * minD);
                o.sy = Math.round(foc.sy + dy / d * minD);
                o.ship._sx = o.sx;
                o.ship._sy = o.sy;
            });
        }
        return out;
    }

    _drawOrbitShips(c, orbit, front) {
        if (!orbit || !orbit.length) return;
        const pal = (typeof factionShipStyles !== 'undefined' && factionShipStyles.getFactionStyle)
            ? factionShipStyles.getFactionStyle(this._faction) : null;
        const accent = (pal && (pal.accent || pal.hull)) || '#c8a050';
        const hull = (pal && pal.hull) || '#6a5a40';
        const edge = (pal && pal.edge) || '#2a2418';
        orbit.forEach((s) => {
            if (!!s.front !== !!front) return;
            c.save();
            c.globalAlpha = s.alpha;
            c.imageSmoothingEnabled = false;
            c.translate(s.sx, s.sy);
            if (s.kind === 'station') {
                this._drawOrbitStation(c, s.w, s.h, hull, edge, accent);
            } else {
                // Stay upright — fire without yawing; only strafe / surge in position.
                const ship = s.ship;
                if (ship && ship.isFocus) this._drawYouMarker(c, s, accent);
                const sprite = this._orbitHullSprite(
                    s.cls, s.w, s.h, this._faction, ship && ship.playerShipId
                );
                const ox = -Math.floor(s.w / 2);
                const oy = -Math.floor(s.h / 2);
                // Sprite canvas stays alpha-cleared — never fill a solid AABB behind it.
                c.drawImage(sprite, ox, oy);
                if (ship && ship.muzzle > 0) {
                    c.globalAlpha = Math.min(1, ship.muzzle / 8);
                    c.fillStyle = '#fff6c8';
                    c.fillRect(-2, Math.floor(s.h / 2) - 1, 4, 5);
                    c.fillStyle = accent;
                    c.fillRect(-1, Math.floor(s.h / 2) + 2, 2, 4);
                }
            }
            c.restore();
        });
    }

    /** Mark the SETUP kit hull as the craft you play (glow + ring + YOU). */
    _drawYouMarker(c, s, accent) {
        const rr = Math.max(s.w, s.h) * 0.78;
        const pulse = this._reduceMotion ? 0.7
            : (0.45 + 0.55 * (0.5 + 0.5 * Math.sin(Date.now() / 420)));
        c.save();
        c.globalAlpha = 0.28 * pulse;
        c.fillStyle = accent;
        c.beginPath();
        c.arc(0, 0, rr * 1.2, 0, Math.PI * 2);
        c.fill();
        c.globalAlpha = 0.55 + 0.45 * pulse;
        c.strokeStyle = accent;
        c.lineWidth = 2.5;
        c.setLineDash([5, 4]);
        c.beginPath();
        c.arc(0, 0, rr, 0, Math.PI * 2);
        c.stroke();
        c.setLineDash([]);
        // Corner brackets
        const arm = Math.max(6, Math.round(rr * 0.35));
        const gap = rr * 0.72;
        c.lineWidth = 2;
        c.globalAlpha = 0.95;
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => {
            const x = sx * gap;
            const y = sy * gap;
            c.beginPath();
            c.moveTo(x, y + sy * arm);
            c.lineTo(x, y);
            c.lineTo(x + sx * arm, y);
            c.stroke();
        });
        const labelY = -rr - 10;
        c.font = 'bold 12px monospace';
        c.textAlign = 'center';
        c.textBaseline = 'bottom';
        c.lineWidth = 4;
        c.strokeStyle = '#050508';
        c.strokeText('YOU', 0, labelY);
        c.fillStyle = accent;
        c.fillText('YOU', 0, labelY);
        c.restore();
    }

    /** Pixel outpost / orbital station in the active faction's hull colors. */
    _drawOrbitStation(c, w, h, hull, edge, accent) {
        const bw = Math.max(12, Math.round(w));
        const bh = Math.max(10, Math.round(h));
        const x = -Math.floor(bw / 2);
        const y = -Math.floor(bh / 2);
        const cx = 0;
        // Core spire
        c.fillStyle = edge;
        c.fillRect(x + Math.floor(bw * 0.38), y, Math.max(4, Math.floor(bw * 0.24)), bh);
        // Docking collar
        c.fillStyle = hull;
        c.fillRect(x, y + Math.floor(bh * 0.36), bw, Math.max(4, Math.floor(bh * 0.28)));
        // Upper / lower hubs
        c.fillStyle = edge;
        c.fillRect(x + Math.floor(bw * 0.28), y + Math.floor(bh * 0.08), Math.floor(bw * 0.44), Math.max(3, Math.floor(bh * 0.14)));
        c.fillRect(x + Math.floor(bw * 0.28), y + Math.floor(bh * 0.78), Math.floor(bw * 0.44), Math.max(3, Math.floor(bh * 0.14)));
        // Side pods
        c.fillStyle = hull;
        c.fillRect(x, y + Math.floor(bh * 0.42), Math.max(3, Math.floor(bw * 0.16)), Math.max(3, Math.floor(bh * 0.16)));
        c.fillRect(x + bw - Math.max(3, Math.floor(bw * 0.16)), y + Math.floor(bh * 0.42), Math.max(3, Math.floor(bw * 0.16)), Math.max(3, Math.floor(bh * 0.16)));
        // Beacon (static — pulsing Date.now() every orbit draw was free lag)
        c.fillStyle = accent;
        c.fillRect(cx - 2, y + Math.floor(bh * 0.02), 4, 4);
    }

    /**
     * Where the disc + glow are drawn: anchored on the actual emblem
     * element (.profile-faction-preview-emblem) when present, so it always
     * tracks the real on-screen logo regardless of how the surrounding
     * flex layout (emblem + text, grouped and centered as a block)
     * distributes the card's height — guessing that split from
     * container-height-minus-text-height drifted from the emblem's real
     * position whenever the group wasn't top-anchored, reading as
     * "Atmosphäre nicht zum Planeten/Logo zentriert". Falls back to the
     * old top-anchored heuristic when there's no emblem to measure against
     * (e.g. launch-cutscene's bare canvas). Single source of truth for
     * cx/cy/r so the glow and the disc can't end up using different
     * bounds.
     *
     * Deliberately offset LEFT_OFFSET to the left of the emblem's own
     * center, not behind it: a planet directly behind the crest just reads
     * as a glow outline around the icon, whereas peeking out from beside
     * it reads as its own background object — "positioniere die nicht
     * hinter dem Wappen sondern etwas links davon".
     *
     * The radius is then capped (_fitRadius) so the atmosphere's outer
     * ring (r * GLOW_OUTER) never runs into the stage edge, with a real
     * dark margin (EDGE_MARGIN) instead of touching it exactly — see
     * _fitRadius for why a mathematically-zero edge still read as the glow
     * washing into the card border.
     */
    _stageRect() {
        if (this._layout === 'stage') {
            if (this._stageCache
                && this._stageCache.w === this.W
                && this._stageCache.h === this.H) {
                return this._stageCache;
            }
            const size = Math.min(this.W, this.H);
            const cx = this.W * 0.5;
            // Larger disc, seated higher — lower half stays clear for the defense fleet.
            const cy = this.H * 0.30;
            const desired = size * 0.58;
            // Softer top fit so a bigger/higher planet isn't crushed by glow margin.
            const room = Math.min(cx, this.W - cx, cy + desired * 0.18, this.H - cy) * 0.94;
            const r = Math.min(desired, room / 1.55);
            this._stageCache = { x: 0, y: 0, w: this.W, h: this.H, cx: cx, cy: cy, r: r };
            return this._stageCache;
        }
        const emblemEl = this._container && this._container.querySelector
            ? this._container.querySelector('.profile-faction-preview-emblem')
            : null;
        if (emblemEl && this._container) {
            // offsetLeft/offsetTop are pre-CSS-transform layout pixels, same
            // coordinate space as parent.clientWidth/Height (what this.W/H
            // and every draw() coordinate already use). getBoundingClientRect()
            // was tried here first, but it reports POST-transform on-screen
            // pixels — the whole game renders inside a scaled viewport-fit
            // wrapper (screen-frame.css) — and converting back with a
            // measured scale factor still drifted under real page scales,
            // reported as "Glow ist nicht zentriert am Planeten". Walking the
            // offsetParent chain instead never leaves layout-pixel space, so
            // there's no scale factor to get wrong.
            let x = 0, y = 0, node = emblemEl, reached = false;
            while (node) {
                x += node.offsetLeft || 0;
                y += node.offsetTop || 0;
                node = node.offsetParent;
                if (node === this._container) { reached = true; break; }
            }
            const ew = emblemEl.offsetWidth;
            const eh = emblemEl.offsetHeight;
            if (reached && (ew > 0 || eh > 0)) {
                const size = Math.max(ew, eh);
                const cx = (x + ew * 0.5) - size * HeroPlanetBackdrop.LEFT_OFFSET;
                const cy = y + eh * 0.5;
                // Bigger than the emblem itself: dominates the card as a hero visual.
                const r = this._fitRadius(cx, cy, size * HeroPlanetBackdrop.DISC_SCALE);
                return { x: 0, y: 0, w: this.W, h: this.H, cx: cx, cy: cy, r: r };
            }
        }
        const textEl = this._container && this._container.querySelector
            ? this._container.querySelector('.profile-faction-preview-text')
            : null;
        const textH = textEl ? textEl.offsetHeight : 0;
        const h = Math.max(this.H * 0.4, this.H - textH);
        const w = this.W;
        const size = Math.min(w, h);
        const cx = w * 0.5 - size * HeroPlanetBackdrop.LEFT_OFFSET;
        const cy = h * 0.5;
        // Bigger than the in-game globes: dominates the card as a hero visual.
        const r = this._fitRadius(cx, cy, size * HeroPlanetBackdrop.DISC_SCALE);
        return { x: 0, y: 0, w: w, h: h, cx: cx, cy: cy, r: r };
    }

    /**
     * Shrinks `desired` (the disc radius) only as far as needed so the
     * atmosphere ring around it (desired * GLOW_OUTER) still fits inside
     * this.W/this.H with a visible dark margin, while never growing it
     * past `desired` — a small/centered emblem keeps its full hero size,
     * only a cramped or off-center one gets reined in.
     *
     * The raw mathematical fit (room / GLOW_OUTER) puts the gradient's
     * zero-alpha point exactly on the stage edge — zero in theory, but the
     * gradient interpolates linearly in radius, not in perceived
     * brightness, so the pixels right next to that edge are still clearly
     * lit, reading as the glow washing straight into the card border (and,
     * on a card whose nearest edge sits just under the faction-tab row,
     * into the tabs above it) — reported as "der helle Bereich um den
     * Planeten" still touching the frame after the first fit pass.
     * EDGE_MARGIN reserves a slice of that room as an actually-dark buffer.
     */
    _fitRadius(cx, cy, desired) {
        if (!(desired > 0)) return desired;
        const room = Math.min(cx, this.W - cx, cy, this.H - cy) * HeroPlanetBackdrop.EDGE_MARGIN;
        if (!(room > 0)) return desired;
        return Math.min(desired, room / HeroPlanetBackdrop.GLOW_OUTER);
    }
}
HeroPlanetBackdrop.DISC_SCALE = 1.05;
// Raising this (to try to reserve more room for the widened halo, see apply-rings.js) made the
// top/bottom clipping WORSE, not better, which means the model behind that reasoning is wrong
// somewhere this file can't see cleanly (probably an interaction with DISC_SCALE/the emblem's own
// measured size that isn't as simple as "bigger GLOW_OUTER always shrinks r"). Left at the
// original value; the halo's own width was dialed back in apply-rings.js instead, which is the
// variable that's actually under direct control here.
HeroPlanetBackdrop.GLOW_OUTER = 1.9;
HeroPlanetBackdrop.EDGE_MARGIN = 0.82;
HeroPlanetBackdrop.LEFT_OFFSET = 0.55;
// Near-camera faction crests: ax/ay are canvas fractions; scale is relative to min(W,H).
// Positions sit near edges so the Wappen reads cropped ("leicht angeschnitten").
// Crest lives in the HTML label (top-left + faction name) — no canvas watermarks.
HeroPlanetBackdrop.FOREGROUND_CRESTS = {
    terran: [],
    kronax: [],
    voidborn: [],
    pirate: [],
    machine: []
};
