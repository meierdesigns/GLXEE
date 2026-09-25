"use strict";

// SoundManager is defined in sounds/core.js and extended by the other files in sounds/,
// which index.html loads before this file.
const soundManager = new SoundManager();

function resumeSoundContext() {
    if (soundManager.audioContext && soundManager.audioContext.state === 'suspended') {
        soundManager.audioContext.resume();
    }
}

document.addEventListener('click', resumeSoundContext, { once: true });
document.addEventListener('keydown', resumeSoundContext, { once: true });
