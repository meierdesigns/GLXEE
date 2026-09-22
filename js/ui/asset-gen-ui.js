"use strict";

/**
 * In-game Asset Generator UI — open with # or Settings → ASSETS.
 * Multi-select + batch render, thumbnails with hover zoom, render settings tab.
 */
class AssetGenUI {
    constructor() {
        this.visible = false;
        this.overlay = null;
        this.typeId = "mount";
        this.selectedId = null;
        this.checkedIds = new Set();
        this.stagingId = null;
        this.previewDataUrl = null;
        this.busy = false;
        this.statusText = "";
        this.mainTab = "library"; // library | settings
        this.returnToSettings = true;
        this.factionCategory = this.loadFactionCategory();
        this.factionFilterText = "";
        this._pointerX = 0;
        this._pointerY = 0;
        this._hoverZoomEl = null;
        this._keyHandler = (e) => this.handleKeyDown(e);
        this._pointerHandler = (e) => {
            this._pointerX = e.clientX;
            this._pointerY = e.clientY;
        };
        this.renderSettings = this.loadRenderSettings();
        this.applyClientConfig();
        // Persist migrated Quicky defaults (6767) so form never reloads 8188
        try {
            if (Number(this.renderSettings.comfyPort) === 6767) {
                localStorage.setItem("vf_asset_gen_settings_v1", JSON.stringify(this.renderSettings));
            }
        } catch (e) { /* ignore */ }
        this._comfyStatus = null;
        this._ensureStyles();
        document.addEventListener("mousemove", this._pointerHandler, true);
    }

    persistMenuState() {
        if (typeof menuStateManager === "undefined" || !this.visible) return;
        menuStateManager.setScreen("asset-gen", {
            typeId: this.typeId || "mount",
            mainTab: this.mainTab || "library",
            selectedId: this.selectedId || null,
            returnToSettings: !!this.returnToSettings,
            factionCategory: this.factionCategory || "all"
        });
    }

    loadFactionCategory() {
        try {
            const v = localStorage.getItem("vf_asset_gen_faction_category");
            if (v) return v;
        } catch (e) { /* ignore */ }
        return "all";
    }

    saveFactionCategory() {
        try {
            localStorage.setItem("vf_asset_gen_faction_category", this.factionCategory || "all");
        } catch (e) { /* ignore */ }
    }

    normalizeTypeId(typeId) {
        if (typeId === "factionShip") return "faction";
        return typeId;
    }

    defaultRenderSettings() {
        let colors = 15;
        let bgColor = "#FF00FF";
        try {
            const c = parseInt(localStorage.getItem("vf_pixel_colors"), 10);
            if (c >= 2 && c <= 15) colors = c;
            const bg = localStorage.getItem("vf_pixel_bg");
            if (bg && /^#[0-9A-Fa-f]{6}$/.test(bg)) bgColor = bg.toUpperCase();
        } catch (e) { /* ignore */ }
        return {
            outSize: 64,
            genSize: 512,
            steps: 4,
            seed: "",
            colors: colors,
            bgColor: bgColor,
            autoAcceptBatch: true,
            useEntrySize: true,
            prependStyle: true,
            bridgeUrl: "http://127.0.0.1:8787",
            comfyHost: "127.0.0.1",
            comfyPort: 6767,
            comfyRoot: "/mnt/quicky2/stability-matrix/Data/Packages/ComfyUI",
            autoStartComfy: true
        };
    }

    loadRenderSettings() {
        const base = this.defaultRenderSettings();
        try {
            const raw = localStorage.getItem("vf_asset_gen_settings_v1");
            if (!raw) return base;
            const parsed = JSON.parse(raw);
            const merged = Object.assign({}, base, parsed || {});
            // Quicky machine: always prefer Stability Matrix port 6767 over stale 8188
            const root = String(merged.comfyRoot || "");
            if (root.indexOf("/mnt/quicky2/") === 0) {
                if (!merged.comfyPort || Number(merged.comfyPort) === 8188) {
                    merged.comfyPort = 6767;
                }
                if (!merged.comfyRoot || merged.comfyRoot === "/mnt/quicky2/stability-matrix") {
                    merged.comfyRoot = base.comfyRoot;
                }
            }
            return merged;
        } catch (e) {
            return base;
        }
    }

    saveRenderSettings() {
        try {
            localStorage.setItem("vf_asset_gen_settings_v1", JSON.stringify(this.renderSettings));
            if (this.renderSettings.colors != null) {
                localStorage.setItem("vf_pixel_colors", String(this.renderSettings.colors));
            }
            if (this.renderSettings.bgColor) {
                localStorage.setItem("vf_pixel_bg", String(this.renderSettings.bgColor).toUpperCase());
            }
        } catch (e) {
            /* ignore */
        }
        if (typeof assetGenClient !== "undefined" && assetGenClient.setBaseUrl) {
            assetGenClient.setBaseUrl(this.renderSettings.bridgeUrl || "http://127.0.0.1:8787");
        }
        this.updateHintPorts();
    }

    updateHintPorts() {
        if (!this.overlay) return;
        const hint = this.overlay.querySelector(".ag-hint");
        if (!hint) return;
        const bridge = this.renderSettings.bridgeUrl || "http://127.0.0.1:8787";
        let bridgePort = "8787";
        try {
            bridgePort = String(new URL(bridge).port || "8787");
        } catch (e) { /* keep */ }
        const comfyPort = this.renderSettings.comfyPort || 6767;
        hint.textContent =
            "Menu → ASSETS · Settings → ASSETS · # toggle · multi-select + GENERATE · Esc close · Bridge :" +
            bridgePort + " · ComfyUI :" + comfyPort;
    }

    applyClientConfig() {
        if (typeof assetGenClient !== "undefined" && assetGenClient.setBaseUrl) {
            assetGenClient.setBaseUrl(this.renderSettings.bridgeUrl || "http://127.0.0.1:8787");
        }
    }

    _ensureStyles() {
        const existing = document.getElementById("ag-styles");
        if (existing) existing.remove();
        const style = document.createElement("style");
        style.id = "ag-styles";
        style.textContent = `
.ag-overlay{
  position:fixed;inset:0;z-index:10050;
  display:flex;align-items:center;justify-content:center;
  background-color:#000;
  background-image:
    linear-gradient(
      to bottom,
      rgba(0,0,0,.50) 0%,
      rgba(0,0,0,.34) 40%,
      rgba(0,0,0,.62) 100%
    ),
    url('assets/ui/hs-bg-craft.png');
  background-size:cover;
  background-position:center center;
  background-repeat:no-repeat;
  image-rendering:pixelated;
  image-rendering:crisp-edges;
  font-family:var(--ui-font-family,'Courier New',Courier,monospace);
  color:var(--color-text,#e0e0e0);
  -webkit-font-smoothing:none;
}
.ag-panel{
  position:relative;
  width:min(1100px,98vw);height:min(92vh,900px);max-height:96vh;
  display:flex;flex-direction:column;overflow:hidden;
  background:
    linear-gradient(165deg,
      color-mix(in srgb,var(--color-primary,#808080) 8%,rgba(8,8,10,.92)) 0%,
      rgba(8,8,10,.94) 55%);
  border:var(--ui-border-width-thick,3px) solid var(--color-primary,#808080);
  border-radius:0;box-sizing:border-box;
  padding:clamp(10px,1.4vh,16px) clamp(12px,1.4vw,18px) clamp(8px,1.2vh,12px);
  box-shadow:
    inset 0 0 0 2px color-mix(in srgb,var(--color-primary,#808080) 28%,transparent),
    0 0 22px color-mix(in srgb,var(--color-primary,#808080) 18%,transparent);
  color:var(--color-text,#e0e0e0);
  backdrop-filter:blur(2px);
}
.ag-panel::after{
  content:"";pointer-events:none;position:absolute;inset:0;z-index:2;
  background:repeating-linear-gradient(
    to bottom,
    transparent 0,transparent 2px,
    rgba(0,0,0,.12) 2px,rgba(0,0,0,.12) 3px);
  opacity:.55;
}
.ag-panel>*{position:relative;z-index:3}
.ag-title{
  margin:0 0 4px;flex:0 0 auto;text-align:center;
  font-size:var(--font-h2,14px);letter-spacing:.18em;text-transform:uppercase;
  color:var(--color-primary,#a0a0a0);
  text-shadow:0 0 10px color-mix(in srgb,var(--color-primary,#808080) 35%,transparent);
}
.ag-hint{
  margin:0 0 10px;flex:0 0 auto;text-align:center;
  font-size:var(--font-text,12px);line-height:1.35;
  color:var(--color-text-secondary,#888);opacity:.85;
}
.ag-row{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;align-items:center}
.ag-tabs{display:flex;gap:6px;margin-bottom:10px;flex:0 0 auto;justify-content:center}
.ag-tabs button,.ag-types button,.ag-actions button,.ag-toolbar button{
  background:color-mix(in srgb,var(--color-primary,#808080) 8%,var(--color-surface,#161616));
  border:var(--ui-border-width-thin,1px) solid color-mix(in srgb,var(--color-primary,#808080) 45%,var(--color-border,#444));
  color:var(--color-text,#ddd);
  padding:6px 10px;cursor:pointer;font:inherit;letter-spacing:.06em;border-radius:0;
  image-rendering:pixelated;
}
.ag-tabs button:hover,.ag-types button:hover,.ag-actions button:hover,.ag-toolbar button:hover,.ag-list-item:hover{
  border-color:var(--color-primary,#808080);
  background:color-mix(in srgb,var(--color-primary,#808080) 14%,var(--color-surface,#161616));
  color:var(--color-text,#fff);
}
.ag-tabs button.ag-on,.ag-types button.ag-on,.ag-list-item.ag-on{
  border-color:var(--color-primary,#808080);
  background:color-mix(in srgb,var(--color-primary,#808080) 22%,var(--color-background,#0a0a0a));
  color:var(--color-primary,#fff);
  box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--color-primary,#808080) 35%,transparent);
}
.ag-body{flex:1 1 auto;min-height:0;display:flex;flex-direction:column}
.ag-library{display:flex;flex-direction:column;gap:8px;flex:1;min-height:0}
.ag-library[hidden],.ag-settings[hidden]{display:none!important}
.ag-col{display:flex;gap:10px;flex:1;min-height:0;align-items:stretch}
.ag-list-wrap{
  display:flex;flex-direction:column;min-width:260px;flex:1.1;min-height:0;
  border:var(--ui-border-width,2px) solid color-mix(in srgb,var(--color-primary,#808080) 35%,var(--color-border,#333));
  background:var(--color-background,#0a0a0a);
  box-shadow:inset 0 0 18px color-mix(in srgb,var(--color-primary,#808080) 6%,transparent);
}
.ag-toolbar{
  display:flex;align-items:center;gap:10px;padding:6px 8px;flex:0 0 auto;
  border-bottom:var(--ui-border-width-thin,1px) solid color-mix(in srgb,var(--color-primary,#808080) 30%,transparent);
  font-size:var(--font-text,12px);color:var(--color-text-secondary,#999);
}
.ag-toolbar label{display:inline-flex;align-items:center;gap:6px;cursor:pointer;user-select:none}
.ag-list{display:flex;flex-direction:column;gap:2px;overflow:auto;flex:1;min-height:0;padding:6px}
.ag-list::-webkit-scrollbar{width:8px}
.ag-list::-webkit-scrollbar-track{background:var(--color-background,#0a0a0a)}
.ag-list::-webkit-scrollbar-thumb{
  background:color-mix(in srgb,var(--color-primary,#808080) 40%,#333);
  border:1px solid var(--color-border,#333);
}
.ag-list-item{
  display:flex;align-items:center;gap:8px;text-align:left;
  background:transparent;border:1px solid transparent;
  color:var(--color-text-secondary,#bbb);
  padding:4px 6px;cursor:pointer;font:inherit;font-size:var(--font-text,12px);
  width:100%;box-sizing:border-box;letter-spacing:.04em;border-radius:0;
}
.ag-list-item input[type=checkbox]{
  flex:0 0 auto;width:12px;height:12px;margin:0;
  appearance:none;-webkit-appearance:none;
  border:1px solid var(--color-primary,#808080);
  background:var(--color-background,#0a0a0a);
  accent-color:var(--color-primary,#808080);cursor:pointer;border-radius:0;
}
.ag-list-item input[type=checkbox]:checked{
  background:var(--color-primary,#808080);
  box-shadow:inset 0 0 0 2px var(--color-background,#0a0a0a);
}
.ag-thumb{
  width:28px;height:28px;flex:0 0 auto;
  border:1px solid color-mix(in srgb,var(--color-primary,#808080) 40%,var(--color-border,#444));
  background:
    linear-gradient(45deg,color-mix(in srgb,var(--color-surface,#222) 80%,#000) 25%,transparent 25%),
    linear-gradient(-45deg,color-mix(in srgb,var(--color-surface,#222) 80%,#000) 25%,transparent 25%),
    linear-gradient(45deg,transparent 75%,color-mix(in srgb,var(--color-surface,#222) 80%,#000) 75%),
    linear-gradient(-45deg,transparent 75%,color-mix(in srgb,var(--color-surface,#222) 80%,#000) 75%),
    var(--color-background,#0a0a0a);
  background-size:8px 8px;background-position:0 0,0 4px,4px -4px,-4px 0;
  image-rendering:pixelated;display:flex;align-items:center;justify-content:center;overflow:hidden;
}
.ag-thumb canvas,.ag-thumb img{width:100%;height:100%;object-fit:contain;image-rendering:pixelated;pointer-events:none}
.ag-preview canvas,.ag-preview img{width:100%;height:100%;object-fit:contain;image-rendering:pixelated}
.ag-list-label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ag-faction-chrome{
  display:flex;flex-direction:column;gap:6px;flex:0 0 auto;
  padding:6px 8px 0;border-bottom:var(--ui-border-width-thin,1px) solid color-mix(in srgb,var(--color-primary,#808080) 30%,transparent);
}
.ag-faction-chrome[hidden]{display:none!important}
.ag-faction-tabs{display:flex;flex-wrap:wrap;gap:4px}
.ag-faction-tabs button{
  display:inline-flex;align-items:center;gap:5px;
  background:color-mix(in srgb,var(--color-primary,#808080) 8%,var(--color-surface,#161616));
  border:var(--ui-border-width-thin,1px) solid color-mix(in srgb,var(--color-primary,#808080) 45%,var(--color-border,#444));
  color:var(--color-text,#ddd);
  padding:4px 8px;cursor:pointer;font:inherit;font-size:11px;letter-spacing:.06em;
  text-transform:uppercase;border-radius:0;
}
.ag-faction-tabs button:hover{
  border-color:var(--color-primary,#808080);
  background:color-mix(in srgb,var(--color-primary,#808080) 14%,var(--color-surface,#161616));
}
.ag-faction-tabs button.ag-on{
  border-color:var(--ag-faction-color,var(--color-primary,#808080));
  background:color-mix(in srgb,var(--ag-faction-color,var(--color-primary,#808080)) 22%,var(--color-background,#0a0a0a));
  color:var(--ag-faction-color,var(--color-primary,#fff));
  box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--ag-faction-color,var(--color-primary,#808080)) 35%,transparent);
}
.ag-faction-tabs button[style*="--ag-faction-color"]:hover{
  border-color:var(--ag-faction-color);
  background:color-mix(in srgb,var(--ag-faction-color) 14%,var(--color-surface,#161616));
}
.ag-faction-tab-icon{
  width:14px;height:14px;flex:0 0 auto;
  border:1px solid color-mix(in srgb,var(--color-primary,#808080) 35%,transparent);
  image-rendering:pixelated;display:flex;align-items:center;justify-content:center;overflow:hidden;
}
.ag-faction-tab-icon canvas,.ag-faction-tab-icon img{width:100%;height:100%;object-fit:contain;image-rendering:pixelated}
.ag-faction-filter{
  width:100%;box-sizing:border-box;
  background:var(--color-background,#0a0a0a);
  border:var(--ui-border-width-thin,1px) solid color-mix(in srgb,var(--color-primary,#808080) 40%,var(--color-border,#444));
  color:var(--color-text,#ddd);font:inherit;font-size:11px;letter-spacing:.06em;
  padding:5px 8px;border-radius:0;text-transform:uppercase;
}
.ag-faction-filter:focus{
  outline:none;border-color:var(--color-primary,#808080);
}
.ag-ships-table{
  width:100%;border-collapse:collapse;font-size:var(--font-text,12px);
  color:var(--color-text-secondary,#bbb);
}
.ag-ships-table th{
  text-align:left;font-size:10px;letter-spacing:.1em;text-transform:uppercase;
  color:var(--color-primary,#888);padding:4px 6px;
  border-bottom:1px solid color-mix(in srgb,var(--color-primary,#808080) 35%,transparent);
  position:sticky;top:0;background:var(--color-background,#0a0a0a);z-index:1;
}
.ag-ships-table td{padding:3px 6px;border-bottom:1px solid color-mix(in srgb,var(--color-primary,#808080) 12%,transparent);vertical-align:middle}
.ag-ships-table tr.ag-on{background:color-mix(in srgb,var(--color-primary,#808080) 18%,transparent);color:var(--color-primary,#fff)}
.ag-ships-table tr:hover{background:color-mix(in srgb,var(--color-primary,#808080) 10%,transparent);cursor:pointer}
.ag-ships-table .ag-thumb{width:24px;height:24px}
.ag-ships-table input[type=checkbox]{
  width:12px;height:12px;margin:0;cursor:pointer;
  appearance:none;-webkit-appearance:none;
  border:1px solid var(--color-primary,#808080);
  background:var(--color-background,#0a0a0a);border-radius:0;
}
.ag-ships-table input[type=checkbox]:checked{
  background:var(--color-primary,#808080);
  box-shadow:inset 0 0 0 2px var(--color-background,#0a0a0a);
}
.ag-ships-kind{
  font-size:9px;letter-spacing:.08em;text-transform:uppercase;
  color:var(--color-text-secondary,#777);margin-left:4px;
}
.ag-preview-wrap{
  display:flex;flex-direction:column;gap:10px;flex:1.4;min-width:280px;min-height:0;overflow:auto;
}
.ag-preview-top{display:flex;gap:10px;flex-wrap:wrap;flex:0 0 auto;align-content:flex-start}
.ag-library-render{
  flex:1 1 auto;min-height:0;overflow:auto;
  border-top:var(--ui-border-width-thin,1px) solid color-mix(in srgb,var(--color-primary,#808080) 30%,transparent);
  padding-top:8px;
}
.ag-preview{
  width:180px;height:180px;image-rendering:pixelated;
  border:var(--ui-border-width,2px) solid color-mix(in srgb,var(--color-primary,#808080) 50%,var(--color-border,#555));
  box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--color-primary,#808080) 20%,transparent);
  background:
    linear-gradient(45deg,color-mix(in srgb,var(--color-surface,#333) 70%,#000) 25%,transparent 25%),
    linear-gradient(-45deg,color-mix(in srgb,var(--color-surface,#333) 70%,#000) 25%,transparent 25%),
    linear-gradient(45deg,transparent 75%,color-mix(in srgb,var(--color-surface,#333) 70%,#000) 75%),
    linear-gradient(-45deg,transparent 75%,color-mix(in srgb,var(--color-surface,#333) 70%,#000) 75%),
    var(--color-background,#0a0a0a);
  background-size:16px 16px;background-position:0 0,0 8px,8px -8px,-8px 0;
  display:flex;align-items:center;justify-content:center;
}
.ag-preview img,.ag-preview canvas{width:100%;height:100%;object-fit:contain;image-rendering:pixelated}
.ag-prompt{
  width:100%;min-height:96px;resize:vertical;box-sizing:border-box;
  background:var(--color-background,#0a0a0a);
  border:var(--ui-border-width-thin,1px) solid color-mix(in srgb,var(--color-primary,#808080) 40%,var(--color-border,#444));
  color:var(--color-text,#ddd);font:inherit;padding:8px;border-radius:0;
  box-shadow:inset 0 0 12px rgba(0,0,0,.35);
}
.ag-prompt:focus{
  outline:none;border-color:var(--color-primary,#808080);
  box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--color-primary,#808080) 30%,transparent);
}
.ag-status{
  font-size:var(--font-text,12px);min-height:1.2em;margin-top:8px;flex:0 0 auto;
  color:var(--color-text-secondary,#9a9a9a);letter-spacing:.04em;
  border-top:var(--ui-border-width-thin,1px) solid color-mix(in srgb,var(--color-primary,#808080) 25%,transparent);
  padding-top:6px;
}
.ag-label{
  font-size:11px;margin-right:4px;margin-bottom:4px;
  color:var(--color-primary,#888);letter-spacing:.12em;text-transform:uppercase;
}
.ag-settings{display:flex;flex-direction:column;gap:12px;overflow:auto;flex:1;min-height:0;padding:4px 2px 12px}
.ag-settings-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}
.ag-field{
  display:flex;flex-direction:column;gap:4px;padding:10px;
  border:var(--ui-border-width-thin,1px) solid color-mix(in srgb,var(--color-primary,#808080) 30%,var(--color-border,#333));
  background:color-mix(in srgb,var(--color-primary,#808080) 4%,var(--color-background,#0a0a0a));
}
.ag-field label{font-size:11px;color:var(--color-text-secondary,#888);letter-spacing:.08em;text-transform:uppercase}
.ag-field input[type=number],.ag-field input[type=text],.ag-field select{
  background:var(--color-surface,#161616);
  border:1px solid color-mix(in srgb,var(--color-primary,#808080) 35%,var(--color-border,#444));
  color:var(--color-text,#ddd);padding:6px 8px;font:inherit;border-radius:0;
}
.ag-field-check{flex-direction:row;align-items:center;gap:8px}
.ag-field-check input{width:12px;height:12px;accent-color:var(--color-primary,#808080)}
.ag-settings-note{font-size:11px;color:var(--color-text-secondary,#777);line-height:1.4;max-width:52em}
.ag-settings-note code{
  color:var(--color-primary,#aaa);
  background:color-mix(in srgb,var(--color-primary,#808080) 10%,transparent);
  padding:0 4px;
}
.ag-settings-section-title{
  font-size:12px;letter-spacing:.14em;text-transform:uppercase;
  color:var(--color-primary,#bbb);margin:8px 0 6px;
  border-bottom:var(--ui-border-width-thin,1px) solid color-mix(in srgb,var(--color-primary,#808080) 35%,transparent);
  padding-bottom:4px;
}
.ag-comfy-on{color:var(--status-success,#6ecf6e)}
.ag-comfy-off{color:var(--status-error,#c06060)}
.ag-zoom{
  position:fixed;z-index:10060;pointer-events:none;transform:translate(-50%,-50%);
  padding:8px;border-radius:0;
  background:rgba(0,0,0,.94);
  border:var(--ui-border-width,2px) solid var(--color-primary,#888);
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb,var(--color-primary,#808080) 30%,transparent),
    0 0 18px color-mix(in srgb,var(--color-primary,#808080) 25%,transparent);
}
.ag-zoom-inner{
  width:min(42vw,320px);height:min(42vw,320px);
  display:flex;align-items:center;justify-content:center;image-rendering:pixelated;
  background:
    linear-gradient(45deg,color-mix(in srgb,var(--color-surface,#333) 70%,#000) 25%,transparent 25%),
    linear-gradient(-45deg,color-mix(in srgb,var(--color-surface,#333) 70%,#000) 25%,transparent 25%),
    linear-gradient(45deg,transparent 75%,color-mix(in srgb,var(--color-surface,#333) 70%,#000) 75%),
    linear-gradient(-45deg,transparent 75%,color-mix(in srgb,var(--color-surface,#333) 70%,#000) 75%),
    var(--color-background,#0a0a0a);
  background-size:16px 16px;background-position:0 0,0 8px,8px -8px,-8px 0;
}
.ag-zoom-inner canvas,.ag-zoom-inner img{max-width:100%;max-height:100%;image-rendering:pixelated}
.ag-types{flex:0 0 auto;max-height:none}
`;
        document.head.appendChild(style);
    }

    isTypingTarget(el) {
        if (!el) return false;
        const tag = (el.tagName || "").toLowerCase();
        if (tag === "input" || tag === "textarea" || tag === "select") return true;
        if (el.isContentEditable) return true;
        return false;
    }

    resolveHoveredEntry() {
        if (typeof assetGenRegistry === "undefined" || !assetGenRegistry.findFromElement) return null;
        let el = null;
        try {
            el = document.elementFromPoint(this._pointerX, this._pointerY);
        } catch (err) {
            el = null;
        }
        if (!el) return null;
        if (this.overlay && this.overlay.contains(el)) return null;
        return assetGenRegistry.findFromElement(el);
    }

    toggle(focusEntry) {
        if (this.visible) this.hide();
        else this.show(focusEntry || null);
    }

    show(focusEntry) {
        const opts = focusEntry || null;
        const skipPersist = !!(opts && opts.skipPersist);
        if (opts && Object.prototype.hasOwnProperty.call(opts, "returnToSettings")) {
            this.returnToSettings = !!opts.returnToSettings;
        } else if (!skipPersist) {
            this.returnToSettings = !!(typeof startScreenManager !== "undefined" && startScreenManager.showSettings);
        }
        if (opts && opts.typeId && !opts.type) {
            this.typeId = this.normalizeTypeId(opts.typeId);
            this.selectedId = opts.selectedId || null;
            this.clearStaging();
            this.mainTab = opts.mainTab || "library";
            if (opts.factionCategory) this.factionCategory = opts.factionCategory;
        } else if (opts && opts.type && opts.id) {
            this.typeId = this.normalizeTypeId(opts.type);
            this.selectedId = opts.id;
            this.checkedIds.add(opts.id);
            this.clearStaging();
            this.mainTab = "library";
            if (opts.type === "factionShip" || (opts.id && String(opts.id).indexOf("enemy-") === 0)) {
                this.typeId = "faction";
                const parsed = this.parseFactionShipKey(opts.id);
                if (parsed && parsed.faction) this.factionCategory = parsed.faction;
            }
        } else if (opts && opts.mainTab) {
            this.mainTab = opts.mainTab;
            if (opts.selectedId) this.selectedId = opts.selectedId;
            if (opts.factionCategory) this.factionCategory = opts.factionCategory;
        }
        if (this.visible) {
            this.renderMainTabs();
            this.renderTypes();
            this.renderList();
            this.renderDetail();
            this.renderSettingsPanel();
            this.syncPanelVisibility();
            if (!skipPersist) this.persistMenuState();
            return;
        }
        this.visible = true;
        this.build();
        document.addEventListener("keydown", this._keyHandler, true);
        this.renderList();
        this.renderDetail();
        this.renderSettingsPanel();
        this.syncPanelVisibility();
        if (!opts || !(opts.type && opts.id)) this.refreshHealth();
        if (!skipPersist) this.persistMenuState();
        if (typeof VFBgMouseParallax !== "undefined" && VFBgMouseParallax.refresh) {
            VFBgMouseParallax.refresh();
        }
    }

    focusEntry(entry) {
        if (!entry) return;
        this.show(entry);
        this.setStatus("Focused · " + (entry.label || entry.id) + " · press GENERATE");
    }

    hide() {
        if (!this.visible) return;
        this.visible = false;
        this.hideHoverZoom();
        document.removeEventListener("keydown", this._keyHandler, true);
        if (this.overlay && this.overlay.parentNode) {
            this.overlay.parentNode.removeChild(this.overlay);
        }
        this.overlay = null;
        if (this.returnToSettings && typeof startScreenManager !== "undefined") {
            this.returnToSettings = false;
            startScreenManager.showSettings = true;
            startScreenManager.showCredits = false;
            if (startScreenManager.hasActiveProfile && startScreenManager.hasActiveProfile()
                && typeof homeStationUI !== "undefined") {
                if (!homeStationUI.isVisible) {
                    homeStationUI.show({ skipPersist: true });
                }
                startScreenManager.show({
                    asOverlay: true,
                    showSettings: true
                });
            } else {
                startScreenManager.show({ forceMenu: true });
            }
            return;
        }
        if (typeof startScreenManager !== "undefined") {
            startScreenManager.showSettings = false;
            startScreenManager.showCredits = false;
            startScreenManager.returnToHub();
            return;
        }
        if (typeof menuStateManager !== "undefined") {
            menuStateManager.setScreen("start");
        }
    }

    handleKeyDown(e) {
        if (!this.visible) return;
        if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            if (this._hoverZoomEl) {
                this.hideHoverZoom();
                return;
            }
            this.hide();
        }
    }

    build() {
        if (this.overlay) {
            this.overlay.parentNode && this.overlay.parentNode.removeChild(this.overlay);
        }
        const root = document.createElement("div");
        root.className = "ag-overlay";
        root.innerHTML = `
<div class="ag-panel">
  <h2 class="ag-title">ASSET GENERATOR · FLUX2</h2>
  <p class="ag-hint">Menu → ASSETS · Settings → ASSETS · # toggle · multi-select + GENERATE · Esc close · Bridge :8787 · ComfyUI :6767</p>
  <div class="ag-row ag-tabs" id="agMainTabs">
    <button type="button" data-tab="library">LIBRARY</button>
    <button type="button" data-tab="settings">SETTINGS</button>
  </div>
  <div class="ag-body">
    <div class="ag-library" id="agLibraryPane">
      <div class="ag-row ag-types" id="agTypes"></div>
      <div class="ag-col">
        <div class="ag-list-wrap">
          <div class="ag-faction-chrome" id="agFactionChrome" hidden>
            <div class="ag-faction-tabs" id="agFactionTabs"></div>
            <input type="search" class="ag-faction-filter" id="agFactionFilter" placeholder="FILTER SHIPS…" autocomplete="off">
          </div>
          <div class="ag-toolbar">
            <label title="Select all / none">
              <input type="checkbox" id="agSelectAll">
              <span>SELECT ALL</span>
            </label>
            <button type="button" id="agClearChecks">CLEAR</button>
            <span class="ag-label" id="agCheckCount">0 selected</span>
          </div>
          <div class="ag-list" id="agList"></div>
        </div>
        <div class="ag-preview-wrap">
          <div class="ag-preview-top">
            <div>
              <div class="ag-label">CURRENT</div>
              <div class="ag-preview" id="agCurrent"></div>
            </div>
            <div>
              <div class="ag-label">GENERATED</div>
              <div class="ag-preview" id="agGenerated"></div>
            </div>
            <div style="flex:1;min-width:220px">
              <div class="ag-label">PROMPT</div>
              <textarea class="ag-prompt" id="agPrompt"></textarea>
              <div class="ag-row ag-actions" style="margin-top:8px">
                <button type="button" id="agGenerate">GENERATE</button>
                <button type="button" id="agGenerateChecked">GENERATE CHECKED</button>
                <button type="button" id="agAccept">ACCEPT</button>
                <button type="button" id="agDiscard">DISCARD</button>
                <button type="button" id="agClose">CLOSE</button>
              </div>
            </div>
          </div>
          <div class="ag-library-render" id="agLibraryRender">
            <div class="ag-settings-section-title">RENDER</div>
            <div class="ag-settings-grid" id="agLibraryRenderGrid"></div>
          </div>
        </div>
      </div>
    </div>
    <div class="ag-settings" id="agSettingsPane" hidden>
      <p class="ag-settings-note">Render + ComfyUI. Bridge: <code>npm run assets</code> (Comfy + Bridge). Dann hier <b>START COMFYUI</b> / Generate.</p>
      <div class="ag-settings-section-title">COMFYUI</div>
      <div class="ag-row ag-actions" id="agComfyActions" style="margin-bottom:10px">
        <button type="button" id="agComfyStart">START COMFYUI</button>
        <button type="button" id="agComfyStop">STOP COMFYUI</button>
        <button type="button" id="agComfyRefresh">REFRESH STATUS</button>
        <button type="button" id="agComfyOpen">OPEN UI</button>
      </div>
      <div class="ag-status" id="agComfyStatusLine" style="margin:0 0 10px">ComfyUI: …</div>
      <div class="ag-settings-grid" id="agComfyGrid"></div>
      <div class="ag-settings-section-title">RENDER</div>
      <div class="ag-settings-grid" id="agSettingsGrid"></div>
      <div class="ag-row ag-actions">
        <button type="button" id="agSettingsSave">SAVE SETTINGS</button>
        <button type="button" id="agSettingsReset">RESET DEFAULTS</button>
      </div>
    </div>
  </div>
  <div class="ag-status" id="agStatus"></div>
</div>`;
        document.body.appendChild(root);
        this.overlay = root;

        root.querySelectorAll("#agMainTabs button").forEach((btn) => {
            btn.addEventListener("click", () => {
                if (this.renderSettingsPrefix()) this.readSettingsFromForm();
                this.mainTab = btn.dataset.tab || "library";
                this.renderMainTabs();
                this.syncPanelVisibility();
                this.persistMenuState();
            });
        });

        const types = root.querySelector("#agTypes");
        (assetGenRegistry.getTypes() || []).forEach((t) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.textContent = t.label;
            btn.dataset.type = t.id;
            if (t.id === this.typeId) btn.classList.add("ag-on");
            btn.addEventListener("click", () => {
                this.typeId = this.normalizeTypeId(t.id);
                this.selectedId = null;
                this.checkedIds = new Set();
                this.clearStaging();
                this.renderTypes();
                this.renderList();
                this.renderDetail();
                this.persistMenuState();
            });
            types.appendChild(btn);
        });

        root.querySelector("#agSelectAll").addEventListener("change", (e) => {
            const on = !!e.target.checked;
            const entries = this.visibleLibraryEntries();
            this.checkedIds = new Set(on ? entries.map((x) => x.id) : []);
            this.renderList();
        });
        root.querySelector("#agClearChecks").addEventListener("click", () => {
            this.checkedIds = new Set();
            this.renderList();
        });

        const filterEl = root.querySelector("#agFactionFilter");
        if (filterEl) {
            filterEl.value = this.factionFilterText || "";
            filterEl.addEventListener("input", () => {
                this.factionFilterText = filterEl.value || "";
                this.renderList();
            });
        }

        root.querySelector("#agGenerate").addEventListener("click", () => this.onGenerate());
        root.querySelector("#agGenerateChecked").addEventListener("click", () => this.onGenerateChecked());
        root.querySelector("#agAccept").addEventListener("click", () => this.onAccept());
        root.querySelector("#agDiscard").addEventListener("click", () => {
            this.clearStaging();
            this.setStatus("Discarded.");
            this.renderDetail();
        });
        root.querySelector("#agClose").addEventListener("click", () => this.hide());
        root.querySelector("#agSettingsSave").addEventListener("click", () => {
            this.readSettingsFromForm();
            this.saveRenderSettings();
            this.pushComfyConfigToBridge().then(() => {
                this.setStatus("Settings saved · pushed to bridge");
                this.refreshComfyStatusLine();
            }).catch((e) => {
                this.setStatus("Saved locally · bridge: " + String(e && e.message || e));
            });
        });
        root.querySelector("#agSettingsReset").addEventListener("click", () => {
            this.renderSettings = this.defaultRenderSettings();
            this.saveRenderSettings();
            this.renderSettingsPanel();
            this.setStatus("Settings reset.");
        });
        root.querySelector("#agComfyStart").addEventListener("click", () => this.onComfyStart());
        root.querySelector("#agComfyStop").addEventListener("click", () => this.onComfyStop());
        root.querySelector("#agComfyRefresh").addEventListener("click", () => this.refreshComfyStatusLine());
        root.querySelector("#agComfyOpen").addEventListener("click", () => {
            const host = this.renderSettings.comfyHost || "127.0.0.1";
            const port = this.renderSettings.comfyPort || 6767;
            window.open("http://" + host + ":" + port, "_blank", "noopener");
        });
        root.addEventListener("click", (e) => {
            if (e.target === root) this.hide();
        });

        this.renderMainTabs();
        this.syncPanelVisibility();
        this.updateHintPorts();
    }

    renderMainTabs() {
        if (!this.overlay) return;
        this.overlay.querySelectorAll("#agMainTabs button").forEach((btn) => {
            btn.classList.toggle("ag-on", btn.dataset.tab === this.mainTab);
        });
    }

    syncPanelVisibility() {
        if (!this.overlay) return;
        const lib = this.overlay.querySelector("#agLibraryPane");
        const set = this.overlay.querySelector("#agSettingsPane");
        if (lib) lib.hidden = this.mainTab !== "library";
        if (set) set.hidden = this.mainTab !== "settings";
        this.renderSettingsPanel();
        if (this.mainTab === "settings") {
            this.refreshComfyStatusLine();
        }
    }

    renderTypes() {
        if (!this.overlay) return;
        this.overlay.querySelectorAll("#agTypes button").forEach((btn) => {
            btn.classList.toggle("ag-on", btn.dataset.type === this.typeId);
        });
    }

    updateSelectAllState() {
        if (!this.overlay) return;
        const master = this.overlay.querySelector("#agSelectAll");
        const countEl = this.overlay.querySelector("#agCheckCount");
        const entries = this.visibleLibraryEntries();
        const total = entries.length;
        const n = entries.filter((e) => this.checkedIds.has(e.id)).length;
        if (countEl) countEl.textContent = this.checkedIds.size + " selected";
        if (!master) return;
        master.indeterminate = n > 0 && n < total;
        master.checked = total > 0 && n === total;
    }

    isFactionLibrary() {
        return this.typeId === "faction";
    }

    factionIds() {
        if (typeof assetGenRegistry !== "undefined" && assetGenRegistry.factionIds) {
            return assetGenRegistry.factionIds();
        }
        return ["terran", "kronax", "voidborn", "pirate", "machine"];
    }

    factionLabel(factionId) {
        if (typeof planetConfigManager !== "undefined" && planetConfigManager.getFactionMeta) {
            const meta = planetConfigManager.getFactionMeta(factionId);
            if (meta && meta.label) return meta.label;
        }
        return String(factionId || "").toUpperCase();
    }

    libraryEntriesForType() {
        if (this.isFactionLibrary() && typeof assetGenRegistry !== "undefined"
            && assetGenRegistry.listFactionLibrary) {
            return assetGenRegistry.listFactionLibrary();
        }
        return (typeof assetGenRegistry !== "undefined" && assetGenRegistry.list)
            ? (assetGenRegistry.list(this.typeId) || [])
            : [];
    }

    filteredFactionEntries() {
        const all = (typeof assetGenRegistry !== "undefined" && assetGenRegistry.listFactionLibrary)
            ? assetGenRegistry.listFactionLibrary()
            : [];
        const cat = this.factionCategory || "all";
        const q = String(this.factionFilterText || "").trim().toLowerCase();
        return all.filter((entry) => {
            if (cat !== "all" && entry.faction !== cat) return false;
            // In a specific faction tab, always show that faction's emblem (even if filter is ship-focused)
            if (cat !== "all" && entry.kind === "emblem") {
                if (!q) return true;
            }
            // On ALL tab, hide emblems from the ship table (emblem only on faction tabs)
            if (cat === "all" && entry.kind === "emblem") return false;
            if (!q) return true;
            const hay = [
                entry.label,
                entry.id,
                entry.faction,
                entry.enemyClass,
                entry.kind
            ].map((x) => String(x || "").toLowerCase()).join(" ");
            return hay.indexOf(q) >= 0;
        });
    }

    visibleLibraryEntries() {
        if (this.isFactionLibrary()) return this.filteredFactionEntries();
        return this.libraryEntriesForType();
    }

    syncFactionChrome() {
        if (!this.overlay) return;
        const chrome = this.overlay.querySelector("#agFactionChrome");
        if (!chrome) return;
        const on = this.isFactionLibrary();
        chrome.hidden = !on;
        if (!on) return;
        this.renderFactionTabs();
        const filterEl = this.overlay.querySelector("#agFactionFilter");
        if (filterEl && filterEl.value !== (this.factionFilterText || "")) {
            filterEl.value = this.factionFilterText || "";
        }
    }

    renderFactionTabs() {
        const host = this.overlay && this.overlay.querySelector("#agFactionTabs");
        if (!host) return;
        host.innerHTML = "";
        const cats = ["all"].concat(this.factionIds());
        cats.forEach((cat) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.dataset.category = cat;
            if (cat === (this.factionCategory || "all")) btn.classList.add("ag-on");
            if (cat === "all") {
                btn.textContent = "ALL";
            } else {
                const color = this.factionColor(cat);
                if (color) {
                    btn.style.setProperty("--ag-faction-color", color);
                    btn.style.borderColor = color;
                    btn.style.color = color;
                }
                const icon = document.createElement("span");
                icon.className = "ag-faction-tab-icon";
                const emblem = (typeof assetGenRegistry !== "undefined" && assetGenRegistry.listFactions)
                    ? (assetGenRegistry.listFactions().find((e) => e.faction === cat) || null)
                    : null;
                if (emblem) this.drawThumbInto(icon, emblem, 14);
                const span = document.createElement("span");
                span.textContent = this.factionLabel(cat);
                btn.appendChild(icon);
                btn.appendChild(span);
            }
            btn.addEventListener("click", () => {
                this.factionCategory = cat;
                this.saveFactionCategory();
                this.selectedId = null;
                this.clearStaging();
                this.renderList();
                this.renderDetail();
                this.persistMenuState();
            });
            host.appendChild(btn);
        });
    }

    selectLibraryEntry(entry) {
        if (!entry) return;
        this.selectedId = entry.id;
        this.clearStaging();
        this.renderList();
        this.renderDetail();
        this.persistMenuState();
    }

    renderFactionTable(listEl, entries) {
        const showFactionCol = (this.factionCategory || "all") === "all";
        const table = document.createElement("table");
        table.className = "ag-ships-table";
        const thead = document.createElement("thead");
        thead.innerHTML = "<tr>"
            + "<th></th><th></th><th>SHIP</th>"
            + (showFactionCol ? "<th>FACTION</th>" : "")
            + "<th>SIZE</th></tr>";
        table.appendChild(thead);
        const tbody = document.createElement("tbody");

        entries.forEach((entry) => {
            const tr = document.createElement("tr");
            if (entry.id === this.selectedId) tr.classList.add("ag-on");
            tr.dataset.id = entry.id;

            const tdCb = document.createElement("td");
            const cb = document.createElement("input");
            cb.type = "checkbox";
            cb.checked = this.checkedIds.has(entry.id);
            cb.addEventListener("click", (e) => e.stopPropagation());
            cb.addEventListener("change", (e) => {
                e.stopPropagation();
                if (cb.checked) this.checkedIds.add(entry.id);
                else this.checkedIds.delete(entry.id);
                this.updateSelectAllState();
            });
            tdCb.appendChild(cb);

            const tdThumb = document.createElement("td");
            const thumb = document.createElement("div");
            thumb.className = "ag-thumb";
            this.drawThumbInto(thumb, entry, 24);
            thumb.addEventListener("mouseenter", () => this.showHoverZoom(thumb, entry));
            thumb.addEventListener("mouseleave", () => this.hideHoverZoom());
            tdThumb.appendChild(thumb);

            const tdName = document.createElement("td");
            if (entry.kind === "emblem") {
                tdName.textContent = "EMBLEM";
                const kind = document.createElement("span");
                kind.className = "ag-ships-kind";
                kind.textContent = this.factionLabel(entry.faction);
                tdName.appendChild(kind);
            } else {
                tdName.textContent = String(entry.enemyClass || entry.label || "").toUpperCase();
            }

            tr.appendChild(tdCb);
            tr.appendChild(tdThumb);
            tr.appendChild(tdName);

            if (showFactionCol) {
                const tdFac = document.createElement("td");
                tdFac.textContent = this.factionLabel(entry.faction);
                tr.appendChild(tdFac);
            }

            const tdSize = document.createElement("td");
            tdSize.textContent = String(entry.size != null ? entry.size : "—");
            tr.appendChild(tdSize);

            tr.addEventListener("click", () => this.selectLibraryEntry(entry));
            tbody.appendChild(tr);
        });

        table.appendChild(tbody);
        listEl.appendChild(table);
    }

    renderList() {
        if (!this.overlay) return;
        const list = this.overlay.querySelector("#agList");
        list.innerHTML = "";
        this.syncFactionChrome();

        const entries = this.visibleLibraryEntries();
        if (!this.selectedId && entries[0]) this.selectedId = entries[0].id;
        const valid = new Set(this.libraryEntriesForType().map((e) => e.id));
        this.checkedIds = new Set([...this.checkedIds].filter((id) => valid.has(id)));

        if (this.isFactionLibrary()) {
            this.renderFactionTable(list, entries);
            this.updateSelectAllState();
            const on = list.querySelector("tr.ag-on");
            if (on) on.scrollIntoView({ block: "nearest" });
            return;
        }

        entries.forEach((entry) => {
            const row = document.createElement("div");
            row.className = "ag-list-item" + (entry.id === this.selectedId ? " ag-on" : "");
            row.dataset.id = entry.id;

            const cb = document.createElement("input");
            cb.type = "checkbox";
            cb.checked = this.checkedIds.has(entry.id);
            cb.addEventListener("click", (e) => e.stopPropagation());
            cb.addEventListener("change", (e) => {
                e.stopPropagation();
                if (cb.checked) this.checkedIds.add(entry.id);
                else this.checkedIds.delete(entry.id);
                this.updateSelectAllState();
            });

            const thumb = document.createElement("div");
            thumb.className = "ag-thumb";
            this.drawThumbInto(thumb, entry, 28);
            thumb.addEventListener("mouseenter", () => this.showHoverZoom(thumb, entry));
            thumb.addEventListener("mouseleave", () => this.hideHoverZoom());

            const label = document.createElement("span");
            label.className = "ag-list-label";
            label.textContent = entry.label;

            row.appendChild(cb);
            row.appendChild(thumb);
            row.appendChild(label);
            row.addEventListener("click", () => this.selectLibraryEntry(entry));
            list.appendChild(row);
        });

        this.updateSelectAllState();
        const on = list.querySelector(".ag-list-item.ag-on");
        if (on) on.scrollIntoView({ block: "nearest" });
    }

    currentEntry() {
        if (typeof assetGenRegistry === "undefined") return null;
        if (this.isFactionLibrary()) {
            return assetGenRegistry.get("faction", this.selectedId)
                || assetGenRegistry.get("factionShip", this.selectedId)
                || null;
        }
        return assetGenRegistry.get(this.typeId, this.selectedId);
    }

    checkedEntries() {
        const byId = new Map();
        this.libraryEntriesForType().forEach((e) => byId.set(e.id, e));
        return [...this.checkedIds].map((id) => byId.get(id)).filter(Boolean);
    }

    drawPixelMatrix(box, sprite, colors, px, keepColor) {
        if (!sprite || !sprite.length) return false;
        const rows = sprite.length;
        const cols = sprite[0].length || 1;
        const canvas = document.createElement("canvas");
        canvas.width = px;
        canvas.height = px;
        const ctx = canvas.getContext("2d");
        ctx.imageSmoothingEnabled = false;
        const cell = Math.max(1, Math.floor(Math.min(px / cols, px / rows)));
        const ox = Math.floor((px - cols * cell) / 2);
        const oy = Math.floor((px - rows * cell) / 2);
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const v = sprite[r][c];
                if (!v) continue;
                let color = (colors && colors[v]) || "#aaaaaa";
                if (typeof color === "string" && color.indexOf("var(") === 0) {
                    const m = color.match(/var\(\s*(--[^),\s]+)/);
                    color = m
                        ? (getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim() || "#aaaaaa")
                        : "#aaaaaa";
                }
                if (!color || color === "transparent") continue;
                ctx.fillStyle = keepColor ? color : this.toGrayHex(color);
                ctx.fillRect(ox + c * cell, oy + r * cell, cell, cell);
            }
        }
        box.appendChild(canvas);
        return true;
    }

    /** Force R=G=B for asset-gen previews (tint happens in-engine later). */
    toGrayHex(color) {
        const hex = String(color || "#aaaaaa").trim();
        const m = /^#?([0-9a-fA-F]{6})$/.exec(hex);
        if (!m) return "#aaaaaa";
        const n = parseInt(m[1], 16);
        const r = (n >> 16) & 255;
        const g = (n >> 8) & 255;
        const b = n & 255;
        const y = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
        const h = y.toString(16).padStart(2, "0");
        return "#" + h + h + h;
    }

    desaturateCanvas(canvas) {
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = imageData.data;
        for (let i = 0; i < d.length; i += 4) {
            if (d[i + 3] === 0) continue;
            const r = d[i];
            const g = d[i + 1];
            const b = d[i + 2];
            // Magenta key residue → transparent
            if (Math.abs(r - 255) + Math.abs(g - 0) + Math.abs(b - 255) <= 160) {
                d[i] = d[i + 1] = d[i + 2] = d[i + 3] = 0;
                continue;
            }
            const y = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
            d[i] = d[i + 1] = d[i + 2] = y;
        }
        ctx.putImageData(imageData, 0, 0);
    }

    async dataUrlToGrayDataUrl(dataUrl) {
        return new Promise((resolve) => {
            if (!dataUrl) {
                resolve(null);
                return;
            }
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                canvas.width = img.naturalWidth || img.width;
                canvas.height = img.naturalHeight || img.height;
                const ctx = canvas.getContext("2d");
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(img, 0, 0);
                this.desaturateCanvas(canvas);
                resolve(canvas.toDataURL("image/png"));
            };
            img.onerror = () => resolve(dataUrl);
            img.src = dataUrl;
        });
    }

    parseFactionShipKey(key) {
        const parts = String(key || "").split("-");
        if (parts[0] === "enemy" && parts.length >= 3) {
            return { faction: parts[1], enemyClass: parts.slice(2).join("-") };
        }
        return null;
    }

    factionColor(factionId) {
        if (typeof factionShipStyles !== "undefined" && factionShipStyles.getFactionColor) {
            return factionShipStyles.getFactionColor(factionId);
        }
        if (typeof planetConfigManager !== "undefined" && planetConfigManager.getFactionPlanetTheme) {
            const t = planetConfigManager.getFactionPlanetTheme(factionId);
            if (t && t.baseColor) return t.baseColor;
        }
        return null;
    }

    entryFactionId(entry) {
        if (!entry) return null;
        if (entry.faction) return String(entry.faction).toLowerCase();
        const key = entry.spriteKey || entry.id || "";
        if (entry.type === "faction" || String(key).indexOf("faction-") === 0) {
            return String(key).replace(/^faction[-_]?/i, "").toLowerCase();
        }
        const parsed = this.parseFactionShipKey(key);
        return parsed ? parsed.faction : null;
    }

    keepFactionColor(entry) {
        if (!entry) return false;
        return entry.type === "factionShip" || entry.type === "faction"
            || !!(entry.faction && (entry.kind === "ship" || entry.kind === "emblem"));
    }

    drawThumbInto(box, entry, size) {
        box.innerHTML = "";
        if (!entry) return;
        const key = entry.spriteKey || entry.id;
        const px = Math.max(16, size || 28);
        const keepColor = this.keepFactionColor(entry);
        const factionTint = keepColor ? this.factionColor(this.entryFactionId(entry)) : null;

        // 1) Loaded PNG override
        if (typeof spriteLoader !== "undefined" && spriteLoader.getSprite && spriteLoader.getSprite(key)) {
            const canvas = document.createElement("canvas");
            canvas.width = px;
            canvas.height = px;
            const ctx = canvas.getContext("2d");
            ctx.imageSmoothingEnabled = false;
            spriteLoader.renderSprite(ctx, key, 0, 0, px, px);
            if (!keepColor) this.desaturateCanvas(canvas);
            else if (factionTint && typeof iconRenderer !== "undefined" && iconRenderer.tintColor) {
                this.tintCanvas(canvas, factionTint);
            }
            box.appendChild(canvas);
            return;
        }

        // 2) Faction ship pixel fallback — fill canvas (not renderEnemyShip scale path)
        if ((entry.type === "factionShip" || entry.type === "enemy") &&
            typeof factionShipStyles !== "undefined" && factionShipStyles.resolveFactionShipVisual) {
            const parsed = this.parseFactionShipKey(key);
            const visual = factionShipStyles.resolveFactionShipVisual({
                faction: parsed ? parsed.faction : null,
                enemyClass: parsed ? parsed.enemyClass : null,
                typeId: entry.type === "enemy" ? key : null,
                tier: 2
            });
            if (visual && visual.model && this.drawPixelMatrix(box, visual.model.sprite, visual.model.colors, px, true)) {
                return;
            }
        }

        // 3) Icons / mounts / faction emblems
        if ((entry.type === "icon" || entry.type === "ability" || entry.type === "mount" || entry.type === "faction") &&
            typeof iconRenderer !== "undefined") {
            if (entry.type === "mount" && typeof ModuleSprites !== "undefined" && ModuleSprites[key]) {
                const canvas = document.createElement("canvas");
                canvas.width = px;
                canvas.height = px;
                iconRenderer.drawSprite(canvas.getContext("2d"), ModuleSprites[key], 0, 0, px, null);
                this.desaturateCanvas(canvas);
                box.appendChild(canvas);
                return;
            }
            const camel = key.indexOf("faction-") === 0
                ? ("faction" + key.slice(8).charAt(0).toUpperCase() + key.slice(9))
                : key;
            const drawKey = (iconRenderer.getSprite(camel) || (iconRenderer.getPngOverride && iconRenderer.getPngOverride(camel)))
                ? camel
                : key;
            if (iconRenderer.getSprite(drawKey) || (iconRenderer.getPngOverride && iconRenderer.getPngOverride(drawKey))) {
                const canvas = document.createElement("canvas");
                canvas.width = px;
                canvas.height = px;
                iconRenderer.drawToCanvas(canvas, drawKey, keepColor ? factionTint : null);
                if (!keepColor) this.desaturateCanvas(canvas);
                box.appendChild(canvas);
                return;
            }
            // Pixel IconSprites (faction emblems etc.)
            if (typeof IconSprites !== "undefined" && (IconSprites[camel] || IconSprites[key])) {
                const canvas = document.createElement("canvas");
                canvas.width = px;
                canvas.height = px;
                iconRenderer.drawSprite(
                    canvas.getContext("2d"),
                    IconSprites[camel] || IconSprites[key],
                    0, 0, px, keepColor ? factionTint : null
                );
                if (!keepColor) this.desaturateCanvas(canvas);
                box.appendChild(canvas);
                return;
            }
        }

        // 4) Generic ship / enemy hull models (pixel)
        if ((entry.type === "ship" || entry.type === "enemy") && typeof graphicsManager !== "undefined") {
            let model = null;
            const loader = graphicsManager.shipAssetLoader;
            if (loader && loader.getShip) {
                model = loader.getShip(key)
                    || loader.getShip(String(key).replace(/^enemy-/, "").replace(/^player-/, ""))
                    || null;
            }
            if (model && model.sprite && this.drawPixelMatrix(box, model.sprite, model.colors, px, keepColor)) {
                return;
            }
        }

        const miss = document.createElement("span");
        miss.textContent = "·";
        miss.style.color = "#777";
        miss.style.fontSize = Math.max(10, Math.floor(px / 3)) + "px";
        box.appendChild(miss);
    }

    tintCanvas(canvas, tint) {
        if (!canvas || !tint || typeof iconRenderer === "undefined") return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = imageData.data;
        for (let i = 0; i < d.length; i += 4) {
            if (d[i + 3] === 0) continue;
            const hex = "#" + [d[i], d[i + 1], d[i + 2]].map((n) => {
                const h = n.toString(16);
                return h.length === 1 ? "0" + h : h;
            }).join("");
            const out = iconRenderer.tintColor(hex, tint);
            const n = parseInt(out.slice(1), 16);
            d[i] = (n >> 16) & 255;
            d[i + 1] = (n >> 8) & 255;
            d[i + 2] = n & 255;
        }
        ctx.putImageData(imageData, 0, 0);
    }

    showHoverZoom(fromThumb, entry) {
        this.hideHoverZoom();
        if (!fromThumb || !entry) return;
        const zoom = document.createElement("div");
        zoom.className = "ag-zoom";
        zoom.style.left = "50%";
        zoom.style.top = "50%";
        const inner = document.createElement("div");
        inner.className = "ag-zoom-inner";
        this.drawThumbInto(inner, entry, 280);
        zoom.appendChild(inner);
        document.body.appendChild(zoom);
        this._hoverZoomEl = zoom;
    }

    hideHoverZoom() {
        if (this._hoverZoomEl && this._hoverZoomEl.parentNode) {
            this._hoverZoomEl.parentNode.removeChild(this._hoverZoomEl);
        }
        this._hoverZoomEl = null;
    }

    clearStaging() {
        this.stagingId = null;
        this.previewDataUrl = null;
    }

    setStatus(msg) {
        this.statusText = msg || "";
        const el = this.overlay && this.overlay.querySelector("#agStatus");
        if (el) el.textContent = this.statusText;
    }

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
    }

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
    }

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
    }

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
    }

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
    }

    drawCurrentPreview(entry) {
        const box = this.overlay.querySelector("#agCurrent");
        if (!box) return;
        box.innerHTML = "";
        if (!entry) return;
        this.drawThumbInto(box, entry, Math.min(168, Math.max(48, (entry.size || 32) * 4)));
    }

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
    }

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
    }

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
    }

    renderSettingsPrefix() {
        if (!this.overlay) return null;
        if (this.mainTab === "library" && this.overlay.querySelector("#agLibOutSize")) return "agLib";
        if (this.overlay.querySelector("#agSetOutSize")) return "agSet";
        if (this.overlay.querySelector("#agLibOutSize")) return "agLib";
        return null;
    }

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
    }

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
    }

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
    }

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
    }

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
    }

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
    }
}

const assetGenUI = new AssetGenUI();
window.AssetGenUI = AssetGenUI;
window.assetGenUI = assetGenUI;

document.addEventListener("keydown", (e) => {
    if (e.key !== "#") return;
    if (assetGenUI.isTypingTarget(document.activeElement)) return;
    e.preventDefault();
    if (assetGenUI.visible) {
        assetGenUI.hide();
        return;
    }
    const hovered = assetGenUI.resolveHoveredEntry();
    if (hovered) {
        assetGenUI.focusEntry(hovered);
        return;
    }
    assetGenUI.show();
}, true);
