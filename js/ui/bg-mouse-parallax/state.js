"use strict";
/**
 * VFBgMouseParallax: host selectors, motion state and intensity settings.
 * Shared between the files in bg-mouse-parallax/ via VFBgMouseParallaxParts.
 */
(function (global) {
    var BG = global.VFBgMouseParallaxParts = global.VFBgMouseParallaxParts || {};

    var HOST_SELECTOR = [
        '.game-container',
        '.start-screen',
        '.start-screen-overlay',
        '.home-station-overlay',
        '.content-viewer-overlay',
        '.profile-selection-overlay',
        '.victory-screen',
        '.game-over',
        '.ag-overlay'
    ].join(',');

    var STORAGE_KEY = 'vf_bgParallax';
    var INTENSITY = {
        OFF: { active: false, amount: 0, ampX: 0, ampY: 0 },
        LOW: { active: true, amount: 0.004, ampX: 3, ampY: 2 },
        NORMAL: { active: true, amount: 0.008, ampX: 5, ampY: 3.5 },
        HIGH: { active: true, amount: 0.014, ampX: 8, ampY: 5.5 }
    };
    BG.intensity = 'NORMAL';

    var parallax = {
        amount: INTENSITY.NORMAL.amount,
        speedBoostMax: 1.0,
        speedRefPxMs: 1.8,
        speedSmooth: 0,
        lastClientX: null,
        lastClientY: null,
        targetX: 0,
        targetY: 0,
        curX: 0,
        curY: 0,
        ptrX: 0.5,
        ptrY: 0.5,
        targetPtrX: 0.5,
        targetPtrY: 0.5,
        raf: 0,
        bound: false,
        active: true,
        reduceMotion: false,
        lastMoveTs: 0,
        lastFrameTs: 0,
        idleGain: 0,
        ampX: INTENSITY.NORMAL.ampX,
        ampY: INTENSITY.NORMAL.ampY,
        startMs: 0,
        leaveResetTimer: 0,
        hosts: [],
        observer: null,
        /** True while collectHosts/sync mutates DOM — blocks observer re-entry freeze. */
        syncing: false
    };

    function resetMotion() {
        cancelLeaveReset();
        parallax.targetX = 0;
        parallax.targetY = 0;
        parallax.curX = 0;
        parallax.curY = 0;
        parallax.targetPtrX = 0.5;
        parallax.targetPtrY = 0.5;
        parallax.ptrX = 0.5;
        parallax.ptrY = 0.5;
        parallax.speedSmooth = 0;
        parallax.idleGain = 0;
        parallax.lastClientX = null;
        parallax.lastClientY = null;
        parallax.lastMoveTs = -1e9;
        parallax.lastFrameTs = 0;
        BG.applyTransforms(0, 0, 0, 0);
    }

    function applyIntensity(level, persist) {
        var key = String(level || '').toUpperCase();
        if (!INTENSITY[key]) return BG.intensity;
        BG.intensity = key;
        var cfg = INTENSITY[key];
        parallax.amount = cfg.amount;
        parallax.ampX = cfg.ampX;
        parallax.ampY = cfg.ampY;
        parallax.active = !!cfg.active && !parallax.reduceMotion;

        try {
            document.documentElement.setAttribute('data-vf-bg-parallax', key.toLowerCase());
        } catch (e) { /* ignore */ }

        if (!parallax.active) {
            resetMotion();
        } else {
            BG.schedule();
        }

        if (persist !== false) {
            try {
                localStorage.setItem(STORAGE_KEY, key);
            } catch (e) { /* ignore */ }
        }
        return BG.intensity;
    }

    function loadIntensity() {
        try {
            var saved = localStorage.getItem(STORAGE_KEY);
            if (saved && INTENSITY[String(saved).toUpperCase()]) {
                applyIntensity(saved, false);
                return BG.intensity;
            }
        } catch (e) { /* ignore */ }
        applyIntensity('NORMAL', false);
        return BG.intensity;
    }

    function cancelLeaveReset() {
        if (parallax.leaveResetTimer) {
            clearTimeout(parallax.leaveResetTimer);
            parallax.leaveResetTimer = 0;
        }
    }

    function isHostVisible(host) {
        if (!host || !host.isConnected) return false;
        if (host.classList.contains('hidden')) return false;
        var style = getComputedStyle(host);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        // Do not check opacity — vf-menu-enter fades from 0 and would skip BG handoff.
        return true;
    }

    BG.HOST_SELECTOR = HOST_SELECTOR;
    BG.INTENSITY = INTENSITY;
    BG.parallax = parallax;
    BG.applyIntensity = applyIntensity;
    BG.loadIntensity = loadIntensity;
    BG.cancelLeaveReset = cancelLeaveReset;
    BG.isHostVisible = isHostVisible;
})(typeof window !== 'undefined' ? window : this);
