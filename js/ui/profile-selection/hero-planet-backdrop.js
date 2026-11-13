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
        // Stage homeworld is expensive (SVG spin + orbits) — 8fps is enough to read.
        this._frameInterval = 1000 / 8;
        this._reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
        // 'card' = wizard preview (planet peeks left of crest). 'stage' = full pane, centered.
        this._layout = 'card';
        this._orbitFleet = null;
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

    setLayout(mode) {
        const next = (mode === 'stage') ? 'stage' : 'card';
        if (next === this._layout) return;
        this._layout = next;
        this._frameInterval = this._layout === 'stage' ? (1000 / 8) : (1000 / 16);
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
        // draw() (called by _startLoop()/below) always re-measures the
        // element's own box first — see draw() — so a stale mid-transition
        // size here self-corrects on the very next paint instead of only
        // resyncing when ResizeObserver happens to fire.
        if (!this._reduceMotion) this._startLoop();
        else this.draw();
    }

    unmount() {
        if (this._ro) this._ro.disconnect();
        this._stopLoop();
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
        if (this._raf) return;
        this._lastT = 0;
        this._accum = 0;
        this._visOk = true;
        this._visCheckAt = 0;
        const tick = (now) => {
            if (!this.el.isConnected) {
                this._raf = 0;
                return;
            }
            this._raf = requestAnimationFrame(tick);
            if (document.hidden) return;
            // Avoid getComputedStyle on the hot path — opacity fades are brief; skip only when display:none via offsetParent.
            if (!this.el.offsetParent && this.el.style.position !== 'fixed') return;
            // A fixed-step accumulator, not "now - lastT < interval, else lastT = now": that
            // re-bases the clock to whatever imprecise moment rAF happened to fire, so the REAL
            // gap between accepted draws drifted with rAF's own ~16ms granularity instead of
            // staying a steady multiple of the interval — a continuous low-level stutter even
            // once every frame was long cached and decode time was no longer a factor at all.
            if (!this._lastT) this._lastT = now;
            this._accum += now - this._lastT;
            this._lastT = now;
            if (this._accum < this._frameInterval) return;
            // Never catch up with multiple paints — one draw per rAF max.
            this._accum = Math.min(this._accum - this._frameInterval, this._frameInterval);
            this.draw(true);
        };
        this._raf = requestAnimationFrame(tick);
    }

    _stopLoop() {
        if (this._raf) cancelAnimationFrame(this._raf);
        this._raf = 0;
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
     * Homeworld stage showcase: hostiles dive toward the planet; a friendly
     * fires one preferred-weapon volley at them, then scraps — so the
     * panel only demonstrates which guns the faction fields.
     */
    _preferredWeapons() {
        if (typeof factionShipStyles !== 'undefined' && factionShipStyles.getFactionDefaultWeapons) {
            const list = factionShipStyles.getFactionDefaultWeapons(this._faction);
            if (list && list.length) return list;
        }
        return ['laser'];
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
        // Prefer live weapon registry counts (Spread = 2) so the demo matches combat.
        const live = (typeof weaponConfigManager !== 'undefined' && weaponConfigManager.getWeapon)
            ? weaponConfigManager.getWeapon(id) : null;
        const table = {
            laser: { color: '#7ec8ff', kind: 'beam', count: 1, speed: 7.2, w: 3, h: 14 },
            claw_beam: { color: '#ff6a4a', kind: 'beam', count: 1, speed: 6.4, w: 4, h: 16 },
            wave: { color: '#c084fc', kind: 'wave', count: 1, speed: 5.2, w: 18, h: 6 },
            spread: { color: '#fbbf24', kind: 'pellet', count: 2, speed: 5.8, w: 4, h: 4 },
            missile: { color: '#94a3b8', kind: 'missile', count: 1, speed: 4.6, w: 5, h: 10 },
            plasma: { color: '#34d399', kind: 'blob', count: 1, speed: 5.0, w: 8, h: 8 },
            rapid: { color: '#67e8f9', kind: 'pellet', count: 2, speed: 8.0, w: 3, h: 3 },
            burst: { color: '#fb923c', kind: 'pellet', count: 2, speed: 6.2, w: 4, h: 4 },
            twin_laser: { color: '#93c5fd', kind: 'beam', count: 2, speed: 7.0, w: 2, h: 12 },
            laser_twin: { color: '#93c5fd', kind: 'beam', count: 2, speed: 7.0, w: 2, h: 12 },
            railgun: { color: '#e2e8f0', kind: 'beam', count: 1, speed: 9.0, w: 2, h: 18 }
        };
        const base = table[id] || table.laser;
        if (live && live.bulletCount != null) {
            return Object.assign({}, base, { count: Math.max(1, Math.round(Number(live.bulletCount) || base.count)) });
        }
        return base;
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

    /** Spawn one rival hostile diving toward the homeworld. */
    _spawnDemoRival(demo, W, H, planetX, planetY, speedMul) {
        const spd = (0.45 + Math.random() * 0.35) * (0.85 + (speedMul || 1) * 0.25);
        const edge = Math.random();
        let sx; let sy;
        if (edge < 0.7) {
            // Enter from bottom edge — already on-screen so they read immediately.
            sx = Math.round(W * (0.15 + Math.random() * 0.7));
            sy = H - 10;
        } else if (edge < 0.85) {
            sx = 12;
            sy = Math.round(H * (0.55 + Math.random() * 0.35));
        } else {
            sx = W - 12;
            sy = Math.round(H * (0.55 + Math.random() * 0.35));
        }
        const dx0 = planetX - sx;
        const dy0 = planetY - sy;
        const len0 = Math.max(1, Math.hypot(dx0, dy0));
        const rival = this._demoRivalFaction();
        const cls = (['scout', 'assault', 'heavy'])[Math.floor(Math.random() * 3)];
        const disp = (typeof factionShipStyles !== 'undefined' && factionShipStyles.displaySizeForClass)
            ? factionShipStyles.displaySizeForClass(cls)
            : { width: 32, height: 24 };
        const mul = 0.7;
        const fp = (typeof flightProfiles !== 'undefined' && flightProfiles.resolve)
            ? flightProfiles.resolve(rival, cls)
            : { speedMul: 1, wobbleAmp: 0.2, wobbleFreq: 0.8 };
        const dive = spd * (fp.speedMul || 1);
        demo.enemies.push({
            x: sx,
            y: sy,
            w: Math.max(20, Math.round(disp.width * mul)),
            h: Math.max(16, Math.round(disp.height * mul)),
            vx: (dx0 / len0) * dive,
            vy: (dy0 / len0) * dive,
            hp: 1,
            faction: rival,
            cls,
            fp,
            wobblePhase: Math.random() * Math.PI * 2
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

        const arriveR = planetR * 0.92;
        // Refresh orbit seats so every faction hull can aim from its live path.
        this._orbitPositions(planetX, planetY, planetR);
        const fleet = this._ensureOrbitFleet();
        const steps = Math.max(1, Math.round(dt / 16.67));
        for (let s = 0; s < steps; s++) {
            demo.enemies.forEach((e) => {
                // Keep steering toward the planet — no free wandering.
                const dx = planetX - e.x;
                const dy = planetY - e.y;
                const len = Math.max(1, Math.hypot(dx, dy));
                let spd = Math.max(0.35, Math.hypot(e.vx || 0, e.vy || 0));
                e.vx = (dx / len) * spd;
                e.vy = (dy / len) * spd;
                e.x += e.vx;
                e.y += e.vy;
                if (e.fp && e.fp.wobbleAmp > 0) {
                    e.wobblePhase = (e.wobblePhase || 0) + (e.fp.wobbleFreq || 0.8) * 0.08;
                    e.x += Math.sin(e.wobblePhase) * e.fp.wobbleAmp * 2.2;
                }
            });
            demo.enemies = demo.enemies.filter((e) => {
                if (e.hp <= 0) return false;
                // Reached the homeworld — dive complete.
                return Math.hypot(e.x - planetX, e.y - planetY) > arriveR;
            });

            const inbound = demo.enemies.filter((e) => {
                const d = Math.hypot(e.x - planetX, e.y - planetY);
                return d < fireRange && d > arriveR;
            });

            // Every orbiting faction hull fires — staggered cooldowns, from its seat.
            (fleet.ships || []).forEach((ship) => {
                if (ship.muzzle > 0) ship.muzzle -= 1;
                ship.cooldown = (ship.cooldown || 0) - 18 * speedMul;
                if (ship.cooldown > 0) return;
                const ax = ship._sx;
                const ay = ship._sy;
                if (ax == null || ay == null) return;
                const t = inbound.slice().sort((a1, b1) => {
                    const da = Math.hypot(a1.x - ax, a1.y - ay);
                    const db = Math.hypot(b1.x - ax, b1.y - ay);
                    return da - db;
                })[0] || null;
                if (!t) {
                    ship.aimDirX = 0;
                    ship.aimDirY = 1;
                    return;
                }
                const toX = t.x - ax;
                const toY = t.y - ay;
                const toLen = Math.max(1, Math.hypot(toX, toY));
                const dirX = toX / toLen;
                const dirY = toY / toLen;
                ship.aimDirX = dirX;
                ship.aimDirY = dirY;
                const fp = ship.fp || {};
                ship.cooldown = Math.round(
                    (200 + Math.random() * 180) / Math.max(0.65, speedMul * (fp.speedMul || 1))
                    + (ship.cls === 'capital' ? 120 : 0)
                );
                ship.muzzle = 8;
                const fx = this._weaponFx(ship.weapon);
                const shotSpeed = fx.speed * (0.75 + dmgMul * 0.45);
                const sw = ship._sw || 22;
                const sh = ship._sh || 18;
                const muzzleX = ax + dirX * (sw / 2);
                const muzzleY = ay + dirY * (sh / 2);
                for (let i = 0; i < fx.count; i++) {
                    const spread = fx.count > 1 ? (i - (fx.count - 1) / 2) * 0.22 : 0;
                    const cos = Math.cos(spread);
                    const sin = Math.sin(spread);
                    const sx = dirX * cos - dirY * sin;
                    const sy = dirX * sin + dirY * cos;
                    demo.shots.push({
                        x: muzzleX + (fx.kind === 'beam' && fx.count > 1
                            ? (i - (fx.count - 1) / 2) * 6 * -dirY : 0),
                        y: muzzleY + (fx.kind === 'beam' && fx.count > 1
                            ? (i - (fx.count - 1) / 2) * 6 * dirX : 0),
                        vx: sx * shotSpeed,
                        vy: sy * shotSpeed,
                        w: fx.w,
                        h: fx.h,
                        kind: fx.kind,
                        color: fx.color,
                        life: 90
                    });
                }
            });
            demo.allies = [];

            demo.shots.forEach((sh) => {
                sh.x += sh.vx;
                sh.y += sh.vy;
                sh.life -= 1;
            });
            demo.shots = demo.shots.filter((sh) => {
                if (sh.life <= 0 || sh.y < -20 || sh.y > H + 20 || sh.x < -20 || sh.x > W + 20) return false;
                if (Math.hypot(sh.x - planetX, sh.y - planetY) < arriveR * 0.85) return false;
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
            // Point the nose along the dive toward the planet (+Y = default hull facing).
            const ang = Math.atan2(e.vy || -1, e.vx || 0) - Math.PI / 2;
            c.rotate(ang);
            c.drawImage(sprite, -Math.floor(e.w / 2), -Math.floor(e.h / 2));
            c.restore();
        });

        // Allies are the orbiting faction hulls (drawn in _drawOrbitShips).

        demo.shots.forEach((sh) => {
            c.save();
            c.translate(Math.round(sh.x), Math.round(sh.y));
            c.fillStyle = sh.color || accent;
            if (sh.kind === 'beam') {
                c.fillRect(-Math.floor(sh.w / 2), 0, sh.w, sh.h);
            } else if (sh.kind === 'wave') {
                c.fillRect(-Math.floor(sh.w / 2), 0, sh.w, sh.h);
                c.globalAlpha = 0.45;
                c.fillRect(-Math.floor(sh.w / 2) - 4, 2, sh.w + 8, Math.max(2, sh.h - 2));
            } else if (sh.kind === 'missile') {
                c.fillRect(-Math.floor(sh.w / 2), 0, sh.w, sh.h);
                c.fillStyle = '#f87171';
                c.fillRect(-1, sh.h, 2, 3);
            } else if (sh.kind === 'blob') {
                c.beginPath();
                c.arc(0, Math.floor(sh.h / 2), Math.floor(sh.w / 2), 0, Math.PI * 2);
                c.fill();
            } else {
                c.fillRect(-Math.floor(sh.w / 2), 0, sh.w, sh.h);
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

    _orbitHullSprite(cls, w, h, factionId) {
        if (!this._orbitSpriteCache) this._orbitSpriteCache = Object.create(null);
        const fid = factionId || this._faction;
        const key = fid + '|' + cls + '|' + w + 'x' + h;
        let sprite = this._orbitSpriteCache[key];
        if (sprite) return sprite;
        const gm = typeof graphicsManager !== 'undefined' ? graphicsManager : null;
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
        // Transparent bake — no solid fill (that became bars) and no guns (wing mounts stuck out as bars).
        const enemy = {
            x: 0, y: 0, width: canvas.width, height: canvas.height,
            type: 'spaceship',
            faction: fid,
            enemyClass: cls,
            hullSeed: 1,
            tier: cls === 'capital' ? 3 : 1,
            level: cls === 'capital' ? 5 : 1,
            skipGuns: true
        };
        let ok = false;
        try {
            if (gm && gm.renderEnemyShip) {
                gm.renderEnemyShip(bc, enemy, 1);
                ok = true;
            }
        } catch (err) { ok = false; }
        if (!ok) {
            // Tiny silhouette only — never a full-canvas block.
            const cw = canvas.width, ch = canvas.height;
            const bw = Math.max(3, Math.floor(cw * 0.45));
            const bh = Math.max(4, Math.floor(ch * 0.7));
            const bx = Math.floor((cw - bw) / 2);
            const by = Math.floor((ch - bh) / 2);
            bc.fillStyle = edge;
            bc.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
            bc.fillStyle = hull;
            bc.fillRect(bx, by, bw, bh);
            bc.fillStyle = accent;
            bc.fillRect(bx + Math.floor(bw / 2) - 1, by + bh - 2, 2, 2);
        }
        this._orbitSpriteCache[key] = canvas;
        return canvas;
    }

    _drawOrbitRings(c, accent, cx, cy, r) {
        c.save();
        c.strokeStyle = accent;
        c.lineWidth = 1;
        // Three lanes only — enough to read orbits without per-frame ellipse spam.
        [1.28, 1.55, 1.82].forEach((mul, i) => {
            c.globalAlpha = 0.16 - i * 0.03;
            c.beginPath();
            c.ellipse(cx, cy, r * mul, r * mul * (0.52 + i * 0.04), -0.18, 0, Math.PI * 2);
            c.stroke();
        });
        c.restore();
    }

    _ensureOrbitFleet() {
        if (this._orbitFleet && this._orbitFleet.faction === this._faction) return this._orbitFleet;
        const fss = typeof factionShipStyles !== 'undefined' ? factionShipStyles : null;
        const ratingSpeed = this._statMul('speed');
        // Full class ladder — every hull of the faction orbits and can fire.
        const classes = (fss && fss.classes)
            ? fss.classes.slice()
            : ['scout', 'assault', 'heavy', 'elite', 'capital'];
        const ships = classes.map((cls, i) => {
            const disp = fss && fss.displaySizeForClass
                ? fss.displaySizeForClass(cls)
                : { width: 36 + i * 12, height: 28 + i * 8 };
            const isCapital = cls === 'capital';
            const fp = (typeof flightProfiles !== 'undefined' && flightProfiles.resolve)
                ? flightProfiles.resolve(this._faction, cls)
                : { speedMul: 1, wobbleAmp: 0.2, wobbleFreq: 0.8, formationTightness: 0.7 };
            const base = isCapital ? 0.00012 : (0.0002 + i * 0.000028);
            // In-game flightProfiles × rating SPEED drive orbit tempo.
            const tempo = base * ratingSpeed * fp.speedMul;
            const weapons = this._preferredWeapons();
            return {
                kind: 'ship',
                cls,
                orbit: isCapital ? 1.55 : (1.18 + i * 0.12),
                speed: (i % 2 === 0 ? 1 : -1) * tempo,
                phase: (i / Math.max(1, classes.length)) * Math.PI * 2 + i * 0.55,
                tilt: isCapital ? 0.42 : (0.46 + (i % 3) * 0.05),
                sizeMul: isCapital ? 1.55 : 1,
                baseW: disp.width,
                baseH: disp.height,
                fp,
                weapon: weapons[i % weapons.length],
                cooldown: 50 + i * 70 + Math.floor(Math.random() * 80),
                muzzle: 0,
                aimDirX: 0,
                aimDirY: 1
            };
        });
        this._orbitFleet = { faction: this._faction, ships };
        return this._orbitFleet;
    }

    _orbitPositions(cx, cy, r) {
        const fleet = this._ensureOrbitFleet();
        const t = this._reduceMotion ? 0 : Date.now();
        // Stage homeworld needs readable hulls — old 0.18–0.38 made everything pin-dots.
        const scale = Math.max(0.55, Math.min(0.95, (r * 0.42) / 48));
        const tight = fleet.ships[0] && fleet.ships[0].fp
            ? fleet.ships[0].fp.formationTightness : 0.7;
        return fleet.ships.map((s, i) => {
            const a = s.phase + t * s.speed;
            const fp = s.fp || {};
            // Faction wobble (voidborn swirls, machine locks, kronax drives straight).
            const wobble = this._reduceMotion ? 0
                : Math.sin(t * 0.001 * (fp.wobbleFreq || 0.8) + i) * (fp.wobbleAmp || 0) * 10;
            const rx = r * s.orbit * (0.92 + tight * 0.08);
            const ry = rx * s.tilt;
            const sx = Math.round(cx + Math.cos(a) * rx + wobble);
            const sy = Math.round(cy + Math.sin(a) * ry + wobble * 0.35);
            const mul = scale * (s.sizeMul || 1);
            const w = Math.max(18, Math.round(s.baseW * mul));
            const h = Math.max(14, Math.round(s.baseH * mul));
            // Hysteresis so front/back layer doesn't pop when sin(a) ≈ 0.
            const sn = Math.sin(a);
            if (s._front == null) s._front = sn >= 0;
            else if (s._front && sn < -0.18) s._front = false;
            else if (!s._front && sn > 0.18) s._front = true;
            s._sx = sx;
            s._sy = sy;
            s._sw = w;
            s._sh = h;
            return {
                kind: s.kind || 'ship',
                cls: s.cls,
                ship: s,
                sx, sy, w, h,
                front: s._front,
                muzzle: s.muzzle || 0,
                alpha: 0.88
            };
        });
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
                // Face the current aim when firing; otherwise stay upright.
                const ship = s.ship;
                if (ship && ship.muzzle > 0 && (ship.aimDirX || ship.aimDirY)) {
                    c.rotate(Math.atan2(ship.aimDirY, ship.aimDirX) - Math.PI / 2);
                }
                const sprite = this._orbitHullSprite(s.cls, s.w, s.h);
                c.drawImage(sprite, -Math.floor(s.w / 2), -Math.floor(s.h / 2));
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
            const cy = this.H * 0.5;
            const r = this._fitRadius(cx, cy, size * 0.42);
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
