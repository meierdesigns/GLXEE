"use strict";

// ComponentEditorUI methods, split from component-editor.js.
extendClass(ComponentEditorUI, {
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
        const generating = this.busy || !!this.stagingId;
        if (this.showPaintBg || generating) {
            // Generator key colour — while generating / reviewing a generated
            // result (until accepted), or when the BG toggle is on.
            ctx.fillStyle = this.bgColor || "#FF00FF";
            ctx.globalAlpha = 0.55;
            ctx.fillRect(0, 0, w, h);
            ctx.globalAlpha = 1;
        } else {
            // Neutral dark checker so transparent pixels stay readable.
            const cell = 12;
            for (let y = 0; y < h; y += cell) {
                for (let x = 0; x < w; x += cell) {
                    ctx.fillStyle = ((x / cell + y / cell) & 1) ? "#16161c" : "#0e0e12";
                    ctx.fillRect(x, y, cell, cell);
                }
            }
        }

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
    },

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
    },

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
    },

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
    },

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
    },

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
    },

    shadeToGray(shade) {
        const s = Math.max(1, Math.min(this._maxShades, shade | 0));
        // Match iconRenderer 1–15 ramp roughly
        const t = s / this._maxShades;
        return Math.round(44 + t * (248 - 44));
    },

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
    },

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
    },

    persistViewZoom() {
        try {
            localStorage.setItem(this._zoomStorageKey, String(this.viewZoom || 1));
        } catch (e) { /* ignore */ }
    },

    onViewWheel(e) {
        e.preventDefault();
        const step = e.deltaY < 0 ? 0.15 : -0.15;
        this.setViewZoom((this.viewZoom || 1) + step, e);
    },
});
