"use strict";

// AssetGenUI is defined in asset-gen-ui/core.js and extended by the other files in asset-gen-ui/,
// which index.html loads before this file.
const assetGenUI = new AssetGenUI();
window.AssetGenUI = AssetGenUI;
window.assetGenUI = assetGenUI;

document.addEventListener("keydown", (e) => {
    if (e.key !== "#") return;
    if (assetGenUI.isTypingTarget(document.activeElement)) return;
    e.preventDefault();
    if (assetGenUI.visible) {
        assetGenUI.hide();
        return;
    }
    const hovered = assetGenUI.resolveHoveredEntry();
    if (hovered) {
        assetGenUI.focusEntry(hovered);
        return;
    }
    assetGenUI.show();
}, true);
