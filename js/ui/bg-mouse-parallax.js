"use strict";
/**
 * VFBgMouseParallax — light mouse parallax + spotlight for UI image backgrounds
 * (angelehnt an WoodChunk PFBgMouseParallax).
 *
 * Parts live in bg-mouse-parallax/ and are loaded before this file.
 */
(function (global) {
    var BG = global.VFBgMouseParallaxParts;
    var INTENSITY = BG.INTENSITY;
    var parallax = BG.parallax;
    var applyIntensity = BG.applyIntensity;
    var loadIntensity = BG.loadIntensity;
    var cancelLeaveReset = BG.cancelLeaveReset;
    var isHostVisible = BG.isHostVisible;
    var mutationsAreSelfOnly = BG.mutationsAreSelfOnly;
    var collectHosts = BG.collectHosts;
    // Used by earlier parts; function declarations are hoisted.
    BG.applyTransforms = applyTransforms;
    BG.schedule = schedule;

    function applyTransforms(outX, outY, gx, gy) {
        var tx = outX.toFixed(2) + 'px';
        var ty = outY.toFixed(2) + 'px';
        var gtx = gx.toFixed(2) + 'px';
        var gty = gy.toFixed(2) + 'px';

        for (var i = 0; i < parallax.hosts.length; i++) {
            var host = parallax.hosts[i];
            if (!isHostVisible(host)) continue;
            var bases = host.querySelectorAll(':scope > .vf-bg-parallax-base');
            var glow = host.querySelector(':scope > .vf-bg-parallax-glow');
            for (var b = 0; b < bases.length; b++) {
                bases[b].style.transform = 'translate3d(' + tx + ',' + ty + ',0)';
            }
            if (glow) {
                glow.style.transform = 'translate3d(' + gtx + ',' + gty + ',0)';
            }
        }
    }

    function setPointerClient(clientX, clientY) {
        if (!parallax.active || parallax.reduceMotion) return;
        cancelLeaveReset();
        if (!parallax.hosts || !parallax.hosts.length) collectHosts();

        var w = window.innerWidth || 1;
        var h = window.innerHeight || 1;
        var now = performance.now();
        var dt = now - parallax.lastMoveTs;

        if (parallax.lastClientX != null && dt > 0 && dt < 80) {
            var dist = Math.hypot(
                clientX - parallax.lastClientX,
                clientY - parallax.lastClientY
            );
            parallax.speedSmooth += (dist / dt - parallax.speedSmooth) * 0.35;
        } else {
            parallax.speedSmooth *= 0.85;
        }

        parallax.lastClientX = clientX;
        parallax.lastClientY = clientY;

        var boost = Math.min(
            1,
            parallax.speedSmooth / Math.max(0.001, parallax.speedRefPxMs)
        );
        var amt = parallax.amount * (1 + boost * boost * parallax.speedBoostMax);
        var nx = (clientX / w) * 2 - 1;
        var ny = (clientY / h) * 2 - 1;

        parallax.targetX = -nx * (w * 0.5) * amt;
        parallax.targetY = -ny * (h * 0.5) * amt * 0.55;
        parallax.targetPtrX = clientX / w;
        parallax.targetPtrY = clientY / h;
        parallax.lastMoveTs = now;
        schedule();
    }

    function bind() {
        if (parallax.bound) return;
        parallax.bound = true;

        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            parallax.reduceMotion = true;
            parallax.active = false;
            return;
        }

        parallax.lastMoveTs = -1e9;
        if (!parallax.startMs) parallax.startMs = performance.now();

        window.addEventListener('mousemove', function (ev) {
            setPointerClient(ev.clientX, ev.clientY);
        }, { passive: true });

        window.addEventListener('mouseleave', function () {
            if (!parallax.active) return;
            cancelLeaveReset();
            parallax.leaveResetTimer = setTimeout(function () {
                parallax.leaveResetTimer = 0;
                if (!parallax.active) return;
                parallax.targetX = 0;
                parallax.targetY = 0;
                parallax.targetPtrX = 0.5;
                parallax.targetPtrY = 0.5;
                parallax.lastMoveTs = -1e9;
                parallax.speedSmooth = 0;
                parallax.lastClientX = null;
                parallax.lastClientY = null;
                schedule();
            }, 90);
        });

        if (typeof MutationObserver !== 'undefined') {
            var obsTimer = 0;
            parallax.observer = new MutationObserver(function (mutations) {
                if (parallax.syncing) return;
                // Probe append/remove + parallax layer inserts must not re-enter collectHosts.
                if (mutationsAreSelfOnly(mutations)) return;

                var urgent = false;
                for (var i = 0; i < mutations.length; i++) {
                    var m = mutations[i];
                    if (m.type === 'childList' && (m.addedNodes.length || m.removedNodes.length)) {
                        urgent = true;
                        break;
                    }
                    if (m.type === 'attributes' && m.attributeName === 'data-hs-tab') {
                        urgent = true;
                        break;
                    }
                }
                // New overlays / tab BGs: sync in the same turn (before paint) so ::before never flashes.
                if (urgent) {
                    if (obsTimer) {
                        clearTimeout(obsTimer);
                        obsTimer = 0;
                    }
                    collectHosts();
                    return;
                }
                if (obsTimer) return;
                obsTimer = setTimeout(function () {
                    obsTimer = 0;
                    collectHosts();
                }, 32);
            });
            parallax.observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['class', 'style', 'data-hs-tab', 'hidden']
            });
        }
    }

    function schedule() {
        if (parallax.raf) return;
        parallax.raf = requestAnimationFrame(step);
    }

    function step(now) {
        parallax.raf = 0;
        if (!parallax.active || parallax.reduceMotion) return;

        var w = window.innerWidth || 1;
        var h = window.innerHeight || 1;

        if (!parallax.lastFrameTs) parallax.lastFrameTs = now;
        var dt = Math.min(48, now - parallax.lastFrameTs) / 1000;
        parallax.lastFrameTs = now;

        var kParallax = 1 - Math.exp(-14 * dt);
        var kPtr = 1 - Math.exp(-22 * dt);

        parallax.curX += (parallax.targetX - parallax.curX) * kParallax;
        parallax.curY += (parallax.targetY - parallax.curY) * kParallax;
        parallax.ptrX += (parallax.targetPtrX - parallax.ptrX) * kPtr;
        parallax.ptrY += (parallax.targetPtrY - parallax.ptrY) * kPtr;

        var sinceMove = (now - parallax.lastMoveTs) / 1000;
        if (sinceMove > 0.08) parallax.speedSmooth *= 0.9;

        var idleActive = sinceMove > 0.35;
        if (idleActive) {
            parallax.idleGain = Math.min(1, parallax.idleGain + 0.018);
        } else {
            parallax.idleGain *= 0.92;
        }

        var hx = 0;
        var hy = 0;
        if (parallax.idleGain > 0.02) {
            var t = (now - parallax.startMs) / 1000;
            var TAU = Math.PI * 2;
            hx =
                (Math.sin(t * TAU * 0.023) * 0.65 +
                    Math.sin(t * TAU * 0.041 + 1.7) * 0.35) *
                parallax.ampX *
                parallax.idleGain;
            hy =
                (Math.sin(t * TAU * 0.019 + 0.9) * 0.7 +
                    Math.sin(t * TAU * 0.034 + 2.3) * 0.3) *
                parallax.ampY *
                parallax.idleGain;
        }

        var outX = parallax.curX + hx;
        var outY = parallax.curY + hy;
        var gx = (parallax.ptrX - 0.5) * w;
        var gy = (parallax.ptrY - 0.5) * h;
        applyTransforms(outX, outY, gx, gy);

        var dx = Math.abs(parallax.targetX - parallax.curX);
        var dy = Math.abs(parallax.targetY - parallax.curY);
        var dPtr =
            Math.abs(parallax.targetPtrX - parallax.ptrX) +
            Math.abs(parallax.targetPtrY - parallax.ptrY);
        var settling = dx > 0.05 || dy > 0.05 || dPtr > 0.002;

        if (settling || parallax.idleGain > 0.02) schedule();
        else parallax.lastFrameTs = 0;
    }

    function refresh() {
        collectHosts();
        schedule();
    }

    function init() {
        if (!document.body) {
            document.addEventListener('DOMContentLoaded', init, { once: true });
            return;
        }
        loadIntensity();
        bind();
        // Re-apply after reduce-motion check in bind()
        applyIntensity(BG.intensity, false);
        refresh();
        if (parallax.active) schedule();
    }

    global.VFBgMouseParallax = {
        init: init,
        refresh: refresh,
        setPointerClient: setPointerClient,
        getIntensity: function () { return BG.intensity; },
        getIntensityOptions: function () { return Object.keys(INTENSITY); },
        setIntensity: function (level) { return applyIntensity(level, true); },
        config: parallax
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})(typeof window !== 'undefined' ? window : this);
