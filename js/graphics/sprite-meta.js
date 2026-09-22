"use strict";

/**
 * Per-sprite displayScale, lengthScale, symmetric + outSize for component editor / hull mounts.
 * Sources: assets/meta/sprite-meta.json, assets/modules/meta.json, localStorage.
 */
class SpriteMetaStore {
    constructor() {
        this.data = {};
        this.ready = false;
        this.path = "assets/meta/sprite-meta.json";
        this.lsKey = "vf_component_meta_v1";
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
        this._mergeLocal(merged);
        try {
            const res = await fetch(this.path + "?v=" + Date.now());
            if (res.ok) {
                const json = await res.json();
                if (json && typeof json === "object") Object.assign(merged, json);
            }
        } catch (e) {
            /* ignore */
        }
        try {
            const res2 = await fetch("assets/modules/meta.json?v=" + Date.now());
            if (res2.ok) {
                const json2 = await res2.json();
                if (json2 && typeof json2 === "object") Object.assign(merged, json2);
            }
        } catch (e) {
            /* ignore */
        }
        this.data = merged;
        this.ready = true;
        return this.data;
    }

    _mergeLocal(into) {
        try {
            const raw = localStorage.getItem(this.lsKey);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === "object") Object.assign(into, parsed);
        } catch (e) {
            /* ignore */
        }
    }

    get(key) {
        if (!key) return null;
        return this.data[key] || null;
    }

    getDisplayScale(key) {
        const m = this.get(key);
        const s = m && m.displayScale != null ? Number(m.displayScale) : 1;
        if (!isFinite(s) || s <= 0) return 1;
        return Math.min(3, Math.max(0.25, s));
    }

    getOutSize(key, fallback) {
        const m = this.get(key);
        if (m && m.outSize != null) {
            const n = Number(m.outSize);
            if ([8, 16, 32, 64, 128].indexOf(n) >= 0) return n;
        }
        return fallback != null ? fallback : 64;
    }

    /** Vertical length factor (shorten pointed mounts). Default 1. */
    getLengthScale(key) {
        const m = this.get(key);
        const s = m && m.lengthScale != null ? Number(m.lengthScale) : 1;
        if (!isFinite(s) || s <= 0) return 1;
        return Math.min(1.5, Math.max(0.25, s));
    }

    getSymmetric(key) {
        const m = this.get(key);
        if (!m || m.symmetric == null) return true;
        return !!m.symmetric;
    }

    set(key, patch) {
        if (!key) return;
        const cur = Object.assign({}, this.data[key] || {});
        if (patch && typeof patch === "object") Object.assign(cur, patch);
        this.data[key] = cur;
        this._persistLocal();
    }

    _persistLocal() {
        try {
            localStorage.setItem(this.lsKey, JSON.stringify(this.data));
        } catch (e) {
            /* ignore */
        }
    }

    async saveToDisk() {
        this._persistLocal();
        if (typeof assetGenClient === "undefined" || !assetGenClient.writeJson) {
            return { ok: false, error: "Bridge writeJson unavailable" };
        }
        return assetGenClient.writeJson(this.path, this.data);
    }
}

const spriteMeta = new SpriteMetaStore();
window.SpriteMetaStore = SpriteMetaStore;
window.spriteMeta = spriteMeta;
spriteMeta.ensureLoaded();
