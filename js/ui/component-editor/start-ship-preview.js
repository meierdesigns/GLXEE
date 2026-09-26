"use strict";

// ComponentEditorUI methods, split from component-editor.js.
extendClass(ComponentEditorUI, {
    startShipPreview() {
        this.stopShipPreview();
        const loop = () => {
            if (!this.visible && !this.embedded) return;
            if (!this.root || !this.root.isConnected) return;
            this.drawShipPreview();
            this._previewAnimId = requestAnimationFrame(loop);
        };
        this._previewAnimId = requestAnimationFrame(loop);
    },

    stopShipPreview() {
        if (this._previewAnimId) {
            cancelAnimationFrame(this._previewAnimId);
            this._previewAnimId = null;
        }
    },

    drawShipPreview() {
        const canvas = this.root && this.root.querySelector("#ceShipCanvas");
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        const w = canvas.width;
        const h = canvas.height;
        // Ship preview stays clean — the key/BG colour only shows on the
        // component pixel canvas, where you're actually editing.
        ctx.clearRect(0, 0, w, h);
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
    },

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
    },

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
    },

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
    },
});
