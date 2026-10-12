"use strict";

// AssetGenRegistry is defined in asset-gen-registry/core.js and extended by the other files in asset-gen-registry/,
// which index.html loads before this file.
const assetGenRegistry = new AssetGenRegistry();
window.AssetGenRegistry = AssetGenRegistry;
window.assetGenRegistry = assetGenRegistry;
