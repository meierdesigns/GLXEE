"use strict";

// Reload keys inside embedded browsers (VS Code's browser keeps F5 /
// Ctrl+R / Ctrl+Shift+R for itself): when the page does get the key,
// reload here. Capture phase, so no menu handler can swallow it first.
window.addEventListener('keydown', (e) => {
    const reload = (e.key === 'F5' || ((e.key === 'F4' || e.code === 'F4') && !e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey))
        || ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'r' || e.key === 'R'));
    if (!reload) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    // F4 = full reset: forget the running session + menu position so the
    // boot intro and the start screen come up again.
    if (e.key === 'F4' || e.code === 'F4') {
        try {
            sessionStorage.removeItem('vf_app_running_v1');
            sessionStorage.removeItem('vf_menu_state_v1');
            localStorage.removeItem('vf_start_menu_state_v1');
        } catch (err) { /* storage blocked */ }
    }
    if (e.key !== 'F4' && e.code !== 'F4') { window.location.reload(); return; }
    // Refresh the HTTP cache entries of every script/stylesheet first
    // (cache: 'reload' bypasses and overwrites them), then reload.
    const urls = Array.from(document.querySelectorAll('script[src], link[rel="stylesheet"]'))
        .map((el) => el.src || el.href)
        .filter((u) => u && u.startsWith(location.origin));
    urls.push(location.href);
    const refresh = Promise.all(urls.map((u) => fetch(u, { cache: 'reload' }).catch(() => {})));
    const timeout = new Promise((resolve) => setTimeout(resolve, 4000));
    Promise.race([refresh, timeout]).then(() => window.location.reload());
}, true);
