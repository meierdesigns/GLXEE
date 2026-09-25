"use strict";

// ProfileSelectionManager is defined in profile-selection/core.js and extended by the other files in profile-selection/,
// which index.html loads before this file.
const profileSelectionManager = new ProfileSelectionManager();
window.profileSelectionManager = profileSelectionManager;
