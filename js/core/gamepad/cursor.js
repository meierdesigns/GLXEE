"use strict";

/**
 * Animated gamepad menu cursor: a HUD frame that jumps between focused buttons
 * when the controller drives navigation. Mouse/pen input hides it again.
 */
(function () {
    const PAD = 6;
    const HIDE_MS = 280;
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
        const focused = document.querySelector('.nav-focused')
            || (document.activeElement && document.activeElement !== document.body
                ? document.activeElement : null);
        if (focused) this.follow(focused);
        else this._showIdle();
        this._kick();
    };

    GamepadCursor.prototype.markPointer = function () {
        if (!this.active) return;
        this.active = false;
        this.target = null;
        this._fadeOut();
    };

    GamepadCursor.prototype.follow = function (el) {
        if (!el || !el.getBoundingClientRect) return;
        if (!this.active) return;
        this.target = el;
        this.ensure().classList.add('is-on', 'is-jump');
        this._kick();
    };

    GamepadCursor.prototype._showIdle = function () {
        const el = this.ensure();
        el.classList.add('is-on');
        el.classList.remove('is-jump');
    };

    GamepadCursor.prototype._fadeOut = function () {
        const el = this.el;
        if (!el) return;
        el.classList.remove('is-jump');
        el.classList.add('is-out');
        const self = this;
        if (this.hideTimer) clearTimeout(this.hideTimer);
        this.hideTimer = setTimeout(function () {
            self.hideTimer = 0;
            if (self.active) return;
            el.classList.remove('is-on', 'is-out');
            self.hasPos = false;
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

    GamepadCursor.prototype._resolveTarget = function () {
        if (this.target && document.body.contains(this.target)
            && this.target.classList.contains('nav-focused')) {
            return this.target;
        }
        const focused = document.querySelector('.nav-focused');
        if (focused) {
            this.target = focused;
            return focused;
        }
        const ae = document.activeElement;
        if (ae && ae !== document.body && ae.getBoundingClientRect) {
            this.target = ae;
            return ae;
        }
        return null;
    };

    GamepadCursor.prototype._paint = function () {
        const el = this.ensure();
        if (this.el.classList.contains('is-out') && !this.active) return;
        const target = this._resolveTarget();
        if (!target) return;
        const r = target.getBoundingClientRect();
        if (r.width <= 0 && r.height <= 0) return;
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
