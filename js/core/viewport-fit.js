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

    function viewportSize() {
        const vv = window.visualViewport;
        if (vv && vv.width > 0 && vv.height > 0) {
            return { vw: vv.width, vh: vv.height };
        }
        return {
            vw: window.innerWidth || document.documentElement.clientWidth || 800,
            vh: window.innerHeight || document.documentElement.clientHeight || 600
        };
    }

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
        const zoom = guiZoom();
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
