"use strict";
/**
 * VFBgMouseParallax — light mouse parallax + spotlight for UI image backgrounds
 * (angelehnt an WoodChunk PFBgMouseParallax).
 */
(function (global) {
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
    var intensity = 'NORMAL';

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
        applyTransforms(0, 0, 0, 0);
    }

    function applyIntensity(level, persist) {
        var key = String(level || '').toUpperCase();
        if (!INTENSITY[key]) return intensity;
        intensity = key;
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
            schedule();
        }

        if (persist !== false) {
            try {
                localStorage.setItem(STORAGE_KEY, key);
            } catch (e) { /* ignore */ }
        }
        return intensity;
    }

    function loadIntensity() {
        try {
            var saved = localStorage.getItem(STORAGE_KEY);
            if (saved && INTENSITY[String(saved).toUpperCase()]) {
                applyIntensity(saved, false);
                return intensity;
            }
        } catch (e) { /* ignore */ }
        applyIntensity('NORMAL', false);
        return intensity;
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

    var FADE_MS = 420;
    /** Last fully painted BG — used to crossfade across screen handoffs (no black gap). */
    var lastPaintedBg = { img: '', bgColor: '#000' };

    function getPrimaryBase(host) {
        return host.querySelector(':scope > .vf-bg-parallax-base:not(.is-incoming)')
            || host.querySelector(':scope > .vf-bg-parallax-base');
    }

    function clearIncoming(host) {
        var list = host.querySelectorAll(':scope > .vf-bg-parallax-base.is-incoming');
        for (var i = 0; i < list.length; i++) {
            var el = list[i];
            if (el._vfFadeTimer) {
                clearTimeout(el._vfFadeTimer);
                el._vfFadeTimer = 0;
            }
            el.remove();
        }
    }

    function rememberBg(img, bgColor) {
        if (!img || img === 'none') return;
        lastPaintedBg.img = img;
        lastPaintedBg.bgColor = bgColor || '#000';
    }

    function paintBaseInstant(base, img, bgColor) {
        if (!base) return;
        base.style.transition = 'none';
        base.style.opacity = '1';
        base.style.backgroundImage = img;
        base.style.backgroundColor = bgColor;
        void base.offsetWidth;
        base.style.transition = '';
    }

    /**
     * Read cascade BG without toggling vf-bg-parallax-ready
     * (toggling ready paints ::before = hard snap).
     */
    function readHostBackground(host) {
        var probe = document.createElement('div');
        var cls = String(host.className || '')
            .replace(/\bvf-bg-parallax-host\b/g, '')
            .replace(/\bvf-bg-parallax-ready\b/g, '')
            .replace(/\bhidden\b/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        probe.className = cls;
        if (host.dataset && host.dataset.hsTab) {
            probe.dataset.hsTab = host.dataset.hsTab;
        }
        probe.setAttribute('aria-hidden', 'true');
        probe.setAttribute('data-vf-bg-probe', '1');
        probe.style.cssText = [
            'position:fixed',
            'left:-99999px',
            'top:0',
            'width:16px',
            'height:16px',
            'pointer-events:none',
            'visibility:hidden',
            'opacity:0',
            'z-index:-9999',
            'display:block'
        ].join(';');
        document.body.appendChild(probe);

        var cs = getComputedStyle(probe);
        var img = cs.backgroundImage;
        var bgColor = cs.backgroundColor || '#000';
        if (probe.parentNode) probe.parentNode.removeChild(probe);

        if (!img || img === 'none') {
            var hadReady = host.classList.contains('vf-bg-parallax-ready');
            if (hadReady) host.classList.remove('vf-bg-parallax-ready');
            cs = getComputedStyle(host);
            img = cs.backgroundImage;
            bgColor = cs.backgroundColor || bgColor;
            if (hadReady) host.classList.add('vf-bg-parallax-ready');
        }

        return { img: img, bgColor: bgColor };
    }

    function crossfadeTo(host, base, img, bgColor) {
        var existingIn = host.querySelector(':scope > .vf-bg-parallax-base.is-incoming');
        if (existingIn) {
            if (existingIn.style.backgroundImage === img) {
                // Already fading to this target — don't restart (would stick at 0).
                return;
            }
            clearIncoming(host);
        }

        // Keep current frame fully visible under the incoming fade.
        ensureBaseVisible(base);

        var incoming = document.createElement('div');
        incoming.className = 'vf-bg-parallax-base is-incoming';
        incoming.setAttribute('aria-hidden', 'true');
        incoming.style.backgroundImage = img;
        incoming.style.backgroundColor = bgColor;
        incoming.style.transform = base.style.transform || 'translate3d(0,0,0)';
        incoming.style.transition = 'none';
        incoming.style.opacity = '0';
        host.insertBefore(incoming, base.nextSibling);

        void incoming.offsetWidth;
        requestAnimationFrame(function () {
            if (!incoming.isConnected) return;
            incoming.style.transition = '';
            incoming.style.opacity = '1';
        });

        function finish() {
            if (!incoming.isConnected) return;
            if (incoming._vfFadeTimer) {
                clearTimeout(incoming._vfFadeTimer);
                incoming._vfFadeTimer = 0;
            }
            paintBaseInstant(base, img, bgColor);
            host.setAttribute('data-vf-bg-image', img);
            rememberBg(img, bgColor);
            incoming.remove();
        }

        incoming.addEventListener('transitionend', function onEnd(ev) {
            if (ev.propertyName && ev.propertyName !== 'opacity') return;
            incoming.removeEventListener('transitionend', onEnd);
            finish();
        });
        incoming._vfFadeTimer = setTimeout(finish, FADE_MS + 80);
    }

    function fadeInBase(host, base, img, bgColor) {
        clearIncoming(host);
        base.style.transition = 'none';
        base.style.opacity = '0';
        base.style.backgroundImage = img;
        base.style.backgroundColor = bgColor;
        host.setAttribute('data-vf-bg-image', img);
        rememberBg(img, bgColor);
        void base.offsetWidth;
        requestAnimationFrame(function () {
            if (!base.isConnected) return;
            base.style.transition = '';
            base.style.opacity = '1';
        });
    }

    function ensureBaseVisible(base) {
        if (!base) return;
        var op = base.style.opacity;
        if (op === '' || op === '1') return;
        base.style.transition = '';
        base.style.opacity = '1';
    }

    function hostZ(host) {
        var z = parseFloat(getComputedStyle(host).zIndex);
        return Number.isFinite(z) ? z : 0;
    }

    /** Topmost visible parallax host — only this one may handoff/fade/remember. */
    function getTopVisibleHost(hosts) {
        var list = hosts || parallax.hosts || [];
        var best = null;
        var bestZ = -Infinity;
        for (var i = 0; i < list.length; i++) {
            var h = list[i];
            if (!isHostVisible(h)) continue;
            var z = hostZ(h);
            if (z >= bestZ) {
                bestZ = z;
                best = h;
            }
        }
        return best;
    }

    function syncHostLayer(host, options) {
        if (!host) return;
        options = options || {};
        var base = getPrimaryBase(host);
        var glow = host.querySelector(':scope > .vf-bg-parallax-glow');
        if (!base || !glow) return;

        var visible = isHostVisible(host);
        if (!visible) {
            host.dataset.vfBgWasHidden = '1';
            clearIncoming(host);
            return;
        }

        // Covered hosts must stay frozen — otherwise modals ↔ parents ping-pong BGs.
        if (!options.force && options.isTop !== true) {
            return;
        }

        var bg = readHostBackground(host);
        var img = bg.img;
        var bgColor = bg.bgColor;

        if (!img || img === 'none') {
            host.classList.remove('vf-bg-parallax-ready');
            return;
        }

        host.classList.add('vf-bg-parallax-ready');

        var becameVisible = host.dataset.vfBgWasHidden === '1';
        host.dataset.vfBgWasHidden = '0';

        var prev = base.style.backgroundImage || host.getAttribute('data-vf-bg-image') || '';

        // Handoff ONLY when this host just became the top surface (or has no paint yet).
        // Never re-seed a stable host just because lastPaintedBg differs — that glitches.
        if (
            !options.instant &&
            lastPaintedBg.img &&
            lastPaintedBg.img !== img &&
            (becameVisible || !prev || prev === 'none')
        ) {
            paintBaseInstant(base, lastPaintedBg.img, lastPaintedBg.bgColor);
            host.setAttribute('data-vf-bg-image', lastPaintedBg.img);
            prev = lastPaintedBg.img;
        }

        if (prev === img) {
            if (!host.querySelector(':scope > .vf-bg-parallax-base.is-incoming')) {
                ensureBaseVisible(base);
                rememberBg(img, bgColor);
            }
            return;
        }

        if (options.instant === true) {
            clearIncoming(host);
            paintBaseInstant(base, img, bgColor);
            host.setAttribute('data-vf-bg-image', img);
            rememberBg(img, bgColor);
            return;
        }

        if (!prev || prev === 'none') {
            if (lastPaintedBg.img && lastPaintedBg.img !== img) {
                paintBaseInstant(base, lastPaintedBg.img, lastPaintedBg.bgColor);
                host.setAttribute('data-vf-bg-image', lastPaintedBg.img);
                crossfadeTo(host, base, img, bgColor);
                return;
            }
            fadeInBase(host, base, img, bgColor);
            return;
        }

        crossfadeTo(host, base, img, bgColor);
    }

    function ensureHost(host, options) {
        if (!host) return host;
        options = options || {};

        var base = getPrimaryBase(host);
        var glow = host.querySelector(':scope > .vf-bg-parallax-glow');
        if (host.dataset.vfBgParallax === '1' && base && glow) {
            if (options.sync !== false) syncHostLayer(host, options);
            return host;
        }

        host.querySelectorAll(':scope > .vf-bg-parallax-base, :scope > .vf-bg-parallax-glow').forEach(function (el) {
            el.remove();
        });

        host.dataset.vfBgParallax = '1';
        host.classList.add('vf-bg-parallax-host');
        // Always handoff/fade on first sync for this surface.
        host.dataset.vfBgWasHidden = '1';

        base = document.createElement('div');
        base.className = 'vf-bg-parallax-base';
        base.setAttribute('aria-hidden', 'true');

        glow = document.createElement('div');
        glow.className = 'vf-bg-parallax-glow';
        glow.setAttribute('aria-hidden', 'true');

        host.insertBefore(glow, host.firstChild);
        host.insertBefore(base, host.firstChild);

        /*
         * Seed previous frame + claim ready BEFORE first paint.
         * Otherwise CSS ::before flashes the destination BG (Profiles etc.).
         */
        if (lastPaintedBg.img) {
            paintBaseInstant(base, lastPaintedBg.img, lastPaintedBg.bgColor);
            host.setAttribute('data-vf-bg-image', lastPaintedBg.img);
            host.classList.add('vf-bg-parallax-ready');
        } else {
            base.style.opacity = '0';
            host.classList.remove('vf-bg-parallax-ready');
        }

        if (options.sync !== false) syncHostLayer(host, options);
        return host;
    }

    function isSelfMutationNode(node) {
        if (!node || node.nodeType !== 1) return true;
        if (node.getAttribute && node.getAttribute('data-vf-bg-probe') === '1') return true;
        var cls = node.classList;
        if (!cls) return false;
        return cls.contains('vf-bg-parallax-base')
            || cls.contains('vf-bg-parallax-glow')
            || cls.contains('vf-bg-parallax-host');
    }

    function mutationsAreSelfOnly(mutations) {
        for (var i = 0; i < mutations.length; i++) {
            var m = mutations[i];
            if (m.type === 'attributes') {
                var t = m.target;
                if (!t || t.nodeType !== 1) continue;
                if (isSelfMutationNode(t)) continue;
                if (t.dataset && t.dataset.vfBgParallax === '1') continue;
                // Transform/opacity writes on nested parallax layers must not re-sync.
                if (t.closest && t.closest('[data-vf-bg-parallax="1"]')) continue;
                return false;
            }
            if (m.type === 'childList') {
                var nodes = [];
                var a;
                for (a = 0; a < m.addedNodes.length; a++) nodes.push(m.addedNodes[a]);
                for (a = 0; a < m.removedNodes.length; a++) nodes.push(m.removedNodes[a]);
                for (a = 0; a < nodes.length; a++) {
                    if (!isSelfMutationNode(nodes[a])) return false;
                }
            }
        }
        return true;
    }

    function collectHosts() {
        if (parallax.syncing) return parallax.hosts || [];
        parallax.syncing = true;
        if (parallax.observer) parallax.observer.disconnect();
        try {
            var list = [];
            document.querySelectorAll(HOST_SELECTOR).forEach(function (el) {
                // Build layers without syncing yet — sync only the top host below.
                list.push(ensureHost(el, { sync: false }));
            });
            parallax.hosts = list;

            // Mark covered / hidden, sync only topmost visible host.
            var top = getTopVisibleHost(list);
            for (var i = 0; i < list.length; i++) {
                var h = list[i];
                if (!isHostVisible(h)) {
                    h.dataset.vfBgWasHidden = '1';
                    clearIncoming(h);
                    continue;
                }
                if (h === top) {
                    syncHostLayer(h, { isTop: true });
                }
                // Covered visibles: leave paint as-is (no handoff).
            }
            // Re-apply motion immediately so rebuilt layers don't snap to 0.
            applyTransforms(parallax.curX, parallax.curY,
                (parallax.ptrX - 0.5) * (window.innerWidth || 1),
                (parallax.ptrY - 0.5) * (window.innerHeight || 1));
            return list;
        } finally {
            parallax.syncing = false;
            if (parallax.observer && document.body) {
                parallax.observer.observe(document.body, {
                    childList: true,
                    subtree: true,
                    attributes: true,
                    attributeFilter: ['class', 'style', 'data-hs-tab', 'hidden']
                });
            }
        }
    }

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
        applyIntensity(intensity, false);
        refresh();
        if (parallax.active) schedule();
    }

    global.VFBgMouseParallax = {
        init: init,
        refresh: refresh,
        setPointerClient: setPointerClient,
        getIntensity: function () { return intensity; },
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
