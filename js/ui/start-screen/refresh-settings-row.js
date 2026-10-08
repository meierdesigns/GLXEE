"use strict";

// StartScreenManager methods, split from start-screen.js.
extendClass(StartScreenManager, {
    refreshSettingsRow(index) {
        const item = this.settingsItems[index];
        if (!item) return;

        const startScreen = this.getUIHost();
        if (!startScreen) return;

        if (item.type === 'palette') {
            const list = startScreen.querySelector('.theme-list[data-theme-strip="1"], .theme-strip[data-theme-strip="1"]');
            this.syncThemeStripActive(list, item.value, true);
            const row = startScreen.querySelector('.settings-row-theme');
            const toggle = row && row.querySelector('[data-theme-toggle]');
            if (toggle) {
                const palettes = (typeof themeContextManager !== 'undefined')
                    ? themeContextManager.getPresetOptions(false)
                    : (colorManager ? colorManager.getPalettes() : []);
                const current = palettes.find((p) => p.id === item.value);
                if (current) {
                    const nameEl = toggle.querySelector('.theme-list-name');
                    if (nameEl) nameEl.textContent = current.name;
                    const swatchEl = toggle.querySelector('.theme-list-swatch');
                    if (swatchEl) swatchEl.replaceWith(this.buildThemeSwatchEl(current));
                }
            }
            this.syncSecondBaseSettingValue();
            const secondIdx = this.settingsItems.findIndex((s) => s.type === 'secondBase');
            if (secondIdx >= 0) this.refreshSettingsRow(secondIdx);
            return;
        }

        if (item.type === 'secondBase') {
            const valueEl = startScreen.querySelector(`[data-settings-value="${index}"]`);
            const hex = this.toSettingsHex(item.value).toUpperCase();
            if (valueEl) valueEl.textContent = hex;
            const swatch = startScreen.querySelector('.settings-second-base-swatch');
            if (swatch) {
                const hex = this.toSettingsHex(item.value);
                swatch.dataset.color = hex;
                swatch.style.backgroundColor = hex;
            }
            return;
        }

        if (item.type === 'fontMenu') {
            const valueEl = startScreen.querySelector(`[data-settings-value="${index}"]`);
            if (valueEl) {
                const family = (typeof uiAppearanceManager !== 'undefined') ? uiAppearanceManager.font : 'COURIER';
                valueEl.textContent = `${family} ›`;
            }
            return;
        }

        if (item.type === 'volume') return;
        if (item.type === 'youtubeUrl') {
            const input = startScreen.querySelector(`[data-settings-youtube="${index}"]`);
            if (input) input.value = item.value || '';
            return;
        }

        if (item.type === 'globalLook' || (item.type === 'uiFx' && !(typeof uiAppearanceManager !== 'undefined' && uiAppearanceManager.isEnumFx(item.fxKey)))
            || item.type === 'playerSize' || item.type === 'enemyClassSize' || item.type === 'shotSize') {
            const min = item.min != null ? item.min : 0;
            const max = item.max != null ? item.max : 200;
            const suffix = item.suffix || (item.type === 'playerSize' || item.type === 'enemyClassSize' || item.type === 'shotSize' ? 'px' : '%');
            const valueEl = startScreen.querySelector(`[data-settings-value="${index}"]`);
            if (valueEl) valueEl.textContent = `${item.value}${suffix}`;
            const slider = startScreen.querySelector(`[data-settings-look="${index}"]`);
            this.syncLookSliderFill(slider, item.value, min, max);
            return;
        }

        const valueEl = startScreen.querySelector(`[data-settings-value="${index}"]`);
        if (valueEl) {
            const suffix = item.suffix || (item.type === 'indicatorWeight' ? 'px' : '');
            valueEl.textContent = `${item.value}${suffix}`;
            if (item.type === 'assetStatus') {
                valueEl.classList.toggle('settings-asset-ready', item.value === 'READY');
                valueEl.classList.toggle('settings-asset-warn', item.value === 'BRIDGE · NO COMFY');
                valueEl.classList.toggle('settings-asset-off', item.value === 'OFFLINE' || item.value === '…');
            }
        }
        if ((item.type === 'shipRenderStyle' || item.type === 'voxelSize')
            && this.refreshShipRenderPreview) {
            this.refreshShipRenderPreview();
        }
    },

    getSettingsPreviewShip() {
        if (typeof galaxyMapUI !== 'undefined' && galaxyMapUI && galaxyMapUI.getActiveShipModel) {
            const model = galaxyMapUI.getActiveShipModel();
            if (model) return model;
        }
        let shipId = 'player_scrap';
        if (typeof profileManager !== 'undefined' && profileManager.getActiveShipId) {
            shipId = profileManager.getActiveShipId() || shipId;
        } else if (typeof homeStationUI !== 'undefined' && homeStationUI && homeStationUI.hangarShipId) {
            shipId = homeStationUI.hangarShipId || shipId;
        }
        if (typeof shipConfigManager !== 'undefined' && shipConfigManager.getMergedModel) {
            const model = shipConfigManager.getMergedModel(shipId);
            if (model) {
                if (!model.id) model.id = shipId;
                return model;
            }
        }
        if (typeof shipAssetLoader !== 'undefined' && shipAssetLoader.getPlayerShipModels) {
            const ships = shipAssetLoader.getPlayerShipModels();
            if (ships && ships.length) return ships[0];
        }
        return { id: shipId, name: shipId, type: shipId };
    },

    buildShipRenderPreview() {
        const box = document.createElement('div');
        box.className = 'settings-ship-render-preview';
        box.setAttribute('aria-label', 'Ship render preview');

        const canvas = document.createElement('canvas');
        canvas.className = 'settings-ship-render-canvas';
        canvas.width = 160;
        canvas.height = 160;
        canvas.id = 'settingsShipRenderCanvas';

        const caption = document.createElement('span');
        caption.className = 'settings-ship-render-caption';
        caption.dataset.shipRenderCaption = '1';

        box.appendChild(canvas);
        box.appendChild(caption);
        return box;
    },

    attachShipRenderPreview(cluster) {
        if (!cluster) return;
        const styleSec = cluster.querySelector('details.settings-section[data-section="style"]');
        if (!styleSec) return;
        const list = styleSec.querySelector('.settings-section-list');
        if (!list || styleSec.querySelector('.settings-ship-render-preview')) return;

        const body = document.createElement('div');
        body.className = 'settings-style-body';
        list.replaceWith(body);
        body.appendChild(list);
        body.appendChild(this.buildShipRenderPreview());

        const paint = () => this.refreshShipRenderPreview();
        styleSec.addEventListener('toggle', paint);
        requestAnimationFrame(paint);
    },

    refreshShipRenderPreview() {
        const host = this.getUIHost && this.getUIHost();
        if (!host) return;
        const canvas = host.querySelector('#settingsShipRenderCanvas');
        if (!canvas) return;

        const styleItem = this.settingsItems && this.settingsItems.find((s) => s && s.type === 'shipRenderStyle');
        const style = (styleItem && styleItem.value)
            || (typeof uiAppearanceManager !== 'undefined' && uiAppearanceManager.shipRenderStyle)
            || 'FLAT';
        const voxelItem = this.settingsItems && this.settingsItems.find((s) => s && s.type === 'voxelSize');
        let voxelSize = Number(
            (voxelItem && voxelItem.value)
            || (typeof uiAppearanceManager !== 'undefined' && uiAppearanceManager.voxelSize)
            || 1
        );
        if (!(voxelSize > 0)) voxelSize = 1;
        voxelSize = Math.max(0.25, Math.min(4, voxelSize));

        const caption = host.querySelector('[data-ship-render-caption]');
        if (caption) {
            caption.textContent = String(style).toUpperCase() === 'VOXEL'
                ? ('VOXEL · ' + voxelSize)
                : String(style);
        }

        if (typeof uiAppearanceManager !== 'undefined') {
            if (uiAppearanceManager.setShipRenderStyle
                && uiAppearanceManager.shipRenderStyle !== style) {
                uiAppearanceManager.setShipRenderStyle(style);
            }
            if (uiAppearanceManager.setVoxelSize
                && String(uiAppearanceManager.voxelSize) !== String(voxelSize)) {
                uiAppearanceManager.setVoxelSize(voxelSize);
            }
        }

        const ship = this.getSettingsPreviewShip();
        if (!ship || typeof shipRenderer === 'undefined' || !shipRenderer.renderShipPreview) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = 'rgba(255,255,255,0.15)';
                ctx.fillRect(canvas.width * 0.3, canvas.height * 0.35, canvas.width * 0.4, canvas.height * 0.3);
            }
            return;
        }
        if (shipRenderer.init) shipRenderer.init();
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.imageSmoothingEnabled = false;
            if (ctx.mozImageSmoothingEnabled !== undefined) ctx.mozImageSmoothingEnabled = false;
            if (ctx.webkitImageSmoothingEnabled !== undefined) ctx.webkitImageSmoothingEnabled = false;
        }
        const loader = (typeof graphicsManager !== 'undefined' && graphicsManager.shipAssetLoader)
            || (typeof shipAssetLoader !== 'undefined' ? shipAssetLoader : null);
        const prevGlobal = loader ? loader.globalVoxelCell : null;
        const prevScale = loader ? loader.deviceScale : null;
        if (loader && String(style).toUpperCase() === 'VOXEL') {
            // Preview lattice follows Voxel Size (0.25–4). ×4 keeps blocks readable
            // on the 160² canvas the same way combat uses render-scale.
            loader.globalVoxelCell = Math.max(1, voxelSize * 4);
            loader.deviceScale = 1;
            canvas.style.imageRendering = 'pixelated';
        } else if (loader) {
            loader.globalVoxelCell = null;
        }
        try {
            shipRenderer.renderShipPreview(canvas, ship, 1, 1);
        } finally {
            if (loader) {
                loader.globalVoxelCell = prevGlobal;
                loader.deviceScale = prevScale;
            }
        }
    },

    openFontMenu() {
        this.syncFontMenuItems();
        this.showFontMenu = true;
        this.fontMenuIndex = 0;
        this.createStartScreenUI();
    },

    createFontMenuUI(content) {
        this.syncFontMenuItems();

        const title = document.createElement('h2');
        title.textContent = 'FONT';
        title.className = 'start-screen-title type-h1';

        const preview = document.createElement('div');
        preview.className = 'font-menu-preview';
        preview.innerHTML = `
            <div class="type-h1">H1 TITLE</div>
            <div class="type-h2">H2 LABELS</div>
            <div class="type-text">Text sample body</div>
            <div class="type-small">Small print, hints and captions</div>
        `;

        const menu = document.createElement('div');
        menu.className = 'start-screen-menu settings-panel';

        this.fontMenuItems.forEach((item, index) => {
            const menuItem = document.createElement('div');
            menuItem.className = `menu-item settings-row ${index === this.fontMenuIndex ? 'selected' : ''}`;
            menuItem.dataset.fontIndex = String(index);
            menuItem.style.textAlign = 'left';

            const label = document.createElement('span');
            label.className = 'settings-row-label';
            label.textContent = item.name;

            const controls = document.createElement('div');
            controls.className = 'settings-row-controls';

            const prevBtn = document.createElement('button');
            prevBtn.type = 'button';
            prevBtn.className = 'settings-cycle-btn';
            prevBtn.textContent = '‹';
            prevBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.fontMenuIndex = index;
                this.changeFontMenuValue(-1);
            });

            const value = document.createElement('span');
            value.className = 'settings-row-value';
            value.dataset.fontValue = String(index);
            const suffix = item.type === 'fontSize' ? 'px' : '';
            value.textContent = `${item.value}${suffix}`;

            const nextBtn = document.createElement('button');
            nextBtn.type = 'button';
            nextBtn.className = 'settings-cycle-btn';
            nextBtn.textContent = '›';
            nextBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.fontMenuIndex = index;
                this.changeFontMenuValue(1);
            });

            controls.appendChild(prevBtn);
            controls.appendChild(value);
            controls.appendChild(nextBtn);
            menuItem.appendChild(label);
            menuItem.appendChild(controls);

            menuItem.addEventListener('mouseenter', () => {
                this.fontMenuIndex = index;
                this.updateMenuSelection();
            });
            menuItem.addEventListener('click', (e) => {
                if (e.target.closest('.settings-cycle-btn')) return;
                this.fontMenuIndex = index;
                this.changeFontMenuValue(1);
            });
            menu.appendChild(menuItem);
        });

        const instructions = this.buildControlsHint([
            'ARROW KEYS / MOUSE: Navigate',
            'LEFT/RIGHT / CLICK: Change Value',
            'ESC: Back to Settings'
        ]);

        content.appendChild(title);
        content.appendChild(preview);
        content.appendChild(menu);
        content.appendChild(instructions);
        content.appendChild(this.buildControlsShowBtn());
    },

    // Legacy method - no longer needed with HSL system
    getColorValue(colorName) {
        console.warn('getColorValue is deprecated - use HSL system instead');
        return 'var(--current-primary)';
    },

    createCreditsUI(content) {
        const title = document.createElement('h2');
        title.textContent = 'CREDITS';
        title.className = 'start-screen-title';

        const stage = document.createElement('div');
        stage.className = 'hs-credits-crawl-stage hs-credits-crawl-stage-fullscreen';
        stage.innerHTML =
            '<div class="hs-credits-crawl">' +
            '<div class="hs-credits-crawl-text">' +
            '<div class="hs-credits-crawl-line hs-credits-crawl-role">CREATOR</div>' +
            '<div class="hs-credits-crawl-line">LANCE MEIER / MEIERDESIGNS</div>' +
            '<div class="hs-credits-crawl-line hs-credits-crawl-title">GLXEE</div>' +
            '<div class="hs-credits-crawl-line">A RETRO SPACE SHOOTER</div>' +
            '</div>' +
            '</div>';

        const backItem = document.createElement('div');
        backItem.className = 'menu-item selected hs-credits-crawl-back';
        backItem.textContent = 'CLICK OR ESC TO RETURN';
        backItem.addEventListener('click', () => this.handleEscape());

        content.appendChild(title);
        content.appendChild(stage);
        content.appendChild(backItem);
    },

    createLevelsUI(content) {
        const title = document.createElement('h2');
        title.textContent = 'LEVEL SELECTION';
        title.className = 'start-screen-title';

        const menu = document.createElement('div');
        menu.className = 'start-screen-menu';

        this.planets.forEach((planet, index) => {
            const menuItem = document.createElement('div');
            menuItem.className = `menu-item ${index === this.levelIndex ? 'selected' : ''} ${planet.unlocked ? '' : 'locked'}`;
            menuItem.textContent = `${planet.name} - ${planet.difficulty}`;
            if (planet.unlocked) {
                menuItem.addEventListener('mouseenter', () => {
                    this.levelIndex = index;
                    this.updateMenuSelection();
                });
                menuItem.addEventListener('click', () => {
                    this.levelIndex = index;
                    this.updateMenuSelection();
                    this.startGame(planet);
                });
            }
            menu.appendChild(menuItem);
        });

        const instructions = this.buildControlsHint([
            'ARROW KEYS / MOUSE: Navigate',
            'SPACEBAR / CLICK: Select',
            'ESC: Back'
        ]);

        content.appendChild(title);
        content.appendChild(menu);
        content.appendChild(instructions);
        content.appendChild(this.buildControlsShowBtn());
    },

    buildControlsHint(lines) {
        const wrap = document.createElement('div');
        wrap.className = 'ui-controls-hint start-screen-instructions';
        (lines || []).forEach((line) => {
            const p = document.createElement('p');
            p.textContent = line;
            wrap.appendChild(p);
        });
        const hideBtn = document.createElement('button');
        hideBtn.type = 'button';
        hideBtn.className = 'ui-controls-hide-btn';
        hideBtn.title = 'Hide controls (Shift+H)';
        hideBtn.setAttribute('aria-label', 'Hide controls');
        hideBtn.textContent = 'HIDE';
        hideBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.setControlsHintsVisible(false);
        });
        wrap.appendChild(hideBtn);
        return wrap;
    },
});
