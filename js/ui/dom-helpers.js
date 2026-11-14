"use strict";

// Shared DOM building blocks for screens/panels/editors, so each one stops
// hand-rolling its own close button and backdrop-click-to-close wiring.

function createCloseButton(onClick, className) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = className || 'ui-close-btn';
    btn.textContent = '✕';
    btn.addEventListener('click', onClick);
    return btn;
}

function bindBackdropClose(container, onClose) {
    container.addEventListener('click', (e) => {
        if (e.target === container) onClose();
    });
}
