"use strict";

// ComponentEditorUI methods, split from component-editor.js.
extendClass(ComponentEditorUI, {
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
    },

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
    },

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
    },

    handleKeyDown(e) {
        if (e.key !== "Escape") return;
        if (!this._previewFs) return;
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
        this.leavePreviewFullscreen();
    },

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
        const showBg = r.querySelector("#ceShowBg");
        if (showBg) {
            if (this.showPaintBg == null) {
                try { this.showPaintBg = localStorage.getItem("vf_ce_show_bg") === "true"; } catch (e) { this.showPaintBg = false; }
            }
            showBg.checked = !!this.showPaintBg;
            showBg.onchange = () => {
                this.showPaintBg = !!showBg.checked;
                try { localStorage.setItem("vf_ce_show_bg", String(this.showPaintBg)); } catch (e) {}
                this.drawCenter();
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
    },

    normalizeHex(hex) {
        if (!hex || typeof hex !== "string") return "#FF00FF";
        let h = hex.trim();
        if (h.charAt(0) !== "#") h = "#" + h;
        if (/^#[0-9A-Fa-f]{3}$/.test(h)) {
            h = "#" + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
        }
        if (!/^#[0-9A-Fa-f]{6}$/.test(h)) return "#FF00FF";
        return h.toUpperCase();
    },
});
