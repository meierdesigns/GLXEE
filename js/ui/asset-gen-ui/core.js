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
}
