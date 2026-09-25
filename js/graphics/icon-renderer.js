"use strict";

// IconRenderer is defined in icon-renderer/core.js and extended by the other files in icon-renderer/,
// which index.html loads before this file.
const iconRenderer = new IconRenderer();
window.iconRenderer = iconRenderer;
