"use strict";

// Voxel pilot portraits, part 3/3: canvas front end. Painted portraits take priority over the generator: put a 4x4 sheet
// at assets/factions/<faction>/portraits.png (16 equal cells, row by row) or single files .../portraits/01.png..16.png
// (listed by factionPacks, so nothing is probed with 404s). canvasHtml(look, accent) returns a <canvas> that scan()/register()
// fill with VXP.build; every portrait blinks now and then. A look is { faction, v } with v = 0..15 (the preset).
// opts.state (data-state): 0 healthy, 1 wounded, 2 dead, 3 joy, 4 anger; a dead pilot never blinks. setState() changes it live.
const voxelPortrait = (() => {
    const entries = new Set();
    let timer = 0;
    const lookOf = (look) => (typeof look === 'string' ? { faction: look, v: 0 } : (look || { faction: 'terran', v: 0 }));
    const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/'/g, '&#39;').replace(/"/g, '&quot;');

    // Painted art: one sheet per faction (4x4 cells) or single numbered files; resolves to a drawer or null.
    const loadImg = (src) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
    const cache = {};
    const img = (src) => cache[src] || (cache[src] = loadImg(src));
    async function painted(f, v) {
        if (typeof factionPacks === 'undefined') return null;
        await factionPacks.ready;
        if (factionPacks.has(f, 'portraits.png')) {
            const sh = await img(factionPacks.url(f, 'portraits.png'));
            if (sh) { const cw = Math.floor(sh.width / 4), ch = Math.floor(sh.height / 4); return { img: sh, sx: (v % 4) * cw, sy: Math.floor(v / 4) * ch, w: cw, h: ch }; }
        }
        const name = 'portraits/' + String(v + 1).padStart(2, '0') + '.png';
        if (factionPacks.has(f, name)) { const im = await img(factionPacks.url(f, name)); if (im) return { img: im, sx: 0, sy: 0, w: im.width, h: im.height }; }
        return null;
    }
    function drawPainted(e, a) {
        e.painted = true;
        e.art = a;
        e.ctx.filter = 'none';
        e.canvas.width = a.w; e.canvas.height = a.h;
        e.ctx.imageSmoothingEnabled = false;
        if ((e.state === 1 || e.state === 2) && 'filter' in e.ctx) e.ctx.filter = e.state === 2 ? 'grayscale(0.7) brightness(0.65)' : 'sepia(0.35) saturate(1.4) hue-rotate(-20deg)';
        e.ctx.drawImage(a.img, a.sx, a.sy, a.w, a.h, 0, 0, a.w, a.h);
    }
    // The pilot (head layer, transparent background) is built once per blink state; the faction backdrop is repainted
    // every animation frame behind it (voxel-portrait-bg.js).
    const reduceMotion = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    // coarse canvases (the small picker tiles) are drawn at half resolution: 2x2 averaged, shown with hard pixels.
    function present(e) {
        if (!e.coarse) { e.ctx.putImageData(e.img, 0, 0); return; }
        const W = VXP.W, H = VXP.H, w = W >> 1, h = H >> 1, src = e.img.data;
        if (e.canvas.width !== w) { e.canvas.width = w; e.canvas.height = h; }
        if (!e.small) e.small = e.ctx.createImageData(w, h);
        const d = e.small.data;
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            const o = (y * w + x) * 4;
            for (let c = 0; c < 3; c++) {
                const i = (y * 2 * W + x * 2) * 4 + c;
                d[o + c] = (src[i] + src[i + 4] + src[i + W * 4] + src[i + W * 4 + 4]) >> 2;
            }
            d[o + 3] = 255;
        }
        e.ctx.putImageData(e.small, 0, 0);
    }
    // Rows rendered above the 48x54 head buffer: at SC 0.74 the canvas top samples ~17 rows above it,
    // so tall helmets / hats show in full instead of ending in a flat cut.
    const HEAD_PAD = 18;
    function draw(e, blink) {
        if (e.painted) return;
        const k = blink ? 1 : 0;
        if (e.nobg && e.lastK === k) return;   // backdrop-free portrait: nothing animates except the blink, repaint only on change
        e.lastK = k;
        if (!e.head) e.head = [null, null];
        if (!e.head[k]) e.head[k] = VXP.build(e.preset, e.accent, blink, true, e.state, HEAD_PAD);
        if (!e.img) e.img = e.ctx.createImageData(VXP.W, VXP.H);
        const t = reduceMotion() ? 0 : (performance.now() - e.t0) / 1000;
        const head = e.head[k], dst = e.img.data;
        const bg = e.nobg ? new Uint8ClampedArray(VXP.W * VXP.H * 4) : VXP.background(e.preset.faction, t, e.accent, e.preset.bgv);
        // In the portrait picker the selected tile shows the full, brighter backdrop and the others a subdued one
        // (the pilots themselves stay equally bright).
        const pick = e.canvas.closest && e.canvas.closest('.pp-pick');
        if (pick) { const bk = pick.classList.contains('selected') ? 1.18 : 0.5; for (let i = 0; i < bg.length; i += 4) { bg[i] *= bk; bg[i + 1] *= bk; bg[i + 2] *= bk; } }
        // Backdrop gradients are posterised into hard colour bands (no soft ramps), like the rest of the pixel art.
        const Q = 28;
        for (let i = 0; i < bg.length; i += 4) { bg[i] = Math.round(bg[i] / Q) * Q; bg[i + 1] = Math.round(bg[i + 1] / Q) * Q; bg[i + 2] = Math.round(bg[i + 2] / Q) * Q; }
        // The pilot sits a little smaller (anchored a few rows above the bottom edge, not on it)
        // so the faction world shows all around the head, chin included.
        const SC = 0.74, W = VXP.W, H = VXP.H, cx = W / 2, by = H - 1 - 6;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            const o = (y * W + x) * 4, sx = Math.round(cx + (x - cx) / SC), sy = Math.round(by + (y - by) / SC);
            const ho = sx >= 0 && sy >= -HEAD_PAD && sx < W && sy < H ? ((sy + HEAD_PAD) * W + sx) * 4 : -1, a = ho < 0 ? 0 : head[ho + 3] / 255;
            if (e.nobg) { dst[o] = ho < 0 ? 0 : head[ho]; dst[o + 1] = ho < 0 ? 0 : head[ho + 1]; dst[o + 2] = ho < 0 ? 0 : head[ho + 2]; dst[o + 3] = Math.round(a * 255); continue; }
            dst[o] = ho < 0 ? bg[o] : head[ho] * a + bg[o] * (1 - a);
            dst[o + 1] = ho < 0 ? bg[o + 1] : head[ho + 1] * a + bg[o + 1] * (1 - a);
            dst[o + 2] = ho < 0 ? bg[o + 2] : head[ho + 2] * a + bg[o + 2] * (1 - a);
            dst[o + 3] = e.nobg ? Math.round(a * 255) : 255;
        }
        present(e);
    }
    // Body stage-scale transforms make IntersectionObserver false-negative in Safari /
    // Firefox; treat IO as a hint and confirm with a viewport rect before skipping.
    const io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver((list) => list.forEach((r) => { if (r.target.__vx) r.target.__vx.vis = r.isIntersecting; })) : null;
    function onScreen(el) {
        const r = el.getBoundingClientRect();
        const vh = window.innerHeight || document.documentElement.clientHeight || 0;
        const vw = window.innerWidth || document.documentElement.clientWidth || 0;
        return r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < vh && r.left < vw;
    }
    function register(canvas) {
        if (canvas.__vx || !canvas.getContext) return;
        const nobg = canvas.dataset.nobg === '1';
        const ctx = canvas.getContext('2d', { alpha: !!nobg });
        if (!ctx) return;   // no Canvas2D (ancient / locked-down browsers)
        let look = null;
        try { look = JSON.parse(canvas.dataset.look); } catch (err) { look = null; }
        look = lookOf(look);
        ctx.imageSmoothingEnabled = false;
        if ('mozImageSmoothingEnabled' in ctx) ctx.mozImageSmoothingEnabled = false;
        if ('webkitImageSmoothingEnabled' in ctx) ctx.webkitImageSmoothingEnabled = false;
        if ('msImageSmoothingEnabled' in ctx) ctx.msImageSmoothingEnabled = false;
        const e = { canvas, ctx, preset: VXP.preset(look.faction, look.v), accent: canvas.dataset.accent || null, next: performance.now() + 1500 + Math.random() * 3500, coarse: canvas.dataset.coarse === '1', nobg: nobg, state: Math.max(0, Math.min(4, parseInt(canvas.dataset.state, 10) || 0)), blinkUntil: 0, t0: performance.now() - Math.random() * 4000, vis: true };
        canvas.__vx = e;
        entries.add(e);
        if (io) io.observe(canvas);
        draw(e, false);
        (nobg ? Promise.resolve(null) : painted(look.faction, ((look.v | 0) % VXP.COUNT + VXP.COUNT) % VXP.COUNT)).then((a) => { if (a && canvas.isConnected) drawPainted(e, a); });
        if (!timer) timer = requestAnimationFrame(loop);
    }
    // rAF (not setInterval): stays in sync with the compositor across Chrome / Firefox / Safari / Edge.
    let lastTick = 0;
    function loop(now) {
        timer = 0;
        if (!entries.size) return;
        if (now - lastTick >= 90) {
            lastTick = now;
            tick(now);
        }
        if (entries.size) timer = requestAnimationFrame(loop);
    }
    function tick(now) {
        now = now || performance.now();
        for (const e of entries) {
            if (!e.canvas.isConnected) { entries.delete(e); if (io) io.unobserve(e.canvas); continue; }
            if (e.painted || document.hidden) continue;
            if (e.vis === false && !onScreen(e.canvas)) continue;
            if (now >= e.next && e.state !== 2) { e.blinkUntil = now + 130; e.next = now + 3000 + Math.random() * 4000; }
            draw(e, now < e.blinkUntil);
        }
    }
    /** Switch a live portrait's expression (0 healthy, 1 wounded/pain, 2 dead, 3 joy, 4 anger) and repaint at once. */
    function setState(canvas, state) {
        const e = canvas && canvas.__vx;
        const s = Math.max(0, Math.min(4, state | 0));
        if (!e || e.state === s) return;
        e.state = s;
        e.head = null;
        e.lastK = null;
        if (s === 2) e.blinkUntil = 0;
        if (e.painted) { if (e.art) drawPainted(e, e.art); return; }
        draw(e, false);
    }
    const scan = (root) => (root || document).querySelectorAll('canvas.vx-portrait').forEach(register);
    function observe() {
        new MutationObserver((muts) => {
            for (const m of muts) m.addedNodes.forEach((n) => { if (n.nodeType === 1) { if (n.matches && n.matches('canvas.vx-portrait')) register(n); else if (n.querySelectorAll) scan(n); } });
        }).observe(document.documentElement, { childList: true, subtree: true });
        const st = document.createElement('style');
        // image-rendering stack: Firefox (-moz-crisp-edges), Safari (-webkit-optimize-contrast),
        // Chrome/Edge (pixelated), legacy IE (nearest-neighbor). Avoid CSS filter on canvas ancestors —
        // Safari freezes putImageData updates under filter.
        st.textContent = [
            'canvas.hero-portrait.vx-portrait{display:block;width:100%;height:auto;image-rendering:-moz-crisp-edges;image-rendering:-webkit-optimize-contrast;image-rendering:pixelated;image-rendering:crisp-edges;-ms-interpolation-mode:nearest-neighbor;object-fit:cover;object-position:50% 0}',
            '.pp-pick canvas.hero-portrait.vx-portrait{width:100%!important;height:100%!important;object-fit:contain!important;object-position:50% 50%!important}',
            '.profile-pilot-portrait canvas.hero-portrait.vx-portrait{width:100%!important;height:100%!important;object-fit:cover!important;object-position:50% 0!important}',
            '.pp-pick.selected{filter:none!important}'
        ].join('');
        document.head.appendChild(st);
        scan(document);
    }
    function canvasHtml(look, accent, opts) {
        return `<canvas class="hero-portrait vx-portrait" width="${VXP.W}" height="${VXP.H}" data-look='${esc(JSON.stringify(lookOf(look)))}'${accent ? ` data-accent="${esc(accent)}"` : ''}${opts && opts.coarse ? ' data-coarse="1"' : ''}${opts && opts.nobg ? ' data-nobg="1"' : ''}${opts && opts.state ? ` data-state="${opts.state | 0}"` : ''} role="img" aria-label="Pilot portrait"></canvas>`;
    }
    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observe); else observe();
    }
    return { canvasHtml, register, scan, draw, setState };
})();
