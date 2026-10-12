"use strict";

// viewport-fit cables: bezel-to-window-edge cables, split out of part 3 (shared scope: window.vfFitScope).
(function (NS) {
    const { ROOT } = NS; // from earlier parts
    Object.assign(NS, { cableSwitch, drawCables }); // functions (hoisted)

    // Cables running from the bezel out to the window edge (decor, window space only).
    // Drawn on the same odd-pixel lattice as the bezel voxel / FRAME PX settings — no smooth curves.
    let lastCableArgs = null;
    function cableCellPx() {
        const cs = getComputedStyle(ROOT);
        let cell = parseFloat(cs.getPropertyValue('--fr-px')) || 0;
        if (!(cell > 0)) cell = parseFloat(cs.getPropertyValue('--ui-voxel')) || 0;
        if (!(cell > 0) && typeof uiAppearanceManager !== 'undefined' && uiAppearanceManager.getGuiVoxelCell) {
            cell = Number(uiAppearanceManager.getGuiVoxelCell()) || 0;
        }
        if (!(cell > 0)) cell = Number(ROOT.getAttribute('data-vf-voxel-size')) || 4;
        // Window-space cables need chunky blocks (bezel voxels read large).
        cell = Math.max(5, Math.round(cell));
        return Math.floor(cell / 2) * 2 + 1; // odd, matches vfFramePx
    }
    // Faction switch: all old cables glide out of the bezel together, the new faction's cables
    // glide in at their own spots, while `apply` recolours the bezel, palette and background in the same run.
    let cableFac = '', cableBusy = false, cableTarget = '', cableQueued = null;
    function cableSwitch(fac, apply) {
        const svg = document.getElementById('vf-cables');
        if (!svg || !svg.firstChild || !lastCableArgs || reduceNow()) { apply(); return; }
        if (cableBusy) { cableQueued = [fac, apply]; return; }
        cableBusy = true;
        // Old cables leave as a ghost copy while the new set already glides in underneath.
        const ghost = svg.cloneNode(true);
        ghost.id = 'vf-cables-old';
        ghost.classList.add('vfc-out');
        svg.parentNode.insertBefore(ghost, svg.nextSibling);
        cableFac = '';
        cableTarget = fac;
        cableBusy = false;
        drawCables(lastCableArgs[0], lastCableArgs[1], lastCableArgs[2]);
        cableBusy = true;
        cableTarget = '';
        svg.classList.add('vfc-in');
        // Frame shape, colours, palette and window background change together with the cables (one shared run),
        // instead of waiting for the cables to finish first.
        const bz = document.getElementById('vf-bezel');
        const from = bz && bz.getAttribute('data-faction');
        ghostSnapshot();
        apply();
        if (bz && from && from !== fac && NS.morphBezelShape) NS.morphBezelShape(from, fac, 700);
        setTimeout(function () {
            ghost.remove();
            svg.classList.remove('vfc-in');
            cableBusy = false;
            const q = cableQueued; cableQueued = null;
            if (q) cableSwitch(q[0], q[1]);
        }, 750);
    }
    // Faction recolour: freeze the old window background as a ghost that fades out over the new one
    // (gradients cannot be tweened, so they cross-fade instead).
    function ghostSnapshot() {
        if (reduceNow()) return;
        const cs = getComputedStyle(ROOT);
        const bg = document.createElement('div');
        bg.className = 'vf-ghost vf-ghost-bg';
        ['backgroundColor', 'backgroundImage', 'backgroundSize', 'backgroundPosition', 'backgroundRepeat'].forEach(function (k) { bg.style[k] = cs[k]; });
        const cables = document.getElementById('vf-cables');
        ROOT.insertBefore(bg, cables || document.body);
        setTimeout(function () { bg.remove(); }, 800);
    }
    // Every cable moves at its own speed (0.30 - 0.66 s), deterministic per position in the set.
    let cableN = 0;
    function cableDur() { cableN = (cableN + 1) % 12; return (0.3 + ((cableN * 5) % 7) * 0.06).toFixed(2); }
    function reduceNow() { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
    function drawCables(w, h, real) {
        lastCableArgs = [w, h, real];
        cableN = 0;
        if (cableBusy) return;
        let svg = document.getElementById('vf-cables');
        if (!svg) {
            svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.id = 'vf-cables';
            svg.setAttribute('aria-hidden', 'true');
            svg.setAttribute('shape-rendering', 'crispEdges');
            new MutationObserver(function () { if (lastCableArgs) drawCables.apply(null, lastCableArgs); })
                .observe(document.documentElement, {
                    attributes: true,
                    attributeFilter: ['data-vf-faction', 'data-vf-frame-px', 'data-vf-gui-voxel', 'data-vf-voxel-size', 'style']
                });
            document.documentElement.insertBefore(svg, document.body);
        }
        const k = real.scale;
        const cell = cableCellPx();
        const snap = function (v) { return Math.round(v / cell) * cell; };
        const snapPt = function (p) { return [snap(p[0]), snap(p[1])]; };
        const sw = real.vw * k, sh = real.vh * k;
        const sx = (w - sw) / 2, sy = (h - sh) / 2;
        svg.setAttribute('width', w);
        svg.setAttribute('height', h);
        svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
        const MIN = cell * 4;
        // Plugs sit over the bezel and reach into the screen opening.
        const bz = document.querySelector('.vf-bezel');
        const br = bz ? bz.getBoundingClientRect() : null;
        const u = br && br.width ? Math.min(br.width / 1640, br.height / 1110) : k * 0.6;
        const reachH = snap(64 * u);
        const reachTop = snap(86 * u);
        const reachBot = snap(64 * u);
        let out = '';
        // Each faction runs its own kind of cable — all routes stay on the voxel lattice.
        const fac = cableTarget || (ROOT.getAttribute('data-vf-faction') || (bz && bz.getAttribute('data-faction')) || 'terran');
        const STY = {
            terran:   { out: '#05060a', body: '#3a4150', hi: '#6a7488', route: 'ortho', led: 'var(--color-primary, #3dff6a)', plugFill: '#0c0e12', plugLine: '#2c313b', thick: 2 },
            kronax:   { out: '#0a0403', body: '#4a2316', hi: '#d9611f', route: 'zig', led: '#ff7a2a', plugFill: '#1a0c08', plugLine: '#7a3a1c', thick: 3, hiDash: true },
            voidborn: { out: '#07030f', body: '#2a1648', hi: '#b27cff', route: 'stair', led: '#c79bff', plugFill: '#120826', plugLine: '#5a2fa0', thick: 2, glow: '#7a3cff' },
            pirate:   { out: '#070604', body: '#4a3f2a', hi: '#cdc7a4', route: 'crook', led: '#e8d9a0', plugFill: '#1a160d', plugLine: '#6b5a3a', thick: 2, hiDash: true, hiW: 1 },
            machine:  { out: '#020706', body: '#0f3331', hi: '#3ff0d6', route: 'chamfer', led: '#3ff0d6', plugFill: '#041211', plugLine: '#1a5a54', thick: 2, hiDash: true, hiW: 1 }
        };
        const S = STY[fac] || STY.terran;
        // Each faction plugs its cables in at its own spots: h = [left, right], v = [top, bottom].
        const LAY = {
            terran:   { h: [[0.2, 0.55, 0.8], [0.3, 0.7]], v: [[0.25, 0.75], [0.5]] },
            kronax:   { h: [[0.12, 0.88], [0.25, 0.5, 0.75]], v: [[0.5], [0.2, 0.8]] },
            voidborn: { h: [[0.35], [0.15, 0.4, 0.85]], v: [[0.15, 0.5, 0.85], [0.7]] },
            pirate:   { h: [[0.1, 0.3, 0.6, 0.9], [0.5]], v: [[0.35, 0.65], [0.1, 0.9]] },
            machine:  { h: [[0.5], [0.2, 0.35, 0.65, 0.8]], v: [[0.2, 0.4, 0.6, 0.8], [0.5]] }
        };
        const L = LAY[fac] || LAY.terran;
        const tt = Math.max(cell, S.thick * cell);
        // Force axis-aligned polyline (H then V / V then H stairs).
        const ortho = function (pts0) {
            const r = [snapPt(pts0[0])];
            for (let i = 1; i < pts0.length; i++) {
                const a = r[r.length - 1];
                const b = snapPt(pts0[i]);
                if (a[0] === b[0] && a[1] === b[1]) continue;
                if (a[0] !== b[0] && a[1] !== b[1]) {
                    if (Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1])) r.push([b[0], a[1]]);
                    else r.push([a[0], b[1]]);
                }
                r.push(b);
            }
            return r;
        };
        const zig = function (pts) {
            // Square sawtooth on the lattice (1-cell amplitude, 2-cell period).
            const step = cell * 2, amp = cell;
            const r = [snapPt(pts[0])];
            for (let i = 1; i < pts.length; i++) {
                const a0 = snapPt(pts[i - 1]), b0 = snapPt(pts[i]);
                const dx = b0[0] - a0[0], dy = b0[1] - a0[1], len = Math.hypot(dx, dy);
                if (!len) continue;
                const horiz = Math.abs(dx) >= Math.abs(dy);
                const n = Math.max(1, Math.floor(len / step));
                for (let j = 1; j <= n; j++) {
                    const tm = j / n;
                    const sg = j % 2 ? 1 : -1;
                    if (horiz) r.push([snap(a0[0] + dx * tm), snap(a0[1] + amp * sg)]);
                    else r.push([snap(a0[0] + amp * sg), snap(a0[1] + dy * tm)]);
                }
                r.push(b0);
            }
            return ortho(r);
        };
        const chamfer = function (pts) {
            const c = cell * 2;
            const r = [snapPt(pts[0])];
            for (let i = 1; i < pts.length - 1; i++) {
                const p0 = snapPt(pts[i - 1]), p1 = snapPt(pts[i]), p2 = snapPt(pts[i + 1]);
                const l1 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) || 1;
                const l2 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) || 1;
                const cc = Math.min(c, snap(l1 / 2), snap(l2 / 2));
                r.push([snap(p1[0] - (p1[0] - p0[0]) / l1 * cc), snap(p1[1] - (p1[1] - p0[1]) / l1 * cc)]);
                r.push([snap(p1[0] + (p2[0] - p1[0]) / l2 * cc), snap(p1[1] + (p2[1] - p1[1]) / l2 * cc)]);
            }
            r.push(snapPt(pts[pts.length - 1]));
            return ortho(r);
        };
        const crook = function (pts) {
            const r = [snapPt(pts[0])];
            for (let i = 1; i < pts.length; i++) {
                const a0 = snapPt(pts[i - 1]), b0 = snapPt(pts[i]);
                const dx = b0[0] - a0[0], dy = b0[1] - a0[1], len = Math.hypot(dx, dy);
                if (len > cell * 6) {
                    const o = (i % 2 ? 1 : -1) * cell;
                    const horiz = Math.abs(dx) >= Math.abs(dy);
                    if (horiz) {
                        r.push([snap(a0[0] + dx * 0.33), snap(a0[1] + o)]);
                        r.push([snap(a0[0] + dx * 0.66), snap(a0[1] - o)]);
                    } else {
                        r.push([snap(a0[0] + o), snap(a0[1] + dy * 0.33)]);
                        r.push([snap(a0[0] - o), snap(a0[1] + dy * 0.66)]);
                    }
                }
                r.push(b0);
            }
            return ortho(r);
        };
        // Voidborn "tendril": blocky stairs that alternate turn direction each corner.
        const stair = function (pts) {
            const r = [snapPt(pts[0])];
            for (let i = 1; i < pts.length; i++) {
                const a = r[r.length - 1];
                const b = snapPt(pts[i]);
                if (a[0] === b[0] || a[1] === b[1]) { r.push(b); continue; }
                const flip = i % 2;
                if (flip) { r.push([b[0], a[1]]); r.push(b); }
                else { r.push([a[0], b[1]]); r.push(b); }
            }
            return r;
        };
        const pathD = function (pts) {
            return 'M' + pts.map(function (q) { return q[0] + ' ' + q[1]; }).join('L');
        };
        const cable = function (pts0, key) {
            let pts;
            if (S.route === 'zig') pts = zig(pts0);
            else if (S.route === 'chamfer') pts = chamfer(pts0);
            else if (S.route === 'crook') pts = crook(pts0);
            else if (S.route === 'stair') pts = stair(pts0);
            else pts = ortho(pts0);
            const d = pathD(pts);
            const hiW = Math.max(cell, (S.hiW || 1) * cell);
            const offN = snap(tt / 2) || cell;
            const off = key === 'v' ? (-offN) + ' 0' : '0 ' + (-offN);
            const dash = S.hiDash ? ' stroke-dasharray="' + (cell * 2) + ' ' + (cell * 2) + '"' : '';
            // Outer halo as a thicker lattice stroke (no soft blur / round caps).
            if (S.glow) {
                out += '<path d="' + d + '" fill="none" stroke="' + S.glow + '" stroke-opacity="0.4" stroke-width="' + (tt + cell * 2) + '" stroke-linejoin="miter" stroke-linecap="square"/>';
            }
            out += '<path d="' + d + '" fill="none" stroke="' + S.out + '" stroke-width="' + (tt + cell) + '" stroke-linejoin="miter" stroke-linecap="square"/>' +
                '<path d="' + d + '" fill="none" stroke="' + S.body + '" stroke-width="' + tt + '" stroke-linejoin="miter" stroke-linecap="square"/>' +
                '<path d="' + d + '" fill="none" stroke="' + S.hi + '" stroke-width="' + hiW + '"' + dash +
                ' stroke-linejoin="miter" stroke-linecap="square" transform="translate(' + off + ')"/>';
        };
        const plug = function (x, y, horiz, dir) {
            const L = Math.max(cell * 3, snap(20 * k + 8));
            const T = tt + cell;
            const rx = snap(horiz ? (dir < 0 ? x - L : x) : x - T / 2);
            const ry = snap(horiz ? y - T / 2 : (dir < 0 ? y - L : y));
            const rw = snap(horiz ? L : T);
            const rh = snap(horiz ? T : L);
            const ledW = horiz ? cell : Math.max(cell, rw - cell);
            const ledH = horiz ? Math.max(cell, rh - cell) : cell;
            const ledX = snap(horiz ? rx + (dir < 0 ? cell / 2 : rw - cell - cell / 2) : rx + cell / 2);
            const ledY = snap(horiz ? ry + cell / 2 : ry + (dir < 0 ? cell / 2 : rh - cell - cell / 2));
            out += '<rect x="' + rx + '" y="' + ry + '" width="' + rw + '" height="' + rh + '" fill="' + S.plugFill + '" stroke="' + S.plugLine + '" stroke-width="' + cell + '"/>' +
                '<rect x="' + ledX + '" y="' + ledY + '" width="' + ledW + '" height="' + ledH + '" style="fill:' + S.led + '"/>';
        };
        L.h.forEach(function (fr, i) {
            // left (i=0) / right (i=1)
            const m = i === 0 ? sx : w - (sx + sw);
            if (m < MIN) return;
            fr.forEach(function (f, j) {
                const o0 = out.length;
                const y = snap(sy + sh * f);
                const dy = (j % 2 ? 1 : -1) * snap(Math.min(cell * 6, m * 0.5));
                const x0 = i === 0 ? sx : sx + sw;
                const dir = i === 0 ? -1 : 1;
                const xe = i === 0 ? 0 : w;
                const xm = snap(x0 + dir * m * 0.45);
                const xin = snap(x0 - dir * reachH);
                plug(xin, y, true, dir);
                const xp = snap(xin + dir * Math.max(cell * 3, snap(20 * k + 8)));
                cable([[xp, y], [xm, y], [xm, y + dy], [xe, y + dy]], 'h');
                out = out.slice(0, o0) + '<g class="vfc" data-side="' + (i === 0 ? 'l' : 'r') + '" style="--dur:' + cableDur() + 's">' + out.slice(o0) + '</g>';
            });
        });
        L.v.forEach(function (fr, i) {
            const m = i === 0 ? sy : h - (sy + sh);
            if (m < MIN) return;
            fr.forEach(function (f, j) {
                const o0 = out.length;
                const x = snap(sx + sw * f);
                const dx = (j % 2 ? 1 : -1) * snap(Math.min(cell * 6, m * 0.5));
                const y0 = i === 0 ? sy : sy + sh;
                const dir = i === 0 ? -1 : 1;
                const ye = i === 0 ? 0 : h;
                const ym = snap(y0 + dir * m * 0.45);
                const yin = snap(y0 - dir * (i === 0 ? reachTop : reachBot));
                plug(x, yin, false, dir);
                const yp = snap(yin + dir * Math.max(cell * 3, snap(20 * k + 8)));
                cable([[x, yp], [x, ym], [x + dx, ym], [x + dx, ye]], 'v');
                out = out.slice(0, o0) + '<g class="vfc" data-side="' + (i === 0 ? 't' : 'b') + '" style="--dur:' + cableDur() + 's">' + out.slice(o0) + '</g>';
            });
        });
        cableFac = fac;
        svg.innerHTML = out;
    }
})(window.vfFitScope || (window.vfFitScope = {}));
