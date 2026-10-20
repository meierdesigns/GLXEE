"use strict";

// ComponentEditorUI: seeded procedural sprite generator + grid quantiser (global Pixel Size friendly:
// 1 grid cell == 1 sprite pixel, so the editor shows it at the global pixel size).
extendClass(ComponentEditorUI, {
    /** Small deterministic PRNG (mulberry32). */
    _procRng(seed) {
        let a = (Number(seed) || 0) >>> 0;
        return () => {
            a = (a + 0x6D2B79F5) >>> 0;
            let t = a;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    },

    /** Build a symmetric blob grid of shade indices (0 = empty). */
    buildProceduralGrid(size, seed, shades) {
        const rnd = this._procRng(seed);
        const half = Math.ceil(size / 2);
        const g = [];
        for (let y = 0; y < size; y++) g.push(new Array(size).fill(0));
        const cy = (size - 1) / 2;
        // Random-walk blobs seeded on the centre column, grown to the left half, then mirrored.
        const blobs = 2 + Math.floor(rnd() * 3);
        for (let b = 0; b < blobs; b++) {
            const bx = half - 1 - Math.floor(rnd() * half * 0.5);
            const by = Math.round(cy + (rnd() - 0.5) * size * 0.5);
            const r = size * (0.12 + rnd() * 0.2);
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < half; x++) {
                    const dx = (x - bx) / (r * (0.8 + rnd() * 0.4));
                    const dy = (y - by) / (r * (1 + rnd() * 0.5));
                    if (dx * dx + dy * dy <= 1) g[y][x] = 1;
                }
            }
        }
        for (let y = 0; y < size; y++) for (let x = 0; x < half; x++) g[y][size - 1 - x] = g[y][x];
        // Shade: dark rim, lighter towards the middle, light noise.
        const out = g.map((row) => row.slice());
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                if (!g[y][x]) continue;
                const edge = !(g[y - 1] && g[y - 1][x]) || !(g[y + 1] && g[y + 1][x]) || !g[y][x - 1] || !g[y][x + 1];
                let t = edge ? 0 : 0.35 + 0.65 * (1 - Math.abs(x - (size - 1) / 2) / half) + (rnd() - 0.5) * 0.25;
                t = Math.max(0, Math.min(0.999, t));
                out[y][x] = shades[Math.floor(t * shades.length)];
            }
        }
        return out;
    },

    onProceduralGenerate() {
        const entry = this.currentEntry();
        if (!entry || this.busy) return;
        this.readGenFields();
        const size = this.outSize || entry.size || 16;
        this.reloadEditBuffer(true);
        if (!this._editCanvas) return;
        const seed = this.seed !== "" && Number.isFinite(Number(this.seed))
            ? Number(this.seed) : Math.floor(Math.random() * 1e9);
        const grid = this.buildProceduralGrid(size, seed, this.getPaletteShades());
        const ctx = this._editCanvas.getContext("2d");
        ctx.clearRect(0, 0, size, size);
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                if (!grid[y][x]) continue;
                const v = this.shadeToGray(grid[y][x]);
                ctx.fillStyle = "rgb(" + v + "," + v + "," + v + ")";
                ctx.fillRect(x, y, 1, 1);
            }
        }
        this._pixelDirty = true;
        this.setStatus("Procedural · seed " + seed);
        this.drawCenter();
    },

    /** Downscale any image/canvas onto a size×size grid in the palette grays (nearest sampling). */
    quantizeToGrid(src, size) {
        const c = document.createElement("canvas");
        c.width = c.height = size;
        const ctx = c.getContext("2d");
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(src, 0, 0, size, size);
        return c;
    }
});
