"use strict";

/**
 * Scales app content to fill the viewport while preserving aspect ratios.
 * Playfield-first: maximize the fight canvas (full center-column height), then
 * give leftover width to the side HUD panels.
 */
(function () {
    const ROOT = document.documentElement;
    const DEFAULT_ASPECT = 0.8;
    const DEFAULT_DESIGN_W = 480;
    const DEFAULT_DESIGN_H = 600;
    const SIZE_EPS = 2;
    const RO_SUPPRESS_MS = 80;
    const SIDE_MIN = 140;
    const SIDE_MAX = 280;
    // Compact overlay chrome (title + ?) — not measured from DOM (would under-size fight)
    const OVERLAY_CHROME = 8;

    let lastApplied = { canvasW: 0, canvasH: 0, sidePanel: 0 };
    let suppressROUntil = 0;
    let secondPassToken = 0;

    function clamp(n, min, max) {
        return Math.max(min, Math.min(max, n));
    }

    function readCssNumber(name, fallback) {
        const raw = getComputedStyle(ROOT).getPropertyValue(name).trim();
        const n = parseFloat(raw);
        return Number.isFinite(n) ? n : fallback;
    }

    function playfieldParams() {
        const aspect = clamp(readCssNumber('--playfield-aspect', DEFAULT_ASPECT), 0.45, 1.4);
        return {
            aspect: aspect,
            designW: DEFAULT_DESIGN_W,
            designH: Math.max(240, Math.round(DEFAULT_DESIGN_W / aspect))
        };
    }

    const STAGE_ASPECT = 4 / 3;
    const STAGE_FILL = 0.95;
    const LAYOUT_W = 1280;

    // Selectable resolutions (4:3). The layout is always identical (LAYOUT_W); the
    // resolution only sets the displayed size of the screen, capped by the window.
    const RES_STEPS = [640, 800, 1024, 1280, 1440, 1600, 1920, 2560];
    const RES_KEY = 'vf-stage-res';
    let resIndex = 5;
    try {
        const saved = parseInt(localStorage.getItem(RES_KEY), 10);
        if (saved >= 0 && saved < RES_STEPS.length) resIndex = saved;
    } catch (e) { /* storage unavailable */ }

    // The layout always runs at the chosen logical resolution (RES x RES*3/4);
    // the whole stage is then scaled uniformly (CSS transform) to fit the window
    // to fill STAGE_FILL (95 %) of the window. Proportions never change.
    function viewportSize() {
        const vv = window.visualViewport;
        let w = window.innerWidth || document.documentElement.clientWidth || 800;
        let h = window.innerHeight || document.documentElement.clientHeight || 600;
        if (vv && vv.width > 0 && vv.height > 0) {
            w = vv.width;
            h = vv.height;
        }
        // Layout is ALWAYS LAYOUT_W x LAYOUT_H, so every resolution looks identical;
        // the stage is always scaled to the window.
        const lw = LAYOUT_W;
        const lh = LAYOUT_W / STAGE_ASPECT;
        // The stage always fills FILL of the window, horizontally or vertically
        // (whichever limits first), with the 4:3 proportions untouched.
        const fit = Math.min(w * STAGE_FILL / lw, h * STAGE_FILL / lh);
        const scale = Math.max(0.05, fit);
        return { vw: lw, vh: Math.round(lh), scale: scale };
    }

    function resLabel(real) {
        return RES_STEPS[resIndex] + '×' + Math.round(RES_STEPS[resIndex] * 3 / 4);
    }

    // Global bezel around the stage with the resolution slider.
    function ensureBezel() {
        let el = document.getElementById('vf-res');
        if (el) return el;
        // The frame is static in index.html (painted with the first frame); create only as a fallback.
        if (!document.getElementById('vf-bezel')) {
            const frame = document.createElement('div');
            frame.id = 'vf-bezel';
            frame.className = 'vf-bezel';
            const back = document.createElement('div');
            back.className = 'vf-bezel-back';
            back.setAttribute('aria-hidden', 'true');
            frame.appendChild(back);
            document.body.appendChild(frame);
        }
        el = document.createElement('label');
        el.id = 'vf-res';
        el.className = 'vf-bezel-res';
        el.style.display = 'none';
        el.innerHTML = '<span>RES</span>' +
            '<input type="range" id="vfResSlider" min="0" max="' + (RES_STEPS.length - 1) + '" step="1" aria-label="Resolution">' +
            '<output id="vfResValue"></output>';
        // Child of <html>, not of the scaled body, so the slider keeps its pixel size.
        document.documentElement.appendChild(el);
        const input = el.querySelector('input');
        const out = el.querySelector('output');
        const fill = function () { input.style.setProperty('--look-fill', (input.value / (RES_STEPS.length - 1) * 100) + '%'); };
        input.value = String(resIndex);
        fill();
        // Dragging only previews the label; the stage resizes on release so the
        // slider never moves under the cursor.
        input.addEventListener('input', function () {
            fill();
            const i = parseInt(input.value, 10) || 0;
            out.textContent = RES_STEPS[i] + '×' + Math.round(RES_STEPS[i] * 3 / 4);
        });
        input.addEventListener('change', function () {
            resIndex = parseInt(input.value, 10) || 0;
            try { localStorage.setItem(RES_KEY, String(resIndex)); } catch (e) { /* ignore */ }
            update(true);
        });
        ['keydown', 'keyup'].forEach(function (t) {
            input.addEventListener(t, function (e) { e.stopPropagation(); });
        });
        return el;
    }

    // All tool icons are drawn on the same 16x16 pixel grid.
    // Every icon: 16x16 grid, 2px strokes, square caps, no fills.
    const svg16 = function (body) {
        return '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" shape-rendering="crispEdges" aria-hidden="true">' + body + '</svg>';
    };
    const RES_ICON = svg16('<rect x="2" y="3" width="12" height="8"/><path d="M8 11v3M5 14h6"/>');
    const FS_ON = svg16('<path d="M6 2v4H2M10 2v4h4M6 14v-4H2M10 14v-4h4"/>');
    const FS_OFF = svg16('<path d="M2 6V2h4M10 2h4v4M2 10v4h4M14 10v4h-4"/>');
    const POWER = svg16('<path d="M4.5 4.5a5 5 0 1 0 7 0M8 2v6"/>');
    let resOpen = false;

    // Bezel tools (top strip): RES icon (opens the slider), fullscreen (every screen),
    // logout (station only). Fullscreen / logout mirror the real buttons.
    function syncBezelTools() {
        const frame = document.getElementById('vf-bezel');
        if (!frame) return;
        let tools = frame.querySelector('.vf-bezel-tools');
        const fs = document.querySelector('#vfFullscreenBtn') || document.querySelector('.home-station-overlay .hs-fullscreen-btn');
        const lo = document.querySelector('.home-station-overlay #hsLogout');
        const srcs = [fs, lo].filter(Boolean);
        const sig = srcs.map(function (x) { return (x.id || '') + '|' + x.innerHTML; }).join(',');
        if (tools && tools.dataset.sig === sig) return;
        const first = !tools;
        if (tools) tools.remove();
        tools = document.createElement('div');
        tools.className = 'vf-bezel-tools';
        tools.dataset.sig = sig;
        const mk = function (title, html, onClick) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.title = title;
            btn.setAttribute('aria-label', title);
            btn.innerHTML = html;
            btn.addEventListener('click', function (e) { e.stopPropagation(); onClick(); });
            tools.appendChild(btn);
            return btn;
        };
        const resBtn = mk('Resolution', RES_ICON, function () {
            resOpen = !resOpen;
            resBtn.classList.toggle('is-open', resOpen);
            placeResPlate();
        });
        resBtn.classList.toggle('is-open', resOpen);
        srcs.forEach(function (src) {
            const isFs = src === fs;
            const html = isFs ? (src.innerHTML.indexOf('M3 0h1') !== -1 ? FS_ON : FS_OFF) : (src === lo ? POWER : src.innerHTML);
            mk(src.title || src.getAttribute('aria-label') || '', html, function () { src.click(); });
        });
        frame.appendChild(tools);
        tools.style.pointerEvents = 'auto';
        if (first || true) requestAnimationFrame(placeResPlate);
    }
    new MutationObserver(function () { syncBezelTools(); })
        .observe(document.documentElement, { childList: true, subtree: true, characterData: true });

    // The slider plate (fixed pixel size, outside the scaled stage) unfolds to the
    // left of the tool buttons, inside the bezel's top strip.
    function placeResPlate() {
        const plate = document.getElementById('vf-res');
        const tools = document.querySelector('.vf-bezel-tools');
        if (!plate) return;
        plate.style.display = resOpen && tools ? 'inline-flex' : 'none';
        if (!resOpen || !tools) return;
        const r = tools.getBoundingClientRect();
        const hh = Math.max(14, Math.min(22, Math.round(r.height)));
        plate.style.height = hh + 'px';
        plate.style.top = Math.round(r.top + (r.height - hh) / 2) + 'px';
        plate.style.left = Math.round(r.left - 8 - plate.offsetWidth) + 'px';
    }

    // Cables running from the bezel out to the window edge (decor, window space only).
    function drawCables(w, h, real) {
        let svg = document.getElementById('vf-cables');
        if (!svg) {
            svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.id = 'vf-cables';
            svg.setAttribute('aria-hidden', 'true');
            svg.setAttribute('shape-rendering', 'crispEdges');
            document.documentElement.insertBefore(svg, document.body);
        }
        const k = real.scale;
        const sw = real.vw * k, sh = real.vh * k;
        const sx = (w - sw) / 2, sy = (h - sh) / 2;
        svg.setAttribute('width', w);
        svg.setAttribute('height', h);
        svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
        const MIN = 28;
        const t = Math.max(10, Math.round(16 * k));
        let out = '';
        // axis: 'h' cables leave left/right sides, 'v' leave top/bottom; frac = position along the edge
        const cable = function (pts, key) {
            const d = 'M' + pts.map(function (q) { return Math.round(q[0]) + ' ' + Math.round(q[1]); }).join('L');
            out += '<path d="' + d + '" fill="none" stroke="#05060a" stroke-width="' + (t + 4) + '" stroke-linejoin="miter"/>' +
                '<path d="' + d + '" fill="none" stroke="#3a4150" stroke-width="' + t + '" stroke-linejoin="miter"/>' +
                '<path d="' + d + '" fill="none" stroke="#6a7488" stroke-width="' + Math.max(2, Math.round(t / 4)) +
                '" stroke-linejoin="miter" transform="translate(' + (key === 'v' ? -Math.round(t / 4) + ' 0' : '0 ' + -Math.round(t / 4)) + ')"/>';
        };
        const plug = function (x, y, horiz, dir) {
            const L = Math.round(20 * k + 8), T = t + 8;
            const rx = horiz ? (dir < 0 ? x - L : x) : x - T / 2;
            const ry = horiz ? y - T / 2 : (dir < 0 ? y - L : y);
            const rw = horiz ? L : T, rh = horiz ? T : L;
            out += '<rect x="' + Math.round(rx) + '" y="' + Math.round(ry) + '" width="' + Math.round(rw) + '" height="' + Math.round(rh) + '" fill="#0c0e12" stroke="#2c313b" stroke-width="2"/>' +
                '<rect x="' + Math.round(horiz ? rx + (dir < 0 ? 2 : rw - 6) : rx + 2) + '" y="' + Math.round(horiz ? ry + 2 : ry + (dir < 0 ? 2 : rh - 6)) + '" width="' + (horiz ? 4 : Math.round(rw - 4)) + '" height="' + (horiz ? Math.round(rh - 4) : 4) + '" fill="var(--color-primary, #3dff6a)"/>';
        };
        [[0.2, 0.55, 0.8], [0.3, 0.7]].forEach(function (fr, i) {
            // left (i=0) / right (i=1)
            const m = i === 0 ? sx : w - (sx + sw);
            if (m < MIN) return;
            fr.forEach(function (f, j) {
                const y = sy + sh * f, dy = (j % 2 ? 1 : -1) * Math.min(40, m * 0.5);
                const x0 = i === 0 ? sx : sx + sw;
                const dir = i === 0 ? -1 : 1;
                const xe = i === 0 ? 0 : w;
                const xm = x0 + dir * m * 0.45;
                plug(x0, y, true, dir);
                const xp = x0 + dir * (Math.round(20 * k + 8));
                cable([[xp, y], [xm, y], [xm, y + dy], [xe, y + dy]], 'h');
            });
        });
        [[0.25, 0.75], [0.5]].forEach(function (fr, i) {
            const m = i === 0 ? sy : h - (sy + sh);
            if (m < MIN) return;
            fr.forEach(function (f, j) {
                const x = sx + sw * f, dx = (j % 2 ? 1 : -1) * Math.min(40, m * 0.5);
                const y0 = i === 0 ? sy : sy + sh;
                const dir = i === 0 ? -1 : 1;
                const ye = i === 0 ? 0 : h;
                const ym = y0 + dir * m * 0.45;
                plug(x, y0, false, dir);
                const yp = y0 + dir * (Math.round(20 * k + 8));
                cable([[x, yp], [x, ym], [x + dx, ym], [x + dx, ye]], 'v');
            });
        });
        svg.innerHTML = out;
    }

    // Pilot display in the bezel's top strip: crest, name, resources of the active pilot,
    // or an "empty screen" graphic when none is selected.
    function pilotPlateHtml() {
        let p = null;
        try { p = (typeof profileManager !== 'undefined' && profileManager.getActiveProfile) ? profileManager.getActiveProfile() : null; } catch (e) { p = null; }
        if (!p) {
            return '<span class="vf-pilot-empty" title="No pilot selected"><i></i><b>NO SIGNAL</b></span>';
        }
        const esc = function (t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
        const ico = function (key) {
            return (typeof iconRenderer !== 'undefined' && iconRenderer.imgHtml && key) ? iconRenderer.imgHtml(key, 16, 'hs-pixel') : '';
        };
        const ids = (typeof economyConfig !== 'undefined' && economyConfig.resourceIds) ? economyConfig.resourceIds : ['scrap', 'ore', 'crystal', 'voltex'];
        const credits = (typeof profileManager !== 'undefined' && profileManager.getCredits) ? profileManager.getCredits(p) : (Number(p.credits) || 0);
        const res = ['credits'].concat(ids).map(function (id) {
            const key = (typeof homeStationUI !== 'undefined' && homeStationUI.resourceIconKey) ? homeStationUI.resourceIconKey(id) : null;
            const v = id === 'credits' ? credits : Math.round(Number((p.resources || {})[id]) || 0);
            return '<span class="vf-pilot-res" title="' + esc(id.toUpperCase()) + '">' + ico(key) + '<b>' + v + '</b></span>';
        }).join('');
        const fac = String(p.faction || 'pirate').toLowerCase();
        const big = (typeof profileSelectionManager !== 'undefined' && profileSelectionManager.getFactionEmblemHtml)
            ? profileSelectionManager.getFactionEmblemHtml(p.faction || 'pirate', 64) : '';
        return '<span class="vf-pilot-crest" data-f="' + esc(fac) + '"><span class="vf-pilot-crest-in">' + big + '</span></span><span class="vf-pilot-name">' + esc(p.name || '') + '</span>' + res;
    }
    let pilotSig = '';
    function syncPilotPlate() {
        const frame = document.getElementById('vf-bezel');
        if (!frame) return;
        const frameEl = document.getElementById('vf-bezel');
        let fac = 'terran';
        try {
            const ap = (typeof profileManager !== 'undefined' && profileManager.getActiveProfile) ? profileManager.getActiveProfile() : null;
            if (ap && ap.faction) fac = String(ap.faction).toLowerCase();
        } catch (e) { /* default */ }
        // While a faction is being picked, the picker drives the bezel; release it afterwards.
        if (frameEl && frameEl.hasAttribute('data-preview')) {
            if (document.querySelector('.profile-selection-name-mode')) fac = frameEl.getAttribute('data-faction') || fac;
            else {
                frameEl.removeAttribute('data-preview');
                frameEl.style.removeProperty('--retro-ink');
                frameEl.style.removeProperty('--color-primary');
            }
        }
        if (frameEl && frameEl.getAttribute('data-faction') !== fac) {
            // Cross-fade between faction frames (clip-paths cannot be tweened).
            if (frameEl.dataset.fresh) {
                frameEl.classList.add('is-switching');
                setTimeout(function () { frameEl.setAttribute('data-faction', fac); frameEl.classList.remove('is-switching'); }, 140);
            } else {
                frameEl.setAttribute('data-faction', fac);
                frameEl.dataset.fresh = '1';
            }
        } else if (frameEl) { frameEl.dataset.fresh = '1'; }
        if (ROOT.getAttribute('data-vf-faction') !== fac) ROOT.setAttribute('data-vf-faction', fac);
        try { if (!frameEl.hasAttribute('data-preview')) localStorage.setItem('vf-faction', fac); } catch (e) { /* ignore */ }
        if (frameEl && !frameEl.querySelector('.vf-bezel-deco')) {
            const d = document.createElement('div');
            d.className = 'vf-bezel-deco';
            frameEl.insertBefore(d, frameEl.firstChild);
        }
        const html = pilotPlateHtml();
        let el = frame.querySelector('.vf-pilot-plate');
        if (!el) {
            el = document.createElement('div');
            el.className = 'vf-pilot-plate';
            frame.appendChild(el);
            pilotSig = '';
        }
        if (html !== pilotSig) { pilotSig = html; el.innerHTML = html; }
    }
    setInterval(syncPilotPlate, 700);

    function guiZoom() {
        return clamp(readCssNumber('--gui-zoom', 1), 0.25, 4);
    }

    function sizesClose(a, b, eps) {
        return Math.abs(a - b) < eps;
    }

    function applyCanvasSize(canvasW, canvasH, sidePanel, padX, gap, fontBase, appScale, gameScale, fillScale, force) {
        if (!force && lastApplied.canvasW > 0) {
            if (
                sizesClose(canvasW, lastApplied.canvasW, SIZE_EPS) &&
                sizesClose(canvasH, lastApplied.canvasH, SIZE_EPS) &&
                sizesClose(sidePanel, lastApplied.sidePanel, 1)
            ) {
                return false;
            }
        }

        suppressROUntil = performance.now() + RO_SUPPRESS_MS;

        ROOT.style.setProperty('--canvas-w', Math.floor(canvasW) + 'px');
        ROOT.style.setProperty('--canvas-h', Math.floor(canvasH) + 'px');
        ROOT.style.setProperty('--side-panel-w', Math.floor(sidePanel) + 'px');
        ROOT.style.setProperty('--ui-pad', padX + 'px');
        ROOT.style.setProperty('--ui-gap', gap + 'px');
        ROOT.style.setProperty('--game-scale', String(Number(gameScale.toFixed(4))));
        ROOT.style.setProperty('--app-scale', String(Number(appScale.toFixed(4))));
        ROOT.style.setProperty('--fill-scale', String(Number(fillScale.toFixed(4))));
        ROOT.style.setProperty('--font-base', fontBase + 'px');

        lastApplied = { canvasW: canvasW, canvasH: canvasH, sidePanel: sidePanel };

        if (typeof window.renderManager !== 'undefined' && window.renderManager && typeof window.renderManager.syncViewportScale === 'function') {
            window.renderManager.syncViewportScale(gameScale);
        }
        return true;
    }

    /**
     * Playfield-first layout:
     * 1) use nearly full viewport height for the fight
     * 2) width follows aspect
     * 3) leftover width split into side panels (clamped)
     * 4) if sides would go below SIDE_MIN, shrink playfield to fit
     */
    function computeLayout(vw, vh, padX, padY, gap, aspect) {
        const shellW = Math.max(200, vw - padX * 2);
        const shellH = Math.max(180, vh - padY * 2);
        const availH = Math.max(160, shellH - OVERLAY_CHROME);

        // Ideal fight size: full height
        let canvasH = availH;
        let canvasW = canvasH * aspect;

        // Width left for both side panels + gaps between the three columns
        let leftForSides = shellW - canvasW - gap * 2;
        let sidePanel = leftForSides / 2;

        if (sidePanel > SIDE_MAX) {
            sidePanel = SIDE_MAX;
            // Extra width goes to the fight (still height-capped)
            const maxW = shellW - sidePanel * 2 - gap * 2;
            canvasW = Math.min(maxW, availH * aspect);
            canvasH = canvasW / aspect;
        } else if (sidePanel < SIDE_MIN) {
            sidePanel = SIDE_MIN;
            const maxW = Math.max(120, shellW - sidePanel * 2 - gap * 2);
            canvasW = Math.min(maxW, availH * aspect);
            canvasH = canvasW / aspect;
        }

        return {
            canvasW: canvasW,
            canvasH: canvasH,
            sidePanel: sidePanel,
            availW: canvasW,
            availH: availH
        };
    }

    /** Largest integer-divisor CSS size that fits maxW×maxH. */
    function snapVoxel(aspect, maxW, maxH) {
        const k = Number(window.PLAYFIELD_RENDER_SCALE);
        const scaleK = Number.isFinite(k) && k >= 1 ? Math.round(k) : 4;
        const mapW = readCssNumber('--map-w', 240);
        const mapH = readCssNumber('--map-h', Math.round(mapW / aspect));
        const backingW = Math.max(1, Math.round(mapW * scaleK));
        const backingH = Math.max(1, Math.round(mapH * scaleK));

        let step = 1;
        while (step < 128 && (backingW / step > maxW + 0.5 || backingH / step > maxH + 0.5)) {
            step++;
        }
        let w = backingW / step;
        let h = backingH / step;
        if (w > maxW || h > maxH) {
            const s = Math.min(maxW / backingW, maxH / backingH);
            w = backingW * s;
            h = backingH * s;
        }
        return { canvasW: w, canvasH: h };
    }

    function update(force) {
        const real = viewportSize();
        const { aspect, designW, designH } = playfieldParams();

        ROOT.style.setProperty('--vw', real.vw + 'px');
        ROOT.style.setProperty('--vh', real.vh + 'px');
        if (document.body) {
            ensureBezel();
            syncBezelTools();
            syncPilotPlate();
            requestAnimationFrame(placeResPlate);
            drawCables(window.innerWidth, window.innerHeight, real);
            const out = document.getElementById('vfResValue');
            if (out) out.textContent = resLabel(real);
        }
        // Everything scales with the 4:3 stage: effective zoom = user zoom * stage size / design size
        ROOT.style.setProperty('--stage-scale', String(Number(real.scale.toFixed(5))));
        // The fight HUD is taller than the menus: zoom out a little while it is on screen.
        const gc = document.querySelector('.game-container');
        const inFight = !!(gc && getComputedStyle(gc).display !== 'none' && gc.offsetWidth > 0);
        const zoom = guiZoom() * (inFight ? 0.85 : 1);
        ROOT.style.setProperty('--gui-zoom-eff', String(Number(zoom.toFixed(4))));
        const vw = real.vw / zoom;
        const vh = real.vh / zoom;

        const padX = clamp(Math.round(vw * 0.01), 4, 10);
        const padY = clamp(Math.round(vh * 0.008), 2, 8);
        const gap = clamp(Math.round(vw * 0.008), 4, 10);

        let layout = computeLayout(vw, vh, padX, padY, gap, aspect);
        let canvasW = layout.canvasW;
        let canvasH = layout.canvasH;
        let sidePanel = layout.sidePanel;

        if (ROOT.getAttribute('data-vf-ship-render') === 'VOXEL') {
            const snapped = snapVoxel(aspect, canvasW, canvasH);
            canvasW = snapped.canvasW;
            canvasH = snapped.canvasH;
            // Reclaim unused width into side panels after snap
            const shellW = Math.max(200, vw - padX * 2);
            const leftForSides = shellW - canvasW - gap * 2;
            sidePanel = clamp(leftForSides / 2, SIDE_MIN, SIDE_MAX);
        }

        const fillH = Math.max(160, vh - padY * 2);
        const fillW = Math.max(120, vw - padX * 2);
        const fillScale = Math.min(fillW / designW, fillH / designH);
        const gameScale = canvasW / designW;
        const appScale = clamp(Math.min(vw / 1100, vh / 800), 0.5, 2.5);
        const fontBase = clamp(Math.round(11 + appScale * 4), 11, 18);

        applyCanvasSize(
            canvasW,
            canvasH,
            sidePanel,
            padX,
            gap,
            fontBase,
            appScale,
            gameScale,
            fillScale,
            !!force
        );

        // Settle once after first paint (fonts / zoom)
        const token = ++secondPassToken;
        requestAnimationFrame(function () {
            if (token !== secondPassToken) return;
            let layout2 = computeLayout(vw, vh, padX, padY, gap, aspect);
            let w2 = layout2.canvasW;
            let h2 = layout2.canvasH;
            let side2 = layout2.sidePanel;
            if (ROOT.getAttribute('data-vf-ship-render') === 'VOXEL') {
                const snapped = snapVoxel(aspect, w2, h2);
                w2 = snapped.canvasW;
                h2 = snapped.canvasH;
                const shellW = Math.max(200, vw - padX * 2);
                side2 = clamp((shellW - w2 - gap * 2) / 2, SIDE_MIN, SIDE_MAX);
            }
            if (
                sizesClose(w2, canvasW, SIZE_EPS) &&
                sizesClose(h2, canvasH, SIZE_EPS) &&
                sizesClose(side2, sidePanel, 1)
            ) {
                return;
            }
            applyCanvasSize(
                w2,
                h2,
                side2,
                padX,
                gap,
                fontBase,
                appScale,
                w2 / designW,
                fillScale,
                true
            );
        });
    }

    let raf = 0;
    function scheduleUpdate() {
        if (performance.now() < suppressROUntil) return;
        if (raf) return;
        raf = requestAnimationFrame(function () {
            raf = 0;
            update(false);
        });
    }

    window.addEventListener('resize', scheduleUpdate);
    window.addEventListener('orientationchange', scheduleUpdate);
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', scheduleUpdate);
    }

    function observeLayout() {
        if (typeof ResizeObserver === 'undefined') return;
        const ro = new ResizeObserver(function () {
            if (performance.now() < suppressROUntil) return;
            scheduleUpdate();
        });
        const watch = function () {
            const container = document.querySelector('.game-container');
            if (container) ro.observe(container);
        };
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', watch);
        } else {
            watch();
        }
    }
    observeLayout();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { update(true); });
    } else {
        update(true);
    }

    window.addEventListener('load', function () { update(true); });

    window.viewportFit = {
        update: function () { update(true); },
        scheduleUpdate: scheduleUpdate
    };
})();
