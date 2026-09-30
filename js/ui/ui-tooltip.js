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
        this._delayTimer = 0;
    }

    ensureEl() {
        if (this.el && this.el.isConnected) return this.el;
        const tip = document.createElement('div');
        tip.className = 'ui-tooltip';
        tip.setAttribute('role', 'tooltip');
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
        // No tooltips while a hangar part is being dragged.
        if (document.body.classList.contains('hs-part-grabbing')) return;
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
        const wasVisible = tip.classList.contains('visible');
        this._active = anchor;
        this.bindMoveWatch();
        if (this._delayTimer) clearTimeout(this._delayTimer);
        this._delayTimer = 0;
        // Moving between tips while one is shown swaps instantly; a fresh
        // hover waits a beat so passing the cursor over icons stays quiet.
        if (wasVisible) {
            this.reveal(anchor, text);
            return;
        }
        this._delayTimer = setTimeout(() => {
            this._delayTimer = 0;
            if (this._active !== anchor || !anchor.isConnected) return;
            this.reveal(anchor, text);
        }, UiTooltipManager.SHOW_DELAY_MS);
    }

    reveal(anchor, text) {
        const tip = this.ensureEl();
        // Optional heading (data-ui-tip-head) and "LABEL: value" rows laid out
        // as a small table; plain tips stay a single text block.
        const head = anchor && anchor.getAttribute && anchor.getAttribute('data-ui-tip-head');
        tip.classList.toggle('ui-tooltip-rich', !!head);
        if (head) {
            tip.textContent = '';
            const h = document.createElement('div');
            h.className = 'ui-tooltip-head';
            h.textContent = head;
            tip.appendChild(h);
            String(text).split('\n').forEach((line) => {
                const m = line.match(/^([^:]{1,24}):\s*(.+)$/);
                const row = document.createElement('div');
                row.className = m ? 'ui-tooltip-row' : 'ui-tooltip-note';
                if (m) {
                    const k = document.createElement('span');
                    k.className = 'ui-tooltip-key';
                    k.textContent = m[1];
                    const v = document.createElement('span');
                    v.className = 'ui-tooltip-val';
                    v.textContent = m[2];
                    row.append(k, v);
                } else {
                    row.textContent = line;
                }
                tip.appendChild(row);
            });
        } else {
            tip.textContent = text;
        }
        if (this._raf) cancelAnimationFrame(this._raf);
        this._raf = requestAnimationFrame(() => {
            this._raf = 0;
            if (this._active !== anchor || !anchor.isConnected) return;
            this.position(anchor, tip);
            tip.classList.add('visible');
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
        tip.classList.remove('below', 'side-left', 'side-right');
        // Sidebars: open beside the panel (right of the left one, left of the
        // right one) instead of covering the neighbouring rows.
        const leftBar = anchor.closest('.hs-hangar-list, [data-tip-side="right"]');
        const rightBar = !leftBar && anchor.closest('.hs-hangar-preview, [data-tip-side="left"]');
        if (leftBar || rightBar) {
            const b = (leftBar || rightBar).getBoundingClientRect();
            let sl = leftBar ? b.right + 10 : b.left - tw - 10;
            // No room on that side: fall back to the other.
            if (sl + tw > window.innerWidth - 8 || sl < 8) sl = leftBar ? r.left - tw - 10 : r.right + 10;
            let st = r.top + r.height / 2 - th / 2;
            st = Math.max(8, Math.min(st, window.innerHeight - th - 8));
            tip.classList.add(leftBar ? 'side-right' : 'side-left');
            tip.style.left = Math.round(Math.max(8, sl)) + 'px';
            tip.style.top = Math.round(st) + 'px';
            return;
        }
        let left = r.left + (r.width / 2) - (tw / 2);
        let top = r.top - th - 10;
        if (top < 8) {
            top = r.bottom + 10;
            tip.classList.add('below');
        }
        left = Math.max(8, Math.min(left, window.innerWidth - tw - 8));
        // Never past the bottom edge either (below-placement near the foot).
        top = Math.max(8, Math.min(top, window.innerHeight - th - 8));
        tip.style.left = Math.round(left) + 'px';
        tip.style.top = Math.round(top) + 'px';
    }

    hide() {
        this._active = null;
        this.unbindMoveWatch();
        if (this._delayTimer) {
            clearTimeout(this._delayTimer);
            this._delayTimer = 0;
        }
        if (this._raf) {
            cancelAnimationFrame(this._raf);
            this._raf = 0;
        }
        if (!this.el) return;
        // Keep text and position so the fade-out plays in place.
        this.el.classList.remove('visible');
    }
}

UiTooltipManager.SHOW_DELAY_MS = 450;

const uiTooltip = new UiTooltipManager();
window.uiTooltip = uiTooltip;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => uiTooltip.init());
} else {
    uiTooltip.init();
}
