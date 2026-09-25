"use strict";
/**
 * VFBgMouseParallax: host layer setup, DOM mutation filtering and host collection.
 * Shared between the files in bg-mouse-parallax/ via VFBgMouseParallaxParts.
 */
(function (global) {
    var BG = global.VFBgMouseParallaxParts = global.VFBgMouseParallaxParts || {};
    var HOST_SELECTOR = BG.HOST_SELECTOR;
    var parallax = BG.parallax;
    var isHostVisible = BG.isHostVisible;
    var lastPaintedBg = BG.lastPaintedBg;
    var getPrimaryBase = BG.getPrimaryBase;
    var clearIncoming = BG.clearIncoming;
    var rememberBg = BG.rememberBg;
    var paintBaseInstant = BG.paintBaseInstant;
    var readHostBackground = BG.readHostBackground;
    var crossfadeTo = BG.crossfadeTo;
    var fadeInBase = BG.fadeInBase;
    var ensureBaseVisible = BG.ensureBaseVisible;
    var getTopVisibleHost = BG.getTopVisibleHost;

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
            BG.applyTransforms(parallax.curX, parallax.curY,
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

    BG.mutationsAreSelfOnly = mutationsAreSelfOnly;
    BG.collectHosts = collectHosts;
})(typeof window !== 'undefined' ? window : this);
