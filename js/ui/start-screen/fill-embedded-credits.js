"use strict";

// StartScreenManager methods, split from start-screen.js.
// Line icons (16×16 path data) shown before each settings section title.
const SETTINGS_SECTION_ICONS = {
    theme: 'M8 2a6 6 0 1 0 0 12c1 0 1-1 .5-2s0-2 1.5-2h2a2 2 0 0 0 2-2c0-3.3-2.7-6-6-6zM5 7h1M7 4.5h1M10 5h1',
    look: 'M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8zM8 6a2 2 0 1 0 0 4 2 2 0 1 0 0-4',
    style: 'M2 14l3-1 8-8-2-2-8 8-1 3zM10 4l2 2',
    fx: 'M1.5 3h13v9h-13zM1.5 5.5h13M1.5 8h13M1.5 10.5h13M6 14h4',
    sound: 'M2 6h3l4-3v10l-4-3H2zM11 5.5a3.5 3.5 0 0 1 0 5M12.5 3.5a6 6 0 0 1 0 9',
    game: 'M3 5h10a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM4 7.5v2M3 8.5h2M11 8h.5M12.5 9.5h.5',
    enemies: 'M8 2l2 3h3l-2.5 2 1 3L8 8.5 4.5 10l1-3L3 5h3zM3 12h10v2H3z',
    shots: 'M7 2h2v8H7zM6 10h4v1H6zM7.5 12h1v2h-1zM3 4h2v5H3zM11 5h2v4h-2z',
    assets: 'M2 5l6-3 6 3v6l-6 3-6-3zM2 5l6 3 6-3M8 8v6'
};

extendClass(StartScreenManager, {
    fillEmbeddedCredits(body) {
        const panel = document.createElement('div');
        panel.className = 'hs-menu-panel-section hs-menu-panel-credits';
        panel.innerHTML =
            '<h2 class="hs-menu-panel-section-title">CREDITS</h2>' +
            '<div class="hs-credits-crawl-stage" aria-hidden="false">' +
            '<div class="hs-credits-crawl">' +
            '<div class="hs-credits-crawl-text">' +
            '<div class="hs-credits-crawl-line hs-credits-crawl-role">CREATOR</div>' +
            '<div class="hs-credits-crawl-line">LANCE MEIER / MEIERDESIGNS</div>' +
            '<div class="hs-credits-crawl-line hs-credits-crawl-title">GLXEE</div>' +
            '<div class="hs-credits-crawl-line">A RETRO SPACE SHOOTER</div>' +
            '</div>' +
            '</div>' +
            '</div>';
        body.appendChild(panel);
    },

    getClusterNavMap() {
        return {
            main: { up: null, down: null, left: null, right: null }
        };
    },

    getClusterIndexRanges() {
        const ranges = {};
        let start = 0;
        this.visibleMenuClusters.forEach((cluster) => {
            const end = start + cluster.items.length - 1;
            ranges[cluster.id] = { start: start, end: end };
            start = end + 1;
        });
        return ranges;
    },

    jumpToCluster(targetClusterId, preferOffset) {
        const ranges = this.getClusterIndexRanges();
        const range = ranges[targetClusterId];
        if (!range) return false;
        const offset = preferOffset != null ? preferOffset : 0;
        this.selectedIndex = Math.min(range.end, range.start + Math.max(0, offset));
        this.updateMenuSelection();
        return true;
    },

    getSelectedClusterOffset() {
        const ranges = this.getClusterIndexRanges();
        const id = this.menuItems[this.selectedIndex];
        let clusterId = null;
        this.visibleMenuClusters.forEach((c) => {
            if (c.items.some((item) => item.id === id)) clusterId = c.id;
        });
        if (!clusterId || !ranges[clusterId]) return { clusterId: null, offset: 0 };
        return {
            clusterId: clusterId,
            offset: this.selectedIndex - ranges[clusterId].start
        };
    },

    getMainMenuItemElements() {
        const host = this.getUIHost();
        if (!host) return [];
        return Array.from(host.querySelectorAll('.start-screen-menu-clustered .menu-item'));
    },

    /**
     * Spatial arrow nav: pick nearest item in direction, prefer same row/column.
     */
    navigateMainMenuSpatially(direction) {
        const items = this.getMainMenuItemElements();
        if (!items.length) return false;
        const current = items.find((el) => Number(el.dataset.menuIndex) === this.selectedIndex)
            || items[this.selectedIndex];
        if (!current) return false;
        const curRect = current.getBoundingClientRect();
        const cx = curRect.left + curRect.width / 2;
        const cy = curRect.top + curRect.height / 2;

        let best = null;
        let bestScore = Infinity;
        items.forEach((el) => {
            const idx = Number(el.dataset.menuIndex);
            if (idx === this.selectedIndex || Number.isNaN(idx)) return;
            const r = el.getBoundingClientRect();
            const x = r.left + r.width / 2;
            const y = r.top + r.height / 2;
            const dx = x - cx;
            const dy = y - cy;
            const absDx = Math.abs(dx);
            const absDy = Math.abs(dy);
            const rowSlop = Math.max(18, curRect.height * 0.75);
            const colSlop = Math.max(24, curRect.width * 0.6);

            let ok = false;
            let primary = 0;
            let secondary = 0;
            if (direction === 'up') {
                ok = dy < -4;
                primary = -dy;
                secondary = absDx;
                if (absDx <= colSlop) secondary *= 0.15;
            } else if (direction === 'down') {
                ok = dy > 4;
                primary = dy;
                secondary = absDx;
                if (absDx <= colSlop) secondary *= 0.15;
            } else if (direction === 'left') {
                ok = dx < -4;
                primary = -dx;
                secondary = absDy;
                if (absDy <= rowSlop) secondary *= 0.1;
            } else if (direction === 'right') {
                ok = dx > 4;
                primary = dx;
                secondary = absDy;
                if (absDy <= rowSlop) secondary *= 0.1;
            }
            if (!ok) return;
            const score = primary + secondary * 2.5;
            if (score < bestScore) {
                bestScore = score;
                best = idx;
            }
        });

        if (best == null) return false;
        this.selectedIndex = best;
        this.updateMenuSelection();
        return true;
    },

    /** Guarantee the five enemy-class size rows exist (survives stale caches). */
    sizePxDefaults(kind, id) {
        if (kind === 'player') return { min: 6, max: 60, fallback: 18 };
        if (kind === 'shot') return { min: 1, max: 40, fallback: 4 };
        return { min: 12, max: 200, fallback: ({ scout: 36, assault: 48, heavy: 58, elite: 70, capital: 84 })[id] || 48 };
    },

    readSizePxSetting(kind, id) {
        const def = this.sizePxDefaults(kind, id);
        if (typeof uiAppearanceManager !== 'undefined' && uiAppearanceManager.getSizePx) {
            return String(Math.round(uiAppearanceManager.getSizePx(kind, id)));
        }
        return String(def.fallback);
    },

    ensureEnemyClassSizeSettings() {
        if (!Array.isArray(this.settingsItems)) this.settingsItems = [];
        const classes = [
            { id: 'scout', name: 'Scout Size' },
            { id: 'assault', name: 'Assault Size' },
            { id: 'heavy', name: 'Heavy Size' },
            { id: 'elite', name: 'Elite Size' },
            { id: 'capital', name: 'Capital Size' }
        ];
        // Drop legacy single "Enemy Size" row if present.
        this.settingsItems = this.settingsItems.filter((item) => item && item.type !== 'enemySize');
        let insertAt = this.settingsItems.findIndex((item) => item && item.type === 'shipRenderStyle');
        insertAt = insertAt >= 0 ? insertAt + 1 : this.settingsItems.length;

        let playerItem = this.settingsItems.find((s) => s && s.type === 'playerSize');
        const playerDef = this.sizePxDefaults('player');
        if (!playerItem) {
            playerItem = {
                name: 'Player Size',
                value: this.readSizePxSetting('player'),
                min: playerDef.min, max: playerDef.max, step: 1, suffix: 'px',
                type: 'playerSize'
            };
            this.settingsItems.splice(insertAt, 0, playerItem);
            insertAt += 1;
        } else {
            playerItem.name = 'Player Size';
            playerItem.min = playerDef.min;
            playerItem.max = playerDef.max;
            playerItem.step = 1;
            playerItem.suffix = 'px';
            delete playerItem.options;
            playerItem.value = this.readSizePxSetting('player');
        }

        classes.forEach((cls, i) => {
            const def = this.sizePxDefaults('enemy', cls.id);
            let item = this.settingsItems.find((s) => s && s.type === 'enemyClassSize' && s.enemyClass === cls.id);
            if (!item) {
                item = {
                    name: cls.name,
                    value: this.readSizePxSetting('enemy', cls.id),
                    min: def.min, max: def.max, step: 1, suffix: 'px',
                    type: 'enemyClassSize',
                    enemyClass: cls.id
                };
                this.settingsItems.splice(insertAt + i, 0, item);
            } else {
                item.name = cls.name;
                item.min = def.min;
                item.max = def.max;
                item.step = 1;
                item.suffix = 'px';
                delete item.options;
                item.value = this.readSizePxSetting('enemy', cls.id);
            }
        });
    },

    /** Guarantee player / enemy / boss shot-size rows exist. */
    ensureShotSizeSettings() {
        if (!Array.isArray(this.settingsItems)) this.settingsItems = [];
        const kinds = [
            { id: 'player', name: 'Player Shots' },
            { id: 'enemy', name: 'Enemy Shots' },
            { id: 'boss', name: 'Boss Shots' }
        ];
        let insertAt = this.settingsItems.findIndex((item) => item && item.type === 'enemyClassSize'
            && item.enemyClass === 'capital');
        insertAt = insertAt >= 0 ? insertAt + 1 : this.settingsItems.length;
        kinds.forEach((kind, i) => {
            const def = this.sizePxDefaults('shot', kind.id);
            let item = this.settingsItems.find((s) => s && s.type === 'shotSize' && s.shotKind === kind.id);
            if (!item) {
                item = {
                    name: kind.name,
                    value: this.readSizePxSetting('shot', kind.id),
                    min: def.min, max: def.max, step: 1, suffix: 'px',
                    type: 'shotSize',
                    shotKind: kind.id
                };
                this.settingsItems.splice(insertAt + i, 0, item);
            } else {
                item.name = kind.name;
                item.min = def.min;
                item.max = def.max;
                item.step = 1;
                item.suffix = 'px';
                delete item.options;
                item.value = this.readSizePxSetting('shot', kind.id);
            }
        });
    },

    createSettingsUI(content, opts) {
        const bare = !!(opts && opts.bare);
        this.ensureEnemyClassSizeSettings();
        this.ensureShotSizeSettings();
        if (typeof VFBgMouseParallax !== 'undefined') {
            const parallaxItem = this.settingsItems.find(item => item.type === 'bgParallax');
            if (parallaxItem) parallaxItem.value = VFBgMouseParallax.getIntensity();
        }
        if (typeof uiAppearanceManager !== 'undefined') {
            this.settingsItems.forEach((item) => {
                if (item.type === 'uiFx' && item.fxKey) {
                    item.value = item.fxKey === 'arcade' ? uiAppearanceManager.getFxValue(item.fxKey) : String(uiAppearanceManager.getFxPercent(item.fxKey));
                }
                if (item.type === 'shipRenderStyle') {
                    item.value = uiAppearanceManager.shipRenderStyle;
                }
                if (item.type === 'voxelSize') {
                    item.value = String(uiAppearanceManager.voxelSize || '1');
                    item.options = uiAppearanceManager.getVoxelSizeOptions
                        ? uiAppearanceManager.getVoxelSizeOptions()
                        : ['1', '2', '3', '4'];
                }
                if (item.type === 'enemyClassSize' && item.enemyClass) {
                    item.value = this.readSizePxSetting('enemy', item.enemyClass);
                }
                if (item.type === 'playerSize') {
                    item.value = this.readSizePxSetting('player');
                }
                if (item.type === 'shotSize' && item.shotKind) {
                    item.value = this.readSizePxSetting('shot', item.shotKind);
                }
            });
        }
        this.syncControlsSettingFromAppearance();
        const ytItem = this.settingsItems.find((item) => item.type === 'youtubeUrl');
        if (ytItem && typeof youtubeSoundtrackManager !== 'undefined') {
            ytItem.value = youtubeSoundtrackManager.getMenuUrl() || '';
        }
        const difficultyItem = this.settingsItems.find((item) => item.name === 'Difficulty');
        if (difficultyItem && typeof difficultyConfigManager !== 'undefined') {
            difficultyItem.value = String(difficultyConfigManager.current || 'normal').toUpperCase();
        }
        const look = (typeof colorPaletteSystem !== 'undefined' && colorPaletteSystem.getGlobalLook)
            ? colorPaletteSystem.getGlobalLook() : null;
        const brightness = this.settingsItems.find((item) => item.lookKey === 'brightness');
        const contrast = this.settingsItems.find((item) => item.lookKey === 'contrast');
        const saturation = this.settingsItems.find((item) => item.lookKey === 'saturation');
        const grayscale = this.settingsItems.find((item) => item.type === 'grayscale');
        if (look) {
            if (brightness) brightness.value = String(Math.round(look.brightness));
            if (contrast) contrast.value = String(Math.round(look.contrast));
            if (saturation) saturation.value = String(Math.round(look.saturation));
            if (grayscale) grayscale.value = look.saturation === 0 ? 'ON' : 'OFF';
        }

        if (!bare) {
            const header = document.createElement('div');
            header.className = 'settings-modal-header';

            const title = document.createElement('h2');
            title.textContent = 'SETTINGS';
            title.className = 'start-screen-title settings-modal-title';
            header.appendChild(title);

            const closeBtn = document.createElement('button');
            closeBtn.type = 'button';
            closeBtn.className = 'settings-modal-close';
            closeBtn.setAttribute('aria-label', 'Close');
            closeBtn.title = 'Close';
            closeBtn.textContent = '✕';
            closeBtn.addEventListener('click', () => this.handleEscape());
            header.appendChild(closeBtn);

            content.appendChild(header);
        }

        const panel = document.createElement('div');
        panel.className = 'settings-panel settings-panel-clustered';

        const left = document.createElement('div');
        left.className = 'settings-cluster';
        left.dataset.cluster = 'appearance';

        const middle = document.createElement('div');
        middle.className = 'settings-cluster';
        middle.dataset.cluster = 'style-fx';

        const right = document.createElement('div');
        right.className = 'settings-cluster';
        right.dataset.cluster = 'audio-game';

        // Prefer SHOTS once on first land so the new rows are visible;
        // otherwise keep the last-opened section.
        let openSection = 'shots';
        try {
            const seen = localStorage.getItem('vf_settings_shots_seen_v1');
            if (seen) {
                openSection = localStorage.getItem('vf_settings_open_section') || 'enemies';
            } else {
                localStorage.setItem('vf_settings_shots_seen_v1', '1');
                localStorage.setItem('vf_settings_open_section', 'shots');
                openSection = 'shots';
            }
        } catch (e) { /* optional */ }

        const addSection = (parent, sectionId, sectionTitle, predicate) => {
            const items = this.settingsItems
                .map((item, index) => ({ item, index }))
                .filter(({ item }) => predicate(item));
            if (!items.length) return;

            const sectionEl = document.createElement('details');
            sectionEl.className = 'settings-section';
            sectionEl.dataset.section = sectionId;
            sectionEl.open = sectionId === openSection;
            sectionEl.addEventListener('toggle', () => {
                if (!sectionEl.open) return;
                panel.querySelectorAll('details.settings-section[open]').forEach((d) => {
                    if (d !== sectionEl) d.open = false;
                });
                try { localStorage.setItem('vf_settings_open_section', sectionId); } catch (e) { /* optional */ }
            });

            const heading = document.createElement('summary');
            heading.className = 'settings-section-title';
            const icon = SETTINGS_SECTION_ICONS[sectionId];
            heading.innerHTML = (icon ? `<svg class="settings-section-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="${icon}"/></svg>` : '') +
                `<span class="settings-section-name"></span>`;
            heading.querySelector('.settings-section-name').textContent = sectionTitle;
            sectionEl.appendChild(heading);

            const list = document.createElement('div');
            list.className = 'settings-section-list';
            items.forEach(({ item, index }) => {
                list.appendChild(this.buildSettingsRow(item, index));
            });

            sectionEl.appendChild(list);
            parent.appendChild(sectionEl);
        };

        addSection(left, 'theme', 'THEME', (item) =>
            item.type === 'palette' || item.type === 'secondBase'
        );
        addSection(left, 'look', 'LOOK', (item) =>
            item.type === 'globalLook' || item.type === 'grayscale'
        );
        addSection(bare ? left : middle, 'style', 'STYLE', (item) =>
            item.type === 'borderWeight' ||
            item.type === 'indicatorWeight' ||
            item.type === 'fontMenu' ||
            item.type === 'bgParallax' ||
            item.type === 'controlsHints' ||
            item.type === 'shipRenderStyle' ||
            item.type === 'voxelSize'
        );
        addSection(bare ? left : middle, 'fx', 'RETRO FX', (item) => item.type === 'uiFx');
        addSection(right, 'sound', 'SOUND', (item) =>
            item.type === 'volume' ||
            item.name === 'Sound' ||
            item.name === 'Music' ||
            item.type === 'youtubeUrl'
        );
        addSection(right, 'game', 'GAME', (item) =>
            item.name === 'Difficulty' || item.action === 'difficultyEditor'
                || item.action === 'factionCommand'
        );
        addSection(right, 'enemies', 'ENEMIES', (item) =>
            item.type === 'enemyClassSize' || item.type === 'playerSize');
        addSection(right, 'shots', 'SHOTS', (item) => item.type === 'shotSize');
        // Asset editor lives here only (no main-menu entry).
        addSection(right, 'assets', 'ASSETS', (item) =>
            (item.type === 'action' && item.action !== 'difficultyEditor'
                && item.action !== 'factionCommand') || item.type === 'assetStatus'
        );

        this.attachShipRenderPreview(bare ? left : middle);

        panel.appendChild(left);
        if (!bare) {
            panel.classList.add('settings-panel-3col');
            panel.appendChild(middle);
        }
        panel.appendChild(right);
        content.appendChild(panel);

        if (!bare) {
            const instructions = this.buildControlsHint([
                'ARROW KEYS / MOUSE: Navigate',
                'LEFT/RIGHT / CLICK: Change Value',
                'ASSETS: Open Generator (Comfy + Bridge)',
                'ESC: Back'
            ]);
            content.appendChild(instructions);
            content.appendChild(this.buildControlsShowBtn());
        }

        this.refreshAssetBridgeStatus();
    },
});
