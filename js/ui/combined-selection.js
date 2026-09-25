"use strict";

// CombinedSelectionManager is defined in combined-selection/core.js and extended by the other files in combined-selection/,
// which index.html loads before this file.
// Create global instance
const combinedSelectionManager = new CombinedSelectionManager();

// Make it globally available
window.combinedSelectionManager = combinedSelectionManager;
