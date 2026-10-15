"use strict";

// Voxel pilot portraits, part 3/3: canvas front end. Painted portraits take priority over the generator: put a 4x4 sheet
// at assets/factions/<faction>/portraits.png (16 equal cells, row by row) or single files .../portraits/01.png..16.png
// (listed by factionPacks, so nothing is probed with 404s). canvasHtml(look, accent) returns a <canvas> that scan()/register()
// fill with VXP.build; every portrait blinks now and then. A look is { faction, v } with v = 0..15 (the preset).
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
        e.canvas.width = a.w; e.canvas.height = a.h;
        e.ctx.imageSmoothingEnabled = false;
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
    function draw(e, blink) {
        if (e.painted) return;
        const k = blink ? 1 : 0;
        if (!e.head) e.head = [null, null];
        if (!e.head[k]) e.head[k] = VXP.build(e.preset, e.accent, blink, true);
        if (!e.img) e.img = e.ctx.createImageData(VXP.W, VXP.H);
        const t = reduceMotion() ? 0 : (performance.now() - e.t0) / 1000;
        const bg = VXP.background(e.preset.faction, t, e.accent, e.preset.bgv), head = e.head[k], dst = e.img.data;
        // In the portrait picker the selected tile shows the full, brighter backdrop and the others a subdued one
        // (the pilots themselves stay equally bright).
        const pick = e.canvas.closest && e.canvas.closest('.pp-pick');
        if (pick) { const bk = pick.classList.contains('selected') ? 1.18 : 0.5; for (let i = 0; i < bg.length; i += 4) { bg[i] *= bk; bg[i + 1] *= bk; bg[i + 2] *= bk; } }
        // Backdrop gradients are posterised into hard colour bands (no soft ramps), like the rest of the pixel art.
        const Q = 28;
        for (let i = 0; i < bg.length; i += 4) { bg[i] = Math.round(bg[i] / Q) * Q; bg[i + 1] = Math.round(bg[i + 1] / Q) * Q; bg[i + 2] = Math.round(bg[i + 2] / Q) * Q; }
        // The pilot sits a little smaller (anchored bottom centre) so more of the faction world shows around the head.
        const SC = 0.8, W = VXP.W, H = VXP.H, cx = W / 2, by = H - 1;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            const o = (y * W + x) * 4, sx = Math.round(cx + (x - cx) / SC), sy = Math.round(by + (y - by) / SC);
            const ho = sx >= 0 && sy >= 0 && sx < W && sy < H ? (sy * W + sx) * 4 : -1, a = ho < 0 ? 0 : head[ho + 3] / 255;
            dst[o] = ho < 0 ? bg[o] : head[ho] * a + bg[o] * (1 - a);
            dst[o + 1] = ho < 0 ? bg[o + 1] : head[ho + 1] * a + bg[o + 1] * (1 - a);
            dst[o + 2] = ho < 0 ? bg[o + 2] : head[ho + 2] * a + bg[o + 2] * (1 - a);
            dst[o + 3] = 255;
        }
        present(e);
    }
    const io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver((list) => list.forEach((r) => { if (r.target.__vx) r.target.__vx.vis = r.isIntersecting; })) : null;
    function register(canvas) {
        if (canvas.__vx || !canvas.getContext) return;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;   // no Canvas2D (ancient / locked-down browsers)
        let look = null;
        try { look = JSON.parse(canvas.dataset.look); } catch (err) { look = null; }
        look = lookOf(look);
        ctx.imageSmoothingEnabled = false;
        if ('mozImageSmoothingEnabled' in ctx) ctx.mozImageSmoothingEnabled = false;
        if ('webkitImageSmoothingEnabled' in ctx) ctx.webkitImageSmoothingEnabled = false;
        const e = { canvas, ctx, preset: VXP.preset(look.faction, look.v), accent: canvas.dataset.accent || null, next: performance.now() + 1500 + Math.random() * 3500, coarse: canvas.dataset.coarse === '1', blinkUntil: 0, t0: performance.now() - Math.random() * 4000, vis: true };
        canvas.__vx = e;
        entries.add(e);
        if (io) io.observe(canvas);
        draw(e, false);
        painted(look.faction, ((look.v | 0) % VXP.COUNT + VXP.COUNT) % VXP.COUNT).then((a) => { if (a && canvas.isConnected) drawPainted(e, a); });
        if (!timer) timer = setInterval(tick, 90);
    }
    function tick() {
        const now = performance.now();
        for (const e of entries) {
            if (!e.canvas.isConnected) { entries.delete(e); if (io) io.unobserve(e.canvas); continue; }
            if (e.painted || e.vis === false || document.hidden) continue;
            if (now >= e.next) { e.blinkUntil = now + 130; e.next = now + 3000 + Math.random() * 4000; }
            draw(e, now < e.blinkUntil);
        }
        if (!entries.size) { clearInterval(timer); timer = 0; }
    }
    const scan = (root) => (root || document).querySelectorAll('canvas.vx-portrait').forEach(register);
    function observe() {
        new MutationObserver((muts) => {
            for (const m of muts) m.addedNodes.forEach((n) => { if (n.nodeType === 1) { if (n.matches && n.matches('canvas.vx-portrait')) register(n); else if (n.querySelectorAll) scan(n); } });
        }).observe(document.documentElement, { childList: true, subtree: true });
        const st = document.createElement('style');
        st.textContent = [
            'canvas.hero-portrait.vx-portrait{display:block;width:100%;height:auto;image-rendering:pixelated;-ms-interpolation-mode:nearest-neighbor;object-fit:cover;object-position:50% 0}',
            '.pp-pick canvas.hero-portrait.vx-portrait{width:100%!important;height:100%!important;object-fit:contain!important;object-position:50% 50%!important}',
            '.profile-pilot-portrait canvas.hero-portrait.vx-portrait{width:100%!important;height:100%!important;object-fit:cover!important;object-position:50% 0!important}'
        ].join('');
        document.head.appendChild(st);
        scan(document);
    }
    function canvasHtml(look, accent, opts) {
        return `<canvas class="hero-portrait vx-portrait" width="${VXP.W}" height="${VXP.H}" data-look='${esc(JSON.stringify(lookOf(look)))}'${accent ? ` data-accent="${esc(accent)}"` : ''}${opts && opts.coarse ? ' data-coarse="1"' : ''} role="img" aria-label="Pilot portrait"></canvas>`;
    }
    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observe); else observe();
    }
    return { canvasHtml, register, scan, draw };
})();
