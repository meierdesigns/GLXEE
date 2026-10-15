"use strict";

/**
 * Letter-encoded pixel data for IconSprites, editable as plain text/JSON and
 * through the Components editor's "ICONS" type. Source of truth on disk:
 * assets/meta/icons-data.json (same read/merge/save pattern as SpriteMetaStore
 * in sprite-meta.js). Each icon: { color, levels, grid: ["....", ...] },
 * grid rows use "." for transparent and "a".."o" for gray levels 1-15 (or the
 * custom levels array, index-matched to the letters).
 */
class IconJsonStore {
    constructor() {
        this.data = {};
        this.ready = false;
        this.path = "assets/meta/icons-data.json";
        this.lsKey = "vf_icon_json_v1";
        this.letters = "abcdefghijklmno";
        this.defaultLevels = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
        this._loadPromise = null;
    }

    async ensureLoaded() {
        if (this.ready) return this.data;
        if (this._loadPromise) return this._loadPromise;
        this._loadPromise = this._load();
        return this._loadPromise;
    }

    async _load() {
        const merged = {};
        try {
            const res = await fetch(this.path + "?v=" + Date.now());
            if (res.ok) {
                const json = await res.json();
                if (json && typeof json === "object") Object.assign(merged, json);
            }
        } catch (e) { /* ignore */ }
        this._mergeLocal(merged);
        this.data = merged;
        this.ready = true;
        this.applyAllToIconSprites();
        return this.data;
    }

    _mergeLocal(into) {
        try {
            const raw = localStorage.getItem(this.lsKey);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === "object") Object.assign(into, parsed);
        } catch (e) { /* ignore */ }
    }

    _persistLocal() {
        try { localStorage.setItem(this.lsKey, JSON.stringify(this.data)); } catch (e) { /* ignore */ }
    }

    get(key) {
        return key ? this.data[key] || null : null;
    }

    /** letters grid -> numeric IconSprites grid (0 + 1-15). */
    decodeGrid(icon) {
        const levels = Array.isArray(icon.levels) && icon.levels.length ? icon.levels : this.defaultLevels;
        return icon.grid.map((row) => row.split("").map((ch) => {
            if (ch === "." || ch === " ") return 0;
            const idx = this.letters.indexOf(ch);
            if (idx < 0) return 0;
            return levels[idx] != null ? levels[idx] : this.defaultLevels[idx];
        }));
    }

    /** numeric grid (0-15) -> letters grid, nearest level if a custom `levels` is given. */
    encodeGrid(matrix, levels) {
        const lv = Array.isArray(levels) && levels.length ? levels : this.defaultLevels;
        return matrix.map((row) => row.map((n) => {
            if (!n) return ".";
            let best = 0, bestDist = Infinity;
            for (let i = 0; i < lv.length; i++) {
                const d = Math.abs(lv[i] - n);
                if (d < bestDist) { bestDist = d; best = i; }
            }
            return this.letters[best] || "a";
        }).join("")).slice();
    }

    /** Stage an edit (grid/color/levels) for `key`, keep it in localStorage until saved to disk. */
    set(key, patch) {
        if (!key) return;
        const cur = Object.assign({ color: null, levels: null, grid: null }, this.data[key] || {});
        Object.assign(cur, patch);
        this.data[key] = cur;
        this._persistLocal();
        this.applyToIconSprites(key);
    }

    /** Push the stored grid/color for `key` into the live IconSprites/IconColors so it renders immediately. */
    applyToIconSprites(key) {
        const icon = this.data[key];
        if (!icon || !Array.isArray(icon.grid)) return;
        try {
            if (typeof IconSprites !== "undefined" && IconSprites) IconSprites[key] = this.decodeGrid(icon);
        } catch (e) { /* ignore */ }
        try {
            if (icon.color && typeof IconColors !== "undefined" && IconColors) IconColors[key] = icon.color;
        } catch (e) { /* ignore */ }
        try { if (typeof iconRenderer !== "undefined" && iconRenderer.clearCache) iconRenderer.clearCache(); } catch (e) { /* ignore */ }
    }

    applyAllToIconSprites() {
        Object.keys(this.data).forEach((key) => this.applyToIconSprites(key));
    }

    async saveToDisk() {
        this._persistLocal();
        if (typeof assetGenClient === "undefined" || !assetGenClient.writeJson) {
            return { ok: false, error: "Bridge writeJson unavailable" };
        }
        return assetGenClient.writeJson(this.path, this.data);
    }
}

/** Default per-icon tint from assets/meta/icons-data.json, consulted by imgHtml() when a call site passes no tint. */
var IconColors = (typeof window !== "undefined" && window.IconColors) || {};

const iconJsonStore = new IconJsonStore();
window.IconColors = IconColors;
window.IconJsonStore = IconJsonStore;
window.iconJsonStore = iconJsonStore;
iconJsonStore.ensureLoaded();
