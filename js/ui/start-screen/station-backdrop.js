"use strict";

// Start screen background: the pilot's home station as pixel art.
// Look follows the profile's faction; size/detail follows its station upgrade
// levels. Hovering a pilot on the scoreboard previews that pilot's station.
class StartStationBackdrop {
    constructor() {
        this.W = 320;
        this.H = 180;
        this.palettes = {
            terran: { hull: '#3A6EA5', edge: '#1a3048', accent: '#7ec8ff' },
            kronax: { hull: '#C44B2F', edge: '#4a1810', accent: '#ff7a4a' },
            machine: { hull: '#2F8F6B', edge: '#0e3028', accent: '#50e0a8' },
            pirate: { hull: '#8B6914', edge: '#3a2e08', accent: '#d4a84a' },
            voidborn: { hull: '#7B2E86', edge: '#3a1238', accent: '#f09cff' }
        };
        this.el = document.createElement('div');
        this.el.className = 'start-station-backdrop';
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.W;
        this.canvas.height = this.H;
        this.canvas.className = 'start-station-canvas';
        this.caption = document.createElement('div');
        this.caption.className = 'start-station-caption';
        this.el.appendChild(this.canvas);
        this.el.appendChild(this.caption);
        this.ctx = this.canvas.getContext('2d');
        this.baseProfile = null;
        this.shownKey = null;
        this.fadeTimer = 0;
    }

    /** Sum of all station upgrade levels -> 0..5 build stage. */
    static tierOf(profile) {
        const ups = (profile && profile.homeStation && profile.homeStation.upgrades) || {};
        let sum = 0;
        Object.keys(ups).forEach((k) => { sum += Math.max(0, Number(ups[k]) || 0); });
        const tier = sum >= 30 ? 5 : sum >= 18 ? 4 : sum >= 9 ? 3 : sum >= 4 ? 2 : sum >= 1 ? 1 : 0;
        return { sum, tier };
    }

    /** The station shown when nothing is hovered. */
    setBase(profile) {
        this.baseProfile = profile || null;
        this.show(this.baseProfile);
    }

    hover(profile) {
        this.show(profile || this.baseProfile);
    }

    show(profile) {
        const faction = String((profile && profile.faction) || 'pirate');
        const { sum, tier } = StartStationBackdrop.tierOf(profile);
        const key = `${profile ? profile.id : '-'}|${faction}|${tier}`;
        if (key === this.shownKey) return;
        this.shownKey = key;
        this.caption.textContent = profile
            ? `${profile.name || 'PILOT'} · ${faction.toUpperCase()} STATION · LV ${sum}`
            : 'NO PILOT · BASIC OUTPOST';
        // Quick fade-swap so the change reads as a different station
        this.canvas.classList.add('is-swapping');
        clearTimeout(this.fadeTimer);
        this.fadeTimer = setTimeout(() => {
            this.draw(faction, tier, profile ? String(profile.id || profile.name) : 'none');
            this.canvas.classList.remove('is-swapping');
        }, 110);
    }

    rngFor(seed) {
        let h = 2166136261;
        for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
        return () => {
            h += 0x6D2B79F5;
            let t = Math.imul(h ^ (h >>> 15), 1 | h);
            t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    draw(faction, tier, seed) {
        const pal = this.palettes[faction] || this.palettes.pirate;
        const c = this.ctx;
        const rnd = this.rngFor(seed);
        c.clearRect(0, 0, this.W, this.H);
        const cx = this.W >> 1;
        const cy = (this.H >> 1) - 4;

        // deep space: stars (fixed layout) and a planet limb below the station
        const srnd = this.rngFor('stars');
        c.fillStyle = '#02040a';
        c.fillRect(0, 0, this.W, this.H);
        for (let i = 0; i < 140; i++) {
            const big = srnd() < 0.12;
            c.fillStyle = big ? pal.accent : (srnd() < 0.5 ? '#9aa6c8' : '#4a5578');
            c.fillRect(Math.floor(srnd() * this.W), Math.floor(srnd() * this.H), big ? 2 : 1, big ? 2 : 1);
        }
        const pg = c.createRadialGradient(cx, this.H + 150, 150, cx, this.H + 150, 215);
        pg.addColorStop(0, pal.edge);
        pg.addColorStop(0.9, pal.hull + '88');
        pg.addColorStop(1, pal.accent + '00');
        c.fillStyle = pg;
        c.fillRect(0, this.H - 70, this.W, 70);
        // soft faction-colored halo behind the station
        const g = c.createRadialGradient(cx, cy, 4, cx, cy, 110);
        g.addColorStop(0, pal.accent + '38');
        g.addColorStop(1, pal.accent + '00');
        c.fillStyle = g;
        c.fillRect(0, 0, this.W, this.H);
        // the station itself is drawn larger; fewer details need more zoom
        c.save();
        c.translate(cx, cy);
        const zoom = 1.05 - tier * 0.09;
        c.scale(zoom, zoom);
        c.translate(-cx, -cy);

        const r = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), w, h); };
        // block with dark outline, lit top edge and a row of lit windows
        const block = (x, y, w, h, col) => {
            r(x - 1, y - 1, w + 2, h + 2, '#05060a');
            r(x, y, w, h, col || pal.hull);
            r(x, y, w, 1, pal.accent + '99');
            r(x, y + h - 1, w, 1, pal.edge);
            for (let wx = x + 2; wx < x + w - 2; wx += 4) {
                if (h > 6 && rnd() < 0.7) r(wx, y + (h >> 1), 2, 1, pal.accent);
            }
        };
        const line = (x0, y0, x1, y1, col, th) => {
            const n = Math.max(1, Math.abs(x1 - x0), Math.abs(y1 - y0));
            for (let i = 0; i <= n; i++) r(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, th, th, col);
        };
        const ring = (rad, th, col, gapEvery) => {
            for (let a = 0; a < 360; a += 1.5) {
                if (gapEvery && Math.floor(a / 15) % gapEvery === 0) continue;
                const rad2 = a * Math.PI / 180;
                r(cx + Math.cos(rad2) * rad, cy + Math.sin(rad2) * rad * 0.82, th, th, col);
            }
        };
        const lights = (n, spread) => {
            for (let i = 0; i < n; i++) {
                r(cx + (rnd() - 0.5) * spread, cy + (rnd() - 0.5) * spread * 0.7, 2, 2, rnd() < 0.5 ? pal.accent : '#fff');
            }
        };
        const dockedShip = () => {
            const sx = cx + 70 + tier * 4, sy = cy + 34;
            r(sx - 1, sy - 1, 14, 7, '#05060a');
            r(sx, sy, 12, 5, pal.hull);
            r(sx + 8, sy + 1, 5, 3, pal.accent);
            r(sx - 3, sy + 2, 3, 1, '#ffd25a');
        };

        if (faction === 'terran') {
            // vertical spine + horizontal truss with habitat blocks
            const span = 34 + tier * 12;
            block(cx - 8, cy - 22, 16, 44, pal.hull);
            block(cx - span, cy - 3, span * 2, 6, pal.edge);
            for (let i = 0; i <= tier + 1; i++) {
                const ox = 14 + i * 14;
                if (ox > span) break;
                block(cx - ox - 10, cy - 12 - (i & 1) * 6, 10, 12 + (i & 1) * 6, pal.hull);
                block(cx + ox, cy - 12 - (i & 1) * 6, 10, 12 + (i & 1) * 6, pal.hull);
            }
            if (tier >= 2) {
                [-1, 1].forEach((s) => {
                    for (let k = 0; k < 2 + (tier >> 1); k++) {
                        block(cx + s * (span - 8) - 6, cy + 8 + k * 9, 12, 7, '#1d4e86');
                        r(cx + s * (span - 8) - 6, cy + 8 + k * 9 + 3, 12, 1, pal.accent + '66');
                    }
                });
            }
            if (tier >= 3) {
                line(cx, cy - 22, cx, cy - 36 - tier * 2, pal.accent, 1);
                r(cx - 1, cy - 38 - tier * 2, 3, 3, '#ff4a4a');
            }
        } else if (faction === 'kronax') {
            // armored core with radiating spikes
            const spikes = 4 + tier * 2;
            const len = 22 + tier * 9;
            for (let i = 0; i < spikes; i++) {
                const a = (i / spikes) * Math.PI * 2 + 0.3;
                const x1 = cx + Math.cos(a) * len, y1 = cy + Math.sin(a) * len * 0.82;
                line(cx, cy, x1, y1, '#05060a', 5);
                line(cx, cy, x1, y1, pal.hull, 3);
                line(cx + Math.cos(a) * len * 0.5, cy + Math.sin(a) * len * 0.41, x1, y1, pal.accent, 1);
            }
            block(cx - 10, cy - 8, 20, 16, pal.hull);
            r(cx - 4, cy - 3, 8, 6, pal.accent);
            r(cx - 2, cy - 1, 4, 2, '#fff');
            if (tier >= 3) ring(len * 0.55, 2, pal.edge, 3);
        } else if (faction === 'machine') {
            // circuit grid of nodes joined by traces
            const nodes = [[0, 0]];
            const rings = 1 + (tier >> 1) + (tier > 0 ? 1 : 0);
            for (let rr = 1; rr <= rings; rr++) {
                const d = rr * 24;
                [[d, 0], [-d, 0], [0, d * 0.8], [0, -d * 0.8], [d, d * 0.8], [-d, -d * 0.8]].forEach((n) => {
                    if (rnd() < 0.5 + tier * 0.1) nodes.push(n);
                });
            }
            nodes.forEach((n) => {
                if (n[0] || n[1]) {
                    line(cx, cy, cx + n[0], cy + n[1], '#05060a', 3);
                    line(cx, cy, cx + n[0], cy + n[1], pal.edge, 1);
                }
            });
            nodes.forEach((n, i) => {
                const s = i === 0 ? 20 : 12;
                block(cx + n[0] - s / 2, cy + n[1] - s / 2, s, s, i === 0 ? pal.hull : pal.edge);
                r(cx + n[0] - 1, cy + n[1] - 1, 3, 3, pal.accent);
            });
        } else if (faction === 'voidborn') {
            // concentric rings around a glowing core
            const radii = [14, 26, 38, 50].slice(0, 1 + Math.min(3, (tier + 1) >> 1));
            radii.forEach((rad, i) => {
                ring(rad, 4, '#05060a', 0);
                ring(rad, 2, i % 2 ? pal.accent : pal.hull, 6 + i);
            });
            r(cx - 6, cy - 6, 12, 12, '#05060a');
            r(cx - 4, cy - 4, 8, 8, pal.accent);
            r(cx - 2, cy - 2, 4, 4, '#fff');
            for (let k = 0; k < 3 + tier * 2; k++) {
                const a = rnd() * Math.PI * 2, d = 20 + rnd() * (30 + tier * 6);
                r(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.82, 3, 3, pal.hull);
            }
        } else {
            // pirate: scrap pile of mismatched hull plates
            const n = 7 + tier * 5;
            block(cx - 12, cy - 8, 24, 16, pal.hull);
            for (let i = 0; i < n; i++) {
                const w = 8 + Math.floor(rnd() * 14), h = 5 + Math.floor(rnd() * 9);
                const x = cx + (rnd() - 0.5) * (50 + tier * 22) - w / 2;
                const y = cy + (rnd() - 0.5) * (30 + tier * 11) - h / 2;
                block(x, y, w, h, rnd() < 0.5 ? pal.hull : pal.edge);
            }
            for (let i = 0; i < 2 + (tier >> 1); i++) {
                const ax = cx + (rnd() - 0.5) * 40;
                line(ax, cy - 14, ax + (rnd() - 0.5) * 20, cy - 34 - tier * 2, '#05060a', 2);
            }
            r(cx - 2, cy - 2, 4, 4, '#ff4a4a');
        }

        lights(6 + tier * 4, 70 + tier * 14);
        if (tier >= 3) dockedShip();
        c.restore();
    }
}

extendClass(StartScreenManager, {
    /** Mounts the station backdrop behind the main menu content. */
    mountStationBackdrop(content, base) {
        if (!this._stationBackdrop) this._stationBackdrop = new StartStationBackdrop();
        const bd = this._stationBackdrop;
        // Insert once the content is attached to the start-screen host.
        queueMicrotask(() => {
            if (!content.parentNode) return;
            content.parentNode.insertBefore(bd.el, content);
        });
        bd.shownKey = null;
        bd.setBase(base);
        return bd;
    }
});
