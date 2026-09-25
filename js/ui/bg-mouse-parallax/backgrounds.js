"use strict";
/**
 * VFBgMouseParallax: background layer painting and crossfades.
 * Shared between the files in bg-mouse-parallax/ via VFBgMouseParallaxParts.
 */
(function (global) {
    var BG = global.VFBgMouseParallaxParts = global.VFBgMouseParallaxParts || {};
    var parallax = BG.parallax;
    var isHostVisible = BG.isHostVisible;

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

    BG.lastPaintedBg = lastPaintedBg;
    BG.getPrimaryBase = getPrimaryBase;
    BG.clearIncoming = clearIncoming;
    BG.rememberBg = rememberBg;
    BG.paintBaseInstant = paintBaseInstant;
    BG.readHostBackground = readHostBackground;
    BG.crossfadeTo = crossfadeTo;
    BG.fadeInBase = fadeInBase;
    BG.ensureBaseVisible = ensureBaseVisible;
    BG.getTopVisibleHost = getTopVisibleHost;
})(typeof window !== 'undefined' ? window : this);
