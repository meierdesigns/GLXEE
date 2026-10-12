"use strict";

// SpriteLoader methods, split from sprite-loader.js.
extendClass(SpriteLoader, {
    whenLoaded(timeoutMs = 8000) {
        if (this.loaded) return Promise.resolve(true);
        return new Promise((resolve) => {
            let done = false;
            const finish = (ok) => {
                if (done) return;
                done = true;
                window.removeEventListener('vf-sprites-loaded', onLoaded);
                clearTimeout(timer);
                resolve(ok);
            };
            const onLoaded = () => finish(true);
            const timer = setTimeout(() => finish(this.loaded), timeoutMs);
            window.addEventListener('vf-sprites-loaded', onLoaded);
        });
    },

    // Get sprite by name
    getSprite(name) {
        return this.sprites.get(name);
    },

    // Render sprite to canvas
    renderSprite(ctx, spriteName, x, y, width, height, colorOverlay = null, overlayIntensity = 0) {
        const sprite = this.getSprite(spriteName);
        if (!sprite) {
            console.warn(`Sprite not found: ${spriteName}`);
            return false;
        }

        // Save current context state
        ctx.save();
        // Canvas image scaling becomes visibly soft when any edge lands on a
        // fractional device pixel. Keep pixel-art destinations on integers.
        x = Math.round(x);
        y = Math.round(y);
        width = Math.max(1, Math.round(width));
        height = Math.max(1, Math.round(height));

        // Ensure transparency is preserved
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1.0;
        ctx.imageSmoothingEnabled = false;

        // Debug: Log sprite rendering

        // Apply color overlay only to non-transparent areas
        if (colorOverlay && overlayIntensity > 0 && /^#[0-9a-fA-F]{6}$/.test(colorOverlay)) {
            // Create a temporary canvas to apply color overlay with alpha masking
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            tempCanvas.width = width;
            tempCanvas.height = height;
            tempCtx.imageSmoothingEnabled = false;

            // Draw the sprite to temp canvas
            tempCtx.drawImage(sprite, 0, 0, width, height);

            // Get image data to check alpha values
            const imageData = tempCtx.getImageData(0, 0, width, height);
            const data = imageData.data;
            const or = parseInt(colorOverlay.slice(1, 3), 16);
            const og = parseInt(colorOverlay.slice(3, 5), 16);
            const ob = parseInt(colorOverlay.slice(5, 7), 16);

            // Lift dark pixels, then tint — keeps hulls readable on dark playfields
            const lift = 32;
            const scale = (255 - lift) / 255;
            for (let i = 0; i < data.length; i += 4) {
                const alpha = data[i + 3];
                if (alpha > 0) {
                    let r = lift + data[i] * scale;
                    let g = lift + data[i + 1] * scale;
                    let b = lift + data[i + 2] * scale;
                    r = r + (or - 128) * overlayIntensity;
                    g = g + (og - 128) * overlayIntensity;
                    b = b + (ob - 128) * overlayIntensity;
                    data[i] = Math.max(0, Math.min(255, Math.round(r)));
                    data[i + 1] = Math.max(0, Math.min(255, Math.round(g)));
                    data[i + 2] = Math.max(0, Math.min(255, Math.round(b)));
                }
            }

            // Put modified image data back
            tempCtx.putImageData(imageData, 0, 0);

            // Draw the modified sprite to the main canvas
            ctx.drawImage(tempCanvas, x, y);
        } else {
            // Draw the sprite normally if no color overlay
            ctx.drawImage(sprite, x, y, width, height);
        }

        // Restore context state
        ctx.restore();

        return true;
    },

    // Render sprite with scaling
    renderSpriteScaled(ctx, spriteName, x, y, scale, colorOverlay = null, overlayIntensity = 0) {
        const sprite = this.getSprite(spriteName);
        if (!sprite) {
            console.warn(`Sprite not found: ${spriteName}`);
            return false;
        }

        const width = sprite.width * scale;
        const height = sprite.height * scale;

        return this.renderSprite(ctx, spriteName, x, y, width, height, colorOverlay, overlayIntensity);
    },

    // Check if sprites are loaded
    isLoaded() {
        return this.loaded;
    },

    // Get all loaded sprite names
    getLoadedSprites() {
        return Array.from(this.sprites.keys());
    },

    // Get sprites by category
    getSpritesByCategory(category) {
        return Array.from(this.sprites.keys()).filter(name => name.startsWith(category));
    },

    // Get player ship sprites
    getPlayerShipSprites() {
        return this.getSpritesByCategory('player-');
    },

    // Get enemy ship sprites
    getEnemyShipSprites() {
        return this.getSpritesByCategory('enemy-');
    },

    // Get weapon sprites
    getWeaponSprites() {
        return Array.from(this.sprites.keys()).filter(name =>
            name.includes('laser') || name.includes('rapid-fire') ||
            name.includes('spread-shot') || name.includes('plasma') ||
            name.includes('missile') || name.includes('cannon') ||
            name.includes('torpedo') || name.includes('beam') ||
            name.includes('bomb') || name.includes('burst') ||
            name.includes('breaker')
        );
    },

    // Get level sprites
    getLevelSprites() {
        return Array.from(this.sprites.keys()).filter(name =>
            name.startsWith('mars-') || name.startsWith('jupiter-') ||
            name.startsWith('saturn-') || name.startsWith('neptune-') ||
            name.startsWith('pluto-')
        );
    },
});
