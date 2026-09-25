"use strict";

// AssetGenUI methods, split from asset-gen-ui.js.
extendClass(AssetGenUI, {
    drawPixelMatrix(box, sprite, colors, px, keepColor) {
        if (!sprite || !sprite.length) return false;
        const rows = sprite.length;
        const cols = sprite[0].length || 1;
        const canvas = document.createElement("canvas");
        canvas.width = px;
        canvas.height = px;
        const ctx = canvas.getContext("2d");
        ctx.imageSmoothingEnabled = false;
        const cell = Math.max(1, Math.floor(Math.min(px / cols, px / rows)));
        const ox = Math.floor((px - cols * cell) / 2);
        const oy = Math.floor((px - rows * cell) / 2);
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const v = sprite[r][c];
                if (!v) continue;
                let color = (colors && colors[v]) || "#aaaaaa";
                if (typeof color === "string" && color.indexOf("var(") === 0) {
                    const m = color.match(/var\(\s*(--[^),\s]+)/);
                    color = m
                        ? (getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim() || "#aaaaaa")
                        : "#aaaaaa";
                }
                if (!color || color === "transparent") continue;
                ctx.fillStyle = keepColor ? color : this.toGrayHex(color);
                ctx.fillRect(ox + c * cell, oy + r * cell, cell, cell);
            }
        }
        box.appendChild(canvas);
        return true;
    },

    /** Force R=G=B for asset-gen previews (tint happens in-engine later). */
    toGrayHex(color) {
        const hex = String(color || "#aaaaaa").trim();
        const m = /^#?([0-9a-fA-F]{6})$/.exec(hex);
        if (!m) return "#aaaaaa";
        const n = parseInt(m[1], 16);
        const r = (n >> 16) & 255;
        const g = (n >> 8) & 255;
        const b = n & 255;
        const y = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
        const h = y.toString(16).padStart(2, "0");
        return "#" + h + h + h;
    },

    desaturateCanvas(canvas) {
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = imageData.data;
        for (let i = 0; i < d.length; i += 4) {
            if (d[i + 3] === 0) continue;
            const r = d[i];
            const g = d[i + 1];
            const b = d[i + 2];
            // Magenta key residue → transparent
            if (Math.abs(r - 255) + Math.abs(g - 0) + Math.abs(b - 255) <= 160) {
                d[i] = d[i + 1] = d[i + 2] = d[i + 3] = 0;
                continue;
            }
            const y = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
            d[i] = d[i + 1] = d[i + 2] = y;
        }
        ctx.putImageData(imageData, 0, 0);
    },

    async dataUrlToGrayDataUrl(dataUrl) {
        return new Promise((resolve) => {
            if (!dataUrl) {
                resolve(null);
                return;
            }
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                canvas.width = img.naturalWidth || img.width;
                canvas.height = img.naturalHeight || img.height;
                const ctx = canvas.getContext("2d");
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(img, 0, 0);
                this.desaturateCanvas(canvas);
                resolve(canvas.toDataURL("image/png"));
            };
            img.onerror = () => resolve(dataUrl);
            img.src = dataUrl;
        });
    },

    parseFactionShipKey(key) {
        const parts = String(key || "").split("-");
        if (parts[0] === "enemy" && parts.length >= 3) {
            return { faction: parts[1], enemyClass: parts.slice(2).join("-") };
        }
        return null;
    },

    factionColor(factionId) {
        if (typeof factionShipStyles !== "undefined" && factionShipStyles.getFactionColor) {
            return factionShipStyles.getFactionColor(factionId);
        }
        if (typeof planetConfigManager !== "undefined" && planetConfigManager.getFactionPlanetTheme) {
            const t = planetConfigManager.getFactionPlanetTheme(factionId);
            if (t && t.baseColor) return t.baseColor;
        }
        return null;
    },

    entryFactionId(entry) {
        if (!entry) return null;
        if (entry.faction) return String(entry.faction).toLowerCase();
        const key = entry.spriteKey || entry.id || "";
        if (entry.type === "faction" || String(key).indexOf("faction-") === 0) {
            return String(key).replace(/^faction[-_]?/i, "").toLowerCase();
        }
        const parsed = this.parseFactionShipKey(key);
        return parsed ? parsed.faction : null;
    },

    keepFactionColor(entry) {
        if (!entry) return false;
        return entry.type === "factionShip" || entry.type === "faction"
            || !!(entry.faction && (entry.kind === "ship" || entry.kind === "emblem"));
    },

    drawThumbInto(box, entry, size) {
        box.innerHTML = "";
        if (!entry) return;
        const key = entry.spriteKey || entry.id;
        const px = Math.max(16, size || 28);
        const keepColor = this.keepFactionColor(entry);
        const factionTint = keepColor ? this.factionColor(this.entryFactionId(entry)) : null;

        // 1) Loaded PNG override
        if (typeof spriteLoader !== "undefined" && spriteLoader.getSprite && spriteLoader.getSprite(key)) {
            const canvas = document.createElement("canvas");
            canvas.width = px;
            canvas.height = px;
            const ctx = canvas.getContext("2d");
            ctx.imageSmoothingEnabled = false;
            spriteLoader.renderSprite(ctx, key, 0, 0, px, px);
            if (!keepColor) this.desaturateCanvas(canvas);
            else if (factionTint && typeof iconRenderer !== "undefined" && iconRenderer.tintColor) {
                this.tintCanvas(canvas, factionTint);
            }
            box.appendChild(canvas);
            return;
        }

        // 2) Faction ship pixel fallback — fill canvas (not renderEnemyShip scale path)
        if ((entry.type === "factionShip" || entry.type === "enemy") &&
            typeof factionShipStyles !== "undefined" && factionShipStyles.resolveFactionShipVisual) {
            const parsed = this.parseFactionShipKey(key);
            const visual = factionShipStyles.resolveFactionShipVisual({
                faction: parsed ? parsed.faction : null,
                enemyClass: parsed ? parsed.enemyClass : null,
                typeId: entry.type === "enemy" ? key : null,
                tier: 2
            });
            if (visual && visual.model && this.drawPixelMatrix(box, visual.model.sprite, visual.model.colors, px, true)) {
                return;
            }
        }

        // 3) Icons / mounts / faction emblems
        if ((entry.type === "icon" || entry.type === "ability" || entry.type === "mount" || entry.type === "faction") &&
            typeof iconRenderer !== "undefined") {
            if (entry.type === "mount" && typeof ModuleSprites !== "undefined" && ModuleSprites[key]) {
                const canvas = document.createElement("canvas");
                canvas.width = px;
                canvas.height = px;
                iconRenderer.drawSprite(canvas.getContext("2d"), ModuleSprites[key], 0, 0, px, null);
                this.desaturateCanvas(canvas);
                box.appendChild(canvas);
                return;
            }
            const camel = key.indexOf("faction-") === 0
                ? ("faction" + key.slice(8).charAt(0).toUpperCase() + key.slice(9))
                : key;
            const drawKey = (iconRenderer.getSprite(camel) || (iconRenderer.getPngOverride && iconRenderer.getPngOverride(camel)))
                ? camel
                : key;
            if (iconRenderer.getSprite(drawKey) || (iconRenderer.getPngOverride && iconRenderer.getPngOverride(drawKey))) {
                const canvas = document.createElement("canvas");
                canvas.width = px;
                canvas.height = px;
                iconRenderer.drawToCanvas(canvas, drawKey, keepColor ? factionTint : null);
                if (!keepColor) this.desaturateCanvas(canvas);
                box.appendChild(canvas);
                return;
            }
            // Pixel IconSprites (faction emblems etc.)
            if (typeof IconSprites !== "undefined" && (IconSprites[camel] || IconSprites[key])) {
                const canvas = document.createElement("canvas");
                canvas.width = px;
                canvas.height = px;
                iconRenderer.drawSprite(
                    canvas.getContext("2d"),
                    IconSprites[camel] || IconSprites[key],
                    0, 0, px, keepColor ? factionTint : null
                );
                if (!keepColor) this.desaturateCanvas(canvas);
                box.appendChild(canvas);
                return;
            }
        }

        // 4) Generic ship / enemy hull models (pixel)
        if ((entry.type === "ship" || entry.type === "enemy") && typeof graphicsManager !== "undefined") {
            let model = null;
            const loader = graphicsManager.shipAssetLoader;
            if (loader && loader.getShip) {
                model = loader.getShip(key)
                    || loader.getShip(String(key).replace(/^enemy-/, "").replace(/^player-/, ""))
                    || null;
            }
            if (model && model.sprite && this.drawPixelMatrix(box, model.sprite, model.colors, px, keepColor)) {
                return;
            }
        }

        const miss = document.createElement("span");
        miss.textContent = "·";
        miss.style.color = "#777";
        miss.style.fontSize = Math.max(10, Math.floor(px / 3)) + "px";
        box.appendChild(miss);
    },

    tintCanvas(canvas, tint) {
        if (!canvas || !tint || typeof iconRenderer === "undefined") return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = imageData.data;
        for (let i = 0; i < d.length; i += 4) {
            if (d[i + 3] === 0) continue;
            const hex = "#" + [d[i], d[i + 1], d[i + 2]].map((n) => {
                const h = n.toString(16);
                return h.length === 1 ? "0" + h : h;
            }).join("");
            const out = iconRenderer.tintColor(hex, tint);
            const n = parseInt(out.slice(1), 16);
            d[i] = (n >> 16) & 255;
            d[i + 1] = (n >> 8) & 255;
            d[i + 2] = n & 255;
        }
        ctx.putImageData(imageData, 0, 0);
    },

    showHoverZoom(fromThumb, entry) {
        this.hideHoverZoom();
        if (!fromThumb || !entry) return;
        const zoom = document.createElement("div");
        zoom.className = "ag-zoom";
        zoom.style.left = "50%";
        zoom.style.top = "50%";
        const inner = document.createElement("div");
        inner.className = "ag-zoom-inner";
        this.drawThumbInto(inner, entry, 280);
        zoom.appendChild(inner);
        document.body.appendChild(zoom);
        this._hoverZoomEl = zoom;
    },

    hideHoverZoom() {
        if (this._hoverZoomEl && this._hoverZoomEl.parentNode) {
            this._hoverZoomEl.parentNode.removeChild(this._hoverZoomEl);
        }
        this._hoverZoomEl = null;
    },
});
