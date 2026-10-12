"use strict";

// ComponentEditorUI methods, split from component-editor.js.
extendClass(ComponentEditorUI, {
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
    },

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
    },

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
    },

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
    },

    readGenFields() {
        const r = this.root;
        if (!r) return;
        this.outSize = parseInt(r.querySelector("#ceOutSize").value, 10) || 64;
        this.genSize = parseInt(r.querySelector("#ceGenSize").value, 10) || 512;
        this.steps = parseInt(r.querySelector("#ceSteps").value, 10) || 4;
        this.seed = String(r.querySelector("#ceSeed").value || "").trim();
        this.persistMetaFields();
    },

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
    },

    setStatus(msg) {
        this.statusText = msg || "";
        const el = this.root && this.root.querySelector("#ceStatus");
        if (el) el.textContent = this.statusText;
    },

    clearStaging() {
        this.stagingId = null;
        this.previewDataUrl = null;
        this.drawGenThumb();
        this.setStatus("");
    },

    drawThumbInto(box, entry, size) {
        if (typeof assetGenUI !== "undefined" && assetGenUI.drawThumbInto) {
            assetGenUI.drawThumbInto(box, entry, size);
            return;
        }
        box.innerHTML = "";
        const span = document.createElement("span");
        span.textContent = "·";
        box.appendChild(span);
    },

    drawCurrentThumb() {
        const box = this.root && this.root.querySelector("#ceCurrentThumb");
        if (!box) return;
        box.innerHTML = "";
        this.drawThumbInto(box, this.currentEntry(), 72);
    },

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
    },
});
