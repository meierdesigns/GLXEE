"use strict";

// StartScreenManager methods, split from start-screen.js.
extendClass(StartScreenManager, {
    async refreshAssetBridgeStatus() {
        const item = this.settingsItems.find((s) => s.type === 'assetStatus');
        const sw = this.settingsItems.find((s) => s.type === 'comfySwitch');
        if (!item && !sw) return;
        if (item) {
            item.value = '…';
            this.refreshSettingsRow(this.settingsItems.indexOf(item));
        }
        let text = 'OFFLINE';
        let ok = false;
        let comfy = false;
        try {
            if (typeof assetGenClient !== 'undefined' && assetGenClient.health) {
                const h = await assetGenClient.health(true);
                ok = !!(h && h.ok);
                comfy = !!(h && h.comfy);
                if (ok && comfy) text = 'READY';
                else if (ok) text = 'BRIDGE · NO COMFY';
                else text = 'OFFLINE';
            }
        } catch (e) {
            text = 'OFFLINE';
        }
        if (item) {
            item.value = text;
            const idx = this.settingsItems.indexOf(item);
            this.refreshSettingsRow(idx);
            const el = document.querySelector('[data-asset-status="1"]');
            if (el) {
                el.classList.toggle('settings-asset-ready', ok && comfy);
                el.classList.toggle('settings-asset-warn', ok && !comfy);
                el.classList.toggle('settings-asset-off', !ok);
            }
        }
        if (sw) {
            sw.value = (ok && comfy) ? 'ON' : 'OFF';
            this.refreshSettingsRow(this.settingsItems.indexOf(sw));
        }
    },

    async toggleComfySwitch(direction) {
        const item = this.settingsItems.find((s) => s.type === 'comfySwitch');
        if (!item || item._busy) return;
        const opts = item.options || ['ON', 'OFF'];
        let next = item.value;
        if (direction === 0) {
            next = item.value === 'ON' ? 'OFF' : 'ON';
        } else {
            const currentIndex = opts.indexOf(item.value);
            next = opts[(currentIndex + direction + opts.length) % opts.length];
        }
        if (next === item.value) return;
        item._busy = true;
        item.value = '…';
        this.refreshSettingsRow(this.settingsItems.indexOf(item));
        try {
            if (typeof assetGenClient === 'undefined' && typeof window.ensureVfEditors === 'function') {
                await new Promise((resolve) => window.ensureVfEditors(() => resolve()));
            }
            if (typeof assetGenClient === 'undefined' || !assetGenClient.setComfyStack) {
                throw new Error('Asset client missing');
            }
            await assetGenClient.setComfyStack(next === 'ON');
            item.value = next;
        } catch (e) {
            item.value = 'OFF';
            try {
                if (typeof console !== 'undefined') console.warn('[ComfyUI switch]', e && e.message || e);
            } catch (e2) { /* ignore */ }
        } finally {
            item._busy = false;
            this.refreshSettingsRow(this.settingsItems.indexOf(item));
            await this.refreshAssetBridgeStatus();
        }
    },

    createVolumeControlsUI() {
        const panel = document.createElement('div');
        panel.className = 'volume-controls';

        const levels = (typeof volumeControlsManager !== 'undefined')
            ? {
                master: Math.round(volumeControlsManager.getMasterVolume() * 100),
                sound: Math.round(volumeControlsManager.getSoundVolume() * 100),
                music: Math.round(volumeControlsManager.getMusicVolume() * 100)
            }
            : { master: 10, sound: 50, music: 65 };

        const rows = [
            { key: 'master', label: 'MASTER', setter: 'setMasterVolume' },
            { key: 'sound', label: 'SOUNDS', setter: 'setSoundVolume' },
            { key: 'music', label: 'MUSIC', setter: 'setMusicVolume' }
        ];

        rows.forEach((row) => {
            const control = document.createElement('div');
            control.className = 'volume-control';

            const label = document.createElement('label');
            label.textContent = `${row.label}:`;

            const slider = document.createElement('input');
            slider.type = 'range';
            slider.min = '0';
            slider.max = '100';
            slider.value = String(levels[row.key]);
            slider.className = 'volume-slider';
            slider.dataset.volume = row.key;
            slider.style.setProperty('--vol-fill', `${levels[row.key]}%`);

            const value = document.createElement('span');
            value.textContent = `${levels[row.key]}%`;
            value.dataset.volumeValue = row.key;

            slider.addEventListener('input', (e) => {
                e.stopPropagation();
                const pct = parseInt(e.target.value, 10);
                value.textContent = `${pct}%`;
                e.target.style.setProperty('--vol-fill', `${pct}%`);
                if (typeof volumeControlsManager !== 'undefined') {
                    volumeControlsManager[row.setter](pct / 100);
                }
            });
            slider.addEventListener('click', (e) => e.stopPropagation());
            slider.addEventListener('mousedown', (e) => e.stopPropagation());

            control.appendChild(label);
            control.appendChild(slider);
            control.appendChild(value);
            panel.appendChild(control);
        });

        return panel;
    },

    changeFontMenuValue(direction) {
        const item = this.fontMenuItems[this.fontMenuIndex];
        if (!item || !item.options) return;

        const currentIndex = item.options.indexOf(item.value);
        const newIndex = (currentIndex + direction + item.options.length) % item.options.length;
        item.value = item.options[newIndex];
        this.applyFontMenuSettings();
        this.refreshFontMenuRow(this.fontMenuIndex);
        this.updateMenuSelection();
    },

    refreshFontMenuRow(index) {
        const item = this.fontMenuItems[index];
        if (!item) return;
        const startScreen = this.getUIHost();
        if (!startScreen) return;
        const valueEl = startScreen.querySelector(`[data-font-value="${index}"]`);
        if (!valueEl) return;
        const suffix = item.type === 'fontSize' ? 'px' : '';
        valueEl.textContent = `${item.value}${suffix}`;
    },

    applyFontMenuSettings() {
        if (typeof uiAppearanceManager === 'undefined') return;

        const family = this.fontMenuItems.find(i => i.type === 'font');
        if (family) uiAppearanceManager.setFont(family.value);

        this.fontMenuItems.filter(i => i.type === 'fontSize').forEach((item) => {
            uiAppearanceManager.setFontSize(item.sizeKey, item.value);
        });
        this.fontMenuItems.filter(i => i.type === 'fontFamilyType').forEach((item) => {
            uiAppearanceManager.setFontFamily(item.sizeKey, item.value);
        });
    },

    selectMenuItem() {
        const selectedItem = this.menuItems[this.selectedIndex];
        if (this.isMenuItemLocked(selectedItem)) return;

        switch (selectedItem) {
            case 'PROFILES':
                // Start menu: the pilot list opens inside the terminal screen.
                if (!this.embeddedMode && !this.overlayMode) {
                    this._profilesCreate = false;
                    this._profilesThenStart = true;
                    this.showProfiles = true;
                    this.createStartScreenUI();
                    break;
                }
                {
                    const reopen = this.isStationMenuContext();
                    const openPs = () => {
                        if (typeof profileSelectionManager === 'undefined') return;
                        if (this.embeddedMode) this.hideEmbedded();
                        else if (this.overlayMode) this.hideOverlay();
                        else this.hide();
                        profileSelectionManager.show({
                            onClose: () => {
                                if (reopen || this.hasActiveProfile()) {
                                    this.returnToHub();
                                } else {
                                    this.show({ forceMenu: true });
                                }
                            }
                        });
                    };
                    if (typeof profileSelectionManager === 'undefined' && typeof window.ensureVfProfiles === 'function') {
                        const load = () => window.ensureVfProfiles(openPs);
                        if (typeof window.ensureVfStation === 'function') window.ensureVfStation(load);
                        else load();
                    } else if (typeof profileSelectionManager !== 'undefined') {
                        openPs();
                    }
                }
                break;
            case 'STATION':
                if (this.embeddedMode) {
                    if (typeof homeStationUI !== 'undefined') {
                        homeStationUI.closeMenuTab();
                    } else {
                        this.hideEmbedded();
                    }
                    break;
                }
                if (this.overlayMode) {
                    this.hideOverlay();
                    break;
                }
                if (typeof profileSelectionManager !== 'undefined'
                    && typeof profileManager !== 'undefined') {
                    // START = new game: create a fresh pilot inside the
                    // terminal, then launch. LOAD picks an existing one.
                    this._profilesThenStart = true;
                    this._profilesCreate = true;
                    this.showProfiles = true;
                    this.createStartScreenUI();
                    break;
                }
                if (false) {
                    profileSelectionManager.show({
                        onClose: () => this.returnToHub()
                    });
                    this.hide();
                    break;
                }
                if (typeof profileManager !== 'undefined' && !profileManager.hasActiveProfile()) {
                    this.openProfileCreate();
                    this.hide();
                    break;
                }
                {
                    const openHs = () => {
                        if (typeof homeStationUI === 'undefined') return;
                        homeStationUI.show({
                            onClose: () => this.returnToHub()
                        });
                        this.hide();
                    };
                    if (typeof homeStationUI === 'undefined' && typeof window.ensureVfStation === 'function') {
                        window.ensureVfStation(openHs);
                    } else {
                        openHs();
                    }
                }
                break;
            case 'SETTINGS':
                this.showSettings = true;
                this.createStartScreenUI(); // Recreate UI for settings
                if (typeof menuStateManager !== 'undefined') {
                    menuStateManager.setScreen('settings');
                }
                break;
            case 'ASSETS':
                this.openAssetGenerator({ returnToSettings: false });
                break;
            case 'GALAXIES':
                this.showGalaxies = true;
                this.createStartScreenUI();
                break;
            case 'CREDITS':
                this.showCredits = true;
                this.createStartScreenUI(); // Recreate UI for credits
                if (typeof menuStateManager !== 'undefined') {
                    menuStateManager.setScreen('credits');
                }
                break;
        }
    },

    startGame(selectedPlanet = null) {
        this.hide();
        if (typeof soundManager !== 'undefined' && soundManager.stopMenuMusic) {
            soundManager.stopMenuMusic();
        }

        if (!selectedPlanet && typeof planetSelectionManager !== 'undefined') {
            selectedPlanet = planetSelectionManager.planets[planetSelectionManager.selectedPlanet];
        }

        const levelId = selectedPlanet
            ? selectedPlanet.name.toLowerCase()
            : 'mars';

        if (typeof game !== 'undefined' && typeof game.startGame === 'function') {
            game.startGame(levelId);
        } else {
            console.error('GameCore system not available');
        }
    },

    // Unlock next level after winning
    unlockNextLevel(currentLevelId = 1) {
        if (typeof planetSelectionManager !== 'undefined') {
            planetSelectionManager.unlockNextLevel(currentLevelId);
        }
    },

    // Unlock specific level
    unlockLevel(levelId) {
        if (typeof planetSelectionManager !== 'undefined') {
            planetSelectionManager.unlockLevel(levelId);
        }
    },
});
