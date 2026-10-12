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
