"use strict";

// ComponentEditorUI methods, split from component-editor.js.
extendClass(ComponentEditorUI, {
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
    },

    resetView() {
        this.viewZoom = 1;
        this.viewPanX = 0;
        this.viewPanY = 0;
        this.persistViewZoom();
        this.drawCenter();
    },

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
    },

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
    },

    onPanUp() {
        if (!this._panning) return;
        this._panning = false;
        window.removeEventListener("mousemove", this._onPanMove);
        window.removeEventListener("mouseup", this._onPanUp);
        const canvas = this.root && this.root.querySelector("#ceCanvas");
        const wrap = this.root && this.root.querySelector("#ceCanvasWrap");
        if (canvas) canvas.style.cursor = "crosshair";
        if (wrap) wrap.classList.remove("is-panning");
    },

    onPaintMove(e) {
        if (!this._painting) return;
        this.paintAtEvent(e);
    },

    onPaintUp() {
        this._painting = false;
        window.removeEventListener("mousemove", this._onPaintMove);
        window.removeEventListener("mouseup", this._onPaintUp);
    },

    paintAtEvent(e) {
        const pos = this.canvasPosToPixel(e);
        if (!pos) return;
        this.paintPixel(pos.x, pos.y, this._paintErase);
    },

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
    },

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
    },

    clearPixels() {
        if (!this._editCanvas) return;
        const ctx = this._editCanvas.getContext("2d");
        ctx.clearRect(0, 0, this._editCanvas.width, this._editCanvas.height);
        this._pixelDirty = true;
        this.drawCenter();
        this.drawShipPreview();
        this.setStatus("Pixels cleared");
    },

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
    },

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
    },
});
