"use strict";

// AssetGenUI portrait batch (reference image → Flux → assets/factions/*/portraits/).
extendClass(AssetGenUI, {
    syncEditorTitle() {
        if (!this.overlay) return;
        const title = this.overlay.querySelector(".ag-title");
        if (!title) return;
        const face = this.isPortraitLibrary && this.isPortraitLibrary();
        title.textContent = face ? "FACE EDITOR · FLUX + COMFYUI" : "ASSET GENERATOR · FLUX2";
        this.updateHintPorts && this.updateHintPorts();
    },

    loadPortraitBgv() {
        try {
            const n = parseInt(localStorage.getItem("vf_asset_gen_portrait_bgv_v1"), 10);
            if (Number.isFinite(n) && n >= 0) return n % 32;
        } catch (e) { /* ignore */ }
        return 0;
    },

    savePortraitBgv() {
        try {
            localStorage.setItem("vf_asset_gen_portrait_bgv_v1", String(this.portraitBgv | 0));
        } catch (e) { /* ignore */ }
    },

    loadPortraitBga() {
        try {
            const n = parseInt(localStorage.getItem("vf_asset_gen_portrait_bga_v1"), 10);
            if (Number.isFinite(n) && n >= 0) return n % 5;
        } catch (e) { /* ignore */ }
        return 2;
    },

    savePortraitBga() {
        try {
            localStorage.setItem("vf_asset_gen_portrait_bga_v1", String(this.portraitBga | 0));
        } catch (e) { /* ignore */ }
    },

    setPortraitBgv(v) {
        const n = (typeof heroPortrait !== "undefined" && heroPortrait.OPTIONS && heroPortrait.OPTIONS.bgv)
            ? heroPortrait.OPTIONS.bgv
            : 32;
        this.portraitBgv = ((v | 0) % n + n) % n;
        this.savePortraitBgv();
        this.syncPortraitBgvChrome();
        if (this.isPortraitLibrary && this.isPortraitLibrary()) {
            this.renderList();
            this.renderDetail();
        }
    },

    setPortraitBga(v) {
        const n = (typeof heroPortrait !== "undefined" && heroPortrait.OPTIONS && heroPortrait.OPTIONS.bga)
            ? heroPortrait.OPTIONS.bga
            : 5;
        this.portraitBga = ((v | 0) % n + n) % n;
        this.savePortraitBga();
        this.syncPortraitBgvChrome();
        if (this.isPortraitLibrary && this.isPortraitLibrary()) {
            this.renderDetail();
        }
    },

    syncPortraitBgvChrome() {
        if (!this.overlay) return;
        const sl = this.overlay.querySelector("#agPortraitBgv");
        const val = this.overlay.querySelector("#agPortraitBgvVal");
        const bgaSl = this.overlay.querySelector("#agPortraitBga");
        const bgaVal = this.overlay.querySelector("#agPortraitBgaVal");
        const n = (typeof heroPortrait !== "undefined" && heroPortrait.OPTIONS && heroPortrait.OPTIONS.bgv)
            ? heroPortrait.OPTIONS.bgv
            : 32;
        if (sl) {
            sl.max = String(n - 1);
            if (Number(sl.value) !== (this.portraitBgv | 0)) sl.value = String(this.portraitBgv | 0);
        }
        if (val) {
            val.textContent = String((this.portraitBgv | 0) + 1).padStart(2, "0") + " / " + n;
        }
        const bn = (typeof heroPortrait !== "undefined" && heroPortrait.OPTIONS && heroPortrait.OPTIONS.bga)
            ? heroPortrait.OPTIONS.bga
            : 5;
        if (bgaSl) {
            bgaSl.max = String(bn - 1);
            if (Number(bgaSl.value) !== (this.portraitBga | 0)) bgaSl.value = String(this.portraitBga | 0);
        }
        if (bgaVal) {
            const names = (typeof heroPortrait !== "undefined" && heroPortrait.NAMES && heroPortrait.NAMES.bga)
                ? heroPortrait.NAMES.bga
                : ["OFF", "SLOW", "NORMAL", "FAST", "TURBO"];
            bgaVal.textContent = names[this.portraitBga | 0] || String(this.portraitBga | 0);
        }
    },

    syncPortraitChrome() {
        if (!this.overlay) return;
        const chrome = this.overlay.querySelector("#agPortraitChrome");
        if (!chrome) return;
        const on = this.isPortraitLibrary && this.isPortraitLibrary();
        chrome.hidden = !on;
        this.overlay.classList.toggle("is-portraits", !!on);
        this.syncEditorTitle();
        if (!on) return;
        this.renderPortraitFactionTabs();
        this.renderPortraitReferencePreview();
        this.syncPortraitBgvChrome();
    },

    renderPortraitFactionTabs() {
        const host = this.overlay && this.overlay.querySelector("#agPortraitFactionTabs");
        if (!host) return;
        host.innerHTML = "";
        const cats = ["all"].concat(this.factionIds());
        cats.forEach((cat) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.dataset.category = cat;
            if (cat === (this.factionCategory || "all")) btn.classList.add("ag-on");
            btn.textContent = cat === "all" ? "ALL" : this.factionLabel(cat);
            const color = cat !== "all" ? this.factionColor(cat) : null;
            if (color) {
                btn.style.setProperty("--ag-faction-color", color);
                btn.style.borderColor = color;
                btn.style.color = color;
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
    },

    filteredPortraitEntries() {
        const all = (typeof assetGenRegistry !== "undefined" && assetGenRegistry.listPortraits)
            ? assetGenRegistry.listPortraits()
            : [];
        const cat = this.factionCategory || "all";
        if (cat === "all") return all;
        return all.filter((e) => e.faction === cat);
    },

    renderPortraitReferencePreview() {
        const box = this.overlay && this.overlay.querySelector("#agPortraitRefPreview");
        if (!box) return;
        box.innerHTML = "";
        if (!this.portraitReferenceDataUrl) {
            box.textContent = "(none)";
            return;
        }
        const img = document.createElement("img");
        img.alt = "Portrait reference";
        img.src = this.portraitReferenceDataUrl;
        box.appendChild(img);
    },

    onPortraitReferenceFile(input) {
        const file = input && input.files && input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            this.portraitReferenceDataUrl = String(reader.result || "");
            this.renderPortraitReferencePreview();
            this.setStatus("Reference loaded · GENERATE ALL to replace portraits");
        };
        reader.onerror = () => this.setStatus("Failed to read reference image");
        reader.readAsDataURL(file);
    },

    clearPortraitReference() {
        this.portraitReferenceDataUrl = null;
        const input = this.overlay && this.overlay.querySelector("#agPortraitRefFile");
        if (input) input.value = "";
        this.renderPortraitReferencePreview();
        this.setStatus("Reference cleared");
    },

    requirePortraitReference() {
        if (this.portraitReferenceDataUrl) return true;
        this.setStatus("Load an example / reference image first (PORTRAITS → LOAD EXAMPLE)");
        return false;
    },

    async onGenerateAllPortraits() {
        if (!this.isPortraitLibrary() || this.busy) return;
        if (!this.requirePortraitReference()) return;
        let list = this.checkedEntries();
        if (!list.length) list = this.visibleLibraryEntries();
        if (!list.length) {
            this.setStatus("No portraits to generate.");
            return;
        }
        this.checkedIds = new Set(list.map((e) => e.id));
        const prevAuto = this.renderSettings.autoAcceptBatch;
        this.renderSettings.autoAcceptBatch = true;
        try {
            await this.onGenerateChecked();
        } finally {
            this.renderSettings.autoAcceptBatch = prevAuto;
        }
        if (typeof factionPacks !== "undefined" && factionPacks.reload) {
            await factionPacks.reload();
        }
        if (typeof voxelPortrait !== "undefined" && voxelPortrait.invalidatePainted) {
            voxelPortrait.invalidatePainted();
        }
    },
});
