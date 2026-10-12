"use strict";

// viewport-fit bezel morph: tweens the bezel silhouette (clip-path polygons) from one faction to the next.
(function (NS) {
    const { ROOT } = NS; // from earlier parts
    Object.assign(NS, { morphBezelShape }); // functions (hoisted)

    const N = 220; // points on the morphing outline
    let raf = 0;

    function splitTop(str, sep) {
        const out = []; let depth = 0, cur = '';
        for (let i = 0; i < str.length; i++) {
            const c = str[i];
            if (c === '(') depth++;
            if (c === ')') depth--;
            if (depth === 0 && c === sep) { if (cur.trim()) out.push(cur.trim()); cur = ''; } else cur += c;
        }
        if (cur.trim()) out.push(cur.trim());
        return out;
    }
    // Resolve a CSS length token against the bezel box -> [fraction of width, fraction of height as px/H].
    function measure(bz, probe, tok, axisX) {
        probe.style.width = axisX ? tok : '0';
        probe.style.height = axisX ? '0' : tok;
        const r = probe.getBoundingClientRect();
        return axisX ? r.width : r.height;
    }
    // -> closed outline as [[x, y]] in view px relative to the bezel box.
    function outline(bz, name) {
        const raw = getComputedStyle(ROOT).getPropertyValue('--fr-shape-' + name).trim();
        if (!raw) return null;
        const box = bz.getBoundingClientRect();
        const W = box.width, H = box.height;
        const holder = document.createElement('div');
        holder.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;visibility:hidden;pointer-events:none;';
        const probe = document.createElement('div');
        probe.style.cssText = 'position:absolute;left:0;top:0;';
        holder.appendChild(probe);
        bz.appendChild(holder);
        let pts = null;
        try {
            if (raw.indexOf('polygon(') === 0) {
                pts = splitTop(raw.slice(8, raw.lastIndexOf(')')), ',').map(function (p) {
                    const xy = splitTop(p, ' ');
                    return [measure(bz, probe, xy[0], true), measure(bz, probe, xy[1], false)];
                });
            } else if (raw.indexOf('inset(') === 0) {
                const tok = raw.slice(raw.indexOf('round') + 5, raw.lastIndexOf(')')).trim();
                const rx = measure(bz, probe, tok, true), ry = rx;
                pts = [];
                [[W - rx, ry, 0], [W - rx, H - ry, 1], [rx, H - ry, 2], [rx, ry, 3]].forEach(function (c) {
                    for (let k = 0; k <= 8; k++) {
                        const a = (c[2] - 1 + k / 8) * Math.PI / 2;      // top-right arc runs from -90deg (top edge) to 0deg (right edge), and so on clockwise
                        pts.push([c[0] + Math.cos(a) * rx, c[1] + Math.sin(a) * ry]);
                    }
                });
            }
        } finally { holder.remove(); }
        return pts && pts.length > 2 ? { pts: pts, W: W, H: H } : null;
    }
    // Closed outline -> N points, clockwise, with the four corners of the outline as anchors: every side of one shape
    // maps onto the same side of the other shape (spreading points by total length alone made sides drift across
    // each other, which twisted the in-between polygon and made the frame collapse mid-morph).
    function resample(pts, W, H) {
        let area = 0;
        for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; area += a[0] * b[1] - b[0] * a[1]; }
        if (area < 0) pts = pts.slice().reverse();
        const near = function (cx, cy) {
            let bi = 0, bd = Infinity;
            for (let i = 0; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - cx, pts[i][1] - cy); if (d < bd) { bd = d; bi = i; } }
            return bi;
        };
        const tl = near(0, 0);
        pts = pts.slice(tl).concat(pts.slice(0, tl));
        const anchors = [0, near(W, 0), near(W, H), near(0, H)];
        for (let k = 1; k < 4; k++) if (anchors[k] <= anchors[k - 1]) anchors[k] = Math.min(pts.length - 1, anchors[k - 1] + 1);
        const out = [], per = N / 4;
        for (let k = 0; k < 4; k++) {
            const i0 = anchors[k], i1 = k < 3 ? anchors[k + 1] : pts.length;
            const sec = [];
            for (let i = i0; i <= i1; i++) sec.push(pts[i % pts.length]);
            const seg = [0];
            for (let i = 1; i < sec.length; i++) seg.push(seg[i - 1] + Math.hypot(sec[i][0] - sec[i - 1][0], sec[i][1] - sec[i - 1][1]));
            const total = seg[seg.length - 1] || 1;
            let j = 1;
            for (let m = 0; m < per; m++) {
                const d = total * m / per;
                while (j < seg.length - 1 && seg[j] < d) j++;
                const pa = sec[j - 1], pb = sec[j];
                const t = (d - seg[j - 1]) / ((seg[j] - seg[j - 1]) || 1);
                out.push([pa[0] + (pb[0] - pa[0]) * t, pa[1] + (pb[1] - pa[1]) * t]);
            }
        }
        return out;
    }
    function morphBezelShape(fromName, toName, ms) {
        const bz = document.getElementById('vf-bezel');
        if (!bz || !fromName || fromName === toName) return;
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        // Pixel frame: the stepped mask (updateSilhouette) owns the inline clip-path of body and frame. A smooth polygon
        // would overwrite it on the body only and wipe it at the end, so the new silhouette is applied in one step instead.
        if (ROOT.getAttribute('data-vf-frame-px') === 'on') return;
        const A = outline(bz, fromName), B = outline(bz, toName);
        if (!A || !B) return;
        const W = B.W, H = B.H, a = resample(A.pts, A.W, A.H), b = resample(B.pts, W, H);
        cancelAnimationFrame(raf);
        const t0 = performance.now();
        const step = function (now) {
            const p = Math.min(1, (now - t0) / ms);
            const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
            const poly = 'polygon(' + a.map(function (pt, i) {
                return ((pt[0] + (b[i][0] - pt[0]) * e) / W * 100).toFixed(3) + '% ' + ((pt[1] + (b[i][1] - pt[1]) * e) / H * 100).toFixed(3) + '%';
            }).join(',') + ')';
            bz.style.setProperty('--fr-shape', poly);
            document.body.style.clipPath = poly;
            if (p < 1) raf = requestAnimationFrame(step);
            else { bz.style.removeProperty('--fr-shape'); document.body.style.clipPath = ''; }
        };
        step(t0);
        raf = requestAnimationFrame(step);
    }
})(window.vfFitScope || (window.vfFitScope = {}));
