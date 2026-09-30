"use strict";

// PlanetSVGManager: noise-driven generative surface styles on top of the
// classic banded / pocked / cragged / faceted / ringed looks. Every style
// paints "materials" (base colour, second colour, clouds, glow) that are
// re-shaded by the sphere's lighting, so they sit on the lit globe and keep
// working with the spin frames.
const PLANET_EXTRA_STYLES = [
    'continents', 'oceanic', 'lava', 'swirl', 'cloudy', 'toxic',
    'crystal', 'dunes', 'striped', 'marbled', 'glacial', 'spotted',
    'craters', 'cracked'
];

extendClass(PlanetSVGManager, {
    /** Lighting level of a tone: 0 lit … 3 night side; -1 = no shading family. */
    toneLevel(tone) {
        switch (tone) {
            case 'light': case 'soft': case 'altLight': return 0;
            case 'mid': case 'alt': return 1;
            case 'dark': case 'altDark': return 2;
            case 'deep': case 'altDeep': return 3;
            default: {
                // Extra families: cloud_0 … cloud_3, fac0_0 … (faction zones).
                const m = /_(\d)$/.exec(tone || '');
                return m ? Number(m[1]) : -1;
            }
        }
    },

    /** Tone of a material at lighting level `lvl` (+ shift: >0 darker, <0 lighter). */
    materialTone(material, lvl, shift) {
        const l = Math.max(0, Math.min(3, lvl + (shift || 0)));
        if (material === 'alt') return ['altLight', 'alt', 'altDark', 'altDeep'][l];
        if (material === 'glow' || material === 'accent' || /^lamp\d$/.test(material)) return material;
        if (material !== 'base') return material + '_' + l;
        return ['light', 'mid', 'dark', 'deep'][l];
    },

    /** Same material, moved from one lighting level to another (spin frames). */
    reshadeTone(tone, fromLvl, toLvl) {
        const l = this.toneLevel(tone);
        if (l < 0 || fromLvl < 0 || toLvl < 0) return tone;
        const fam = /^(.+)_\d$/.exec(tone);
        const material = fam ? fam[1] : (tone.indexOf('alt') === 0 ? 'alt' : 'base');
        return this.materialTone(material, l, toLvl - fromLvl);
    },

    /**
     * Seeded smooth 3D value noise + fbm. Styles sample it at points on the
     * sphere, so the far side exists too and spin frames show real rotation.
     */
    makePlanetNoise(seed) {
        const rng = this.seededRng(seed + '|noise');
        const table = new Float32Array(1024);
        for (let i = 0; i < 1024; i++) table[i] = rng();
        const hash = (x, y, z) => table[(((x * 73856093) ^ (y * 19349663) ^ (z * 83492791)) >>> 0) & 1023];
        const smooth = (t) => t * t * (3 - 2 * t);
        const lerp = (a, b, t) => a + (b - a) * t;
        const noise = (x, y, z) => {
            const x0 = Math.floor(x), y0 = Math.floor(y), z0 = Math.floor(z);
            const fx = smooth(x - x0), fy = smooth(y - y0), fz = smooth(z - z0);
            const plane = (zz) => lerp(
                lerp(hash(x0, y0, zz), hash(x0 + 1, y0, zz), fx),
                lerp(hash(x0, y0 + 1, zz), hash(x0 + 1, y0 + 1, zz), fx), fy);
            return lerp(plane(z0), plane(z0 + 1), fz);
        };
        const ox = rng() * 100, oy = rng() * 100, oz = rng() * 100;
        return (x, y, z, octaves) => {
            let sum = 0, amp = 0.5, freq = 1, norm = 0;
            for (let o = 0; o < (octaves || 4); o++) {
                sum += noise((x + ox) * freq, (y + oy) * freq, (z + oz) * freq) * amp;
                norm += amp;
                amp *= 0.5;
                freq *= 2.03;
            }
            return sum / norm;
        };
    },

    /** Paint one of PLANET_EXTRA_STYLES; returns false for the classic styles. */
    applyExtraStyle(grid, style, seed, meta, feat) {
        if (PLANET_EXTRA_STYLES.indexOf(style) === -1) return false;
        const n = grid.length;
        const { cx, cy, r } = meta;
        const k = meta.k || 1;
        const rng = this.seededRng(seed + '|x|' + style);
        const fbm = this.makePlanetNoise(seed + '|' + style);
        const shade = grid.map((row) => row.slice());
        // Coarser noise on the small icons so shapes still read at 16px.
        const oct = k > 1 ? 4 : 2;
        const paint = (x, y, material, shift) => {
            const s = shade[y][x];
            if (s === null) return;
            const lvl = this.toneLevel(s);
            grid[y][x] = this.materialTone(material, lvl < 0 ? 1 : lvl, shift);
        };
        // fn(x, y, U, V, W): the surface point under the pixel on the unit
        // sphere, turned back by meta.rot (spin frames) about the vertical axis.
        const rot = meta.rot || 0;
        const cosR = Math.cos(rot), sinR = Math.sin(rot);
        const each = (fn) => {
            for (let y = 0; y < n; y++) {
                for (let x = 0; x < n; x++) {
                    if (shade[y][x] === null) continue;
                    const u = (x - cx) / r, v = (y - cy) / r;
                    const z = Math.sqrt(Math.max(0, 1 - u * u - v * v));
                    fn(x, y, u * cosR - z * sinR, v, u * sinR + z * cosR);
                }
            }
        };
        // Random point on the sphere (spots, facets, storms).
        const spherePoint = () => {
            const yy = tune(-0.85, 0.85);
            const a = rng() * Math.PI * 2;
            const rr = Math.sqrt(1 - yy * yy);
            return { x: Math.cos(a) * rr, y: yy, z: Math.sin(a) * rr };
        };
        const dist3 = (p, U, V, W) => Math.sqrt((p.x - U) * (p.x - U) + (p.y - V) * (p.y - V) + (p.z - W) * (p.z - W));
        const tune = (a, b) => a + rng() * (b - a);

        if (style === 'continents' || style === 'oceanic') {
            // Base colour = sea, second colour = land, bright coasts + caps.
            const scale = tune(1.6, 2.8);
            const thr = style === 'oceanic' ? tune(0.58, 0.64) : tune(0.46, 0.53);
            const cap = tune(0.8, 0.9);
            each((x, y, u, v, w) => {
                const f = fbm(u * scale, v * scale, w * scale, oct);
                if (f > thr + 0.04) paint(x, y, 'alt', f > thr + 0.16 ? 1 : 0);
                else if (f > thr) paint(x, y, 'alt', -1);
                else paint(x, y, 'base', f < thr - 0.15 ? 1 : 0);
                if (Math.abs(v) > cap) paint(x, y, 'base', -2);
            });
            if (style === 'oceanic' || rng() < 0.5) {
                each((x, y, u, v, w) => {
                    if (fbm(u * 1.4 + 9, v * 4.5, w * 1.4, oct) > 0.62) paint(x, y, 'base', -3);
                });
            }
        } else if (style === 'lava') {
            // Dark crust, glowing fissures and pools.
            const scale = tune(2.2, 3.4);
            each((x, y, u, v, w) => {
                const f = fbm(u * scale, v * scale, w * scale, oct);
                paint(x, y, 'base', 1);
                if (Math.abs(f - 0.5) < 0.03 + 0.012 / k) grid[y][x] = 'glow';
                else if (f > 0.7) grid[y][x] = 'accent';
            });
        } else if (style === 'swirl') {
            // Gas giant: bands bent by turbulence, alternating two colours.
            const bands = tune(4, 8);
            const turb = tune(1.2, 2.6);
            each((x, y, u, v, w) => {
                const t = (v + 1) * bands + fbm(u * 1.6, v * 3.2, w * 1.6, oct) * turb * 2;
                const i = ((Math.floor(t) % 4) + 4) % 4;
                if (i === 1) paint(x, y, 'alt', 0);
                else if (i === 2) paint(x, y, 'base', 1);
                else if (i === 3) paint(x, y, 'alt', -1);
            });
            if (rng() < 0.7) feat.storms = true;
        } else if (style === 'cloudy') {
            // Thick streaky cloud cover over a darker surface.
            const cs = tune(0.9, 2.2);
            const st = tune(1.5, 5.5);
            const hi = tune(0.52, 0.62);
            each((x, y, u, v, w) => {
                paint(x, y, 'base', 1);
                const f = fbm(u * cs, v * cs * st, w * cs, oct);
                if (f > hi) paint(x, y, 'base', -2);
                else if (f > hi - 0.06) paint(x, y, 'alt', 0);
            });
        } else if (style === 'toxic') {
            // Blotchy second-colour patches with glowing spots.
            const scale = tune(2.5, 4);
            each((x, y, u, v, w) => {
                const f = fbm(u * scale, v * scale, w * scale, oct);
                if (f > 0.55) paint(x, y, 'alt', f > 0.66 ? -1 : 0);
                // Glow flecks tied to the surface (fine noise), not the pixel.
                if (f > 0.66 && fbm(u * 9, v * 9, w * 9, 1) > 0.62) grid[y][x] = 'glow';
            });
        } else if (style === 'crystal') {
            // Voronoi facets in both colours with dark seams.
            const pts = [];
            const count = Math.round(tune(7, 13));
            for (let i = 0; i < count; i++) {
                pts.push(Object.assign(spherePoint(), { m: rng() < 0.45 ? 'alt' : 'base', s: Math.floor(tune(-1, 2)) }));
            }
            each((x, y, u, v, w) => {
                let best = 9, second = 9, pick = pts[0];
                pts.forEach((p) => {
                    const d = dist3(p, u, v, w);
                    if (d < best) { second = best; best = d; pick = p; } else if (d < second) second = d;
                });
                if (second - best < 0.06 + 0.05 / k) paint(x, y, 'base', 2);
                else paint(x, y, pick.m, pick.s);
            });
        } else if (style === 'dunes') {
            // Wind-blown diagonal ridges.
            const freq = tune(7, 12);
            const tilt = tune(-0.8, 0.8);
            each((x, y, u, v, w) => {
                const ridge = Math.sin((Math.atan2(u, w) * tilt + v * 2) * freq * 0.6 + fbm(u * 2, v * 2, w * 2, oct) * 6);
                if (ridge > 0.55) paint(x, y, 'base', 1);
                else if (ridge < -0.75) paint(x, y, 'alt', -1);
            });
        } else if (style === 'striped') {
            // Many thin crisp bands in both colours.
            const bands = Math.round(tune(9, 16));
            const pal = [['base', 0], ['alt', 0], ['base', 1], ['alt', -1], ['base', -1]];
            const order = [];
            for (let i = 0; i < bands; i++) order.push(pal[Math.floor(rng() * pal.length)]);
            each((x, y, u, v, w) => {
                const t = (v + 1) / 2 + (fbm(u * 3, v, w * 3, 2) - 0.5) * 0.06;
                const m = order[Math.max(0, Math.min(bands - 1, Math.floor(t * bands)))];
                paint(x, y, m[0], m[1]);
            });
        } else if (style === 'marbled') {
            // Veined marble: sine of warped noise.
            const scale = tune(2, 3.2);
            const veinF = tune(2.2, 3);
            each((x, y, u, v, w) => {
                const f = fbm(u * scale, v * scale, w * scale, oct);
                const vein = Math.abs(Math.sin((v + f * 3) * veinF * Math.PI));
                if (vein < 0.18) paint(x, y, 'alt', 0);
                else if (vein < 0.35) paint(x, y, 'base', -1);
            });
        } else if (style === 'glacial') {
            // Pale ice sheet with dark cracks and exposed ground.
            each((x, y, u, v, w) => {
                paint(x, y, 'base', -1);
                const f = fbm(u * 3, v * 3, w * 3, oct);
                if (Math.abs(f - 0.5) < 0.025 + 0.015 / k) paint(x, y, 'alt', 2);
                else if (f < 0.32) paint(x, y, 'alt', 0);
            });
        } else if (style === 'spotted') {
            // Leopard spots: rings of the second colour.
            const spots = Math.round(tune(8, 16));
            const list = [];
            for (let i = 0; i < spots; i++) list.push(Object.assign(spherePoint(), { rr: tune(0.1, 0.24) }));
            each((x, y, u, v, w) => {
                list.forEach((p) => {
                    const d = dist3(p, u, v, w);
                    if (d < p.rr * 0.6) paint(x, y, 'base', 1);
                    else if (d < p.rr) paint(x, y, 'alt', 0);
                });
            });
        }
        if (style === 'craters') {
            // Moon-like: craters with a lit rim toward the light, dark floor.
            const list = [];
            const count = Math.round(tune(10, 20));
            for (let i = 0; i < count; i++) list.push(Object.assign(spherePoint(), { rr: tune(0.08, 0.3) }));
            each((x, y, u, v, w) => {
                if (fbm(u * 5, v * 5, w * 5, 2) > 0.6) paint(x, y, 'alt', 0);
                list.forEach((p) => {
                    const d = dist3(p, u, v, w);
                    if (d > p.rr) return;
                    // Rim: lit on the upper-left (sun) side, shadowed opposite.
                    const lit = (u - p.x) + (v - p.y) < 0;
                    if (d > p.rr * 0.78) paint(x, y, 'base', lit ? 1 : -1);
                    else paint(x, y, 'base', lit ? -1 : 1);
                });
            });
        } else if (style === 'cracked') {
            // Rocky crust split by deep fissures, a few glowing.
            const scale = tune(2.4, 3.6);
            each((x, y, u, v, w) => {
                const f = fbm(u * scale, v * scale, w * scale, oct);
                const g = fbm(u * 1.5 + 5, v * 1.5, w * 1.5, 2);
                if (g > 0.58) paint(x, y, 'alt', 0);
                if (Math.abs(f - 0.5) < 0.028 + 0.014 / k) grid[y][x] = g > 0.62 ? 'glow' : this.materialTone('base', this.toneLevel(shade[y][x]), 2);
            });
        }
        if (feat.storms) {
            // Oval storm eye on the sphere, so it turns with the surface.
            const p = spherePoint();
            p.y *= 0.6;
            const size = tune(0.12, 0.2);
            each((x, y, u, v, w) => {
                const dx = (p.x - u) / 2, dy = p.y - v, dz = (p.z - w) / 2;
                const e = Math.sqrt(dx * dx + dy * dy + dz * dz) / (size * 0.55);
                if (e < 0.55) grid[y][x] = 'accent';
                else if (e < 1) paint(x, y, 'base', 2);
            });
        }
        // Lamps after the clouds: city lights shine through the cover.
        this.applyCloudLayer(each, paint, seed, feat, k);
        this.applyFactionZones(each, paint, seed, feat, k);
        return true;
    },

    /**
     * Settled ground of each faction: a few noisy regions fixed to the
     * surface where city lamps (lampN, the faction colour, unlit by the sun)
     * light up in clusters. The terrain itself keeps the planet's colours.
     */
    applyFactionZones(each, paint, seed, feat, k) {
        const list = Array.isArray(feat.factionColors) ? feat.factionColors : [];
        if (!list.length) return;
        const rng = this.seededRng(seed + '|zones');
        const fbm = this.makePlanetNoise(seed + '|zones');
        const zones = [];
        list.forEach((_, i) => {
            // The first (ruling) faction holds more ground.
            const count = i === 0 ? 2 + Math.floor(rng() * 2) : 1 + Math.floor(rng() * 2);
            for (let c = 0; c < count; c++) {
                const yy = -0.75 + rng() * 1.5;
                const a = rng() * Math.PI * 2;
                const rr = Math.sqrt(1 - yy * yy);
                zones.push({ m: 'fac' + i, x: Math.cos(a) * rr, y: yy, z: Math.sin(a) * rr,
                    size: (i === 0 ? 0.42 : 0.3) + rng() * 0.16 });
            }
        });
        const city = this.makePlanetNoise(seed + '|cities');
        each((x, y, u, v, w) => {
            const warp = (fbm(u * 3.2, v * 3.2, w * 3.2, 3) - 0.5) * 0.45;
            for (let i = zones.length - 1; i >= 0; i--) {
                const p = zones[i];
                const d = Math.sqrt((p.x - u) * (p.x - u) + (p.y - v) * (p.y - v) + (p.z - w) * (p.z - w)) + warp;
                if (d > p.size) continue;
                // Clustered lamps, denser towards the region's centre.
                // Small icons: coarser, denser lights so they still read.
                const f = (k || 1) > 1 ? 9 : 5;
                const c = city(u * f, v * f, w * f, 2);
                if (c > 0.4 + (d / p.size) * 0.14 && ((k || 1) === 1 || (x * 7 + y * 3) % 3 !== 0)) paint(x, y, 'lamp' + p.m.slice(3), 0);
                break;
            }
        });
    },

    /** City lamps (applyFactionZones) on a classic-style globe. */
    applyClassicLamps(grid, seed, meta, feat) {
        if (!feat || !Array.isArray(feat.factionColors) || !feat.factionColors.length) return;
        const n = grid.length;
        const { cx, cy, r } = meta;
        const rot = meta.rot || 0;
        const cosR = Math.cos(rot), sinR = Math.sin(rot);
        const each = (fn) => {
            for (let y = 0; y < n; y++) {
                for (let x = 0; x < n; x++) {
                    const t = grid[y][x];
                    if (t === null || t === 'ring' || t === 'ringDark') continue;
                    const u = (x - cx) / r, v = (y - cy) / r;
                    if (u * u + v * v > 1) continue;
                    const z = Math.sqrt(Math.max(0, 1 - u * u - v * v));
                    fn(x, y, u * cosR - z * sinR, v, u * sinR + z * cosR);
                }
            }
        };
        const paint = (x, y, material) => { grid[y][x] = material; };
        this.applyFactionZones(each, paint, seed, feat, meta.k || 1);
    },

    /** Optional cloud cover: per-planet amount, scale and stretch. */
    applyCloudLayer(each, paint, seed, feat, k) {
        const c = feat.clouds;
        if (!c) return;
        const fbm = this.makePlanetNoise(seed + '|clouds');
        const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
        const thr = 1 - c.cover;
        each((x, y, u, v, w) => {
            const f = fbm(u * c.scale + c.drift, v * c.scale * c.stretch, w * c.scale, k > 1 ? 4 : 2);
            if (f < thr - 0.05) return;
            // Dithered fringe, solid cores.
            if (f < thr && bayer[(y % 4) * 4 + (x % 4)] / 16 > (f - thr + 0.05) / 0.05) return;
            paint(x, y, 'cloud', f > thr + 0.08 ? -1 : 0);
        });
    }
});
