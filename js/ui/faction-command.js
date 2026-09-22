"use strict";

class FactionCommandUI {
    constructor() {
        this.visible = false;
        this.selected = (typeof factionManager !== 'undefined' && factionManager.getAllegiance())
            || 'terran';
    }

    show() {
        if (this.visible) return;
        this.visible = true;
        this._returnToSettings = !!(typeof startScreenManager !== 'undefined'
            && startScreenManager
            && (startScreenManager.showSettings
                || startScreenManager.overlayMode
                || startScreenManager.embeddedMode));
        if (typeof startScreenManager !== 'undefined' && startScreenManager) {
            if (startScreenManager.overlayMode) startScreenManager.hideOverlay();
            if (startScreenManager.embeddedMode) startScreenManager.hideEmbedded();
        }
        if (typeof settingsManager !== 'undefined' && settingsManager.hideSettings) {
            settingsManager.hideSettings();
        }
        this.render();
    }

    hide() {
        this.visible = false;
        const el = document.getElementById('factionCommandOverlay');
        if (el) el.remove();
        if (this._returnToSettings && typeof startScreenManager !== 'undefined' && startScreenManager) {
            this._returnToSettings = false;
            startScreenManager.showSettings = true;
            startScreenManager.showCredits = false;
            if (startScreenManager.hasActiveProfile && startScreenManager.hasActiveProfile()
                && typeof homeStationUI !== 'undefined') {
                if (!homeStationUI.isVisible) {
                    homeStationUI.show({ skipPersist: true });
                }
                startScreenManager.show({ asOverlay: true, showSettings: true });
            } else {
                startScreenManager.show({ forceMenu: true });
            }
        }
    }

    render() {
        const fm = window.factionManager;
        if (!fm) return;
        const existing = document.getElementById('factionCommandOverlay');
        if (existing) existing.remove();
        const faction = fm.getFaction(this.selected);
        const factionColor = (typeof factionShipStyles !== 'undefined' && factionShipStyles.getFactionColor)
            ? factionShipStyles.getFactionColor(this.selected)
            : ((typeof planetConfigManager !== 'undefined' && planetConfigManager.getFactionPlanetTheme)
                ? (planetConfigManager.getFactionPlanetTheme(this.selected) || {}).baseColor
                : null);
        const overlay = document.createElement('div');
        overlay.id = 'factionCommandOverlay';
        overlay.className = 'faction-command-overlay';
        if (factionColor) overlay.style.setProperty('--fc-selected-color', factionColor);
        overlay.innerHTML = `
            <div class="faction-command-panel">
                <header class="faction-command-header">
                    <h2>FACTION COMMAND</h2>
                    <button type="button" class="de-close" id="fcClose">×</button>
                </header>
                <div class="faction-command-grid">
                    <aside class="faction-command-list">
                        <h3>ALLEGIANCE</h3>
                        ${fm.getFactionIds().map((id) => {
                            const color = (typeof factionShipStyles !== 'undefined' && factionShipStyles.getFactionColor)
                                ? factionShipStyles.getFactionColor(id)
                                : ((typeof planetConfigManager !== 'undefined' && planetConfigManager.getFactionPlanetTheme)
                                    ? (planetConfigManager.getFactionPlanetTheme(id) || {}).baseColor
                                    : null);
                            const style = color
                                ? `style="--fc-faction-color:${color};border-color:${color};color:${color}"`
                                : '';
                            return `
                            <button type="button" class="fc-faction ${id === this.selected ? 'active' : ''}" data-faction="${id}" ${style}>
                                ${fm.getFaction(id).label}
                            </button>`;
                        }).join('')}
                    </aside>
                    <main class="faction-command-detail">
                        <h1>${faction.label || this.selected.toUpperCase()}</h1>
                        <p class="fc-lore">${faction.loreLong || faction.lore || ''}</p>
                        <h3>FACTION GOAL</h3>
                        <p>${faction.goal || ''}</p>
                        <h3>OBJECTIVES</h3>
                        <ul>${(faction.objectives || []).map((x) => `<li>${x}</li>`).join('')}</ul>
                        <h3>TERRITORY</h3>
                        <p>${fm.getControlledPlanets().length} planets controlled</p>
                        <div class="fc-actions">
                            <button type="button" class="pe-btn pe-primary" id="fcJoin">
                                ${fm.getAllegiance() === this.selected ? 'ALIGNED' : 'JOIN FACTION'}
                            </button>
                        </div>
                        <h3>PACT NETWORK</h3>
                        <div class="fc-pacts">
                            ${fm.getFactionIds().filter((id) => id !== this.selected).map((id) => `
                                <button type="button" class="pe-btn fc-pact ${fm.hasPact(id) ? 'active' : ''}" data-pact="${id}">
                                    ${fm.getFaction(id).label}: ${fm.hasPact(id) ? 'PACT ACTIVE' : 'PROPOSE PACT'}
                                </button>`).join('')}
                        </div>
                    </main>
                </div>
                <footer class="difficulty-editor-footer">
                    <button type="button" class="pe-btn" id="fcBack">BACK</button>
                </footer>
            </div>`;
        document.body.appendChild(overlay);
        overlay.querySelector('#fcClose').addEventListener('click', () => this.hide());
        overlay.querySelector('#fcBack').addEventListener('click', () => this.hide());
        overlay.querySelector('#fcJoin').addEventListener('click', () => {
            fm.join(this.selected);
            this.render();
        });
        overlay.querySelectorAll('[data-faction]').forEach((button) => {
            button.addEventListener('click', () => {
                this.selected = button.dataset.faction;
                this.render();
            });
        });
        overlay.querySelectorAll('[data-pact]').forEach((button) => {
            button.addEventListener('click', () => {
                if (fm.getAllegiance() === this.selected) fm.togglePact(button.dataset.pact);
                this.render();
            });
        });
    }
}

const factionCommandUI = new FactionCommandUI();
window.factionCommandUI = factionCommandUI;
