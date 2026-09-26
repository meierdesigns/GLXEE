"use strict";

import { ShipAssetLoader } from './ship-asset-loader/core.js';
import './ship-asset-loader/render-ship-as-segments.js?v=voxel-raster-23';
import './ship-asset-loader/resolve-segment-sprite-key.js?v=voxel-raster-23';
import './ship-asset-loader/render-hull-segments.js?v=voxel-raster-23';
import './ship-asset-loader/render-fallback-segmented-hull.js?v=voxel-raster-23';
import './ship-asset-loader/render-segment-from-full-sprite.js?v=voxel-raster-23';
import './ship-asset-loader/lit-bounds.js?v=voxel-raster-23';
import './ship-asset-loader/build-wing-grid.js?v=voxel-raster-23';
import './ship-asset-loader/build-center-grid.js?v=voxel-raster-23';
import './ship-asset-loader/resolve-hull-shape-seed.js?v=voxel-raster-23';
import './ship-asset-loader/render-ship-module.js?v=voxel-raster-23';
import './ship-asset-loader/get-sprite-name-for-ship.js?v=voxel-raster-23';

// Create global instance
const shipAssetLoader = new ShipAssetLoader();

// Export for use in other modules
export { shipAssetLoader };
