"use strict";

// Reload keys inside embedded browsers (VS Code's browser keeps F5 /
// Ctrl+R / Ctrl+Shift+R for itself): when the page does get the key,
// reload here. Capture phase, so no menu handler can swallow it first.
window.addEventListener('keydown', (e) => {
    const reload = e.key === 'F5'
        || ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'r' || e.key === 'R'));
    if (!reload) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    window.location.reload();
}, true);
