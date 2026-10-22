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
        this._faction = null;
        this._spinModel = null;
        this._spinId = null;
        this._frameCache = {};
        this._frameLoading = {};
        this._curFrame = null;
        this._raf = 0;
        this._lastT = 0;
        this._frameInterval = 1000 / 12;
        this._reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (typeof ResizeObserver !== 'undefined') {
            this._ro = new ResizeObserver(() => this._syncSize());
        }
    }

    mount(container) {
        if (!container) return;
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
        this._syncSize();
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
        if (!(gp > 0)) return def;
        const w = (this.el && this.el.clientWidth) || window.innerHeight;
        return Math.max(1, Math.min(16, Math.round(w / (18 * gp))));
    }

    setFaction(factionId) {
        const faction = String(factionId || 'pirate').toLowerCase();
        if (faction === this._faction) return;
        this._faction = faction;
        if (typeof planetSVGManager === 'undefined' || !planetSVGManager.getHeroPlanetSpinModel) return;
        try {
            const model = planetSVGManager.getHeroPlanetSpinModel(faction, this._pixelDetail(16));
            if (!model || model === this._spinModel) return;
            this._spinId = 'hero-' + faction;
            this._spinModel = model;
            this._frameCache = {};
            this._frameLoading = {};
            this._frameIdx = 0;
            // Drop the previous faction's frame: showing it until the new raster lands read as "wrong planet".
            this._curFrame = null;
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
        const dpr = window.devicePixelRatio || 1;
        this.el.width = Math.round(w * dpr);
        this.el.height = Math.round(h * dpr);
        this.el.style.width = w + 'px';
        this.el.style.height = h + 'px';
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.draw();
    }

    _startLoop() {
        if (this._raf) return;
        const tick = (now) => {
            if (!this.el.isConnected) {
                this._raf = 0;
                return;
            }
            this._raf = requestAnimationFrame(tick);
            if (document.hidden) return;
            try {
                const st = getComputedStyle(this.el);
                if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) === 0) return;
            } catch (e) { /* draw */ }
            if (now - this._lastT < this._frameInterval) return;
            this._lastT = now;
            this.draw();
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
    _currentFrame() {
        const model = this._spinModel;
        const id = this._spinId;
        if (!model || !id || typeof planetSVGManager === 'undefined') return this._curFrame;
        if (this._frameIdx == null) this._frameIdx = 0;
        const f = this._frameIdx;
        const cached = this._frameCache[f];
        if (cached) { this._curFrame = cached; return cached; }
        if (!this._frameLoading[f]) {
            const loading = this._frameLoading;
            const cache = this._frameCache;
            loading[f] = true;
            try {
                const svg = planetSVGManager.getPlanetSpinFrame(model, f);
                const conv = planetSVGManager.planetSvgToImg(svg, 0.45);
                const img = new Image();
                // Keep each frame as a bitmap (re-rasterising the 300KB SVG on every drawImage was the idle cost),
                // and step the spin so one rotation is at most 128 frames: after the first lap nothing is rebuilt.
                const step = Math.max(1, Math.ceil(model.count / 128));
                const store = (src) => {
                    loading[f] = false;
                    // A faction switch swapped the model while this frame decoded: it belongs to the old planet.
                    if (this._spinModel !== model || this._frameCache !== cache) return;
                    const entry = { img: src, scale: conv.scale };
                    this._frameCache[f] = entry;
                    // Show it the moment it's ready — the next draw() tick would otherwise have
                    // already moved _frameIdx past `f` before ever reading this cache entry.
                    this._curFrame = entry;
                    // Only advance to the next frame once this one is actually ready to show.
                    if (this._frameIdx === f) this._frameIdx = (f + step) % model.count;
                    this.draw();
                };
                img.onload = () => {
                    if (typeof createImageBitmap === 'function') createImageBitmap(img).then(store, () => store(img));
                    else store(img);
                };
                img.src = conv.url;
            } catch (err) { loading[f] = false; }
        }
        return this._curFrame;
    }

    draw() {
        const c = this.ctx;
        if (!this.W || !this.H) return;
        c.clearRect(0, 0, this.W, this.H);
        const pal = (typeof factionShipStyles !== 'undefined' && factionShipStyles.getFactionStyle)
            ? factionShipStyles.getFactionStyle(this._faction) : null;
        const accent = (pal && (pal.accent || pal.hull)) || '#7ec8ff';
        // Bigger than the in-game globes: dominates the card as a hero visual.
        const r = Math.min(this.W, this.H) * 0.62;
        const cx = this.W * 0.5;
        const cy = this.H * 0.48;
        // Soft atmosphere glow, under the disc.
        const g = c.createRadialGradient(cx, cy, r * 0.6, cx, cy, r * 1.35);
        g.addColorStop(0, accent + '55');
        g.addColorStop(1, accent + '00');
        c.fillStyle = g;
        c.fillRect(0, 0, this.W, this.H);
        const frame = this._currentFrame();
        if (frame) {
            const dr = r * frame.scale;
            c.save();
            c.beginPath();
            c.arc(cx, cy, r, 0, Math.PI * 2);
            c.clip();
            c.imageSmoothingEnabled = false;
            c.drawImage(frame.img, cx - dr, cy - dr, dr * 2, dr * 2);
            c.restore();
        }
    }
}
