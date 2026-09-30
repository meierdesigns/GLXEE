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

    Object.assign(IconSprites, {
        menuProfilesHd: pilot,
        menuStationHd: station,
        menuSettingsHd: gear,
        menuCreditsHd: medal
    });
})();
