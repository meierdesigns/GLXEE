"use strict";

/**
 * Boot loading screen: progress while CSS/scripts/fonts settle, before the
 * menu appears under the boot veil. Safe to run from <head>; DOM updates wait
 * until #vf-boot-veil exists.
 */
(function () {
    // Cold load (first visit / new build): full progress panel. Refresh (stage-boot.js sets
    // data-vf-load): only the calm veil, so the UI never visibly builds up or jumps; it fades out
    // like on first load. The veil sits under the bezel so the frame stays put while only the
    // screen is covered.
    const isRefresh = document.documentElement.getAttribute('data-vf-load') === 'refresh';
    try {
        if (isRefresh) {
            const st = document.createElement('style');
            st.textContent = '#vf-boot-loader{visibility:hidden!important}#vf-boot-veil{z-index:9980!important}';
            (document.head || document.documentElement).appendChild(st);
        }
        sessionStorage.setItem('vf-booted', '1');
    } catch (e) { /* storage blocked: always show */ }

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
    let peakPct = 0; // never let the bar or % text shrink (mid-parse script discovery used to reverse it)
    let finished = false;
    let raf = 0;
    let lastPaint = -1;
    // Stable denominator: index.html currently ships ~500 scripts + a handful of stylesheets.
    // Using live querySelectorAll mid-parse made progress fall as new <script> tags appeared.
    let expectedTotal = 510;

    function $(id) {
        return document.getElementById(id);
    }

    function markExpected() {
        const n = document.querySelectorAll('script[src], link[rel="stylesheet"][href]').length;
        if (n > expectedTotal) expectedTotal = n;
    }

    function loadedCount() {
        let n = 0;
        try {
            performance.getEntriesByType('resource').forEach((e) => {
                if (!e || !e.name || !(e.responseEnd > 0)) return;
                if (/\.(js|css)(\?|$)/i.test(e.name) || /\/js\/|\/css\/|styles\.css/i.test(e.name)) n++;
                const b = /\/__bundle\/b(\d+)-/.exec(e.name);   // a served bundle stands for N script files
                if (b) n += Number(b[1]) - 1;
            });
        } catch (e) { /* ignore */ }
        return n;
    }

    function measureResources() {
        markExpected();
        let n = loadedCount();
        // Scripts already executed but missing from Performance (file:// / cache quirks)
        if (document.readyState === 'interactive') n = Math.max(n, Math.floor(expectedTotal * 0.55));
        if (document.readyState === 'complete') n = Math.max(n, Math.floor(expectedTotal * 0.92));
        return Math.max(0, Math.min(1, n / Math.max(1, expectedTotal)));
    }

    function displayPct() {
        const phaseFloor = (PHASES[phase] && PHASES[phase].weight) || 0;
        const blended = Math.max(forcedPct, phaseFloor * 0.85 + resourcePct * 0.15, resourcePct * 0.9);
        const p = Math.max(0, Math.min(1, blended));
        peakPct = Math.max(peakPct, p);
        return peakPct;
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
        // scaleX from the left edge — unambiguous LTR fill in every browser
        bar.style.width = '100%';
        bar.style.transform = 'scaleX(' + (shown / 100) + ')';
        bar.setAttribute('aria-valuenow', String(shown));
        pctEl.textContent = shown + '%';
        if (status && PHASES[phase]) status.textContent = PHASES[phase].label;
        if (panel) panel.setAttribute('data-phase', phase);
    }

    function tick() {
        if (finished) return;
        resourcePct = Math.max(resourcePct, measureResources());
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
        if (raf) cancelAnimationFrame(raf);
        phase = 'ready';
        // The cache now holds this build: the next load of it counts as a refresh.
        try { if (window.vfBuildId) localStorage.setItem('vf-build', window.vfBuildId); } catch (e) { /* ignore */ }
        forcedPct = 1;
        resourcePct = 1;
        peakPct = 1;
        paint(); // paint 100% before locking finished
        finished = true;
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
        // A stalled asset request must never keep the boot veil on screen forever.
        // The application has its own restore watchdog; this only releases the
        // visual loader when the browser never emits `load`.
        setTimeout(function () {
            if (!finished) finish({ instant: true });
        }, 8000);
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
            setTimeout(function () {
                if (!finished) finish();
            }, 4000);
        });
        window.addEventListener('error', function () {
            if (finished) return;
            setPhase('ready', 1);
            var status = $('vf-boot-status');
            if (status) status.textContent = 'BOOT ERROR';
            setTimeout(function () { finish({ instant: true }); }, 900);
        }, { once: true });
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
