"use strict";

// FactionShipStyles members, continued from core.js: pixel grid helpers and string hash.
extendClass(FactionShipStyles, {
    blankGrid() {
        const g = [];
        for (let r = 0; r < this.spriteH; r++) {
            g[r] = [];
            for (let c = 0; c < this.spriteW; c++) g[r][c] = 0;
        }
        return g;
    },

    setPx(g, c, r, v) {
        if (r < 0 || c < 0 || r >= this.spriteH || c >= this.spriteW) return;
        if (v > (g[r][c] || 0)) g[r][c] = v;
    },

    fillRect(g, c0, r0, w, h, v) {
        for (let r = r0; r < r0 + h; r++) {
            for (let c = c0; c < c0 + w; c++) this.setPx(g, c, r, v);
        }
    },

    clearPx(g, c, r) {
        if (r < 0 || c < 0 || r >= this.spriteH || c >= this.spriteW) return;
        g[r][c] = 0;
    },

    /** Deterministic hash for asymmetric scrap / accents. */
    hash(str) {
        let h = 2166136261;
        const s = String(str);
        for (let i = 0; i < s.length; i++) {
            h ^= s.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        return h >>> 0;
    },
});
