"use strict";

// AssetGenUI methods, split from asset-gen-ui.js.
extendClass(AssetGenUI, {
    readSettingsFromForm() {
        if (!this.overlay) return;
        const g = this.overlay;
        const prefix = this.renderSettingsPrefix();
        if (!prefix) return;
        const outEl = g.querySelector("#" + prefix + "OutSize");
        if (!outEl) return;
        const outSize = parseInt(outEl.value, 10);
        const genSize = parseInt(g.querySelector("#" + prefix + "GenSize").value, 10);
        const colorsRaw = parseInt(g.querySelector("#" + prefix + "Colors").value, 10);
        const bgRaw = String(g.querySelector("#" + prefix + "Bg").value || "#FF00FF").trim();
        const steps = parseInt(g.querySelector("#" + prefix + "Steps").value, 10);
        const seedRaw = String(g.querySelector("#" + prefix + "Seed").value || "").trim();
        const bridgeUrl = g.querySelector("#agSetBridgeUrl")
            ? String(g.querySelector("#agSetBridgeUrl").value || "").trim()
            : (this.renderSettings.bridgeUrl || "http://127.0.0.1:8787");
        const comfyHost = g.querySelector("#agSetComfyHost")
            ? String(g.querySelector("#agSetComfyHost").value || "").trim()
            : (this.renderSettings.comfyHost || "127.0.0.1");
        const comfyPort = g.querySelector("#agSetComfyPort")
            ? parseInt(g.querySelector("#agSetComfyPort").value, 10)
            : this.renderSettings.comfyPort;
        const comfyRoot = g.querySelector("#agSetComfyRoot")
            ? String(g.querySelector("#agSetComfyRoot").value || "").trim()
            : this.renderSettings.comfyRoot;
        const autoStartComfy = g.querySelector("#agSetAutoStartComfy")
            ? !!g.querySelector("#agSetAutoStartComfy").checked
            : !!this.renderSettings.autoStartComfy;
        this.renderSettings = {
            outSize: [16, 32, 64, 128].indexOf(outSize) >= 0 ? outSize : 64,
            genSize: [256, 512, 768, 1024].indexOf(genSize) >= 0 ? genSize : 512,
            colors: Math.max(2, Math.min(15, colorsRaw || 15)),
            bgColor: /^#[0-9A-Fa-f]{6}$/.test(bgRaw) ? bgRaw.toUpperCase() : "#FF00FF",
            steps: Math.max(1, Math.min(12, steps || 4)),
            seed: seedRaw === "random" ? "" : seedRaw,
            useEntrySize: !!g.querySelector("#" + prefix + "UseEntrySize").checked,
            autoAcceptBatch: !!g.querySelector("#" + prefix + "AutoAccept").checked,
            prependStyle: !!g.querySelector("#" + prefix + "Style").checked,
            bridgeUrl: bridgeUrl || "http://127.0.0.1:8787",
            comfyHost: comfyHost || "127.0.0.1",
            comfyPort: Number.isFinite(comfyPort) ? comfyPort : 6767,
            comfyRoot: comfyRoot,
            autoStartComfy: autoStartComfy
        };
        this.applyClientConfig();
    },

    buildGenerateOptions(entry, promptOverride) {
        if (this.overlay && this.renderSettingsPrefix()) {
            this.readSettingsFromForm();
        }
        const s = this.renderSettings;
        const size = (s.useEntrySize && entry && entry.size) ? entry.size : s.outSize;
        const opts = {
            size: size,
            genSize: s.genSize,
            steps: s.steps,
            prependStyle: s.prependStyle,
            colors: s.colors != null ? s.colors : 15,
            bgColor: s.bgColor || "#FF00FF"
        };
        if (s.seed !== "" && s.seed != null) opts.seed = Number(s.seed);
        if (promptOverride != null) opts.prompt = promptOverride;
        return opts;
    },

    async acceptResult(entry, stagingId) {
        const result = await assetGenClient.accept(stagingId, entry.targetPath);
        const key = entry.spriteKey || entry.id;
        if (typeof spriteLoader !== "undefined" && spriteLoader.reloadSprite) {
            await spriteLoader.reloadSprite(key, result.url);
        }
        if (typeof iconRenderer !== "undefined" && iconRenderer.clearCache) {
            iconRenderer.clearCache();
        }
        window.dispatchEvent(new CustomEvent("vf-asset-accepted", {
            detail: { entry: entry, path: result.path, url: result.url, key: key }
        }));
        return result;
    },

    async onGenerate() {
        const entry = this.currentEntry();
        if (!entry || this.busy) return;
        this.busy = true;
        this.setStatus("Generating via Flux2…");
        try {
            const prompt = this.overlay.querySelector("#agPrompt").value;
            const opts = this.buildGenerateOptions(entry, prompt);
            const result = await assetGenClient.generate(entry, opts);
            this.stagingId = result.stagingId;
            this.previewDataUrl = await this.dataUrlToGrayDataUrl(result.previewDataUrl) || result.previewDataUrl;
            this.setStatus("Ready · seed " + result.seed + " · Accept to apply");
            this.renderDetail();
            this.renderList();
        } catch (e) {
            this.setStatus(String(e && e.message || e));
        } finally {
            this.busy = false;
        }
    },

    async onGenerateChecked() {
        let list = this.checkedEntries();
        if (!list.length) {
            const cur = this.currentEntry();
            if (cur) list = [cur];
        }
        if (!list.length || this.busy) {
            this.setStatus("Check one or more assets first.");
            return;
        }
        this.busy = true;
        const auto = !!this.renderSettings.autoAcceptBatch;
        let ok = 0;
        let fail = 0;
        try {
            for (let i = 0; i < list.length; i++) {
                const entry = list[i];
                this.selectedId = entry.id;
                this.renderList();
                this.renderDetail();
                this.setStatus("Generating " + (i + 1) + "/" + list.length + " · " + entry.label);
                try {
                    const opts = this.buildGenerateOptions(entry, entry.promptSuffix);
                    const result = await assetGenClient.generate(entry, opts);
                    this.stagingId = result.stagingId;
                    this.previewDataUrl = await this.dataUrlToGrayDataUrl(result.previewDataUrl) || result.previewDataUrl;
                    this.renderDetail();
                    if (auto) {
                        await this.acceptResult(entry, result.stagingId);
                        this.clearStaging();
                    }
                    ok += 1;
                } catch (err) {
                    fail += 1;
                    this.setStatus("Failed · " + entry.label + " · " + String(err && err.message || err));
                }
            }
            this.renderList();
            this.renderDetail();
            this.setStatus(
                "Batch done · ok " + ok + (fail ? (" · fail " + fail) : "")
                + (auto ? " · auto-accepted" : " · last result staged — Accept")
            );
        } finally {
            this.busy = false;
        }
    },

    async onAccept() {
        const entry = this.currentEntry();
        if (!entry || !this.stagingId || this.busy) {
            this.setStatus("Generate first, then Accept.");
            return;
        }
        this.busy = true;
        this.setStatus("Writing PNG…");
        try {
            const result = await this.acceptResult(entry, this.stagingId);
            this.clearStaging();
            this.setStatus("Accepted → " + result.path);
            this.renderDetail();
            this.renderList();
        } catch (e) {
            this.setStatus(String(e && e.message || e));
        } finally {
            this.busy = false;
        }
    },
});
