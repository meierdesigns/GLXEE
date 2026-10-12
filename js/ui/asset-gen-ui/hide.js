"use strict";

// AssetGenUI methods, split from asset-gen-ui.js.
extendClass(AssetGenUI, {
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
    },

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
    },

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
    },

    renderMainTabs() {
        if (!this.overlay) return;
        this.overlay.querySelectorAll("#agMainTabs button").forEach((btn) => {
            btn.classList.toggle("ag-on", btn.dataset.tab === this.mainTab);
        });
    },

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
    },

    renderTypes() {
        if (!this.overlay) return;
        this.overlay.querySelectorAll("#agTypes button").forEach((btn) => {
            btn.classList.toggle("ag-on", btn.dataset.type === this.typeId);
        });
    },

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
    },

    isFactionLibrary() {
        return this.typeId === "faction";
    },
});
