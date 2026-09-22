"use strict";

/**
 * Theme Editor — themes = baseColor + secondBaseColor.
 * Contrast / saturation are global (shared by all themes).
 */
class ThemeEditorUI {
    constructor() {
        this.visible = false;
        this.overlay = null;
        this.editingId = 'grayscale';
        this.draft = null;
        this.returnToSettings = false;
        this.returnToInGameSettings = false;
        this._keyHandler = (e) => this.handleKeyDown(e);
        this.previewGroups = [
            {
                title: 'Ships',
                items: [
                    { kind: 'ship', key: 'player', label: 'Player' },
                    { kind: 'ship', key: 'enemyBasic', label: 'Enemy' },
                    { kind: 'ship', key: 'enemyFast', label: 'Fast' },
                    { kind: 'ship', key: 'enemyHeavy', label: 'Heavy' },
                    { kind: 'ship', key: 'enemyBoss', label: 'Boss' }
                ]
            },
            {
                title: 'Sprites',
                items: [
                    { kind: 'factory', key: 'player', label: 'Player' },
                    { kind: 'factory', key: 'enemy', label: 'Enemy' },
                    { kind: 'factory', key: 'playerBullet', label: 'P-Bullet' },
                    { kind: 'factory', key: 'enemyBullet', label: 'E-Bullet' },
                    { kind: 'factory', key: 'obstacle', label: 'Obstacle' },
                    { kind: 'factory', key: 'shield', label: 'Shield' },
                    { kind: 'factory', key: 'obstacleSmall', label: 'Ast S' },
                    { kind: 'factory', key: 'obstacleMedium', label: 'Ast M' },
                    { kind: 'factory', key: 'obstacleLarge', label: 'Ast L' }
                ]
            },
            {
                title: 'Shots',
                items: [
                    'shotLaser', 'shotSpread', 'shotRapid', 'shotPlasma', 'shotMissile',
                    'shotIon', 'shotWave', 'shotBurst', 'shotPierce', 'shotNova'
                ].map((key) => ({ kind: 'icon', key, label: key.replace(/^shot/, '') }))
            },
            {
                title: 'Abilities',
                items: (typeof IconSprites !== 'undefined'
                    ? Object.keys(IconSprites).filter((k) => k.indexOf('ability_') === 0)
                    : []
                ).map((key) => ({
                    kind: 'icon',
                    key,
                    label: key.replace(/^ability_/, '').replace(/_/g, ' ')
                }))
            },
            {
                title: 'Stats',
                items: (typeof IconSprites !== 'undefined'
                    ? Object.keys(IconSprites).filter((k) => k.indexOf('stat') === 0)
                    : []
                ).map((key) => ({
                    kind: 'icon',
                    key,
                    label: key.replace(/^stat/, '')
                }))
            }
        ];
    }

    show(options) {
        const opts = options || {};
        this.returnToSettings = !!opts.returnToSettings;
        this.returnToInGameSettings = !!opts.returnToInGameSettings;
        this.editingId = opts.paletteId
            || (typeof themeContextManager !== 'undefined' && themeContextManager.getAppTheme())
            || (typeof colorManager !== 'undefined' && colorManager.getCurrentPalette())
            || 'grayscale';
        this.loadDraft(this.editingId);
        this.visible = true;
        this.createUI();
        document.addEventListener('keydown', this._keyHandler);
        this.previewDraft(false);
        if (typeof menuStateManager !== 'undefined' && !opts.skipPersist) {
            menuStateManager.setScreen('theme-editor', { palette: this.editingId });
        }
    }

    hide() {
        this.visible = false;
        document.removeEventListener('keydown', this._keyHandler);
        if (this._panelResize) {
            this._panelResize.destroy();
            this._panelResize = null;
        }
        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
        }

        if (this.returnToInGameSettings) {
            this.returnToInGameSettings = false;
            this.returnToSettings = false;
            if (typeof coreLevelManager !== 'undefined'
                && coreLevelManager.getCurrentLevel
                && typeof themeContextManager !== 'undefined') {
                const level = coreLevelManager.getCurrentLevel();
                if (level) themeContextManager.applyForLevel(level);
                else themeContextManager.restoreAppTheme();
            } else if (typeof themeContextManager !== 'undefined') {
                themeContextManager.restoreAppTheme();
            }
            if (typeof settingsManager !== 'undefined') {
                settingsManager.settings.colorPalette =
                    (typeof themeContextManager !== 'undefined')
                        ? themeContextManager.getAppTheme()
                        : this.editingId;
                settingsManager.showSettings();
            }
            return;
        }

        if (typeof themeContextManager !== 'undefined') {
            themeContextManager.restoreAppTheme();
        }
        if (this.returnToSettings && typeof startScreenManager !== 'undefined') {
            this.returnToSettings = false;
            if (startScreenManager.settingsItems && startScreenManager.settingsItems[0]) {
                startScreenManager.settingsItems[0].value =
                    (typeof themeContextManager !== 'undefined')
                        ? themeContextManager.getAppTheme()
                        : this.editingId;
            }
            startScreenManager.showSettings = true;
            startScreenManager.showCredits = false;
            if (startScreenManager.hasActiveProfile && startScreenManager.hasActiveProfile()
                && typeof homeStationUI !== 'undefined') {
                if (!homeStationUI.isVisible) {
                    homeStationUI.show({ skipPersist: true });
                }
                startScreenManager.show({
                    asOverlay: true,
                    showSettings: true
                });
            } else {
                startScreenManager.show({ forceMenu: true });
            }
            return;
        }
        if (typeof menuStateManager !== 'undefined') {
            menuStateManager.setScreen('start');
        }
    }

    loadDraft(paletteId) {
        const src = (typeof colorPaletteSystem !== 'undefined' && colorPaletteSystem.palettes[paletteId])
            ? colorPaletteSystem.palettes[paletteId]
            : null;
        this.draft = {
            name: (src && src.name) || paletteId,
            baseColor: (src && (src.baseColor || src.primary)) || '#808080',
            secondBaseColor: (src && src.secondBaseColor)
                || (typeof colorPaletteSystem !== 'undefined' && colorPaletteSystem.defaultSecondBaseColor)
                || '#FFFFFF'
        };
        this.editingId = paletteId;
        this.syncDerivedColors();
    }

    getGlobalLook() {
        if (typeof colorPaletteSystem !== 'undefined' && colorPaletteSystem.getGlobalLook) {
            return colorPaletteSystem.getGlobalLook();
        }
        return {
            contrast: 50,
            saturation: 100,
            iconContrast: 65,
            iconBrightness: 50,
            iconSaturation: 50
        };
    }

    syncDerivedColors() {
        if (!this.draft || typeof colorPaletteSystem === 'undefined') return;
        const expanded = colorPaletteSystem.expandPalette(this.draft);
        Object.keys(expanded).forEach((k) => {
            if (k === 'name' || k === 'baseColor' || k === 'secondBaseColor') return;
            this.draft[k] = expanded[k];
        });
        this.draft.name = this.draft.name || expanded.name;
        this.draft.baseColor = expanded.baseColor;
        this.draft.secondBaseColor = expanded.secondBaseColor;
    }

    previewDraft(persist) {
        if (!this.draft || typeof colorPaletteSystem === 'undefined') return;
        this.syncDerivedColors();
        const tempId = this.editingId;
        const prev = colorPaletteSystem.palettes[tempId];
        colorPaletteSystem.palettes[tempId] = Object.assign({}, prev || {}, {
            name: this.draft.name,
            baseColor: this.draft.baseColor,
            secondBaseColor: this.draft.secondBaseColor
        });
        colorPaletteSystem.palettes[tempId] = colorPaletteSystem.expandPalette(
            colorPaletteSystem.palettes[tempId]
        );
        if (prev && prev._overridden) colorPaletteSystem.palettes[tempId]._overridden = true;
        colorPaletteSystem.applyPalette(tempId, { persist: !!persist });
        if (typeof colorManager !== 'undefined') {
            colorManager.currentPalette = tempId;
            colorManager.currentColors = colorPaletteSystem.getCurrentColors();
            if (colorManager._syncOverlay) colorManager._syncOverlay(tempId);
        }
        this.renderGraphicsPreview();
    }

    createUI() {
        if (this.overlay) this.overlay.remove();

        this.overlay = document.createElement('div');
        this.overlay.className = 'theme-editor-overlay';
        this.overlay.innerHTML = `
            <div class="theme-editor-panel">
                <h2 class="theme-editor-title">THEME EDITOR</h2>
                <p class="theme-editor-hint">Theme = basecolor + 2nd basecolor · Contrast / Saturation = global</p>
                <div class="theme-editor-body" id="teEditorBody">
                    <aside class="theme-editor-list" id="teList"></aside>
                    <div class="pe-resize-handle" data-resize="left" title="Resize theme list"></div>
                    <div class="theme-editor-detail">
                        <div class="theme-editor-meta" id="teMeta"></div>
                        <div class="theme-editor-appearance" id="teAppearance"></div>
                        <div class="theme-editor-preview-card" id="tePreviewCard">
                            <div class="te-preview-title">PREVIEW</div>
                            <div class="te-preview-row">
                                <button type="button" class="te-preview-btn te-preview-primary">PRIMARY</button>
                                <button type="button" class="te-preview-btn">SECONDARY</button>
                            </div>
                            <p class="te-preview-text">Sample UI text on this theme.</p>
                        </div>
                    </div>
                    <div class="pe-resize-handle" data-resize="right" title="Resize graphics preview"></div>
                    <aside class="theme-editor-gfx" id="teGfx">
                        <div class="theme-editor-gfx-title">GRAPHICS PREVIEW</div>
                        <div class="theme-editor-gfx-scroll" id="teGfxScroll"></div>
                    </aside>
                </div>
                <div class="theme-editor-footer">
                    <button type="button" class="pe-btn" id="teNew">NEW</button>
                    <button type="button" class="pe-btn" id="teDuplicate">SAVE AS</button>
                    <button type="button" class="pe-btn" id="teDelete">DELETE</button>
                    <button type="button" class="pe-btn pe-primary" id="teSave">SAVE</button>
                    <button type="button" class="pe-btn" id="teClose">CLOSE</button>
                </div>
                <div class="theme-editor-keys">ESC Close · Themes = basecolor + 2nd basecolor</div>
            </div>
        `;
        document.body.appendChild(this.overlay);

        this.setupPanelResize();
        this.buildGraphicsPreviewDom();
        this.renderList();
        this.renderMeta();
        this.renderAppearance();
        this.updatePreviewCard();
        this.renderGraphicsPreview();

        this.overlay.querySelector('#teClose').addEventListener('click', () => this.hide());
        this.overlay.querySelector('#teSave').addEventListener('click', () => this.saveCurrent());
        this.overlay.querySelector('#teDuplicate').addEventListener('click', () => this.saveAsNew());
        this.overlay.querySelector('#teNew').addEventListener('click', () => this.createBlank());
        this.overlay.querySelector('#teDelete').addEventListener('click', () => this.deleteCurrent());
    }

    setupPanelResize() {
        const body = this.overlay && this.overlay.querySelector('#teEditorBody');
        if (!body || typeof setupPanelResize !== 'function') return;
        if (this._panelResize) {
            this._panelResize.destroy();
            this._panelResize = null;
        }
        this._panelResize = setupPanelResize({
            body,
            root: this.overlay,
            storageKey: 'tePanelWidths',
            defaults: { left: 180, right: 340 },
            mins: { left: 120, right: 220, center: 280 },
            onChange: () => this.updateGfxColumns()
        });
        this.updateGfxColumns();
    }

    updateGfxColumns() {
        const gfx = this.overlay && this.overlay.querySelector('#teGfx');
        if (!gfx) return;
        const pad = 12;
        const cellMin = 84;
        const gap = 6;
        const avail = Math.max(0, gfx.clientWidth - pad);
        const cols = Math.max(1, Math.min(8, Math.floor((avail + gap) / (cellMin + gap)) || 1));
        gfx.style.setProperty('--te-gfx-cols', String(cols));
    }

    renderList() {
        const list = this.overlay.querySelector('#teList');
        if (!list) return;
        list.innerHTML = '';
        const palettes = (typeof colorManager !== 'undefined')
            ? colorManager.getPalettes()
            : [];
        palettes.forEach((p) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'theme-editor-item' + (p.id === this.editingId ? ' selected' : '');
            const baseDot = (typeof colorPaletteSystem !== 'undefined'
                && colorPaletteSystem.palettes[p.id]
                && colorPaletteSystem.palettes[p.id].baseColor)
                || p.baseColor
                || p.primary;
            const secondDot = (typeof colorPaletteSystem !== 'undefined'
                && colorPaletteSystem.palettes[p.id]
                && colorPaletteSystem.palettes[p.id].secondBaseColor)
                || p.secondBaseColor
                || '#FFFFFF';
            btn.innerHTML = `<span class="te-dot" style="background:linear-gradient(135deg, ${baseDot} 50%, ${secondDot} 50%)"></span><span>${p.name}</span>`;
            btn.addEventListener('click', () => {
                this.loadDraft(p.id);
                this.previewDraft(false);
                this.renderList();
                this.renderMeta();
                this.renderAppearance();
                this.updatePreviewCard();
            });
            list.appendChild(btn);
        });
    }

    renderMeta() {
        const meta = this.overlay.querySelector('#teMeta');
        if (!meta || !this.draft) return;
        meta.innerHTML = '';
        const nameRow = document.createElement('div');
        nameRow.className = 'theme-editor-name-row';
        const label = document.createElement('label');
        label.textContent = 'Name';
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'pe-text-input';
        input.value = this.draft.name || this.editingId;
        input.addEventListener('input', () => {
            this.draft.name = input.value;
        });
        nameRow.appendChild(label);
        nameRow.appendChild(input);
        meta.appendChild(nameRow);

        const idHint = document.createElement('div');
        idHint.className = 'theme-editor-id';
        const builtin = typeof colorPaletteSystem !== 'undefined' && colorPaletteSystem.isBuiltin(this.editingId);
        idHint.textContent = builtin
            ? `ID: ${this.editingId} (builtin — SAVE overwrites locally)`
            : `ID: ${this.editingId}`;
        meta.appendChild(idHint);
    }

    addSlider(parent, labelText, value, onChange) {
        const row = document.createElement('div');
        row.className = 'theme-editor-contrast-row';
        const label = document.createElement('label');
        label.textContent = labelText;
        const valEl = document.createElement('span');
        valEl.className = 'te-contrast-val';
        valEl.textContent = String(Math.round(value));
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = '0';
        slider.max = '200';
        slider.step = '1';
        slider.value = String(value);
        slider.className = 'te-contrast-slider';
        slider.addEventListener('input', () => {
            const v = Number(slider.value);
            valEl.textContent = String(v);
            onChange(v);
        });
        label.appendChild(slider);
        row.appendChild(label);
        row.appendChild(valEl);
        parent.appendChild(row);
        return row;
    }

    renderAppearance() {
        const root = this.overlay.querySelector('#teAppearance');
        if (!root || !this.draft) return;
        root.innerHTML = '';

        const baseTitle = document.createElement('div');
        baseTitle.className = 'theme-editor-appearance-title';
        baseTitle.textContent = 'Theme Basecolors';
        root.appendChild(baseTitle);

        const baseRow = document.createElement('div');
        baseRow.className = 'theme-editor-swatch te-swatch-base';
        const baseName = document.createElement('span');
        baseName.textContent = 'Base';
        const baseInput = document.createElement('button');
        baseInput.type = 'button';
        baseInput.className = 'te-color-swatch';
        const baseHexVal = this.toHex(this.draft.baseColor);
        baseInput.dataset.color = baseHexVal;
        baseInput.style.backgroundColor = baseHexVal;
        baseInput.setAttribute('aria-label', 'Pick base color');
        const baseHex = document.createElement('span');
        baseHex.className = 'te-hex';
        baseHex.textContent = baseHexVal;
        baseInput.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (typeof colorPickerOverlay === 'undefined' || !colorPickerOverlay.open) return;
            colorPickerOverlay.open(baseInput.dataset.color || baseHexVal, {
                anchor: baseInput,
                onChange: (hex) => {
                    const next = this.toHex(hex);
                    this.draft.baseColor = next;
                    baseInput.dataset.color = next;
                    baseInput.style.backgroundColor = next;
                    baseHex.textContent = next;
                    this.previewDraft(false);
                    this.updatePreviewCard();
                    this.renderList();
                }
            });
        });
        baseRow.appendChild(baseName);
        baseRow.appendChild(baseInput);
        baseRow.appendChild(baseHex);
        root.appendChild(baseRow);

        const secondRow = document.createElement('div');
        secondRow.className = 'theme-editor-swatch te-swatch-base';
        const secondName = document.createElement('span');
        secondName.textContent = '2nd Base';
        const secondInput = document.createElement('button');
        secondInput.type = 'button';
        secondInput.className = 'te-color-swatch';
        const secondHexVal = this.toHex(this.draft.secondBaseColor || '#ffffff');
        secondInput.dataset.color = secondHexVal;
        secondInput.style.backgroundColor = secondHexVal;
        secondInput.setAttribute('aria-label', 'Pick second base color');
        const secondHex = document.createElement('span');
        secondHex.className = 'te-hex';
        secondHex.textContent = secondHexVal;
        secondInput.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (typeof colorPickerOverlay === 'undefined' || !colorPickerOverlay.open) return;
            colorPickerOverlay.open(secondInput.dataset.color || secondHexVal, {
                anchor: secondInput,
                onChange: (hex) => {
                    const next = this.toHex(hex);
                    this.draft.secondBaseColor = next;
                    secondInput.dataset.color = next;
                    secondInput.style.backgroundColor = next;
                    secondHex.textContent = next;
                    this.previewDraft(false);
                    this.updatePreviewCard();
                    this.renderList();
                }
            });
        });
        secondRow.appendChild(secondName);
        secondRow.appendChild(secondInput);
        secondRow.appendChild(secondHex);
        root.appendChild(secondRow);

        const lookTitle = document.createElement('div');
        lookTitle.className = 'theme-editor-appearance-title';
        lookTitle.style.marginTop = '12px';
        lookTitle.textContent = 'Global Look (all themes)';
        root.appendChild(lookTitle);

        const look = this.getGlobalLook();
        this.addSlider(root, 'Contrast', look.contrast, (v) => {
            if (typeof colorPaletteSystem !== 'undefined' && colorPaletteSystem.setGlobalLook) {
                colorPaletteSystem.setGlobalLook({ contrast: v }, { apply: false });
            }
            this.previewDraft(false);
            this.updatePreviewCard();
        });

        this.addSlider(root, 'Saturation', look.saturation, (v) => {
            if (typeof colorPaletteSystem !== 'undefined' && colorPaletteSystem.setGlobalLook) {
                colorPaletteSystem.setGlobalLook({ saturation: v }, { apply: false });
            }
            this.previewDraft(false);
            this.updatePreviewCard();
        });
    }

    buildGraphicsPreviewDom() {
        const scroll = this.overlay.querySelector('#teGfxScroll');
        if (!scroll) return;
        scroll.innerHTML = '';
        this.previewGroups.forEach((group) => {
            if (!group.items || !group.items.length) return;
            const section = document.createElement('div');
            section.className = 'te-gfx-section';
            const title = document.createElement('div');
            title.className = 'te-gfx-section-title';
            title.textContent = group.title;
            section.appendChild(title);
            const grid = document.createElement('div');
            grid.className = 'te-gfx-grid';
            group.items.forEach((item) => {
                const cell = document.createElement('div');
                cell.className = 'te-gfx-cell';
                cell.dataset.kind = item.kind;
                cell.dataset.key = item.key;
                const canvas = document.createElement('canvas');
                canvas.width = 48;
                canvas.height = 48;
                canvas.className = 'te-gfx-canvas';
                const caption = document.createElement('span');
                caption.className = 'te-gfx-label';
                caption.textContent = item.label;
                caption.title = item.label;
                cell.appendChild(canvas);
                cell.appendChild(caption);
                grid.appendChild(cell);
            });
            section.appendChild(grid);
            scroll.appendChild(section);
        });
    }

    getPreviewTint() {
        if (!this.draft) return '#808080';
        return this.toHex(this.draft.baseColor || this.draft.primary || '#808080');
    }

    getSecondPreviewTint() {
        if (!this.draft) return '#ffffff';
        return this.toHex(this.draft.secondBaseColor || '#ffffff');
    }

    getContrastFilter() {
        const look = this.getGlobalLook();
        return 0.85 + (look.contrast / 100) * 0.75;
    }

    getIconContrast() {
        return this.getGlobalLook().iconContrast;
    }

    getIconBrightness() {
        return this.getGlobalLook().iconBrightness;
    }

    getIconSaturation() {
        return this.getGlobalLook().iconSaturation;
    }

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
    }

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
    }

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
    }

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
    }

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
    }

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
    }

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
    }

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
    }

    saveAsNew() {
        if (typeof colorPaletteSystem === 'undefined' || !this.draft) return;
        const name = window.prompt('New theme name', (this.draft.name || 'Custom') + ' Copy');
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
    }

    createBlank() {
        if (typeof colorPaletteSystem === 'undefined') return;
        const name = window.prompt('New theme name', 'Custom');
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
    }

    deleteCurrent() {
        if (typeof colorPaletteSystem === 'undefined') return;
        if (colorPaletteSystem.isBuiltin(this.editingId)) {
            window.alert('Builtin themes cannot be deleted. Use SAVE AS for a custom copy.');
            return;
        }
        if (!window.confirm(`Delete theme "${this.draft.name || this.editingId}"?`)) return;
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
    }

    handleKeyDown(e) {
        if (!this.visible) return;
        if (e.key === 'Escape') {
            e.preventDefault();
            this.hide();
        }
    }
}

let themeEditorUI = new ThemeEditorUI();
