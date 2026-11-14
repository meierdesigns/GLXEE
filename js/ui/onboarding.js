"use strict";

/**
 * First-run onboarding — consolidated into ProfileSelectionManager's create wizard
 * (homeworld faction stage + pilot / setup / galaxy / story).
 * Kept as a thin shim so menu-state restore and legacy callers still resolve.
 */
class OnboardingManager {
    constructor() {
        this.isVisible = false;
        this.overlay = null;
        this.onComplete = null;
    }

    show(options) {
        this.onComplete = options && options.onComplete || null;
        this.hide();
        const wrapClose = (prev) => () => {
            if (typeof prev === 'function') {
                try { prev(); } catch (e) { /* ignore */ }
            }
            const cb = this.onComplete;
            this.onComplete = null;
            if (typeof cb === 'function') cb();
        };

        if (typeof startScreenManager !== 'undefined' && startScreenManager.openProfileCreate) {
            startScreenManager.openProfileCreate();
            if (typeof profileSelectionManager !== 'undefined') {
                profileSelectionManager.onClose = wrapClose(profileSelectionManager.onClose);
            }
            return;
        }
        if (typeof profileSelectionManager !== 'undefined' && profileSelectionManager.show) {
            profileSelectionManager.show({
                create: true,
                onClose: wrapClose(null)
            });
            profileSelectionManager.mode = 'create';
            profileSelectionManager.createStep = 'faction';
            if (profileSelectionManager.createUI) profileSelectionManager.createUI();
            return;
        }
        wrapClose(null)();
    }

    hide() {
        this.isVisible = false;
        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
        }
    }

    /** DevMode remount hook — forward to the unified wizard if it is open. */
    createUI() {
        if (typeof profileSelectionManager !== 'undefined'
            && profileSelectionManager.isVisible
            && profileSelectionManager.mode === 'create'
            && profileSelectionManager.createUI) {
            profileSelectionManager.createUI();
        }
    }

    finish() {
        const cb = this.onComplete;
        this.onComplete = null;
        this.hide();
        if (typeof cb === 'function') cb();
    }
}

var onboardingManager = new OnboardingManager();
window.onboardingManager = onboardingManager;
