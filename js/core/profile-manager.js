"use strict";

// ProfileManager is defined in profile-manager/core.js and extended by the other files in profile-manager/,
// which index.html loads before this file.
const profileManager = new ProfileManager();
window.profileManager = profileManager;
