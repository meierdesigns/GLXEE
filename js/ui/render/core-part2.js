"use strict";

// RenderManager members, continued from core.js (kept under ~500 lines per file).
extendClass(RenderManager, {
    /**
     * Solid (non-fog) obstacles for one canyon depth:
     * 'under' = behind walls, 'over' = in front (default).
     */
    drawSolidObstacles(ctx, fogList, player, depth) {
        if (typeof obstacleManager === 'undefined' || !obstacleManager.getObstacles) return;
        const wantUnder = depth === 'under';
        obstacleManager.getObstacles().forEach((obstacle) => {
            if (!obstacle || obstacle.isFog) return;
            const under = obstacle.wallDepth === 'under';
            if (wantUnder ? !under : under) return;
            if (this.isOccludedByFog(player, obstacle, fogList)) return;
            this.drawObstacleSprite(ctx, obstacle);
        });
    },
    drawObstacleSprite(ctx, obstacle) {
        if (!obstacle || typeof graphicsManager === 'undefined') return;
        if (obstacle.isCrate && obstacleManager.drawCrate) {
            obstacleManager.drawCrate(ctx, obstacle);
            return;
        }
        // Functional obstacles get their own baked look (see bakeObstacleImage).
        if (obstacle.kind === 'prism' || obstacle.kind === 'bulwark') {
            this.drawHiResObstacle(ctx, obstacle, false);
            return;
        }
        const spriteName = obstacle.sprite
            || (obstacle.isFog ? 'fog'
                : (obstacle.kind === 'crystal' || obstacle.opticalMode === 'mirror'
                    || obstacle.opticalMode === 'prism' || obstacle.opticalMode === 'kaleidoscope')
                    ? 'crystal'
                    : (obstacle.reflectsShots ? 'shield' : 'obstacle'));
        const lightingIntensity = obstacle.lightIntensity || 0;
        const lightingColor = obstacle.lightColor || 'var(--current-text-secondary)';
        const sprite = graphicsManager.getSprite(spriteName)
            || graphicsManager.getSprite(obstacle.reflectsShots ? 'shield' : 'obstacle');
        const alpha = obstacle.opacity != null ? obstacle.opacity : 1;
        ctx.save();
        if (alpha < 1) ctx.globalAlpha = alpha;
        const isCrystal = spriteName === 'crystal' || obstacle.kind === 'crystal'
            || obstacle.opticalMode === 'mirror' || obstacle.opticalMode === 'prism'
            || obstacle.opticalMode === 'kaleidoscope';
        if (obstacle.isFog) {
            this.drawAnimatedFog(ctx, obstacle);
        } else if (!isCrystal) {
            // Every solid obstacle (incl. planet-specific sprite names) gets
            // the same hi-res look so nothing renders as chunky pixels.
            this.drawHiResObstacle(ctx, obstacle,
                obstacle.kind === 'shield' || !!obstacle.reflectsShots || spriteName === 'shield');
        } else if (sprite && spriteName !== 'crystal') {
            graphicsManager.drawSprite(
                ctx, sprite,
                obstacle.x, obstacle.y, obstacle.width, obstacle.height,
                lightingIntensity, lightingColor
            );
        } else if (spriteName === 'crystal' || obstacle.kind === 'crystal'
            || obstacle.opticalMode === 'mirror' || obstacle.opticalMode === 'prism'
            || obstacle.opticalMode === 'kaleidoscope') {
            this.drawCrystalObstacle(ctx, obstacle);
        } else if (sprite) {
            graphicsManager.drawSprite(
                ctx, sprite,
                obstacle.x, obstacle.y, obstacle.width, obstacle.height,
                lightingIntensity, lightingColor
            );
        }
        ctx.restore();
    },
    /**
     * Asteroids and shield plates as pixel art on a finer grid than the old
     * 6×8 sprites (OBSTACLE_ART_DENSITY art pixels per logical pixel). Each
     * obstacle bakes its own shape once; it is drawn unrotated and snapped to
     * the art grid so every pixel stays axis-aligned and equally sized.
     */
    drawHiResObstacle(ctx, obstacle, isShield) {
        let img = obstacle._hiRes;
        if (!img || img._w !== obstacle.width || img._h !== obstacle.height) {
            img = this.bakeObstacleImage(obstacle, isShield);
            obstacle._hiRes = img;
        }
        // Snap to combat lattice in VOXEL; whole px otherwise.
        const cell = this.getCombatVoxelCell();
        let x = obstacle.x;
        let y = obstacle.y;
        let dw = obstacle.width;
        let dh = obstacle.height;
        if (cell) {
            x = Math.round(x / cell) * cell;
            y = Math.round(y / cell) * cell;
            dw = Math.max(cell, Math.round(dw / cell) * cell);
            dh = Math.max(cell, Math.round(dh / cell) * cell);
        } else {
            x = Math.round(x);
            y = Math.round(y);
        }
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, x, y, dw, dh);
        const li = obstacle.lightIntensity || 0;
        if (li > 0) {
            // Bullet light tints the rock's own pixels.
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = Math.min(0.6, li * 0.45);
            ctx.drawImage(this.tintedObstacleImage(img, this.resolveCss(obstacle.lightColor, '#88ffcc')),
                x, y, dw, dh);
        }
        ctx.restore();
    },
    tintedObstacleImage(img, color) {
        if (img._tint && img._tintColor === color) return img._tint;
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const x = c.getContext('2d');
        x.drawImage(img, 0, 0);
        x.globalCompositeOperation = 'source-in';
        x.fillStyle = color;
        x.fillRect(0, 0, c.width, c.height);
        img._tint = c;
        img._tintColor = color;
        return c;
    },
    /** Lighten (amt > 0) or darken (amt < 0) a hex/rgb colour. */
    shadeColor(color, amt) {
        let r = 128, g = 128, b = 128;
        const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(color).trim());
        if (hex) {
            let v = hex[1];
            if (v.length === 3) v = v.split('').map((ch) => ch + ch).join('');
            r = parseInt(v.slice(0, 2), 16);
            g = parseInt(v.slice(2, 4), 16);
            b = parseInt(v.slice(4, 6), 16);
        } else {
            const m = String(color).match(/(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
            if (m) { r = +m[1]; g = +m[2]; b = +m[3]; }
        }
        const t = amt < 0 ? 0 : 255;
        const p = Math.abs(amt);
        const f = (v) => Math.round(v + (t - v) * p);
        return 'rgb(' + f(r) + ',' + f(g) + ',' + f(b) + ')';
    },
});
