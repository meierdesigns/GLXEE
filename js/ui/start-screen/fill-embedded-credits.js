"use strict";

// StartScreenManager methods, split from start-screen.js.
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
            '<div class="hs-credits-crawl-line">GLXEE</div>' +
            '<div class="hs-credits-crawl-line">RETRO SPACE SHOOTER</div>' +
            '<div class="hs-credits-crawl-line">GAME BOY STYLE</div>' +
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

    createSettingsUI(content, opts) {
        const bare = !!(opts && opts.bare);
        if (typeof VFBgMouseParallax !== 'undefined') {
            const parallaxItem = this.settingsItems.find(item => item.type === 'bgParallax');
            if (parallaxItem) parallaxItem.value = VFBgMouseParallax.getIntensity();
        }
        if (typeof uiAppearanceManager !== 'undefined') {
            this.settingsItems.forEach((item) => {
                if (item.type === 'uiFx' && item.fxKey) {
                    item.value = uiAppearanceManager.getFxValue(item.fxKey);
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

        const right = document.createElement('div');
        right.className = 'settings-cluster';
        right.dataset.cluster = 'audio-game';

        const addSection = (parent, sectionId, sectionTitle, predicate) => {
            const items = this.settingsItems
                .map((item, index) => ({ item, index }))
                .filter(({ item }) => predicate(item));
            if (!items.length) return;

            const sectionEl = document.createElement('section');
            sectionEl.className = 'settings-section';
            sectionEl.dataset.section = sectionId;

            const heading = document.createElement('h3');
            heading.className = 'settings-section-title';
            heading.textContent = sectionTitle;
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
        addSection(left, 'style', 'STYLE', (item) =>
            item.type === 'borderWeight' ||
            item.type === 'indicatorWeight' ||
            item.type === 'fontMenu' ||
            item.type === 'bgParallax' ||
            item.type === 'controlsHints' ||
            item.type === 'shipRenderStyle'
        );
        addSection(left, 'fx', 'RETRO FX', (item) => item.type === 'uiFx');
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
        if (!bare) {
            addSection(right, 'assets', 'ASSETS', (item) =>
                (item.type === 'action' && item.action !== 'difficultyEditor'
                    && item.action !== 'factionCommand') || item.type === 'assetStatus'
            );
        }

        panel.appendChild(left);
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
