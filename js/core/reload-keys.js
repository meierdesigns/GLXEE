"use strict";

// Reload keys inside embedded browsers (VS Code's browser keeps F5 /
// Ctrl+R / Ctrl+Shift+R for itself): when the page does get the key,
// reload here. Capture phase, so no menu handler can swallow it first.
window.addEventListener('keydown', (e) => {
    const hard = (e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && (e.key === 'r' || e.key === 'R');
    const soft = e.key === 'F5'
        || ((e.key === 'F4' || e.code === 'F4') && !e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey)
        || ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && (e.key === 'r' || e.key === 'R'));
    if (!hard && !soft) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    // F4 = full reset: forget the running session + menu position so the
    // boot intro and the start screen come up again.
    if (e.key === 'F4' || e.code === 'F4') {
        try {
            sessionStorage.removeItem('vf_app_running_v1');
            sessionStorage.removeItem('vf_menu_state_v1');
            localStorage.removeItem('vf_start_menu_state_v1');
            localStorage.removeItem('vf-build');
            localStorage.removeItem('vf-boot-id');
            sessionStorage.removeItem('vf-booted');
        } catch (err) { /* storage blocked */ }
    }
    // Ctrl/Cmd+Shift+R = hard cache wipe (works even when Clear-Site-Data is ignored).
    if (hard) {
        try {
            localStorage.removeItem('vf-build');
            localStorage.removeItem('vf-boot-id');
            sessionStorage.removeItem('vf-booted');
        } catch (err) { /* storage blocked */ }
        const go = () => {
            const u = new URL(location.href);
            u.searchParams.set('_cb', String(Date.now()));
            location.replace(u.toString());
        };
        fetch('/__cache-clear', { cache: 'no-store', credentials: 'same-origin' })
            .then(() => go(), () => go());
        return;
    }
    // Reload at once: waiting lets the running game write its state back.
    window.location.reload();
}, true);
