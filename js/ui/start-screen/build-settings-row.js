"use strict";

// StartScreenManager methods, split from start-screen.js.
extendClass(StartScreenManager, {
    buildSettingsRow(item, index) {
        const menuItem = document.createElement('div');
        menuItem.className = `menu-item settings-row ${index === this.settingsIndex ? 'selected' : ''}`;
        menuItem.dataset.settingsIndex = String(index);
        menuItem.style.textAlign = 'left';
        menuItem.addEventListener('mouseenter', () => {
            this.settingsIndex = index;
            this.updateMenuSelection();
        });

        if (item.type === 'palette') {
            menuItem.classList.add('settings-row-theme');
            this.buildThemeStrip(menuItem, item, index);
            return menuItem;
        }

        if (item.type === 'secondBase') {
            menuItem.classList.add('settings-row-second-base');
            this.buildSecondBaseRow(menuItem, item, index);
            return menuItem;
        }

        if (item.type === 'volume') {
            menuItem.classList.add('volume-settings-item', 'settings-row-volume');
            menuItem.appendChild(this.createVolumeControlsUI());
            return menuItem;
        }

        if (item.type === 'fontMenu') {
            const family = (typeof uiAppearanceManager !== 'undefined') ? uiAppearanceManager.font : 'COURIER';
            menuItem.innerHTML = '';
            const label = document.createElement('span');
            label.className = 'settings-row-label';
            label.textContent = item.name;
            const value = document.createElement('span');
            value.className = 'settings-row-value';
            value.dataset.settingsValue = String(index);
            value.textContent = `${family} ›`;
            menuItem.appendChild(label);
            menuItem.appendChild(value);
            menuItem.addEventListener('click', () => {
                this.settingsIndex = index;
                this.openFontMenu();
            });
            return menuItem;
        }

        if (item.type === 'action' || item.type === 'assetStatus') {
            menuItem.classList.add('settings-row-action');
            menuItem.innerHTML = '';
            const label = document.createElement('span');
            label.className = 'settings-row-label';
            label.textContent = item.name;
            const value = document.createElement('span');
            value.className = 'settings-row-value';
            value.dataset.settingsValue = String(index);
            value.textContent = item.value;
            if (item.type === 'assetStatus') {
                value.classList.add('settings-asset-status');
                value.dataset.assetStatus = '1';
            }
            menuItem.appendChild(label);
            menuItem.appendChild(value);
            menuItem.addEventListener('click', () => {
                this.settingsIndex = index;
                if (item.type === 'action') this.runSettingsAction(item);
                else this.refreshAssetBridgeStatus();
            });
            return menuItem;
        }

        if (item.type === 'youtubeUrl') {
            menuItem.classList.add('settings-row-youtube');
            menuItem.innerHTML = '';
            const label = document.createElement('span');
            label.className = 'settings-row-label';
            label.textContent = item.name;
            const input = document.createElement('input');
            input.type = 'url';
            input.className = 'settings-youtube-input';
            input.placeholder = 'YouTube URL / ID';
            input.spellcheck = false;
            input.autocomplete = 'off';
            input.value = item.value || '';
            input.dataset.settingsYoutube = String(index);
            const sync = () => {
                item.value = String(input.value || '').trim();
                if (typeof youtubeSoundtrackManager !== 'undefined') {
                    youtubeSoundtrackManager.setMenuUrl(item.value);
                }
                if (typeof soundManager !== 'undefined' && soundManager.startMenuMusic) {
                    soundManager.startMenuMusic();
                }
            };
            input.addEventListener('change', sync);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    sync();
                    input.blur();
                }
                e.stopPropagation();
            });
            input.addEventListener('click', (e) => e.stopPropagation());
            menuItem.appendChild(label);
            menuItem.appendChild(input);
            menuItem.addEventListener('click', () => {
                this.settingsIndex = index;
                input.focus();
            });
            return menuItem;
        }

        if (item.type === 'globalLook') {
            menuItem.classList.add('settings-row-look');
            this.buildLookSliderRow(menuItem, item, index);
            return menuItem;
        }

        const suffix = item.suffix || (item.type === 'indicatorWeight' ? 'px' : '');
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
            this.settingsIndex = index;
            this.changeSettingValue(-1);
        });

        const value = document.createElement('span');
        value.className = 'settings-row-value';
        value.dataset.settingsValue = String(index);
        value.textContent = `${item.value}${suffix}`;

        const nextBtn = document.createElement('button');
        nextBtn.type = 'button';
        nextBtn.className = 'settings-cycle-btn';
        nextBtn.textContent = '›';
        nextBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.settingsIndex = index;
            this.changeSettingValue(1);
        });

        controls.appendChild(prevBtn);
        controls.appendChild(value);
        controls.appendChild(nextBtn);
        menuItem.appendChild(label);
        menuItem.appendChild(controls);

        menuItem.addEventListener('click', (e) => {
            if (e.target.closest('.settings-cycle-btn')) return;
            this.settingsIndex = index;
            this.changeSettingValue(1);
        });

        return menuItem;
    },

    syncLookSliderFill(slider, value, min, max) {
        if (!slider) return;
        const lo = Number(min);
        const hi = Number(max);
        const v = Number(value);
        const span = Math.max(1, hi - lo);
        const pct = Math.max(0, Math.min(100, ((v - lo) / span) * 100));
        slider.style.setProperty('--look-fill', `${pct}%`);
        slider.value = String(v);
    },

    buildLookSliderRow(menuItem, item, index) {
        const min = item.min != null ? item.min : 0;
        const max = item.max != null ? item.max : 200;
        const step = item.step != null ? item.step : 5;
        const suffix = item.suffix || '%';
        const numeric = Math.max(min, Math.min(max, Number(item.value) || 0));
        item.value = String(Math.round(numeric));

        const label = document.createElement('span');
        label.className = 'settings-row-label';
        label.textContent = item.name;

        const controls = document.createElement('div');
        controls.className = 'settings-row-controls settings-look-controls';

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = String(min);
        slider.max = String(max);
        slider.step = String(step);
        slider.className = 'settings-look-slider';
        slider.dataset.settingsLook = String(index);
        slider.setAttribute('aria-label', item.name);

        const value = document.createElement('span');
        value.className = 'settings-row-value';
        value.dataset.settingsValue = String(index);
        value.textContent = `${item.value}${suffix}`;

        this.syncLookSliderFill(slider, item.value, min, max);

        const applyLookValue = (raw) => {
            const next = Math.max(min, Math.min(max, Math.round(Number(raw))));
            item.value = String(next);
            value.textContent = `${item.value}${suffix}`;
            this.syncLookSliderFill(slider, next, min, max);
            if (item.lookKey === 'saturation') {
                const grayItem = this.settingsItems.find((i) => i.type === 'grayscale');
                if (grayItem) {
                    grayItem.value = item.value === '0' ? 'ON' : 'OFF';
                    this.refreshSettingsRow(this.settingsItems.indexOf(grayItem));
                }
            }
            this.applySettings();
        };

        slider.addEventListener('input', (e) => {
            e.stopPropagation();
            this.settingsIndex = index;
            applyLookValue(e.target.value);
            this.updateMenuSelection();
        });
        slider.addEventListener('click', (e) => e.stopPropagation());
        slider.addEventListener('mousedown', (e) => e.stopPropagation());
        slider.addEventListener('pointerdown', (e) => e.stopPropagation());

        controls.appendChild(slider);
        controls.appendChild(value);
        menuItem.appendChild(label);
        menuItem.appendChild(controls);

        menuItem.addEventListener('click', (e) => {
            if (e.target.closest('.settings-look-slider')) return;
            this.settingsIndex = index;
            this.updateMenuSelection();
        });
    },

    buildThemeSwatchEl(palette) {
        const swatch = document.createElement('span');
        swatch.className = 'theme-list-swatch';
        const baseHex = (palette && (palette.baseColor || palette.primary)) || '#888888';
        const secondHex = (palette && palette.secondBaseColor)
            || (typeof colorPaletteSystem !== 'undefined' && colorPaletteSystem.defaultSecondBaseColor)
            || '#FFFFFF';
        swatch.style.background = `linear-gradient(135deg, ${baseHex} 50%, ${secondHex} 50%)`;
        swatch.title = `Base ${baseHex} · 2nd ${secondHex}`;
        return swatch;
    },

    bindThemeDropdownOutsideClick() {
        if (this._themeDropdownOutsideBound) return;
        this._themeDropdownOutsideBound = (e) => {
            if (!this.themeDropdownOpen) return;
            if (e.target && e.target.closest && e.target.closest('.settings-row-theme')) return;
            this.themeDropdownOpen = false;
            const host = this.getUIHost();
            const row = host && host.querySelector('.settings-row-theme');
            if (row) row.classList.remove('is-open');
        };
        document.addEventListener('click', this._themeDropdownOutsideBound);
    },
});
