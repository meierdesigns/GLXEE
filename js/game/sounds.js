"use strict";

// SoundManager is defined in sounds/core.js and extended by the other files in sounds/,
// which index.html loads before this file.
const soundManager = new SoundManager();

function resumeSoundContext() {
    // Opens (or resumes) the AudioContext after a real user gesture.
    if (typeof soundManager.ensureContext === 'function') soundManager.ensureContext();
}

document.addEventListener('pointerdown', resumeSoundContext, { once: true, capture: true });
document.addEventListener('keydown', resumeSoundContext, { once: true, capture: true });
document.addEventListener('touchstart', resumeSoundContext, { once: true, capture: true });

// Generic UI click sound: delegated so every clickable control, present or
// future, gets one without each menu file wiring its own sound call. Covers
// real <button>s as well as the div/row-based controls this codebase builds
// its menus from (menu items, settings rows, pilot rows, tabs) — a plain
// `button` selector misses those entirely, so menu clicks stayed silent.
document.addEventListener('click', (e) => {
    const btn = e.target && e.target.closest && e.target.closest(
        'button, [role="button"], .menu-item, .settings-row, .start-menu-row .menu-item, .pilot-row, .hs-tab, .menu-cluster .menu-item'
    );
    if (!btn || btn.disabled || btn.classList.contains('locked') || btn.getAttribute('aria-disabled') === 'true') return;
    if (typeof soundManager !== 'undefined' && soundManager.playUIClick) soundManager.playUIClick();
}, true);
