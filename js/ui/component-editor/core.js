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
}
