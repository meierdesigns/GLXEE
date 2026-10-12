"use strict";

// GalaxyMapManager is defined in galaxy-map/core.js and extended by the other files in galaxy-map/,
// which index.html loads before this file.
const galaxyMapManager = new GalaxyMapManager();
window.galaxyMapManager = galaxyMapManager;
