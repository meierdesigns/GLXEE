"use strict";

// ParallaxManager methods, split from parallax.js.
extendClass(ParallaxManager, {
    /** One offscreen tile blit — same pixels as nested fillRect loops. */
    bakePatternTile(key, tw, th, paint) {
        if (!this._patternBake) this._patternBake = Object.create(null);
        let entry = this._patternBake[key];
        if (entry && entry.w === tw && entry.h === th) return entry;
        const c = document.createElement('canvas');
        c.width = Math.max(1, tw);
        c.height = Math.max(1, th);
        const x = c.getContext('2d');
        if (!x) return null;
        x.imageSmoothingEnabled = false;
        paint(x);
        entry = { canvas: c, w: tw, h: th };
        const keys = Object.keys(this._patternBake);
        if (keys.length > 48) {
            for (let i = 0; i < 12; i++) delete this._patternBake[keys[i]];
        }
        this._patternBake[key] = entry;
        return entry;
    },

    /** Draw baked tile across the field. `scrollX/Y` are subtracted (custom-tile convention). */
    blitTiled(ctx, tile, scrollX, scrollY, fieldW, fieldH) {
        if (!tile) return;
        const tw = tile.w;
        const th = tile.h;
        for (let ty = -th; ty < fieldH + th; ty += th) {
            for (let tx = -tw; tx < fieldW + tw; tx += tw) {
                ctx.drawImage(tile.canvas, Math.floor(tx - scrollX), Math.floor(ty - scrollY));
            }
        }
    },

    drawCustomTile(ctx, layer, def) {
        if (!def || !def.cells) return;
        const tw = def.width;
        const th = def.height;
        const cell = def.cellSize || 4;
        const tilePxW = tw * cell;
        const tilePxH = th * cell;
        const ox = ((this.horizontalOffset * 0.1) % tilePxW + tilePxW) % tilePxW;
        const oy = ((layer.y || 0) % tilePxH + tilePxH) % tilePxH;
        const color = ctx.fillStyle || layer.color || '#808080';
        const key = 'ct:' + (def.id || layer.pattern || 'x') + ':' + tilePxW + 'x' + tilePxH + ':' + color + ':' + cell;
        const bake = this.bakePatternTile(key, tilePxW, tilePxH, (x) => {
            x.fillStyle = color;
            for (let cy = 0; cy < th; cy++) {
                for (let cx = 0; cx < tw; cx++) {
                    if (!def.cells[cy * tw + cx]) continue;
                    x.fillRect(cx * cell, cy * cell, cell, cell);
                }
            }
        });
        const fieldW = (ctx.canvas && ctx.canvas.width) || 400;
        const fieldH = (ctx.canvas && ctx.canvas.height) || 600;
        this.blitTiled(ctx, bake, ox, oy, fieldW, fieldH);
    },

    drawGrid(ctx, layer, index) {
        // Checker parity comes from the cell's own index, not from its
        // scrolled position — the old version flipped the checker every time
        // a cell crossed a 16 px boundary, so the dots jumped while scrolling.
        // The period is two cells, so wrapping the offset at 2*gridSize is seamless.
        // Depth by layer: slow (far) layers get a fine, small-dot grid, faster
        // (near) ones a wider grid with bigger dots — stacked grid layers used
        // to be identical in size and overlapped into a muddled pattern.
        const depth = Math.max(0, Math.min(3, Math.round((Number(layer.speed) || 0.2) / 0.2) - 1 + (index || 0) % 2));
        const gridSize = [12, 20, 28, 36][depth];
        const dot = [2, 3, 4, 5][depth];
        const period = gridSize * 2;
        const w = (ctx.canvas && ctx.canvas.width) || 400;
        const h = (ctx.canvas && ctx.canvas.height) || 600;
        const ox = (((this.horizontalOffset * 0.1) % period) + period) % period;
        const oy = (((layer.y || 0) % period) + period) % period;
        const color = ctx.fillStyle || layer.color || '#808080';
        const key = 'grid:' + gridSize + ':' + dot + ':' + color;
        const bake = this.bakePatternTile(key, period, period, (x) => {
            x.fillStyle = color;
            const cols = Math.ceil(period / gridSize) + 1;
            const rows = Math.ceil(period / gridSize) + 1;
            for (let i = 0; i < cols; i++) {
                for (let j = 0; j < rows; j++) {
                    if (((i + j) & 1) !== 0) continue;
                    x.fillRect(i * gridSize, j * gridSize, dot, dot);
                }
            }
        });
        this.blitTiled(ctx, bake, -ox, -oy, w, h);
    },

    drawDots(ctx, layer) {
        const dots = [
            {x: 40, y: 80},
            {x: 120, y: 160},
            {x: 200, y: 240},
            {x: 280, y: 320},
            {x: 360, y: 400},
            {x: 80, y: 480},
            {x: 160, y: 560}
        ];

        const ox = ((this.horizontalOffset * 0.2) % 400 + 400) % 400;
        const oy = ((layer.y || 0) % 600 + 600) % 600;
        dots.forEach(dot => {
            // Draw neighbouring tiles as well so a wrap never exposes a
            // one-frame gap or makes the pattern appear to jump.
            for (let tx = -1; tx <= 1; tx++) {
                for (let ty = -1; ty <= 1; ty++) {
                    const x = dot.x + ox + tx * 400;
                    const y = dot.y + oy + ty * 600;
                    if (x < -5 || x > 405 || y < -5 || y > 605) continue;
                    ctx.fillRect(Math.floor(x), Math.floor(y), 5, 5);
                }
            }
        });
    },

    drawLines(ctx, layer) {
        const lines = [
            {x: 0, y: 100, width: 400, height: 4},
            {x: 0, y: 300, width: 400, height: 4},
            {x: 0, y: 500, width: 400, height: 4}
        ];

        lines.forEach(line => {
            const y = (line.y + layer.y) % 600;
            ctx.fillRect(line.x, Math.floor(y), line.width, line.height);
        });
    },

    darkenColor(color, factor) {
        // Simple color darkening
        const hex = color.replace('#', '');
        const r = Math.floor(parseInt(hex.substr(0, 2), 16) * (1 - factor));
        const g = Math.floor(parseInt(hex.substr(2, 2), 16) * (1 - factor));
        const b = Math.floor(parseInt(hex.substr(4, 2), 16) * (1 - factor));
        return `rgb(${r}, ${g}, ${b})`;
    },

    /** Fills the field immediately so a fresh stage never opens on empty space. */
    seedFlyingStars(count) {
        this.flyingStars = [];
        if (!this._starFieldW || !this._starFieldH) {
            // No render() yet this session (fresh load) — read the real canvas once
            // so the very first seed isn't scattered across the old 400x600 default.
            const cv = (typeof document !== 'undefined') && document.getElementById('gameCanvas');
            if (cv && cv.width && cv.height) {
                this._starFieldW = cv.width;
                this._starFieldH = cv.height;
            }
        }
        const n = count != null ? count : 70;
        for (let i = 0; i < n; i++) this.spawnFlyingStar(true);
    },

    updateFlyingStars(deltaTime) {
        this.starSpawnTimer += deltaTime;

        // Spawn new stars, several at a time — a trickle of one every couple
        // seconds reads as empty space instead of a starfield. Capped so a
        // star that happens to drift at ~0 speed can't make this unbounded.
        const maxStars = 140;
        while (this.starSpawnTimer >= this.starSpawnInterval) {
            if (this.flyingStars.length < maxStars) this.spawnFlyingStar();
            this.starSpawnTimer -= this.starSpawnInterval;
        }

        // Update existing stars
        const list = this.flyingStars;
        const fw = this._starFieldW || 400;
        const fh = this._starFieldH || 600;
        for (let i = list.length - 1; i >= 0; i--) {
            const star = list[i];
            star.x += star.speedX;
            star.y += star.speedY;
            if (star.x < -10 || star.x > fw + 10 || star.y < -10 || star.y > fh + 10) {
                const last = list.length - 1;
                if (i !== last) list[i] = list[last];
                list.pop();
            }
        }
    },

    /** `fromEdge` false (initial seed) scatters across the whole field instead of spawning at the rim. */
    spawnFlyingStar(seeding) {
        // Depth: smaller/dimmer stars drift slower (far background), bigger/brighter ones faster (near).
        const depth = Math.random();
        const size = depth < 0.6 ? 1 : (depth < 0.9 ? 2 : 3);
        const speedScale = 0.3 + depth * 1.4;
        const star = {
            x: Math.floor(Math.random() * (this._starFieldW || 400)),
            y: Math.floor(Math.random() * (this._starFieldH || 600)),
            speedX: (Math.random() - 0.5) * 2 * speedScale,
            speedY: (Math.random() - 0.5) * 2 * speedScale,
            size: size,
            alpha: 0.5 + depth * 0.5
        };
        this.flyingStars.push(star);
        return star;
    },

    drawFlyingStars(ctx) {
        const stars = this.flyingStars;
        if (!stars || !stars.length) return;
        ctx.save();
        const baseOpacity = this.starsOpacity != null ? this.starsOpacity : 0.35;
        ctx.fillStyle = this.envVar('--env-primary') || '#808080';
        for (let i = 0; i < stars.length; i++) {
            const star = stars[i];
            ctx.globalAlpha = Math.max(0, Math.min(1, baseOpacity * (star.alpha != null ? star.alpha : 1)));
            ctx.fillRect(star.x | 0, star.y | 0, star.size | 0, star.size | 0);
        }
        ctx.restore();
    },

    /**
     * Bake a 400×600 planet plate once; scroll with the same wrap as
     * `fillRect(..., (y + layer.y) % 600)` — identical pixels, one blit.
     */
    drawWrappedYField(ctx, layer, bakeKey, paint) {
        const color = String(ctx.fillStyle || layer.color || '#808080');
        const bake = this.bakePatternTile(bakeKey + ':' + color, 400, 600, (x) => {
            x.fillStyle = color;
            paint(x);
        });
        if (!bake) return;
        const oy = ((layer.y || 0) % 600 + 600) % 600;
        // Shift plate down by oy (wrap): matches (y + layer.y) % 600 placement.
        ctx.drawImage(bake.canvas, 0, oy);
        if (oy) ctx.drawImage(bake.canvas, 0, oy - 600);
    },

    // Planet-specific drawing methods
    drawMarsSurface(ctx, layer) {
        this.drawWrappedYField(ctx, layer, 'mars_surface', (x) => {
            for (let px = 0; px < 400; px += 8) {
                for (let py = 0; py < 600; py += 8) {
                    if (((px / 8) + (py / 8)) % 3 === 0) x.fillRect(px, py, 6, 6);
                }
            }
        });
    },

    drawMarsDust(ctx, layer) {
        this.drawWrappedYField(ctx, layer, 'mars_dust', (x) => {
            for (let px = 0; px < 400; px += 12) {
                for (let py = 0; py < 600; py += 12) {
                    if (((px / 12) + (py / 12)) % 4 === 0) x.fillRect(px, py, 4, 4);
                }
            }
        });
    },

    drawMarsSky(ctx, layer) {
        this.drawWrappedYField(ctx, layer, 'mars_sky', (x) => {
            for (let px = 0; px < 400; px += 16) {
                x.fillRect(px, Math.floor((px * 0.1) % 600), 4, 4);
            }
        });
    },

    drawJupiterBands(ctx, layer) {
        // x and y both phase with layer.y — keep the light O(30) loop (not a Y-only wrap).
        for (let y = 0; y < 600; y += 20) {
            const x = Math.floor((y * 0.05 + layer.y) % 400);
            ctx.fillRect(x, Math.floor(y + layer.y) % 600, 6, 4);
        }
    },

    drawJupiterStorms(ctx, layer) {
        this.drawWrappedYField(ctx, layer, 'jupiter_storms', (x) => {
            for (let px = 0; px < 400; px += 16) {
                for (let py = 0; py < 600; py += 16) {
                    if (((px / 16) + (py / 16)) % 5 === 0) x.fillRect(px, py, 8, 8);
                }
            }
        });
    },

    drawJupiterAtmosphere(ctx, layer) {
        this.drawWrappedYField(ctx, layer, 'jupiter_atmosphere', (x) => {
            for (let px = 0; px < 400; px += 12) {
                x.fillRect(px, Math.floor((px * 0.2) % 600), 4, 4);
            }
        });
    },

    drawSaturnRings(ctx, layer) {
        for (let y = 0; y < 600; y += 15) {
            const x = Math.floor((y * 0.1 + layer.y) % 400);
            ctx.fillRect(x, Math.floor(y + layer.y) % 600, 4, 4);
        }
    },

    drawSaturnClouds(ctx, layer) {
        this.drawWrappedYField(ctx, layer, 'saturn_clouds', (x) => {
            for (let px = 0; px < 400; px += 14) {
                for (let py = 0; py < 600; py += 14) {
                    if (((px / 14) + (py / 14)) % 6 === 0) x.fillRect(px, py, 6, 6);
                }
            }
        });
    },

    drawSaturnSky(ctx, layer) {
        this.drawWrappedYField(ctx, layer, 'saturn_sky', (x) => {
            for (let px = 0; px < 400; px += 8) {
                x.fillRect(px, Math.floor((px * 0.15) % 600), 4, 4);
            }
        });
    },

    drawNeptuneDeep(ctx, layer) {
        this.drawWrappedYField(ctx, layer, 'neptune_deep', (x) => {
            for (let px = 0; px < 400; px += 6) {
                for (let py = 0; py < 600; py += 6) {
                    if (((px / 6) + (py / 6)) % 7 === 0) x.fillRect(px, py, 4, 4);
                }
            }
        });
    },

    drawNeptuneStorms(ctx, layer) {
        this.drawWrappedYField(ctx, layer, 'neptune_storms', (x) => {
            for (let px = 0; px < 400; px += 18) {
                for (let py = 0; py < 600; py += 18) {
                    if (((px / 18) + (py / 18)) % 8 === 0) x.fillRect(px, py, 6, 6);
                }
            }
        });
    },

    drawNeptuneIce(ctx, layer) {
        this.drawWrappedYField(ctx, layer, 'neptune_ice', (x) => {
            for (let px = 0; px < 400; px += 10) {
                x.fillRect(px, Math.floor((px * 0.3) % 600), 4, 4);
            }
        });
    },

    reset() {
        this.layers.forEach(layer => {
            layer.y = 0;
        });
        this.horizontalOffset = 0;
        this.starSpawnTimer = 0;
        this.seedFlyingStars();
    },
});
