"use strict";

/**
 * Client for the local Asset-Gen Bridge (ComfyUI Flux).
 */
class AssetGenClient {
    constructor() {
        this.baseUrl = "http://127.0.0.1:8787";
    }

    setBaseUrl(url) {
        if (url) this.baseUrl = String(url).replace(/\/$/, "");
    }

    async health() {
        try {
            const res = await fetch(this.baseUrl + "/api/health", { method: "GET" });
            if (!res.ok) return { ok: false, error: "HTTP " + res.status };
            return await res.json();
        } catch (e) {
            return {
                ok: false,
                error: "Bridge unreachable. Run: npm run assets",
                detail: String(e && e.message || e)
            };
        }
    }

    async comfyStatus() {
        const res = await fetch(this.baseUrl + "/api/comfy/status", { method: "GET" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((data && data.error) || ("Status HTTP " + res.status));
        return data;
    }

    async startComfy() {
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

    async setComfyConfig(cfg) {
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
        const body = {
            prompt: prompt,
            filenamePrefix: entry.filenamePrefix,
            size: opts.size != null ? Number(opts.size) : (entry.size || 64),
            genSize: opts.genSize != null ? Number(opts.genSize) : 512,
            steps: opts.steps != null ? Number(opts.steps) : 4
        };
        if (opts.prependStyle === false) body.prependStyle = false;
        if (opts.colors != null) body.colors = Math.max(2, Math.min(15, Number(opts.colors) || 15));
        if (opts.bgColor) body.bgColor = String(opts.bgColor);
        const seedVal = opts.seed != null ? opts.seed : seed;
        if (seedVal != null && seedVal !== "") body.seed = Number(seedVal);
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
