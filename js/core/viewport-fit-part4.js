"use strict";

// viewport-fit part 4 of 4: continues viewport-fit.js (shared scope: window.vfFitScope).
(function (NS) {
    const vfs = NS.vfs || (NS.vfs = {}); // shared mutable state (formerly closure lets)
    const { FIGHT_INSET, OVERLAY_CHROME, ROOT, RO_SUPPRESS_MS, SIDE_MAX, SIDE_MIN, SIZE_EPS, clamp, drawCables, ensureBezel, guiZoom, placeResPlate, playfieldParams, readCssNumber, resLabel, sizesClose, syncBezelTools, syncMapToAspect, syncPilotPlate, viewportSize } = NS; // from earlier parts
    Object.assign(NS, { update }); // functions (hoisted)

    function applyCanvasSize(canvasW, canvasH, sidePanel, padX, gap, fontBase, appScale, gameScale, fillScale, force) {
        if (!force && vfs.lastApplied.canvasW > 0) {
            if (
                sizesClose(canvasW, vfs.lastApplied.canvasW, SIZE_EPS) &&
                sizesClose(canvasH, vfs.lastApplied.canvasH, SIZE_EPS) &&
                sizesClose(sidePanel, vfs.lastApplied.sidePanel, 1)
            ) {
                return false;
            }
        }

        vfs.suppressROUntil = performance.now() + RO_SUPPRESS_MS;

        ROOT.style.setProperty('--canvas-w', Math.floor(canvasW) + 'px');
        ROOT.style.setProperty('--canvas-h', Math.floor(canvasH) + 'px');
        ROOT.style.setProperty('--side-panel-w', Math.floor(sidePanel) + 'px');
        ROOT.style.setProperty('--ui-pad', padX + 'px');
        ROOT.style.setProperty('--ui-gap', gap + 'px');
        ROOT.style.setProperty('--game-scale', String(Number(gameScale.toFixed(4))));
        ROOT.style.setProperty('--app-scale', String(Number(appScale.toFixed(4))));
        ROOT.style.setProperty('--fill-scale', String(Number(fillScale.toFixed(4))));
        ROOT.style.setProperty('--font-base', fontBase + 'px');

        vfs.lastApplied = { canvasW: canvasW, canvasH: canvasH, sidePanel: sidePanel };

        if (typeof window.renderManager !== 'undefined' && window.renderManager && typeof window.renderManager.syncViewportScale === 'function') {
            window.renderManager.syncViewportScale(gameScale);
        }
        return true;
    }

    /**
     * Playfield-first layout:
     * 1) compact sidebars at the shell edges
     * 2) fight fills the middle slot exactly (aspect = slot; no stretch)
     */
    function computeLayout(vw, vh, padX, padY, gap, aspect, fillSlot, slotMaxW, slotMaxH) {
        const shellW = Math.max(200, vw - padX * 2);
        const shellH = Math.max(180, vh - padY * 2);
        const availH = Math.max(160, slotMaxH != null ? slotMaxH : (shellH - OVERLAY_CHROME));

        const sidePanel = clamp(Math.round(shellW * 0.12), SIDE_MIN, SIDE_MAX);
        const maxW = Math.max(120, slotMaxW != null ? slotMaxW : (shellW - sidePanel * 2 - gap * 2));

        // Match the middle column exactly so width AND height freiräume are used.
        const slotAspect = maxW / Math.max(1, availH);
        let useAspect = fillSlot ? clamp(slotAspect, 0.45, 1.6) : aspect;

        let canvasW = maxW;
        let canvasH = canvasW / useAspect;
        if (canvasH > availH) {
            canvasH = availH;
            canvasW = canvasH * useAspect;
        }
        // Height-first nudge when floating-point left a vertical gap.
        if (fillSlot && availH - canvasH > 1 && canvasW <= maxW + 0.5) {
            canvasH = availH;
            canvasW = Math.min(maxW, canvasH * useAspect);
            useAspect = canvasW / Math.max(1, canvasH);
        }

        return {
            canvasW: canvasW,
            canvasH: canvasH,
            sidePanel: sidePanel,
            availW: maxW,
            availH: availH,
            aspect: useAspect
        };
    }

    /** Measured fight middle slot (canvas column minus under-stage chrome). */
    function measureFightSlot(gc) {
        if (!gc) return null;
        const mid = gc.querySelector('.game-canvas-container');
        if (!mid || mid.clientWidth < 80 || mid.clientHeight < 80) return null;
        const under = gc.querySelector('.gi-under-stage');
        const underHidden = !under || under.hasAttribute('hidden')
            || getComputedStyle(under).display === 'none';
        const underH = underHidden ? 0 : (under.offsetHeight + 8);
        const controls = mid.querySelector('.controls');
        const controlsHidden = !controls || getComputedStyle(controls).display === 'none';
        const controlsH = controlsHidden ? 0 : controls.offsetHeight;
        return {
            maxW: mid.clientWidth,
            maxH: Math.max(120, mid.clientHeight - underH - controlsH)
        };
    }

    /**
     * VOXEL display size: fill maxW×maxH at map aspect (no stretch).
     * Prefer an integer CSS scale of the logical map when it still uses
     * most of the slot; otherwise keep the continuous fit so the middle
     * column is not left empty (old backing/step snap halved the canvas).
     */
    function snapVoxel(aspect, maxW, maxH) {
        const mapW = Math.max(1, readCssNumber('--map-w', 360));
        const mapH = Math.max(1, readCssNumber('--map-h', Math.round(mapW / Math.max(0.45, aspect || 1.2))));
        const a = mapW / mapH;
        let fitW = maxW;
        let fitH = fitW / a;
        if (fitH > maxH) {
            fitH = maxH;
            fitW = fitH * a;
        }
        // Always fill the fitted slot (uniform scale, no stretch). Integer
        // map multiples only when they already cover the freiräume.
        const sInt = Math.max(1, Math.floor(Math.min(fitW / mapW, fitH / mapH)));
        const intW = mapW * sInt;
        const intH = mapH * sInt;
        if (intW >= fitW * 0.98 && intH >= fitH * 0.98) {
            return { canvasW: intW, canvasH: intH };
        }
        return {
            canvasW: Math.max(1, Math.floor(fitW)),
            canvasH: Math.max(1, Math.floor(fitH))
        };
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
        // Layout math uses the bezel screen opening (CSS --fr-open-*) plus the
        // 16px fight inset so the playfield scales into the remaining glass.
        const u = Math.min(real.vw / 1640, real.vh / 1110);
        const openL = 44 * u;
        const openR = 44 * u;
        const openT = (44 + 22) * u;
        const openB = 44 * u;
        const inset = inFight ? FIGHT_INSET : 0;
        const vw = (real.vw - openL - openR - 2 * inset) / zoom;
        const vh = (real.vh - openT - openB - 2 * inset) / zoom;

        const padX = inFight ? 0 : clamp(Math.round(vw * 0.01), 4, 10);
        const padY = inFight ? 0 : clamp(Math.round(vh * 0.008), 2, 8);
        const gap = inFight ? FIGHT_INSET : clamp(Math.round(vw * 0.008), 4, 10);

        const measured = inFight ? measureFightSlot(gc) : null;
        let layout = computeLayout(
            vw, vh, padX, padY, gap, aspect, inFight,
            measured && measured.maxW,
            measured && measured.maxH
        );
        let useAspect = layout.aspect || aspect;
        if (inFight && Math.abs(useAspect - aspect) > 0.001) {
            syncMapToAspect(useAspect);
        }
        let canvasW = layout.canvasW;
        let canvasH = layout.canvasH;
        let sidePanel = layout.sidePanel;

        if (ROOT.getAttribute('data-vf-ship-render') === 'VOXEL') {
            const snapped = snapVoxel(useAspect, canvasW, canvasH);
            canvasW = snapped.canvasW;
            canvasH = snapped.canvasH;
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

        // Settle once after first paint (fonts / zoom / measured middle)
        const token = ++vfs.secondPassToken;
        requestAnimationFrame(function () {
            if (token !== vfs.secondPassToken) return;
            const measured2 = inFight ? measureFightSlot(gc) : null;
            let layout2 = computeLayout(
                vw, vh, padX, padY, gap, aspect, inFight,
                measured2 && measured2.maxW,
                measured2 && measured2.maxH
            );
            let a2 = layout2.aspect || aspect;
            if (inFight && Math.abs(a2 - readCssNumber('--playfield-aspect', aspect)) > 0.001) {
                syncMapToAspect(a2);
            }
            let w2 = layout2.canvasW;
            let h2 = layout2.canvasH;
            let side2 = layout2.sidePanel;
            if (ROOT.getAttribute('data-vf-ship-render') === 'VOXEL') {
                const snapped = snapVoxel(a2, w2, h2);
                w2 = snapped.canvasW;
                h2 = snapped.canvasH;
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
        if (performance.now() < vfs.suppressROUntil) return;
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
            if (performance.now() < vfs.suppressROUntil) return;
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
})(window.vfFitScope || (window.vfFitScope = {}));
