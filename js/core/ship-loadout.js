"use strict";

// ShipLoadoutManager is defined in ship-loadout/core.js and extended by the other files in ship-loadout/,
// which index.html loads before this file.
const shipLoadoutManager = new ShipLoadoutManager();
window.shipLoadoutManager = shipLoadoutManager;
