"use strict";

/**
 * Single RAF ticker for Home Station preview sims (hangar, fleet, …).
 * Subscribers declare an id + fps; only one browser RAF chain runs.
 */
var vfStationAnim = {
    _subs: Object.create(null),
    _order: [],
    _raf: 0,
    _running: false,

    subscribe: function (id, fn, fps) {
        if (!id || typeof fn !== 'function') return;
        var hz = Math.max(8, Math.min(60, Number(fps) || 30));
        var existing = this._subs[id];
        this._subs[id] = {
            fn: fn,
            interval: 1000 / hz,
            last: 0
        };
        if (!existing) this._order.push(id);
        this._ensure();
    },

    unsubscribe: function (id) {
        if (!this._subs[id]) return;
        delete this._subs[id];
        this._order = this._order.filter(function (x) { return x !== id; });
        if (!this._order.length) this._stop();
    },

    has: function (id) {
        return !!this._subs[id];
    },

    _ensure: function () {
        if (this._running) return;
        this._running = true;
        var self = this;
        var tick = function (ts) {
            if (!self._order.length) {
                self._running = false;
                self._raf = 0;
                return;
            }
            self._raf = requestAnimationFrame(tick);
            if (typeof document !== 'undefined' && document.hidden) return;
            for (var i = 0; i < self._order.length; i++) {
                var id = self._order[i];
                var sub = self._subs[id];
                if (!sub) continue;
                if (!sub.last) {
                    sub.last = ts;
                    continue;
                }
                var elapsed = ts - sub.last;
                if (elapsed < sub.interval) continue;
                var dt = Math.min(50, elapsed);
                sub.last = ts;
                try {
                    sub.fn(dt, ts);
                } catch (e) {
                    console.warn('[vfStationAnim]', id, e);
                }
            }
        };
        this._raf = requestAnimationFrame(tick);
    },

    _stop: function () {
        this._running = false;
        if (this._raf) {
            cancelAnimationFrame(this._raf);
            this._raf = 0;
        }
    }
};
