"use strict";

// BulletManager is defined in bullets/core.js and extended by the other files in bullets/,
// which index.html loads before this file.
// Global bullet manager instance
const bulletManager = new BulletManager();

// Make sure it's available globally
window.bulletManager = bulletManager;
