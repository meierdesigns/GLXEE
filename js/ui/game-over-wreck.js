"use strict";

/**
 * Game-over backdrop: the player's faction hull, broken in two and drifting,
 * with scorch holes, sparking embers and floating debris. Pixel-art canvas
 * behind .game-over-content; colors come from FactionShipStyles.
 */
const VFGameOverWreck = {
    canvas: null,
    raf: 0,
    state: null,

    start(overlay) {
        this.stop();
        if (!overlay || typeof factionShipStyles === 'undefined') return;
        let cv = overlay.querySelector('.game-over-wreck');
        if (!cv) {
            cv = document.createElement('canvas');
            cv.className = 'game-over-wreck';
            cv.setAttribute('aria-hidden', 'true');
            overlay.insertBefore(cv, overlay.firstChild);
        }
        this.canvas = cv;
        const faction = factionShipStyles.normalizeFaction(
            document.documentElement.dataset.faction || 'terran');
        this.state = this.buildWreck(faction);
        const loop = (t) => {
            this.draw(t / 1000);
            this.raf = requestAnimationFrame(loop);
        };
        this.raf = requestAnimationFrame(loop);
    },

    stop() {
        if (this.raf) cancelAnimationFrame(this.raf);
        this.raf = 0;
    },

    /** Splits the capital sprite into two charred halves plus loose debris. */
    buildWreck(faction) {
        const fs = factionShipStyles;
        const grid = fs.getPixelSprite(faction, 'capital');
        const colors = fs.buildFactionColors(faction);
        const accent = colors[3];
        let seed = fs.hash(faction + '|wreck');
        const rnd = () => {
            seed = (seed * 1664525 + 1013904223) >>> 0;
            return seed / 4294967296;
        };
        const h = grid.length;
        const w = grid[0].length;
        // Jagged fracture line roughly across the middle.
        const cut = [];
        let y = Math.floor(h * 0.5);
        for (let x = 0; x < w; x++) {
            y += Math.round((rnd() - 0.5) * 2);
            cut.push(Math.max(2, Math.min(h - 3, y)));
        }
        const fore = [];
        const aft = [];
        const debris = [];
        for (let r = 0; r < h; r++) {
            for (let c = 0; c < w; c++) {
                const v = grid[r][c];
                if (!v) continue;
                const roll = rnd();
                if (roll < 0.1) continue; // blown-out hole
                let col = colors[v];
                // Char most of the hull: darken toward the fracture.
                const near = Math.abs(r - cut[c]) <= 1;
                if (near || roll < 0.35) col = fs.shadeColor(col, -0.6);
                else col = fs.shadeColor(col, -0.25);
                const px = { x: c, y: r, col, hot: near && rnd() < 0.5 };
                if (near && rnd() < 0.18) {
                    debris.push(this.makeDebris(c, r, col, rnd));
                    continue;
                }
                (r < cut[c] ? fore : aft).push(px);
            }
        }
        for (let i = 0; i < 26; i++) {
            const col = rnd() < 0.3 ? fs.shadeColor(accent, -0.3) : fs.shadeColor(colors[2], -0.5);
            debris.push(this.makeDebris(rnd() * w, cut[Math.floor(rnd() * w)], col, rnd, 1.6));
        }
        const embers = [];
        for (let i = 0; i < 40; i++) embers.push(this.makeEmber(w, h, rnd()));
        return { w, h, fore, aft, debris, embers, accent, rnd, cut };
    },

    makeDebris(x, y, col, rnd, spread) {
        const s = spread || 1;
        return {
            x, y, col,
            vx: (rnd() - 0.5) * 1.2 * s,
            vy: (rnd() - 0.5) * 1.2 * s,
            spin: (rnd() - 0.5) * 2,
            size: rnd() < 0.25 ? 2 : 1
        };
    },

    makeEmber(w, h, r) {
        return { x: w * (0.2 + 0.6 * Math.random()), y: h * 0.5, life: r * 3, max: 1.5 + Math.random() * 2,
            vx: (Math.random() - 0.5) * 2, vy: -0.5 - Math.random() * 1.5 };
    },

    draw(t) {
        const cv = this.canvas;
        const s = this.state;
        if (!cv || !s || !cv.isConnected || !cv.clientWidth) return this.stop();
        const W = Math.max(1, Math.floor(cv.clientWidth / 4));
        const H = Math.max(1, Math.floor(cv.clientHeight / 4));
        if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
        const ctx = cv.getContext('2d');
        ctx.clearRect(0, 0, W, H);
        const scale = Math.max(2, Math.floor(Math.min(W / (s.w * 1.6), H / (s.h * 2.4))));
        const ox = Math.floor(W / 2 - (s.w * scale) / 2);
        const oy = Math.floor(H * 0.42 - (s.h * scale) / 2);
        const drift = Math.sin(t * 0.4) * scale * 0.6;
        const pull = scale * (1.5 + Math.sin(t * 0.25) * 0.4);

        const half = (pts, dx, dy, rot) => {
            const pcx = s.w / 2;
            const pcy = s.h / 2;
            const cs = Math.cos(rot);
            const sn = Math.sin(rot);
            pts.forEach((p) => {
                const rx = (p.x - pcx) * cs - (p.y - pcy) * sn + pcx;
                const ry = (p.x - pcx) * sn + (p.y - pcy) * cs + pcy;
                let col = p.col;
                if (p.hot) col = Math.sin(t * 6 + p.x * 1.7) > 0.2 ? '#ffb347' : '#ff5a2a';
                ctx.fillStyle = col;
                ctx.fillRect(Math.round(ox + rx * scale + dx), Math.round(oy + ry * scale + dy), scale, scale);
            });
        };
        half(s.fore, drift * 0.5, -pull + drift, -0.12 + Math.sin(t * 0.3) * 0.03);
        half(s.aft, -drift * 0.5, pull, 0.1 - Math.sin(t * 0.27) * 0.03);

        // Debris orbits slowly away from the break, wraps back in.
        s.debris.forEach((d) => {
            const k = (t * 0.15 + d.spin) % 3;
            const x = ox + (d.x + d.vx * k * 6) * scale;
            const y = oy + (d.y + d.vy * k * 6) * scale;
            ctx.globalAlpha = Math.max(0, 1 - k / 3);
            ctx.fillStyle = d.col;
            ctx.fillRect(Math.round(x), Math.round(y), d.size * Math.max(1, scale - 1), d.size * Math.max(1, scale - 1));
        });

        // Embers rise from the fracture.
        s.embers.forEach((e) => {
            e.life += 1 / 60;
            if (e.life > e.max) Object.assign(e, this.makeEmber(s.w, s.h, 0));
            const f = e.life / e.max;
            ctx.globalAlpha = 1 - f;
            ctx.fillStyle = f < 0.4 ? '#ffd27a' : (f < 0.7 ? '#ff6a2a' : '#5a5a60');
            const x = ox + (e.x + e.vx * e.life * 2) * scale;
            const y = oy + (e.y + e.vy * e.life * 3) * scale;
            ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, scale >> 1), Math.max(1, scale >> 1));
        });
        ctx.globalAlpha = 1;
    }
};
