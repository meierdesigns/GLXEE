"use strict";

// Start-profile (kit) icons: one chunky 16×16 icon per profile, different for every faction and matching its theme.
// Terran = military insignia, Kronax = warrior clan, Voidborn = mystic void, Pirate = outlaw loot, Machine = circuitry.
// Built from simple shapes and lit from the top left like menu-hd.js: 15 highlight edge, 12 body, 10 shadow edge.
(function () {
    const N = 16;
    const grid = () => Array.from({ length: N }, () => new Array(N).fill(0));
    const shade = (g, inside) => {
        for (let y = 0; y < N; y++) {
            for (let x = 0; x < N; x++) {
                if (!inside(x, y)) continue;
                const lit = !inside(x - 1, y) || !inside(x, y - 1);
                const dark = !inside(x + 1, y) || !inside(x, y + 1);
                g[y][x] = lit && !dark ? 15 : (dark && !lit ? 10 : 12);
            }
        }
        return g;
    };
    const rect = (x0, y0, x1, y1) => (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
    const disc = (r, cx, cy) => (x, y) => Math.hypot(x - cx, y - cy) <= r;
    const ring = (r0, r1, cx, cy) => (x, y) => { const d = Math.hypot(x - cx, y - cy); return d <= r1 && d >= r0; };
    const union = (...fs) => (x, y) => fs.some((f) => f(x, y));
    const minus = (a, ...bs) => (x, y) => a(x, y) && !bs.some((b) => b(x, y));
    const line = (x0, y0, x1, y1, w) => (x, y) => {
        const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy || 1;
        const t = Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / l2));
        return Math.hypot(x - (x0 + t * dx), y - (y0 + t * dy)) <= w;
    };
    const poly = (pts) => (x, y) => {
        let c = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
            const [xi, yi] = pts[i], [xj, yj] = pts[j];
            if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
        }
        return c;
    };
    const mirror = (f) => (x, y) => f(x, y) || f(15 - x, y);
    const S = (f) => shade(grid(), f);

    const K = {
        // ——— TERRAN: military ———
        kitStandardIssue: S(mirror(union(line(1.5, 5, 7.5, 1, 1.2), line(1.5, 9, 7.5, 5, 1.2), line(1.5, 13, 7.5, 9, 1.2)))),   // rank chevrons,
        kitFleetCharter: S(union(ring(2.5, 4, 7.5, 3.5), rect(7, 5, 8, 13), rect(4, 7, 11, 8),         // anchor
            minus(ring(5, 7, 7.5, 10), rect(0, 0, 15, 9)))),
        kitEngineerCorps: S(union(rect(2, 2, 13, 6), rect(7, 7, 8, 14), rect(6, 14, 9, 14), rect(1, 3, 1, 5), rect(14, 3, 14, 5))),   // hammer,
        kitTestPilot: S(union(poly([[7.5, 0.5], [10.5, 5], [10.5, 12], [4.5, 12], [4.5, 5]]),           // rocket
            poly([[4.5, 8], [1.5, 13], [4.5, 12]]), poly([[10.5, 8], [13.5, 13], [10.5, 12]]), rect(6, 13, 9, 15))),
        // ——— KRONAX: warrior clan ———
        kitClanBlood: S(minus(union(disc(5.3, 7.5, 8), rect(5, 11, 10, 14), line(2, 5, 0.5, 0.5, 0.9), line(13, 5, 14.5, 0.5, 0.9)),  // horned helm
            rect(6, 8, 6, 12), rect(9, 8, 9, 12), rect(4, 7, 6, 8), rect(9, 7, 11, 8))),
        kitWarlordTithe: S(minus(union(poly([[1, 13], [1, 4], [4.5, 8], [7.5, 2], [10.5, 8], [14, 4], [14, 13]]), rect(1, 13, 14, 14)), // crown
            disc(0.8, 4.5, 11), disc(0.8, 7.5, 11), disc(0.8, 10.5, 11))),
        kitRaiderPack: S(mirror(union(line(3.5, 3, 12, 14, 0.9), poly([[1, 2], [6, 2], [7, 7], [3, 8]])))),     // crossed axes
        kitDuelist: S(union(line(12.5, 2.5, 5, 10, 1.1), rect(3, 9, 7, 10), line(4, 11, 2, 14, 0.9), poly([[11, 1], [14.5, 1.5], [14, 5]]))), // sword
        // ——— VOIDBORN: mystic ———
        kitVoidDrifter: S(union(minus(disc(6.5, 7, 8), disc(5.4, 10.2, 6.6)), disc(1.2, 12, 3.5))),   // crescent with a star,
        kitRiftSeeker: S(minus(poly([[7.5, 0], [13.5, 7.5], [7.5, 15], [1.5, 7.5]]), line(7.5, 3, 7.5, 12, 0.7))),   // rift diamond,
        kitEchoDeep: S(union(disc(1.5, 7.5, 7.5), ring(3.5, 4.9, 7.5, 7.5), ring(6.5, 7.9, 7.5, 7.5))),   // echo rings,
        kitAscendant: S(minus(union(poly([[7.5, 0.5], [14.5, 14], [0.5, 14]])), union(disc(2.2, 7.5, 9), minus(poly([[7.5, 6], [10, 9], [7.5, 12], [5, 9]]), disc(1, 7.5, 9))))), // eye in a pyramid
        // ——— PIRATE: outlaw ———
        kitScavenger: S(union(minus(ring(2.6, 4.6, 7, 6.5), rect(8, 0, 15, 5)), rect(6, 1, 8, 4), rect(6, 11, 9, 14), line(4, 12, 11, 12, 0.9))),   // hook
        kitSmuggler: S(minus(union(disc(5, 7.5, 10), poly([[5, 6], [6, 1], [9, 1], [10, 6]])), rect(5, 2, 10, 2), rect(7, 9, 8, 12))),            // loot sack
        kitBrigand: S(minus(union(disc(5.2, 7.5, 6), rect(5, 10, 10, 13)), disc(1.4, 5.2, 6.5), disc(1.4, 9.8, 6.5), rect(7, 9, 8, 10), rect(6, 11, 6, 13), rect(9, 11, 9, 13))), // skull
        kitHaulerThief: S(minus(union(rect(1, 6, 14, 14), poly([[1, 6], [3, 1], [12, 1], [14, 6]])), rect(1, 6, 14, 6), rect(6, 8, 9, 11))),       // treasure chest
        // ——— MACHINE: circuitry ———
        kitBootSequence: S(minus(union(ring(4.4, 6.4, 7.5, 8.5), rect(6.5, 1, 8.5, 8)), union(rect(7, 1, 8, 7), minus(rect(0, 0, 15, 5), disc(7, 7.5, 8.5))))), // power symbol
        kitHarvester: S(union(rect(5, 1, 10, 5), poly([[5, 5], [10, 5], [8.5, 14], [6.5, 14]]), rect(3, 3, 4, 7), rect(11, 3, 12, 7))),             // drill head
        kitScoutUnit: S(union(minus(disc(6.6, 7.5, 7), rect(0, 0, 15, 6), disc(4.4, 7.5, 7)), rect(7, 11, 8, 13), rect(4, 14, 11, 14), line(7.5, 7, 12, 2, 0.7), disc(1.3, 12.5, 1.8))),   // radar dish,
        kitCombatProtocol: S(union(minus(ring(4.2, 6, 7.5, 7.5), union()), rect(7, 0, 8, 4), rect(7, 11, 8, 15), rect(0, 7, 4, 8), rect(11, 7, 15, 8), disc(1, 7.5, 7.5)))   // crosshair
    };
    Object.assign(IconSprites, K);
    if (typeof IconLabels !== 'undefined') Object.assign(IconLabels, {});
})();
