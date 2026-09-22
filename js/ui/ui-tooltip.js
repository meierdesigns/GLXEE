"use strict";

/**
 * App-styled floating tooltips for [data-ui-tip] (icons and labeled controls).
 */
class UiTooltipManager {
    constructor() {
        this.el = null;
        this._active = null;
        this._bound = false;
        this._raf = 0;
        this._moveBound = false;
    }

    ensureEl() {
        if (this.el && this.el.isConnected) return this.el;
        const tip = document.createElement('div');
        tip.className = 'ui-tooltip';
        tip.setAttribute('role', 'tooltip');
        tip.hidden = true;
        document.body.appendChild(tip);
        this.el = tip;
        return tip;
    }

    init() {
        if (this._bound) return;
        this._bound = true;
        document.addEventListener('pointerover', (e) => this.onOver(e), true);
        document.addEventListener('pointerout', (e) => this.onOut(e), true);
        document.addEventListener('focusin', (e) => this.onOver(e), true);
        document.addEventListener('focusout', (e) => this.onFocusOut(e), true);
        document.addEventListener('pointerdown', () => this.hide(), true);
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.hide();
        }, true);
        window.addEventListener('blur', () => this.hide());
        window.addEventListener('scroll', () => this.hide(), true);
        window.addEventListener('resize', () => this.hide());
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) this.hide();
        });
    }

    bindMoveWatch() {
        if (this._moveBound) return;
        this._moveBound = true;
        document.addEventListener('pointermove', this._onMove, true);
    }

    unbindMoveWatch() {
        if (!this._moveBound) return;
        this._moveBound = false;
        document.removeEventListener('pointermove', this._onMove, true);
    }

    resolveTip(target) {
        if (!target || !target.closest) return null;
        const el = target.closest('[data-ui-tip]');
        if (!el || !el.isConnected) return null;
        // Rich host tooltips (upgrade tree) own their hover chrome.
        if (el.closest('.hs-upg-node')) return null;
        const tip = el.getAttribute('data-ui-tip');
        if (!tip || !String(tip).trim()) return null;
        return { el: el, tip: String(tip).trim() };
    }

    onOver(e) {
        const hit = this.resolveTip(e.target);
        if (!hit) return;
        this.show(hit.el, hit.tip);
    }

    onOut(e) {
        if (!this._active) return;
        const related = e.relatedTarget;
        if (related && this._active.contains(related)) return;
        const next = this.resolveTip(related);
        if (next) {
            if (next.el !== this._active) this.show(next.el, next.tip);
            return;
        }
        // Leaving into null / non-tip / detached DOM — always clear.
        this.hide();
    }

    onFocusOut(e) {
        if (!this._active) return;
        const related = e.relatedTarget;
        if (related && this._active.contains(related)) return;
        const next = this.resolveTip(related);
        if (next) {
            if (next.el !== this._active) this.show(next.el, next.tip);
            return;
        }
        this.hide();
    }

    _onMove = (e) => {
        if (!this._active) {
            this.unbindMoveWatch();
            return;
        }
        if (!this._active.isConnected) {
            this.hide();
            return;
        }
        const under = document.elementFromPoint(e.clientX, e.clientY);
        const hit = this.resolveTip(under);
        if (!hit) {
            this.hide();
            return;
        }
        if (hit.el !== this._active) this.show(hit.el, hit.tip);
    };

    show(anchor, text) {
        if (!anchor || !anchor.isConnected) {
            this.hide();
            return;
        }
        const tip = this.ensureEl();
        this._active = anchor;
        tip.textContent = text;
        tip.hidden = false;
        tip.classList.add('visible');
        this.bindMoveWatch();
        if (this._raf) cancelAnimationFrame(this._raf);
        this._raf = requestAnimationFrame(() => {
            this._raf = 0;
            if (this._active !== anchor || !anchor.isConnected) return;
            this.position(anchor, tip);
        });
    }

    position(anchor, tip) {
        if (!anchor || !tip || !anchor.isConnected) {
            this.hide();
            return;
        }
        const r = anchor.getBoundingClientRect();
        if (r.width <= 0 && r.height <= 0) {
            this.hide();
            return;
        }
        const tw = tip.offsetWidth;
        const th = tip.offsetHeight;
        let left = r.left + (r.width / 2) - (tw / 2);
        let top = r.top - th - 10;
        tip.classList.remove('below');
        if (top < 8) {
            top = r.bottom + 10;
            tip.classList.add('below');
        }
        left = Math.max(8, Math.min(left, window.innerWidth - tw - 8));
        tip.style.left = Math.round(left) + 'px';
        tip.style.top = Math.round(top) + 'px';
    }

    hide() {
        this._active = null;
        this.unbindMoveWatch();
        if (this._raf) {
            cancelAnimationFrame(this._raf);
            this._raf = 0;
        }
        if (!this.el) return;
        this.el.classList.remove('visible', 'below');
        this.el.hidden = true;
        this.el.textContent = '';
    }
}

const uiTooltip = new UiTooltipManager();
window.uiTooltip = uiTooltip;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => uiTooltip.init());
} else {
    uiTooltip.init();
}
