"use strict";

// StartScreenManager methods, split from start-screen.js.
extendClass(StartScreenManager, {
    buildThemeStrip(menuItem, item, index) {
        const head = document.createElement('div');
        head.className = 'settings-theme-head';

        const paletteLabel = document.createElement('div');
        paletteLabel.className = 'settings-row-label';
        paletteLabel.textContent = item.name;
        head.appendChild(paletteLabel);

        const hint = document.createElement('div');
        hint.className = 'settings-hint type-text';
        hint.textContent = 'Set by your faction';
        head.appendChild(hint);
        menuItem.appendChild(head);

        // App theme follows the faction — show it, don't offer a picker.
        // The editor stays for planet / galaxy / stage themes.
        const colors = (typeof colorPaletteSystem !== 'undefined' && colorPaletteSystem.getCurrentColors)
            ? colorPaletteSystem.getCurrentColors() : null;
        const factionId = (typeof themeContextManager !== 'undefined' && themeContextManager.currentFactionId)
            ? themeContextManager.currentFactionId() : '';
        const current = {
            id: item.value,
            name: String(factionId || 'Faction').toUpperCase(),
            primary: colors && colors.primary,
            baseColor: colors && colors.baseColor,
            secondBaseColor: colors && colors.secondBaseColor
        };
        const badge = document.createElement('div');
        badge.className = 'theme-dropdown-toggle is-readonly';
        badge.appendChild(this.buildThemeSwatchEl(current));
        const badgeName = document.createElement('span');
        badgeName.className = 'theme-list-name';
        badgeName.textContent = current.name;
        badge.appendChild(badgeName);
        menuItem.appendChild(badge);

        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'theme-edit-btn';
        editBtn.textContent = 'PLANET THEMES';
        editBtn.title = 'Edit the environment themes used by planets';
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.openThemeEditor(null);
        });
        menuItem.appendChild(editBtn);
    },

    syncSecondBaseSettingValue() {
        const item = this.settingsItems && this.settingsItems.find((s) => s.type === 'secondBase');
        if (!item) return;
        if (typeof colorPaletteSystem !== 'undefined' && colorPaletteSystem.getSecondBaseColor) {
            item.value = colorPaletteSystem.getSecondBaseColor();
        }
    },

    buildSecondBaseRow(menuItem, item, index) {
        this.syncSecondBaseSettingValue();

        const label = document.createElement('span');
        label.className = 'settings-row-label';
        label.textContent = item.name;

        const controls = document.createElement('div');
        controls.className = 'settings-row-controls settings-second-base-controls';

        const prevBtn = document.createElement('button');
        prevBtn.type = 'button';
        prevBtn.className = 'settings-cycle-btn';
        prevBtn.textContent = '‹';
        prevBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.settingsIndex = index;
            this.changeSettingValue(-1);
        });

        const swatch = document.createElement('button');
        swatch.type = 'button';
        swatch.className = 'settings-second-base-swatch';
        swatch.dataset.color = this.toSettingsHex(item.value);
        swatch.style.backgroundColor = swatch.dataset.color;
        swatch.title = '2nd basecolor (text / icons)';
        swatch.setAttribute('aria-label', 'Pick 2nd basecolor');
        swatch.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.settingsIndex = index;
            if (typeof colorPickerOverlay === 'undefined' || !colorPickerOverlay.open) return;
            colorPickerOverlay.open(swatch.dataset.color || item.value, {
                anchor: swatch,
                onChange: (hex) => {
                    const next = this.toSettingsHex(hex);
                    item.value = next;
                    swatch.dataset.color = next;
                    swatch.style.backgroundColor = next;
                    this.applySecondBaseChange(next);
                    this.refreshSettingsRow(index);
                }
            });
        });

        const value = document.createElement('span');
        value.className = 'settings-row-value';
        value.dataset.settingsValue = String(index);
        value.textContent = this.toSettingsHex(item.value).toUpperCase();

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
        controls.appendChild(swatch);
        controls.appendChild(value);
        controls.appendChild(nextBtn);
        menuItem.appendChild(label);
        menuItem.appendChild(controls);

        menuItem.addEventListener('click', (e) => {
            if (e.target.closest('.settings-cycle-btn') || e.target.closest('.settings-second-base-swatch')) return;
            this.settingsIndex = index;
            this.changeSettingValue(1);
        });
    },

    toSettingsHex(color) {
        if (typeof colorPaletteSystem !== 'undefined' && colorPaletteSystem.normalizeHex) {
            return colorPaletteSystem.normalizeHex(color).toLowerCase();
        }
        if (!color || typeof color !== 'string') return '#ffffff';
        if (/^#[0-9a-fA-F]{6}$/.test(color)) return color.toLowerCase();
        return '#ffffff';
    },

    applySecondBaseChange(hex) {
        if (typeof colorPaletteSystem === 'undefined' || !colorPaletteSystem.setSecondBaseColor) return;
        colorPaletteSystem.setSecondBaseColor(hex, { persist: true, apply: true });
        if (typeof colorManager !== 'undefined') {
            colorManager.currentColors = colorPaletteSystem.getCurrentColors();
            if (colorManager._syncOverlay) colorManager._syncOverlay(colorPaletteSystem.currentPalette);
        }
        if (typeof iconRenderer !== 'undefined' && iconRenderer.clearCache) {
            iconRenderer.clearCache();
        }
        if (typeof homeStationUI !== 'undefined' && homeStationUI.isVisible && homeStationUI.createUI) {
            try { homeStationUI.createUI(); } catch (e) { /* ignore */ }
        }
    },

    syncThemeStripActive(list, paletteId, scrollIntoView) {
        if (!list) return;
        const scrollTop = list.scrollTop;
        let active = null;
        list.querySelectorAll('.theme-list-item, .theme-strip-item').forEach((btn) => {
            const isActive = btn.dataset.paletteId === paletteId;
            btn.classList.toggle('active', isActive);
            if (isActive) active = btn;
        });
        if (scrollIntoView && active) {
            const target = active.offsetTop - (list.clientHeight / 2) + (active.offsetHeight / 2);
            list.scrollTop = Math.max(0, target);
        } else {
            list.scrollTop = scrollTop;
        }
    },
});
