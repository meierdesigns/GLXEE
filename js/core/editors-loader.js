"use strict";

/**
 * Compat shim: ensureVfEditors now lives in feature-loaders.js.
 * Kept so older script-order entries do not break if still referenced.
 */
(function () {
    if (typeof window.ensureVfEditors === 'function') return;
    // If feature-loaders has not run yet, queue until it does via a tiny poll,
    // then fall through to loading deferred-editors directly.
    var SRC = 'js/bundles/deferred-editors.js';
    var state = 'idle';
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

    window.vfEditorsReady = window.vfEditorsReady || function () {
        return state === 'ready';
    };

    window.ensureVfEditors = function (cb) {
        if (typeof cb !== 'function') cb = function () {};
        // Prefer the feature-loaders implementation once it overwrites us.
        if (window.ensureVfEditors !== arguments.callee && window.vfEditorsReady
            && window.ensureVfEditors.toString().indexOf('deferred-editors') === -1) {
            // replaced — should not happen with same name; just load
        }
        if (state === 'ready') {
            cb(null);
            return;
        }
        waiters.push(cb);
        if (state === 'loading') return;
        if (state === 'error') state = 'idle';
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
})();
