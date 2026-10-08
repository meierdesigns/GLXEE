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
    // Last applied theme colours: the frame's light edge etc. paint right on the first frame
    // instead of jumping once the palette system runs.
    try {
        var th = JSON.parse(localStorage.getItem('vf_boot_theme') || 'null');
        if (th) for (var k in th) if (Object.prototype.hasOwnProperty.call(th, k)) document.documentElement.style.setProperty(k, th[k]);
    } catch (e) { /* ignore */ }
    // Logged-in pilot known from the first paint: the bezel's logout key is lit at once.
    try {
        var pr = JSON.parse(localStorage.getItem('vf_profiles_v1') || 'null');
        if (pr && pr.activeProfileId) document.documentElement.setAttribute('data-vf-logged', '1');
    } catch (e) { /* ignore */ }
    // Last known faction: styles the frame from the very first paint (no terran -> faction jump).
    try {
        var f = localStorage.getItem('vf-faction');
        if (f) {
            document.documentElement.setAttribute('data-vf-faction', f);
            document.addEventListener('DOMContentLoaded', function () {
                var b = document.getElementById('vf-bezel');
                if (b) b.setAttribute('data-faction', f);
            });
        }
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
