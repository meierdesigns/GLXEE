"use strict";

// ShipModels methods, split from ship-models.js.
extendClass(ShipModels, {
    // Render ship sprite to canvas with color overlay support
    renderShip(ctx, shipModel, x, y, scale = 1, colorOverlay = null, overlayIntensity = 0) {
        const sprite = shipModel.sprite;
        const colors = shipModel.colors || {};
        if (!sprite || !sprite.length) return;

        const cols = sprite[0].length;
        const rows = sprite.length;
        const destW = shipModel.width * scale;
        const destH = shipModel.height * scale;
        const pw = destW / Math.max(1, cols);
        const ph = destH / Math.max(1, rows);

        const tint = (base) => {
            if (!colorOverlay || !(overlayIntensity > 0)) return base;
            if (typeof colorPalette !== 'undefined' && colorPalette.applyColorOverlay) {
                return colorPalette.applyColorOverlay(base, colorOverlay, overlayIntensity);
            }
            return base;
        };

        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1.0;

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < sprite[row].length; col++) {
                const pixel = sprite[row][col];
                if (!pixel) continue;
                ctx.fillStyle = tint(colors[pixel] || '#888888');
                ctx.fillRect(
                    x + col * pw,
                    y + row * ph,
                    Math.ceil(pw),
                    Math.ceil(ph)
                );
            }
        }

        ctx.restore();

        if (shipModel.engineGlow) {
            this.renderEngineGlow(ctx, shipModel.engineGlow, x, y, scale, pw, ph);
        }
    },

    // Render engine glow effect
    renderEngineGlow(ctx, engineGlow, x, y, scale, cellW = null, cellH = null) {
        if (!engineGlow || !engineGlow.positions) return;
        const originalAlpha = ctx.globalAlpha;
        const cw = cellW != null ? cellW : scale;
        const ch = cellH != null ? cellH : scale;

        engineGlow.positions.forEach((pos) => {
            ctx.fillStyle = engineGlow.color;
            for (let i = 0; i < 3; i++) {
                ctx.globalAlpha = pos.intensity * (0.8 - i * 0.2);
                ctx.fillRect(
                    x + pos.x * cw - i,
                    y + pos.y * ch - i,
                    cw + i * 2,
                    ch + i * 2
                );
            }
        });

        ctx.globalAlpha = originalAlpha;
    },
});
