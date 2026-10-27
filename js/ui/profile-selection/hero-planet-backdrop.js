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
        this._frameInterval = 1000 / 24;
        this._reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (typeof ResizeObserver !== 'undefined') {
            this._ro = new ResizeObserver(() => this._syncSize());
        }
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
        const dpr = window.devicePixelRatio || 1;
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
            // A fixed-step accumulator, not "now - lastT < interval, else lastT = now": that
            // re-bases the clock to whatever imprecise moment rAF happened to fire, so the REAL
            // gap between accepted draws drifted with rAF's own ~16ms granularity instead of
            // staying a steady multiple of the interval — a continuous low-level stutter even
            // once every frame was long cached and decode time was no longer a factor at all.
            if (!this._lastT) this._lastT = now;
            this._accum += now - this._lastT;
            this._lastT = now;
            if (this._accum < this._frameInterval) return;
            this._accum -= this._frameInterval;
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
        const loading = this._frameLoading;
        const cache = this._frameCache;
        loading[f] = true;
        try {
            const svg = planetSVGManager.getPlanetSpinFrame(model, f);
            const conv = planetSVGManager.planetSvgToImg(svg, 0.45);
            const img = new Image();
            const store = (src) => {
                loading[f] = false;
                // A faction switch swapped the model while this frame decoded: it belongs to the old planet.
                if (this._spinModel !== model || this._frameCache !== cache) return;
                cache[f] = { img: src, scale: conv.scale };
                // No loop running (reduced motion, not yet mounted): paint it now.
                if (!this._raf) this.draw();
            };
            img.onload = () => {
                if (typeof createImageBitmap === 'function') createImageBitmap(img).then(store, () => store(img));
                else store(img);
            };
            img.src = conv.url;
        } catch (err) { loading[f] = false; }
    }

    _currentFrame(advance) {
        const model = this._spinModel;
        const id = this._spinId;
        if (!model || !id || typeof planetSVGManager === 'undefined') return this._curFrame;
        if (this._frameIdx == null) this._frameIdx = 0;
        // Keep each frame as a bitmap (re-rasterising the 300KB SVG on every drawImage was the idle cost),
        // and step the spin so one rotation is at most 256 slots: after the first lap nothing is rebuilt.
        // _frameIdx counts slots, not model frames, so the wrap always lands back on slot 0. 256 here
        // against the doubled 24fps draw rate (was 128/12) keeps the same real-world rotation period
        // at twice the angular resolution, instead of just spinning twice as fast.
        const step = Math.max(1, Math.ceil(model.count / 256));
        const slots = Math.max(1, Math.ceil(model.count / step));
        const slot = this._frameIdx % slots;
        const f = slot * step;
        const cached = this._frameCache[f];
        if (cached) {
            // Cached: show it and move on at the loop's draw rate (previously it never advanced, so the spin froze after lap one).
            // Resize/faction redraws and reduced motion only repaint.
            this._curFrame = cached;
            if (advance) this._frameIdx = (slot + 1) % slots;
            // Kick off the NEXT slot's decode now, while this already-cached one is on screen,
            // instead of only reacting once playback actually reaches an uncached slot — that
            // reactive-only loading was the stutter: every slot it hadn't pre-decoded yet stalled
            // the spin for exactly as long as the rasterize+decode took, reported as "ruckelig".
            this._loadFrame(model, ((slot + 1) % slots) * step);
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
        // Re-measure the element's own box right before painting, instead of
        // trusting the cached this.W/this.H from the last ResizeObserver
        // tick, which only fires on box-size changes, not on reflow caused
        // by surrounding layout settling (card reveal transitions, sibling
        // height changes) — a stale size here would drift the glow and disc
        // off the real planet position together.
        this._inDraw = true;
        this._syncSize();
        this._inDraw = false;
        if (!this.W || !this.H) return;
        c.clearRect(0, 0, this.W, this.H);
        const pal = (typeof factionShipStyles !== 'undefined' && factionShipStyles.getFactionStyle)
            ? factionShipStyles.getFactionStyle(this._faction) : null;
        const accent = (pal && (pal.accent || pal.hull)) || '#7ec8ff';
        const stage = this._stageRect();
        const frame = this._currentFrame(advance);
        const cx = stage.cx, cy = stage.cy, r = stage.r;

        c.save();
        c.beginPath();
        c.rect(stage.x, stage.y, stage.w, stage.h);
        c.clip();

        // Disc: opaque base so the full circle always shows, spin frame (and its
        // baked atmosphere halo) drawn on top without clipping it to the disc radius.
        if (frame) {
            const dr = r * frame.scale;
            c.save();
            c.beginPath();
            c.arc(cx, cy, r, 0, Math.PI * 2);
            c.clip();
            c.fillStyle = accent + '2a';
            c.fill();
            c.restore();
            c.save();
            c.imageSmoothingEnabled = false;
            c.globalAlpha = 0.85;
            c.drawImage(frame.img, cx - dr, cy - dr, dr * 2, dr * 2);
            c.restore();
            // A slow pulse right at the halo's own outer edge — separate from the baked pixel-art
            // dither (so it doesn't disturb that look), a "living atmosphere" breathing accent
            // layered on top. Both opacity AND radius move with the pulse (not opacity alone) —
            // a much more noticeable breathing motion than a flat ring just fading in and out in
            // place ("mehr Animation").
            const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 1400);
            c.save();
            c.globalAlpha = 0.18 + pulse * 0.24;
            c.strokeStyle = accent;
            c.lineWidth = Math.max(1.5, r * 0.035);
            c.beginPath();
            c.arc(cx, cy, dr * (0.94 + pulse * 0.05), 0, Math.PI * 2);
            c.stroke();
            c.restore();
        } else {
            // No frame decoded yet: a plain ring placeholder so something is visible while it loads.
            c.lineWidth = Math.max(1.5, r * 0.03);
            c.strokeStyle = accent + 'b0';
            c.beginPath();
            c.arc(cx, cy, r, 0, Math.PI * 2);
            c.stroke();
        }
        c.restore();
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
