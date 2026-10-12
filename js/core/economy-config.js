"use strict";

// EconomyConfig is defined in economy-config/core.js and extended by the other files in economy-config/,
// which index.html loads before this file.
const economyConfig = new EconomyConfig();
if (typeof economyConfig.applyResourceCssVars === 'function') {
    economyConfig.applyResourceCssVars();
}
window.economyConfig = economyConfig;
