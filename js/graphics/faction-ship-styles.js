"use strict";

// FactionShipStyles is defined in faction-ship-styles/core.js and extended by the other files in faction-ship-styles/,
// which index.html loads before this file.
const factionShipStyles = new FactionShipStyles();
window.FactionShipStyles = FactionShipStyles;
window.factionShipStyles = factionShipStyles;
// Theme the document from the stored profile on load, before any screen opens.
factionShipStyles.applyDocumentFactionTheme();
