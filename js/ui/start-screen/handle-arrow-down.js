"use strict";

// StartScreenManager methods, split from start-screen.js.
extendClass(StartScreenManager, {
    handleArrowDown() {
        if (this.showLevels) {
            this.levelIndex = Math.min(this.planets.length - 1, this.levelIndex + 1);
            this.updateMenuSelection();
            return true;
        } else if (this.showFontMenu) {
            this.fontMenuIndex = Math.min(this.fontMenuItems.length - 1, this.fontMenuIndex + 1);
            this.updateMenuSelection();
            return true;
        } else if (this.showSettings) {
            this.settingsIndex = Math.min(this.settingsItems.length - 1, this.settingsIndex + 1);
            this.updateMenuSelection();
            return true;
        } else if (this.showCredits) {
            return false;
        } else {
            if (this.navigateMainMenuSpatially('down')) return true;
            const cur = this.getSelectedClusterOffset();
            const map = this.getClusterNavMap();
            const ranges = this.getClusterIndexRanges();
            if (cur.clusterId && ranges[cur.clusterId] && this.selectedIndex < ranges[cur.clusterId].end) {
                this.selectedIndex += 1;
                this.updateMenuSelection();
                return true;
            }
            const down = cur.clusterId && map[cur.clusterId] ? map[cur.clusterId].down : null;
            if (down) return this.jumpToCluster(down, cur.offset);
            this.selectedIndex = Math.min(this.menuItems.length - 1, this.selectedIndex + 1);
            this.updateMenuSelection();
            return true;
        }
    },

    handleArrowLeft() {
        if (this.showFontMenu) {
            this.changeFontMenuValue(-1);
            return true;
        }
        if (this.showSettings) {
            this.changeSettingValue(-1);
            return true;
        }
        if (!this.showCredits && !this.showLevels) {
            if (this.navigateMainMenuSpatially('left')) return true;
            const cur = this.getSelectedClusterOffset();
            const map = this.getClusterNavMap();
            const left = cur.clusterId && map[cur.clusterId] ? map[cur.clusterId].left : null;
            if (left) return this.jumpToCluster(left, cur.offset);
        }
        return false;
    },

    handleArrowRight() {
        if (this.showFontMenu) {
            this.changeFontMenuValue(1);
            return true;
        }
        if (this.showSettings) {
            this.changeSettingValue(1);
            return true;
        }
        if (!this.showCredits && !this.showLevels) {
            if (this.navigateMainMenuSpatially('right')) return true;
            const cur = this.getSelectedClusterOffset();
            const map = this.getClusterNavMap();
            const right = cur.clusterId && map[cur.clusterId] ? map[cur.clusterId].right : null;
            if (right) return this.jumpToCluster(right, cur.offset);
        }
        return false;
    },

    handleEnter() {
        if (this.showLevels) {
            if (this.planets[this.levelIndex].unlocked) {
                this.startGame(this.planets[this.levelIndex]);
                return true;
            }
        } else if (this.showFontMenu) {
            this.changeFontMenuValue(1);
            return true;
        } else if (this.showSettings) {
            this.changeSettingValue(1);
            return true;
        } else if (this.embeddedMode) {
            if (this.embeddedMenuTab === 'assets') {
                this.openAssetGenerator({ returnToSettings: true });
                return true;
            }
            if (this.embeddedMenuTab === 'profiles' && typeof profileSelectionManager !== 'undefined') {
                this.hideEmbedded();
                profileSelectionManager.show({
                    onClose: () => {
                        if (this.hasActiveProfile()) this.returnToHub();
                        else this.show({ forceMenu: true });
                    }
                });
                return true;
            }
            return true;
        } else {
            this.selectMenuItem();
            return true;
        }
        return false;
    },

    changeSettingValue(direction) {
        const item = this.settingsItems[this.settingsIndex];
        if (!item) return;

        if (item.type === 'fontMenu') {
            this.openFontMenu();
            return;
        }

        if (item.type === 'action') {
            this.runSettingsAction(item);
            return;
        }

        if (item.type === 'assetStatus') {
            this.refreshAssetBridgeStatus();
            return;
        }

        if (item.type === 'volume') {
            return;
        }

        if (item.type === 'youtubeUrl') {
            return;
        }

        if (item.type === 'palette') {
            // App theme is faction-driven; nothing to cycle.
            return;
        }

        if (item.type === 'palette-legacy') {
            const palettes = (typeof themeContextManager !== 'undefined')
                ? themeContextManager.getPresetOptions(false)
                : (colorManager ? colorManager.getPalettes() : []);
            const currentIndex = palettes.findIndex(p => p.id === item.value);
            const newIndex = (currentIndex + direction + palettes.length) % palettes.length;
            item.value = palettes[newIndex].id;
            this.applyPaletteChange();
            this.refreshSettingsRow(this.settingsIndex);
            this.updateMenuSelection();
            return;
        }

        if (item.type === 'secondBase') {
            if (typeof colorPaletteSystem !== 'undefined' && colorPaletteSystem.cycleSecondBaseColor) {
                item.value = colorPaletteSystem.cycleSecondBaseColor(direction, { persist: true, apply: true });
            }
            this.applySecondBaseChange(item.value);
            this.refreshSettingsRow(this.settingsIndex);
            this.updateMenuSelection();
            return;
        }

        if (item.type === 'globalLook') {
            const min = item.min != null ? item.min : 0;
            const max = item.max != null ? item.max : 200;
            const step = item.step != null ? item.step : 5;
            const next = Math.max(min, Math.min(max, (Number(item.value) || 0) + direction * step));
            item.value = String(Math.round(next));
            if (item.lookKey === 'saturation') {
                const grayItem = this.settingsItems.find((i) => i.type === 'grayscale');
                if (grayItem) {
                    grayItem.value = item.value === '0' ? 'ON' : 'OFF';
                    this.refreshSettingsRow(this.settingsItems.indexOf(grayItem));
                }
            }
            this.applySettings();
            this.refreshSettingsRow(this.settingsIndex);
            this.updateMenuSelection();
            return;
        }

        if (!item.options || !item.options.length) return;

        const currentIndex = item.options.indexOf(item.value);
        const newIndex = (currentIndex + direction + item.options.length) % item.options.length;
        item.value = item.options[newIndex];

        if (item.type === 'grayscale') {
            const satItem = this.settingsItems.find((i) => i.lookKey === 'saturation');
            if (satItem) {
                if (item.value === 'ON') {
                    this._preGrayscaleSaturation = satItem.value;
                    satItem.value = '0';
                } else {
                    const restored = this._preGrayscaleSaturation || satItem.value || '100';
                    satItem.value = restored === '0' ? '100' : restored;
                    this._preGrayscaleSaturation = null;
                }
                this.refreshSettingsRow(this.settingsItems.indexOf(satItem));
            }
        }

        this.applySettings();
        this.refreshSettingsRow(this.settingsIndex);
        this.updateMenuSelection();
    },

    runSettingsAction(item) {
        if (!item || !item.action) return;
        if (item.action === 'assetGen') {
            this.openAssetGenerator(null);
            return;
        }
        if (item.action === 'assetGenFaction') {
            this.openAssetGenerator({ typeId: 'faction' });
            return;
        }
        if (item.action === 'assetGenFactionShips') {
            this.openAssetGenerator({ typeId: 'faction' });
            return;
        }
        if (item.action === 'difficultyEditor') {
            if (typeof difficultyEditorUI !== 'undefined' && difficultyEditorUI.show) {
                difficultyEditorUI.show();
            }
            return;
        }
        if (item.action === 'factionCommand') {
            if (typeof factionCommandUI !== 'undefined' && factionCommandUI.show) {
                factionCommandUI.show();
            }
            return;
        }
    },

    openAssetGenerator(opts) {
        if (typeof assetGenUI === 'undefined' || !assetGenUI) {
            console.warn('Asset Generator UI not loaded');
            return;
        }
        const fromStationMenu = this.overlayMode || this.embeddedMode;
        if (this.overlayMode) {
            this.hideOverlay();
        }
        if (this.embeddedMode) {
            this.hideEmbedded();
        }
        const o = opts || {};
        const returnToSettings = o.returnToSettings !== false;
        if (o.typeId) {
            assetGenUI.show({ typeId: o.typeId, returnToSettings: returnToSettings });
            if (assetGenUI.setStatus) {
                const label = (o.typeId === 'faction' || o.typeId === 'factionShip')
                    ? 'FACTIONS'
                    : String(o.typeId).toUpperCase();
                assetGenUI.setStatus(
                    ((returnToSettings || fromStationMenu) ? 'From Settings · ' : 'From Menu · ') +
                    label + ' · Generate → Accept'
                );
            }
            return;
        }
        const focus = o.focusEntry
            ? Object.assign({}, o.focusEntry, { returnToSettings: returnToSettings })
            : { returnToSettings: returnToSettings };
        assetGenUI.show(focus);
    },
});
