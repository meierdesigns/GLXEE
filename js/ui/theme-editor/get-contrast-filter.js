"use strict";

// ThemeEditorUI methods, split from theme-editor.js.
extendClass(ThemeEditorUI, {
    getContrastFilter() {
        const look = this.getGlobalLook();
        return 0.85 + (look.contrast / 100) * 0.75;
    },

    getIconContrast() {
        return this.getGlobalLook().iconContrast;
    },

    getIconBrightness() {
        return this.getGlobalLook().iconBrightness;
    },

    getIconSaturation() {
        return this.getGlobalLook().iconSaturation;
    },

    renderGraphicsPreview() {
        if (!this.overlay || !this.draft) return;
        const gfx = this.overlay.querySelector('#teGfx');
        if (gfx) {
            gfx.style.background = this.draft.background || '#0a0a0a';
            gfx.style.borderColor = this.draft.border || this.draft.primary;
            gfx.style.filter = 'none';
        }
        const tint = this.getPreviewTint();
        const iconTint = this.getSecondPreviewTint();
        const iconContrast = this.getIconContrast();
        const iconBrightness = this.getIconBrightness();
        const iconSaturation = this.getIconSaturation();
        const cells = this.overlay.querySelectorAll('.te-gfx-cell');
        cells.forEach((cell) => {
            const canvas = cell.querySelector('canvas');
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const kind = cell.dataset.kind;
            const key = cell.dataset.key;
            if (kind === 'icon' && typeof iconRenderer !== 'undefined') {
                iconRenderer.drawToCanvas(canvas, key, iconTint, iconContrast, iconBrightness, iconSaturation);
                return;
            }
            if (kind === 'ship') {
                this.drawShipPreview(ctx, key, tint, canvas.width, canvas.height);
                return;
            }
            if (kind === 'factory') {
                this.drawFactorySprite(ctx, key, tint, canvas.width, canvas.height);
            }
        });
    },

    drawFactorySprite(ctx, key, tint, w, h) {
        let sprite = null;
        if (typeof graphicsManager !== 'undefined' && graphicsManager.getSprite) {
            sprite = graphicsManager.getSprite(key);
        } else if (typeof spriteFactory !== 'undefined' && spriteFactory.getSprite) {
            sprite = spriteFactory.getSprite(key);
        } else if (typeof SpriteFactory !== 'undefined') {
            if (!this._spriteFactory) this._spriteFactory = new SpriteFactory();
            sprite = this._spriteFactory.sprites[key];
        }
        if (!sprite) return;
        this.drawTintedSprite(ctx, sprite, 4, 4, w - 8, h - 8, tint);
    },

    drawShipPreview(ctx, key, tint, w, h) {
        if (typeof shipModels === 'undefined') {
            this.drawFactorySprite(ctx, key === 'player' ? 'player' : 'enemy', tint, w, h);
            return;
        }
        const model = shipModels.getShipModel(key);
        if (!model || !model.sprite) {
            this.drawFactorySprite(ctx, key === 'player' ? 'player' : 'enemy', tint, w, h);
            return;
        }
        this.drawTintedSprite(ctx, model.sprite, 2, 2, w - 4, h - 4, tint);
    },

    drawTintedSprite(ctx, sprite, x, y, width, height, tint) {
        if (!sprite || !sprite.length) return;
        const cols = sprite[0].length;
        const rows = sprite.length;
        const pw = width / cols;
        const ph = height / rows;
        const iconContrast = this.getIconContrast();
        const iconBrightness = this.getIconBrightness();
        const iconSaturation = this.getIconSaturation();
        const lowMap = { 1: 5, 2: 6, 3: 7, 4: 8 };
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const idx = sprite[r][c];
                if (!idx) continue;
                const shadeIdx = lowMap[idx] || Math.min(15, idx);
                let gray = (typeof iconRenderer !== 'undefined' && iconRenderer.getGray(shadeIdx))
                    || '#808080';
                let color = gray;
                if (tint && typeof iconRenderer !== 'undefined') {
                    color = iconRenderer.tintColor(gray, tint);
                }
                if (typeof iconRenderer !== 'undefined' && iconRenderer.applyIconLook) {
                    color = iconRenderer.applyIconLook(color, iconContrast, iconBrightness, iconSaturation);
                } else if (typeof iconRenderer !== 'undefined' && iconRenderer.applyIconContrast) {
                    color = iconRenderer.applyIconContrast(color, iconContrast);
                    if (iconRenderer.applyIconBrightness) {
                        color = iconRenderer.applyIconBrightness(color, iconBrightness);
                    }
                    if (iconRenderer.applyIconSaturation) {
                        color = iconRenderer.applyIconSaturation(color, iconSaturation);
                    }
                } else {
                    color = this.applyContrastToHex(color, 0.5 + (iconContrast / 100) * 1.2);
                }
                ctx.fillStyle = color;
                ctx.fillRect(x + c * pw, y + r * ph, Math.ceil(pw), Math.ceil(ph));
            }
        }
    },

    applyContrastToHex(hex, factor) {
        if (!hex || hex.charAt(0) !== '#') return hex;
        const n = parseInt(hex.slice(1), 16);
        let r = (n >> 16) & 255;
        let g = (n >> 8) & 255;
        let b = n & 255;
        const mid = 128;
        r = Math.max(0, Math.min(255, Math.round(mid + (r - mid) * factor)));
        g = Math.max(0, Math.min(255, Math.round(mid + (g - mid) * factor)));
        b = Math.max(0, Math.min(255, Math.round(mid + (b - mid) * factor)));
        return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    },

    updatePreviewCard() {
        const card = this.overlay.querySelector('#tePreviewCard');
        if (!card || !this.draft) return;
        this.syncDerivedColors();
        card.style.background = this.draft.background || '#0a0a0a';
        card.style.borderColor = this.draft.border || this.draft.primary;
        card.style.color = this.draft.text || '#e0e0e0';
        card.style.filter = `contrast(${this.getContrastFilter()})`;
        const title = card.querySelector('.te-preview-title');
        if (title) title.style.color = this.draft.primary;
        const primaryBtn = card.querySelector('.te-preview-primary');
        if (primaryBtn) {
            primaryBtn.style.background = this.draft.primary;
            primaryBtn.style.borderColor = this.draft.primary;
            primaryBtn.style.color = this.draft.background || '#000';
        }
        card.querySelectorAll('.te-preview-btn:not(.te-preview-primary)').forEach((btn) => {
            btn.style.borderColor = this.draft.border || this.draft.primary;
            btn.style.color = this.draft.textSecondary || this.draft.text;
            btn.style.background = this.draft.surface || 'transparent';
        });
        const text = card.querySelector('.te-preview-text');
        if (text) text.style.color = this.draft.textSecondary || this.draft.text;
    },

    toHex(color) {
        if (typeof colorPaletteSystem !== 'undefined' && colorPaletteSystem.normalizeHex) {
            return colorPaletteSystem.normalizeHex(color).toLowerCase();
        }
        if (!color || typeof color !== 'string') return '#808080';
        if (/^#[0-9a-fA-F]{6}$/.test(color)) return color.toLowerCase();
        if (/^#[0-9a-fA-F]{3}$/.test(color)) {
            return ('#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3]).toLowerCase();
        }
        return '#808080';
    },

    saveCurrent() {
        if (typeof colorPaletteSystem === 'undefined' || !this.draft) return;
        const data = colorPaletteSystem.compactPalette(this.draft);
        data.name = this.draft.name || data.name;
        const id = colorPaletteSystem.upsertPalette(this.editingId, data);
        this.editingId = id;
        if (typeof themeContextManager !== 'undefined') {
            themeContextManager.setAppTheme(id);
        } else {
            this.previewDraft(true);
        }
        this.renderList();
        this.renderMeta();
    },

    async saveAsNew() {
        if (typeof colorPaletteSystem === 'undefined' || !this.draft) return;
        const name = await uiDialog.prompt('New theme name', (this.draft.name || 'Custom') + ' Copy');
        if (name == null) return;
        const slug = String(name).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'custom';
        const data = colorPaletteSystem.compactPalette(this.draft);
        data.name = name.trim() || 'Custom';
        const id = colorPaletteSystem.upsertPalette(slug, data, { forceNew: true });
        this.loadDraft(id);
        if (typeof themeContextManager !== 'undefined') {
            themeContextManager.setAppTheme(id);
        }
        this.renderList();
        this.renderMeta();
        this.renderAppearance();
        this.updatePreviewCard();
        this.renderGraphicsPreview();
    },

    async createBlank() {
        if (typeof colorPaletteSystem === 'undefined') return;
        const name = await uiDialog.prompt('New theme name', 'Custom');
        if (name == null) return;
        const data = colorPaletteSystem.compactPalette({
            name: name.trim() || 'Custom',
            baseColor: '#00ff88',
            secondBaseColor: '#ffffff'
        });
        const slug = String(name).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'custom';
        const id = colorPaletteSystem.upsertPalette(slug, data, { forceNew: true });
        this.loadDraft(id);
        this.previewDraft(false);
        this.renderList();
        this.renderMeta();
        this.renderAppearance();
        this.updatePreviewCard();
        this.renderGraphicsPreview();
    },

    async deleteCurrent() {
        if (typeof colorPaletteSystem === 'undefined') return;
        if (colorPaletteSystem.isBuiltin(this.editingId)) {
            uiDialog.alert('Builtin themes cannot be deleted. Use SAVE AS for a custom copy.');
            return;
        }
        if (!(await uiDialog.confirm(`Delete theme "${this.draft.name || this.editingId}"?`, { okLabel: 'DELETE', danger: true }))) return;
        colorPaletteSystem.deleteCustomPalette(this.editingId);
        this.loadDraft('grayscale');
        if (typeof themeContextManager !== 'undefined') {
            themeContextManager.setAppTheme('grayscale');
        }
        this.renderList();
        this.renderMeta();
        this.renderAppearance();
        this.updatePreviewCard();
        this.renderGraphicsPreview();
    },

    handleKeyDown(e) {
        if (!this.visible) return;
        if (e.key === 'Escape') {
            e.preventDefault();
            this.hide();
        }
    },
});
