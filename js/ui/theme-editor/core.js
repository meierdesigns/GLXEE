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
}
