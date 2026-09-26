"use strict";

// ComponentEditorUI methods, split from component-editor.js.
extendClass(ComponentEditorUI, {
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
      <label class="hs-comp-check" title="Show the generator key colour behind the pixels"><input type="checkbox" id="ceShowBg"> BG</label>
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
    },

    toggleLeftSidebar(collapse) {
        if (collapse != null) this.leftCollapsed = !!collapse;
        else this.leftCollapsed = !this.leftCollapsed;
        try {
            localStorage.setItem("vf_ce_left_collapsed", String(this.leftCollapsed));
        } catch (e) {}
        this.applySidebarCollapse();
    },

    toggleRightSidebar(collapse) {
        if (collapse != null) this.rightCollapsed = !!collapse;
        else this.rightCollapsed = !this.rightCollapsed;
        try {
            localStorage.setItem("vf_ce_right_collapsed", String(this.rightCollapsed));
        } catch (e) {}
        this.applySidebarCollapse();
    },

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
    },

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
    },

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
    },

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
    },

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
    },

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
    },

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
    },
});
