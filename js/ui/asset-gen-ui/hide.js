"use strict";

// AssetGenUI methods, split from asset-gen-ui.js.
extendClass(AssetGenUI, {
    hide() {
        if (!this.visible) return;
        this.visible = false;
        this.hideHoverZoom();
        if (typeof this._unbindPointerTracking === "function") this._unbindPointerTracking();
        if (typeof this._teardownThumbObserver === "function") this._teardownThumbObserver();
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
        root.className = "ag-overlay vf-glass";
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
      <div class="ag-row ag-types" id="agTypes">
        <label class="ag-types-label" for="agTypeSelect">TYPE</label>
        <select id="agTypeSelect" class="ag-type-select" aria-label="Asset type"></select>
      </div>
      <div class="ag-col">
        <div class="ag-list-wrap">
          <div class="ag-faction-chrome" id="agFactionChrome" hidden>
            <div class="ag-faction-tabs" id="agFactionTabs"></div>
            <input type="search" class="ag-faction-filter" id="agFactionFilter" placeholder="FILTER SHIPS…" autocomplete="off">
          </div>
          <div class="ag-portrait-chrome" id="agPortraitChrome" hidden>
            <div class="ag-portrait-ref ag-card" id="agSectionReference" data-section="reference">
              <button type="button" class="ag-card-header" data-collapse="reference" aria-expanded="true">
                <span class="ag-card-chevron" aria-hidden="true">▾</span>
                <span class="ag-card-title">REFERENCE (style for all faces)</span>
              </button>
              <div class="ag-card-body">
                <div class="ag-portrait-ref-row">
                  <div class="ag-portrait-ref-preview" id="agPortraitRefPreview">(none)</div>
                  <div class="ag-portrait-ref-actions">
                    <input type="file" id="agPortraitRefFile" accept="image/png,image/jpeg,image/webp" hidden>
                    <button type="button" id="agPortraitRefPick">LOAD EXAMPLE</button>
                    <input type="url" class="ag-portrait-ref-url" id="agPortraitRefUrl" placeholder="or paste image URL…" autocomplete="off">
                    <button type="button" id="agPortraitRefUrlLoad">LOAD LINK</button>
                    <button type="button" id="agPortraitRefClear">CLEAR</button>
                    <button type="button" id="agPortraitGenerateAll">GENERATE ALL</button>
                  </div>
                </div>
                <p class="ag-portrait-hint">One example image → Flux img2img → replaces every checked / all portraits under assets/factions/*/portraits/</p>
              </div>
            </div>
            <div class="ag-portrait-bg ag-card" id="agSectionBackdrop" data-section="backdrop">
              <button type="button" class="ag-card-header" data-collapse="backdrop" aria-expanded="true">
                <span class="ag-card-chevron" aria-hidden="true">▾</span>
                <span class="ag-card-title">ANIMATED BACKDROP (preview)</span>
              </button>
              <div class="ag-card-body">
                <div class="ag-portrait-bg-row">
                  <input type="range" id="agPortraitBgv" min="0" max="31" step="1" value="0" aria-label="Animated backdrop">
                  <b class="ag-portrait-bg-val" id="agPortraitBgvVal">01 / 32</b>
                  <button type="button" id="agPortraitBgvRand" title="Random backdrop">RND</button>
                </div>
                <div class="ag-label">ANIMATION</div>
                <div class="ag-portrait-bg-row">
                  <input type="range" id="agPortraitBga" min="0" max="4" step="1" value="2" aria-label="Backdrop animation speed">
                  <b class="ag-portrait-bg-val" id="agPortraitBgaVal">NORMAL</b>
                </div>
                <p class="ag-portrait-hint">Backdrop + motion speed — same controls as Pilot create (BACKDROP / ANIMATION).</p>
              </div>
            </div>
            <div class="ag-faction-tabs" id="agPortraitFactionTabs"></div>
          </div>
          <div class="ag-toolbar">
            <label title="Select all / none">
              <input type="checkbox" id="agSelectAll">
              <span>SELECT ALL</span>
            </label>
            <button type="button" id="agClearChecks">CLEAR</button>
            <span class="ag-label" id="agCheckCount">0 selected</span>
            <div class="ag-zoom-control" id="agZoomControl" hidden>
              <label for="agGridZoom" title="Thumbnail size">ZOOM</label>
              <input type="range" id="agGridZoom" min="48" max="160" step="4" value="72" aria-label="Thumbnail size">
            </div>
            <div class="ag-view-toggle" id="agViewToggle" role="group" aria-label="List view">
              <button type="button" class="ag-view-btn" data-view="list" title="List view">LIST</button>
              <button type="button" class="ag-view-btn" data-view="grid" title="Grid view">GRID</button>
            </div>
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
                <button type="button" id="agNewTab" title="Open this editor in its own browser tab">NEW TAB</button>
                <button type="button" id="agClose">CLOSE</button>
              </div>
            </div>
          </div>
          <div class="ag-library-render ag-card" id="agLibraryRender" data-section="render">
            <button type="button" class="ag-card-header" data-collapse="render" aria-expanded="true">
              <span class="ag-card-chevron" aria-hidden="true">▾</span>
              <span class="ag-card-title">RENDER</span>
            </button>
            <div class="ag-card-body">
              <div class="ag-settings-grid" id="agLibraryRenderGrid"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="ag-settings" id="agSettingsPane" hidden>
      <p class="ag-settings-note">Render + ComfyUI. Bridge: <code>npm run assets</code> (Comfy + Bridge). Dann hier <b>START COMFYUI</b> / Generate.</p>
      <div class="ag-card" data-section="comfy">
        <button type="button" class="ag-card-header" data-collapse="comfy" aria-expanded="true">
          <span class="ag-card-chevron" aria-hidden="true">▾</span>
          <span class="ag-card-title">COMFYUI</span>
        </button>
        <div class="ag-card-body">
          <div class="ag-row ag-actions" id="agComfyActions" style="margin-bottom:10px">
            <button type="button" id="agComfyStart">START COMFYUI</button>
            <button type="button" id="agComfyStop">STOP COMFYUI</button>
            <button type="button" id="agComfyRefresh">REFRESH STATUS</button>
            <button type="button" id="agComfyOpen">OPEN UI</button>
          </div>
          <div class="ag-status" id="agComfyStatusLine" style="margin:0 0 10px">ComfyUI: …</div>
          <div class="ag-settings-grid" id="agComfyGrid"></div>
        </div>
      </div>
      <div class="ag-card" data-section="render-settings">
        <button type="button" class="ag-card-header" data-collapse="render-settings" aria-expanded="true">
          <span class="ag-card-chevron" aria-hidden="true">▾</span>
          <span class="ag-card-title">RENDER</span>
        </button>
        <div class="ag-card-body">
          <div class="ag-settings-grid" id="agSettingsGrid"></div>
          <div class="ag-row ag-actions" style="margin-top:10px">
            <button type="button" id="agSettingsSave">SAVE SETTINGS</button>
            <button type="button" id="agSettingsReset">RESET DEFAULTS</button>
          </div>
        </div>
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

        const typeSelect = root.querySelector("#agTypeSelect");
        if (typeSelect) {
            (assetGenRegistry.getTypes() || []).forEach((t) => {
                const opt = document.createElement("option");
                opt.value = t.id;
                opt.textContent = t.label;
                if (t.id === this.typeId) opt.selected = true;
                typeSelect.appendChild(opt);
            });
            typeSelect.addEventListener("change", () => {
                this.typeId = this.normalizeTypeId(typeSelect.value);
                this.selectedId = null;
                this.checkedIds = new Set();
                this.clearStaging();
                this.renderTypes();
                this.syncPortraitChrome();
                this.syncFactionChrome();
                this.syncEditorTitle && this.syncEditorTitle();
                this.renderList();
                this.renderDetail();
                this.persistMenuState();
            });
        }

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
        root.querySelectorAll("#agViewToggle button").forEach((btn) => {
            btn.addEventListener("click", () => this.setListView(btn.dataset.view));
        });
        const zoomInput = root.querySelector("#agGridZoom");
        if (zoomInput) {
            zoomInput.value = String(this.gridZoom || 72);
            zoomInput.addEventListener("input", () => this.setGridZoom(Number(zoomInput.value)));
        }
        root.querySelectorAll(".ag-card-header").forEach((btn) => {
            btn.addEventListener("click", () => this.toggleCardCollapse(btn.dataset.collapse));
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
        const refPick = root.querySelector("#agPortraitRefPick");
        const refFile = root.querySelector("#agPortraitRefFile");
        const refUrlInput = root.querySelector("#agPortraitRefUrl");
        const refUrlLoad = root.querySelector("#agPortraitRefUrlLoad");
        const refClear = root.querySelector("#agPortraitRefClear");
        const refAll = root.querySelector("#agPortraitGenerateAll");
        if (refPick && refFile) {
            refPick.addEventListener("click", () => refFile.click());
            refFile.addEventListener("change", () => this.onPortraitReferenceFile(refFile));
        }
        if (refUrlLoad && refUrlInput) {
            refUrlLoad.addEventListener("click", () => this.onPortraitReferenceUrl(refUrlInput, refUrlLoad));
            refUrlInput.addEventListener("keydown", (e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                this.onPortraitReferenceUrl(refUrlInput, refUrlLoad);
            });
        }
        if (refClear) refClear.addEventListener("click", () => this.clearPortraitReference());
        if (refAll) refAll.addEventListener("click", () => this.onGenerateAllPortraits());
        const bgvSl = root.querySelector("#agPortraitBgv");
        const bgvRnd = root.querySelector("#agPortraitBgvRand");
        const bgaSl = root.querySelector("#agPortraitBga");
        if (bgvSl) {
            bgvSl.value = String(this.portraitBgv | 0);
            bgvSl.addEventListener("input", () => {
                this.setPortraitBgv(Number(bgvSl.value) || 0);
            });
        }
        if (bgvRnd) {
            bgvRnd.addEventListener("click", () => {
                const n = (typeof heroPortrait !== "undefined" && heroPortrait.OPTIONS && heroPortrait.OPTIONS.bgv)
                    ? heroPortrait.OPTIONS.bgv
                    : 32;
                this.setPortraitBgv(Math.floor(Math.random() * n));
            });
        }
        if (bgaSl) {
            bgaSl.value = String(this.portraitBga | 0);
            bgaSl.addEventListener("input", () => {
                this.setPortraitBga(Number(bgaSl.value) || 0);
            });
        }
        root.querySelector("#agDiscard").addEventListener("click", () => {
            this.clearStaging();
            this.setStatus("Discarded.");
            this.renderDetail();
        });
        root.querySelector("#agNewTab").addEventListener("click", () => this.openInNewTab());
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
        this.applyListView();
        this.applyCollapsedSections();
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
        const sel = this.overlay.querySelector("#agTypeSelect");
        if (!sel) return;
        const id = this.normalizeTypeId(this.typeId);
        if (sel.value !== id) sel.value = id;
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

    isPortraitLibrary() {
        return this.typeId === "portrait";
    },

    // Opens a fresh, independent tab that boots straight into this same editor
    // (same type + tab), so it keeps running on its own if this tab reloads/closes.
    openInNewTab() {
        try {
            const url = new URL(location.href);
            url.searchParams.set("assetGen", this.typeId || "mount");
            url.searchParams.set("assetGenTab", this.mainTab || "library");
            if (this.selectedId) url.searchParams.set("assetGenId", this.selectedId);
            else url.searchParams.delete("assetGenId");
            window.open(url.toString(), "_blank", "noopener");
            this.setStatus("Opened in new tab.");
        } catch (e) {
            this.setStatus("Could not open new tab: " + String(e && e.message || e));
        }
    },
});
