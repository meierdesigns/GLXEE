"use strict";

import { ShipAssetLoader } from './ship-asset-loader/core.js';
import './ship-asset-loader/render-ship-as-segments.js';
import './ship-asset-loader/resolve-segment-sprite-key.js';
import './ship-asset-loader/render-hull-segments.js';
import './ship-asset-loader/render-fallback-segmented-hull.js';
import './ship-asset-loader/render-segment-from-full-sprite.js';
import './ship-asset-loader/lit-bounds.js';
import './ship-asset-loader/build-wing-grid.js';
import './ship-asset-loader/build-center-grid.js';
import './ship-asset-loader/resolve-hull-shape-seed.js';
import './ship-asset-loader/render-ship-module.js';
import './ship-asset-loader/get-sprite-name-for-ship.js';

// Create global instance
const shipAssetLoader = new ShipAssetLoader();

// Export for use in other modules
export { shipAssetLoader };
