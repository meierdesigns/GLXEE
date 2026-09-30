"use strict";

/**
 * Scales app content to fill the viewport while preserving aspect ratios.
 * Measures real chrome height so canvas + HUD always fit without clipping.
 * Per-planet playfield aspect + view zoom come from CSS vars set by planet-config.
 */
(function () {
    const ROOT = document.documentElement;
    const DEFAULT_ASPECT = 0.8; // display width / height (~480x600)
    const DEFAULT_DESIGN_W = 480;
    const DEFAULT_DESIGN_H = 600;

    function clamp(n, min, max) {
        return Math.max(min, Math.min(max, n));
    }

    function readCssNumber(name, fallback) {
        const raw = getComputedStyle(ROOT).getPropertyValue(name).trim();
        const n = parseFloat(raw);
        return Number.isFinite(n) ? n : fallback;
    }

    function playfieldParams() {
        // Aspect follows the current map; design box stays fixed so UI scale is stable.
        // Planet viewZoom is content scale (ships/bosses), NOT CSS frame zoom.
        const aspect = clamp(readCssNumber('--playfield-aspect', DEFAULT_ASPECT), 0.45, 1.4);
        return {
            aspect,
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

    function measureChromeHeight() {
        const container = document.querySelector('.game-canvas-container');
        const canvas = document.getElementById('gameCanvas');
        if (!container || !canvas) return 0;

        let h = 0;
        for (let i = 0; i < container.children.length; i++) {
            const el = container.children[i];
            if (el === canvas) continue;
            // Stage wraps the playfield canvas; height tracked via canvas sizing
            if (el.classList && el.classList.contains('game-stage')) continue;
            const cs = getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden') continue;
            h += el.getBoundingClientRect().height;
            h += parseFloat(cs.marginTop) || 0;
            h += parseFloat(cs.marginBottom) || 0;
        }
        return h;
    }

    function applyCanvasSize(canvasW, canvasH, sidePanel, padX, gap, fontBase, appScale, gameScale, fillScale) {
        ROOT.style.setProperty('--canvas-w', Math.floor(canvasW) + 'px');
        ROOT.style.setProperty('--canvas-h', Math.floor(canvasH) + 'px');
        ROOT.style.setProperty('--side-panel-w', sidePanel + 'px');
        ROOT.style.setProperty('--ui-pad', padX + 'px');
        ROOT.style.setProperty('--ui-gap', gap + 'px');
        ROOT.style.setProperty('--game-scale', String(Number(gameScale.toFixed(4))));
        ROOT.style.setProperty('--app-scale', String(Number(appScale.toFixed(4))));
        ROOT.style.setProperty('--fill-scale', String(Number(fillScale.toFixed(4))));
        ROOT.style.setProperty('--font-base', fontBase + 'px');

        if (typeof window.renderManager !== 'undefined' && window.renderManager && typeof window.renderManager.syncViewportScale === 'function') {
            window.renderManager.syncViewportScale(gameScale);
        }
    }

    function computeCanvas(vw, vh, chromeH, sidePanel, padX, padY, gap, aspect) {
        const sideChrome = sidePanel * 2 + padX * 2 + gap * 2;
        const availW = Math.max(120, vw - sideChrome);
        const availH = Math.max(160, vh - chromeH - padY * 2);
        // Always fit the entire map into the playfield frame (no mid-game zoom).
        let canvasH = Math.min(availH, availW / aspect);
        let canvasW = canvasH * aspect;
        return { canvasW, canvasH, availW, availH };
    }

    function update() {
        const { vw, vh } = viewportSize();
        const { aspect, designW, designH } = playfieldParams();

        ROOT.style.setProperty('--vw', vw + 'px');
        ROOT.style.setProperty('--vh', vh + 'px');

        const sidePanel = clamp(Math.round(vw * 0.14), 172, 220);
        const padX = clamp(Math.round(vw * 0.012), 6, 14);
        const padY = clamp(Math.round(vh * 0.012), 4, 10);
        const gap = clamp(Math.round(vw * 0.01), 6, 14);

        // Estimate first, then refine from measured chrome
        let chromeH = clamp(Math.round(vh * 0.30), 170, 300);
        const measured = measureChromeHeight();
        if (measured > 40) {
            chromeH = measured + 8;
        }

        let { canvasW, canvasH } = computeCanvas(vw, vh, chromeH, sidePanel, padX, padY, gap, aspect);

        const fillH = Math.max(160, vh - padY * 2);
        const fillW = Math.max(120, vw - padX * 2);
        const fillScale = Math.min(fillW / designW, fillH / designH);
        const gameScale = canvasW / designW;
        const appScale = clamp(Math.min(vw / 1100, vh / 800), 0.5, 2.5);
        const fontBase = clamp(Math.round(11 + appScale * 4), 11, 18);

        applyCanvasSize(canvasW, canvasH, sidePanel, padX, gap, fontBase, appScale, gameScale, fillScale);

        // Second pass after layout: chrome height can change with canvas width / clamps
        requestAnimationFrame(function () {
            const measured2 = measureChromeHeight();
            if (measured2 <= 40) return;

            const chrome2 = measured2 + 8;
            const size2 = computeCanvas(vw, vh, chrome2, sidePanel, padX, padY, gap, aspect);
            if (Math.abs(size2.canvasH - canvasH) < 2 && Math.abs(size2.canvasW - canvasW) < 2) {
                return;
            }

            const gameScale2 = size2.canvasW / designW;
            applyCanvasSize(
                size2.canvasW,
                size2.canvasH,
                sidePanel,
                padX,
                gap,
                fontBase,
                appScale,
                gameScale2,
                fillScale
            );
        });
    }

    let raf = 0;
    function scheduleUpdate() {
        if (raf) return;
        raf = requestAnimationFrame(function () {
            raf = 0;
            update();
        });
    }

    window.addEventListener('resize', scheduleUpdate);
    window.addEventListener('orientationchange', scheduleUpdate);
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', scheduleUpdate);
        window.visualViewport.addEventListener('scroll', scheduleUpdate);
    }

    function observeLayout() {
        if (typeof ResizeObserver === 'undefined') return;
        const ro = new ResizeObserver(scheduleUpdate);
        const watch = function () {
            const container = document.querySelector('.game-container');
            const canvasBox = document.querySelector('.game-canvas-container');
            if (container) ro.observe(container);
            if (canvasBox) ro.observe(canvasBox);
        };
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', watch);
        } else {
            watch();
        }
    }
    observeLayout();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', update);
    } else {
        update();
    }

    window.addEventListener('load', update);

    window.viewportFit = {
        update: update,
        scheduleUpdate: scheduleUpdate
    };
})();
