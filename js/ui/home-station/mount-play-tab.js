"use strict";

// HomeStationUI methods, split from home-station.js.
extendClass(HomeStationUI, {
    mountPlayTab() {
        const mount = this.overlay && this.overlay.querySelector('#hsPlayMount');
        if (!mount || typeof galaxyMapManager === 'undefined') return;
        const profile = this.getProfile();
        const galaxyId = (typeof profileManager !== 'undefined')
            ? profileManager.getCurrentGalaxyId(profile)
            : 'milky_way';
        galaxyMapManager.show({
            galaxyId: galaxyId,
            mount: mount,
            onConfirm: (planet) => this.startMission(planet),
            onBack: () => {
                this.exitPlayMap();
                this.tab = 'station';
                this.statusMsg = '';
                this.persistTab();
                this.createUI();
            },
            onEscape: () => {
                this.exitPlayMap();
            },
            onExplored: () => {}
        });
        this.syncPlayHint();
    },

    getActivePlayShipId() {
        if (typeof profileManager !== 'undefined' && profileManager.getActiveShipId) {
            const id = profileManager.getActiveShipId();
            if (id) return id;
        }
        return this.hangarShipId || 'player_scrap';
    },

    startMission(planet) {
        if (!planet) return;
        const shipId = this.getActivePlayShipId();
        const ship = this.getHangarShipModel(shipId);
        if (ship && !ship.id) ship.id = shipId;
        if (ship && !ship.type) ship.type = shipId;

        const planetId = String(planet.planetId || planet.id || '').toLowerCase();
        let levelId = String(planet.levelId || '').toLowerCase();
        if (!levelId && planetId) {
            if (planet.startMode === 'start') {
                levelId = `${planetId}-1`;
            } else if (typeof profileManager !== 'undefined' && profileManager.getResumeLevelId) {
                levelId = profileManager.getResumeLevelId(planetId) || `${planetId}-1`;
            } else {
                levelId = planetId;
            }
        }
        const level = {
            id: levelId,
            name: planet.name || String(planet.planetId || planet.id || '').toUpperCase(),
            difficulty: planet.difficulty || '',
            unlocked: planet.unlocked !== false,
            description: planet.description || '',
            enemyCount: planet.enemyCount || 0,
            obstacleCount: planet.obstacleCount || 0,
            reward: planet.reward || 'XP',
            galaxyId: planet.galaxyId || null
        };
        if (!planetId) {
            this.setStatus('NO PLANET SELECTED');
            return;
        }
        if (level.unlocked === false) {
            this.setStatus('PLANET LOCKED');
            return;
        }

        if (typeof profileManager !== 'undefined' && profileManager.setActiveShip) {
            profileManager.setActiveShip(shipId);
        }
        if (typeof graphicsManager !== 'undefined') {
            graphicsManager.setPlayerShipModel(ship);
        }

        this.hide();

        if (typeof startScreenManager !== 'undefined') {
            startScreenManager.startGameWithLevelAndShip(level, ship);
        }
    },

    isPlayMapActive() {
        return !!(typeof galaxyMapManager !== 'undefined' &&
            galaxyMapManager.isVisible &&
            galaxyMapManager._mountEl &&
            galaxyMapManager.isInputActive());
    },

    enterPlayMap() {
        if (typeof galaxyMapManager === 'undefined' || !galaxyMapManager.isVisible) return false;
        this._navLevel = 'content';
        galaxyMapManager.armInput();
        this.syncNavHint();
        return true;
    },

    exitPlayMap() {
        if (typeof galaxyMapManager === 'undefined') return false;
        if (!galaxyMapManager.isVisible || !galaxyMapManager._mountEl) return false;
        const wasActive = galaxyMapManager.isInputActive();
        galaxyMapManager.disarmInput();
        this._navLevel = 'tabs';
        this.focusActiveTab();
        this.syncNavHint();
        return wasActive || true;
    },

    isMenuChrome(el) {
        return !!(el && (el.id === 'hsMenu' ||
            (el.classList && (el.classList.contains('hs-menu-btn') ||
                el.classList.contains('hs-menu-tab-btn')))));
    },

    isTabChromeFocused() {
        const list = this.getFocusables();
        const el = list[this.focusIndex];
        if (!el) return false;
        if (this.isMainTabChrome(el)) return true;
        if (this.isMenuChrome(el)) return true;
        return false;
    },

    hasSubTabs() {
        return this.tab === 'shop' || this.tab === 'upgrade';
    },

    isSubTabEl(el) {
        if (!el || !el.hasAttribute) return false;
        return el.hasAttribute('data-shop-cat') || el.hasAttribute('data-upgrade-sub');
    },

    isContentFocusable(el) {
        if (!el) return false;
        if (this.isMainTabChrome(el) || this.isMenuChrome(el) || this.isSubTabEl(el)) return false;
        return true;
    },

    getNavLevel() {
        if (this.tab === 'play' && this.isPlayMapActive()) return 'content';
        return this._navLevel || 'tabs';
    },

    isContentNavActive() {
        return this.getNavLevel() !== 'tabs';
    },

    getZoneFocusables() {
        const all = this.getFocusables();
        const level = this.getNavLevel();
        if (level === 'tabs') {
            return all.filter((el) => this.isMainTabChrome(el) || this.isMenuChrome(el));
        }
        if (level === 'sub') {
            return all.filter((el) => this.isSubTabEl(el));
        }
        return all.filter((el) => this.isContentFocusable(el));
    },

    setFocusEl(el) {
        const list = this.getFocusables();
        const idx = el ? list.indexOf(el) : -1;
        if (idx < 0) return false;
        this.focusIndex = (typeof menuNavHelper !== 'undefined')
            ? menuNavHelper.applyFocus(list, idx)
            : idx;
        this.refreshFocus();
        this.scrollFocusedIntoView();
        return true;
    },

    focusActiveSubTab() {
        if (!this.overlay || !this.hasSubTabs()) return false;
        const active = this.overlay.querySelector('.hs-shop-cats .hs-shop-cat.active') ||
            this.overlay.querySelector('[data-shop-cat].active, [data-upgrade-sub].active');
        if (!this.setFocusEl(active)) {
            const first = this.overlay.querySelector('.hs-shop-cats [data-nav-item]');
            return this.setFocusEl(first);
        }
        return true;
    },

    findFirstContentFocusable(list) {
        if (!list || !list.length) return -1;
        for (let i = 0; i < list.length; i++) {
            if (this.isContentFocusable(list[i])) return i;
        }
        return -1;
    },

    restoreNavFocus() {
        const level = this._navLevel || 'tabs';
        if (level === 'sub' && this.hasSubTabs()) {
            this._navLevel = 'sub';
            this.focusActiveSubTab();
            return;
        }
        if (level === 'content' && this.tab !== 'menu') {
            this._navLevel = 'content';
            const list = this.getFocusables();
            const idx = this.findFirstContentFocusable(list);
            if (idx >= 0) {
                this.focusIndex = (typeof menuNavHelper !== 'undefined')
                    ? menuNavHelper.applyFocus(list, idx)
                    : idx;
                this.refreshFocus();
                return;
            }
        }
        this._navLevel = 'tabs';
        this.focusActiveTab();
    },

    enterSubTabs() {
        if (!this.hasSubTabs()) return false;
        this._navLevel = 'sub';
        this.focusActiveSubTab();
        this.syncNavHint();
        return true;
    },

    enterTabContent() {
        if (this.tab === 'play') return this.enterPlayMap();
        if (this.tab === 'menu') return false;
        if (this.getNavLevel() === 'tabs' && this.hasSubTabs()) {
            return this.enterSubTabs();
        }
        const list = this.getFocusables();
        const bodyIdx = this.findFirstContentFocusable(list);
        this._navLevel = 'content';
        if (bodyIdx >= 0) {
            this.focusIndex = (typeof menuNavHelper !== 'undefined')
                ? menuNavHelper.applyFocus(list, bodyIdx)
                : bodyIdx;
            this.refreshFocus();
            this.scrollFocusedIntoView();
        } else {
            this.refreshFocus();
        }
        this.syncNavHint();
        return true;
    },

    exitTabContent() {
        if (this.tab === 'play' && this.isPlayMapActive()) {
            return this.exitPlayMap();
        }
        const level = this.getNavLevel();
        if (level === 'content' && this.hasSubTabs()) {
            this._navLevel = 'sub';
            this.focusActiveSubTab();
            this.syncNavHint();
            return true;
        }
        if (level === 'content' || level === 'sub') {
            this._navLevel = 'tabs';
            this.focusActiveTab();
            this.syncNavHint();
            return true;
        }
        return false;
    },
});
