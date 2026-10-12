"use strict";

// ParallaxManager methods, split from parallax.js.
extendClass(ParallaxManager, {
    drawCustomTile(ctx, layer, def) {
        if (!def || !def.cells) return;
        const tw = def.width;
        const th = def.height;
        const cell = def.cellSize || 4;
        const tilePxW = tw * cell;
        const tilePxH = th * cell;
        const ox = ((this.horizontalOffset * 0.1) % tilePxW + tilePxW) % tilePxW;
        const oy = ((layer.y || 0) % tilePxH + tilePxH) % tilePxH;

        for (let ty = -tilePxH; ty < 600 + tilePxH; ty += tilePxH) {
            for (let tx = -tilePxW; tx < 400 + tilePxW; tx += tilePxW) {
                for (let cy = 0; cy < th; cy++) {
                    for (let cx = 0; cx < tw; cx++) {
                        if (!def.cells[cy * tw + cx]) continue;
                        ctx.fillRect(
                            Math.floor(tx + cx * cell - ox),
                            Math.floor(ty + cy * cell - oy),
                            cell,
                            cell
                        );
                    }
                }
            }
        }
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
        const cols = Math.ceil(w / gridSize) + 2;
        const rows = Math.ceil(h / gridSize) + 2;
        for (let i = -2; i < cols; i++) {
            for (let j = -2; j < rows; j++) {
                if (((i + j) & 1) !== 0) continue;
                ctx.fillRect(Math.round(i * gridSize + ox), Math.round(j * gridSize + oy), dot, dot);
            }
        }
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

    updateFlyingStars(deltaTime) {
        this.starSpawnTimer += deltaTime;

        // Spawn new stars
        if (this.starSpawnTimer >= this.starSpawnInterval) {
            this.spawnFlyingStar();
            this.starSpawnTimer = 0;
        }

        // Update existing stars
        for (let i = this.flyingStars.length - 1; i >= 0; i--) {
            const star = this.flyingStars[i];
            star.x += star.speedX;
            star.y += star.speedY;

            // Remove stars that are off screen
            if (star.x < -10 || star.x > 410 || star.y < -10 || star.y > 610) {
                this.flyingStars.splice(i, 1);
            }
        }
    },

    spawnFlyingStar() {
        const star = {
            x: Math.floor(Math.random() * 400),
            y: Math.floor(Math.random() * 600),
            speedX: (Math.random() - 0.5) * 2,
            speedY: (Math.random() - 0.5) * 2,
            size: Math.floor(Math.random() * 2 + 1)
        };
        this.flyingStars.push(star);
    },

    drawFlyingStars(ctx) {
        ctx.save();
        ctx.globalAlpha = this.starsOpacity != null ? this.starsOpacity : 0.35;
        const starColor = getComputedStyle(document.documentElement).getPropertyValue('--env-primary').trim() || '#808080';
        ctx.fillStyle = starColor;
        this.flyingStars.forEach(star => {
            ctx.fillRect(Math.floor(star.x), Math.floor(star.y), Math.floor(star.size), Math.floor(star.size));
        });
        ctx.restore();
    },

    // Planet-specific drawing methods
    drawMarsSurface(ctx, layer) {
        for (let x = 0; x < 400; x += 8) {
            for (let y = 0; y < 600; y += 8) {
                if ((Math.floor(x / 8) + Math.floor(y / 8)) % 3 === 0) {
                    ctx.fillRect(Math.floor(x), Math.floor(y + layer.y) % 600, 6, 6);
                }
            }
        }
    },

    drawMarsDust(ctx, layer) {
        for (let x = 0; x < 400; x += 12) {
            for (let y = 0; y < 600; y += 12) {
                if ((Math.floor(x / 12) + Math.floor(y / 12)) % 4 === 0) {
                    ctx.fillRect(Math.floor(x), Math.floor(y + layer.y) % 600, 4, 4);
                }
            }
        }
    },

    drawMarsSky(ctx, layer) {
        for (let x = 0; x < 400; x += 16) {
            const y = Math.floor((x * 0.1 + layer.y) % 600);
            ctx.fillRect(x, y, 4, 4);
        }
    },

    drawJupiterBands(ctx, layer) {
        for (let y = 0; y < 600; y += 20) {
            const x = Math.floor((y * 0.05 + layer.y) % 400);
            ctx.fillRect(x, Math.floor(y + layer.y) % 600, 6, 4);
        }
    },

    drawJupiterStorms(ctx, layer) {
        for (let x = 0; x < 400; x += 16) {
            for (let y = 0; y < 600; y += 16) {
                if ((Math.floor(x / 16) + Math.floor(y / 16)) % 5 === 0) {
                    ctx.fillRect(Math.floor(x), Math.floor(y + layer.y) % 600, 8, 8);
                }
            }
        }
    },

    drawJupiterAtmosphere(ctx, layer) {
        for (let x = 0; x < 400; x += 12) {
            const y = Math.floor((x * 0.2 + layer.y) % 600);
            ctx.fillRect(x, y, 4, 4);
        }
    },

    drawSaturnRings(ctx, layer) {
        for (let y = 0; y < 600; y += 15) {
            const x = Math.floor((y * 0.1 + layer.y) % 400);
            ctx.fillRect(x, Math.floor(y + layer.y) % 600, 4, 4);
        }
    },

    drawSaturnClouds(ctx, layer) {
        for (let x = 0; x < 400; x += 14) {
            for (let y = 0; y < 600; y += 14) {
                if ((Math.floor(x / 14) + Math.floor(y / 14)) % 6 === 0) {
                    ctx.fillRect(Math.floor(x), Math.floor(y + layer.y) % 600, 6, 6);
                }
            }
        }
    },

    drawSaturnSky(ctx, layer) {
        for (let x = 0; x < 400; x += 8) {
            const y = Math.floor((x * 0.15 + layer.y) % 600);
            ctx.fillRect(x, y, 4, 4);
        }
    },

    drawNeptuneDeep(ctx, layer) {
        for (let x = 0; x < 400; x += 6) {
            for (let y = 0; y < 600; y += 6) {
                if ((Math.floor(x / 6) + Math.floor(y / 6)) % 7 === 0) {
                    ctx.fillRect(Math.floor(x), Math.floor(y + layer.y) % 600, 4, 4);
                }
            }
        }
    },

    drawNeptuneStorms(ctx, layer) {
        for (let x = 0; x < 400; x += 18) {
            for (let y = 0; y < 600; y += 18) {
                if ((Math.floor(x / 18) + Math.floor(y / 18)) % 8 === 0) {
                    ctx.fillRect(Math.floor(x), Math.floor(y + layer.y) % 600, 6, 6);
                }
            }
        }
    },

    drawNeptuneIce(ctx, layer) {
        for (let x = 0; x < 400; x += 10) {
            const y = Math.floor((x * 0.3 + layer.y) % 600);
            ctx.fillRect(x, y, 4, 4);
        }
    },

    reset() {
        this.layers.forEach(layer => {
            layer.y = 0;
        });
        this.horizontalOffset = 0;
        this.flyingStars = [];
        this.starSpawnTimer = 0;
    },
});
