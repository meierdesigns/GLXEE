"use strict";

// GalaxyMapManager members, continued from render-explore-controls.js (kept under ~500 lines per file).
extendClass(GalaxyMapManager, {
    /**
     * Station parts [kind, x, y, w, h] on the -12..12 grid, shaped by the builder's
     * lore: Kronax = bone spikes and claws, Voidborn = organic folded tissue,
     * Pirates = welded scrap, Machines = hex lattice. null = use the modular kit.
     */
    stationDesign(silhouette, hash, big) {
        const parts = [];
        const rnd = (n) => { hash = (Math.imul(hash, 1103515245) + 12345) >>> 0; return (hash >>> 8) % n; };
        const px = (k, x, y, w, h) => { if (w > 0 && h > 0) parts.push([k, Math.round(x), Math.round(y), Math.round(w), Math.round(h)]); };
        const disc = (k, cx, cy, rx, ry) => {
            ry = ry == null ? rx : ry;
            for (let y = -Math.floor(ry); y <= Math.floor(ry); y++) {
                const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry + 0.0001))));
                px(k, cx - half, cy + y, 2 * half + 1, 1);
            }
        };
        // Stair-stepped tapered stroke from (x0,y0) to (x1,y1), width w0 → w1.
        const stroke = (k, x0, y0, x1, y1, w0, w1) => {
            const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
            for (let i = 0; i <= n; i++) {
                const t = i / n;
                const w = Math.max(1, Math.round(w0 + (w1 - w0) * t));
                px(k, x0 + (x1 - x0) * t - (w - 1) / 2, y0 + (y1 - y0) * t, w, 1);
            }
        };
        const sc = big ? 1 : 0.8;
        if (silhouette === 'spikes') {
            // Kronax: armoured core, cracked bone horns, claw prongs.
            disc('h', 0, 0, 4 * sc + 1, 5 * sc + 1);
            disc('d', 0, 1, 2, 3);
            for (let i = 0; i < 3 + (big ? 1 : 0); i++) {
                const dir = i % 2 ? 1 : -1;
                const len = 6 + rnd(4);
                stroke('h', dir * 4, -2 + i * 2, dir * (4 + len), -7 + i * 5 - rnd(3), 3, 1);
            }
            stroke('h', 0, -5, 0, -12, 3, 1);
            stroke('h', -2, -5, -5, -11, 2, 1);
            stroke('h', 2, -5, 5, -11, 2, 1);
            stroke('d', -1, 6, -3, 11, 2, 1);
            stroke('d', 1, 6, 3, 11, 2, 1);
            px('l', 0, -1, 1, 2);
            px('r', -1, -3, 1, 1);
            px('r', 1, -3, 1, 1);
        } else if (silhouette === 'rings') {
            // Voidborn: a pale grown body with trailing tendrils, a hollow fold ring.
            const rx = 4 * sc + 1, ry = 3 * sc + 2;
            disc('h', 0, 0, rx, ry);
            disc('d', 0, 1, Math.max(1, rx - 3), Math.max(1, ry - 3));
            disc('l', 0, 0, 1, 1);
            const arms = 4 + rnd(3);
            for (let a = 0; a < arms; a++) {
                const ang = (a / arms) * Math.PI * 2 + rnd(30) / 30;
                let x = Math.cos(ang) * (rx - 1), y = Math.sin(ang) * (ry - 1);
                const steps = 5 + rnd(4);
                for (let i = 0; i < steps; i++) {
                    const wob = Math.sin(i * 0.9 + a) * 0.9;
                    x += Math.cos(ang + wob) * 1.2;
                    y += Math.sin(ang + wob) * 1.2;
                    const r = Math.max(0.5, 1.6 - i * 0.22);
                    disc(i % 3 === 2 ? 'd' : 'h', x, y, r, r);
                }
                disc('l', x, y, 0.5, 0.5);
            }
            // Cold ring that tears the picture open around the body.
            for (let a = 0; a < 20; a++) {
                const ang = (a / 20) * Math.PI * 2;
                if (a % 4 === 3) continue;
                px('d', Math.cos(ang) * (rx + 4), Math.sin(ang) * (ry + 4), 1, 1);
            }
        } else if (silhouette === 'scrap') {
            // Pirates: welded wrecks, crooked beams, a flag.
            px('h', -5, -3, 8 + rnd(3), 6);
            px('h', -9, -1, 5, 4);
            px('c', 3, -6, 5, 4);
            px('c', 4, 1, 6, 4 + rnd(2));
            px('d', -8, -5, 3, 3);
            stroke('d', -9, 5, 3, 9, 2, 2);
            stroke('d', -6, -4, -10, -9, 1, 1);
            stroke('d', 2, -4, 9, -10, 1, 1);
            px('h', -2, 4, 3, 3 + rnd(3));
            px('p', -12, -4, 3, 2);
            px('s', 3, -8, 5, 1);
            px('d', 7, -11, 1, 4);
            px('c', 8, -11, 3, 2);
            px('l', -3, -1, 1, 1);
            px('r', -9, 0, 1, 1);
            px('a', 9, 4, 1, 1);
        } else if (silhouette === 'circuit') {
            // Machines: hex core, radial traces ending in processor nodes.
            const hexR = big ? 5 : 4;
            for (let y = -hexR; y <= hexR; y++) {
                const half = Math.round(hexR - Math.abs(y) * 0.5);
                px('h', -half, y, 2 * half + 1, 1);
            }
            for (let y = -hexR + 2; y <= hexR - 2; y++) {
                const half = Math.round(hexR - 2 - Math.abs(y) * 0.5);
                px('d', -half, y, 2 * half + 1, 1);
            }
            px('l', -1, -1, 3, 3);
            for (let i = 0; i < 6; i++) {
                const ang = (i / 6) * Math.PI * 2 + Math.PI / 6;
                const ex = Math.round(Math.cos(ang) * (hexR + 5)), ey = Math.round(Math.sin(ang) * (hexR + 4));
                stroke('d', Math.round(Math.cos(ang) * hexR), Math.round(Math.sin(ang) * hexR), ex, ey, 1, 1);
                px('p', ex - 1, ey - 1, 3, 3);
                px('l', ex, ey, 1, 1);
            }
            px('g', 0, hexR + 6, 1, 1);
        } else {
            return null;
        }
        return parts;
    },
    stationPixelsSvgRaw(post, detail) {
        const id = String((post && post.id) || '');
        let hash = 0;
        for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
        const stations = [
            // Ring hub with spokes and side panels.
            [['p', -6, -1, 1, 2], ['p', 5, -1, 1, 2],
                ['h', -3, -5, 6, 1], ['h', -3, 4, 6, 1], ['h', -5, -3, 1, 6], ['h', 4, -3, 1, 6],
                ['h', -4, -4, 1, 1], ['h', 3, -4, 1, 1], ['h', -4, 3, 1, 1], ['h', 3, 3, 1, 1],
                ['d', -1, -4, 2, 2], ['d', -1, 2, 2, 2], ['d', -4, -1, 2, 2], ['d', 2, -1, 2, 2],
                ['h', -1, -1, 2, 2], ['l', 0, 0, 1, 1],
                ['w', -1, -6, 1, 1], ['w', 0, 5, 1, 1], ['r', -6, -2, 1, 1], ['g', 5, -2, 1, 1]],
            // Truss station: core module, long truss, four solar wings.
            [['d', -6, 0, 12, 1], ['p', -6, -3, 2, 2], ['p', -6, 2, 2, 2], ['p', 4, -3, 2, 2], ['p', 4, 2, 2, 2],
                ['h', -2, -3, 4, 6], ['d', -2, 0, 4, 1], ['h', -1, -5, 2, 2], ['h', -3, 3, 6, 2], ['d', -3, 4, 6, 1],
                ['l', -1, -2, 1, 1], ['l', 0, 2, 1, 1], ['w', -1, -6, 1, 1],
                ['r', -6, -1, 1, 1], ['g', 5, -1, 1, 1], ['a', -3, 5, 1, 1], ['a', 2, 5, 1, 1]],
            // Spindle: long spine with two habitat rings and docking pods.
            [['p', -6, 0, 3, 1], ['p', 3, 0, 3, 1], ['h', -1, -6, 2, 12],
                ['h', -3, -3, 6, 1], ['h', -3, 2, 6, 1],
                ['d', -4, -4, 1, 3], ['d', 3, -4, 1, 3], ['d', -4, 1, 1, 3], ['d', 3, 1, 1, 3],
                ['d', -1, 0, 2, 1], ['w', 0, -6, 1, 1], ['w', -1, 5, 1, 1],
                ['r', -5, -3, 1, 1], ['g', 4, -3, 1, 1], ['r', -5, 2, 1, 1], ['g', 4, 2, 1, 1]]
        ];
        const shops = [
            // Market hub: domed trade hall, sign board, docking arms, crates.
            [['d', -6, 1, 12, 1], ['h', -6, 0, 1, 3], ['h', 5, 0, 1, 3],
                ['h', -3, -2, 6, 5], ['h', -2, -4, 4, 2], ['s', -2, -1, 4, 1],
                ['c', -5, 2, 2, 2], ['c', 3, 2, 2, 2], ['c', -1, 3, 2, 2],
                ['d', -1, -5, 2, 1], ['w', -1, -6, 2, 1],
                ['a', -3, -2, 1, 1], ['a', 2, -2, 1, 1], ['r', -6, -1, 1, 1], ['g', 5, -1, 1, 1]],
            // Cargo yard: rails with container racks and a lit sign tower.
            [['d', -6, -1, 12, 1], ['d', -6, 1, 12, 1],
                ['c', -5, -4, 2, 3], ['c', 3, -4, 2, 3], ['c', -5, 2, 2, 3], ['c', 3, 2, 2, 2],
                ['h', -2, -5, 4, 10], ['s', -1, -4, 2, 2], ['d', -2, 0, 4, 1],
                ['w', -1, 5, 2, 1], ['a', -3, -5, 1, 1], ['a', 2, -5, 1, 1],
                ['r', -6, 0, 1, 1], ['g', 5, 0, 1, 1]],
            // Bazaar ring: ring of stalls around a sign tower.
            [['h', -3, -5, 6, 1], ['h', -3, 4, 6, 1], ['h', -5, -3, 1, 6], ['h', 4, -3, 1, 6],
                ['h', -4, -4, 1, 1], ['h', 3, -4, 1, 1], ['h', -4, 3, 1, 1], ['h', 3, 3, 1, 1],
                ['c', -3, -4, 1, 1], ['c', 2, -4, 1, 1], ['c', -3, 3, 1, 1], ['c', 2, 3, 1, 1],
                ['d', -1, -4, 2, 2], ['d', -1, 2, 2, 2], ['d', -4, -1, 2, 2], ['d', 2, -1, 2, 2],
                ['h', -2, -2, 4, 4], ['s', -1, -1, 2, 1], ['l', -1, 1, 2, 1],
                ['a', -3, -6, 1, 1], ['a', 2, -6, 1, 1], ['a', -3, 5, 1, 1], ['a', 2, 5, 1, 1],
                ['r', -6, -1, 1, 1], ['g', 5, -1, 1, 1], ['w', -1, -6, 2, 1]]
        ];
        // Owner faction shape (ship silhouette): [faction station, trading post].
        // Owner faction look: functional station architecture with subtle
        // faction cues, on a 2× finer grid (-12..12, drawn at half cells).
        // [faction station, trading post].
        const facShapes = {'modular': [[['d', -12, -1, 24, 2], ['p', -12, -7, 3, 5], ['p', -12, 2, 3, 5], ['p', 9, -7, 3, 5], ['p', 9, 2, 3, 5], ['h', -4, -6, 8, 12], ['h', -8, -3, 4, 6], ['h', 4, -3, 4, 6], ['h', -2, -10, 4, 4], ['d', 0, -12, 1, 2], ['h', -3, 6, 6, 3], ['d', -2, 9, 4, 2], ['d', -4, 0, 8, 1], ['d', -8, 0, 4, 1], ['d', 4, 0, 4, 1], ['l', -3, -3, 1, 1], ['l', 2, -3, 1, 1], ['l', -1, -8, 2, 1], ['r', -12, -1, 1, 1], ['g', 11, -1, 1, 1]], [['d', -12, 1, 24, 2], ['h', -6, -4, 12, 8], ['h', -4, -8, 8, 4], ['s', -5, -1, 10, 1], ['d', -6, 2, 12, 1], ['c', -11, -3, 4, 3], ['c', -11, 3, 4, 3], ['c', 7, -3, 4, 3], ['c', 7, 3, 4, 3], ['h', -3, 4, 6, 4], ['d', -2, 8, 4, 2], ['d', 0, -11, 1, 3], ['d', -4, -5, 8, 1], ['l', -3, -7, 1, 1], ['l', -1, -7, 1, 1], ['l', 1, -7, 1, 1], ['l', 3, -7, 1, 1], ['p', -12, -8, 4, 3], ['p', 8, -8, 4, 3], ['d', -8, -7, 4, 1], ['d', 4, -7, 4, 1], ['r', -12, 1, 1, 1], ['g', 11, 1, 1, 1]]], 'spikes': [[['d', -12, 2, 24, 1], ['d', -11, -6, 1, 8], ['d', 10, -6, 1, 8], ['h', -3, -8, 6, 14], ['h', -2, -10, 4, 2], ['h', -1, -12, 2, 2], ['h', -6, -4, 3, 8], ['h', -8, -2, 2, 6], ['h', -10, 0, 2, 4], ['h', 3, -4, 3, 8], ['h', 6, -2, 2, 6], ['h', 8, 0, 2, 4], ['h', -2, 6, 4, 3], ['d', -3, 9, 6, 2], ['d', -3, -2, 6, 1], ['d', -3, 3, 6, 1], ['d', -6, 1, 3, 1], ['d', 3, 1, 3, 1], ['l', -1, -6, 2, 1], ['r', -12, 2, 1, 1], ['g', 11, 2, 1, 1]], [['d', -12, 1, 24, 2], ['h', -6, -4, 12, 8], ['h', -4, -8, 8, 4], ['s', -5, -1, 10, 1], ['d', -6, 2, 12, 1], ['c', -11, -3, 4, 3], ['c', -11, 3, 4, 3], ['c', 7, -3, 4, 3], ['c', 7, 3, 4, 3], ['h', -3, 4, 6, 4], ['d', -2, 8, 4, 2], ['d', 0, -11, 1, 3], ['d', -4, -5, 8, 1], ['l', -3, -7, 1, 1], ['l', -1, -7, 1, 1], ['l', 1, -7, 1, 1], ['l', 3, -7, 1, 1], ['d', -8, -6, 2, 2], ['d', -10, -8, 2, 2], ['d', 6, -6, 2, 2], ['d', 8, -8, 2, 2], ['h', -1, -10, 2, 2], ['r', -12, 1, 1, 1], ['g', 11, 1, 1, 1]]], 'rings': [[['h', -6, -11, 12, 2], ['h', -6, 9, 12, 2], ['h', -11, -6, 2, 12], ['h', 9, -6, 2, 5], ['h', 9, 3, 2, 3], ['h', -9, -9, 3, 2], ['h', -9, -9, 2, 3], ['h', 6, -9, 3, 2], ['h', 7, -9, 2, 3], ['h', -9, 7, 3, 2], ['h', -9, 6, 2, 3], ['h', 6, 7, 3, 2], ['h', 7, 6, 2, 3], ['d', -1, -9, 2, 4], ['d', -1, 5, 2, 4], ['d', -9, -1, 4, 2], ['d', 5, -1, 4, 2], ['h', -4, -4, 8, 8], ['h', -5, -3, 10, 6], ['h', -3, -5, 6, 10], ['p', -2, -2, 4, 4], ['l', -1, -1, 2, 2], ['r', -11, 0, 1, 1], ['g', 10, -6, 1, 1]], [['d', -12, 1, 24, 2], ['h', -6, -4, 12, 8], ['h', -4, -8, 8, 4], ['s', -5, -1, 10, 1], ['d', -6, 2, 12, 1], ['c', -11, -3, 4, 3], ['c', -11, 3, 4, 3], ['c', 7, -3, 4, 3], ['c', 7, 3, 4, 3], ['h', -3, 4, 6, 4], ['d', -2, 8, 4, 2], ['d', 0, -11, 1, 3], ['d', -4, -5, 8, 1], ['l', -3, -7, 1, 1], ['l', -1, -7, 1, 1], ['l', 1, -7, 1, 1], ['l', 3, -7, 1, 1], ['d', -9, -10, 18, 1], ['d', -9, -10, 1, 5], ['d', 8, -10, 1, 3], ['r', -12, 1, 1, 1], ['g', 11, 1, 1, 1]]], 'scrap': [[['p', -12, -6, 3, 4], ['d', -9, -5, 3, 1], ['h', -6, -4, 10, 8], ['h', -9, -2, 3, 5], ['h', -2, -9, 4, 5], ['d', 2, -10, 1, 6], ['d', 2, -10, 6, 1], ['d', 7, -10, 1, 3], ['c', 4, -3, 4, 3], ['c', 4, 1, 5, 3], ['c', -10, 4, 4, 3], ['d', -6, 0, 10, 1], ['h', -4, 4, 5, 3], ['d', -3, 7, 3, 2], ['l', -1, -7, 2, 1], ['l', -4, -2, 1, 1], ['r', -9, 0, 1, 1], ['g', 8, 1, 1, 1]], [['d', -12, 1, 24, 2], ['h', -6, -4, 12, 8], ['h', -4, -8, 8, 4], ['s', -5, -1, 10, 1], ['d', -6, 2, 12, 1], ['c', -11, -3, 4, 3], ['c', -11, 3, 4, 3], ['c', 7, -3, 4, 3], ['c', 7, 3, 4, 3], ['h', -3, 4, 6, 4], ['d', -2, 8, 4, 2], ['d', 0, -11, 1, 3], ['d', -4, -5, 8, 1], ['l', -3, -7, 1, 1], ['l', -1, -7, 1, 1], ['l', 1, -7, 1, 1], ['l', 3, -7, 1, 1], ['c', 3, -10, 3, 2], ['d', -8, -7, 2, 3], ['h', -9, -6, 3, 2], ['d', 5, -8, 1, 2], ['r', -12, 1, 1, 1], ['g', 11, 1, 1, 1]]], 'circuit': [[['d', -6, -9, 12, 1], ['d', -6, 8, 12, 1], ['d', -9, -6, 1, 12], ['d', 8, -6, 1, 12], ['h', -11, -11, 5, 5], ['h', 6, -11, 5, 5], ['h', -11, 6, 5, 5], ['h', 6, 6, 5, 5], ['h', -4, -4, 8, 8], ['d', -1, -6, 2, 2], ['d', -1, 4, 2, 2], ['d', -6, -1, 2, 2], ['d', 4, -1, 2, 2], ['p', -10, -10, 3, 3], ['p', 7, -10, 3, 3], ['p', -10, 7, 3, 3], ['p', 7, 7, 3, 3], ['p', -2, -2, 4, 4], ['r', -11, 8, 1, 1], ['g', 10, -11, 1, 1]], [['d', -12, 1, 24, 2], ['h', -6, -4, 12, 8], ['h', -4, -8, 8, 4], ['s', -5, -1, 10, 1], ['d', -6, 2, 12, 1], ['c', -11, -3, 4, 3], ['c', -11, 3, 4, 3], ['c', 7, -3, 4, 3], ['c', 7, 3, 4, 3], ['h', -3, 4, 6, 4], ['d', -2, 8, 4, 2], ['d', 0, -11, 1, 3], ['d', -4, -5, 8, 1], ['l', -3, -7, 1, 1], ['l', -1, -7, 1, 1], ['l', 1, -7, 1, 1], ['l', 3, -7, 1, 1], ['p', -10, -8, 3, 3], ['p', 7, -8, 3, 3], ['d', -7, -7, 3, 1], ['d', 4, -7, 3, 1], ['r', -12, 1, 1, 1], ['g', 11, 1, 1, 1]]]};
        const owner = this.stationFactionStyle(post);
        const own = owner && facShapes[owner.silhouette];
        // Per-faction architecture (lore), generated per station; terran keeps its modular kit.
        const designed = owner ? this.stationDesign(owner.silhouette, hash, !!(post && post.factionStation)) : null;
        const builds = designed ? [designed] : (own ? [own[post && post.factionStation ? 0 : 1]] : ((post && post.factionStation) ? stations : shops));
        const cls = {
            h: 'gm-station-hull', d: 'gm-station-dark', p: 'gm-station-panel', c: 'gm-station-crate',
            s: 'gm-station-sign', l: 'gm-station-light',
            r: 'gm-station-lamp gm-lamp-red', g: 'gm-station-lamp gm-lamp-green',
            w: 'gm-station-lamp gm-lamp-strobe', a: 'gm-station-lamp gm-lamp-amber'
        };
        const lamp = (k) => k === 'r' || k === 'g' || k === 'w' || k === 'a';
        let parts = builds[hash % builds.length];
        const rect = (x, y, w, h, c, extra) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" class="${c}"${extra || ''}/>`;
        let d = Math.max(1, Math.round(detail || 1));
        if (own) {
            // Fine grid: half-cell parts, twice the sub-pixels (capped).
            parts = parts.map(([k, x, y, w, h]) => [k, x / 2, y / 2, w / 2, h / 2]);
            d = Math.min(6, d * 2);
        }
        // Lamps: staggered blink per lamp (no translucent halo squares).
        let lampIdx = 0;
        const delays = parts.map(([k]) => lamp(k)
            ? ` style="animation-delay:${(lampIdx++ * 0.37 + (hash % 7) * 0.11).toFixed(2)}s"` : '');
        let outline, base, clipId = null, clipRects = '';
        if (d > 1) {
            // Fine silhouette on the planet's pixel grid; corners just nicked.
            const m = this.subMaskNew(d);
            base = parts.map(([k, x, y, w, h], i) => {
                // Only the corner pixels are softened (crisp, boxy look).
                const rows = this.roundedRowsSub(x, y, w, h, d, (lamp(k) ? 3 : 2) / d);
                rows.forEach(([a, b, sy]) => { for (let sx = a; sx < b; sx++) this.subMaskAdd(m, sx, sy); });
                clipRects += this.subRowsSvg(rows, d, '');
                return this.subRowsSvg(rows, d, cls[k], delays[i]);
            }).join('');
            outline = this.subMaskOutlineSvg(m, 'gm-station-outline');
            clipId = this.nextClipId('gmStClip');
        } else {
            // Dark #05060a outline around the whole silhouette (lamps included).
            outline = parts.map(([, x, y, w, h]) => rect(x - 0.5, y - 0.5, w + 1, h + 1, 'gm-station-outline')).join('');
            base = parts.map(([k, x, y, w, h], i) => rect(x, y, w, h, cls[k], delays[i])).join('');
        }
        // Large card view: sub-pixel shading on top of the same silhouette
        // (lit top/left edge, shaded bottom/right edge, panel cells, windows).
        let fine = '';
        if (d > 1) {
            const p = 1 / d;
            parts.forEach(([k, x, y, w, h]) => {
                if (k === 'l' || lamp(k)) {
                    fine += rect(x + p, y + p, Math.max(p, w - 2 * p), Math.max(p, h - 2 * p), 'gm-station-glint');
                    return;
                }
                // Sub-pixel shading at the planet's resolution (one planet pixel = 1/d).
                fine += this.ditherShadeSvg(x, y, w, h, d, 0, 0, 7, 'gm-station');
                if (k === 'p') {
                    // Solar cell grid.
                    for (let gx = x + 1; gx < x + w; gx += 1) fine += rect(gx - p / 2, y, p, h, 'gm-station-shade');
                    for (let gy = y + 1; gy < y + h; gy += 1) fine += rect(x, gy - p / 2, w, p, 'gm-station-shade');
                } else if (k === 'c') {
                    // Crate ribs.
                    for (let gx = x + 1; gx < x + w; gx += 1) fine += rect(gx - p / 2, y + p, p, h - 2 * p, 'gm-station-shade');
                } else if (k === 's') {
                    // Sign board: a row of lit glyph pixels.
                    for (let i = 0; i < w * d - 2; i += 2) {
                        if ((i + hash) % 3 === 0) continue;
                        fine += rect(x + p + i * p, y + h / 2 - p, p, 2 * p, 'gm-station-sign-glyph');
                    }
                } else if (k === 'h' && w >= 2 && h >= 2) {
                    // Window row along the long side.
                    const horiz = w >= h;
                    const len = horiz ? w : h;
                    for (let i = 1; i < len; i += 1) {
                        if ((i + x + y) % 2) continue;
                        const wx = horiz ? x + i - p / 2 : x + w / 2 - p / 2;
                        const wy = horiz ? y + h / 2 - p / 2 : y + i - p / 2;
                        fine += rect(wx, wy, p, p, 'gm-station-window');
                    }
                }
            });
        }
        const fineG = clipId
            ? `<clipPath id="${clipId}">${clipRects}</clipPath><g clip-path="url(#${clipId})">${fine}</g>` : fine;
        // Owner faction colours (hull / edge / accent) via CSS vars.
        const st = this.stationFactionStyle(post);
        const stAttr = st ? ` style="--st-hull:${st.hull};--st-edge:${st.edge || '#07080c'};--st-accent:${st.accent || '#ff5a3c'}"` : '';
        return `<g class="gm-station${st ? ' is-faction' : ''}"${stAttr} shape-rendering="crispEdges">` + outline + base + fineG + `</g>`;
    },
    /** 16x16 pixel gear (8 teeth, centre hole), drawn per pixel with lit / shaded edges. */
    wrenchIconSvg() {
        const N = 16, C = 8;
        const box = (x, y, x0, x1, y0, y1) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
        const gear = (x, y) => {
            const d = Math.hypot(x + 0.5 - C, y + 0.5 - C);
            if (d < 2.4) return false;                       // axle hole
            if (d <= 5.4) return true;                       // body
            // 4 straight teeth (4 wide) and 4 diagonal teeth (3x3).
            return box(x, y, 6, 9, 1, 2) || box(x, y, 6, 9, 13, 14) || box(x, y, 1, 2, 6, 9) || box(x, y, 13, 14, 6, 9) ||
                box(x, y, 2, 4, 2, 4) || box(x, y, 11, 13, 2, 4) || box(x, y, 2, 4, 11, 13) || box(x, y, 11, 13, 11, 13);
        };
        const at = (x, y) => x >= 0 && y >= 0 && x < N && y < N && gear(x, y);
        let body = '';
        for (let y = 0; y < N; y++) {
            for (let x = 0; x < N; x++) {
                if (!gear(x, y)) continue;
                const lit = !at(x - 1, y) || !at(x, y - 1);
                const dark = !at(x + 1, y) || !at(x, y + 1);
                const fill = lit && !dark ? '#ffd27a' : (dark && !lit ? '#c46a12' : '#ffa733');
                body += `<rect x="${x}" y="${y}" width="1" height="1" fill="${fill}"/>`;
            }
        }
        return '<svg viewBox="0 0 16 16" width="44" height="44" shape-rendering="crispEdges">' +
            `<g class="gm-cta-wrench">${body}</g></svg>`;
    },
    syncNodeHighlight() {
        if (!this.overlay) return;
        this.overlay.querySelectorAll('.gm-post-node[data-post]').forEach(node => {
            node.classList.toggle('selected', node.getAttribute('data-post') === this.selectedPostId);
        });
        const sb = this.selectedBorder;
        this.overlay.querySelectorAll('.gm-border-station[data-focus-planet]').forEach(node => {
            node.classList.toggle('selected', !!sb && node.getAttribute('data-focus-planet') === sb.open
                && node.getAttribute('data-border-shut') === sb.shut);
        });
        this.overlay.querySelectorAll('.gm-node').forEach(node => {
            const pid = node.getAttribute('data-planet');
            node.classList.toggle('selected', !this.selectedPostId && !this.selectedBorder && pid === this.selectedPlanetId);
            node.classList.toggle('hovered', pid === this.hoveredPlanetId);
        });
        if (this.syncRoutePreview) this.syncRoutePreview();
        this.raiseHoveredMarker();
        this.raiseSelectedMarker();
        this.updateSelectionFrames();
    },
    /**
     * SVG has no z-index: move the selected planet / post (with its frame)
     * to the top, just under the player ship, so markings are never covered.
     */
    /**
     * Hovered planet overlays the lines: lift it above .gm-lines (under the
     * route + ship) and put it back in place when the hover ends.
     */
    raiseHoveredMarker() {
        const svg = this.overlay && this.overlay.querySelector('.galaxy-map-svg');
        if (!svg) return;
        const prev = this._hoverLift;
        const node = this.hoveredPlanetId
            ? svg.querySelector(`:scope > .gm-node[data-planet="${this.hoveredPlanetId}"]`) : null;
        if (prev && prev.node !== node) {
            if (prev.node.isConnected && !prev.node.classList.contains('selected') && prev.next && prev.next.parentNode === svg) {
                svg.insertBefore(prev.node, prev.next);
            }
            this._hoverLift = null;
        }
        if (!node || (this._hoverLift && this._hoverLift.node === node)) return;
        const anchor = svg.querySelector(':scope > .gm-route-layer');
        if (!anchor) return;
        this._hoverLift = { node: node, next: node.nextSibling };
        if (node.nextSibling !== anchor) svg.insertBefore(node, anchor);
    },
    raiseSelectedMarker() {
        const svg = this.overlay && this.overlay.querySelector('.galaxy-map-svg');
        if (!svg) return;
        const sel = svg.querySelector('.gm-post-node.selected') || svg.querySelector('.gm-node.selected');
        if (!sel || sel.parentNode !== svg) return;
        const ship = svg.querySelector(':scope > .gm-ship-marker');
        if (sel.nextSibling === ship) return;
        svg.insertBefore(sel, ship || null);
    },
    bindEvents() {
        if (this._keyHandler) {
            document.removeEventListener('keydown', this._keyHandler);
            this._keyHandler = null;
        }
        this.bindNodeClicks();
        this.bindPostClicks();
        this.bindMapZoom();
        this.raiseSelectedMarker();
        if (this.selectedPostId) this.updateDetails();

        const locateShipBtn = this.overlay.querySelector('#gmLocateShip');
        if (locateShipBtn) {
            locateShipBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.returnCameraToShip();
            });
            // Ship bar also opens hangar — keep keyboard from bubbling into that.
            locateShipBtn.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') e.stopPropagation();
            });
        }

        // Situation card: a click opens the mission modal.
        const sitCard = this.overlay.querySelector('.galaxy-map-situation');
        if (sitCard) {
            sitCard.addEventListener('click', () => this.openSituationModal());
            sitCard.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.openSituationModal(); }
            });
        }

        // Ship bar: a click opens the hangar to configure the ship.
        const shipBar = this.overlay.querySelector('.galaxy-map-header .gm-ship-bar');
        if (shipBar) {
            shipBar.setAttribute('role', 'button');
            shipBar.setAttribute('tabindex', '0');
            shipBar.title = 'OPEN HANGAR · configure your ship';
            shipBar.classList.add('is-hangar-link');
            if (!shipBar.querySelector('.gm-ship-bar-cta')) {
                // Wrench in its own framed key; it spins (on its own centre) only while hovered.
                const cta = document.createElement('span');
                cta.className = 'gm-ship-bar-cta';
                cta.setAttribute('aria-hidden', 'true');
                cta.innerHTML = this.wrenchIconSvg();
                shipBar.appendChild(cta);
            }
            const openHangar = () => {
                if (typeof homeStationUI === 'undefined') return;
                homeStationUI.tab = 'hangar';
                homeStationUI.statusMsg = '';
                homeStationUI._navLevel = 'tabs';
                if (homeStationUI.persistTab) homeStationUI.persistTab();
                homeStationUI.createUI();
            };
            shipBar.addEventListener('click', openHangar);
            shipBar.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openHangar(); }
            });
        }

        // Jump to the station's galaxy travel (teleport) tab.
        const teleportBtn = this.overlay.querySelector('#gmTeleport');
        if (teleportBtn) {
            teleportBtn.addEventListener('click', () => {
                if (typeof homeStationUI === 'undefined') return;
                if (homeStationUI.tab === 'play' && homeStationUI.openTravelModal) {
                    homeStationUI.openTravelModal();
                    return;
                }
                homeStationUI.tab = 'travel';
                homeStationUI.statusMsg = '';
                homeStationUI._navLevel = 'tabs';
                homeStationUI.persistTab();
                homeStationUI.createUI();
            });
        }
        const exploreBtn = this.overlay.querySelector('#gmExplore');
        this.bindConfirmActions();
        if (exploreBtn) {
            exploreBtn.addEventListener('click', () => this.explore());
        }

        this._keyHandler = (e) => {
            if (!this.isVisible || !this._inputActive) return;
            if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault();
                e.stopPropagation();
                if (this.hasActionFocus()) {
                    // On the start buttons: ←/→ pick one, ↑ back to the map.
                    if (e.key === 'ArrowLeft') this.focusActionButton(this._actionFocus - 1);
                    else if (e.key === 'ArrowRight') this.focusActionButton(this._actionFocus + 1);
                    else if (e.key === 'ArrowUp') this.clearActionFocus();
                    return;
                }
                this.navigateByArrow(e.key);
            } else if (e.key === 'Enter' || e.key === ' ') {
                // Embedded Play tab: Home Station owns confirmation → startMission.
                if (this._mountEl) return;
                e.preventDefault();
                e.stopPropagation();
                this.confirmKey();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                if (this.hasActionFocus()) {
                    this.clearActionFocus();
                    return;
                }
                if (this._mountEl) {
                    this.disarmInput();
                    if (typeof this.onEscape === 'function') this.onEscape();
                    return;
                }
                this.back();
            }
        };
        document.addEventListener('keydown', this._keyHandler);
        this.syncConfirmButton();
    },
});
