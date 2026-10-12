"use strict";

// AssetGenUI methods, split from asset-gen-ui.js.
extendClass(AssetGenUI, {
    clearStaging() {
        this.stagingId = null;
        this.previewDataUrl = null;
    },

    setStatus(msg) {
        this.statusText = msg || "";
        const el = this.overlay && this.overlay.querySelector("#agStatus");
        if (el) el.textContent = this.statusText;
    },

    async refreshHealth() {
        const h = await assetGenClient.health();
        if (!h.ok) {
            this.setStatus(h.error || "Bridge offline — npm run assets");
            return;
        }
        if (!h.comfy) {
            this.setStatus("Bridge OK · ComfyUI offline — Settings → START COMFYUI");
            return;
        }
        this.setStatus("Bridge OK · ComfyUI OK · Flux2 Klein ready");
    },

    async refreshComfyStatusLine() {
        const el = this.overlay && this.overlay.querySelector("#agComfyStatusLine");
        if (!el) return;
        el.textContent = "ComfyUI: checking…";
        el.className = "ag-status";
        try {
            const h = await assetGenClient.health();
            if (!h.ok) {
                el.textContent = "Bridge offline · run: npm run assets";
                el.classList.add("ag-comfy-off");
                return;
            }
            const st = h.comfyStatus || await assetGenClient.comfyStatus();
            this._comfyStatus = st;
            // Adopt discovered port/root from bridge so UI matches live Comfy
            if (st && st.port) {
                const discovered = Number(st.port);
                if (discovered && discovered !== Number(this.renderSettings.comfyPort)) {
                    this.renderSettings.comfyPort = discovered;
                    this.saveRenderSettings();
                    const portInput = this.overlay.querySelector("#agSetComfyPort");
                    if (portInput) portInput.value = String(discovered);
                    this.updateHintPorts();
                }
            }
            if (st.running) {
                el.textContent = "ComfyUI ONLINE · " + (st.url || "") + (st.pid ? (" · pid " + st.pid) : "");
                el.classList.add("ag-comfy-on");
            } else {
                el.textContent = "ComfyUI OFFLINE · " + (st.url || "") + " · press START COMFYUI";
                el.classList.add("ag-comfy-off");
            }
            if (st.rootExists === false) el.textContent += " · root missing";
        } catch (e) {
            el.textContent = "Status error · " + String(e && e.message || e);
            el.classList.add("ag-comfy-off");
        }
    },

    async pushComfyConfigToBridge() {
        this.readSettingsFromForm();
        // Never push stale 8188 while Quicky Comfy is known to use 6767
        const root = String(this.renderSettings.comfyRoot || "");
        if (root.indexOf("/mnt/quicky2/") === 0 && Number(this.renderSettings.comfyPort) === 8188) {
            this.renderSettings.comfyPort = 6767;
            const portInput = this.overlay && this.overlay.querySelector("#agSetComfyPort");
            if (portInput) portInput.value = "6767";
        }
        this.saveRenderSettings();
        return assetGenClient.setComfyConfig({
            host: this.renderSettings.comfyHost,
            port: this.renderSettings.comfyPort,
            root: this.renderSettings.comfyRoot,
            autoStartComfy: this.renderSettings.autoStartComfy
        });
    },

    async onComfyStart() {
        this.setStatus("Starting ComfyUI…");
        try {
            await this.pushComfyConfigToBridge();
            const r = await assetGenClient.startComfy();
            this.setStatus(r.message || (r.already ? "ComfyUI already running" : "ComfyUI started"));
            await this.refreshComfyStatusLine();
            await this.refreshHealth();
        } catch (e) {
            this.setStatus("Start failed · " + String(e && e.message || e) + " · bridge? npm run assets");
            await this.refreshComfyStatusLine();
        }
    },

    async onComfyStop() {
        this.setStatus("Stopping ComfyUI…");
        try {
            const r = await assetGenClient.stopComfy();
            this.setStatus(r.message || "ComfyUI stopped");
            await this.refreshComfyStatusLine();
            await this.refreshHealth();
        } catch (e) {
            this.setStatus("Stop failed · " + String(e && e.message || e));
            await this.refreshComfyStatusLine();
        }
    },

    drawCurrentPreview(entry) {
        const box = this.overlay.querySelector("#agCurrent");
        if (!box) return;
        box.innerHTML = "";
        if (!entry) return;
        this.drawThumbInto(box, entry, Math.min(168, Math.max(48, (entry.size || 32) * 4)));
    },

    renderDetail() {
        if (!this.overlay || this.mainTab !== "library") return;
        const entry = this.currentEntry();
        const prompt = this.overlay.querySelector("#agPrompt");
        if (entry && prompt && document.activeElement !== prompt) {
            prompt.value = entry.promptSuffix || "";
        }
        this.drawCurrentPreview(entry);
        const gen = this.overlay.querySelector("#agGenerated");
        if (!gen) return;
        gen.innerHTML = "";
        if (this.previewDataUrl) {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                canvas.width = img.naturalWidth || img.width;
                canvas.height = img.naturalHeight || img.height;
                const ctx = canvas.getContext("2d");
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(img, 0, 0);
                this.desaturateCanvas(canvas);
                gen.innerHTML = "";
                gen.appendChild(canvas);
            };
            img.onerror = () => {
                const fallback = document.createElement("img");
                fallback.src = this.previewDataUrl;
                gen.appendChild(fallback);
            };
            img.src = this.previewDataUrl;
        } else {
            const miss = document.createElement("span");
            miss.textContent = "(generate)";
            miss.style.color = "#666";
            gen.appendChild(miss);
        }
    },

    renderSettingsPanel() {
        if (!this.overlay) return;
        const s = this.renderSettings;
        const comfyGrid = this.overlay.querySelector("#agComfyGrid");
        if (comfyGrid) {
            comfyGrid.innerHTML = `
<div class="ag-field">
  <label>BRIDGE URL</label>
  <input type="text" id="agSetBridgeUrl">
</div>
<div class="ag-field">
  <label>COMFY HOST</label>
  <input type="text" id="agSetComfyHost">
</div>
<div class="ag-field">
  <label>COMFY PORT</label>
  <input type="number" id="agSetComfyPort" min="1" max="65535" step="1">
</div>
<div class="ag-field">
  <label>COMFY ROOT</label>
  <input type="text" id="agSetComfyRoot">
</div>
<div class="ag-field ag-field-check">
  <input type="checkbox" id="agSetAutoStartComfy">
  <label for="agSetAutoStartComfy">Auto-start ComfyUI on GENERATE if offline</label>
</div>`;
            comfyGrid.querySelector("#agSetBridgeUrl").value = s.bridgeUrl || "http://127.0.0.1:8787";
            comfyGrid.querySelector("#agSetComfyHost").value = s.comfyHost || "127.0.0.1";
            comfyGrid.querySelector("#agSetComfyPort").value = String(s.comfyPort || 6767);
            comfyGrid.querySelector("#agSetComfyRoot").value = s.comfyRoot || "";
            comfyGrid.querySelector("#agSetAutoStartComfy").checked = !!s.autoStartComfy;
        }
        this.fillRenderSettingsGrid(this.overlay.querySelector("#agSettingsGrid"), "agSet");
        this.fillRenderSettingsGrid(this.overlay.querySelector("#agLibraryRenderGrid"), "agLib");
    },

    fillRenderSettingsGrid(grid, prefix) {
        if (!grid) return;
        const s = this.renderSettings;
        const p = prefix || "agSet";
        grid.innerHTML = `
<div class="ag-field">
  <label>OUTPUT SIZE (PNG)</label>
  <select id="${p}OutSize">
    <option value="16">16</option>
    <option value="32">32</option>
    <option value="64">64</option>
    <option value="128">128</option>
  </select>
</div>
<div class="ag-field">
  <label>GEN SIZE (FLUX)</label>
  <select id="${p}GenSize">
    <option value="256">256</option>
    <option value="512">512</option>
    <option value="768">768</option>
    <option value="1024">1024</option>
  </select>
</div>
<div class="ag-field">
  <label>COLORS (base grays, excl. BG)</label>
  <input type="number" id="${p}Colors" min="2" max="15" step="1">
</div>
<div class="ag-field">
  <label>BG (chroma key)</label>
  <input type="color" id="${p}Bg" value="#FF00FF">
</div>
<div class="ag-field">
  <label>STEPS</label>
  <input type="number" id="${p}Steps" min="1" max="12" step="1">
</div>
<div class="ag-field">
  <label>SEED (empty = random)</label>
  <input type="text" id="${p}Seed" placeholder="random">
</div>
<div class="ag-field ag-field-check">
  <input type="checkbox" id="${p}UseEntrySize">
  <label for="${p}UseEntrySize">Prefer entry default size when set</label>
</div>
<div class="ag-field ag-field-check">
  <input type="checkbox" id="${p}AutoAccept">
  <label for="${p}AutoAccept">Auto-accept each item in GENERATE CHECKED</label>
</div>
<div class="ag-field ag-field-check">
  <input type="checkbox" id="${p}Style">
  <label for="${p}Style">Prepend grayscale style prefix (output always force-gray)</label>
</div>`;
        grid.querySelector("#" + p + "OutSize").value = String(s.outSize);
        grid.querySelector("#" + p + "GenSize").value = String(s.genSize);
        grid.querySelector("#" + p + "Colors").value = String(s.colors != null ? s.colors : 15);
        grid.querySelector("#" + p + "Bg").value = String(s.bgColor || "#FF00FF");
        grid.querySelector("#" + p + "Steps").value = String(s.steps);
        grid.querySelector("#" + p + "Seed").value = s.seed != null ? String(s.seed) : "";
        grid.querySelector("#" + p + "UseEntrySize").checked = !!s.useEntrySize;
        grid.querySelector("#" + p + "AutoAccept").checked = !!s.autoAcceptBatch;
        grid.querySelector("#" + p + "Style").checked = !!s.prependStyle;
    },

    renderSettingsPrefix() {
        if (!this.overlay) return null;
        if (this.mainTab === "library" && this.overlay.querySelector("#agLibOutSize")) return "agLib";
        if (this.overlay.querySelector("#agSetOutSize")) return "agSet";
        if (this.overlay.querySelector("#agLibOutSize")) return "agLib";
        return null;
    },
});
