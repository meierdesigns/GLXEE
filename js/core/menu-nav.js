"use strict";

/**
 * Shared menu / overlay keyboard helpers.
 * Arrow keys navigate UI when not actively flying the ship.
 */
class MenuNavHelper {
    isPlayingShip() {
        if (typeof gameStateManager === 'undefined' && typeof game === 'undefined') {
            return false;
        }
        const gs = (typeof game !== 'undefined' && game.gameState)
            ? game.gameState
            : (typeof gameStateManager !== 'undefined' ? gameStateManager : null);
        if (!gs) return false;
        if (typeof missionStartManager !== 'undefined' && missionStartManager.isActive()) {
            return false;
        }
        return !!(gs.gameRunning && !gs.isPaused);
    }

    isAnyOverlayOpen() {
        const checks = [
            () => typeof startScreenManager !== 'undefined' && startScreenManager.isVisible && startScreenManager.isVisible(),
            () => typeof homeStationUI !== 'undefined' && homeStationUI.isVisible,
            () => typeof profileSelectionManager !== 'undefined' && profileSelectionManager.isVisible,
            () => typeof combinedSelectionManager !== 'undefined' && combinedSelectionManager.isVisible,
            () => typeof playerSelectionManager !== 'undefined' && playerSelectionManager.isVisible,
            () => typeof planetSelectionManager !== 'undefined' && planetSelectionManager.isVisible,
            () => typeof galaxySelectionManager !== 'undefined' && galaxySelectionManager.isVisible,
            () => typeof galaxyMapManager !== 'undefined' && galaxyMapManager.isVisible,
            () => typeof shipViewerUI !== 'undefined' && shipViewerUI.visible,
            () => typeof planetViewerUI !== 'undefined' && planetViewerUI.visible,
            () => typeof enemyViewerUI !== 'undefined' && enemyViewerUI.visible,
            () => typeof abilityViewerUI !== 'undefined' && abilityViewerUI.visible,
            () => typeof weaponViewerUI !== 'undefined' && weaponViewerUI.visible,
            () => typeof defenseViewerUI !== 'undefined' && defenseViewerUI.visible,
            () => typeof factionViewerUI !== 'undefined' && factionViewerUI.visible,
            () => typeof themeEditorUI !== 'undefined' && themeEditorUI.visible,
            () => typeof shipEditorUI !== 'undefined' && shipEditorUI.visible,
            () => typeof planetEditorUI !== 'undefined' && planetEditorUI.visible,
            () => typeof enemyEditorUI !== 'undefined' && enemyEditorUI.visible,
            () => typeof abilityEditorUI !== 'undefined' && abilityEditorUI.visible,
            () => typeof uiDialog !== 'undefined' && uiDialog.isOpen,
            () => typeof onboardingManager !== 'undefined' && onboardingManager.isVisible
        ];
        return checks.some((fn) => {
            try { return !!fn(); } catch (e) { return false; }
        });
    }

    /** True when arrow keys must not steer the ship. */
    shouldBlockShipControls() {
        return !this.isPlayingShip() || this.isAnyOverlayOpen();
    }

    isArrowKey(key) {
        return key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight';
    }

    isMoveKey(key) {
        return this.isArrowKey(key) ||
            key === 'w' || key === 'a' || key === 's' || key === 'd' ||
            key === 'W' || key === 'A' || key === 'S' || key === 'D';
    }

    /**
     * Collect enabled buttons / focusables inside a root.
     */
    collectFocusables(root) {
        if (!root) return [];
        const nodes = root.querySelectorAll(
            'button:not([disabled]), [data-nav-item], a[href], select:not([disabled]), ' +
            'textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), [tabindex]:not([tabindex="-1"])'
        );
        return Array.prototype.slice.call(nodes).filter((el) => {
            if (el.disabled) return false;
            if (el.getAttribute('aria-disabled') === 'true') return false;
            if (el.closest && el.closest('[data-nav-skip], [inert], [aria-hidden="true"]')) return false;
            // Hidden via display:none on any ancestor → no layout box.
            if (typeof el.getClientRects === 'function' && el.getClientRects().length === 0) return false;
            const style = window.getComputedStyle ? window.getComputedStyle(el) : null;
            if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;
            return true;
        });
    }

    /** Text-entry fields keep arrow keys for caret movement. */
    isTextEntry(el) {
        if (!el || !el.tagName) return false;
        if (el.tagName === 'TEXTAREA' || el.isContentEditable) return true;
        if (el.tagName !== 'INPUT') return false;
        const type = (el.getAttribute('type') || 'text').toLowerCase();
        return !['range', 'checkbox', 'radio', 'button', 'submit', 'color'].includes(type);
    }

    applyFocus(list, index) {
        if (!list.length) return 0;
        const i = Math.max(0, Math.min(list.length - 1, index));
        list.forEach((el, idx) => {
            el.classList.toggle('nav-focused', idx === i);
            if (idx === i && typeof el.focus === 'function') {
                try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
                if (typeof el.scrollIntoView === 'function') {
                    try { el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) { /* ignore */ }
                }
            }
        });
        return i;
    }

    moveFocus(list, index, delta) {
        if (!list.length) return 0;
        let next = index + delta;
        if (next < 0) next = list.length - 1;
        if (next >= list.length) next = 0;
        return this.applyFocus(list, next);
    }

    /**
     * 2D arrow nav: pick nearest focusable in direction (prefer same row/column).
     * Returns the new index (unchanged if no candidate).
     */
    moveFocusSpatial(list, index, direction) {
        if (!list.length) return 0;
        const i = Math.max(0, Math.min(list.length - 1, index | 0));
        const current = list[i];
        if (!current || typeof current.getBoundingClientRect !== 'function') {
            return this.applyFocus(list, i);
        }
        const curRect = current.getBoundingClientRect();
        const cx = curRect.left + curRect.width / 2;
        const cy = curRect.top + curRect.height / 2;
        const rowSlop = Math.max(18, curRect.height * 0.75);
        const colSlop = Math.max(24, curRect.width * 0.6);

        let best = -1;
        let bestScore = Infinity;
        for (let n = 0; n < list.length; n++) {
            if (n === i) continue;
            const el = list[n];
            if (!el || typeof el.getBoundingClientRect !== 'function') continue;
            const r = el.getBoundingClientRect();
            if (r.width <= 0 && r.height <= 0) continue;
            const x = r.left + r.width / 2;
            const y = r.top + r.height / 2;
            const dx = x - cx;
            const dy = y - cy;
            const absDx = Math.abs(dx);
            const absDy = Math.abs(dy);

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
            if (!ok) continue;
            const score = primary + secondary * 2.5;
            if (score < bestScore) {
                bestScore = score;
                best = n;
            }
        }
        if (best < 0) return i;
        return this.applyFocus(list, best);
    }
}

const menuNavHelper = new MenuNavHelper();
window.menuNavHelper = menuNavHelper;
