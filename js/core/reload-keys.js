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
    // Reload at once: waiting lets the running game write its state back.
    window.location.reload();
}, true);
