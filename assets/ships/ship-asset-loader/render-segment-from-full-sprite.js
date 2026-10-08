"use strict";

import { ShipAssetLoader } from './core.js';

// ShipAssetLoader methods, split from ship-asset-loader.js.
extendClass(ShipAssetLoader, {
    /** True when Ship Render is VOXEL (shared combat / preview lattice). */
    isVoxelStyle() {
        const g = Number(this.globalVoxelCell);
        if (Number.isFinite(g) && g > 0) return true;
        return typeof uiAppearanceManager !== 'undefined'
            && String(uiAppearanceManager.shipRenderStyle || '').toUpperCase() === 'VOXEL';
    },

    renderSegmentFromFullSprite(ctx, shipModel, seg, x, y, w, h, colorOverlay, overlayIntensity) {
        const rawUv = seg.uv || (typeof shipLoadoutManager !== 'undefined'
            && shipLoadoutManager.segmentUv
            && shipLoadoutManager.segmentUv[
                seg.id === 'wingLeft' || seg.id === 'wingRight' ? 'wing' : seg.id
            ]);
        // fullUv: draw the authored crop as-is (whole-sprite enemies).
        const uv = seg.fullUv ? seg.uv : this.getEdgeCropForSegment(seg, rawUv);
        if (!uv) return false;

        const voxel = this.isVoxelStyle();
        const spriteName = this.getSpriteNameForShip(shipModel);
        const png = !voxel && spriteName
            && typeof spriteLoader !== 'undefined'
            && spriteLoader.getSprite
            && spriteLoader.getSprite(spriteName);

        if (png) {
            const srcW = png.width;
            const srcH = png.height;
            let sx = Math.floor(uv.x * srcW);
            let sy = Math.floor(uv.y * srcH);
            let sw = Math.max(1, Math.floor(uv.w * srcW));
            let sh = Math.max(1, Math.floor(uv.h * srcH));
            // Stretch the authored crop into the full segment frame so scaled
            // wings/body never leave empty cells inside their bounds.
            const drawW = Math.max(1, Math.round(w));
            const drawH = Math.max(1, Math.round(h));
            const drawX = Math.round(x);
            const drawY = Math.round(y);
            ctx.save();
            ctx.imageSmoothingEnabled = false;
            if (seg.mirror) {
                ctx.translate(drawX + drawW, drawY);
                ctx.scale(-1, 1);
                ctx.drawImage(png, sx, sy, sw, sh, 0, 0, drawW, drawH);
            } else {
                ctx.drawImage(png, sx, sy, sw, sh, drawX, drawY, drawW, drawH);
            }
            // Apply grayscale tint overlay if needed
            if (colorOverlay && overlayIntensity > 0 && typeof spriteLoader.renderSprite === 'function') {
                // Soft overlay pass via destination-in is complex; skip — hull tint applied globally elsewhere
            }
            ctx.restore();
            return true;
        }

        // Pixel-grid crop
        let sprite = shipModel.sprite;
        if (!sprite || !sprite.length || !sprite[0]) return false;
        let cols = sprite[0].length;
        let rows = sprite.length;
        let c0 = Math.floor(uv.x * cols);
        let r0 = Math.floor(uv.y * rows);
        let cw = Math.max(1, Math.floor(uv.w * cols));
        let rh = Math.max(1, Math.floor(uv.h * rows));
        const d = this.getDeviceScale();
        // VOXEL: keep authored pixels as hard NN blocks on the shared lattice —
        // Scale2x rounds diagonals into a softer, more "filtered" look.
        if (!voxel && d > 1) {
            let passes = 0;
            while (passes < 3 && (w * d) / (cw * Math.pow(2, passes + 1)) >= 2) passes++;
            if (passes > 0) {
                const crop = [];
                for (let r = 0; r < rh; r++) {
                    const src = sprite[r0 + r] || [];
                    const line = [];
                    for (let c = 0; c < cw; c++) line.push(src[c0 + c] || 0);
                    crop.push(line);
                }
                sprite = this.scale2xGridCached(shipModel.sprite, `${c0},${r0},${cw},${rh}`, crop, passes);
                c0 = 0;
                r0 = 0;
                cw = sprite[0].length;
                rh = sprite.length;
            }
        }
        const colors = shipModel.colors || {};
        const resolve = (color) => {
            if (!color || color === 'transparent') return color;
            if (typeof color === 'string' && color.indexOf('var(') === 0) {
                const match = color.match(/var\(\s*(--[^),\s]+)/);
                if (match) {
                    const value = getComputedStyle(document.documentElement).getPropertyValue(match[1]).trim();
                    if (value) return value;
                }
                return '#888888';
            }
            return color;
        };
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        if (seg.mirror) {
            ctx.translate(x + w, y);
            ctx.scale(-1, 1);
            x = 0;
            y = 0;
        }
        if (voxel) {
            // One hard square per lattice step — same idea as FLAT pixels, just larger.
            const cell = this.shipVoxelCellAt(shipModel, 1);
            const originX = this.snapToVoxelLattice(x, cell, 'x');
            const originY = this.snapToVoxelLattice(y, cell, 'y');
            const gridCols = Math.max(1, Math.round(w / cell));
            const gridRows = Math.max(1, Math.round(h / cell));
            for (let row = 0; row < gridRows; row++) {
                const srcR = r0 + Math.min(rh - 1, Math.floor((row + 0.5) * rh / gridRows));
                const srcRow = sprite[srcR];
                if (!srcRow) continue;
                for (let col = 0; col < gridCols; col++) {
                    const srcC = c0 + Math.min(cw - 1, Math.floor((col + 0.5) * cw / gridCols));
                    const pixel = srcRow[srcC];
                    if (!pixel) continue;
                    let fill = resolve(colors[pixel] || '#888888');
                    fill = this.tintPixelColor(fill, colorOverlay, overlayIntensity);
                    this.fillVoxelCell(ctx, originX + col * cell, originY + row * cell, cell, cell, fill);
                }
            }
        } else {
            const snap = (v) => Math.floor(v * d) / d;
            for (let r = 0; r < rh; r++) {
                const row = sprite[r0 + r];
                if (!row) continue;
                const top = snap(y + (r * h) / rh);
                const bottom = snap(y + ((r + 1) * h) / rh);
                for (let c = 0; c < cw; c++) {
                    const pixel = row[c0 + c];
                    if (!pixel) continue;
                    let fill = resolve(colors[pixel] || '#888888');
                    fill = this.tintPixelColor(fill, colorOverlay, overlayIntensity);
                    ctx.fillStyle = fill;
                    const left = snap(x + (c * w) / cw);
                    const right = snap(x + ((c + 1) * w) / cw);
                    ctx.fillRect(left, top, Math.max(1 / d, right - left), Math.max(1 / d, bottom - top));
                }
            }
        }
        ctx.restore();
        return true;
    },

    /**
     * Scale2x (EPX) on an indexed pixel grid, `passes` times. Doubles the
     * resolution while rounding diagonal edges instead of repeating blocks.
     */
    scale2xGrid(grid, passes) {
        let g = grid;
        for (let p = 0; p < passes; p++) {
            const rows = g.length;
            const cols = g[0].length;
            const out = Array.from({ length: rows * 2 }, () => new Array(cols * 2).fill(0));
            const at = (r, c) => (r < 0 || c < 0 || r >= rows || c >= cols) ? g[Math.max(0, Math.min(rows - 1, r))][Math.max(0, Math.min(cols - 1, c))] : g[r][c];
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const P = g[r][c];
                    const A = at(r - 1, c);
                    const B = at(r, c + 1);
                    const C = at(r, c - 1);
                    const D = at(r + 1, c);
                    out[r * 2][c * 2] = (C === A && C !== D && A !== B) ? A : P;
                    out[r * 2][c * 2 + 1] = (A === B && A !== C && B !== D) ? B : P;
                    out[r * 2 + 1][c * 2] = (D === C && D !== B && C !== A) ? C : P;
                    out[r * 2 + 1][c * 2 + 1] = (B === D && B !== A && D !== C) ? D : P;
                }
            }
            g = out;
        }
        return g;
    },

    /** scale2xGrid cached per source sprite + crop + pass count. */
    scale2xGridCached(source, cropKey, crop, passes) {
        if (!this._scale2xCache) this._scale2xCache = new WeakMap();
        let bySprite = this._scale2xCache.get(source);
        if (!bySprite) {
            bySprite = new Map();
            this._scale2xCache.set(source, bySprite);
        }
        const key = cropKey + '|' + passes;
        if (!bySprite.has(key)) bySprite.set(key, this.scale2xGrid(crop, passes));
        return bySprite.get(key);
    },

    /** Indexed palette for a hull part: 0 transparent, 1 edge, 2 hull, 3 accent. */
    buildHullPartPalette(colorOverlay, overlayIntensity, factionStyle) {
        const edgeBase = factionStyle ? factionStyle.edge : '#1e221c';
        const hullBase = factionStyle ? factionStyle.hull : '#5a6350';
        const accentBase = factionStyle ? factionStyle.accent : '#a8b090';
        return {
            0: 'transparent',
            1: this.applyHullOverlayHex(edgeBase, colorOverlay, overlayIntensity, 0),
            2: this.applyHullOverlayHex(hullBase, colorOverlay, overlayIntensity, 0),
            3: this.applyHullOverlayHex(accentBase, colorOverlay, overlayIntensity, 8),
            // Two extra hull tones carry the faction plating pattern. Without
            // them a part's interior is a single flat fill.
            4: this.applyHullOverlayHex(hullBase, colorOverlay, overlayIntensity, -26),
            5: this.applyHullOverlayHex(hullBase, colorOverlay, overlayIntensity, 22),
            // Accent shade / light: accent blocks (cockpit, engines, trim)
            // get a lit top, shaded sides and bands instead of a flat fill.
            6: this.applyHullOverlayHex(accentBase, colorOverlay, overlayIntensity, -30),
            7: this.applyHullOverlayHex(accentBase, colorOverlay, overlayIntensity, 30)
        };
    },

    /**
     * Stamp a faction's surface plating into a part's interior. Only hull
     * cells are touched, so the silhouette and its outline survive, and it
     * runs before each part's own accent marks so those stay on top.
     */
    applyFactionPlating(g, silhouette, seedIndex = 0, flipX = false, symmetric = false) {
        const rows = g.length;
        const cols = rows ? g[0].length : 0;
        if (rows < 3 || cols < 3) return;
        this.applyFactionPlatingPattern(g, silhouette, seedIndex, flipX);
        // VOXEL: keep hard flat colour blocks (no rim/panel soft-volume shading).
        if (!this.isVoxelStyle()) {
            this.applySurfaceDetail(g, seedIndex, flipX, symmetric);
        }
    },

    /**
     * Breaks up flat hull fills after the faction pattern: a lit top rim and
     * shaded bottom rim per column (volume), panels a shade lighter / darker
     * (so big or scaled-up parts don't read as one flat plate), and sparse
     * vent dots on larger parts. Deterministic per part; `symmetric` parts
     * (nose, core, aft) hash mirrored columns so they stay left/right
     * symmetric, and flipX mirrors a left wing onto the right one.
     */
    /** Clear every cell outside `mask` (true = keep). */
    clipGridToMask(g, mask) {
        for (let r = 0; r < g.length; r++) {
            for (let c = 0; c < g[r].length; c++) {
                if (!(mask[r] && mask[r][c])) g[r][c] = 0;
            }
        }
    },

    applySurfaceDetail(g, seedIndex = 0, flipX = false, symmetric = false) {
        const rows = g.length;
        const cols = rows ? g[0].length : 0;
        if (rows < 5 || cols < 5) return;
        const hull = (v) => v === 2 || v === 4 || v === 5;
        const solid = (r, c) => r >= 0 && r < rows && c >= 0 && c < cols && g[r][c] !== 0 && g[r][c] !== 1;
        const colKey = (cc) => {
            const c = flipX ? cols - 1 - cc : cc;
            return symmetric ? Math.min(c, cols - 1 - c) : c;
        };
        const hash = (a, b, k) => (Math.imul((a * 73856093) ^ (b * 19349663) ^ ((seedIndex + k) * 83492791), 2654435761) >>> 0) % 100;
        // Panels: about a quarter / a fifth of the part, at least 3 voxels.
        const pw = Math.max(3, Math.round(cols / 4));
        const ph = Math.max(3, Math.round(rows / 5));
        const out = g.map((row) => row.slice());
        for (let r = 0; r < rows; r++) {
            for (let cc = 0; cc < cols; cc++) {
                if (!hull(g[r][cc])) continue;
                const kc = colKey(cc);
                // Rim light / shade: first hull voxel under the top edge,
                // last one above the bottom edge.
                if (!solid(r - 1, cc)) { out[r][cc] = 5; continue; }
                if (!solid(r + 1, cc)) { out[r][cc] = 4; continue; }
                // Only plain hull gets panel tints; the faction pattern stays.
                if (g[r][cc] !== 2) continue;
                const px = Math.floor(kc / pw);
                const py = Math.floor(r / ph);
                const tone = hash(px, py, 1);
                if (tone < 22) out[r][cc] = 5;
                else if (tone < 38) out[r][cc] = 4;
                // Vents / rivets: a sparse dark voxel inside a panel, only on
                // parts big enough that it reads as detail, not noise.
                if (cols >= 10 && rows >= 10 && kc % pw === 1 && r % ph === 1 && hash(px, py, 2) < 35
                    && solid(r - 1, cc) && solid(r + 1, cc)) {
                    out[r][cc] = 1;
                }
            }
        }
        for (let r = 0; r < rows; r++) g[r] = out[r];
    },

    /**
     * Shade accent blocks (value 3) in a finished part grid: lit top row,
     * shaded bottom row and side columns, and a darker band every third row
     * inside tall blocks. Left/right are treated alike, so symmetric parts
     * stay symmetric. Returns a new grid; needs palette entries 6 and 7.
     */
    shadeAccentBlocks(g) {
        const rows = g.length;
        const cols = rows ? g[0].length : 0;
        const acc = (r, c) => r >= 0 && r < rows && c >= 0 && c < cols && g[r][c] === 3;
        const out = g.map((row) => row.slice());
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (g[r][c] !== 3) continue;
                // Block extent through this voxel (too small → leave flat).
                let up = 0; while (acc(r - up - 1, c)) up++;
                let dn = 0; while (acc(r + dn + 1, c)) dn++;
                let lf = 0; while (acc(r, c - lf - 1)) lf++;
                let rt = 0; while (acc(r, c + rt + 1)) rt++;
                const h = up + dn + 1;
                const w = lf + rt + 1;
                if (h < 2 || w < 2) continue;
                if (up === 0) out[r][c] = 7;
                else if (dn === 0) out[r][c] = 6;
                else if (w >= 4 && (lf === 0 || rt === 0)) out[r][c] = 6;
                else if (h >= 5 && up % 3 === 0) out[r][c] = 6;
            }
        }
        return out;
    },

    applyFactionPlatingPattern(g, silhouette, seedIndex = 0, flipX = false) {
        const rows = g.length;
        const cols = rows ? g[0].length : 0;
        for (let r = 0; r < rows; r++) {
            for (let cc = 0; cc < cols; cc++) {
                if (g[r][cc] !== 2) continue;
                // flipX runs the pattern mirrored, so a left wing is the exact
                // mirror image of the right one.
                const c = flipX ? cols - 1 - cc : cc;
                // Sparse panel seams only: full-coverage patterns made the
                // faction read as a texture instead of by its shape.
                if (silhouette === 'modular') {
                    // Rectangular plates: a seam every 4 rows, staggered joints.
                    if (r % 4 === 3) g[r][cc] = 4;
                    else if ((c + Math.floor(r / 4) * 3) % 7 === 0) g[r][cc] = 4;
                } else if (silhouette === 'spikes') {
                    // Single swept seam lines along the blade.
                    if ((c + r + seedIndex) % 7 === 0) g[r][cc] = 4;
                } else if (silhouette === 'rings') {
                    // Thin shell lines around the part's centre.
                    const dy = (r - rows / 2) / Math.max(1, rows / 2);
                    const dx = (c - cols / 2) / Math.max(1, cols / 2);
                    const d = Math.sqrt(dx * dx + dy * dy) * 3;
                    if (d % 1 < 0.22 && d > 0.8) g[r][cc] = 4;
                } else if (silhouette === 'scrap') {
                    // A few mismatched welded panels.
                    const block = Math.floor(r / 3) * 31 + Math.floor(c / 4) * 17 + seedIndex * 7;
                    const h = (Math.imul(block, 2654435761) >>> 0) % 9;
                    if (h === 0) g[r][cc] = 4;
                    else if (h === 1) g[r][cc] = 5;
                } else if (silhouette === 'circuit') {
                    // A few bright traces with right-angle turns.
                    if (c % 6 === 2 && r % 8 < 5) g[r][cc] = 5;
                    else if (r % 8 === 5 && c % 6 >= 2 && c % 6 <= 4) g[r][cc] = 5;
                }
            }
        }
    },

    /**
     * Target on-screen size (actual device px) of one hull-part "pixel" cell.
     * Deriving it from the segment's already-scaled on-screen w/h keeps every
     * part's cell size pinned to this same constant regardless of zoom or how
     * big that particular part is — uniform across the whole ship — and it
     * recomputes (more/fewer cells) every render call as parts are scaled or
     * moved, since it always reads the current w/h.
     */
    /**
     * Copy the left half of a grid onto the right, mirrored, so parts that
     * sit on the ship's centre line (nose, core, aft) are symmetric.
     */
    mirrorGridLeftToRight(g) {
        for (let r = 0; r < g.length; r++) {
            const row = g[r];
            const cols = row.length;
            for (let c = 0; c < Math.floor(cols / 2); c++) row[cols - 1 - c] = row[c];
        }
        return g;
    },

    get HULL_PIXEL_CELL_PX() {
        // Fixed default cell (no longer shrunk per smallest part, so it has
        // to be fine on its own — 4 read far too coarse).
        return 2;
    },

    /**
     * Ship-wide voxel size in pixels. The default size (factor 1) is the
     * target cell, independent of part sizes so resizing a part never changes
     * the resolution. voxelScale is a plain size factor on that default:
     * 2 = voxels twice as big, 0.5 = half. It used to divide the target
     * before the cap, so for most ships the slider changed nothing.
     */
    shipVoxelCell(shipModel, scale) {
        // Hangar zoom magnifies an image voxelised at the fit scale; at any
        // other scale report that same grid, proportionally, so hit tests
        // and handles line up with what is shown.
        const refInfo = this._voxelRef;
        const ref = refInfo && refInfo.model === shipModel ? refInfo.scale : 0;
        if (ref && scale && Math.abs(scale - ref) > 0.001) {
            return this.shipVoxelCellAt(shipModel, ref) * scale / ref;
        }
        return this.shipVoxelCellAt(shipModel, scale);
    },

    shipVoxelCellAt(shipModel, scale) {
        // Playfield VOXEL mode: one absolute cell for every ship/module so the
        // lattice matches terrain / obstacles / debris.
        let global = Number(this.globalVoxelCell);
        // The hangar bay sizes voxels from the ship's own voxel slider, not
        // from the playfield's shared lattice.
        const hangarRef = this._voxelRef;
        const inHangar = !!(hangarRef && hangarRef.model === shipModel);
        if (inHangar) global = NaN;
        if (!inHangar && !(Number.isFinite(global) && global > 0)
            && typeof window !== 'undefined' && window.combatVoxels && window.combatVoxels.cell) {
            const shared = Number(window.combatVoxels.cell());
            if (Number.isFinite(shared) && shared > 0) global = shared;
        }
        if (!inHangar && !(Number.isFinite(global) && global > 0)) {
            const fromWin = Number(typeof window !== 'undefined' ? window.PLAYFIELD_VOXEL_CELL : NaN);
            if (Number.isFinite(fromWin) && fromWin > 0
                && typeof uiAppearanceManager !== 'undefined'
                && String(uiAppearanceManager.shipRenderStyle || '').toUpperCase() === 'VOXEL') {
                global = fromWin;
            }
        }
        if (Number.isFinite(global) && global > 0) {
            const d = this.getDeviceScale();
            return Math.max(1 / d, Math.round(global * d) / d);
        }
        const layout = shipModel && shipModel.layout;
        const loadout = layout && layout.loadout;
        const zoom = Math.max(0.25, Number(scale) || 1);
        const factor = Math.max(0.2, Math.min(1.5, Number(loadout && loadout.voxelScale) || 0.5));
        // Voxel size depends only on zoom and the ship's voxel setting — not
        // on part sizes. Deriving it from the smallest part made the whole
        // ship's resolution jump whenever one part was resized.
        // deviceScale: backing pixels per logical unit (supersampled
        // playfield); voxelDetail < 1 packs more voxels into a ship. Both
        // default to 1, so hangar and editors are unchanged.
        const d = this.getDeviceScale();
        const detail = Math.max(0.25, Math.min(1, Number(this.voxelDetail) || 1));
        return Math.max(1, Math.round(this.HULL_PIXEL_CELL_PX * zoom * factor * detail * d)) / d;
    },

    getDeviceScale() {
        const d = Number(this.deviceScale);
        return Number.isFinite(d) && d >= 1 ? d : 1;
    },

    /** Round to the nearest whole backing pixel (logical units). */
    devicePx(v) {
        const d = this.getDeviceScale();
        return Math.round(v * d) / d;
    },

    hullPartResolution(w, h, voxelScale = 1, pixelZoom = 1) {
        // One whole-pixel voxel size for the entire ship: every part (and the
        // wing bridges) is drawn with this exact cell, so voxels never differ
        // in size between nose, body, wings and joints.
        const d = this.getDeviceScale();
        const cell = this._shipVoxelCell || Math.max(1, Math.round(this.HULL_PIXEL_CELL_PX
            * Math.max(0.25, Number(pixelZoom) || 1)
            * Math.max(0.2, Math.min(1.5, Number(voxelScale) || 0.5)) * d)) / d;
        return {
            resW: Math.max(6, Math.round(w / cell)),
            resH: Math.max(6, Math.round(h / cell)),
            cell: cell
        };
    },

    /**
     * Row width with the same parity as the grid, so a centred row has equal
     * margins on both sides instead of leaning one voxel to a side.
     */
    evenSpan(cols, width) {
        if ((cols - width) % 2 === 0) return width;
        return width < cols ? width + 1 : width - 1;
    },

    blankGrid(cols, rows) {
        return Array.from({ length: rows }, () => new Array(cols).fill(0));
    },

    gridFillRect(g, c0, r0, cw, rh, val) {
        const rows = g.length;
        const cols = g[0].length;
        const r1 = Math.min(rows, Math.round(r0 + rh));
        const c1 = Math.min(cols, Math.round(c0 + cw));
        for (let r = Math.max(0, Math.round(r0)); r < r1; r++) {
            for (let c = Math.max(0, Math.round(c0)); c < c1; c++) {
                g[r][c] = val;
            }
        }
    },

    /**
     * Turns any filled (index 2) cell that touches an empty neighbor into an
     * edge (index 1) cell — a cheap, shape-agnostic way to give every part a
     * dark outline (like real pixel-art sprites) without hand-authoring one
     * per shape.
     */
    outlineGridEdges(g, openSide = null) {
        const rows = g.length;
        const cols = g[0].length;
        const src = g.map((row) => row.slice());
        // openSide ('left' | 'right'): that grid border continues into
        // another part (a wing's root), so it gets no outline there.
        const pastLeft = openSide === 'left' ? 2 : 0;
        const pastRight = openSide === 'right' ? 2 : 0;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (src[r][c] !== 2) continue;
                const up = r > 0 ? src[r - 1][c] : 0;
                const down = r < rows - 1 ? src[r + 1][c] : 0;
                const leftN = c > 0 ? src[r][c - 1] : pastLeft;
                const rightN = c < cols - 1 ? src[r][c + 1] : pastRight;
                if (!up || !down || !leftN || !rightN) g[r][c] = 1;
            }
        }
    },

    /**
     * Each hull part (wing/nose/aft/core) is its own procedural pixel-index
     * grid, built fresh from its live on-screen w/h every render call — the
     * faction silhouette id bends the shape so each faction reads distinct.
     * Drawn with drawPixelGridHull (plain axis-aligned fillRect per cell),
     * never a vector path or an image-scaled bitmap, so it's never blurred
     * or anti-aliased — a real pixel-art sprite, not a stretched drawing.
     */
    renderProceduralWing(
        ctx, seg, x, y, w, h, colorOverlay, overlayIntensity, factionStyle, shapeSeed,
        variantOverride = null, crop = null, rotation = 0, voxelScale = 1, pixelZoom = 1
    ) {
        const { resW, resH, cell } = this.hullPartResolution(w, h, voxelScale, pixelZoom);
        let shapeVariant;
        if (variantOverride != null) {
            shapeVariant = variantOverride;
        } else {
            shapeVariant = this.defaultWingVariant(shapeSeed, factionStyle);
        }
        const grid = this.buildWingGrid(seg, resW, resH, factionStyle, shapeVariant);
        this.applyWingCrop(grid, seg, crop);
        const colors = this.buildHullPartPalette(colorOverlay, overlayIntensity, factionStyle);
        const angle = Math.max(-180, Math.min(180, Number(rotation) || 0)) * Math.PI / 180;
        if (Math.abs(angle) < 0.001) {
            this.drawPixelGridHull(ctx, grid, colors, x, y, w, h, cell);
        } else {
            // A wing swings from where it meets the hull, not from its own
            // middle, so the root stays put and only the span sweeps.
            const bounds = this.litBounds(grid);
            let pivotX = null;
            let pivotY = null;
            if (bounds) {
                const size = cell;
                const originX = this.snapToVoxelLattice(x + (w - grid[0].length * size) * 0.5, size, 'x');
                const originY = this.snapToVoxelLattice(y + (h - grid.length * size) * 0.5, size, 'y');
                const isLeft = seg.id === 'wingLeft';
                pivotX = originX + (isLeft ? bounds.x1 : bounds.x0) * size;
                pivotY = originY + (bounds.y0 + bounds.y1) * 0.5 * size;
            }
            this.drawRotatedVoxelGrid(
                ctx, grid, colors, x, y, w, h,
                angle * (seg.id === 'wingLeft' ? -1 : 1),
                pivotX, pivotY, cell
            );
        }
    },
});
