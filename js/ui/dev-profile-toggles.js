"use strict";

/**
 * Dev Mode helpers: show all content and toggle known / built / visited on the active profile.
 */
const devProfileToggles = {
    active() {
        return typeof startScreenManager !== 'undefined'
            && !!startScreenManager.devMode
            && typeof profileManager !== 'undefined'
            && profileManager.hasActiveProfile();
    },

    badge(label, on) {
        return `<span class="cv-dev-badge${on ? ' on' : ''}">${label}</span>`;
    },

    badgesHtml(flags) {
        if (!this.active() || !flags) return '';
        const parts = [];
        if (flags.known != null) parts.push(this.badge(flags.known ? 'KNOWN' : 'UNKNOWN', !!flags.known));
        if (flags.owned != null) parts.push(this.badge(flags.owned ? 'BUILT' : 'UNBUILT', !!flags.owned));
        if (flags.visited != null) parts.push(this.badge(flags.visited ? 'VISITED' : 'UNVISITED', !!flags.visited));
        if (flags.cleared != null) parts.push(this.badge(flags.cleared ? 'CLEARED' : 'OPEN', !!flags.cleared));
        if (!parts.length) return '';
        return `<span class="cv-dev-badges">${parts.join('')}</span>`;
    },

    notifyMenu() {
        if (typeof startScreenManager !== 'undefined' && startScreenManager.rebuildVisibleMenu) {
            startScreenManager.rebuildVisibleMenu();
        }
    },

    /**
     * @param {HTMLElement} footer
     * @param {HTMLElement} hint
     * @param {{
     *   known?: () => boolean,
     *   toggleKnown?: () => void,
     *   owned?: () => boolean,
     *   toggleOwned?: () => void,
     *   visited?: () => boolean,
     *   toggleVisited?: () => void,
     *   cleared?: () => boolean,
     *   toggleCleared?: () => void,
     *   onChange?: () => void
     * }} handlers
     */
    mount(footer, hint, handlers) {
        if (!footer || !handlers || !this.active()) return null;
        const wrap = document.createElement('div');
        wrap.className = 'cv-dev-actions';
        wrap.setAttribute('data-cv-dev', '1');

        const mkBtn = (id, getLabel) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'pe-btn cv-dev-btn';
            btn.id = id;
            btn.textContent = getLabel();
            wrap.appendChild(btn);
            return btn;
        };

        const buttons = {};
        if (handlers.toggleKnown) {
            buttons.known = mkBtn('cvDevKnown', () =>
                handlers.known && handlers.known() ? 'FORGET' : 'KNOW');
            buttons.known.addEventListener('click', () => {
                handlers.toggleKnown();
                this.notifyMenu();
                if (handlers.onChange) handlers.onChange();
            });
        }
        if (handlers.toggleOwned) {
            buttons.owned = mkBtn('cvDevOwned', () =>
                handlers.owned && handlers.owned() ? 'UNBUILD' : 'BUILD');
            buttons.owned.addEventListener('click', () => {
                handlers.toggleOwned();
                this.notifyMenu();
                if (handlers.onChange) handlers.onChange();
            });
        }
        if (handlers.toggleVisited) {
            buttons.visited = mkBtn('cvDevVisited', () =>
                handlers.visited && handlers.visited() ? 'UNVISIT' : 'VISIT');
            buttons.visited.addEventListener('click', () => {
                handlers.toggleVisited();
                this.notifyMenu();
                if (handlers.onChange) handlers.onChange();
            });
        }
        if (handlers.toggleCleared) {
            buttons.cleared = mkBtn('cvDevCleared', () =>
                handlers.cleared && handlers.cleared() ? 'UNCLEAR' : 'CLEAR');
            buttons.cleared.addEventListener('click', () => {
                handlers.toggleCleared();
                this.notifyMenu();
                if (handlers.onChange) handlers.onChange();
            });
        }

        footer.insertBefore(wrap, footer.firstChild);

        if (hint) {
            const lines = [];
            if (handlers.toggleKnown) {
                lines.push('<span><kbd>K</kbd> Know / Forget — mark as known in archive</span>');
            }
            if (handlers.toggleOwned) {
                lines.push('<span><kbd>B</kbd> Build / Unbuild — own ship or part in station</span>');
            }
            if (handlers.toggleVisited) {
                lines.push('<span><kbd>V</kbd> Visit / Unvisit — unlock planet on map</span>');
            }
            if (handlers.toggleCleared) {
                lines.push('<span><kbd>C</kbd> Clear / Unclear — mark planet cleared</span>');
            }
            if (lines.length) {
                if (!hint.dataset.devHintBase) {
                    hint.dataset.devHintBase = hint.textContent;
                }
                hint.innerHTML =
                    `<div class="cv-hint-row">${hint.dataset.devHintBase}</div>` +
                    `<div class="cv-hint-row cv-hint-dev"><span class="cv-hint-dev-label">DEV</span>${lines.join('')}</div>`;
            }
        }

        // Key labels on buttons
        if (buttons.known) {
            const syncKnown = buttons.known;
            const refreshKnownLabel = () => {
                syncKnown.innerHTML = `<kbd>K</kbd> ${handlers.known && handlers.known() ? 'FORGET' : 'KNOW'}`;
            };
            refreshKnownLabel();
            buttons.known._refreshLabel = refreshKnownLabel;
        }
        if (buttons.owned) {
            const syncOwned = buttons.owned;
            const refreshOwnedLabel = () => {
                syncOwned.innerHTML = `<kbd>B</kbd> ${handlers.owned && handlers.owned() ? 'UNBUILD' : 'BUILD'}`;
            };
            refreshOwnedLabel();
            buttons.owned._refreshLabel = refreshOwnedLabel;
        }
        if (buttons.visited) {
            const syncVisited = buttons.visited;
            const refreshVisitedLabel = () => {
                syncVisited.innerHTML = `<kbd>V</kbd> ${handlers.visited && handlers.visited() ? 'UNVISIT' : 'VISIT'}`;
            };
            refreshVisitedLabel();
            buttons.visited._refreshLabel = refreshVisitedLabel;
        }
        if (buttons.cleared) {
            const syncCleared = buttons.cleared;
            const refreshClearedLabel = () => {
                syncCleared.innerHTML = `<kbd>C</kbd> ${handlers.cleared && handlers.cleared() ? 'UNCLEAR' : 'CLEAR'}`;
            };
            refreshClearedLabel();
            buttons.cleared._refreshLabel = refreshClearedLabel;
        }

        return {
            refresh() {
                if (buttons.known && buttons.known._refreshLabel) buttons.known._refreshLabel();
                if (buttons.owned && buttons.owned._refreshLabel) buttons.owned._refreshLabel();
                if (buttons.visited && buttons.visited._refreshLabel) buttons.visited._refreshLabel();
                if (buttons.cleared && buttons.cleared._refreshLabel) buttons.cleared._refreshLabel();
            },
            handleKey(e) {
                if (!devProfileToggles.active()) return false;
                const key = e.key;
                if ((key === 'k' || key === 'K') && handlers.toggleKnown) {
                    e.preventDefault();
                    handlers.toggleKnown();
                    devProfileToggles.notifyMenu();
                    if (handlers.onChange) handlers.onChange();
                    return true;
                }
                if ((key === 'b' || key === 'B') && handlers.toggleOwned) {
                    e.preventDefault();
                    handlers.toggleOwned();
                    devProfileToggles.notifyMenu();
                    if (handlers.onChange) handlers.onChange();
                    return true;
                }
                if ((key === 'v' || key === 'V') && handlers.toggleVisited) {
                    e.preventDefault();
                    handlers.toggleVisited();
                    devProfileToggles.notifyMenu();
                    if (handlers.onChange) handlers.onChange();
                    return true;
                }
                if ((key === 'c' || key === 'C') && handlers.toggleCleared && !e.shiftKey) {
                    e.preventDefault();
                    handlers.toggleCleared();
                    devProfileToggles.notifyMenu();
                    if (handlers.onChange) handlers.onChange();
                    return true;
                }
                return false;
            }
        };
    }
};

window.devProfileToggles = devProfileToggles;
