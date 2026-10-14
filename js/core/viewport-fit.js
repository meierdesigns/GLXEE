"use strict";

/**
 * Scales app content to fill the viewport while preserving aspect ratios.
 * Playfield-first: maximize the fight canvas (full center-column height), then
 * give leftover width to the side HUD panels.
 */

// The code is split across viewport-fit*.js (kept under ~500 lines each). Parts share one private
// scope object, window.vfFitScope: functions and constants are exported/imported by name, and the
// formerly closure-wide `let`s live on `vfs`. Parts load in order (see index.html).
(function (NS) {
    const vfs = NS.vfs || (NS.vfs = {}); // shared mutable state (formerly closure lets)
    const syncPilotPlate = (...args) => NS.syncPilotPlate(...args); // defined in a later part
    const update = (...args) => NS.update(...args); // defined in a later part
    Object.assign(NS, { applyFrameStyle, clamp, endPreviewFaction, ensureBezel, frameAdjust, frameDefaults, getUi, hexToHsl, playfieldParams, readCssNumber, resLabel, saveFrameStyles, setPerf, setPreviewFaction, syncMapToAspect, viewportSize }); // functions (hoisted)

    const ROOT = document.documentElement;
    const DEFAULT_ASPECT = 1.42;
    const DEFAULT_DESIGN_W = 480;
    const DEFAULT_DESIGN_H = 400;
    const SIZE_EPS = 2;
    const RO_SUPPRESS_MS = 80;
    const SIDE_MIN = 180;
    const SIDE_MAX = 260;
    // Title + SHIP/FIELD strip under the fight (not measured from DOM)
    const OVERLAY_CHROME = 108;
    const FIGHT_INSET = 16;

    vfs.lastApplied = { canvasW: 0, canvasH: 0, sidePanel: 0 };
    vfs.suppressROUntil = 0;
    vfs.secondPassToken = 0;

    function clamp(n, min, max) {
        return Math.max(min, Math.min(max, n));
    }

    function readCssNumber(name, fallback) {
        const raw = getComputedStyle(ROOT).getPropertyValue(name).trim();
        const n = parseFloat(raw);
        return Number.isFinite(n) ? n : fallback;
    }

    function playfieldParams() {
        const aspect = clamp(readCssNumber('--playfield-aspect', DEFAULT_ASPECT), 0.45, 1.6);
        return {
            aspect: aspect,
            designW: DEFAULT_DESIGN_W,
            designH: Math.max(240, Math.round(DEFAULT_DESIGN_W / aspect))
        };
    }

    /** Widen logical map to match display aspect (square pixels, more columns). */
    function syncMapToAspect(aspect) {
        const mapH = Math.max(1, Math.round(readCssNumber('--map-h', 300)));
        const mapW = Math.max(1, Math.round(mapH * aspect));
        const prevW = readCssNumber('--map-w', 0);
        ROOT.style.setProperty('--playfield-aspect', String(Number(aspect.toFixed(6))));
        ROOT.style.setProperty('--map-w', String(mapW));
        ROOT.style.setProperty('--map-h', String(mapH));
        if (Math.abs(prevW - mapW) < 1) return mapW;
        const canvas = document.getElementById('gameCanvas');
        const k = (typeof window.renderManager !== 'undefined' && window.renderManager
            && typeof window.renderManager.getRenderScale === 'function')
            ? window.renderManager.getRenderScale()
            : (Number(window.PLAYFIELD_RENDER_SCALE) || 1);
        const scaleK = Number.isFinite(k) && k >= 1 ? Math.round(k) : 1;
        if (canvas) {
            const bw = mapW * scaleK;
            const bh = mapH * scaleK;
            if (canvas.width !== bw) canvas.width = bw;
            if (canvas.height !== bh) canvas.height = bh;
        }
        if (typeof game !== 'undefined' && game) {
            game.width = mapW;
            game.height = mapH;
            game.baseWidth = mapW;
            game.baseHeight = mapH;
            game.internalWidth = mapW;
            game.internalHeight = mapH;
            game.mapWidth = mapW;
            game.mapHeight = mapH;
        }
        if (typeof gameStateManager !== 'undefined' && gameStateManager.setGameDimensions) {
            gameStateManager.setGameDimensions(mapW, mapH);
        }
        if (typeof window.renderManager !== 'undefined' && window.renderManager
            && typeof window.renderManager.setPlayfieldSize === 'function') {
            window.renderManager.setPlayfieldSize(mapW, mapH);
        }
        return mapW;
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
    vfs.resOpen = false;
    vfs.fxOpen = false;

    // Per-faction frame style overrides (bevel, plate colours, deco), kept in localStorage.
    const FACTIONS = ['terran', 'kronax', 'voidborn', 'pirate', 'machine'];
    const FRAME_KEY = 'vf-frame-style';
    const FRAME_PROPS = ['--fr-bevel', '--fr-bevel-set', '--hull', '--hull-lit', '--hull-dark'];
    vfs.frameStyles = {};
    try { vfs.frameStyles = JSON.parse(localStorage.getItem(FRAME_KEY) || '{}') || {}; } catch (e) { vfs.frameStyles = {}; }
    vfs.editFaction = null;
    function saveFrameStyles() {
        try { localStorage.setItem(FRAME_KEY, JSON.stringify(vfs.frameStyles)); } catch (e) { /* ignore */ }
    }
    function applyFrameStyle() {
        const frame = document.getElementById('vf-bezel');
        if (!frame) return;
        FRAME_PROPS.forEach(function (p) { frame.style.removeProperty(p); });
        frame.style.removeProperty('--fr-deco');
        const st = vfs.frameStyles[frame.getAttribute('data-faction')];
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
    let silhouetteRaf = 0, silKey = '';
    function clearSilhouette(body, frame) {
        body.style.clipPath = '';
        frame.style.clipPath = '';
        document.querySelectorAll('[data-vf-stage-clip]').forEach(function (el) { el.removeAttribute('data-vf-stage-clip'); });
    }
    function updateSilhouette() {
        silhouetteRaf = 0;
        const tS = performance.now();
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
        if (off || !cell || !shape || shape === 'none' || W < 4 || H < 4) { clearSilhouette(body, frame); silKey = ''; return; }
        // Same shape, size and cell as the mask already in place: rebuilding it would only re-invalidate (repaint) the whole
        // clipped screen. Every root style tick during a faction switch used to do that 3-4 times (flicker inside the bezel).
        const outRNow = getComputedStyle(document.documentElement).getPropertyValue('--fr-out');
        const silKeyNow = shape + '|' + W + 'x' + H + '|' + cell + '|' + outRNow;
        if (silKeyNow === silKey && document.getElementById('vfStageClipPath') && body.style.clipPath) { tagStageLayers(body, frame); return; }
        const probe = document.createElement('div');
        probe.id = 'vfSilProbe';
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
        if (!ok) { clearSilhouette(body, frame); silKey = ''; return; }
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
        if (window.vfLog) window.vfLog('mask', 'pixel silhouette rebuilt in ' + Math.round(performance.now() - tS) + 'ms (' + cw + 'x' + ch + ' cells, path ' + d.length + ' chars)');
        body.style.clipPath = 'url(#vfStageClip)';
        frame.style.clipPath = 'url(#vfStageClip)';
        silKey = silKeyNow;
        tagStageLayers(body, frame);
    }
    // Fixed-position stage layers (start screen, station, overlays) ignore the body's clip, so
    // every full-stage layer gets the same clip. Anything with another box (tooltips, the
    // remote) is left alone.
    function tagStageLayers(body, frame) {
        const br = body.getBoundingClientRect();
        Array.prototype.forEach.call(body.children, function (el) {
            if (el === frame || el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'svg') return;
            const r = el.getBoundingClientRect();
            const full = Math.abs(r.left - br.left) < 2 && Math.abs(r.top - br.top) < 2
                && Math.abs(r.width - br.width) < 2 && Math.abs(r.height - br.height) < 2;
            if (full) { if (!el.hasAttribute('data-vf-stage-clip')) el.setAttribute('data-vf-stage-clip', ''); }
            else if (el.hasAttribute('data-vf-stage-clip')) el.removeAttribute('data-vf-stage-clip');
        });
    }
    function scheduleSilhouette() {
        if (!silhouetteRaf) silhouetteRaf = requestAnimationFrame(updateSilhouette);
    }
    (function watchSilhouette() {
        const frame = document.getElementById('vf-bezel');
        if (!frame || !document.body) { document.addEventListener('DOMContentLoaded', watchSilhouette, { once: true }); return; }
        // A faction change rebuilds the stepped mask in the same task (before paint): a frame late showed the new frame under the old mask.
        new MutationObserver(function () {
            if (silhouetteRaf) { cancelAnimationFrame(silhouetteRaf); silhouetteRaf = 0; }
            updateSilhouette();
        }).observe(frame, { attributes: true, attributeFilter: ['data-faction'] });
        new MutationObserver(scheduleSilhouette).observe(document.documentElement, { attributes: true, attributeFilter: ['data-vf-frame-px', 'style'] });
        if (window.ResizeObserver) new ResizeObserver(scheduleSilhouette).observe(document.body);
        // The rebuild itself adds / removes its own probe on <body>: ignoring that stops it re-triggering itself every frame.
        new MutationObserver(function (recs) {
            const other = recs.some(function (r) {
                return Array.prototype.concat.call([], Array.prototype.slice.call(r.addedNodes), Array.prototype.slice.call(r.removedNodes)).some(function (n) { return n.id !== 'vfSilProbe'; });
            });
            if (other) scheduleSilhouette();
        }).observe(document.body, { childList: true });
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
        vfs.editFaction = null;
        if (typeof factionShipStyles !== 'undefined' && factionShipStyles.applyDocumentFactionTheme) factionShipStyles.applyDocumentFactionTheme();
        if (typeof homeStationUI !== 'undefined' && homeStationUI.applyFactionTheme) homeStationUI.applyFactionTheme();
        syncPilotPlate(); // snaps back to the active profile's faction
    }

    // Visual-settings sidebar (opened from the bezel tools, available on every screen):
    // tabs FX / VOXEL / FRAME / SIZES. In combat it pauses the game while open.
    const FX_TABS = [['fx', 'FX'], ['voxel', 'VOXEL'], ['frame', 'FACTIONS'], ['sizes', 'SIZES'], ['text', 'TEXT'], ['perf', 'PERF'], ['debug', 'DEBUG']];
    const FX_TAB_ICONS = {
        fx: svg16('<path d="M8 1v3M8 12v3M1 8h3M12 8h3M3 3l2 2M11 11l2 2M13 3l-2 2M5 11l-2 2"/>'),
        voxel: svg16('<path d="M8 2l5 3v6l-5 3-5-3V5zM3 5l5 3 5-3M8 8v6"/>'),
        frame: svg16('<rect x="2" y="3" width="12" height="10"/><rect x="5" y="6" width="6" height="4"/>'),
        sizes: svg16('<path d="M2 14V9M2 14h5M14 2v5M14 2H9M3 13l10-10"/>'),
        text: svg16('<path d="M3 13L8 3l5 10M5 10h6"/>'),
        perf: svg16('<path d="M2 12a6 6 0 0112 0M8 12l3-5"/>'),
        debug: svg16('<path d="M6 2h4v3h3v4h-3v5H6V9H3V5h3zM7 6h2M8 5v2"/>')
    };
    // Performance switches (remote PERF tab). Stored per machine; applied as <html> attributes the CSS keys on.
    //   sway  AUTO = follow the OS "reduce motion" setting, ON = always sway, OFF = never
    //   heavy ON/OFF = the backdrop-filter layers (chroma / bloom / CRT)
    //   anim  ON/OFF = looping animations of the screen-effect layers and selection pulse
    const PERF_KEY = 'vf-perf';
    const perf = { sway: 'AUTO', heavy: 'ON', anim: 'ON' };
    try {
        const sp = JSON.parse(localStorage.getItem(PERF_KEY) || 'null');
        if (sp) {
            if (/^(AUTO|ON|OFF)$/.test(sp.sway)) perf.sway = sp.sway;
            if (/^(ON|OFF)$/.test(sp.heavy)) perf.heavy = sp.heavy;
            if (/^(ON|OFF)$/.test(sp.anim)) perf.anim = sp.anim;
        }
    } catch (e) { /* defaults */ }
    function applyPerf() {
        const root = document.documentElement;
        root.setAttribute('data-vf-perf-heavy', perf.heavy === 'OFF' ? 'off' : 'on');
        root.setAttribute('data-vf-perf-anim', perf.anim === 'OFF' ? 'off' : 'on');
        try { localStorage.setItem(PERF_KEY, JSON.stringify(perf)); } catch (e) { /* ignore */ }
    }
    function setPerf(key, val) {
        if (!(key in perf)) return;
        perf[key] = val;
        applyPerf();
    }
    applyPerf();
    window.vfPerf = perf;
    // Selected section of the remote control survives a refresh.
    const FXTAB_KEY = 'vf-fx-tab';
    vfs.fxTab = 'fx';
    try {
        const savedTab = localStorage.getItem(FXTAB_KEY);
        if (FX_TABS.some(function (t) { return t[0] === savedTab; })) vfs.fxTab = savedTab;
    } catch (e) { /* ignore */ }
    vfs.fxPausedByUs = false;
    vfs.fxHideTimer = 0;
    function getUi() {
        return window.uiAppearanceManager || (typeof uiAppearanceManager !== 'undefined' ? uiAppearanceManager : null);
    }
    // Scroll position per tab, kept across redraws, tab switches and closing the plate.
    vfs.fxScroll = {};
    try { vfs.fxScroll = JSON.parse(localStorage.getItem('vf-fx-scroll') || '{}') || {}; } catch (e) { vfs.fxScroll = {}; }
    vfs.fxScrollLock = false;
    Object.assign(NS, { FACTIONS, FIGHT_INSET, FR_LIGHT, FR_SAT, FS_OFF, FS_ON, FXTAB_KEY, FX_ICON, FX_TABS, FX_TAB_ICONS, OVERLAY_CHROME, POWER, RES_ICON, ROOT, RO_SUPPRESS_MS, SIDE_MAX, SIDE_MIN, SIZE_EPS, perf });
})(window.vfFitScope || (window.vfFitScope = {}));
