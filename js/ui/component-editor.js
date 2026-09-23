"use strict";

/**
 * Reusable Component / Ingame-GFX Editor.
 * mount(host) for Home Station tab; open(opts) for overlay from viewers/hangar.
 */
class ComponentEditorUI {
    constructor() {
        this.INGAME_TYPES = [
            { id: "mount", label: "MOUNTS" },
            { id: "weapon", label: "WEAPONS" },
            { id: "ship", label: "SHIPS" },
            { id: "enemy", label: "ENEMIES" },
            { id: "factionShip", label: "FACTION SHIPS" },
            { id: "obstacle", label: "OBSTACLES" },
            { id: "ability", label: "ABILITIES" }
        ];
        this.visible = false;
        this.embedded = false;
        this.hostEl = null;
        this.overlay = null;
        this.root = null;
        this.typeId = "mount";
        this.selectedId = null;
        this.stagingId = null;
        this.previewDataUrl = null;
        this.busy = false;
        this.statusText = "";
        this.onClose = null;
        this.returnTo = null;
        this.genSize = 512;
        this.outSize = 64;
        this.steps = 4;
        this.seed = "";
        this.displayScale = 1;
        this.lengthScale = 1;
        this.symmetric = true;
        this.prependStyle = true;
        this._previewAnimId = null;
        this._previewFs = false;
        this._previewHits = [];
        this._hoverHit = null;
        this._bound = false;
        this._keyHandler = (e) => this.handleKeyDown(e);
        this._editCanvas = null;
        this._editKey = null;
        this._editSize = 0;
        this._pixelDirty = false;
        this._paintTool = "draw";
        this._paintShade = 12;
        this._maxShades = 15;
        let savedColors = 15;
        let savedBg = "#FF00FF";
        try {
            savedColors = parseInt(localStorage.getItem("vf_pixel_colors"), 10) || 15;
            const bg = localStorage.getItem("vf_pixel_bg");
            if (bg && /^#[0-9A-Fa-f]{6}$/.test(bg)) savedBg = bg;
        } catch (e) {}
        this.colorCount = Math.max(2, Math.min(this._maxShades, savedColors));
        this.bgColor = savedBg;
        let savedBrush = 1;
        try {
            savedBrush = parseInt(localStorage.getItem("vf_ce_brush_size"), 10) || 1;
        } catch (e) {}
        this._brushSize = savedBrush;
        let savedSym = true;
        try {
            const last = localStorage.getItem("vf_ce_symmetry_last");
            if (last != null) savedSym = last === "true";
        } catch (e) {}
        this.symmetric = savedSym;
        this._painting = false;
        this._paintErase = false;
        this._drawMap = null;
        this._zoomStorageKey = "vf_ce_view_zoom_v1";
        let savedZoom = 1;
        try {
            const rawZ = localStorage.getItem(this._zoomStorageKey);
            if (rawZ != null) {
                const n = parseFloat(rawZ);
                if (isFinite(n) && n >= 0.25 && n <= 8) savedZoom = n;
            }
        } catch (e) {}
        this.viewZoom = savedZoom;
        this.viewPanX = 0;
        this.viewPanY = 0;
        this._panning = false;
        this._panLastX = 0;
        this._panLastY = 0;
        let savedLeftCol = false;
        let savedRightCol = false;
        try {
            savedLeftCol = localStorage.getItem("vf_ce_left_collapsed") === "true";
            savedRightCol = localStorage.getItem("vf_ce_right_collapsed") === "true";
        } catch (e) {}
        this.leftCollapsed = savedLeftCol;
        this.rightCollapsed = savedRightCol;
        this._canvasResizeObs = null;
        this._onPaintMove = (e) => this.onPaintMove(e);
        this._onPaintUp = (e) => this.onPaintUp(e);
        this._onPanMove = (e) => this.onPanMove(e);
        this._onPanUp = (e) => this.onPanUp(e);
        this._onViewWheel = (e) => this.onViewWheel(e);
        this._selStorageKey = "vf_ce_selection_v1";
        this._selByType = {};
        this.restoreSelection();
    }

    persistSelection() {
        if (this.typeId && this.selectedId) {
            this._selByType[this.typeId] = this.selectedId;
        }
        try {
            localStorage.setItem(this._selStorageKey, JSON.stringify({
                typeId: this.typeId || "mount",
                selectedId: this.selectedId || null,
                selectedByType: this._selByType || {}
            }));
        } catch (e) { /* ignore */ }
        if (typeof menuStateManager !== "undefined" && this.visible && this.embedded
            && typeof homeStationUI !== "undefined" && homeStationUI.isVisible
            && homeStationUI.tab === "components") {
            homeStationUI.persistTab();
        }
    }

    restoreSelection() {
        try {
            const raw = localStorage.getItem(this._selStorageKey);
            if (!raw) return;
            const o = JSON.parse(raw);
            if (!o || typeof o !== "object") return;
            if (o.selectedByType && typeof o.selectedByType === "object") {
                this._selByType = Object.assign({}, o.selectedByType);
            }
            if (o.typeId && this.ingameTypeIds().indexOf(o.typeId) >= 0) {
                this.typeId = o.typeId;
            }
            const byType = this._selByType[this.typeId];
            if (byType) this.selectedId = String(byType);
            else if (o.selectedId) this.selectedId = String(o.selectedId);
        } catch (e) { /* ignore */ }
    }

    ingameTypeIds() {
        return this.INGAME_TYPES.map((t) => t.id);
    }

    currentEntry() {
        if (typeof assetGenRegistry === "undefined") return null;
        return assetGenRegistry.get(this.typeId, this.selectedId);
    }

    listEntries() {
        if (typeof assetGenRegistry === "undefined") return [];
        return assetGenRegistry.list(this.typeId) || [];
    }

    async ensureMeta() {
        if (typeof spriteMeta !== "undefined") await spriteMeta.ensureLoaded();
    }

    buildShellHtml() {
        return `
<div class="hs-comp-layout${this.leftCollapsed ? " left-collapsed" : ""}${this.rightCollapsed ? " right-collapsed" : ""}">
  <aside class="hs-comp-sidebar hs-comp-list-col${this.leftCollapsed ? " is-collapsed" : ""}" id="ceLeftCol">
    <div class="hs-comp-collapsed-strip" id="ceExpandLeft" title="Expand Types & Components">
      <button type="button" class="pe-btn hs-comp-toggle-btn" tabindex="-1">▶</button>
      <span class="hs-comp-vertical-label">COMPONENTS</span>
    </div>
    <div class="hs-comp-sidebar-content">
      <div class="hs-comp-sidebar-header">
        <div class="hs-comp-section-title">TYPES</div>
        <button type="button" class="pe-btn hs-comp-toggle-btn" id="ceCollapseLeft" title="Collapse sidebar">◀</button>
      </div>
      <div class="hs-comp-type-chips" id="ceTypeChips"></div>
      <div class="hs-comp-section-title">COMPONENTS</div>
      <div class="hs-comp-list" id="ceList"></div>
    </div>
  </aside>
  <div class="hs-comp-center">
    <div class="hs-comp-section-title">COMPONENT</div>
    <div class="hs-comp-canvas-wrap" id="ceCanvasWrap">
      <canvas id="ceCanvas" width="256" height="256"></canvas>
    </div>
    <div class="hs-comp-palette-row">
      <span class="hs-comp-field-label">PALETTE</span>
      <div class="hs-comp-palette" id="cePalette"></div>
    </div>
    <div class="hs-comp-paint-bar" id="cePaintBar">
      <button type="button" class="pe-btn pe-primary" id="ceToolDraw" data-ce-tool="draw">DRAW</button>
      <button type="button" class="pe-btn" id="ceToolErase" data-ce-tool="erase">ERASE</button>
      <div class="hs-comp-brush-group" id="ceBrushGroup">
        <span class="hs-comp-field-label">SIZE</span>
        <button type="button" class="pe-btn hs-comp-size-btn pe-primary" data-ce-size="1">1</button>
        <button type="button" class="pe-btn hs-comp-size-btn" data-ce-size="2">2</button>
        <button type="button" class="pe-btn hs-comp-size-btn" data-ce-size="3">3</button>
        <button type="button" class="pe-btn hs-comp-size-btn" data-ce-size="4">4</button>
      </div>
      <label class="hs-comp-shade-label">SHADE
        <input type="range" id="ceShade" min="1" max="15" step="1" value="12">
        <span id="ceShadeLabel">12</span>
      </label>
      <label class="hs-comp-check"><input type="checkbox" id="ceSymmetry" checked> SYMMETRY</label>
      <button type="button" class="pe-btn" id="ceApplySym">MIRROR</button>
      <button type="button" class="pe-btn" id="ceClearPx">CLEAR</button>
      <button type="button" class="pe-btn pe-primary" id="ceSavePixels">SAVE PIXELS</button>
    </div>
    <div class="hs-comp-label" id="ceSelectedLabel">—</div>
  </div>
  <aside class="hs-comp-sidebar hs-comp-right-col${this.rightCollapsed ? " is-collapsed" : ""}" id="ceRightCol">
    <div class="hs-comp-collapsed-strip" id="ceExpandRight" title="Expand Preview & Graphics">
      <button type="button" class="pe-btn hs-comp-toggle-btn" tabindex="-1">◀</button>
      <span class="hs-comp-vertical-label">PREVIEW</span>
    </div>
    <div class="hs-comp-sidebar-content">
      <div class="hs-comp-sidebar-header">
        <div class="hs-comp-section-title">PREVIEW</div>
        <button type="button" class="pe-btn hs-comp-toggle-btn" id="ceCollapseRight" title="Collapse sidebar">▶</button>
      </div>
      <div class="hs-comp-ship-preview" id="ceShipPreview">
        <canvas id="ceShipCanvas" width="160" height="200"></canvas>
      </div>
      <div id="ceComponentProps" class="hs-comp-component-props" style="display: none;"></div>
      <div class="hs-comp-section-title">GRAPHICS</div>
      <div class="hs-comp-gen-row">
        <div class="hs-comp-thumb" id="ceCurrentThumb" title="Current"></div>
        <div class="hs-comp-thumb" id="ceGenThumb" title="Generated"></div>
      </div>
      <label class="hs-comp-field-label">PROMPT</label>
      <textarea id="cePrompt" class="hs-comp-prompt" rows="3"></textarea>
      <div class="hs-comp-fields">
        <label>OUT SIZE
          <select id="ceOutSize">
            <option value="8">8</option>
            <option value="16">16</option>
            <option value="32">32</option>
            <option value="64">64</option>
            <option value="128">128</option>
          </select>
        </label>
        <label>GEN SIZE
          <select id="ceGenSize">
            <option value="256">256</option>
            <option value="512">512</option>
            <option value="768">768</option>
            <option value="1024">1024</option>
          </select>
        </label>
        <label>COLORS
          <input type="number" id="ceColors" min="2" max="15" step="1" value="15" title="Base gray shades (excl. BG)">
        </label>
        <label>BG
          <input type="color" id="ceBg" value="#FF00FF" title="Background / chroma key (separate from base colors)">
        </label>
        <label>STEPS
          <input type="number" id="ceSteps" min="1" max="12" value="4">
        </label>
        <label>SEED
          <input type="text" id="ceSeed" placeholder="random">
        </label>
        <label>HULL SCALE
          <input type="range" id="ceScale" min="25" max="300" step="5" value="100">
          <span id="ceScaleLabel">100%</span>
        </label>
        <label>LENGTH
          <input type="range" id="ceLength" min="25" max="150" step="5" value="100">
          <span id="ceLengthLabel">100%</span>
        </label>
      </div>
      <div class="hs-comp-actions">
        <button type="button" class="action-button pe-btn pe-primary" id="ceGenerate">GENERATE</button>
        <button type="button" class="action-button pe-btn" id="ceAccept">ACCEPT</button>
        <button type="button" class="action-button pe-btn" id="ceDiscard">DISCARD</button>
        <button type="button" class="action-button pe-btn" id="ceSaveMeta">SAVE META</button>
        <button type="button" class="action-button pe-btn" id="ceOpenAg">ASSET GEN</button>
      </div>
      <div class="hs-comp-status" id="ceStatus"></div>
    </div>
  </aside>
</div>`;
    }

    toggleLeftSidebar(collapse) {
        if (collapse != null) this.leftCollapsed = !!collapse;
        else this.leftCollapsed = !this.leftCollapsed;
        try {
            localStorage.setItem("vf_ce_left_collapsed", String(this.leftCollapsed));
        } catch (e) {}
        this.applySidebarCollapse();
    }

    toggleRightSidebar(collapse) {
        if (collapse != null) this.rightCollapsed = !!collapse;
        else this.rightCollapsed = !this.rightCollapsed;
        try {
            localStorage.setItem("vf_ce_right_collapsed", String(this.rightCollapsed));
        } catch (e) {}
        this.applySidebarCollapse();
    }

    applySidebarCollapse() {
        const r = this.root;
        if (!r) return;
        const layout = r.querySelector(".hs-comp-layout");
        const leftCol = r.querySelector("#ceLeftCol");
        const rightCol = r.querySelector("#ceRightCol");
        if (layout) {
            layout.classList.toggle("left-collapsed", !!this.leftCollapsed);
            layout.classList.toggle("right-collapsed", !!this.rightCollapsed);
        }
        if (leftCol) leftCol.classList.toggle("is-collapsed", !!this.leftCollapsed);
        if (rightCol) rightCol.classList.toggle("is-collapsed", !!this.rightCollapsed);
        this.drawCenter();
        this.drawShipPreview();
    }

    mount(hostEl, opts) {
        if (!hostEl) return;
        this.unmount();
        this.embedded = true;
        this.hostEl = hostEl;
        this.visible = true;
        this.applyOpts(opts);
        hostEl.innerHTML = this.buildShellHtml();
        this.root = hostEl;
        this.bindRoot();
        this.ensureMeta().then(() => {
            this.refreshAll();
            this.startShipPreview();
        });
    }

    open(opts) {
        this.applyOpts(opts);
        if (opts && opts.host) {
            this.mount(opts.host, opts);
            return;
        }
        this.ensureOverlay();
        this.embedded = false;
        this.visible = true;
        this.overlay.classList.remove("hidden");
        this.root = this.overlay.querySelector("#ceOverlayBody");
        if (this.root && !this.root.querySelector(".hs-comp-layout")) {
            this.root.innerHTML = this.buildShellHtml();
        }
        this.bindRoot();
        this.hideBackgroundUI();
        this.startDropdownObserver();
        document.addEventListener("keydown", this._keyHandler, true);
        this.ensureMeta().then(() => {
            this.refreshAll();
            this.startShipPreview();
        });
    }

    applyOpts(opts) {
        const o = opts || {};
        let touched = false;
        if (o.type && this.ingameTypeIds().indexOf(o.type) >= 0) {
            this.typeId = o.type;
            touched = true;
        }
        if (o.id) {
            this.selectedId = String(o.id);
            touched = true;
        }
        if (touched) this.persistSelection();
        if (o.returnTo != null) this.returnTo = o.returnTo;
        if (o.onClose) this.onClose = o.onClose;
    }

    ensureOverlay() {
        if (this.overlay) return;
        const el = document.createElement("div");
        el.id = "componentEditorOverlay";
        el.className = "planet-editor-overlay component-editor-overlay hidden";
        el.innerHTML = `
            <div class="planet-editor-panel hs-comp-overlay-panel">
                <div class="planet-editor-header">
                    <h2>COMPONENT EDITOR</h2>
                    <button type="button" class="pe-btn" id="ceOverlayClose">CLOSE</button>
                </div>
                <div class="planet-editor-body hs-comp-overlay-body" id="ceOverlayBody"></div>
            </div>`;
        document.body.appendChild(el);
        el.querySelector("#ceOverlayClose").addEventListener("click", () => this.hide());
        this.overlay = el;
    }

    unmount() {
        if (this._canvasResizeObs) {
            this._canvasResizeObs.disconnect();
            this._canvasResizeObs = null;
        }
        this.leavePreviewFullscreen();
        this.stopShipPreview();
        if (this.embedded && this.hostEl) {
            this.hostEl.innerHTML = "";
        }
        this.hostEl = null;
        this.root = null;
        this.embedded = false;
        this._bound = false;
    }

    hide() {
        if (this._canvasResizeObs) {
            this._canvasResizeObs.disconnect();
            this._canvasResizeObs = null;
        }
        if (this._dropdownObs) {
            this._dropdownObs.disconnect();
            this._dropdownObs = null;
        }
        this.leavePreviewFullscreen();
        this.stopShipPreview();
        this.visible = false;
        this.showBackgroundUI();
        document.removeEventListener("keydown", this._keyHandler, true);
        if (this.overlay) this.overlay.classList.add("hidden");
        if (this.embedded) this.unmount();
        const cb = this.onClose;
        this.onClose = null;
        if (typeof cb === "function") cb();
    }

    hideBackgroundUI() {
        // Store original styles for restoration
        if (!this._originalStyles) this._originalStyles = new Map();
        
        // Hide ONLY hangar slot select dropdowns, NOT component editor selects
        const slotSelects = document.querySelectorAll(".hs-hangar-slot-select");
        slotSelects.forEach(s => {
            if (!this._originalStyles.has(s)) {
                this._originalStyles.set(s, s.style.display);
            }
            s.style.display = "none";
        });
        
        // Hide weapon/defense/ability/energy dropdowns in home-station (NOT in component-editor)
        const homeOverlay = document.querySelector(".home-station-overlay");
        if (homeOverlay) {
            const selects = homeOverlay.querySelectorAll("select");
            selects.forEach(s => {
                // SKIP if this select is inside the component editor
                if (s.closest("#ceComponentProps")) {
                    return;
                }
                // SKIP if this is a component properties select
                if (s.id && (s.id.startsWith("ceComponent") || s.id.startsWith("ce"))) {
                    return;
                }
                if (!this._originalStyles.has(s)) {
                    this._originalStyles.set(s, s.style.display);
                }
                s.style.display = "none";
            });
        }
        
        // Lower z-index of home-station but don't disable pointer events
        const hs = document.querySelector(".home-station-overlay");
        if (hs) {
            if (!this._originalStyles.has(hs)) {
                this._originalStyles.set(hs, hs.style.zIndex);
            }
            hs.style.zIndex = "10";
        }
    }

    showBackgroundUI() {
        if (!this._originalStyles) return;
        
        // Restore all styles
        this._originalStyles.forEach((originalStyle, el) => {
            if (el.style) {
                el.style.display = originalStyle;
                el.style.zIndex = originalStyle;
            }
        });
        this._originalStyles.clear();
    }

    startDropdownObserver() {
        if (this._dropdownObs) return;
        
        // Watch for new dropdowns being added and hide them
        this._dropdownObs = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    // Hide new hangar slot selects
                    const newSlotSelects = mutation.target.querySelectorAll(".hs-hangar-slot-select");
                    newSlotSelects.forEach(s => {
                        s.style.display = "none";
                    });
                    
                    // Hide new regular selects in home-station-overlay
                    const newSelects = mutation.target.querySelectorAll("select, input[type='select']");
                    newSelects.forEach(s => {
                        if (s.closest(".home-station-overlay") && !s.closest(".hs-comp-layout")) {
                            s.style.display = "none";
                        }
                    });
                }
            });
        });
        
        // Start observing for changes in the home-station-overlay
        const hs = document.querySelector(".home-station-overlay");
        if (hs) {
            this._dropdownObs.observe(hs, {
                childList: true,
                subtree: true
            });
        }
    }

    handleKeyDown(e) {
        if (e.key !== "Escape") return;
        if (!this._previewFs) return;
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
        this.leavePreviewFullscreen();
    }

    bindRoot() {
        const r = this.root;
        if (!r) return;
        this._bound = true;

        const genBtn = r.querySelector("#ceGenerate");
        if (!genBtn) return;
        genBtn.onclick = () => this.onGenerate();
        r.querySelector("#ceAccept").onclick = () => this.onAccept();
        r.querySelector("#ceDiscard").onclick = () => this.clearStaging();
        r.querySelector("#ceSaveMeta").onclick = () => this.onSaveMeta();
        r.querySelector("#ceOpenAg").onclick = () => this.openAssetGen();

        const scale = r.querySelector("#ceScale");
        if (scale) {
            scale.oninput = () => {
                this.displayScale = Math.max(0.25, Math.min(3, Number(scale.value) / 100));
                const lab = r.querySelector("#ceScaleLabel");
                if (lab) lab.textContent = Math.round(this.displayScale * 100) + "%";
                this.persistMetaFields();
                this.drawCenter();
                this.drawShipPreview();
            };
        }
        const length = r.querySelector("#ceLength");
        if (length) {
            length.oninput = () => {
                this.lengthScale = Math.max(0.25, Math.min(1.5, Number(length.value) / 100));
                const lab = r.querySelector("#ceLengthLabel");
                if (lab) lab.textContent = Math.round(this.lengthScale * 100) + "%";
                this.persistMetaFields();
                this.drawCenter();
                this.drawShipPreview();
            };
        }
        ["ceOutSize", "ceGenSize", "ceSteps", "ceSeed"].forEach((id) => {
            const el = r.querySelector("#" + id);
            if (el) el.onchange = () => {
                this.readGenFields();
                if (id === "ceOutSize") this.reloadEditBuffer(true);
            };
        });
        const colorsEl = r.querySelector("#ceColors");
        if (colorsEl) {
            colorsEl.value = String(this.colorCount);
            colorsEl.onchange = () => this.setColorCount(colorsEl.value);
            colorsEl.oninput = () => this.setColorCount(colorsEl.value, true);
        }
        const bgEl = r.querySelector("#ceBg");
        if (bgEl) {
            bgEl.value = this.normalizeHex(this.bgColor);
            bgEl.oninput = () => this.setBgColor(bgEl.value);
            bgEl.onchange = () => this.setBgColor(bgEl.value);
        }
        const prompt = r.querySelector("#cePrompt");
        if (prompt) {
            prompt.onchange = () => { /* kept live */ };
        }

        const colLeft = r.querySelector("#ceCollapseLeft");
        const expLeft = r.querySelector("#ceExpandLeft");
        if (colLeft) colLeft.onclick = (e) => { e.stopPropagation(); this.toggleLeftSidebar(true); };
        if (expLeft) expLeft.onclick = () => this.toggleLeftSidebar(false);

        const colRight = r.querySelector("#ceCollapseRight");
        const expRight = r.querySelector("#ceExpandRight");
        if (colRight) colRight.onclick = (e) => { e.stopPropagation(); this.toggleRightSidebar(true); };
        if (expRight) expRight.onclick = () => this.toggleRightSidebar(false);

        const drawBtn = r.querySelector("#ceToolDraw");
        const eraseBtn = r.querySelector("#ceToolErase");
        if (drawBtn) drawBtn.onclick = () => this.setPaintTool("draw");
        if (eraseBtn) eraseBtn.onclick = () => this.setPaintTool("erase");
        
        this.renderPalette();
        
        r.querySelectorAll(".hs-comp-size-btn").forEach((btn) => {
            btn.onclick = () => {
                const sz = parseInt(btn.getAttribute("data-ce-size"), 10) || 1;
                this.setBrushSize(sz);
            };
        });
        this.setBrushSize(this._brushSize || 1);

        const shade = r.querySelector("#ceShade");
        if (shade) {
            const shades = this.getPaletteShades();
            shade.min = "1";
            shade.max = String(shades.length);
            const idx = Math.max(0, shades.indexOf(this._paintShade));
            shade.value = String(idx + 1);
            shade.oninput = () => {
                const shadesNow = this.getPaletteShades();
                const i = Math.max(0, Math.min(shadesNow.length - 1, (parseInt(shade.value, 10) || 1) - 1));
                this.setPaintShade(shadesNow[i]);
                this.setPaintTool("draw");
            };
        }
        const sym = r.querySelector("#ceSymmetry");
        if (sym) {
            sym.checked = !!this.symmetric;
            sym.onchange = () => {
                this.symmetric = !!sym.checked;
                this.persistMetaFields();
                try {
                    localStorage.setItem("vf_ce_symmetry_last", String(this.symmetric));
                } catch (e) {}
                this.drawCenter();
            };
        }
        const applySym = r.querySelector("#ceApplySym");
        if (applySym) applySym.onclick = () => this.applySymmetryMirror();
        const clearPx = r.querySelector("#ceClearPx");
        if (clearPx) clearPx.onclick = () => this.clearPixels();
        const savePx = r.querySelector("#ceSavePixels");
        if (savePx) savePx.onclick = () => this.onSavePixels();

        const wrap = r.querySelector("#ceCanvasWrap");
        const canvas = r.querySelector("#ceCanvas");
        if (wrap) {
            if (this._canvasResizeObs) {
                this._canvasResizeObs.disconnect();
                this._canvasResizeObs = null;
            }
            if (typeof ResizeObserver !== "undefined") {
                this._canvasResizeObs = new ResizeObserver(() => {
                    if (this.visible && this.root && this.root.isConnected) {
                        this.drawCenter();
                    }
                });
                this._canvasResizeObs.observe(wrap);
            }
            wrap.oncontextmenu = (e) => e.preventDefault();
            wrap.removeEventListener("wheel", this._onViewWheel);
            wrap.addEventListener("wheel", this._onViewWheel, { passive: false });
            wrap.ondblclick = (e) => {
                if (e.target !== wrap && e.target !== canvas) return;
                this.resetView();
            };
        }
        if (canvas) {
            canvas.style.cursor = "crosshair";
            canvas.oncontextmenu = (e) => e.preventDefault();
            canvas.onmousedown = (e) => this.onPaintDown(e);
        }

        const preview = r.querySelector("#ceShipPreview");
        const shipCanvas = r.querySelector("#ceShipCanvas");
        if (preview && shipCanvas) {
            preview.onmouseenter = null;
            preview.onmouseleave = null;
            preview.onclick = null;
            shipCanvas.style.cursor = "zoom-in";
            shipCanvas.onmousemove = (e) => this.onPreviewMouseMove(e);
            shipCanvas.onmouseleave = () => this.onPreviewMouseLeave();
            shipCanvas.onclick = (e) => this.onPreviewClick(e);
        }
        this.setPaintTool(this._paintTool || "draw");
        this.updatePaletteSelection();
    }

    normalizeHex(hex) {
        if (!hex || typeof hex !== "string") return "#FF00FF";
        let h = hex.trim();
        if (h.charAt(0) !== "#") h = "#" + h;
        if (/^#[0-9A-Fa-f]{3}$/.test(h)) {
            h = "#" + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
        }
        if (!/^#[0-9A-Fa-f]{6}$/.test(h)) return "#FF00FF";
        return h.toUpperCase();
    }

    getPaletteShades() {
        const n = Math.max(2, Math.min(this._maxShades, this.colorCount | 0 || 15));
        if (n >= this._maxShades) {
            const all = [];
            for (let s = 1; s <= this._maxShades; s++) all.push(s);
            return all;
        }
        const out = [];
        for (let i = 0; i < n; i++) {
            out.push(Math.max(1, Math.round(1 + (i * (this._maxShades - 1)) / (n - 1))));
        }
        return out;
    }

    persistPixelColorSettings() {
        try {
            localStorage.setItem("vf_pixel_colors", String(this.colorCount));
            localStorage.setItem("vf_pixel_bg", this.normalizeHex(this.bgColor));
        } catch (e) { /* ignore */ }
    }

    setColorCount(val, live) {
        const n = Math.max(2, Math.min(this._maxShades, parseInt(val, 10) || 15));
        this.colorCount = n;
        if (!live) this.persistPixelColorSettings();
        else {
            try { localStorage.setItem("vf_pixel_colors", String(n)); } catch (e) {}
        }
        const shades = this.getPaletteShades();
        if (shades.indexOf(this._paintShade) < 0) {
            this._paintShade = shades[Math.min(shades.length - 1, Math.floor(shades.length * 0.75))];
        }
        const r = this.root;
        if (r) {
            const el = r.querySelector("#ceColors");
            if (el && document.activeElement !== el) el.value = String(n);
            const shade = r.querySelector("#ceShade");
            if (shade) {
                shade.min = "1";
                shade.max = String(shades.length);
                const idx = Math.max(0, shades.indexOf(this._paintShade));
                shade.value = String(idx + 1);
            }
        }
        this.renderPalette();
        this.setPaintShade(this._paintShade);
        this.drawCenter();
        this.drawShipPreview();
    }

    setBgColor(val) {
        this.bgColor = this.normalizeHex(val);
        this.persistPixelColorSettings();
        const r = this.root;
        if (r) {
            const el = r.querySelector("#ceBg");
            if (el) el.value = this.bgColor;
        }
        this.drawCenter();
        this.drawShipPreview();
    }

    renderPalette() {
        const box = this.root && this.root.querySelector("#cePalette");
        if (!box) return;
        box.innerHTML = "";
        const shades = this.getPaletteShades();
        // BG swatch (not a paint shade — erase / transparent key)
        const bgBtn = document.createElement("button");
        bgBtn.type = "button";
        bgBtn.className = "hs-comp-swatch hs-comp-swatch-bg" + (this._paintTool === "erase" ? " active" : "");
        bgBtn.style.backgroundColor = this.bgColor;
        bgBtn.title = "BG " + this.bgColor + " (erase)";
        bgBtn.addEventListener("click", () => this.setPaintTool("erase"));
        box.appendChild(bgBtn);
        shades.forEach((s, i) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "hs-comp-swatch" + (s === this._paintShade && this._paintTool === "draw" ? " active" : "");
            btn.dataset.ceShade = String(s);
            const gray = this.shadeToGray(s);
            btn.style.backgroundColor = "rgb(" + gray + "," + gray + "," + gray + ")";
            btn.title = "Color " + (i + 1) + "/" + shades.length + " · shade " + s + " (" + gray + ")";
            btn.addEventListener("click", () => {
                this.setPaintShade(s);
                this.setPaintTool("draw");
            });
            box.appendChild(btn);
        });
    }

    setPaintShade(val) {
        const shades = this.getPaletteShades();
        let s = parseInt(val, 10);
        if (shades.indexOf(s) < 0) {
            // Snap to nearest palette shade
            let best = shades[0];
            let bestDist = Infinity;
            for (let i = 0; i < shades.length; i++) {
                const dist = Math.abs(shades[i] - s);
                if (dist < bestDist) {
                    bestDist = dist;
                    best = shades[i];
                }
            }
            s = best || shades[Math.min(shades.length - 1, Math.floor(shades.length * 0.75))] || 12;
        }
        this._paintShade = s;
        const r = this.root;
        if (!r) return;
        const shade = r.querySelector("#ceShade");
        if (shade) {
            shade.min = "1";
            shade.max = String(shades.length);
            const idx = Math.max(0, shades.indexOf(this._paintShade));
            shade.value = String(idx + 1);
        }
        const lab = r.querySelector("#ceShadeLabel");
        if (lab) lab.textContent = String(Math.max(1, shades.indexOf(this._paintShade) + 1));
        this.updatePaletteSelection();
    }

    updatePaletteSelection() {
        const r = this.root;
        if (!r) return;
        r.querySelectorAll(".hs-comp-swatch").forEach((btn) => {
            if (btn.classList.contains("hs-comp-swatch-bg")) {
                btn.classList.toggle("active", this._paintTool === "erase");
                return;
            }
            const s = parseInt(btn.dataset.ceShade, 10);
            btn.classList.toggle("active", s === this._paintShade && this._paintTool === "draw");
        });
    }

    setBrushSize(size) {
        this._brushSize = Math.max(1, Math.min(8, parseInt(size, 10) || 1));
        try {
            localStorage.setItem("vf_ce_brush_size", String(this._brushSize));
        } catch (e) {}
        const r = this.root;
        if (!r) return;
        r.querySelectorAll(".hs-comp-size-btn").forEach((btn) => {
            const sz = parseInt(btn.getAttribute("data-ce-size"), 10);
            btn.classList.toggle("pe-primary", sz === this._brushSize);
        });
    }

    setPaintTool(tool) {
        this._paintTool = tool === "erase" ? "erase" : "draw";
        const r = this.root;
        if (!r) return;
        const drawBtn = r.querySelector("#ceToolDraw");
        const eraseBtn = r.querySelector("#ceToolErase");
        if (drawBtn) drawBtn.classList.toggle("pe-primary", this._paintTool === "draw");
        if (eraseBtn) eraseBtn.classList.toggle("pe-primary", this._paintTool === "erase");
        this.updatePaletteSelection();
    }

    _previewCanvasPos(e) {
        const canvas = this.root && this.root.querySelector("#ceShipCanvas");
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return null;
        return {
            x: (e.clientX - rect.left) * (canvas.width / rect.width),
            y: (e.clientY - rect.top) * (canvas.height / rect.height)
        };
    }

    _hitTestPreview(x, y) {
        const hits = this._previewHits || [];
        for (let i = hits.length - 1; i >= 0; i--) {
            const h = hits[i];
            if (x >= h.x && x < h.x + h.w && y >= h.y && y < h.y + h.h) return h;
        }
        return null;
    }

    onPreviewMouseMove(e) {
        const pos = this._previewCanvasPos(e);
        if (!pos) return;
        const hit = this._hitTestPreview(pos.x, pos.y);
        const key = hit ? hit.key : null;
        const prev = this._hoverHit ? this._hoverHit.key : null;
        this._hoverHit = hit;
        const canvas = this.root && this.root.querySelector("#ceShipCanvas");
        if (canvas) canvas.style.cursor = hit ? "pointer" : (this._previewFs ? "zoom-out" : "zoom-in");
        if (key !== prev) this.drawShipPreview();
    }

    onPreviewMouseLeave() {
        if (!this._hoverHit) return;
        this._hoverHit = null;
        const canvas = this.root && this.root.querySelector("#ceShipCanvas");
        if (canvas) canvas.style.cursor = this._previewFs ? "zoom-out" : "zoom-in";
        this.drawShipPreview();
    }

    onPreviewClick(e) {
        e.preventDefault();
        e.stopPropagation();
        const pos = this._previewCanvasPos(e);
        const hit = pos ? this._hitTestPreview(pos.x, pos.y) : null;
        if (hit) {
            this.selectPreviewHit(hit);
            return;
        }
        this.togglePreviewFullscreen();
    }

    selectPreviewHit(hit) {
        if (!hit) return;
        let entry = hit.entry || null;
        if (!entry && typeof assetGenRegistry !== "undefined" && assetGenRegistry.findByKey) {
            entry = assetGenRegistry.findByKey(hit.key)
                || assetGenRegistry.findByKey(hit.modId)
                || assetGenRegistry.findByKey("mount_" + hit.modId);
        }
        if (!entry) return;
        const typeId = this.ingameTypeIds().indexOf(entry.type) >= 0
            ? entry.type
            : (String(entry.spriteKey || entry.id).indexOf("mount_") === 0 ? "mount" : null);
        if (!typeId) return;
        if (this.typeId === typeId && this.selectedId === entry.id) return;
        this.typeId = typeId;
        this.selectedId = entry.id;
        this.persistSelection();
        this.clearStaging();
        this.refreshAll();
    }

    togglePreviewFullscreen() {
        if (this._previewFs) this.leavePreviewFullscreen();
        else this.enterPreviewFullscreen();
    }

    enterPreviewFullscreen() {
        const wrap = this.root && this.root.querySelector("#ceShipPreview");
        const canvas = this.root && this.root.querySelector("#ceShipCanvas");
        if (!wrap || !canvas || this._previewFs) return;
        this._previewFs = true;
        this._hoverHit = null;
        wrap.classList.add("is-fs");
        canvas.width = 480;
        canvas.height = 600;
        if (this.embedded) document.addEventListener("keydown", this._keyHandler, true);
        this.drawShipPreview();
    }

    leavePreviewFullscreen() {
        const wrap = this.root && this.root.querySelector("#ceShipPreview");
        const canvas = this.root && this.root.querySelector("#ceShipCanvas");
        if (!this._previewFs) return;
        this._previewFs = false;
        this._hoverHit = null;
        if (wrap) wrap.classList.remove("is-fs");
        if (canvas) {
            canvas.width = 160;
            canvas.height = 200;
        }
        if (this.embedded) document.removeEventListener("keydown", this._keyHandler, true);
        this.drawShipPreview();
    }

    refreshAll() {
        this.renderTypeChips();
        this.renderList();
        this.loadEntryFields();
        this.drawCenter();
        this.drawCurrentThumb();
        this.drawGenThumb();
        this.setStatus(this.statusText || "");
        this.renderComponentProperties();
        this.drawShipPreview();
    }

    renderTypeChips() {
        const box = this.root && this.root.querySelector("#ceTypeChips");
        if (!box) return;
        box.innerHTML = this.INGAME_TYPES.map((t) =>
            `<button type="button" class="hs-comp-chip${t.id === this.typeId ? " active" : ""}" data-ce-type="${t.id}">${t.label}</button>`
        ).join("");
        box.querySelectorAll("[data-ce-type]").forEach((btn) => {
            btn.addEventListener("click", () => {
                this.typeId = btn.getAttribute("data-ce-type");
                this.selectedId = this._selByType[this.typeId] || null;
                this.persistSelection();
                this.clearStaging();
                this.refreshAll();
            });
        });
    }

    renderList() {
        const list = this.root && this.root.querySelector("#ceList");
        if (!list) return;
        const entries = this.listEntries();
        if (this.selectedId && !entries.some((e) => e.id === this.selectedId)) {
            this.selectedId = null;
        }
        if (!this.selectedId && entries[0]) {
            this.selectedId = entries[0].id;
            this.persistSelection();
        }
        list.innerHTML = "";
        entries.forEach((entry) => {
            const row = document.createElement("button");
            row.type = "button";
            row.className = "hs-comp-list-item" + (entry.id === this.selectedId ? " active" : "");
            row.dataset.id = entry.id;
            const thumb = document.createElement("span");
            thumb.className = "hs-comp-list-thumb";
            this.drawThumbInto(thumb, entry, 24);
            const label = document.createElement("span");
            label.textContent = entry.label;
            row.appendChild(thumb);
            row.appendChild(label);
            row.addEventListener("click", () => {
                this.selectedId = entry.id;
                this.persistSelection();
                this.clearStaging();
                this.loadEntryFields();
                this.renderList();
                this.drawCenter();
                this.drawCurrentThumb();
                this.drawGenThumb();
                this.drawShipPreview();
            });
            list.appendChild(row);
        });
    }

    loadEntryFields() {
        const entry = this.currentEntry();
        const r = this.root;
        if (!r || !entry) return;
        const key = entry.spriteKey || entry.id;
        const metaOut = (typeof spriteMeta !== "undefined")
            ? spriteMeta.getOutSize(key, entry.size || 64)
            : (entry.size || 64);
        this.outSize = metaOut;
        this.displayScale = (typeof spriteMeta !== "undefined")
            ? spriteMeta.getDisplayScale(key)
            : 1;
        this.lengthScale = (typeof spriteMeta !== "undefined" && spriteMeta.getLengthScale)
            ? spriteMeta.getLengthScale(key)
            : 1;
        let symVal = null;
        if (typeof spriteMeta !== "undefined" && spriteMeta.get) {
            const m = spriteMeta.get(key);
            if (m && m.symmetric != null) {
                symVal = !!m.symmetric;
            }
        }
        if (symVal == null) {
            try {
                const last = localStorage.getItem("vf_ce_symmetry_last");
                if (last != null) symVal = last === "true";
            } catch (e) {}
        }
        if (symVal == null) symVal = true;
        this.symmetric = symVal;
        const prompt = r.querySelector("#cePrompt");
        if (prompt && document.activeElement !== prompt) {
            prompt.value = entry.promptSuffix || "";
        }
        const outEl = r.querySelector("#ceOutSize");
        if (outEl) outEl.value = String(this.outSize);
        const genEl = r.querySelector("#ceGenSize");
        if (genEl) genEl.value = String(this.genSize);
        const stepsEl = r.querySelector("#ceSteps");
        if (stepsEl) stepsEl.value = String(this.steps);
        const seedEl = r.querySelector("#ceSeed");
        if (seedEl) seedEl.value = this.seed != null ? String(this.seed) : "";
        const scaleEl = r.querySelector("#ceScale");
        if (scaleEl) scaleEl.value = String(Math.round(this.displayScale * 100));
        const scaleLab = r.querySelector("#ceScaleLabel");
        if (scaleLab) scaleLab.textContent = Math.round(this.displayScale * 100) + "%";
        const lenEl = r.querySelector("#ceLength");
        if (lenEl) lenEl.value = String(Math.round(this.lengthScale * 100));
        const lenLab = r.querySelector("#ceLengthLabel");
        if (lenLab) lenLab.textContent = Math.round(this.lengthScale * 100) + "%";
        const symEl = r.querySelector("#ceSymmetry");
        if (symEl) symEl.checked = !!this.symmetric;
        const colorsEl = r.querySelector("#ceColors");
        if (colorsEl) colorsEl.value = String(this.colorCount);
        const bgEl = r.querySelector("#ceBg");
        if (bgEl) bgEl.value = this.normalizeHex(this.bgColor);
        const selLab = r.querySelector("#ceSelectedLabel");
        if (selLab) selLab.textContent = entry.label + " · " + entry.type;
        this.renderPalette();
        this.reloadEditBuffer(false);
    }

    readGenFields() {
        const r = this.root;
        if (!r) return;
        this.outSize = parseInt(r.querySelector("#ceOutSize").value, 10) || 64;
        this.genSize = parseInt(r.querySelector("#ceGenSize").value, 10) || 512;
        this.steps = parseInt(r.querySelector("#ceSteps").value, 10) || 4;
        this.seed = String(r.querySelector("#ceSeed").value || "").trim();
        this.persistMetaFields();
    }

    persistMetaFields() {
        const entry = this.currentEntry();
        if (!entry || typeof spriteMeta === "undefined") return;
        const key = entry.spriteKey || entry.id;
        spriteMeta.set(key, {
            displayScale: this.displayScale,
            lengthScale: this.lengthScale,
            symmetric: !!this.symmetric,
            outSize: this.outSize
        });
    }

    setStatus(msg) {
        this.statusText = msg || "";
        const el = this.root && this.root.querySelector("#ceStatus");
        if (el) el.textContent = this.statusText;
    }

    clearStaging() {
        this.stagingId = null;
        this.previewDataUrl = null;
        this.drawGenThumb();
        this.setStatus("");
    }

    drawThumbInto(box, entry, size) {
        if (typeof assetGenUI !== "undefined" && assetGenUI.drawThumbInto) {
            assetGenUI.drawThumbInto(box, entry, size);
            return;
        }
        box.innerHTML = "";
        const span = document.createElement("span");
        span.textContent = "·";
        box.appendChild(span);
    }

    drawCurrentThumb() {
        const box = this.root && this.root.querySelector("#ceCurrentThumb");
        if (!box) return;
        box.innerHTML = "";
        this.drawThumbInto(box, this.currentEntry(), 72);
    }

    drawGenThumb() {
        const box = this.root && this.root.querySelector("#ceGenThumb");
        if (!box) return;
        box.innerHTML = "";
        if (!this.previewDataUrl) {
            const miss = document.createElement("span");
            miss.textContent = "(gen)";
            miss.style.color = "#666";
            box.appendChild(miss);
            return;
        }
        const px = 72;
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = px;
            canvas.height = px;
            const ctx = canvas.getContext("2d");
            ctx.imageSmoothingEnabled = false;
            this.drawTrimmedImage(ctx, img, px, px);
            box.innerHTML = "";
            box.appendChild(canvas);
        };
        img.src = this.previewDataUrl;
    }

    drawCenter() {
        const wrap = this.root && this.root.querySelector("#ceCanvasWrap");
        const canvas = this.root && this.root.querySelector("#ceCanvas");
        if (!canvas) return;

        if (wrap) {
            const rw = Math.max(1, Math.floor(wrap.clientWidth));
            const rh = Math.max(1, Math.floor(wrap.clientHeight));
            if (rw > 0 && rh > 0 && (canvas.width !== rw || canvas.height !== rh)) {
                canvas.width = rw;
                canvas.height = rh;
            }
        }

        const ctx = canvas.getContext("2d");
        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = this.bgColor || "#FF00FF";
        ctx.globalAlpha = 0.55;
        ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = 1;

        this.ensureEditBufferSync();
        const edit = this._editCanvas;
        if (!edit) {
            this._drawMap = null;
            return;
        }

        const size = edit.width;
        const length = this.lengthScale || 1;
        const zoom = Math.max(0.25, Math.min(8, this.viewZoom || 1));
        const pad = 36;
        const availW = Math.max(32, w - pad * 2);
        const availH = Math.max(32, h - pad * 2);
        const maxCellW = availW / size;
        const maxCellH = availH / (size * length);
        const baseCell = Math.max(1, Math.min(maxCellW, maxCellH));
        // Keep every source row on an integer pixel height. Scaling the whole
        // image to an arbitrary height makes rows land on fractional pixels
        // and produces uneven/blurry pixel art even with smoothing disabled.
        const cell = Math.max(1, Math.round(baseCell * zoom));
        const rowCell = Math.max(1, Math.round(cell * length));
        const drawW = cell * size;
        const drawH = rowCell * size;
        const dx = Math.floor((w - drawW) / 2) + Math.round(this.viewPanX || 0);
        const dy = Math.floor((h - drawH) / 2) + Math.round(this.viewPanY || 0);
        this._drawMap = { dx: dx, dy: dy, cell: cell, size: size, drawW: drawW, drawH: drawH };

        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(edit, 0, 0, size, size, dx, dy, drawW, drawH);

        // Pixel grid
        if (cell >= 4) {
            ctx.strokeStyle = "rgba(255,255,255,0.08)";
            ctx.lineWidth = 1;
            for (let i = 0; i <= size; i++) {
                const gx = dx + i * cell + 0.5;
                ctx.beginPath();
                ctx.moveTo(gx, dy);
                ctx.lineTo(gx, dy + drawH);
                ctx.stroke();
            }
            const rowH = drawH / size;
            for (let i = 0; i <= size; i++) {
                const gy = dy + i * rowH + 0.5;
                ctx.beginPath();
                ctx.moveTo(dx, gy);
                ctx.lineTo(dx + drawW, gy);
                ctx.stroke();
            }
        }
        if (this.symmetric) {
            ctx.strokeStyle = "rgba(180,180,180,0.35)";
            ctx.setLineDash([3, 3]);
            const mx = dx + drawW / 2 + 0.5;
            ctx.beginPath();
            ctx.moveTo(mx, dy);
            ctx.lineTo(mx, dy + drawH);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }

    ensureEditBufferSync() {
        const entry = this.currentEntry();
        if (!entry) {
            this._editCanvas = null;
            return;
        }
        const size = this.outSize || entry.size || 8;
        const key = String(entry.spriteKey || entry.id);
        if (this._editCanvas && this._editKey === key && this._editSize === size) return;
        this.reloadEditBuffer(false);
    }

    reloadEditBuffer(force) {
        const entry = this.currentEntry();
        if (!entry) {
            this._editCanvas = null;
            this._editKey = null;
            this._editSize = 0;
            return;
        }
        const size = this.outSize || entry.size || 8;
        const key = String(entry.spriteKey || entry.id);
        if (!force && this._editCanvas && this._editKey === key && this._editSize === size && this._pixelDirty) {
            this.drawCenter();
            return;
        }
        if (!this._editCanvas) this._editCanvas = document.createElement("canvas");
        this._editCanvas.width = size;
        this._editCanvas.height = size;
        this._editKey = key;
        this._editSize = size;
        this._pixelDirty = false;
        const ctx = this._editCanvas.getContext("2d");
        ctx.clearRect(0, 0, size, size);
        ctx.imageSmoothingEnabled = false;

        if (this.previewDataUrl) {
            const img = new Image();
            img.onload = () => {
                this.drawTrimmedImage(ctx, img, size, size);
                this.desaturateEdit();
                this.drawCenter();
                this.drawCurrentThumb();
            };
            img.onerror = () => this._fillEditFromThumb(entry, size);
            img.src = this.previewDataUrl;
            return;
        }
        this._fillEditFromThumb(entry, size);
    }

    drawTrimmedImage(ctx, image, width, height) {
        const source = document.createElement("canvas");
        source.width = image.naturalWidth || image.width;
        source.height = image.naturalHeight || image.height;
        const sourceCtx = source.getContext("2d", { willReadFrequently: true });
        sourceCtx.drawImage(image, 0, 0);
        const pixels = sourceCtx.getImageData(0, 0, source.width, source.height).data;
        let minX = source.width;
        let minY = source.height;
        let maxX = -1;
        let maxY = -1;
        for (let y = 0; y < source.height; y++) {
            for (let x = 0; x < source.width; x++) {
                if (pixels[(y * source.width + x) * 4 + 3] < 16) continue;
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x);
                maxY = Math.max(maxY, y);
            }
        }
        if (maxX < 0) return;
        const sw = maxX - minX + 1;
        const sh = maxY - minY + 1;
        const fit = Math.min(width / sw, height / sh);
        const dw = Math.max(1, Math.round(sw * fit));
        const dh = Math.max(1, Math.round(sh * fit));
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
            source,
            minX, minY, sw, sh,
            Math.floor((width - dw) / 2),
            Math.floor((height - dh) / 2),
            dw, dh
        );
    }

    _fillEditFromThumb(entry, size) {
        const box = document.createElement("div");
        this.drawThumbInto(box, entry, size);
        const child = box.firstChild;
        const ctx = this._editCanvas.getContext("2d");
        if (child && child.tagName === "CANVAS") {
            ctx.drawImage(child, 0, 0, size, size);
            this.desaturateEdit();
        }
        this.drawCenter();
    }

    desaturateEdit() {
        if (!this._editCanvas) return;
        const ctx = this._editCanvas.getContext("2d");
        const imageData = ctx.getImageData(0, 0, this._editCanvas.width, this._editCanvas.height);
        const d = imageData.data;
        const shades = this.getPaletteShades();
        const grays = shades.map((s) => this.shadeToGray(s));
        for (let i = 0; i < d.length; i += 4) {
            if (d[i + 3] === 0) continue;
            let y = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
            let best = grays[0];
            let bestDist = Math.abs(y - best);
            for (let g = 1; g < grays.length; g++) {
                const dist = Math.abs(y - grays[g]);
                if (dist < bestDist) {
                    bestDist = dist;
                    best = grays[g];
                }
            }
            d[i] = d[i + 1] = d[i + 2] = best;
        }
        ctx.putImageData(imageData, 0, 0);
    }

    shadeToGray(shade) {
        const s = Math.max(1, Math.min(this._maxShades, shade | 0));
        // Match iconRenderer 1–15 ramp roughly
        const t = s / this._maxShades;
        return Math.round(44 + t * (248 - 44));
    }

    nearestShadeFromGray(yv) {
        const shades = this.getPaletteShades();
        let best = shades[0];
        let bestDist = Infinity;
        for (let i = 0; i < shades.length; i++) {
            const g = this.shadeToGray(shades[i]);
            const dist = Math.abs(yv - g);
            if (dist < bestDist) {
                bestDist = dist;
                best = shades[i];
            }
        }
        return best;
    }

    canvasPosToPixel(e) {
        const canvas = this.root && this.root.querySelector("#ceCanvas");
        const map = this._drawMap;
        if (!canvas || !map) return null;
        const rect = canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return null;
        const x = (e.clientX - rect.left) * (canvas.width / rect.width);
        const y = (e.clientY - rect.top) * (canvas.height / rect.height);
        if (x < map.dx || y < map.dy || x >= map.dx + map.drawW || y >= map.dy + map.drawH) return null;
        const px = Math.floor((x - map.dx) / map.cell);
        const rowH = map.drawH / map.size;
        const py = Math.floor((y - map.dy) / rowH);
        if (px < 0 || py < 0 || px >= map.size || py >= map.size) return null;
        return { x: px, y: py };
    }

    persistViewZoom() {
        try {
            localStorage.setItem(this._zoomStorageKey, String(this.viewZoom || 1));
        } catch (e) { /* ignore */ }
    }

    onViewWheel(e) {
        e.preventDefault();
        const step = e.deltaY < 0 ? 0.15 : -0.15;
        this.setViewZoom((this.viewZoom || 1) + step, e);
    }

    setViewZoom(zoom, e) {
        const prev = Math.max(0.25, Math.min(8, this.viewZoom || 1));
        const next = Math.max(0.25, Math.min(8, Math.round(zoom * 100) / 100));
        if (next === prev) return;
        if (e && this.root) {
            const canvas = this.root.querySelector("#ceCanvas");
            const map = this._drawMap;
            if (canvas && map) {
                const rect = canvas.getBoundingClientRect();
                if (rect.width && rect.height) {
                    const cx = (e.clientX - rect.left) * (canvas.width / rect.width);
                    const cy = (e.clientY - rect.top) * (canvas.height / rect.height);
                    const ratio = next / prev;
                    this.viewPanX = cx - canvas.width / 2 - (cx - canvas.width / 2 - (this.viewPanX || 0)) * ratio;
                    this.viewPanY = cy - canvas.height / 2 - (cy - canvas.height / 2 - (this.viewPanY || 0)) * ratio;
                }
            }
        }
        this.viewZoom = next;
        this.persistViewZoom();
        this.drawCenter();
    }

    resetView() {
        this.viewZoom = 1;
        this.viewPanX = 0;
        this.viewPanY = 0;
        this.persistViewZoom();
        this.drawCenter();
    }

    onPaintDown(e) {
        if (e.button === 2) {
            e.preventDefault();
            this._panning = true;
            this._panLastX = e.clientX;
            this._panLastY = e.clientY;
            const canvas = this.root && this.root.querySelector("#ceCanvas");
            const wrap = this.root && this.root.querySelector("#ceCanvasWrap");
            if (canvas) canvas.style.cursor = "grabbing";
            if (wrap) wrap.classList.add("is-panning");
            window.addEventListener("mousemove", this._onPanMove);
            window.addEventListener("mouseup", this._onPanUp);
            return;
        }
        if (e.button !== 0) return;
        if (!this._editCanvas) this.reloadEditBuffer(false);
        e.preventDefault();
        this._painting = true;
        this._paintErase = this._paintTool === "erase";
        this.paintAtEvent(e);
        window.addEventListener("mousemove", this._onPaintMove);
        window.addEventListener("mouseup", this._onPaintUp);
    }

    onPanMove(e) {
        if (!this._panning) return;
        const canvas = this.root && this.root.querySelector("#ceCanvas");
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const sx = canvas.width / rect.width;
        const sy = canvas.height / rect.height;
        this.viewPanX = (this.viewPanX || 0) + (e.clientX - this._panLastX) * sx;
        this.viewPanY = (this.viewPanY || 0) + (e.clientY - this._panLastY) * sy;
        this._panLastX = e.clientX;
        this._panLastY = e.clientY;
        this.drawCenter();
    }

    onPanUp() {
        if (!this._panning) return;
        this._panning = false;
        window.removeEventListener("mousemove", this._onPanMove);
        window.removeEventListener("mouseup", this._onPanUp);
        const canvas = this.root && this.root.querySelector("#ceCanvas");
        const wrap = this.root && this.root.querySelector("#ceCanvasWrap");
        if (canvas) canvas.style.cursor = "crosshair";
        if (wrap) wrap.classList.remove("is-panning");
    }

    onPaintMove(e) {
        if (!this._painting) return;
        this.paintAtEvent(e);
    }

    onPaintUp() {
        this._painting = false;
        window.removeEventListener("mousemove", this._onPaintMove);
        window.removeEventListener("mouseup", this._onPaintUp);
    }

    paintAtEvent(e) {
        const pos = this.canvasPosToPixel(e);
        if (!pos) return;
        this.paintPixel(pos.x, pos.y, this._paintErase);
    }

    paintPixel(x, y, erase) {
        if (!this._editCanvas) return;
        const size = this._editCanvas.width;
        if (x < 0 || y < 0 || x >= size || y >= size) return;
        const ctx = this._editCanvas.getContext("2d");
        const bSize = this._brushSize || 1;
        const half = Math.floor(bSize / 2);
        const pts = [];
        const seen = new Set();
        for (let ox = 0; ox < bSize; ox++) {
            for (let oy = 0; oy < bSize; oy++) {
                const px = x + ox - half;
                const py = y + oy - half;
                if (px >= 0 && px < size && py >= 0 && py < size) {
                    const k = px + "," + py;
                    if (!seen.has(k)) {
                        seen.add(k);
                        pts.push([px, py]);
                    }
                    if (this.symmetric) {
                        const mx = size - 1 - px;
                        const mk = mx + "," + py;
                        if (!seen.has(mk)) {
                            seen.add(mk);
                            pts.push([mx, py]);
                        }
                    }
                }
            }
        }
        pts.forEach(([px, py]) => {
            if (erase) {
                ctx.clearRect(px, py, 1, 1);
            } else {
                const g = this.shadeToGray(this._paintShade);
                ctx.fillStyle = "rgb(" + g + "," + g + "," + g + ")";
                ctx.fillRect(px, py, 1, 1);
            }
        });
        this._pixelDirty = true;
        const entry = this.currentEntry();
        if (entry) this.syncModuleSpritesFromEdit(entry.spriteKey || entry.id);
        this.drawCenter();
        this.drawShipPreview();
    }

    applySymmetryMirror(silent) {
        if (!this._editCanvas) return;
        const size = this._editCanvas.width;
        const ctx = this._editCanvas.getContext("2d");
        const src = ctx.getImageData(0, 0, size, size);
        const dst = ctx.createImageData(size, size);
        const s = src.data;
        const d = dst.data;
        const half = Math.ceil(size / 2);
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < half; x++) {
                const i = (y * size + x) * 4;
                const mx = size - 1 - x;
                const mi = (y * size + mx) * 4;
                for (let c = 0; c < 4; c++) {
                    d[i + c] = s[i + c];
                    d[mi + c] = s[i + c];
                }
            }
        }
        ctx.putImageData(dst, 0, 0);
        this.symmetric = true;
        const symEl = this.root && this.root.querySelector("#ceSymmetry");
        if (symEl) symEl.checked = true;
        this._pixelDirty = true;
        this.persistMetaFields();
        const entry = this.currentEntry();
        if (entry) this.syncModuleSpritesFromEdit(entry.spriteKey || entry.id);
        this.drawCenter();
        this.drawShipPreview();
        if (!silent) this.setStatus("Mirrored · left → right");
    }

    clearPixels() {
        if (!this._editCanvas) return;
        const ctx = this._editCanvas.getContext("2d");
        ctx.clearRect(0, 0, this._editCanvas.width, this._editCanvas.height);
        this._pixelDirty = true;
        this.drawCenter();
        this.drawShipPreview();
        this.setStatus("Pixels cleared");
    }

    syncModuleSpritesFromEdit(key) {
        if (!this._editCanvas || !key) return;
        const size = this._editCanvas.width;
        const ctx = this._editCanvas.getContext("2d");
        const data = ctx.getImageData(0, 0, size, size).data;
        const matrix = [];
        for (let y = 0; y < size; y++) {
            const row = [];
            for (let x = 0; x < size; x++) {
                const i = (y * size + x) * 4;
                if (data[i + 3] < 16) {
                    row.push(0);
                    continue;
                }
                const yv = data[i];
                row.push(this.nearestShadeFromGray(yv));
            }
            matrix.push(row);
        }
        const keys = [String(key)];
        const entry = this.currentEntry();
        if (entry) {
            const bare = String(entry.id || "").replace(/^mount_/, "");
            const mountKey = "mount_" + bare;
            if (keys.indexOf(mountKey) < 0) keys.push(mountKey);
            if (entry.spriteKey && keys.indexOf(String(entry.spriteKey)) < 0) {
                keys.push(String(entry.spriteKey));
            }
        }
        if (typeof ModuleSprites !== "undefined" && ModuleSprites) {
            keys.forEach((k) => { ModuleSprites[k] = matrix; });
        }
        // Live ship preview: canvas is a valid drawImage source (overrides PNG until reload)
        if (typeof spriteLoader !== "undefined" && spriteLoader.sprites) {
            keys.forEach((k) => { spriteLoader.sprites.set(k, this._editCanvas); });
        }
        if (typeof iconRenderer !== "undefined" && iconRenderer.clearCache) {
            iconRenderer.clearCache();
        }
    }

    async onSavePixels() {
        const entry = this.currentEntry();
        if (!entry || !this._editCanvas || this.busy) return;
        if (this.symmetric) this.applySymmetryMirror(true);
        this.busy = true;
        this.setStatus("Saving pixels…");
        try {
            const key = entry.spriteKey || entry.id;
            const dataUrl = this._editCanvas.toDataURL("image/png");
            this.syncModuleSpritesFromEdit(key);
            this.persistMetaFields();
            if (typeof assetGenClient !== "undefined" && assetGenClient.writePng && entry.targetPath) {
                const result = await assetGenClient.writePng(entry.targetPath, dataUrl);
                if (typeof spriteLoader !== "undefined" && spriteLoader.reloadSprite) {
                    await spriteLoader.reloadSprite(key, result.url);
                }
                if (typeof iconRenderer !== "undefined" && iconRenderer.clearCache) {
                    iconRenderer.clearCache();
                }
                this._pixelDirty = false;
                this.setStatus("Pixels saved · " + (result.path || key));
                window.dispatchEvent(new CustomEvent("vf-asset-accepted", {
                    detail: { entry: entry, path: result.path, url: result.url, key: key }
                }));
            } else {
                this._pixelDirty = false;
                this.setStatus("Pixels in memory · start bridge to write PNG");
            }
            this.drawCurrentThumb();
            this.drawCenter();
            this.renderList();
            this.drawShipPreview();
        } catch (e) {
            this.setStatus(String(e && e.message || e));
        } finally {
            this.busy = false;
        }
    }

    startShipPreview() {
        this.stopShipPreview();
        const loop = () => {
            if (!this.visible && !this.embedded) return;
            if (!this.root || !this.root.isConnected) return;
            this.drawShipPreview();
            this._previewAnimId = requestAnimationFrame(loop);
        };
        this._previewAnimId = requestAnimationFrame(loop);
    }

    stopShipPreview() {
        if (this._previewAnimId) {
            cancelAnimationFrame(this._previewAnimId);
            this._previewAnimId = null;
        }
    }

    drawShipPreview() {
        const canvas = this.root && this.root.querySelector("#ceShipCanvas");
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = this.bgColor || "#FF00FF";
        ctx.globalAlpha = 0.45;
        ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = 1;
        this._previewHits = [];

        const entry = this.currentEntry();
        if (!entry) return;

        if (entry.type === "mount" || entry.type === "ability" || entry.type === "weapon") {
            this._drawMountOnShip(ctx, w, h, entry);
            return;
        }
        // Generic thumb centered
        const box = document.createElement("div");
        this.drawThumbInto(box, entry, Math.min(120, Math.max(40, (entry.size || 32) * 3)));
        const child = box.firstChild;
        if (child && child.tagName === "CANVAS") {
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(child, Math.floor((w - child.width) / 2), Math.floor((h - child.height) / 2));
        }
    }

    _resolveMountPreviewModule(entry) {
        const key = String((entry && (entry.spriteKey || entry.id)) || "");
        const bare = key.replace(/^mount_/, "");
        if (entry && entry.type === "weapon") {
            return { kind: "weapon", id: entry.id };
        }
        if (entry && entry.type === "ability") {
            const isDef = typeof shipLoadoutManager !== "undefined"
                && ((shipLoadoutManager.isDefenseId && shipLoadoutManager.isDefenseId(entry.id))
                    || (shipLoadoutManager.isArmorId && shipLoadoutManager.isArmorId(entry.id))
                    || (shipLoadoutManager.isShieldId && shipLoadoutManager.isShieldId(entry.id)));
            const isEnergy = typeof shipLoadoutManager !== "undefined"
                && shipLoadoutManager.isEnergyId && shipLoadoutManager.isEnergyId(entry.id);
            if (isEnergy) return { kind: "energy", id: entry.id };
            if (isDef) return { kind: "defense", id: entry.id };
            return { kind: "ability", id: entry.id };
        }
        // mount_* keys
        if (typeof weaponConfigManager !== "undefined" && weaponConfigManager.getWeapon) {
            const w = weaponConfigManager.getWeapon(bare);
            if (w) return { kind: "weapon", id: bare };
        }
        if (typeof abilityConfigManager !== "undefined" && abilityConfigManager.getAbility) {
            const a = abilityConfigManager.getAbility(bare);
            if (a) {
                if (typeof shipLoadoutManager !== "undefined" && shipLoadoutManager.isEnergyId
                    && shipLoadoutManager.isEnergyId(bare)) {
                    return { kind: "energy", id: bare };
                }
                if (typeof shipLoadoutManager !== "undefined" && (
                    (shipLoadoutManager.isDefenseId && shipLoadoutManager.isDefenseId(bare))
                    || (shipLoadoutManager.isArmorId && shipLoadoutManager.isArmorId(bare))
                    || (shipLoadoutManager.isShieldId && shipLoadoutManager.isShieldId(bare))
                )) {
                    return { kind: "defense", id: bare };
                }
                return { kind: "ability", id: bare };
            }
        }
        return { kind: "weapon", id: bare || "laser" };
    }

    _buildPreviewLoadout(shipId) {
        // Preview uses the real hangar loadout only — selection never adds/removes modules.
        const base = (typeof shipLoadoutManager !== "undefined" && shipLoadoutManager.getLoadout)
            ? shipLoadoutManager.getLoadout(shipId)
            : { weapons: [], defenses: [], abilities: [], energy: [] };
        return {
            weapons: (base.weapons || []).slice(),
            defenses: (base.defenses || []).slice(),
            abilities: (base.abilities || []).slice(),
            energy: (base.energy || []).slice(),
            fireMode: base.fireMode || "auto"
        };
    }

    _drawMountOnShip(ctx, w, h, entry) {
        let shipId = "player_scrap";
        if (typeof homeStationUI !== "undefined" && homeStationUI.hangarShipId) {
            shipId = homeStationUI.hangarShipId;
        } else if (typeof profileManager !== "undefined" && profileManager.getActiveShipId) {
            shipId = profileManager.getActiveShipId() || shipId;
        }

        let model = null;
        if (typeof shipConfigManager !== "undefined" && shipConfigManager.getMergedModel) {
            model = shipConfigManager.getMergedModel(shipId);
        }
        if (!model && typeof graphicsManager !== "undefined" && graphicsManager.shipAssetLoader) {
            model = graphicsManager.shipAssetLoader.getShip(shipId)
                || graphicsManager.shipAssetLoader.getShip("player-starfighter");
        }
        if (!model) return;

        // Clone lightly so we don't mutate live hangar model permanently
        const preview = Object.assign({}, model);
        if (model.sprite) preview.sprite = model.sprite;
        if (model.colors) preview.colors = model.colors;

        const loadout = this._buildPreviewLoadout(shipId);
        if (typeof shipLoadoutManager !== "undefined" && shipLoadoutManager.buildLayout) {
            const coreSize = shipLoadoutManager.getCoreSize(preview.modelClass, preview);
            const layout = shipLoadoutManager.buildLayout(coreSize.width, coreSize.height, loadout);
            preview.modular = true;
            preview.layout = layout;
            preview.coreWidth = coreSize.width;
            preview.coreHeight = coreSize.height;
            preview.width = layout.width;
            preview.height = layout.height;
            preview.loadout = layout.loadout;
        }

        const mw = Math.max(8, preview.width || 12);
        const mh = Math.max(8, preview.height || 10);
        const pad = 12;
        const scale = Math.max(2, Math.min(
            Math.floor((w - pad * 2) / mw),
            Math.floor((h - pad * 2) / mh),
            8
        ));
        const sw = mw * scale;
        const sh = mh * scale;
        const ox = Math.floor((w - sw) / 2);
        const oy = Math.floor((h - sh) / 2);

        ctx.imageSmoothingEnabled = false;
        try {
            if (typeof graphicsManager !== "undefined" && graphicsManager.shipAssetLoader
                && graphicsManager.shipAssetLoader.renderShip) {
                graphicsManager.shipAssetLoader.renderShip(
                    ctx,
                    preview,
                    ox,
                    oy,
                    scale,
                    null,
                    0,
                    { showThrusterGlow: true, allowColorMountSprites: true }
                );
            }
        } catch (e) {
            /* ignore */
        }

        // Hit targets + hover / selection outlines
        const targetKey = String((entry && (entry.spriteKey || entry.id)) || "");
        const modules = (preview.layout && preview.layout.modules) || [];
        const matchMod = this._resolveMountPreviewModule(entry);
        const hoverKey = this._hoverHit ? this._hoverHit.key : null;
        this._previewHits = [];

        modules.forEach((mod) => {
            let key = null;
            if (typeof shipLoadoutManager !== "undefined" && shipLoadoutManager.resolveModuleShipSprite) {
                key = shipLoadoutManager.resolveModuleShipSprite(mod);
            }
            if (!key) key = "mount_" + String(mod.id || "");
            const mx = Math.round(ox + mod.x * scale);
            const my = Math.round(oy + mod.y * scale);
            const mwPx = Math.max(scale, Math.round((mod.width || 8) * scale));
            const mhPx = Math.max(scale, Math.round((mod.height || 8) * scale));

            let resolved = null;
            if (typeof assetGenRegistry !== "undefined" && assetGenRegistry.findByKey) {
                resolved = assetGenRegistry.findByKey(key)
                    || assetGenRegistry.findByKey(mod.id)
                    || assetGenRegistry.findByKey("mount_" + mod.id);
            }
            this._previewHits.push({
                x: mx,
                y: my,
                w: mwPx,
                h: mhPx,
                key: key,
                modId: mod.id,
                kind: mod.kind,
                entry: resolved
            });

            const sameId = matchMod && mod.id === matchMod.id && mod.kind === matchMod.kind;
            const sameKey = key && (key === targetKey || key === entry.id);
            const selected = sameId || sameKey;
            const hovered = hoverKey && key === hoverKey;

            if (!selected && !hovered) return;
            ctx.save();
            if (selected) {
                ctx.strokeStyle = "rgba(220,220,220,0.95)";
                ctx.lineWidth = 1;
                ctx.setLineDash([]);
                ctx.strokeRect(mx - 1, my - 1, mwPx + 2, mhPx + 2);
                ctx.strokeStyle = "rgba(120,120,120,0.7)";
                ctx.strokeRect(mx - 2, my - 2, mwPx + 4, mhPx + 4);
            }
            if (hovered && !selected) {
                ctx.strokeStyle = "rgba(200,200,200,0.9)";
                ctx.lineWidth = 1;
                ctx.setLineDash([3, 2]);
                ctx.strokeRect(mx - 1, my - 1, mwPx + 2, mhPx + 2);
                ctx.setLineDash([]);
                ctx.fillStyle = "rgba(220,220,220,0.12)";
                ctx.fillRect(mx, my, mwPx, mhPx);
            } else if (hovered && selected) {
                ctx.fillStyle = "rgba(220,220,220,0.1)";
                ctx.fillRect(mx, my, mwPx, mhPx);
            }
            ctx.restore();
        });
    }

    async onGenerate() {
        const entry = this.currentEntry();
        if (!entry || this.busy) return;
        if (typeof assetGenClient === "undefined") {
            this.setStatus("assetGenClient missing");
            return;
        }
        this.readGenFields();
        this.busy = true;
        this.setStatus("Generating via Flux…");
        try {
            const promptEl = this.root.querySelector("#cePrompt");
            const prompt = promptEl ? promptEl.value : entry.promptSuffix;
            const opts = {
                prompt: prompt,
                size: this.outSize,
                genSize: this.genSize,
                steps: this.steps,
                prependStyle: this.prependStyle,
                colors: this.colorCount,
                bgColor: this.normalizeHex(this.bgColor)
            };
            if (this.seed !== "") opts.seed = Number(this.seed);
            const result = await assetGenClient.generate(entry, opts);
            this.stagingId = result.stagingId;
            this.previewDataUrl = result.previewDataUrl;
            this.setStatus("Ready · seed " + result.seed + " · Accept to apply");
            this.drawGenThumb();
            this.reloadEditBuffer(true);
            this.drawCenter();
        } catch (e) {
            this.setStatus(String(e && e.message || e));
        } finally {
            this.busy = false;
        }
    }

    async onAccept() {
        const entry = this.currentEntry();
        if (!entry || !this.stagingId || this.busy) return;
        this.busy = true;
        this.setStatus("Accepting…");
        try {
            const result = await assetGenClient.accept(this.stagingId, entry.targetPath);
            const key = entry.spriteKey || entry.id;
            if (typeof spriteLoader !== "undefined" && spriteLoader.reloadSprite) {
                await spriteLoader.reloadSprite(key, result.url);
            }
            if (typeof iconRenderer !== "undefined" && iconRenderer.clearCache) {
                iconRenderer.clearCache();
            }
            this.persistMetaFields();
            window.dispatchEvent(new CustomEvent("vf-asset-accepted", {
                detail: { entry: entry, path: result.path, url: result.url, key: key }
            }));
            this.clearStaging();
            this.setStatus("Accepted · " + (result.path || key));
            this.reloadEditBuffer(true);
            this.drawCurrentThumb();
            this.drawCenter();
            this.renderList();
        } catch (e) {
            this.setStatus(String(e && e.message || e));
        } finally {
            this.busy = false;
        }
    }

    async onSaveMeta() {
        this.readGenFields();
        this.persistMetaFields();
        if (typeof spriteMeta === "undefined") {
            this.setStatus("spriteMeta missing");
            return;
        }
        this.setStatus("Saving meta…");
        try {
            const r = await spriteMeta.saveToDisk();
            if (r && r.ok) this.setStatus("Meta saved · " + (r.path || spriteMeta.path));
            else this.setStatus((r && r.error) || "Meta saved locally only (bridge offline)");
        } catch (e) {
            this.setStatus("Meta local only · " + String(e && e.message || e));
        }
    }

    openAssetGen() {
        const entry = this.currentEntry();
        if (typeof assetGenUI === "undefined") return;
        assetGenUI.show({
            typeId: this.typeId,
            selectedId: entry ? entry.id : null,
            returnToSettings: false
        });
    }

    renderComponentProperties() {
        const r = this.root;
        const propsPanel = r && r.querySelector("#ceComponentProps");
        if (!propsPanel) return;

        // Only show if we have selected typeId and selectedId
        const hasSelection = !!this.typeId && !!this.selectedId;
        if (!hasSelection) {
            propsPanel.style.display = "none";
            return;
        }

        const entry = this.currentEntry();
        if (!entry) {
            propsPanel.style.display = "none";
            return;
        }

        // Only show for weapon or mount types
        const isWeapon = entry.type === "weapon";
        const isMount = entry.type === "mount";

        if (!isWeapon && !isMount) {
            propsPanel.style.display = "none";
            return;
        }

        // Show panel only for this specific component
        propsPanel.style.display = "block";

        // Build component-specific properties HTML
        let propsHtml = `<div class="hs-comp-section-title">${entry.label} PROPERTIES</div>`;
        propsHtml += '<div class="hs-comp-fields">';

        if (isWeapon) {
            propsHtml += `<label>WEAPON
              <select id="ceComponentWeapon" data-property="weapon">
                ${this.buildWeaponOptions()}
              </select>
            </label>
            <label>STYLE
              <select id="ceComponentStyle" data-property="style">
                ${this.buildStyleOptions()}
              </select>
            </label>
            <label>WEAPON STYLE
              <select id="ceComponentWeaponStyle" data-property="weaponStyle">
                ${this.buildWeaponStyleOptions()}
              </select>
            </label>`;
        } else if (isMount) {
            propsHtml += `<label>MODULE
              <select id="ceComponentModule" data-property="module">
                ${this.buildModuleOptions()}
              </select>
            </label>
            <label>STYLE
              <select id="ceComponentStyle" data-property="style">
                ${this.buildStyleOptions()}
              </select>
            </label>`;
        }

        propsHtml += '</div>';

        // Update panel content
        propsPanel.innerHTML = propsHtml;

        // Set values
        const weaponSel = propsPanel.querySelector("#ceComponentWeapon");
        if (weaponSel) {
            weaponSel.value = entry.id || "";
        }

        const styleSel = propsPanel.querySelector("#ceComponentStyle");
        if (styleSel) {
            styleSel.value = entry.style || "";
        }

        const weaponStyleSel = propsPanel.querySelector("#ceComponentWeaponStyle");
        if (weaponStyleSel) {
            weaponStyleSel.value = entry.weaponStyle || "";
        }

        const moduleSel = propsPanel.querySelector("#ceComponentModule");
        if (moduleSel) {
            moduleSel.value = entry.modId || entry.id || "";
        }

        // Remove any old event listeners
        if (this._propsListenerHandler) {
            propsPanel.removeEventListener("change", this._propsListenerHandler);
        }

        // Attach a single delegated event listener
        this._propsListenerHandler = (e) => {
            if (e.target && e.target.tagName === "SELECT") {
                const property = e.target.getAttribute("data-property");
                const value = e.target.value;
                if (property) {
                    this.onComponentPropertyChange(property, value);
                }
            }
        };

        propsPanel.addEventListener("change", this._propsListenerHandler);
    }

    buildWeaponOptions() {
        const weapons = this.getAvailableWeapons();
        return "<option value=\"\">— Select Weapon —</option>" +
            weapons.map(w => `<option value="${w.id}">${w.label}</option>`).join("");
    }

    buildStyleOptions() {
        const styles = this.getAvailableStyles();
        return "<option value=\"\">— Default Style —</option>" +
            styles.map(s => `<option value="${s.id}">${s.label}</option>`).join("");
    }

    buildWeaponStyleOptions() {
        const weaponStyles = this.getAvailableWeaponStyles();
        return "<option value=\"\">— Default Weapon Style —</option>" +
            weaponStyles.map(ws => `<option value="${ws.id}">${ws.label}</option>`).join("");
    }

    buildModuleOptions() {
        const modules = this.getAvailableModules();
        return modules.map(m => `<option value="${m.id}">${m.label}</option>`).join("");
    }

    getAvailableWeapons() {
        if (typeof weaponConfigManager !== "undefined" && weaponConfigManager.getAllWeapons) {
            return weaponConfigManager.getAllWeapons();
        }
        return [];
    }

    getAvailableStyles() {
        if (typeof shipStyleManager !== "undefined" && shipStyleManager.getAvailableStyles) {
            return shipStyleManager.getAvailableStyles();
        }
        return [
            { id: "default", label: "Default" },
            { id: "faction1", label: "Faction 1" },
            { id: "faction2", label: "Faction 2" }
        ];
    }

    getAvailableWeaponStyles() {
        if (typeof weaponStyleManager !== "undefined" && weaponStyleManager.getAvailableStyles) {
            return weaponStyleManager.getAvailableStyles();
        }
        return [
            { id: "standard", label: "Standard" },
            { id: "overcharge", label: "Overcharge" },
            { id: "precision", label: "Precision" }
        ];
    }

    getAvailableModules() {
        if (typeof moduleConfigManager !== "undefined" && moduleConfigManager.getAllModules) {
            return moduleConfigManager.getAllModules();
        }
        return [];
    }

    onComponentPropertyChange(property, value) {
        const entry = this.currentEntry();
        if (!entry) return;

        console.log(`Component property changed: ${property} = ${value}`, entry);

        // Update the entry with the new value
        if (property === "weapon") {
            entry.weaponId = value;
            entry.id = value;  // Also update id
        } else if (property === "style") {
            entry.style = value;
        } else if (property === "weaponStyle") {
            entry.weaponStyle = value;
        } else if (property === "module") {
            entry.modId = value;
            entry.id = value;  // Also update id
        }

        console.log("After update:", entry);

        // Persist the changes
        if (typeof assetGenRegistry !== "undefined" && assetGenRegistry.update) {
            assetGenRegistry.update(this.typeId, entry.id, entry);
        }

        // Refresh the preview
        this.drawShipPreview();
    }
}


const componentEditorUI = new ComponentEditorUI();
window.ComponentEditorUI = ComponentEditorUI;
window.componentEditorUI = componentEditorUI;
