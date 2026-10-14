"use strict";
// Runs in <head>: sets the stage size/scale before the first paint so a refresh
// never flashes the unscaled layout. Same math as viewport-fit.js.
(function () {
    var STEPS = [640, 800, 1024, 1280, 1440, 1600, 1920, 2560];
    var idx = 5;
    try {
        var saved = parseInt(localStorage.getItem('vf-stage-res'), 10);
        if (saved >= 0 && saved < STEPS.length) idx = saved;
    } catch (e) { /* ignore */ }
    var vv = window.visualViewport;
    var w = (vv && vv.width) || window.innerWidth || 800;
    var h = (vv && vv.height) || window.innerHeight || 600;
    var LW = 1280, LH = 960, FILL = 0.95;
    var scale = Math.max(0.05, Math.min(w * FILL / LW, h * FILL / LH));
    // ONE snapshot of the GUI state (vf-gui-state = faction + colours + palette), written together by
    // factionShipStyles.stampDocumentTheme. Everything below paints from it on the very first frame,
    // so faction, frame, cables and background can never come from different sources.
    var guiState = null;
    try {
        guiState = JSON.parse(localStorage.getItem('vf-gui-state') || 'null');
        if (!guiState || !guiState.id) {
            // One-time migration from the old scattered keys.
            var old = JSON.parse(localStorage.getItem('vf-boot-faction') || 'null');
            var oid = (old && old.id) || localStorage.getItem('vf-gui-faction') || localStorage.getItem('vf-faction');
            guiState = oid ? { id: oid, hull: old && old.hull, edge: old && old.edge, accent: old && old.accent, theme: null } : null;
            ['vf-boot-faction', 'vf-gui-faction', 'vf_boot_theme'].forEach(function (key) { localStorage.removeItem(key); });
        }
    } catch (e) { guiState = null; }
    window.vfGuiState = guiState;
    // A refresh inside the pilot wizard repaints the faction being previewed (tab-scoped, never the saved faction).
    var guiPreview = null;
    try { guiPreview = JSON.parse(sessionStorage.getItem('vf-gui-preview') || 'null'); } catch (e) { guiPreview = null; }
    if (guiPreview && guiPreview.id) guiState = guiPreview; else guiPreview = null;
    window.vfGuiPreview = guiPreview;
    window.vfWizardRestoring = !!guiPreview;   // until profileSelectionManager has rebuilt the wizard (cleared in its createUI)
    // The only writer. Previews (FX frame editor, pilot wizard) never call it.
    window.vfSaveGuiState = function (part) {
        try {
            var bz = document.getElementById('vf-bezel');
            var preview = !!(bz && bz.hasAttribute('data-preview'));
            var cur = (preview ? window.vfGuiPreview : window.vfGuiState) || {};
            if (part.id && cur.id && part.id !== cur.id) cur = { theme: null };   // a new faction drops the old faction's palette
            var next = {};
            for (var a in cur) next[a] = cur[a];
            for (var b in part) next[b] = part[b];
            if (preview) {
                window.vfGuiPreview = next;
                sessionStorage.setItem('vf-gui-preview', JSON.stringify(next));
            } else {
                window.vfGuiState = next;
                window.vfGuiPreview = null;
                sessionStorage.removeItem('vf-gui-preview');
                localStorage.setItem('vf-gui-state', JSON.stringify(next));
            }
        } catch (e) { /* storage blocked */ }
    };
    window.vfClearGuiPreview = function () { window.vfGuiPreview = null; try { sessionStorage.removeItem('vf-gui-preview'); } catch (e) { /* ignore */ } };
    try {
        if (guiState && guiState.id) {
            var rt = document.documentElement;
            rt.setAttribute('data-faction', guiState.id);
            rt.setAttribute('data-vf-faction', guiState.id);
            if (guiState.hull) rt.style.setProperty('--faction-hull', guiState.hull);
            if (guiState.edge) rt.style.setProperty('--faction-edge', guiState.edge);
            if (guiState.accent) rt.style.setProperty('--faction-accent', guiState.accent);
            var th = guiState.theme;
            if (th) {
                for (var k in th) if (Object.prototype.hasOwnProperty.call(th, k)) rt.style.setProperty(k, th[k]);
                rt.setAttribute('data-vf-boot-theme', '1');   // colorPaletteSystem.init() leaves these colours alone until ColorManager applies the faction palette
            }
            document.addEventListener('DOMContentLoaded', function () {
                var b = document.getElementById('vf-bezel');
                if (b) { b.setAttribute('data-faction', guiState.id); if (guiPreview) b.setAttribute('data-preview', '1'); }
            });
        }
    } catch (e) { /* ignore */ }
    // Logged-in pilot known from the first paint: the bezel's logout key is lit at once.
    try {
        var pr = JSON.parse(localStorage.getItem('vf_profiles_v1') || 'null');
        if (pr && pr.activeProfileId) document.documentElement.setAttribute('data-vf-logged', '1');
    } catch (e) { /* ignore */ }
    // Load mode, decided before anything else loads: 'cold' (first visit, new build or a
    // navigation that is not a reload) shows the full progress panel and waits for sprites;
    // 'refresh' (same build, reload or same tab session) keeps the calm veil and skips waits.
    // Build id = server boot stamp (meta vf-boot) + styles.css mtime stamp. A server restart
    // or stylesheet edit always forces a cold path; plain F5 in the same session stays calm.
    var BUILD = '';
    try {
        var bootMeta = document.querySelector('meta[name="vf-boot"]');
        var bootId = (bootMeta && bootMeta.getAttribute('content')) || '';
        var sheet = document.querySelector('link[rel="stylesheet"][href*="styles/part-01.css"]');
        var mv = sheet && /[?&]v=([^&]+)/.exec(sheet.getAttribute('href'));
        var sheetV = mv ? mv[1] : '';
        BUILD = bootId && sheetV ? (bootId + ':' + sheetV) : (bootId || sheetV || '');
    } catch (e) { /* ignore */ }
    // Safari / embedded browsers may ignore Clear-Site-Data: when the server boot id changes,
    // hit /__cache-clear once so stamped immutable URLs from a previous process cannot linger.
    try {
        var prevBoot = localStorage.getItem('vf-boot-id') || '';
        var curBoot = (document.querySelector('meta[name="vf-boot"]') || {}).content || '';
        if (curBoot && prevBoot && prevBoot !== curBoot) {
            fetch('/__cache-clear', { cache: 'no-store', credentials: 'same-origin' }).catch(function () {});
        }
        if (curBoot) localStorage.setItem('vf-boot-id', curBoot);
    } catch (e) { /* ignore */ }
    var mode = 'cold';
    try {
        var nav = (performance.getEntriesByType && performance.getEntriesByType('navigation') || [])[0];
        var reloaded = (nav && nav.type === 'reload') || sessionStorage.getItem('vf-booted') === '1';
        if (reloaded && BUILD && localStorage.getItem('vf-build') === BUILD) mode = 'refresh';
    } catch (e) { /* ignore */ }
    document.documentElement.setAttribute('data-vf-load', mode);
    window.vfBuildId = BUILD;
    // Destination screen is known from the saved menu state: start its background art loading
    // now (in parallel with the scripts) instead of after they have all run.
    try {
        var ms = JSON.parse(sessionStorage.getItem('vf_menu_state_v1') || 'null') || {};
        var HS = { station: 'station', menu: 'station', upgrade: 'upgrade', hangar: 'hangar', shop: 'shop', craft: 'craft', components: 'craft', travel: 'travel', play: 'travel', explorations: 'explorations' };
        // The faction's own backdrop (assets/factions/<id>/ui/bg-<screen>.png) wins over the shared room, so a reload
        // never paints the shared hangar first and swaps to the faction art afterwards.
        var fid = guiState && guiState.id && /^(terran|kronax|voidborn|pirate|machine)$/.test(guiState.id) ? guiState.id : '';
        var fbg = function (name) { return 'assets/factions/' + fid + '/ui/bg-' + name + '.png'; };
        var bg = ms.screen === 'home-station'
            ? (fid ? fbg(HS[ms.tab] || 'station') : 'assets/ui/hs-bg-' + (HS[ms.tab] || 'station') + '.png')
            : (!ms.screen || /^(start|settings|credits|profiles|ingame|theme-editor)$/.test(ms.screen)
                ? (fid && ms.screen !== 'ingame' && ms.screen !== 'theme-editor' ? fbg(ms.screen === 'profiles' ? 'profiles' : 'menu') : 'assets/ui/menu-hangar-bg.png')
                : '');
        if (bg) {
            var ln = document.createElement('link');
            ln.rel = 'preload'; ln.as = 'image'; ln.href = bg;
            document.head.appendChild(ln);
        }
        // The faction's other main backdrops too, so the first tab/screen change after the start is already decoded.
        if (fid) ['menu', 'profiles'].forEach(function (n) {
            var u = fbg(n);
            if (u === bg) return;
            var l2 = document.createElement('link');
            l2.rel = 'preload'; l2.as = 'image'; l2.href = u;
            document.head.appendChild(l2);
        });
    } catch (e) { /* ignore */ }
    // Animations/transitions stay off until the first render has settled (no load-time jumping).
    document.documentElement.classList.add('vf-loading');
    window.addEventListener('load', function () {
        setTimeout(function () { document.documentElement.classList.remove('vf-loading'); }, 900);
    });
    var r = document.documentElement.style;
    r.setProperty('--vw', LW + 'px');
    r.setProperty('--vh', LH + 'px');
    r.setProperty('--stage-scale', String(Number(scale.toFixed(5))));
})();

// Faction-switch debug log: opt-in with localStorage vf-debug = 1.
// vfLog.watch(label, ms) also reports every frame gap > 32 ms and every long task while a switch plays.
(function () {
    var T0 = performance.now();
    var off = false;
    try { off = localStorage.getItem('vf-debug') !== '1'; } catch (e) { /* ignore */ }
    function on() { return !off && window.vfDebugFactionGui !== false && window.console && console.log; }
    function vfLog(tag, msg, data) {
        if (!on()) return;
        var t = (performance.now() - T0).toFixed(0);
        var line = '%c[vf +' + t + 'ms] %c' + tag + '%c ' + msg;
        var a = [line, 'color:#888', 'color:#5cf;font-weight:bold', 'color:inherit'];
        if (data !== undefined) a.push(data);
        console.log.apply(console, a);
    }
    var watching = 0, raf = 0, last = 0, longObs = null, lastProbe = '';
    vfLog.watch = function (label, ms) {
        if (!on()) return;
        var until = performance.now() + (ms || 1800);
        if (until > watching) watching = until;
        if (raf) return;
        vfLog('watch', 'frame monitor on (' + label + ')');
        last = performance.now(); lastProbe = '';
        if (window.PerformanceObserver && !longObs) {
            try {
                longObs = new PerformanceObserver(function (l) {
                    l.getEntries().forEach(function (e) { if (performance.now() < watching + 200) vfLog('LONGTASK', e.duration.toFixed(0) + 'ms at +' + (e.startTime - T0).toFixed(0) + 'ms'); });
                });
                longObs.observe({ entryTypes: ['longtask'] });
            } catch (e) { longObs = null; }
        }
        var tick = function (now) {
            var gap = now - last; last = now;
            if (gap > 32) vfLog('FRAME', 'gap ' + gap.toFixed(0) + 'ms (' + (1000 / gap).toFixed(0) + ' fps)');
            if (typeof vfLog.probe === 'function') {
                var st = ''; try { st = vfLog.probe(); } catch (e) { st = 'probe error ' + e.message; }
                if (st !== lastProbe) { lastProbe = st; vfLog('CONTENT', st); }
            }
            if (now < watching) raf = requestAnimationFrame(tick); else { raf = 0; vfLog('watch', 'frame monitor off'); }
        };
        raf = requestAnimationFrame(tick);
    };
    window.vfLog = vfLog;
})();
