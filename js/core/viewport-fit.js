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

    // Plates of the screen frame (mechanic: css/screen-frame.css). Same markup as index.html.
    const FRAME_PLATES_HTML = '<div class="vf-fr" aria-hidden="true"><i class="vf-fr-p vf-fr-dark"><b class="vf-fr-hole"></b></i><i class="vf-fr-p vf-fr-lit"><b class="vf-fr-hole"></b></i><i class="vf-fr-p vf-fr-hullA"><i class="vf-fr-p vf-fr-hullB"><b class="vf-fr-hole"></b></i></i></div>';

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
            frame.insertAdjacentHTML('beforeend', FRAME_PLATES_HTML);
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
    const FX_ICON = svg16('<path d="M8 2v3M8 11v3M2 8h3M11 8h3M4 4l2 2M10 10l2 2M12 4l-2 2M6 10l-2 2"/>');
    let resOpen = false;
    let fxOpen = false;

    // Per-faction frame style overrides (bevel, plate colours, deco), kept in localStorage.
    const FACTIONS = ['terran', 'kronax', 'voidborn', 'pirate', 'machine'];
    const FRAME_KEY = 'vf-frame-style';
    const FRAME_PROPS = ['--fr-bevel', '--fr-bevel-set', '--hull', '--hull-lit', '--hull-dark'];
    let frameStyles = {};
    try { frameStyles = JSON.parse(localStorage.getItem(FRAME_KEY) || '{}') || {}; } catch (e) { frameStyles = {}; }
    let editFaction = null;
    function saveFrameStyles() {
        try { localStorage.setItem(FRAME_KEY, JSON.stringify(frameStyles)); } catch (e) { /* ignore */ }
    }
    function applyFrameStyle() {
        const frame = document.getElementById('vf-bezel');
        if (!frame) return;
        FRAME_PROPS.forEach(function (p) { frame.style.removeProperty(p); });
        frame.style.removeProperty('--fr-deco');
        const st = frameStyles[frame.getAttribute('data-faction')];
        if (!st) return;
        if (st.bevel != null) {
            frame.style.setProperty('--fr-bevel', 'calc(' + st.bevel + ' * var(--u))');
            // Pixel frame zeroes --fr-bevel; its glass-edge bevel reads this instead.
            frame.style.setProperty('--fr-bevel-set', 'calc(' + st.bevel + ' * var(--u))');
        }
        if (st.hull) frame.style.setProperty('--hull', st.hull);
        if (st.lit) frame.style.setProperty('--hull-lit', st.lit);
        if (st.dark) frame.style.setProperty('--hull-dark', st.dark);
        if (st.deco != null) frame.style.setProperty('--fr-deco', String(st.deco / 100));
    }
    (function watchFrame() {
        const frame = document.getElementById('vf-bezel');
        if (!frame) { document.addEventListener('DOMContentLoaded', watchFrame, { once: true }); return; }
        new MutationObserver(applyFrameStyle).observe(frame, { attributes: true, attributeFilter: ['data-faction'] });
        applyFrameStyle();
    })();
    // Pixel frame: the stage (body) is cut to the faction silhouette on the frame's own grid.
    // The silhouette (--fr-shape: polygon or rounded inset) is resolved to pixels, rasterised to
    // equal square cells and applied as a mask, so outer corners and notches step like voxels.
    function splitTop(str, sep) {
        const out = []; let depth = 0, cur = '';
        for (let i = 0; i < str.length; i++) {
            const ch = str[i];
            if (ch === '(') depth++;
            if (ch === ')') depth--;
            if (depth === 0 && (sep === ',' || sep === '/' ? ch === sep : /\s/.test(ch))) { if (cur.trim()) out.push(cur.trim()); cur = ''; continue; }
            cur += ch;
        }
        if (cur.trim()) out.push(cur.trim());
        return out;
    }
    let silhouetteRaf = 0;
    function clearSilhouette(body, frame) {
        body.style.clipPath = '';
        frame.style.clipPath = '';
        document.querySelectorAll('[data-vf-stage-clip]').forEach(function (el) { el.removeAttribute('data-vf-stage-clip'); });
    }
    function updateSilhouette() {
        silhouetteRaf = 0;
        const body = document.body, frame = document.getElementById('vf-bezel');
        if (!body || !frame) return;
        const off = document.documentElement.getAttribute('data-vf-frame-px') !== 'on';
        // Everything below is in the stage's own (unscaled) CSS pixels, the same units the frame's
        // filter grid and --fr-px use, so the stepped silhouette lines up with the frame cells at
        // any window size. The clip itself is normalised (objectBoundingBox): it follows the
        // layer's box whatever scale / zoom the layer has.
        const cell = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--fr-px')) || 0;
        const W = body.offsetWidth, H = body.offsetHeight;
        const shape = getComputedStyle(frame).getPropertyValue('--fr-shape').trim();
        if (off || !cell || !shape || shape === 'none' || W < 4 || H < 4) { clearSilhouette(body, frame); return; }
        const probe = document.createElement('div');
        probe.style.cssText = 'position:absolute;left:-99999px;top:0;visibility:hidden;width:' + W + 'px;height:' + H + 'px';
        const dot = document.createElement('div');
        dot.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0';
        probe.appendChild(dot);
        body.appendChild(probe);
        const px = function (expr, prop) {
            dot.style[prop] = expr;
            const v = prop === 'left' ? dot.offsetLeft : prop === 'top' ? dot.offsetTop : prop === 'width' ? dot.offsetWidth : dot.offsetHeight;
            dot.style[prop] = '0';
            return v;
        };
        const cw = Math.ceil(W / cell), ch = Math.ceil(H / cell);
        const small = document.createElement('canvas');
        small.width = cw; small.height = ch;
        const sx = small.getContext('2d', { willReadFrequently: true });
        sx.scale(1 / cell, 1 / cell);
        sx.fillStyle = '#000';
        let ok = true;
        // FRAME ROUND also rounds the outer corners: intersect the faction shape with a rounded rect.
        const outR = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--fr-out')) || 0;
        if (outR > 0) { sx.beginPath(); sx.roundRect(0, 0, W, H, outR); sx.clip(); }
        try {
            if (shape.indexOf('polygon(') === 0) {
                const pts = splitTop(shape.slice(8, -1), ',').map(function (pt) {
                    const xy = splitTop(pt, ' ');
                    return [px(xy[0], 'left'), px(xy[1], 'top')];
                });
                sx.beginPath();
                pts.forEach(function (q, i) { if (i) sx.lineTo(q[0], q[1]); else sx.moveTo(q[0], q[1]); });
                sx.closePath(); sx.fill();
            } else if (shape.indexOf('inset(') === 0) {
                const inner = shape.slice(6, -1);
                const rest = inner.slice(inner.indexOf('round') + 5);
                const hv = splitTop(rest, '/');
                const hx = splitTop(hv[0], ' '), vy = splitTop(hv[1] || hv[0], ' ');
                const rad = [0, 1, 2, 3].map(function (i) {
                    return { x: px(hx[i % hx.length], 'width'), y: px(vy[i % vy.length], 'height') };
                });
                sx.beginPath(); sx.roundRect(0, 0, W, H, rad); sx.fill();
            } else ok = false;
        } catch (e) { ok = false; }
        probe.remove();
        if (!ok) { clearSilhouette(body, frame); return; }
        const data = sx.getImageData(0, 0, cw, ch).data;
        // One path of merged runs of whole cells (square staircase), in 0..1 box units.
        const nx = function (x) { return Math.min(1, x * cell / W).toFixed(6); };
        const ny = function (y) { return Math.min(1, y * cell / H).toFixed(6); };
        let d = '';
        const open = {};
        const runsOf = function (y) {
            const runs = []; let x0 = -1;
            for (let x = 0; x <= cw; x++) {
                const on = x < cw && data[(y * cw + x) * 4 + 3] >= 128;
                if (on && x0 < 0) x0 = x;
                if (!on && x0 >= 0) { runs.push(x0 + ':' + x); x0 = -1; }
            }
            return runs;
        };
        const flush = function (key, y1) {
            const pr = key.split(':'), y0 = open[key];
            const x0 = +pr[0], x1 = +pr[1];
            d += 'M' + nx(x0) + ' ' + ny(y0) + 'H' + nx(x1) + 'V' + ny(y1) + 'H' + nx(x0) + 'Z';
            delete open[key];
        };
        for (let y = 0; y <= ch; y++) {
            const runs = y < ch ? runsOf(y) : [];
            Object.keys(open).forEach(function (k) { if (runs.indexOf(k) < 0) flush(k, y); });
            runs.forEach(function (k) { if (open[k] === undefined) open[k] = y; });
        }
        let svg = document.getElementById('vfStageClipSvg');
        if (!svg) {
            svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.id = 'vfStageClipSvg';
            svg.setAttribute('width', '0'); svg.setAttribute('height', '0');
            svg.style.position = 'absolute';
            svg.setAttribute('aria-hidden', 'true');
            svg.innerHTML = '<clipPath id="vfStageClip" clipPathUnits="objectBoundingBox"><path id="vfStageClipPath"/></clipPath>';
            document.documentElement.appendChild(svg);
        }
        document.getElementById('vfStageClipPath').setAttribute('d', d);
        body.style.clipPath = 'url(#vfStageClip)';
        frame.style.clipPath = 'url(#vfStageClip)';
        // Fixed-position stage layers (start screen, station, overlays) ignore the body's clip, so
        // every full-stage layer gets the same clip. Anything with another box (tooltips, the
        // remote) is left alone.
        const br = body.getBoundingClientRect();
        Array.prototype.forEach.call(body.children, function (el) {
            if (el === frame || el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'svg') return;
            const r = el.getBoundingClientRect();
            const full = Math.abs(r.left - br.left) < 2 && Math.abs(r.top - br.top) < 2
                && Math.abs(r.width - br.width) < 2 && Math.abs(r.height - br.height) < 2;
            if (full) el.setAttribute('data-vf-stage-clip', ''); else el.removeAttribute('data-vf-stage-clip');
        });
    }
    function scheduleSilhouette() {
        if (!silhouetteRaf) silhouetteRaf = requestAnimationFrame(updateSilhouette);
    }
    (function watchSilhouette() {
        const frame = document.getElementById('vf-bezel');
        if (!frame || !document.body) { document.addEventListener('DOMContentLoaded', watchSilhouette, { once: true }); return; }
        new MutationObserver(scheduleSilhouette).observe(frame, { attributes: true, attributeFilter: ['data-faction'] });
        new MutationObserver(scheduleSilhouette).observe(document.documentElement, { attributes: true, attributeFilter: ['data-vf-frame-px', 'style'] });
        if (window.ResizeObserver) new ResizeObserver(scheduleSilhouette).observe(document.body);
        new MutationObserver(scheduleSilhouette).observe(document.body, { childList: true });
        window.addEventListener('resize', scheduleSilhouette);
        scheduleSilhouette();
    })();
    function hex(c) {
        const m = /(\d+)[^\d]+(\d+)[^\d]+(\d+)/.exec(c || '');
        if (!m) return /^#[0-9a-f]{6}$/i.test(c || '') ? c : '#000000';
        return '#' + [m[1], m[2], m[3]].map(function (n) { return (+n).toString(16).padStart(2, '0'); }).join('');
    }
    // Frame colours: HUE absolute, SAT / LIGHT relative to the faction's stylesheet default
    // (middle step = unchanged), so touching one slider never makes the others jump.
    const FR_SAT = [35, 100, 160], FR_LIGHT = [-8, 0, 12];
    function frameDefaults(f) {
        const t = document.createElement('div');
        t.className = 'vf-bezel';
        t.setAttribute('data-faction', f);
        t.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;width:0;height:0';
        document.documentElement.appendChild(t);
        const cs = getComputedStyle(t);
        const out = { hull: hex(cs.getPropertyValue('--hull').trim()), lit: hex(cs.getPropertyValue('--hull-lit').trim()), dark: hex(cs.getPropertyValue('--hull-dark').trim()) };
        t.remove();
        return out;
    }
    function frameAdjust(hexColor, adj) {
        const hsl = hexToHsl(hexColor);
        return hslToHex(adj.h, Math.max(0, Math.min(100, hsl[1] * adj.s / 100)), Math.max(0, Math.min(100, hsl[2] + adj.l)));
    }
    function hexToHsl(c) {
        const n = parseInt(hex(c).slice(1), 16);
        const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
        let h = 0, sat = 0;
        if (d) {
            sat = d / (1 - Math.abs(2 * l - 1));
            if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
            h *= 60; if (h < 0) h += 360;
        }
        return [Math.round(h), Math.round(sat * 100), Math.round(l * 100)];
    }
    function hslToHex(h, sPct, lPct) {
        const sat = sPct / 100, l = lPct / 100;
        const c = (1 - Math.abs(2 * l - 1)) * sat, hp = (((h % 360) + 360) % 360) / 60;
        const x = c * (1 - Math.abs((hp % 2) - 1)), m = l - c / 2;
        const rgb = hp < 1 ? [c, x, 0] : hp < 2 ? [x, c, 0] : hp < 3 ? [0, c, x] : hp < 4 ? [0, x, c] : hp < 5 ? [x, 0, c] : [c, 0, x];
        return '#' + rgb.map(function (v) { return Math.max(0, Math.min(255, Math.round((v + m) * 255))).toString(16).padStart(2, '0'); }).join('');
    }
    function setPreviewFaction(f) {
        const frame = document.getElementById('vf-bezel');
        if (!frame) return;
        frame.setAttribute('data-fx-preview', '1');
        frame.setAttribute('data-faction', f);
        // Preview the whole GUI in that faction (accent + palette, cross-faded); released on end.
        if (typeof factionShipStyles !== 'undefined' && factionShipStyles.applyDocumentFactionTheme) factionShipStyles.applyDocumentFactionTheme(f);
        // The station overlay carries its own faction palette; preview it there too (not saved).
        if (typeof homeStationUI !== 'undefined' && homeStationUI.applyFactionTheme) homeStationUI.applyFactionTheme(f);
        applyFrameStyle();
    }
    function endPreviewFaction() {
        const frame = document.getElementById('vf-bezel');
        if (!frame || !frame.hasAttribute('data-fx-preview')) return;
        frame.removeAttribute('data-fx-preview');
        editFaction = null;
        if (typeof factionShipStyles !== 'undefined' && factionShipStyles.applyDocumentFactionTheme) factionShipStyles.applyDocumentFactionTheme();
        if (typeof homeStationUI !== 'undefined' && homeStationUI.applyFactionTheme) homeStationUI.applyFactionTheme();
        syncPilotPlate(); // snaps back to the active profile's faction
    }

    // Visual-settings sidebar (opened from the bezel tools, available on every screen):
    // tabs FX / VOXEL / FRAME / SIZES. In combat it pauses the game while open.
    const FX_TABS = [['fx', 'FX'], ['voxel', 'VOXEL'], ['frame', 'FACTIONS'], ['sizes', 'SIZES'], ['text', 'TEXT']];
    const FX_TAB_ICONS = {
        fx: svg16('<path d="M8 1v3M8 12v3M1 8h3M12 8h3M3 3l2 2M11 11l2 2M13 3l-2 2M5 11l-2 2"/>'),
        voxel: svg16('<path d="M8 2l5 3v6l-5 3-5-3V5zM3 5l5 3 5-3M8 8v6"/>'),
        frame: svg16('<rect x="2" y="3" width="12" height="10"/><rect x="5" y="6" width="6" height="4"/>'),
        sizes: svg16('<path d="M2 14V9M2 14h5M14 2v5M14 2H9M3 13l10-10"/>'),
        text: svg16('<path d="M3 13L8 3l5 10M5 10h6"/>')
    };
    // Selected section of the remote control survives a refresh.
    const FXTAB_KEY = 'vf-fx-tab';
    let fxTab = 'fx';
    try {
        const savedTab = localStorage.getItem(FXTAB_KEY);
        if (FX_TABS.some(function (t) { return t[0] === savedTab; })) fxTab = savedTab;
    } catch (e) { /* ignore */ }
    let fxPausedByUs = false;
    let fxHideTimer = 0;
    function getUi() {
        return window.uiAppearanceManager || (typeof uiAppearanceManager !== 'undefined' ? uiAppearanceManager : null);
    }
    // Scroll position per tab, kept across redraws, tab switches and closing the plate.
    let fxScroll = {};
    try { fxScroll = JSON.parse(localStorage.getItem('vf-fx-scroll') || '{}') || {}; } catch (e) { fxScroll = {}; }
    let fxScrollLock = false;
    function restoreFxScroll() {
        const body = document.querySelector('#vf-fx .vf-fx-body');
        if (!body) return;
        const y = fxScroll[fxTab] || 0;
        body.scrollTop = y;
        // Layout may not be ready (plate just opened): once more next frame.
        requestAnimationFrame(function () {
            const b = document.querySelector('#vf-fx .vf-fx-body');
            if (b && Math.abs(b.scrollTop - y) > 1) b.scrollTop = y;
            fxScrollLock = false;
        });
    }
    function buildFxPlate() {
        let plate = document.getElementById('vf-fx');
        if (plate) return plate;
        plate = document.createElement('div');
        plate.id = 'vf-fx';
        plate.className = 'vf-bezel-fx';
        plate.style.display = 'none';
        document.documentElement.appendChild(plate);
        ['keydown', 'keyup'].forEach(function (t) {
            plate.addEventListener(t, function (e) { e.stopPropagation(); });
        });
        plate.addEventListener('pointerdown', function (e) {
            if (e.target.closest('.vf-fx-grip')) startFxDrag(e, 'size');
            else if (e.target.closest('.vf-fx-head') && !e.target.closest('button')) startFxDrag(e, 'move');
        });
        plate.addEventListener('pointerenter', function () { swayHover = true; });
        plate.addEventListener('pointerleave', function () { swayHover = false; });
        plate.addEventListener('scroll', function (e) {
            if (fxScrollLock || !e.target.classList || !e.target.classList.contains('vf-fx-body')) return;
            fxScroll[fxTab] = e.target.scrollTop;
            try { localStorage.setItem('vf-fx-scroll', JSON.stringify(fxScroll)); } catch (err) { /* ignore */ }
        }, true);
        plate.addEventListener('click', onFxClick);
        plate.addEventListener('input', onFxInput);
        return plate;
    }
    function fxSeg(items, current, attr, wrap) {
        return '<span class="vf-fx-seg' + (wrap ? ' vf-fx-wrap' : '') + '">' + items.map(function (it) {
            return '<button type="button" data-' + attr + '="' + it[0] + '" class="' + (String(current) === String(it[0]) ? 'on' : '') + '">' + it[1] + '</button>';
        }).join('') + '</span>';
    }
    /** ‹ value › stepper over a list of [value, label] — wraps around. */
    function fxStepper(items, current, attr) {
        let i = items.findIndex(function (it) { return String(it[0]) === String(current); });
        if (i < 0) i = 0;
        const prev = items[(i - 1 + items.length) % items.length][0], next = items[(i + 1) % items.length][0];
        return '<span class="vf-fx-step"><button type="button" data-' + attr + '="' + prev + '" aria-label="Previous">&lt;</button>' +
            '<output>' + items[i][1] + '</output><button type="button" data-' + attr + '="' + next + '" aria-label="Next">&gt;</button></span>';
    }
    /** Slider over a list of allowed values (index slider); shows the value itself. */
    function fxOptSlider(label, id, options, current) {
        let i = options.indexOf(String(current));
        if (i < 0) i = 0;
        const max = Math.max(1, options.length - 1);
        return '<label class="vf-fx-row"><span>' + label + '</span><input type="range" min="0" max="' + max + '" step="1" value="' + i +
            '" data-ix="' + id + '" data-opts="' + options.join('|') + '" style="--look-fill:' + (i / max * 100) + '%"><output>' + options[i] + '</output></label>';
    }
    function fxSlider(label, key, min, max, step, value, unit) {
        return '<label class="vf-fx-row"><span>' + label + '</span><input type="range" min="' + min + '" max="' + max + '" step="' + step +
            '" value="' + value + '" data-sl="' + key + '" data-unit="' + (unit || '') + '" style="--look-fill:' + ((value - min) / (max - min) * 100) + '%"><output>' +
            (key.indexOf('fx:') === 0 && +value === 0 ? 'OFF' : value + (unit || '')) + '</output></label>';
    }
    function fxToggle(label, key, on) {
        return '<div class="vf-fx-row"><span>' + label + '</span>' + fxSeg([['OFF', 'OFF'], ['ON', 'ON']], on, 'tg-' + key.replace(':', '-')) + '</div>';
    }
    // Fleet colours (hull / edge / accent / engine of the faction's ships): HUE continuous,
    // SAT / LIGHT in three steps. Slider moves are unsaved drafts shown live; SAVE keeps them.
    function fleetColorsHtml(cur) {
        const fss = typeof factionShipStyles !== 'undefined' ? factionShipStyles : null;
        if (!fss || !fss.getDefaultFactionStyle) return '';
        const style = fss.getFactionStyle(cur), dflt = fss.getDefaultFactionStyle(cur), ov = fss.getColorOverrides(cur);
        const near = function (steps, x) { return steps.reduce(function (bi, y, i) { return Math.abs(y - x) < Math.abs(steps[bi] - x) ? i : bi; }, 0); };
        const dirty = fss.hasColorDraft(cur);
        return '<div class="vf-fx-title vf-fx-title-row"><span>FLEET COLORS</span><button type="button" class="vf-fx-reset" data-fc-reset="' + cur + '">RESET</button></div>' + [['hull', 'HULL (BASE)'], ['edge', 'EDGE'], ['accent', 'ACCENT'], ['engine', 'ENGINE']].map(function (k) {
            const c = style[k[0]];
            if (!c) return '';
            const o = ov[k[0]] || {};
            const row = function (part, tag, min, max, val) {
                return '<span class="hs-fd-slider-tag">' + tag + '</span><input type="range" class="hs-fd-adj hs-fd-adj-' + part + '" min="' + min + '" max="' + max +
                    '" step="1" value="' + val + '" data-fc="' + k[0] + ':' + part + '" aria-label="' + k[1] + ' ' + tag + '">';
            };
            return '<div class="vf-fr-color" data-fc-block="' + k[0] + '"><div class="hs-fd-color-row"><i class="hs-fd-color-chip" style="background:' + c + '"></i>' +
                '<span class="hs-fd-color-label">' + k[1] + '</span><em>' + String(c).toUpperCase() + '</em></div><div class="vf-fr-sliders">' +
                row('h', 'HUE', 0, 359, o.h != null ? o.h : fss.hueOf(dflt[k[0]])) +
                row('s', 'SAT', 0, 2, near(fss.satSteps, o.s != null ? o.s : 100)) +
                row('l', 'LIGHT', 0, 2, near(fss.lightSteps, o.l != null ? o.l : 0)) + '</div></div>';
        }).join('') + '<div class="vf-fx-row vf-fx-actions"><button type="button" class="vf-fx-reset" data-fc-cancel="' + cur + '"' + (dirty ? '' : ' disabled') +
            '>CANCEL</button><button type="button" class="vf-fx-reset" data-fc-save="' + cur + '"' + (dirty ? '' : ' disabled') + '>SAVE</button></div>';
    }
    function fillFxPlate() {
        const ui = getUi();
        const plate = buildFxPlate();
        if (!ui) return;
        fxScrollLock = true;
        let h = '<div class="vf-fx-head"><span>VISUAL SETTINGS</span><button type="button" data-fx-close aria-label="Close">X</button></div>' +
            '<div class="vf-fx-tabs">' + FX_TABS.map(function (t) {
                return '<button type="button" data-fx-tab="' + t[0] + '" class="' + (fxTab === t[0] ? 'on' : '') + '">' + (FX_TAB_ICONS[t[0]] || '') + '<span>' + t[1] + '</span></button>';
            }).join('') + '</div><div class="vf-fx-body">';
        if (fxTab === 'fx') {
            h += '<div class="vf-fx-row"><span>AREA</span>' + fxStepper([['SCREEN', 'INSIDE'], ['FRAME', 'OUTSIDE'], ['ALL', 'BOTH']], ui.fxArea, 'fx-area') + '</div>';
            [['glow', 'GLOW'], ['scanlines', 'SCANLINES'], ['crt', 'CRT'], ['chroma', 'CHROMA'], ['vignette', 'VIGNETTE'], ['noise', 'NOISE'], ['flicker', 'FLICKER'], ['bloom', 'BLOOM'], ['bloomSpread', 'B. SPREAD'], ['bloomThreshold', 'B. CUTOFF'], ['hdr', 'HDR']].forEach(function (r) {
                h += fxSlider(r[1], 'fx:' + r[0], 0, 100, r[0] === 'flicker' ? 1 : 5, ui.getFxPercent(r[0]), '%');
            });
            h += '<div class="vf-fx-row"><span>SEL. PULSE</span>' + fxSeg([['OFF', 'OFF'], ['ON', 'ON']], ui.arcade, 'fx-arcade') + '</div>';
            (function () {
                const frame = document.getElementById('vf-bezel');
                const cur = editFaction || (frame && frame.getAttribute('data-faction')) || 'terran';
                const st = frameStyles[cur] || {};
                h += '<div class="vf-fx-title">FRAME · ' + cur.toUpperCase() + '</div>' +
                    fxSlider('BEVEL', 'fr:bevel', 0, 14, 1, st.bevel != null ? st.bevel : 5, '') +
                    fxSlider('DECO', 'fr:deco', 0, 100, 10, st.deco != null ? st.deco : 100, '%');
            })();
        } else if (fxTab === 'voxel') {
            h += '<div class="vf-fx-title">SHIPS &amp; PLAYFIELD</div>' +
                '<div class="vf-fx-row"><span>SHIP RENDER</span>' + fxSeg(ui.getShipRenderStyleOptions().map(function (v) { return [v, v]; }), ui.shipRenderStyle, 'vx-ship') + '</div>' +
                fxOptSlider('VOXEL SIZE', 'vxsize', ui.getVoxelSizeOptions(), ui.voxelSize) +
                '<div class="vf-fx-title">FRAME OUTSIDE THE SCREEN</div>' +
                fxOptSlider('FRAME PIXEL', 'framepx', ui.getFxOptions('framePx'), ui.getFxValue('framePx')) +
                fxOptSlider('FRAME ROUND', 'framerad', ui.getFxOptions('frameRound'), ui.getFxValue('frameRound')) +
                '<div class="vf-fx-title">GUI</div>' +
                '<div class="vf-fx-row"><span>GUI VOXEL</span>' + fxSeg([['OFF', 'OFF'], ['ON', 'ON']], ui.guiVoxel, 'vx-gui') + '</div>' +
                fxOptSlider('GUI CELL', 'gvcell', ui.getFxOptions('gvCell'), ui.getFxValue('gvCell'));
            h += '<div class="vf-fx-title">GUI PARTS</div><div class="vf-fx-grid">';
            [['gvLines', 'LINES'], ['gvCorners', 'CORNERS'], ['gvText', 'TEXT'], ['gvImages', 'IMAGES'], ['gvSvg', 'SVG']].forEach(function (p) {
                const on = ui.getFxValue(p[0]) === 'ON';
                h += '<button type="button" class="vf-fx-key' + (on ? ' on' : '') + '" data-vx-gv="' + p[0] + ':' + (on ? 'OFF' : 'ON') + '">' + p[1] + '</button>';
            });
            h += '</div>';
        } else if (fxTab === 'frame') {
            const frame = document.getElementById('vf-bezel');
            const cur = editFaction || (frame && frame.getAttribute('data-faction')) || 'terran';
            const st = frameStyles[cur] || {};
            const cs = frame ? getComputedStyle(frame) : null;
            h += '<div class="vf-fx-facs">' + FACTIONS.map(function (f) {
                    let col = '';
                    try { if (typeof factionShipStyles !== 'undefined' && factionShipStyles.getFactionColor) col = ' style="--faction-color:' + factionShipStyles.getFactionColor(f) + '"'; } catch (e) { /* default */ }
                    return '<button type="button" class="vf-fx-fac' + (cur === f ? ' on' : '') + '" data-faction="' + f + '" data-fx-fac="' + f + '"' + col + '>' + f.toUpperCase() + '</button>';
                }).join('') + '</div>' +
                '<div class="vf-fx-title vf-fx-title-row"><span>FRAME COLORS</span><button type="button" class="vf-fx-reset" data-fr-colors-reset="' + cur + '">RESET</button></div>' +
                (function () {
                    const defs = frameDefaults(cur);
                    return [['hull', 'HULL'], ['lit', 'LIT'], ['dark', 'DARK']].map(function (c) {
                        const adj = (st.adj && st.adj[c[0]]) || { h: hexToHsl(defs[c[0]])[0], s: 100, l: 0 };
                        const v = st[c[0]] || defs[c[0]];
                        const near = function (steps, x) { return steps.reduce(function (bi, y, i) { return Math.abs(y - x) < Math.abs(steps[bi] - x) ? i : bi; }, 0); };
                        const row = function (part, tag, min, max, val) {
                            return '<span class="hs-fd-slider-tag">' + tag + '</span><input type="range" class="hs-fd-adj hs-fd-adj-' + part + '" min="' + min + '" max="' + max +
                                '" step="1" value="' + val + '" data-frc="' + c[0] + ':' + part + '" aria-label="' + c[1] + ' ' + tag + '">';
                        };
                        return '<div class="vf-fr-color" data-frc-block="' + c[0] + '"><div class="hs-fd-color-row"><i class="hs-fd-color-chip" style="background:' + v + '"></i>' +
                            '<span class="hs-fd-color-label">' + c[1] + '</span><em>' + v.toUpperCase() + '</em></div><div class="vf-fr-sliders">' +
                            row('h', 'HUE', 0, 359, adj.h) + row('s', 'SAT', 0, 2, near(FR_SAT, adj.s)) + row('l', 'LIGHT', 0, 2, near(FR_LIGHT, adj.l)) + '</div></div>';
                    }).join('');
                })() +
                fleetColorsHtml(cur) +
                '<div class="vf-fx-row"><button type="button" class="vf-fx-reset" data-fr-reset="' + cur + '">RESET ' + cur.toUpperCase() + '</button></div>';
        } else if (fxTab === 'text') {
            h += '<div class="vf-fx-title">MAIN FONT</div><div class="vf-fx-row"><span>FAMILY</span>' +
                fxStepper(ui.getFontOptions().map(function (v) { return ['main:' + v, v]; }), 'main:' + ui.font, 'tx') + '</div>';
            [['h1', 'H1'], ['h2', 'H2 LABELS'], ['text', 'TEXT'], ['small', 'SMALL'], ['game', 'IN-GAME (HUD) · SIZE %']].forEach(function (t) {
                h += '<div class="vf-fx-card"><div class="vf-fx-title">' + t[1] + '</div>' +
                    fxOptSlider('SIZE', 'fsize:' + t[0], ui.getFontSizeOptions(t[0]), ui.fontSizes[t[0]]) +
                    '<div class="vf-fx-row"><span>FONT</span>' + fxStepper(ui.getFontFamilyOptions().map(function (v) { return ['fam:' + t[0] + ':' + v, v]; }), 'fam:' + t[0] + ':' + ui.fontFamilies[t[0]], 'tx') + '</div></div>';
            });
            h += '<div class="vf-fx-title">PREVIEW</div><div class="vf-fx-preview"><div class="type-h1">H1 TITLE</div><div class="type-h2">H2 LABELS</div><div class="type-text">Text sample body</div><div class="type-small">Small print and captions</div></div>';
        } else if (fxTab === 'sizes') {
            h += '<div class="vf-fx-title">VOXEL SIZES</div>' +
                fxOptSlider('PLAYFIELD', 'vxsize', ui.getVoxelSizeOptions(), ui.voxelSize) +
                fxOptSlider('GUI CELL', 'gvcell', ui.getFxOptions('gvCell'), ui.getFxValue('gvCell'));
            h += '<div class="vf-fx-title">SHIPS (PX)</div>' + fxSlider('PLAYER', 'sz:player:player', 6, 60, 1, Math.round(ui.getSizePx('player')), 'px');
            ['scout', 'assault', 'heavy', 'elite', 'capital'].forEach(function (c) {
                h += fxSlider(c.toUpperCase(), 'sz:enemy:' + c, 12, 200, 1, Math.round(ui.getSizePx('enemy', c)), 'px');
            });
            h += '<div class="vf-fx-title">SHOTS (PX)</div>';
            ['player', 'enemy', 'boss'].forEach(function (c) {
                h += fxSlider(c.toUpperCase(), 'sz:shot:' + c, 1, 40, 1, Math.round(ui.getSizePx('shot', c)), 'px');
            });
        }
        h += '</div>';
        plate.innerHTML = h;
        const body = plate.querySelector('.vf-fx-body');
        restoreFxScroll();
        plate.insertAdjacentHTML('beforeend', '<i class="vf-fx-grip" title="Resize" aria-hidden="true"></i>');
        applyFxGeom();
    }

    // Move (drag the readout) and resize (corner grip); position and size are remembered.
    const FXGEOM_KEY = 'vf-fx-geom';
    let fxGeom = null;
    try { fxGeom = JSON.parse(localStorage.getItem(FXGEOM_KEY) || 'null'); } catch (e) { fxGeom = null; }
    function applyFxGeom() {
        const plate = document.getElementById('vf-fx');
        if (!plate || !fxGeom) return;
        const W = window.innerWidth, H = window.innerHeight;
        const w = Math.max(260, Math.min(fxGeom.w, W)), h = Math.max(300, Math.min(fxGeom.h, H));
        const l = Math.max(0, Math.min(fxGeom.l, W - w)), t = Math.max(0, Math.min(fxGeom.t, H - h));
        plate.style.width = w + 'px'; plate.style.height = h + 'px';
        plate.style.left = l + 'px'; plate.style.top = t + 'px';
        plate.style.right = 'auto'; plate.style.bottom = 'auto';
    }
    function startFxDrag(e, mode) {
        const plate = document.getElementById('vf-fx');
        const r = plate.getBoundingClientRect();
        const sx = e.clientX, sy = e.clientY;
        const g0 = { l: r.left, t: r.top, w: r.width, h: r.height };
        e.preventDefault();
        plate.classList.add('is-dragging');
        const move = function (ev) {
            const dx = ev.clientX - sx, dy = ev.clientY - sy;
            fxGeom = mode === 'move'
                ? { l: g0.l + dx, t: g0.t + dy, w: g0.w, h: g0.h }
                : { l: g0.l, t: g0.t, w: g0.w + dx, h: g0.h + dy };
            applyFxGeom();
        };
        const up = function () {
            plate.classList.remove('is-dragging');
            document.removeEventListener('pointermove', move);
            document.removeEventListener('pointerup', up);
            try { localStorage.setItem(FXGEOM_KEY, JSON.stringify(fxGeom)); } catch (err) { /* ignore */ }
        };
        document.addEventListener('pointermove', move);
        document.addEventListener('pointerup', up);
    }
    window.addEventListener('resize', applyFxGeom);
    /** Re-run the station FLEET preview so colour edits show at once (for the faction being edited). */
    function refreshFleetPreviewLive(faction) {
        if (typeof enemySizeOverlay !== 'undefined' && enemySizeOverlay.refreshFleetPreview) enemySizeOverlay.refreshFleetPreview(faction);
    }
    function onFxClick(e) {
        const b = e.target.closest && e.target.closest('button');
        const ui = getUi();
        if (!b || !ui) return;
        const d = b.dataset;
        if ('fxClose' in d) { setFxOpen(false); return; }
        if (d.fxTab) {
            fxTab = d.fxTab;
            try { localStorage.setItem(FXTAB_KEY, fxTab); } catch (err) { /* ignore */ }
            fillFxPlate();
            return;
        }
        if (d.fxArea) ui.setFxArea(d.fxArea);
        else if (d.fxArcade) ui.setFx('arcade', d.fxArcade);
        else if (d.tx) {
            const t = d.tx.split(':');
            if (t[0] === 'main') ui.setFont(t[1]);
            else if (t[0] === 'size') ui.setFontSize(t[1], t[2]);
            else if (t[0] === 'fam') ui.setFontFamily(t[1], t[2]);
        }
        else if (d.vxShip) ui.setShipRenderStyle(d.vxShip);
        else if (d.vxSize) ui.setVoxelSize(d.vxSize);
        else if (d.vxGui) ui.setGuiVoxel(d.vxGui);
        else if (d.vxGv) { const kv = d.vxGv.split(':'); ui.setFx(kv[0], kv[1]); }
        else if (d.fxFac) { fxFacPrev = editFaction || (document.getElementById('vf-bezel') || document.body).getAttribute('data-faction'); editFaction = d.fxFac; setPreviewFaction(editFaction); }
        else if (d.frReset) {
            delete frameStyles[d.frReset]; saveFrameStyles(); applyFrameStyle();
            if (typeof factionShipStyles !== 'undefined' && factionShipStyles.setColorOverride) {
                factionShipStyles.clearColorDraft(d.frReset);
                ['hull', 'edge', 'accent', 'engine'].forEach(function (k) { factionShipStyles.setColorOverride(d.frReset, k, null, null); });
            }
        }
        else if (d.frColorsReset) {
            const o = frameStyles[d.frColorsReset];
            if (o) { delete o.hull; delete o.lit; delete o.dark; delete o.adj; saveFrameStyles(); applyFrameStyle(); }
        }
        else if (d.fcReset) {
            factionShipStyles.clearColorDraft(d.fcReset);
            ['hull', 'edge', 'accent', 'engine'].forEach(function (k) { factionShipStyles.setColorOverride(d.fcReset, k, null, null); });
        }
        else if (d.fcSave) factionShipStyles.commitColorDrafts(d.fcSave);
        else if (d.fcCancel) factionShipStyles.clearColorDraft(d.fcCancel);
        else return;
        if (d.fcReset || d.fcSave || d.fcCancel || d.frReset) refreshFleetPreviewLive(d.fcReset || d.fcSave || d.fcCancel || d.frReset);
        fillFxPlate();
        if (d.fxFac && fxFacPrev && fxFacPrev !== d.fxFac) fadeFxFac(fxFacPrev, d.fxFac);
        fxFacPrev = null;
    }
    /** The plate is rebuilt on a faction pick; replay the on/off change so the tabs fade instead of jumping. */
    let fxFacPrev = null;
    function fadeFxFac(prev, next) {
        const plate = document.getElementById('vf-fx');
        if (!plate) return;
        const a = plate.querySelector('.vf-fx-fac[data-fx-fac="' + prev + '"]'), b = plate.querySelector('.vf-fx-fac[data-fx-fac="' + next + '"]');
        if (!a || !b) return;
        a.classList.add('on'); b.classList.remove('on');
        void plate.offsetWidth;
        a.classList.remove('on'); b.classList.add('on');
    }
    function onFxInput(e) {
        const inp = e.target;
        const ui = getUi();
        if (!ui) return;
        if (inp.dataset.frColor) {
            const frame = document.getElementById('vf-bezel');
            const cur = editFaction || frame.getAttribute('data-faction');
            (frameStyles[cur] = frameStyles[cur] || {})[inp.dataset.frColor] = inp.value;
            saveFrameStyles();
            applyFrameStyle();
            return;
        }
        if (inp.dataset.fc) {
            const frame = document.getElementById('vf-bezel');
            const cur = editFaction || frame.getAttribute('data-faction');
            const key = inp.dataset.fc.split(':')[0];
            const blk = inp.closest('[data-fc-block]');
            const val = function (k) { const el = blk.querySelector('[data-fc$=":' + k + '"]'); return el ? +el.value : 0; };
            const adj = { h: val('h'), s: factionShipStyles.satSteps[val('s')], l: factionShipStyles.lightSteps[val('l')] };
            factionShipStyles.setColorDraft(cur, key, adj);
            const col = factionShipStyles.adjustColor(factionShipStyles.getDefaultFactionStyle(cur)[key], adj);
            blk.querySelector('.hs-fd-color-chip').style.background = col;
            blk.querySelector('em').textContent = col.toUpperCase();
            document.querySelectorAll('#vf-fx [data-fc-save], #vf-fx [data-fc-cancel]').forEach(function (b) { b.disabled = false; });
            refreshFleetPreviewLive(cur);
            return;
        }
        if (inp.dataset.frc) {
            const frame = document.getElementById('vf-bezel');
            const cur = editFaction || frame.getAttribute('data-faction');
            const key = inp.dataset.frc.split(':')[0];
            const blk = inp.closest('[data-frc-block]');
            const val = function (k) { const el = blk.querySelector('[data-frc$=":' + k + '"]'); return el ? +el.value : 0; };
            const adj = { h: val('h'), s: FR_SAT[val('s')], l: FR_LIGHT[val('l')] };
            const col = frameAdjust(frameDefaults(cur)[key], adj);
            const fs = (frameStyles[cur] = frameStyles[cur] || {});
            fs.adj = fs.adj || {};
            fs.adj[key] = adj;
            blk.querySelector('.hs-fd-color-chip').style.background = col;
            blk.querySelector('em').textContent = col.toUpperCase();
            fs[key] = col;
            saveFrameStyles();
            if (!frame.hasAttribute('data-fx-preview')) frame.setAttribute('data-fx-preview', '1');
            applyFrameStyle();
            return;
        }
        if (inp.dataset.ix) {
            const opts = inp.dataset.opts.split('|');
            const v = opts[+inp.value];
            inp.style.setProperty('--look-fill', (+inp.value / Math.max(1, opts.length - 1) * 100) + '%');
            inp.nextElementSibling.textContent = v;
            const id = inp.dataset.ix;
            if (id === 'vxsize') ui.setVoxelSize(v);
            else if (id === 'gvcell') ui.setFx('gvCell', v);
            else if (id === 'framepx') ui.setFx('framePx', v);
            else if (id === 'framerad') ui.setFx('frameRound', v);
            else if (id.indexOf('fsize:') === 0) ui.setFontSize(id.slice(6), v);
            return;
        }
        if (!inp.dataset.sl) return;
        const parts = inp.dataset.sl.split(':');
        const v = +inp.value, min = +inp.min, max = +inp.max;
        inp.style.setProperty('--look-fill', ((v - min) / (max - min) * 100) + '%');
        inp.nextElementSibling.textContent = (parts[0] === 'fx' && v === 0) ? 'OFF' : v + inp.dataset.unit;
        if (parts[0] === 'fx') ui.setFx(parts[1], v + '%');
        else if (parts[0] === 'sz') {
            ui.setSizePx(parts[1], parts[2], v);
            // Station FLEETS preview uses the same sizes: rebuild it live.
            if (typeof enemySizeOverlay !== 'undefined' && enemySizeOverlay.refreshFleetPreview) enemySizeOverlay.refreshFleetPreview();
        }
        else if (parts[0] === 'fr') {
            const frame = document.getElementById('vf-bezel');
            const cur = editFaction || frame.getAttribute('data-faction');
            (frameStyles[cur] = frameStyles[cur] || {})[parts[1]] = v;
            saveFrameStyles();
            if (!frame.hasAttribute('data-fx-preview')) frame.setAttribute('data-fx-preview', '1');
            applyFrameStyle();
        }
    }
    const FXOPEN_KEY = 'vf-fx-open';
    function setFxOpen(open, instant) {
        fxOpen = open;
        try { localStorage.setItem(FXOPEN_KEY, open ? '1' : '0'); } catch (e) { /* ignore */ }
        window.vfFxSidebarOpen = open;
        const plate = buildFxPlate();
        // Leave (and enter) on the side it is parked on.
        if (plate.style.display !== 'none' && plate.offsetWidth) {
            const r = plate.getBoundingClientRect();
            plate.classList.toggle('is-left', r.left + r.width / 2 < window.innerWidth / 2);
        }
        const btn = document.querySelector('.vf-bezel-tools button[data-fx-toggle]');
        if (btn) btn.classList.toggle('is-open', open);
        const gs = (typeof game !== 'undefined' && game && game.gameState) ? game.gameState : null;
        const overlay = document.getElementById('pauseOverlay');
        if (open) {
            fillFxPlate();
            clearTimeout(fxHideTimer);
            plate.style.display = 'flex';
            if (instant) plate.style.transition = 'none'; // restored on load: already in hand
            void plate.offsetWidth; // start the slide-in from the off-screen pose
            plate.classList.add('is-in');
            if (instant) { void plate.offsetWidth; plate.style.transition = ''; }
            startSway();
            document.addEventListener('keydown', onFxEsc, true);
            // In combat: freeze the field (no dark pause menu) so the effects can be judged.
            if (gs && gs.gameRunning && !gs.isPaused) {
                gs.pauseGame();
                fxPausedByUs = true;
            }
            if (gs && gs.gameRunning && overlay) overlay.classList.add('hidden');
        } else {
            plate.classList.remove('is-in');
            // Held back out of view first, hidden once the slide is done.
            clearTimeout(fxHideTimer);
            fxHideTimer = setTimeout(function () { if (!fxOpen) plate.style.display = 'none'; }, 420);
            document.removeEventListener('keydown', onFxEsc, true);
            endPreviewFaction();
            if (fxPausedByUs && gs) gs.resumeGame();
            else if (gs && gs.gameRunning && gs.isPaused && overlay) overlay.classList.remove('hidden');
            fxPausedByUs = false;
        }
    }
    // Hand sway: driven here (not by a CSS animation) so hover and release ease the
    // amplitude in and out instead of snapping the pose.
    let swayAmp = 0, swayHover = false, swayRaf = 0, swayLast = 0, swayT = 0;
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function swayLoop(now) {
        const plate = document.getElementById('vf-fx');
        if (!plate || !fxOpen) { swayRaf = 0; if (plate) plate.style.transform = ''; swayAmp = 0; return; }
        const dt = Math.min(0.1, (now - swayLast) / 1000 || 0.016);
        swayLast = now;
        swayT += dt;
        const target = (swayHover || reduceMotion || !plate.classList.contains('is-in') || plate.classList.contains('is-dragging')) ? 0 : 1;
        swayAmp += (target - swayAmp) * Math.min(1, dt * 5); // ease toward held / swaying
        const t = swayT;
        const x = (Math.sin(t * 0.9) * 1.2 + Math.sin(t * 1.7 + 1) * 0.6) * swayAmp;
        const y = (Math.sin(t * 1.1 + 2) * 1.0 + Math.sin(t * 2.3) * 0.5) * swayAmp;
        const r = (Math.sin(t * 0.8 + 0.5) * 0.35 + Math.sin(t * 1.9) * 0.15) * swayAmp;
        plate.style.transform = 'translate(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px) rotate(' + r.toFixed(3) + 'deg)';
        swayRaf = requestAnimationFrame(swayLoop);
    }
    function startSway() {
        if (swayRaf) return;
        swayLast = performance.now();
        swayRaf = requestAnimationFrame(swayLoop);
    }
    // Remember whether the remote was out: restore it after a reload / screen change.
    (function restoreFx() {
        let was = false;
        try { was = localStorage.getItem(FXOPEN_KEY) === '1'; } catch (e) { /* ignore */ }
        if (!was) return;
        let tries = 0;
        (function wait() {
            if (fxOpen) return;
            if (getUi() && document.querySelector('.vf-bezel-tools')) { setFxOpen(true, true); return; }
            if (++tries < 200) setTimeout(wait, 50);
        })();
    })();
    function onFxEsc(e) {
        if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); setFxOpen(false); }
    }
    function placeFxPlate() { /* the sidebar is docked to the window edge */ }

    // Bezel tools (top strip): RES icon (opens the slider), fullscreen (every screen),
    // logout (station only). Fullscreen / logout mirror the real buttons.
    function syncBezelTools() {
        const frame = document.getElementById('vf-bezel');
        if (!frame) return;
        let tools = frame.querySelector('.vf-bezel-tools');
        // All four keys exist from the first build on and are only updated in place, so
        // nothing pops in one after another. An unavailable key is an empty socket.
        const handlers = {
            res: function (btn) {
                resOpen = !resOpen;
                btn.classList.toggle('is-open', resOpen);
                placeResPlate();
            },
            fx: function () { setFxOpen(!fxOpen); },
            fs: function () {
                const src = document.querySelector('#vfFullscreenBtn') || document.querySelector('.home-station-overlay .hs-fullscreen-btn');
                if (src) src.click();
                else if (typeof vfFullscreen !== 'undefined') vfFullscreen.toggle();
            },
            logout: function () {
                if (typeof homeStationUI !== 'undefined' && homeStationUI.isVisible && homeStationUI.logout) {
                    homeStationUI.logout();
                    return;
                }
                const lo = document.querySelector('.home-station-overlay #hsLogout');
                if (lo) { lo.click(); return; }
                if (typeof profileManager !== 'undefined') profileManager.logout();
                if (typeof startScreenManager !== 'undefined') startScreenManager.show({ forceMenu: true });
            }
        };
        const meta = {
            res: ['Resolution', RES_ICON], fx: ['Visual settings', FX_ICON], fs: ['Fullscreen', FS_OFF], logout: ['Logout', POWER]
        };
        // The keys are static markup in index.html (painted with the first frame); this
        // only wires them. Built here as a fallback if the markup is missing.
        if (!tools) {
            tools = document.createElement('div');
            tools.className = 'vf-bezel-tools';
            Object.keys(meta).forEach(function (key) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.dataset.tool = key;
                btn.title = meta[key][0];
                btn.setAttribute('aria-label', meta[key][0]);
                btn.innerHTML = meta[key][1];
                tools.appendChild(btn);
            });
            frame.appendChild(tools);
        }
        if (tools.dataset.wired !== '1') {
            tools.dataset.wired = '1';
            tools.style.pointerEvents = 'auto';
            Object.keys(handlers).forEach(function (key) {
                const btn = tools.querySelector('[data-tool="' + key + '"]');
                if (!btn) return;
                btn.addEventListener('click', function (e) { e.stopPropagation(); handlers[key](btn); });
            });
            const fxb = tools.querySelector('[data-tool="fx"]');
            if (fxb) fxb.setAttribute('data-fx-toggle', '');
            requestAnimationFrame(function () { placeResPlate(); placeFxPlate(); });
        }
        const q = function (k) { return tools.querySelector('[data-tool="' + k + '"]'); };
        const setOff = function (btn, off) {
            btn.classList.toggle('is-off', off);
            btn.disabled = off;
        };
        q('res').classList.toggle('is-open', resOpen);
        q('fx').classList.toggle('is-open', fxOpen);
        const fsOk = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
        const fsBtn = q('fs');
        setOff(fsBtn, !fsOk);
        const fsOn = !!(document.fullscreenElement || document.webkitFullscreenElement);
        const fsHtml = fsOn ? FS_ON : FS_OFF;
        if (fsBtn.dataset.state !== (fsOn ? '1' : '0')) {
            fsBtn.dataset.state = fsOn ? '1' : '0';
            fsBtn.innerHTML = fsHtml;
            fsBtn.title = fsOn ? 'Exit fullscreen' : 'Fullscreen';
            fsBtn.setAttribute('aria-label', fsBtn.title);
        }
        // Available whenever a pilot is logged in (not only once the station UI has rendered).
        let logged = document.documentElement.hasAttribute('data-vf-logged');
        if (typeof profileManager !== 'undefined' && profileManager.getActiveProfile) {
            logged = !!profileManager.getActiveProfile();
            if (logged !== document.documentElement.hasAttribute('data-vf-logged')) {
                if (logged) document.documentElement.setAttribute('data-vf-logged', '1');
                else document.documentElement.removeAttribute('data-vf-logged');
            }
        }
        setOff(q('logout'), !logged);
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
    let lastCableArgs = null;
    function drawCables(w, h, real) {
        lastCableArgs = [w, h, real];
        let svg = document.getElementById('vf-cables');
        if (!svg) {
            svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.id = 'vf-cables';
            svg.setAttribute('aria-hidden', 'true');
            svg.setAttribute('shape-rendering', 'crispEdges');
            new MutationObserver(function () { if (lastCableArgs) drawCables.apply(null, lastCableArgs); })
                .observe(document.documentElement, { attributes: true, attributeFilter: ['data-vf-faction'] });
            document.documentElement.insertBefore(svg, document.body);
        }
        const k = real.scale;
        const sw = real.vw * k, sh = real.vh * k;
        const sx = (w - sw) / 2, sy = (h - sh) / 2;
        svg.setAttribute('width', w);
        svg.setAttribute('height', h);
        svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
        const MIN = 28;
        // Plugs sit over the bezel and reach into the screen opening.
        const bz = document.querySelector('.vf-bezel');
        const br = bz ? bz.getBoundingClientRect() : null;
        const u = br && br.width ? Math.min(br.width / 1640, br.height / 1110) : k * 0.6;
        const reachH = 64 * u, reachTop = 86 * u, reachBot = 64 * u;
        const t = Math.max(10, Math.round(16 * k));
        let out = '';
        // Each faction runs its own kind of cable: steel conduit, spiked iron chain, glowing tendril,
        // knotted rope, chamfered data line.
        const fac = (ROOT.getAttribute('data-vf-faction') || (bz && bz.getAttribute('data-faction')) || 'terran');
        const STY = {
            terran:   { out: '#05060a', body: '#3a4150', hi: '#6a7488', route: 'ortho', led: 'var(--color-primary, #3dff6a)', plugFill: '#0c0e12', plugLine: '#2c313b', thick: 1 },
            kronax:   { out: '#0a0403', body: '#4a2316', hi: '#d9611f', route: 'zig', led: '#ff7a2a', plugFill: '#1a0c08', plugLine: '#7a3a1c', thick: 1.25, hiDash: '4 6' },
            voidborn: { out: '#07030f', body: '#2a1648', hi: '#b27cff', route: 'curve', led: '#c79bff', plugFill: '#120826', plugLine: '#5a2fa0', thick: 1, glow: '#7a3cff', round: true },
            pirate:   { out: '#070604', body: '#4a3f2a', hi: '#cdc7a4', route: 'crook', led: '#e8d9a0', plugFill: '#1a160d', plugLine: '#6b5a3a', thick: 1.1, hiDash: '7 5', hiW: 0.45 },
            machine:  { out: '#020706', body: '#0f3331', hi: '#3ff0d6', route: 'chamfer', led: '#3ff0d6', plugFill: '#041211', plugLine: '#1a5a54', thick: 0.8, hiDash: '10 14', hiW: 0.3 }
        };
        const S = STY[fac] || STY.terran;
        const tt = Math.max(8, Math.round(t * S.thick));
        const zig = function (pts) {
            // Sawtooth teeth along every segment.
            const step = Math.max(12, Math.round(18 * k)), amp = Math.max(4, Math.round(tt * 0.45));
            const r = [pts[0]];
            for (let i = 1; i < pts.length; i++) {
                const a0 = pts[i - 1], b0 = pts[i];
                const dx = b0[0] - a0[0], dy = b0[1] - a0[1], len = Math.hypot(dx, dy);
                if (!len) continue;
                const n = Math.max(1, Math.floor(len / step)), nx = -dy / len, ny = dx / len;
                for (let j = 1; j <= n; j++) {
                    const tm = (j - 0.5) / n, sg = j % 2 ? 1 : -1;
                    r.push([a0[0] + dx * tm + nx * amp * sg, a0[1] + dy * tm + ny * amp * sg]);
                }
                r.push(b0);
            }
            return r;
        };
        const chamfer = function (pts, c) {
            const r = [pts[0]];
            for (let i = 1; i < pts.length - 1; i++) {
                const p0 = pts[i - 1], p1 = pts[i], p2 = pts[i + 1];
                const l1 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) || 1, l2 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) || 1;
                const cc = Math.min(c, l1 / 2, l2 / 2);
                r.push([p1[0] - (p1[0] - p0[0]) / l1 * cc, p1[1] - (p1[1] - p0[1]) / l1 * cc]);
                r.push([p1[0] + (p2[0] - p1[0]) / l2 * cc, p1[1] + (p2[1] - p1[1]) / l2 * cc]);
            }
            r.push(pts[pts.length - 1]);
            return r;
        };
        const crook = function (pts) {
            // Rope never runs dead straight: small fixed kinks mid-segment.
            const r = [pts[0]];
            for (let i = 1; i < pts.length; i++) {
                const a0 = pts[i - 1], b0 = pts[i];
                const dx = b0[0] - a0[0], dy = b0[1] - a0[1], len = Math.hypot(dx, dy);
                if (len > 40) {
                    const nx = -dy / len, ny = dx / len, o = (i % 2 ? 1 : -1) * Math.max(3, Math.round(tt * 0.35));
                    r.push([a0[0] + dx * 0.33 + nx * o, a0[1] + dy * 0.33 + ny * o]);
                    r.push([a0[0] + dx * 0.66 - nx * o, a0[1] + dy * 0.66 - ny * o]);
                }
                r.push(b0);
            }
            return r;
        };
        const curve = function (pts) {
            // Smooth tendril: quadratic corners through segment midpoints.
            let d = 'M' + Math.round(pts[0][0]) + ' ' + Math.round(pts[0][1]);
            for (let i = 1; i < pts.length - 1; i++) {
                const m = [(pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2];
                const e = i === 1 ? [(pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2] : null;
                if (e) d += 'L' + Math.round(e[0]) + ' ' + Math.round(e[1]);
                d += 'Q' + Math.round(pts[i][0]) + ' ' + Math.round(pts[i][1]) + ' ' + Math.round(m[0]) + ' ' + Math.round(m[1]);
            }
            d += 'L' + Math.round(pts[pts.length - 1][0]) + ' ' + Math.round(pts[pts.length - 1][1]);
            return d;
        };
        const cable = function (pts0, key) {
            let pts = pts0, d;
            if (S.route === 'zig') pts = zig(pts0);
            else if (S.route === 'chamfer') pts = chamfer(pts0, Math.max(8, Math.round(18 * k)));
            else if (S.route === 'crook') pts = crook(pts0);
            d = S.route === 'curve' ? curve(pts0) : 'M' + pts.map(function (q) { return Math.round(q[0]) + ' ' + Math.round(q[1]); }).join('L');
            const join = S.round ? 'round' : 'miter';
            const cap = S.round ? ' stroke-linecap="round"' : '';
            const hiW = Math.max(2, Math.round(tt * (S.hiW || 0.25)));
            const off = key === 'v' ? -Math.round(tt / 4) + ' 0' : '0 ' + -Math.round(tt / 4);
            if (S.glow) out += '<path d="' + d + '" fill="none" stroke="' + S.glow + '" stroke-opacity="0.35" stroke-width="' + (tt + 12) + '" stroke-linejoin="round" stroke-linecap="round"/>';
            out += '<path d="' + d + '" fill="none" stroke="' + S.out + '" stroke-width="' + (tt + 4) + '" stroke-linejoin="' + join + '"' + cap + '/>' +
                '<path d="' + d + '" fill="none" stroke="' + S.body + '" stroke-width="' + tt + '" stroke-linejoin="' + join + '"' + cap + '/>' +
                '<path d="' + d + '" fill="none" stroke="' + S.hi + '" stroke-width="' + hiW + '"' + (S.hiDash ? ' stroke-dasharray="' + S.hiDash + '"' : '') +
                ' stroke-linejoin="' + join + '"' + cap + ' transform="translate(' + off + ')"/>';
        };
        const plug = function (x, y, horiz, dir) {
            const L = Math.round(20 * k + 8), T = tt + 8;
            const rx = horiz ? (dir < 0 ? x - L : x) : x - T / 2;
            const ry = horiz ? y - T / 2 : (dir < 0 ? y - L : y);
            const rw = horiz ? L : T, rh = horiz ? T : L;
            out += '<rect x="' + Math.round(rx) + '" y="' + Math.round(ry) + '" width="' + Math.round(rw) + '" height="' + Math.round(rh) + '" fill="' + S.plugFill + '" stroke="' + S.plugLine + '" stroke-width="2"' + (S.round ? ' rx="6"' : '') + '/>' +
                '<rect x="' + Math.round(horiz ? rx + (dir < 0 ? 2 : rw - 6) : rx + 2) + '" y="' + Math.round(horiz ? ry + 2 : ry + (dir < 0 ? 2 : rh - 6)) + '" width="' + (horiz ? 4 : Math.round(rw - 4)) + '" height="' + (horiz ? Math.round(rh - 4) : 4) + '" style="fill:' + S.led + '"/>';
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
                const xin = x0 - dir * reachH;
                plug(xin, y, true, dir);
                const xp = xin + dir * (Math.round(20 * k + 8));
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
                const yin = y0 - dir * (i === 0 ? reachTop : reachBot);
                plug(x, yin, false, dir);
                const yp = yin + dir * (Math.round(20 * k + 8));
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
            return { plate: '<span class="vf-pilot-empty" title="No pilot selected"><i></i><b>NO SIGNAL</b></span>', res: '' };
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
        return { plate: '<span class="vf-pilot-crest" data-f="' + esc(fac) + '"><span class="vf-pilot-crest-in">' + big + '</span></span><span class="vf-pilot-name">' + esc(p.name || '') + '</span>', res: res };
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
        if (frameEl && frameEl.hasAttribute('data-fx-preview')) {
            // The frame editor in the FX dropdown is previewing another faction.
            fac = frameEl.getAttribute('data-faction') || fac;
        } else if (frameEl && frameEl.hasAttribute('data-preview')) {
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
        try { if (!frameEl.hasAttribute('data-preview') && !frameEl.hasAttribute('data-fx-preview')) localStorage.setItem('vf-faction', fac); } catch (e) { /* ignore */ }
        if (frameEl && !frameEl.querySelector('.vf-bezel-deco')) {
            const d = document.createElement('div');
            d.className = 'vf-bezel-deco';
            frameEl.insertBefore(d, frameEl.firstChild);
        }
        const hud = pilotPlateHtml();
        const sig = hud.plate + '|' + hud.res;
        let plate = frame.querySelector('.vf-pilot-plate');
        let ress = frame.querySelector('.vf-pilot-ress');
        if (!plate) {
            plate = document.createElement('div');
            plate.className = 'vf-pilot-plate vf-pilot-screen';
            frame.appendChild(plate);
            ress = document.createElement('div');
            ress.className = 'vf-pilot-ress vf-pilot-screen';
            frame.appendChild(ress);
            pilotSig = '';
        }
        if (sig !== pilotSig) {
            pilotSig = sig;
            plate.innerHTML = hud.plate;
            ress.innerHTML = hud.res;
            ress.hidden = !hud.res;
        }
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
        // The fight container starts at the screen opening of the bezel (44 units); content sits 8px inside it.
        const insetX = inFight ? 44 * Math.min(real.vw / 1640, real.vh / 1110) / zoom : 0;
        const vw = real.vw / zoom - 2 * insetX;
        const vh = real.vh / zoom;

        const padX = inFight ? Math.round(8 / zoom) : clamp(Math.round(vw * 0.01), 4, 10);
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
            if (container) {
                ro.observe(container);
                // Showing the fight changes zoom + insets: re-fit in the same frame (microtask, before paint)
                // so the HUD never paints once in the menu geometry and then jumps.
                let lastDisp = container.style.display;
                new MutationObserver(function () {
                    if (container.style.display === lastDisp) return;
                    lastDisp = container.style.display;
                    update(true);
                }).observe(container, { attributes: true, attributeFilter: ['style'] });
            }
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
