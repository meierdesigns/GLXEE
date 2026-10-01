"use strict";

/**
 * CSS `zoom` compatibility. The GUI is shrunk with `zoom: var(--gui-zoom)`
 * (sometimes nested). Chromium ≥ 128 reports getBoundingClientRect() in
 * visual viewport px, the same space as MouseEvent.clientX. Older engines
 * (e.g. embedded Electron browsers) report rects of zoomed elements
 * un-zoomed, so every pointer hit test drifts by the zoom factor towards the
 * top-left. On such engines getBoundingClientRect is patched to return
 * visual px, so all pointer code can rely on the modern behaviour.
 *
 * window.vfEffectiveZoom(el) gives the accumulated zoom of an element — use
 * it to turn visual px deltas back into CSS px when positioning inside a
 * zoomed container.
 */
(function () {
    function effectiveZoom(el) {
        let z = 1;
        for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
            const v = parseFloat(getComputedStyle(n).zoom);
            if (Number.isFinite(v) && v > 0) z *= v;
        }
        return z;
    }

    const nativeRect = Element.prototype.getBoundingClientRect;

    function detectLegacy() {
        const probe = document.createElement('div');
        probe.style.cssText = 'position:absolute;left:-9999px;top:0;width:100px;height:10px;zoom:0.5;visibility:hidden';
        document.documentElement.appendChild(probe);
        const w = nativeRect.call(probe).width;
        probe.remove();
        // Modern: 50 (visual px). Legacy: 100 (un-zoomed).
        return w > 75;
    }

    let legacy = false;
    try { legacy = detectLegacy(); } catch (e) { legacy = false; }

    if (legacy) {
        Element.prototype.getBoundingClientRect = function () {
            const r = nativeRect.call(this);
            const z = effectiveZoom(this);
            if (Math.abs(z - 1) < 0.001) return r;
            return new DOMRect(r.x * z, r.y * z, r.width * z, r.height * z);
        };
        // SVG screen matrices (galaxy map hit tests) need the same scaling.
        if (typeof SVGGraphicsElement !== 'undefined' && SVGGraphicsElement.prototype.getScreenCTM) {
            const nativeCtm = SVGGraphicsElement.prototype.getScreenCTM;
            SVGGraphicsElement.prototype.getScreenCTM = function () {
                const m = nativeCtm.call(this);
                if (!m) return m;
                const z = effectiveZoom(this);
                if (Math.abs(z - 1) < 0.001) return m;
                return new DOMMatrix([m.a * z, m.b * z, m.c * z, m.d * z, m.e * z, m.f * z]);
            };
        }
    }

    window.vfLegacyZoom = legacy;
    // Visual px ↔ CSS px factor for positioning inside `el`.
    window.vfEffectiveZoom = function (el) {
        return el ? effectiveZoom(el) : 1;
    };
    /**
     * Visual px (rects, pointer coords, deltas) → CSS px for a value that
     * is applied as left/top/translate on `el` (its zoomed ancestors count).
     */
    window.vfToCssPx = function (el, px) {
        const z = el && el.parentElement ? effectiveZoom(el.parentElement) : 1;
        return px / z;
    };
    /** Pointer delta (visual px) → CSS px for panning `el` via translate. */
    window.vfPanDelta = function (el, d) {
        return window.vfToCssPx(el, d);
    };
})();
