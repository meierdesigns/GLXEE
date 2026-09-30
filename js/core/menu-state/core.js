"use strict";

/**
 * Persist current menu across page refresh.
 * In-game refresh always returns to the start menu.
 */
class MenuStateManager {
    constructor() {
        this.storageKey = 'vf_menu_state_v1';
        this.state = { screen: 'start' };
        this.load();
    }

    load() {
        try {
            const raw = sessionStorage.getItem(this.storageKey);
            if (raw) this.state = Object.assign({ screen: 'start' }, JSON.parse(raw));
        } catch (e) {
            this.state = { screen: 'start' };
        }
    }

    save(partial) {
        this.state = Object.assign({}, this.state, partial || {});
        try {
            sessionStorage.setItem(this.storageKey, JSON.stringify(this.state));
        } catch (e) { /* ignore */ }
    }

    setScreen(screen, extra) {
        this.save(Object.assign({ screen: screen }, extra || {}));
    }

    get() {
        return this.state;
    }

    hideStartShell() {
        if (typeof startScreenManager !== 'undefined') {
            startScreenManager.hide();
        } else {
            const startScreen = document.getElementById('startScreen');
            if (startScreen) startScreen.classList.add('hidden');
        }
        const gameContainer = document.querySelector('.game-container');
        if (gameContainer) gameContainer.style.display = 'none';
    }

    returnToExplorations(focusExplore) {
        return () => {
            if (typeof homeStationUI !== 'undefined') {
                homeStationUI.show({
                    tab: 'explorations',
                    focusExplore: focusExplore || null,
                    onClose: () => {
                        if (typeof startScreenManager !== 'undefined') {
                            startScreenManager.returnToHub();
                        }
                    }
                });
            } else if (typeof startScreenManager !== 'undefined') {
                startScreenManager.returnToHub();
            }
        };
    }

    restoreViewer(ui, showOpts, focusExplore) {
        if (!ui || typeof ui.show !== 'function') return false;
        this.hideStartShell();
        // With a pilot, wiki entries live inside the station modal: reopen the
        // station on its WIKI tab and embed the viewer there, not standalone
        if (focusExplore && typeof homeStationUI !== 'undefined' && homeStationUI.openExplorationInline
            && typeof profileManager !== 'undefined' && profileManager.hasActiveProfile()) {
            homeStationUI.show({
                skipPersist: true,
                tab: 'explorations',
                focusExplore: focusExplore,
                onClose: () => {
                    if (typeof startScreenManager !== 'undefined') startScreenManager.returnToHub();
                }
            });
            if (homeStationUI.isVisible
                && homeStationUI.openExplorationInline(focusExplore, Object.assign({}, showOpts || {}, { skipPersist: true }))) {
                return true;
            }
        }
        const opts = Object.assign({}, showOpts || {}, {
            skipPersist: true,
            onClose: this.returnToExplorations(focusExplore)
        });
        ui.show(opts);
        if (ui.visible) {
            if (ui.overlay) ui.overlay.classList.add('vf-menu-enter');
            return true;
        }
        // Viewer list empty / failed — land on explorations instead of Start
        if (typeof homeStationUI !== 'undefined') {
            homeStationUI.show({
                tab: 'explorations',
                focusExplore: focusExplore || null,
                onClose: () => {
                    if (typeof startScreenManager !== 'undefined') {
                        startScreenManager.returnToHub();
                    }
                }
            });
            return true;
        }
        return false;
    }
}
