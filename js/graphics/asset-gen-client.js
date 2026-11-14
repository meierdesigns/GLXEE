"use strict";

/**
 * Client for the local Asset-Gen Bridge (ComfyUI Flux).
 */
class AssetGenClient {
    constructor() {
        this.baseUrl = "http://127.0.0.1:8787";
    }

    /** Dev bridge only — never write against hosted origins (itch.io CDN is read-only). */
    _bridgeAllowed() {
        try {
            const u = new URL(this.baseUrl, location.href);
            const h = u.hostname || "";
            return h === "127.0.0.1" || h === "localhost" || h === "[::1]";
        } catch (e) {
            return false;
        }
    }

    setBaseUrl(url) {
        if (!url) return;
        const next = String(url).replace(/\/$/, "");
        if (next !== this.baseUrl) this._offlineUntil = 0;
        this.baseUrl = next;
    }

    // Callers fire this from several menu paths; share one in-flight request and
    // remember an unreachable bridge for 30s so the console isn't flooded.
    health(force) {
        if (!force && this._healthPending) return this._healthPending;
        if (!force && this._offlineResult && Date.now() < (this._offlineUntil || 0)) {
            return Promise.resolve(this._offlineResult);
        }
        this._healthPending = this._fetchHealth().finally(() => { this._healthPending = null; });
        return this._healthPending;
    }

    async _fetchHealth() {
        try {
            const res = await fetch(this.baseUrl + "/api/health", { method: "GET" });
            if (!res.ok) return { ok: false, error: "HTTP " + res.status };
            this._offlineUntil = 0;
            return await res.json();
        } catch (e) {
            this._offlineResult = {
                ok: false,
                error: "Bridge unreachable. Run: npm run assets",
                detail: String(e && e.message || e)
            };
            this._offlineUntil = Date.now() + 30000;
            return this._offlineResult;
        }
    }

    async comfyStatus() {
        const res = await fetch(this.baseUrl + "/api/comfy/status", { method: "GET" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((data && data.error) || ("Status HTTP " + res.status));
        return data;
    }

    async startComfy() {
        if (!this._bridgeAllowed()) throw new Error("Asset bridge is local-dev only");
        const res = await fetch(this.baseUrl + "/api/comfy/start", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{}"
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.ok === false) {
            throw new Error((data && data.error) || ("Start failed HTTP " + res.status));
        }
        return data;
    }

    async stopComfy() {
        if (!this._bridgeAllowed()) throw new Error("Asset bridge is local-dev only");
        const res = await fetch(this.baseUrl + "/api/comfy/stop", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{}"
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.ok === false) {
            throw new Error((data && data.error) || ("Stop failed HTTP " + res.status));
        }
        return data;
    }

    /** Start/stop the :8787 bridge via the local game dev-server (tools/dev-server.py). */
    async startBridgeViaDevServer() {
        const res = await fetch("/__asset-bridge/start", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{}"
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.ok === false) {
            throw new Error((data && data.error) || ("Bridge start HTTP " + res.status));
        }
        this._offlineUntil = 0;
        return data;
    }

    async stopBridgeViaDevServer() {
        const res = await fetch("/__asset-bridge/stop", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{}"
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.ok === false) {
            throw new Error((data && data.error) || ("Bridge stop HTTP " + res.status));
        }
        this._offlineUntil = 0;
        return data;
    }

    /**
     * DevMode switch: ensure Bridge (:8787) + ComfyUI are up, or shut Comfy (+ Bridge) down.
     * @param {boolean} on
     */
    async setComfyStack(on) {
        if (!this._bridgeAllowed()) throw new Error("Asset bridge is local-dev only");
        if (on) {
            let h = await this.health(true);
            if (!h || !h.ok) {
                await this.startBridgeViaDevServer();
                for (let i = 0; i < 12; i++) {
                    await new Promise((r) => setTimeout(r, 250));
                    h = await this.health(true);
                    if (h && h.ok) break;
                }
            }
            if (!h || !h.ok) throw new Error("Bridge still offline after start");
            if (!h.comfy) {
                await this.startComfy();
                for (let i = 0; i < 20; i++) {
                    await new Promise((r) => setTimeout(r, 400));
                    h = await this.health(true);
                    if (h && h.ok && h.comfy) break;
                }
            }
            return h;
        }
        try {
            const h = await this.health(true);
            if (h && h.ok) await this.stopComfy();
        } catch (e) { /* bridge already down */ }
        try {
            await this.stopBridgeViaDevServer();
        } catch (e) { /* optional — game may not be on tools/dev-server.py */ }
        return this.health(true);
    }

    async setComfyConfig(cfg) {
        if (!this._bridgeAllowed()) throw new Error("Asset bridge is local-dev only");
        const res = await fetch(this.baseUrl + "/api/comfy/config", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(cfg || {})
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.ok === false) {
            throw new Error((data && data.error) || ("Config failed HTTP " + res.status));
        }
        return data;
    }

    /**
     * @param {object} entry registry entry
     * @param {string|object} promptOrOpts prompt string OR { prompt, size, genSize, steps, seed, prependStyle }
     * @param {number} [seed] legacy seed arg
     */
    async generate(entry, promptOrOpts, seed) {
        let opts = {};
        if (promptOrOpts && typeof promptOrOpts === "object" && !Array.isArray(promptOrOpts)) {
            opts = promptOrOpts;
        } else {
            opts = { prompt: promptOrOpts, seed: seed };
        }
        const prompt = (opts.prompt != null && String(opts.prompt).trim())
            ? String(opts.prompt).trim()
            : (entry.promptSuffix || "");
        const mode = opts.mode || (entry && entry.type === "portrait" ? "portrait" : "sprite");
        const body = {
            prompt: prompt,
            filenamePrefix: entry.filenamePrefix,
            size: opts.size != null ? Number(opts.size) : (entry.size || 64),
            genSize: opts.genSize != null ? Number(opts.genSize) : 512,
            steps: opts.steps != null ? Number(opts.steps) : 4,
            mode: mode
        };
        if (opts.prependStyle === false) body.prependStyle = false;
        if (opts.colors != null) {
            const maxC = mode === "portrait" ? 48 : 15;
            body.colors = Math.max(2, Math.min(maxC, Number(opts.colors) || (mode === "portrait" ? 24 : 15)));
        }
        if (opts.bgColor) body.bgColor = String(opts.bgColor);
        if (opts.referenceDataUrl) body.referenceDataUrl = String(opts.referenceDataUrl);
        if (opts.referencePath) body.referencePath = String(opts.referencePath);
        if (opts.outWidth != null) body.outWidth = Number(opts.outWidth);
        if (opts.outHeight != null) body.outHeight = Number(opts.outHeight);
        const seedVal = opts.seed != null ? opts.seed : seed;
        if (seedVal != null && seedVal !== "") body.seed = Number(seedVal);
        if (!this._bridgeAllowed()) throw new Error("Asset bridge is local-dev only");
        const res = await fetch(this.baseUrl + "/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) {
            throw new Error((data && data.error) || ("Generate failed HTTP " + res.status));
        }
        return data;
    }

    async accept(stagingId, targetPath) {
        if (!this._bridgeAllowed()) throw new Error("Asset bridge is local-dev only");
        const res = await fetch(this.baseUrl + "/api/accept", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ stagingId: stagingId, targetPath: targetPath })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) {
            throw new Error((data && data.error) || ("Accept failed HTTP " + res.status));
        }
        return data;
    }

    /**
     * Write a JSON object to a repo path under assets/ (bridge only).
     * @param {string} targetPath e.g. assets/meta/sprite-meta.json
     * @param {object} data
     */
    async writeJson(targetPath, data) {
        if (!this._bridgeAllowed()) throw new Error("Asset bridge is local-dev only");
        const res = await fetch(this.baseUrl + "/api/write-json", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ targetPath: targetPath, data: data })
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || body.ok === false) {
            throw new Error((body && body.error) || ("writeJson HTTP " + res.status));
        }
        return body;
    }

    /**
     * Write a PNG (data URL) to a repo path under assets/ (bridge only).
     * @param {string} targetPath e.g. assets/modules/sprites/mount_player_control.png
     * @param {string} dataUrl data:image/png;base64,...
     */
    async writePng(targetPath, dataUrl) {
        if (!this._bridgeAllowed()) throw new Error("Asset bridge is local-dev only");
        const res = await fetch(this.baseUrl + "/api/write-png", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ targetPath: targetPath, dataUrl: dataUrl })
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || body.ok === false) {
            throw new Error((body && body.error) || ("writePng HTTP " + res.status));
        }
        return body;
    }
}

const assetGenClient = new AssetGenClient();
window.AssetGenClient = AssetGenClient;
window.assetGenClient = assetGenClient;
