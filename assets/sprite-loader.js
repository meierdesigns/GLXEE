"use strict";

// SpriteLoader is defined in sprite-loader/core.js and extended by the other files in sprite-loader/,
// which index.html loads before this file.
// Create global instance
const spriteLoader = new SpriteLoader();

// Make available globally for non-module scripts
window.SpriteLoader = SpriteLoader;
window.spriteLoader = spriteLoader;

// Export for use in other modules (commented out for non-module usage)
// export { spriteLoader };
