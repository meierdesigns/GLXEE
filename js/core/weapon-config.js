"use strict";

// WeaponConfigManager is defined in weapon-config/core.js and extended by the other files in weapon-config/,
// which index.html loads before this file.
const weaponConfigManager = new WeaponConfigManager();
window.weaponConfigManager = weaponConfigManager;
