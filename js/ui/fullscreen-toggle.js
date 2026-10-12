"use strict";

/**
 * Fullscreen on / off: a small corner button on every screen plus
 * vfFullscreen.buttonHtml() for in-menu buttons (station, next to logout).
 * Any [data-fullscreen-toggle] button toggles; icons follow the state.
 */
const vfFullscreen = {
    isOn() {
        return !!(document.fullscreenElement || document.webkitFullscreenElement);
    },

    toggle() {
        const doc = document;
        if (this.isOn()) {
            (doc.exitFullscreen || doc.webkitExitFullscreen || (() => {})).call(doc);
        } else {
            const el = doc.documentElement;
            const req = el.requestFullscreen || el.webkitRequestFullscreen;
            if (req) {
                const p = req.call(el);
                if (p && p.catch) p.catch(() => {});
            }
        }
    },

    /** Pixel icon: corners pointing out (enter) or in (exit). */
    iconSvg(on) {
        const d = on
            ? 'M3 0h1v4H0V3h3zM6 0h1v3h3v1H6zM0 6h4v4H3V7H0zM6 6h4v1H7v3H6z'
            : 'M0 0h4v1H1v3H0zM6 0h4v4H9V1H6zM0 6h1v3h3v1H0zM9 6h1v4H6V9h3z';
        return `<svg class="vf-fs-icon" viewBox="0 0 10 10" width="20" height="20" shape-rendering="crispEdges" aria-hidden="true"><path d="${d}"/></svg>`;
    },

    label(on) {
        return on ? 'Exit fullscreen' : 'Fullscreen';
    },

    buttonHtml(cls, id) {
        const on = this.isOn();
        return `<button type="button" class="${cls || ''}" ${id ? `id="${id}"` : ''} data-fullscreen-toggle data-nav-item` +
            ` title="${this.label(on)}" aria-label="${this.label(on)}">${this.iconSvg(on)}</button>`;
    },

    sync() {
        const on = this.isOn();
        document.documentElement.classList.toggle('is-fullscreen', on);
        document.querySelectorAll('[data-fullscreen-toggle]').forEach((btn) => {
            btn.innerHTML = this.iconSvg(on);
            btn.title = this.label(on);
            btn.setAttribute('aria-label', this.label(on));
        });
    },

    init() {
        if (!document.fullscreenEnabled && !document.webkitFullscreenEnabled) return;
        const corner = document.createElement('div');
        corner.innerHTML = this.buttonHtml('vf-fullscreen-btn', 'vfFullscreenBtn');
        document.body.appendChild(corner.firstChild);
        // One delegated handler: buttons in re-rendered menus work too.
        document.addEventListener('click', (e) => {
            const btn = e.target.closest && e.target.closest('[data-fullscreen-toggle]');
            if (!btn) return;
            e.preventDefault();
            e.stopPropagation();
            this.toggle();
        }, true);
        document.addEventListener('fullscreenchange', () => this.sync());
        document.addEventListener('webkitfullscreenchange', () => this.sync());
        this.sync();
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => vfFullscreen.init());
} else {
    vfFullscreen.init();
}
