"use strict";

// PlayerSelectionManager is defined in player-selection/core.js and extended by the other files in player-selection/,
// which index.html loads before this file.
// Create global instance
const playerSelectionManager = new PlayerSelectionManager();

// Make it globally available
window.playerSelectionManager = playerSelectionManager;
