"use strict";

// ComponentEditorUI methods, split from component-editor.js.
extendClass(ComponentEditorUI, {
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
    },

    persistPixelColorSettings() {
        try {
            localStorage.setItem("vf_pixel_colors", String(this.colorCount));
            localStorage.setItem("vf_pixel_bg", this.normalizeHex(this.bgColor));
        } catch (e) { /* ignore */ }
    },

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
    },

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
    },

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
    },

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
    },

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
    },

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
    },

    setPaintTool(tool) {
        this._paintTool = tool === "erase" ? "erase" : "draw";
        const r = this.root;
        if (!r) return;
        const drawBtn = r.querySelector("#ceToolDraw");
        const eraseBtn = r.querySelector("#ceToolErase");
        if (drawBtn) drawBtn.classList.toggle("pe-primary", this._paintTool === "draw");
        if (eraseBtn) eraseBtn.classList.toggle("pe-primary", this._paintTool === "erase");
        this.updatePaletteSelection();
    },

    _previewCanvasPos(e) {
        const canvas = this.root && this.root.querySelector("#ceShipCanvas");
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return null;
        return {
            x: (e.clientX - rect.left) * (canvas.width / rect.width),
            y: (e.clientY - rect.top) * (canvas.height / rect.height)
        };
    },

    _hitTestPreview(x, y) {
        const hits = this._previewHits || [];
        for (let i = hits.length - 1; i >= 0; i--) {
            const h = hits[i];
            if (x >= h.x && x < h.x + h.w && y >= h.y && y < h.y + h.h) return h;
        }
        return null;
    },

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
    },

    onPreviewMouseLeave() {
        if (!this._hoverHit) return;
        this._hoverHit = null;
        const canvas = this.root && this.root.querySelector("#ceShipCanvas");
        if (canvas) canvas.style.cursor = this._previewFs ? "zoom-out" : "zoom-in";
        this.drawShipPreview();
    },

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
    },

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
    },

    togglePreviewFullscreen() {
        if (this._previewFs) this.leavePreviewFullscreen();
        else this.enterPreviewFullscreen();
    },

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
    },

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
    },
});
