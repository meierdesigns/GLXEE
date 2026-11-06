"use strict";

/**
 * Animated gamepad menu cursor: a HUD frame that jumps between focused buttons
 * when the controller drives navigation. Mouse/pen input hides it again.
 */
(function () {
    const PAD = 6;
    /** Class cleanup only — visual hide is instant via removing is-on. */
    const HIDE_MS = 0;
    const LERP = 0.28;
    const SNAP = 0.6;

    function GamepadCursor() {
        this.el = null;
        this.active = false;
        this.target = null;
        this.raf = 0;
        this.hideTimer = 0;
        this.x = 0;
        this.y = 0;
        this.w = 0;
        this.h = 0;
        this.hasPos = false;
        this.reduceMotion = false;
        try {
            this.reduceMotion = !!(window.matchMedia
                && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
        } catch (e) { /* ignore */ }
        this._bindInput();
    }

    GamepadCursor.prototype._bindInput = function () {
        const self = this;
        document.addEventListener('pointerdown', function (e) {
            if (e.pointerType === 'mouse' || e.pointerType === 'pen') self.markPointer();
        }, true);
        document.addEventListener('mousemove', function (e) {
            // Only real mouse deltas dismiss the cursor (ignore synthetic 0,0).
            if (e.movementX || e.movementY) self.markPointer();
        }, { passive: true, capture: true });
    };

    GamepadCursor.prototype.ensure = function () {
        // Mount on <html>, not <body>: body carries transform: scale(--stage-scale),
        // so position:fixed resolves in stage space while getBoundingClientRect is
        // viewport px (same trap as js/ui/dev-hover-screen.js).
        const root = document.documentElement;
        if (this.el && root.contains(this.el) && this.el.parentElement === root) return this.el;
        const el = this.el || document.createElement('div');
        el.className = 'vf-gp-cursor';
        el.setAttribute('aria-hidden', 'true');
        if (!el.childElementCount) el.innerHTML = '<i></i><i></i><i></i><i></i>';
        if (el.parentElement !== root) root.appendChild(el);
        this.el = el;
        return el;
    };

    GamepadCursor.prototype.markGamepad = function () {
        this.active = true;
        if (this.hideTimer) { clearTimeout(this.hideTimer); this.hideTimer = 0; }
        const el = this.ensure();
        el.classList.remove('is-out');
        const focused = this._resolveTarget();
        if (focused) this.follow(focused);
        // No target yet: stay armed, but do not paint a floating ghost frame.
        this._kick();
    };

    GamepadCursor.prototype.markPointer = function () {
        if (!this.active && !(this.el && this.el.classList.contains('is-on'))) return;
        this.active = false;
        this.target = null;
        this._fadeOut();
    };

    GamepadCursor.prototype.follow = function (el) {
        if (!el || !el.getBoundingClientRect) return;
        if (!this.active) return;
        this.target = el;
        if (this.hideTimer) { clearTimeout(this.hideTimer); this.hideTimer = 0; }
        const node = this.ensure();
        node.classList.remove('is-out');
        node.classList.add('is-on', 'is-jump');
        this._kick();
    };

    GamepadCursor.prototype._fadeOut = function () {
        const el = this.el;
        if (!el) return;
        // Drop is-on immediately so :not(.is-on) rules kill the frame this frame
        // (no opacity linger — previous HIDE_MS/CSS fade felt a beat too late).
        el.classList.remove('is-jump', 'is-on');
        el.classList.add('is-out');
        el.style.width = '0px';
        el.style.height = '0px';
        this.hasPos = false;
        this.target = null;
        const self = this;
        if (this.hideTimer) clearTimeout(this.hideTimer);
        this.hideTimer = setTimeout(function () {
            self.hideTimer = 0;
            if (self.active) return;
            el.classList.remove('is-on', 'is-out');
        }, HIDE_MS);
    };

    GamepadCursor.prototype._kick = function () {
        if (this.raf) return;
        const self = this;
        this.raf = requestAnimationFrame(function tick() {
            self.raf = 0;
            if (!self.active) return;
            self._paint();
            self.raf = requestAnimationFrame(tick);
        });
    };

    /** Menu screens that use .selected instead of (or as well as) .nav-focused. */
    GamepadCursor.prototype._selectedFallback = function () {
        return document.querySelector(
            '#victoryOverlay .victory-button.selected, ' +
            '#gameOver .victory-button.selected, ' +
            '#gameOver .game-over-button.selected, ' +
            '#pauseOverlay .pause-button.selected'
        );
    };

    GamepadCursor.prototype._resolveTarget = function () {
        // Galaxy map stick focus uses SVG selection frames, not this HUD frame.
        try {
            if (typeof galaxyMapManager !== 'undefined'
                && galaxyMapManager.isInputActive
                && galaxyMapManager.isInputActive()
                && (!galaxyMapManager.hasCardFocus || !galaxyMapManager.hasCardFocus())) {
                this.target = null;
                return null;
            }
        } catch (e) { /* ignore */ }
        if (this.target && document.body.contains(this.target)
            && (this.target.classList.contains('nav-focused')
                || this.target.classList.contains('selected'))) {
            return this.target;
        }
        const focused = document.querySelector('.nav-focused') || this._selectedFallback();
        if (focused) {
            this.target = focused;
            return focused;
        }
        const ae = document.activeElement;
        if (ae && ae !== document.body && ae.getBoundingClientRect
            && typeof ae.matches === 'function'
            && ae.matches('button, [data-nav-item], [role="button"], a[href], input, select, textarea')) {
            this.target = ae;
            return ae;
        }
        return null;
    };

    GamepadCursor.prototype._paint = function () {
        const el = this.ensure();
        if (el.classList.contains('is-out') && !this.active) return;
        const target = this._resolveTarget();
        if (!target) {
            // Target gone (screen swap / rebuild): clear the frame now, but stay
            // armed — markGamepad may run before the key handler sets nav-focused.
            if (this.hasPos || el.classList.contains('is-on')) {
                el.classList.remove('is-jump', 'is-on');
                el.classList.add('is-out');
                el.style.width = '0px';
                el.style.height = '0px';
                this.hasPos = false;
                this.target = null;
            }
            return;
        }
        const r = target.getBoundingClientRect();
        if (r.width <= 0 && r.height <= 0) {
            if (this.hasPos || el.classList.contains('is-on')) {
                el.classList.remove('is-jump', 'is-on');
                el.classList.add('is-out');
                el.style.width = '0px';
                el.style.height = '0px';
                this.hasPos = false;
                this.target = null;
            }
            return;
        }
        el.classList.remove('is-out');
        el.classList.add('is-on');
        const tx = r.left - PAD;
        const ty = r.top - PAD;
        const tw = r.width + PAD * 2;
        const th = r.height + PAD * 2;
        if (!this.hasPos || this.reduceMotion) {
            this.x = tx; this.y = ty; this.w = tw; this.h = th;
            this.hasPos = true;
        } else {
            const dx = tx - this.x;
            const dy = ty - this.y;
            const dw = tw - this.w;
            const dh = th - this.h;
            const dist = Math.abs(dx) + Math.abs(dy) + Math.abs(dw) + Math.abs(dh);
            const k = dist > 180 ? Math.min(1, LERP * 1.8) : LERP;
            this.x += dx * k;
            this.y += dy * k;
            this.w += dw * k;
            this.h += dh * k;
            if (dist < SNAP) {
                this.x = tx; this.y = ty; this.w = tw; this.h = th;
                el.classList.remove('is-jump');
            } else {
                el.classList.add('is-jump');
            }
        }
        el.style.transform = 'translate(' + this.x.toFixed(1) + 'px,' + this.y.toFixed(1) + 'px)';
        el.style.width = this.w.toFixed(1) + 'px';
        el.style.height = this.h.toFixed(1) + 'px';
    };

    const gamepadCursor = new GamepadCursor();
    window.gamepadCursor = gamepadCursor;
})();
