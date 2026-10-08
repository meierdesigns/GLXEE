"use strict";

/**
 * Boot loading screen: progress while CSS/scripts/fonts settle, before the
 * menu appears under the boot veil. Safe to run from <head>; DOM updates wait
 * until #vf-boot-veil exists.
 */
(function () {
    const PHASES = {
        open: { label: 'OPENING CHANNEL', weight: 0.05 },
        shell: { label: 'LOADING SHELL', weight: 0.2 },
        link: { label: 'LINKING SYSTEMS', weight: 0.55 },
        font: { label: 'FONT LOCK', weight: 0.7 },
        assets: { label: 'ARMING SPRITES', weight: 0.85 },
        menu: { label: 'RESTORING MENU', weight: 0.94 },
        ready: { label: 'READY', weight: 1 }
    };

    let phase = 'open';
    let resourcePct = 0;
    let forcedPct = 0;
    let finished = false;
    let raf = 0;
    let lastPaint = -1;

    function $(id) {
        return document.getElementById(id);
    }

    function absUrl(u) {
        try {
            return new URL(u, document.baseURI || location.href).href;
        } catch (e) {
            return u;
        }
    }

    function expectedUrls() {
        const out = [];
        document.querySelectorAll('script[src], link[rel="stylesheet"][href]').forEach((el) => {
            const u = el.src || el.href;
            if (u) out.push(absUrl(u));
        });
        return out;
    }

    function loadedSet() {
        const set = Object.create(null);
        try {
            performance.getEntriesByType('resource').forEach((e) => {
                if (e && e.name && e.responseEnd > 0) set[e.name] = 1;
            });
        } catch (e) { /* ignore */ }
        return set;
    }

    function measureResources() {
        const want = expectedUrls();
        if (!want.length) return document.readyState === 'complete' ? 1 : 0.15;
        const have = loadedSet();
        let n = 0;
        for (let i = 0; i < want.length; i++) {
            if (have[want[i]]) n++;
        }
        // Scripts already executed but missing from Performance (file:// / cache quirks)
        if (document.readyState === 'interactive' || document.readyState === 'complete') {
            n = Math.max(n, Math.floor(want.length * (document.readyState === 'complete' ? 0.92 : 0.55)));
        }
        return Math.max(0, Math.min(1, n / want.length));
    }

    function displayPct() {
        const phaseFloor = (PHASES[phase] && PHASES[phase].weight) || 0;
        const blended = Math.max(forcedPct, phaseFloor * 0.85 + resourcePct * 0.15, resourcePct * 0.9);
        return Math.max(0, Math.min(1, blended));
    }

    function paint() {
        if (finished) return;
        if (!$('vf-boot-veil')) return;
        mountHints();
        const bar = $('vf-boot-bar');
        const pctEl = $('vf-boot-pct');
        const status = $('vf-boot-status');
        const panel = $('vf-boot-loader');
        if (!bar || !pctEl) return;

        const p = displayPct();
        const shown = Math.round(p * 100);
        if (shown === lastPaint && status && status.textContent === ((PHASES[phase] && PHASES[phase].label) || '')) {
            return;
        }
        lastPaint = shown;
        bar.style.width = shown + '%';
        bar.setAttribute('aria-valuenow', String(shown));
        pctEl.textContent = shown + '%';
        if (status && PHASES[phase]) status.textContent = PHASES[phase].label;
        if (panel) panel.setAttribute('data-phase', phase);
    }

    function tick() {
        if (finished) return;
        resourcePct = measureResources();
        if (document.readyState === 'loading' && resourcePct < 0.35) phase = phase === 'open' ? 'shell' : phase;
        else if (document.readyState !== 'complete' && resourcePct >= 0.2) phase = phase === 'open' || phase === 'shell' ? 'link' : phase;
        paint();
        raf = requestAnimationFrame(tick);
    }

    function setPhase(name, pct) {
        if (finished) return;
        if (PHASES[name]) phase = name;
        if (pct != null && Number.isFinite(pct)) forcedPct = Math.max(forcedPct, Math.min(1, pct));
        paint();
    }

    function finish(opts) {
        if (finished) return;
        finished = true;
        if (raf) cancelAnimationFrame(raf);
        phase = 'ready';
        forcedPct = 1;
        resourcePct = 1;
        paint();
        const veil = $('vf-boot-veil');
        const panel = $('vf-boot-loader');
        const fade = !(opts && opts.instant);
        if (panel) panel.classList.add('is-done');
        if (veil) {
            veil.classList.add('is-loader-done');
            if (fade) veil.classList.add('is-leaving');
        }
        // Caller (dismissBootVeil) removes the veil; failsafe if it does not.
        setTimeout(function () {
            const v = $('vf-boot-veil');
            if (v && v.parentNode && v.classList.contains('is-loader-done')) {
                v.parentNode.removeChild(v);
            }
            document.documentElement.classList.remove('vf-booting', 'vf-loading');
        }, fade ? 420 : 0);
    }

    function mountHints() {
        const veil = $('vf-boot-veil');
        if (!veil) return;
        veil.classList.add('vf-boot-veil-loading');
        veil.setAttribute('role', 'progressbar');
        veil.setAttribute('aria-busy', 'true');
        veil.setAttribute('aria-label', 'Loading GLXEE');
        // Block clicks into half-built UI while scripts stream in.
        veil.style.pointerEvents = 'auto';
    }

    function onFonts() {
        if (!document.fonts || !document.fonts.ready) {
            setPhase('font', 0.72);
            return;
        }
        document.fonts.ready.then(function () {
            setPhase('font', 0.78);
        }).catch(function () {
            setPhase('font', 0.78);
        });
    }

    window.vfBootLoader = {
        setPhase: setPhase,
        finish: finish,
        isFinished: function () { return finished; }
    };

    function start() {
        mountHints();
        setPhase('open', 0.02);
        paint();
        tick();
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function () {
                setPhase('link', 0.6);
                onFonts();
            });
        } else {
            setPhase('link', 0.6);
            onFonts();
        }
        window.addEventListener('load', function () {
            setPhase('assets', 0.88);
        });
    }

    // Start as soon as the veil exists (often mid-parse), not only on DOMContentLoaded.
    function waitForVeil(tries) {
        if ($('vf-boot-veil') || document.body) {
            start();
            return;
        }
        if (tries > 600) return;
        setTimeout(function () { waitForVeil(tries + 1); }, 16);
    }
    waitForVeil(0);
})();
