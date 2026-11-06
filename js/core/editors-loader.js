"use strict";

/**
 * Lazy-load DevMode / Asset-Gen / viewer editors from deferred-editors.js.
 * Core combat + station boot without that ~0.8 MB until Shift+C / Assets.
 */
(function () {
    var SRC = 'js/bundles/deferred-editors.js';
    var state = 'idle'; // idle | loading | ready | error
    var waiters = [];

    function notify(err) {
        var q = waiters.slice();
        waiters.length = 0;
        for (var i = 0; i < q.length; i++) {
            try { q[i](err || null); } catch (e) { /* ignore */ }
        }
    }

    function bust() {
        try {
            var b = window.vfBuildId || '';
            return b ? (SRC + '?v=' + encodeURIComponent(b)) : SRC;
        } catch (e) {
            return SRC;
        }
    }

    window.vfEditorsReady = function () {
        return state === 'ready';
    };

    /**
     * Ensure editors bundle is loaded, then run cb(err).
     * Safe to call many times; concurrent callers share one fetch.
     */
    window.ensureVfEditors = function (cb) {
        if (typeof cb !== 'function') cb = function () {};
        if (state === 'ready') {
            cb(null);
            return;
        }
        waiters.push(cb);
        if (state === 'loading') return;
        if (state === 'error') {
            // Allow retry after a failed load.
            state = 'idle';
        }
        state = 'loading';
        var s = document.createElement('script');
        s.src = bust();
        s.async = true;
        s.onload = function () {
            state = 'ready';
            notify(null);
        };
        s.onerror = function () {
            state = 'error';
            notify(new Error('Failed to load editors bundle'));
        };
        (document.head || document.documentElement).appendChild(s);
    };

    // If DevMode was left on, warm the editors bundle after first paint.
    function warmIfDev() {
        try {
            if (localStorage.getItem('vf_dev_mode_v1') === 'true') {
                window.ensureVfEditors(function () {});
            }
        } catch (e) { /* ignore */ }
    }
    if (document.readyState === 'complete') {
        setTimeout(warmIfDev, 0);
    } else {
        window.addEventListener('load', function () { setTimeout(warmIfDev, 0); });
    }
})();
