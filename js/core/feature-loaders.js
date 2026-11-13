"use strict";

/**
 * Lazy-load feature bundles (station / galaxy / profiles / combat / editors).
 * Boot stays on deferred-boot.js; these load on demand with shared in-flight fetches.
 */
(function () {
    var bundles = {
        station: { src: 'js/bundles/deferred-station.js', state: 'idle', waiters: [] },
        galaxy: { src: 'js/bundles/deferred-galaxy.js', state: 'idle', waiters: [] },
        profiles: { src: 'js/bundles/deferred-profiles.js', state: 'idle', waiters: [] },
        combat: { src: 'js/bundles/deferred-combat.js', state: 'idle', waiters: [] },
        editors: { src: 'js/bundles/deferred-editors.js', state: 'idle', waiters: [] }
    };

    function mark(name, detail) {
        try {
            if (window.performance && performance.mark) {
                performance.mark('bundle-load:' + name + (detail ? ':' + detail : ''));
            }
            if (window.vfLog) window.vfLog('bundle', name + (detail ? ' ' + detail : ''));
        } catch (e) { /* ignore */ }
    }

    function bust(src) {
        try {
            var b = window.vfBuildId || '';
            return b ? (src + '?v=' + encodeURIComponent(b)) : src;
        } catch (e) {
            return src;
        }
    }

    function notify(entry, err) {
        var q = entry.waiters.slice();
        entry.waiters.length = 0;
        for (var i = 0; i < q.length; i++) {
            try { q[i](err || null); } catch (e) { /* ignore */ }
        }
    }

    function ensure(name, cb) {
        if (typeof cb !== 'function') cb = function () {};
        var entry = bundles[name];
        if (!entry) {
            cb(new Error('Unknown feature bundle: ' + name));
            return;
        }
        if (entry.state === 'ready') {
            cb(null);
            return;
        }
        entry.waiters.push(cb);
        if (entry.state === 'loading') return;
        if (entry.state === 'error') entry.state = 'idle';
        entry.state = 'loading';
        mark(name, 'start');
        var t0 = (window.performance && performance.now) ? performance.now() : Date.now();
        var s = document.createElement('script');
        s.src = bust(entry.src);
        s.async = true;
        s.onload = function () {
            entry.state = 'ready';
            var dt = ((window.performance && performance.now) ? performance.now() : Date.now()) - t0;
            mark(name, 'ready ' + Math.round(dt) + 'ms');
            if (name === 'editors' && typeof window.vfLoadEditorCss === 'function') {
                try { window.vfLoadEditorCss(); } catch (e) { /* ignore */ }
            }
            notify(entry, null);
        };
        s.onerror = function () {
            entry.state = 'error';
            mark(name, 'error');
            notify(entry, new Error('Failed to load ' + entry.src));
        };
        (document.head || document.documentElement).appendChild(s);
    }

    function ready(name) {
        return !!(bundles[name] && bundles[name].state === 'ready');
    }

    function ensureAll(names, cb) {
        if (typeof cb !== 'function') cb = function () {};
        var left = names.length;
        var firstErr = null;
        if (!left) {
            cb(null);
            return;
        }
        names.forEach(function (n) {
            ensure(n, function (err) {
                if (err && !firstErr) firstErr = err;
                left -= 1;
                if (left <= 0) cb(firstErr);
            });
        });
    }

    /** Map menu screen → feature bundles needed before restore/show. */
    function featuresForScreen(screen, tab) {
        var s = String(screen || '');
        var t = String(tab || '');
        if (s === 'home-station' || s === 'galaxyMap' || s === 'combined') {
            return t === 'play' ? ['station', 'galaxy'] : ['station'];
        }
        // Profiles wizard needs portraits (shipped in station bundle).
        if (s === 'profiles' || s === 'onboarding') return ['station', 'profiles'];
        if (s === 'ingame' || s === 'endscreen') return ['combat', 'station'];
        // Settings/credits only need station when a pilot hub is underneath.
        // Do NOT fold asset-gen / theme-editor into this — that skipped the editors
        // bundle on reload, so Face Editor never came back after refresh.
        if (s === 'settings' || s === 'credits') {
            try {
                if (typeof profileManager !== 'undefined' && profileManager.hasActiveProfile
                    && profileManager.hasActiveProfile()) {
                    return ['station'];
                }
            } catch (e) { /* ignore */ }
        }
        // Editors / viewers / Face Editor / Asset Gen
        if (/editor|viewer|asset-gen|theme-editor|hangar-test/.test(s)) {
            return ['editors', 'station'];
        }
        return [];
    }

    function ensureForScreen(screen, tab, cb) {
        ensureAll(featuresForScreen(screen, tab), cb);
    }

    function prefetchForMenuState() {
        try {
            var st = (typeof menuStateManager !== 'undefined' && menuStateManager.get)
                ? menuStateManager.get()
                : null;
            if (!st) {
                try {
                    st = JSON.parse(sessionStorage.getItem('vf_menu_state_v1') || 'null');
                } catch (e) { st = null; }
            }
            if (!st || !st.screen) return;
            var names = featuresForScreen(st.screen, st.tab);
            if (names.length) ensureAll(names, function () {});
        } catch (e) { /* ignore */ }
    }

    window.ensureVfStation = function (cb) { ensure('station', cb); };
    window.ensureVfGalaxy = function (cb) { ensure('galaxy', cb); };
    window.ensureVfProfiles = function (cb) { ensure('profiles', cb); };
    window.ensureVfCombat = function (cb) { ensure('combat', cb); };
    window.ensureVfEditors = function (cb) { ensure('editors', cb); };

    window.vfStationReady = function () { return ready('station'); };
    window.vfGalaxyReady = function () { return ready('galaxy'); };
    window.vfProfilesReady = function () { return ready('profiles'); };
    window.vfCombatReady = function () { return ready('combat'); };
    window.vfEditorsReady = function () { return ready('editors'); };

    window.vfEnsureForScreen = ensureForScreen;
    window.vfFeaturesForScreen = featuresForScreen;
    window.vfPrefetchMenuFeatures = prefetchForMenuState;

    window.vfWithStation = function (fn) {
        ensure('station', function (err) {
            if (!err && typeof homeStationUI !== 'undefined' && typeof fn === 'function') fn(homeStationUI);
        });
    };
    window.vfWithProfiles = function (fn) {
        ensure('profiles', function (err) {
            if (!err && typeof profileSelectionManager !== 'undefined' && typeof fn === 'function') {
                fn(profileSelectionManager);
            }
        });
    };
    window.vfWithGalaxy = function (fn) {
        ensure('galaxy', function (err) {
            if (!err && typeof galaxyMapManager !== 'undefined' && typeof fn === 'function') {
                fn(galaxyMapManager);
            }
        });
    };

    // Warm editors if DevMode was left on; prefetch menu features ASAP.
    function warm() {
        prefetchForMenuState();
        try {
            if (localStorage.getItem('vf_dev_mode_v1') === 'true') {
                ensure('editors', function () {});
            }
        } catch (e) { /* ignore */ }
    }
    if (document.readyState === 'complete') {
        setTimeout(warm, 0);
    } else {
        window.addEventListener('load', function () { setTimeout(warm, 0); });
        // Prefetch as early as this file runs (inside deferred-boot).
        setTimeout(prefetchForMenuState, 0);
    }

    try {
        if (window.performance && performance.mark) performance.mark('boot-js-feature-loaders');
    } catch (e) { /* ignore */ }
})();
