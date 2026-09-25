"use strict";

// FactionShipStyles methods, split from faction-ship-styles.js.
extendClass(FactionShipStyles, {
    buildAllPixelSprites() {
        this.factions.forEach((f) => {
            this.classes.forEach((c) => {
                const key = this.spriteKey(f, c);
                this.pixelCache[key] = this.buildPixelSprite(f, c);
            });
        });
    },

    getPixelSprite(faction, enemyClass) {
        const key = this.spriteKey(faction, enemyClass);
        if (!this.pixelCache[key]) {
            this.pixelCache[key] = this.buildPixelSprite(faction, enemyClass);
        }
        return this.pixelCache[key];
    },

    hasPng(spriteKey) {
        return !!(typeof spriteLoader !== 'undefined'
            && spriteLoader.getSprite
            && spriteLoader.getSprite(spriteKey));
    },

    resolveEnemyMeta(opts) {
        const o = opts || {};
        let faction = o.faction;
        let enemyClass = o.enemyClass;
        const typeId = o.typeId || o.type;
        if (typeof planetConfigManager !== 'undefined' && planetConfigManager.taxonomyForType && typeId) {
            const tax = planetConfigManager.taxonomyForType(typeId);
            if (!faction) faction = tax.faction;
            if (!enemyClass) enemyClass = tax.enemyClass;
        }
        if (!faction && typeof enemyConfigManager !== 'undefined' && typeId) {
            faction = enemyConfigManager.getDefaultFaction
                ? enemyConfigManager.getDefaultFaction(typeId)
                : 'pirate';
        }
        return {
            faction: this.normalizeFaction(faction),
            enemyClass: this.normalizeClass(enemyClass),
            tier: this.resolveTier({
                tier: o.tier,
                level: o.level,
                enemyClass: enemyClass
            })
        };
    },

    /**
     * @returns {{
     *   faction: string, enemyClass: string, tier: number,
     *   spriteKey: string, hasPng: boolean,
     *   scaleMul: number, decor: object, model: object
     * }}
     */
    resolveFactionShipVisual(opts) {
        const meta = this.resolveEnemyMeta(opts);
        const key = this.spriteKey(meta.faction, meta.enemyClass);
        const hasPng = this.hasPng(key);
        const style = this.getFactionStyle(meta.faction);
        const colors = this.buildFactionColors(meta.faction);
        const themeColors = {
            edge: colors[1],
            hull: colors[2],
            accent: colors[3]
        };
        const sprite = this.getPixelSprite(meta.faction, meta.enemyClass);
        const scaleMul = this.scaleMulForTier(meta.tier);
        // Asset resolution (16/32/64) is for crisp sprites; display size is playfield px.
        const resolution = this.resolutionForClass(meta.enemyClass);
        const display = this.displaySizeForClass(meta.enemyClass);
        const model = {
            name: String(meta.faction).toUpperCase() + ' ' + String(meta.enemyClass).toUpperCase(),
            type: 'enemy',
            modelClass: meta.enemyClass === 'scout' ? 'scout'
                : (meta.enemyClass === 'capital' ? 'battleship'
                    : (meta.enemyClass === 'heavy' ? 'cruiser' : 'fighter')),
            faction: meta.faction,
            enemyClass: meta.enemyClass,
            tier: meta.tier,
            factionSpriteKey: key,
            weakenOverlay: true,
            forceEnemyOrientation: true,
            assetResolution: resolution,
            width: display.width,
            height: display.height,
            sprite: sprite,
            colors: colors,
            engineGlow: this.buildEngineGlow(meta.faction, meta.enemyClass, meta.tier)
        };
        return {
            faction: meta.faction,
            enemyClass: meta.enemyClass,
            tier: meta.tier,
            spriteKey: key,
            hasPng: hasPng,
            scaleMul: scaleMul,
            decor: {
                stripes: meta.tier,
                accent: themeColors.accent,
                edge: themeColors.edge,
                hull: themeColors.hull
            },
            model: model,
            style: style
        };
    },

    /** Draw tier rank marks near the ship after hull render. */
    drawTierDecor(ctx, enemy, visual, scale) {
        if (!ctx || !enemy || !visual || !visual.decor) return;
        const n = Math.max(0, Math.min(5, visual.decor.stripes || 0));
        if (n <= 0) return;
        const s = scale || 1;
        const x = enemy.x + enemy.width * 0.5;
        const y = enemy.y + enemy.height + 2 * s;
        ctx.save();
        ctx.globalAlpha = 0.85;
        for (let i = 0; i < n; i++) {
            ctx.fillStyle = i % 2 === 0 ? visual.decor.accent : visual.decor.edge;
            ctx.fillRect(x - n * 2 + i * 4, y, 3, 2);
        }
        ctx.restore();
    },

    listFactionShipSpriteKeys() {
        const keys = [];
        this.factions.forEach((f) => {
            this.classes.forEach((c) => keys.push(this.spriteKey(f, c)));
        });
        return keys;
    },

    listEmblemKeys() {
        return this.factions.map((f) => this.emblemKey(f));
    },

    buildShipPrompt(faction, enemyClass) {
        const style = this.getFactionStyle(faction);
        return 'top-down enemy spaceship, monochrome hull in ' + (style.hull || '#808080')
            + ' with light and dark shading of the same hue, '
            + 'faction color identity, no multicolor rainbow palette, '
            + 'identity by mirrored silhouette topology, '
            + style.prompt + ', '
            + this.classFormPrompt(enemyClass)
            + ', render at ' + this.resolutionForClass(enemyClass) + 'x'
            + this.resolutionForClass(enemyClass) + ' pixel resolution, '
            + 'do not differentiate by adding tips or nubs, hostile silhouette, crisp pixels';
    },

    buildEmblemPrompt(faction) {
        const style = this.getFactionStyle(faction);
        const meta = (typeof planetConfigManager !== 'undefined' && planetConfigManager.getFactionMeta)
            ? planetConfigManager.getFactionMeta(faction)
            : { label: String(faction).toUpperCase() };
        return 'faction emblem icon, ' + (meta.label || faction) + ', '
            + style.silhouette + ' motif, tinted ' + (style.hull || '#808080')
            + ', simple glyph, 16x16 pixel feel, game UI icon';
    },
});
