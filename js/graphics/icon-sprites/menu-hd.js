"use strict";

// Big main-menu icons (START / SETTINGS / CREDITS): coarse 16×16 pixel art
// with few details, shown large (64 px) so every pixel reads as a chunky
// block. Symmetric around the grid centre (7.5, 7.5); lit from the top left:
// 15 highlight edge, 12 body, 10 shadow edge / detail.
(function () {
    const N = 16;
    const C = 7.5;
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
    const disc = (r, cy) => (x, y) => Math.hypot(x - C, y - (cy == null ? C : cy)) <= r;
    const union = (...fs) => (x, y) => fs.some((f) => f(x, y));
    const minus = (a, b) => (x, y) => a(x, y) && !b(x, y);

    // START: home station — antenna, round hub with a window, solar wings, dock.
    const station = shade(grid(), union(
        rect(7, 1, 8, 3),                       // antenna
        minus(disc(4.3, 7), rect(7, 6, 8, 7)),  // hub with window
        rect(0, 5, 2, 9), rect(13, 5, 15, 9),   // solar wings
        rect(3, 7, 12, 7),                      // truss
        rect(6, 11, 9, 13)                      // docking port
    ));
    [1, 14].forEach((x) => { station[7][x] = 10; });

    // SETTINGS: gear — 4 straight + 4 diagonal teeth, round hole.
    const gear = shade(grid(), minus(union(
        disc(5.2),
        rect(6, 1, 9, 14), rect(1, 6, 14, 9),          // straight teeth
        rect(2, 2, 4, 4), rect(11, 2, 13, 4),          // diagonal teeth
        rect(2, 11, 4, 13), rect(11, 11, 13, 13)
    ), disc(1.9)));

    // CREDITS: medal — ribbon, round badge, star.
    const medal = shade(grid(), union(
        rect(4, 0, 6, 4), rect(9, 0, 11, 4),     // ribbon
        disc(5.6, 9.2)                           // badge
    ));
    const starRows = { 6: [7, 8], 7: [6, 9], 8: [4, 11], 9: [5, 10], 10: [5, 10], 11: [4, 6, 9, 11] };
    Object.keys(starRows).forEach((y) => {
        const r = starRows[y];
        for (let i = 0; i < r.length; i += 2) {
            for (let x = r[i]; x <= r[i + 1]; x++) medal[y][x] = x < 8 ? 15 : 10;
        }
    });

    // PROFILES: pilot — round helmet with a dark visor, neck, broad shoulders.
    const pilot = shade(grid(), union(
        disc(4.4, 5.2),                         // helmet
        rect(6, 9, 9, 10),                      // neck
        (x, y) => y <= 15 && Math.hypot(x - C, y - 17.5) <= 7.4  // shoulders
    ));
    for (let x = 5; x <= 10; x++) { pilot[5][x] = 10; pilot[6][x] = 10; }

    // LOAD: floppy disk — notched body, metal shutter on top, label below.
    const disk = shade(grid(), minus(rect(1, 1, 14, 14), rect(12, 1, 14, 2)));
    for (let y = 2; y <= 5; y++) for (let x = 4; x <= 11; x++) disk[y][x] = x >= 9 && x <= 10 ? 10 : 15;
    for (let y = 9; y <= 13; y++) for (let x = 3; x <= 12; x++) disk[y][x] = 10;
    for (let y = 10; y <= 13; y++) for (let x = 4; x <= 11; x++) disk[y][x] = 15;

    // NEW PILOT: pilot bust (shifted left) with a "+" badge at the top right.
    const shiftL = (f) => (x, y) => f(x + 1, y);
    const newPilot = shade(grid(), union(
        shiftL(disc(4.4, 5.2)),
        shiftL(rect(6, 9, 9, 10)),
        shiftL((x, y) => y <= 15 && Math.hypot(x - C, y - 17.5) <= 7.4),
        rect(13, 0, 14, 5), rect(11, 2, 15, 3)    // plus
    ));
    for (let x = 4; x <= 9; x++) { newPilot[5][x] = 10; newPilot[6][x] = 10; }
    for (let y = 0; y <= 5; y++) for (let x = 11; x <= 15; x++) {
        if (newPilot[y][x]) newPilot[y][x] = 15;
    }

    // ——— Main nav icons (HOME STATION / HANGAR / FACTIONS / EXPLORATIONS / MENU) ———
    const discAt = (cx, cy, r) => (x, y) => Math.hypot(x - cx, y - cy) <= r;

    // HANGAR: ship seen from above — long hull, swept wings, tail fins.
    const hangar = shade(grid(), union(
        rect(7, 1, 8, 13),                       // hull
        rect(6, 3, 9, 5),                        // cockpit bulge
        rect(4, 7, 11, 9), rect(1, 9, 14, 10),   // wings
        rect(5, 12, 10, 13)                      // tail
    ));
    hangar[3][7] = 10; hangar[3][8] = 10; hangar[4][7] = 10; hangar[4][8] = 10;

    // FACTIONS: banner shield with a cross.
    const factions = shade(grid(), minus(union(
        rect(2, 1, 13, 8), rect(3, 9, 12, 10), rect(4, 11, 11, 12), rect(6, 13, 9, 14)
    ), union(rect(7, 3, 8, 10), rect(5, 5, 10, 6))));

    // EXPLORATIONS: magnifier — lens ring and a diagonal handle.
    const lens = minus(discAt(6, 6, 5.2), discAt(6, 6, 2.6));
    const explore = shade(grid(), union(
        lens,
        (x, y) => x >= 9 && x <= 14 && y >= 9 && y <= 14 && Math.abs(x - y) <= 1
    ));

    // MENU: three bars.
    const menu = shade(grid(), union(rect(2, 2, 13, 4), rect(2, 6, 13, 9), rect(2, 11, 13, 13)));

    // ——— Main nav icons at 32×32: the same shapes, sampled at half-pixel
    // steps so edges and discs get twice the detail but the icon stays the
    // same size (shown at 64 px, every pixel is 2 px). ———
    const N2 = 32;
    const grid2 = () => Array.from({ length: N2 }, () => new Array(N2).fill(0));
    const fine = (f) => (X, Y) => f(X / 2 - 0.25, Y / 2 - 0.25);
    const shade2 = (f) => {
        const inside = fine(f);
        const g = grid2();
        for (let y = 0; y < N2; y++) {
            for (let x = 0; x < N2; x++) {
                if (!inside(x, y)) continue;
                const lit = !inside(x - 1, y) || !inside(x, y - 1);
                const dark = !inside(x + 1, y) || !inside(x, y + 1);
                g[y][x] = lit && !dark ? 15 : (dark && !lit ? 10 : 12);
            }
        }
        return g;
    };
    const patch2 = (g, x0, y0, x1, y1, v) => {
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (g[y][x]) g[y][x] = v;
    };

    const station32 = shade2(union(
        rect(7, 1, 8, 3),
        minus(disc(4.3, 7), rect(7, 6, 8, 7)),
        rect(0, 5, 2, 9), rect(13, 5, 15, 9),
        rect(3, 7, 12, 7),
        rect(6, 11, 9, 13)
    ));
    patch2(station32, 2, 14, 3, 15, 10); patch2(station32, 28, 14, 29, 15, 10);

    const hangar32 = shade2(union(
        rect(7, 1, 8, 13), rect(6, 3, 9, 5),
        rect(4, 7, 11, 9), rect(1, 9, 14, 10),
        rect(5, 12, 10, 13)
    ));
    patch2(hangar32, 14, 6, 17, 9, 10);

    const factions32 = shade2(minus(union(
        rect(2, 1, 13, 8), rect(3, 9, 12, 10), rect(4, 11, 11, 12), rect(6, 13, 9, 14)
    ), union(rect(7, 3, 8, 10), rect(5, 5, 10, 6))));

    const lens32 = minus(discAt(6, 6, 5.2), discAt(6, 6, 2.6));
    const explore32 = shade2(union(
        lens32,
        (x, y) => x >= 9 && x <= 14 && y >= 9 && y <= 14 && Math.abs(x - y) <= 1
    ));

    const menu32 = shade2(union(rect(2, 2, 13, 4), rect(2, 6, 13, 9), rect(2, 11, 13, 13)));

    Object.assign(IconSprites, {
        navStation32: station32,
        navHangar32: hangar32,
        navFactions32: factions32,
        navExplore32: explore32,
        navMenu32: menu32
    });

    Object.assign(IconSprites, {
        navHangarHd: hangar,
        navFactionsHd: factions,
        navExploreHd: explore,
        navMenuHd: menu,
        menuNewPilotHd: newPilot,
        menuLoadHd: disk,
        menuProfilesHd: pilot,
        menuStationHd: station,
        menuSettingsHd: gear,
        menuCreditsHd: medal
    });
})();
