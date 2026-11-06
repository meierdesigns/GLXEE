"use strict";

// EnemyManager methods, split from enemies.js.
extendClass(EnemyManager, {
    /**
     * Match renderEnemyShip footprint: faction visual size × drawScale × tier scaleMul,
     * then tighten AABB + attach sprite mask for pixel-accurate hits.
     */
    resolveEnemyHitProfile(opts) {
        const o = opts || {};
        // Footprint = displaySizeForClass (includes SIZES / sizePx) × drawScale × tier.
        const drawScale = (o.drawScale != null ? o.drawScale : 1);
        let model = null;
        let scaleMul = 1;
        let enemyClass = o.enemyClass;
        if (typeof factionShipStyles !== 'undefined' && factionShipStyles.resolveFactionShipVisual) {
            const visual = factionShipStyles.resolveFactionShipVisual({
                faction: o.faction,
                enemyClass: o.enemyClass,
                tier: o.tier,
                level: o.level,
                typeId: o.type || o.typeId,
                width: o.width,
                height: o.height,
                hullSeed: o.hullSeed
            });
            if (visual && visual.model) {
                model = visual.model;
                scaleMul = visual.scaleMul != null ? visual.scaleMul : 1;
                if (visual.enemyClass) enemyClass = visual.enemyClass;
            }
        }
        if (!model && typeof enemyConfigManager !== 'undefined' && enemyConfigManager.getMergedModel && o.type) {
            model = enemyConfigManager.getMergedModel(o.type);
        }
        if (!model && typeof graphicsManager !== 'undefined') {
            model = graphicsManager.currentEnemyModel;
        }
        if (!model) {
            return {
                width: Math.max(8, Math.round(28 * drawScale)),
                height: Math.max(8, Math.round(22 * drawScale)),
                sprite: null,
                colors: null,
                collision: null
            };
        }
        // Authoritative playfield size from the SIZES setting — never the raw
        // asset grid. Config fallbacks (getMergedModel) have tiny native sizes.
        let baseW = model.width || 16;
        let baseH = model.height || 12;
        if (typeof factionShipStyles !== 'undefined' && factionShipStyles.displaySizeForClass && enemyClass) {
            const display = factionShipStyles.displaySizeForClass(enemyClass);
            if (display && display.width > 0 && display.height > 0) {
                baseW = display.width;
                baseH = display.height;
            }
        }
        let fullScale = drawScale * scaleMul;
        // Soft ceiling — allow SIZES overlay values up to the slider max (200),
        // with headroom for tier mul; bosses apply their own mul afterwards.
        const maxW = 420 * Math.max(0.5, drawScale);
        if (baseW * fullScale > maxW) fullScale = maxW / baseW;
        const drawW = Math.max(6, baseW * fullScale);
        const drawH = Math.max(6, baseH * fullScale);
        // Local model footprint for hit-mask bake / render sync (do not mutate
        // shared getMergedModel instances).
        if ((model.width || 16) !== baseW || (model.height || 12) !== baseH) {
            model = Object.assign({}, model, { width: baseW, height: baseH });
        }
        const sprite = model.sprite || null;
        const colors = model.colors || null;
        // Hit mask from the actually rendered ship (voxel segments / PNG crops,
        // vertical enemy flip) — falls back to the logical sprite grid (also
        // flipped, so nose/aft match the on-screen enemy orientation).
        const baked = this.bakeEnemyHitMask(model);
        const logical = this.enemyLogicalHitMask(model);
        const maskSprite = baked || logical || sprite;
        const insets = this.computeEnemyMaskInsets(maskSprite, drawW, drawH);
        return {
            width: Math.max(4, Math.round(drawW)),
            height: Math.max(4, Math.round(drawH)),
            sprite: sprite,
            colors: colors,
            hitMaskReady: !!baked,
            collision: {
                sprite: maskSprite,
                colors: colors,
                drawW: drawW,
                drawH: drawH,
                insetL: insets.insetL,
                insetT: insets.insetT,
                insetR: insets.insetR,
                insetB: insets.insetB
            }
        };
    },

    /** Opaque AABB insets for a boolean / indexed mask grid. */
    computeEnemyMaskInsets(maskSprite, drawW, drawH) {
        const out = { insetL: 0, insetT: 0, insetR: 0, insetB: 0 };
        if (!maskSprite || !maskSprite.length || !maskSprite[0] || !maskSprite[0].length) return out;
        const rows = maskSprite.length;
        const cols = maskSprite[0].length;
        let minC = cols;
        let maxC = -1;
        let minR = rows;
        let maxR = -1;
        for (let r = 0; r < rows; r++) {
            const row = maskSprite[r];
            if (!row) continue;
            for (let c = 0; c < cols; c++) {
                if (!row[c]) continue;
                if (c < minC) minC = c;
                if (c > maxC) maxC = c;
                if (r < minR) minR = r;
                if (r > maxR) maxR = r;
            }
        }
        if (maxC < minC || maxR < minR) return out;
        const pw = drawW / cols;
        const ph = drawH / rows;
        out.insetL = minC * pw;
        out.insetT = minR * ph;
        out.insetR = (cols - 1 - maxC) * pw;
        out.insetB = (rows - 1 - maxR) * ph;
        return out;
    },

    /**
     * Authoritative indexed hull as a boolean mask, vertically flipped to match
     * enemy on-screen orientation (renderShip scale(1,-1)).
     */
    enemyLogicalHitMask(model) {
        const sprite = model && model.sprite;
        if (!sprite || !sprite.length || !sprite[0] || !sprite[0].length) return null;
        const rows = sprite.length;
        const cols = sprite[0].length;
        const flip = !(model && model.forceEnemyOrientation === false)
            && (!!(model && model.forceEnemyOrientation)
                || (model && model.type === 'enemy')
                || (typeof graphicsManager !== 'undefined'
                    && graphicsManager.shipAssetLoader
                    && graphicsManager.shipAssetLoader.isEnemyShip
                    && graphicsManager.shipAssetLoader.isEnemyShip(model)));
        const grid = new Array(rows);
        let solid = 0;
        for (let r = 0; r < rows; r++) {
            const src = sprite[flip ? (rows - 1 - r) : r] || [];
            const row = new Array(cols);
            for (let c = 0; c < cols; c++) {
                const on = src[c] ? 1 : 0;
                row[c] = on;
                solid += on;
            }
            grid[r] = row;
        }
        return solid >= 4 ? grid : null;
    },

    /** Merge two masks (OR). `extra` is nearest-neighbour sampled into `base` size. */
    unionEnemyHitMasks(base, extra) {
        if (!base || !base.length) return extra || null;
        if (!extra || !extra.length || !extra[0] || !extra[0].length) return base;
        const rows = base.length;
        const cols = (base[0] && base[0].length) || 0;
        if (!cols) return base;
        const er = extra.length;
        const ec = extra[0].length;
        for (let r = 0; r < rows; r++) {
            const row = base[r];
            if (!row) continue;
            const sr = Math.min(er - 1, Math.floor((r + 0.5) * er / rows));
            const src = extra[sr];
            if (!src) continue;
            for (let c = 0; c < cols; c++) {
                if (row[c]) continue;
                const sc = Math.min(ec - 1, Math.floor((c + 0.5) * ec / cols));
                if (src[sc]) row[c] = 1;
            }
        }
        return base;
    },

    /** Expand solid cells by 1 so soft / VOXEL edges stay hittable. */
    dilateEnemyHitMask(grid) {
        if (!grid || !grid.length || !grid[0]) return grid;
        const rows = grid.length;
        const cols = grid[0].length;
        const out = new Array(rows);
        for (let r = 0; r < rows; r++) {
            const row = new Array(cols);
            for (let c = 0; c < cols; c++) {
                let on = 0;
                for (let dr = -1; dr <= 1 && !on; dr++) {
                    const rr = r + dr;
                    if (rr < 0 || rr >= rows) continue;
                    const src = grid[rr];
                    if (!src) continue;
                    for (let dc = -1; dc <= 1; dc++) {
                        const cc = c + dc;
                        if (cc < 0 || cc >= cols) continue;
                        if (src[cc]) { on = 1; break; }
                    }
                }
                row[c] = on;
            }
            out[r] = row;
        }
        return out;
    },

    /**
     * Render the model once offscreen (the same renderShip path the game
     * uses) and turn its alpha into a boolean grid. Cached per visual; not
     * cached while sprites are still loading (empty render).
     * VOXEL lattice is disabled for the bake — shared combat cells clip the
     * offscreen canvas and punched holes in enemy hitboxes.
     */
    bakeEnemyHitMask(model) {
        if (!model || typeof document === 'undefined') return null;
        const loader = typeof graphicsManager !== 'undefined' && graphicsManager.shipAssetLoader;
        if (!loader || !loader.isLoaded || !loader.isLoaded() || !loader.renderShip) return null;
        const key = [model.factionSpriteKey || model.name || model.id, model.width, model.height, 'flat1'].join('|');
        this._hitMaskCache = this._hitMaskCache || Object.create(null);
        if (this._hitMaskCache[key]) return this._hitMaskCache[key];
        const k = 3; // sub-pixel resolution of the mask
        const mw = Math.max(1, Math.round(model.width || 16));
        const mh = Math.max(1, Math.round(model.height || 12));
        const cols = mw * k;
        const rows = mh * k;
        const prevGlobal = loader.globalVoxelCell;
        try {
            // 1px lattice for the bake: the shared combat VOXEL cell is larger
            // than this offscreen canvas step and clips wing / nose pixels.
            loader.globalVoxelCell = 1;
            const c = document.createElement('canvas');
            c.width = cols;
            c.height = rows;
            const ctx = c.getContext('2d', { willReadFrequently: true });
            loader.renderShip(ctx, model, 0, 0, k, null, 0, {
                showThrusterGlow: false,
                allowColorMountSprites: false
            });
            const data = ctx.getImageData(0, 0, cols, rows).data;
            let grid = [];
            let solid = 0;
            // Keep soft hull edges (alpha 40+) so silhouette insets match what
            // players see; a high cut made hitboxes smaller than the sprite.
            for (let r = 0; r < rows; r++) {
                const row = new Array(cols);
                for (let q = 0; q < cols; q++) {
                    const on = data[(r * cols + q) * 4 + 3] > 40 ? 1 : 0;
                    row[q] = on;
                    solid += on;
                }
                grid.push(row);
            }
            if (solid < 4) return null; // art not loaded yet — retry next spawn
            // Never drop authored hull cells the raster missed (letterbox /
            // sparse sample), then dilate one cell for edge forgiveness.
            grid = this.unionEnemyHitMasks(grid, this.enemyLogicalHitMask(model));
            grid = this.dilateEnemyHitMask(grid);
            const keys = Object.keys(this._hitMaskCache);
            if (keys.length > 48) {
                for (let i = 0; i < 16; i++) delete this._hitMaskCache[keys[i]];
            }
            this._hitMaskCache[key] = grid;
            return grid;
        } catch (e) {
            return null;
        } finally {
            loader.globalVoxelCell = prevGlobal;
        }
    },

    /** Collision mask sized to the on-screen footprint (incl. contentScale). */
    scaleEnemyCollision(collision, contentScale) {
        if (!collision || contentScale === 1) return collision;
        const out = Object.assign({}, collision);
        ['drawW', 'drawH', 'insetL', 'insetT', 'insetR', 'insetB'].forEach((f) => {
            if (out[f] != null) out[f] *= contentScale;
        });
        return out;
    },

    applyEnemyHitProfile(entity, opts) {
        if (!entity) return entity;
        const profile = this.resolveEnemyHitProfile(opts);
        const contentScale = (typeof game !== 'undefined' && game && game.contentScale != null)
            ? Math.max(0.5, Math.min(3, Number(game.contentScale) || 1))
            : 1;
        const prevW = entity.width || profile.width;
        const prevH = entity.height || profile.height;
        const cx = entity.x + prevW * 0.5;
        const cy = entity.y + prevH * 0.5;
        entity.width = Math.max(4, Math.round(profile.width * contentScale));
        entity.height = Math.max(4, Math.round(profile.height * contentScale));
        entity.x = cx - entity.width * 0.5;
        entity.y = cy - entity.height * 0.5;
        entity.sprite = profile.sprite;
        entity.colors = profile.colors;
        entity.collision = this.scaleEnemyCollision(profile.collision, contentScale);
        entity._hitMaskReady = !!profile.hitMaskReady;
        // Keep mask draw size locked to the rounded footprint so pixel tests
        // and insets share the same box the ship is rendered into.
        if (entity.collision) {
            entity.collision.drawW = entity.width;
            entity.collision.drawH = entity.height;
            entity.collision._maskTrust = null;
        }
        return entity;
    },

    /**
     * Re-bake hit masks that spawned before ship art was ready (logical
     * fallback only). Safe to call every frame — no-ops once baked.
     */
    refreshPendingEnemyHitMasks() {
        if (this.enemy && !this.exploding && this.enemy.collision && !this.enemy._hitMaskReady) {
            const wasBoss = !!this.enemy.isBoss;
            this.applyEnemyHitProfile(this.enemy, {
                faction: this.enemy.faction,
                enemyClass: this.enemy.enemyClass,
                tier: this.enemy.tier,
                level: this.enemy.level,
                type: this.enemy.type || this.currentShipType,
                hullSeed: this.enemy.hullSeed,
                drawScale: 1
            });
            // applyEnemyHitProfile resets to champion size — restore boss mul
            // only on the frame the bake finally succeeds.
            if (wasBoss && this.enemy._hitMaskReady && this.enemy.collision) {
                const mul = (typeof uiAppearanceManager !== 'undefined' && uiAppearanceManager.getBossSizeMul)
                    ? uiAppearanceManager.getBossSizeMul() : 1.6;
                const cx = this.enemy.x + this.enemy.width / 2;
                const cy = this.enemy.y + this.enemy.height / 2;
                this.enemy.width = Math.max(4, Math.round(this.enemy.width * mul));
                this.enemy.height = Math.max(4, Math.round(this.enemy.height * mul));
                this.enemy.x = cx - this.enemy.width / 2;
                this.enemy.y = cy - this.enemy.height / 2;
                this.enemy.collision = this.scaleEnemyCollision(this.enemy.collision, mul);
                this.enemy.collision.drawW = this.enemy.width;
                this.enemy.collision.drawH = this.enemy.height;
                this.enemy.collision._maskTrust = null;
            }
        }
        (this.sideEnemies || []).forEach((side) => {
            if (!side || !side.collision || side._hitMaskReady) return;
            const role = side.role || 'assault';
            const sideMul = (typeof uiAppearanceManager !== 'undefined' && uiAppearanceManager.getSideSizeMul)
                ? uiAppearanceManager.getSideSizeMul() : 1;
            const scale = (role === 'assault' || role === 'gunner' || role === 'blocker' ? 0.78 : 0.68) * sideMul;
            this.applyEnemyHitProfile(side, {
                faction: side.faction,
                enemyClass: side.enemyClass,
                tier: side.tier,
                level: side.level,
                type: side.type,
                hullSeed: side.hullSeed,
                drawScale: scale
            });
        });
    },

    /** Re-apply footprints after Enemy Size setting changes (live + sides). */
    refreshEnemySizes() {
        if (this.enemy && !this.exploding) {
            this.applyEnemyHitProfile(this.enemy, {
                faction: this.enemy.faction,
                enemyClass: this.enemy.enemyClass,
                tier: this.enemy.tier,
                level: this.enemy.level,
                type: this.enemy.type || this.currentShipType,
                drawScale: 1
            });
            // initBoss applies BOSS_SIZE_MUL (1.6) after spawn — re-apply it
            // here or live SIZES tweaks strip the boss to champion footprint.
            if (this.enemy.isBoss) {
                const mul = (typeof uiAppearanceManager !== 'undefined' && uiAppearanceManager.getBossSizeMul)
                    ? uiAppearanceManager.getBossSizeMul() : 1.6;
                const cx = this.enemy.x + this.enemy.width / 2;
                const cy = this.enemy.y + this.enemy.height / 2;
                this.enemy.width = Math.max(4, Math.round(this.enemy.width * mul));
                this.enemy.height = Math.max(4, Math.round(this.enemy.height * mul));
                this.enemy.x = cx - this.enemy.width / 2;
                this.enemy.y = cy - this.enemy.height / 2;
                if (this.enemy.collision) {
                    this.enemy.collision = this.scaleEnemyCollision(this.enemy.collision, mul);
                    this.enemy.collision.drawW = this.enemy.width;
                    this.enemy.collision.drawH = this.enemy.height;
                    this.enemy.collision._maskTrust = null;
                }
            }
        }
        (this.sideEnemies || []).forEach((side) => {
            if (!side) return;
            const role = side.role || 'assault';
            const sideMul = (typeof uiAppearanceManager !== 'undefined' && uiAppearanceManager.getSideSizeMul)
                ? uiAppearanceManager.getSideSizeMul() : 1;
            const scale = (role === 'assault' || role === 'gunner' || role === 'blocker' ? 0.78 : 0.68) * sideMul;
            side.weaponScale = scale;
            this.applyEnemyHitProfile(side, {
                faction: side.faction,
                enemyClass: side.enemyClass,
                tier: side.tier,
                level: side.level,
                type: side.type,
                hullSeed: side.hullSeed,
                drawScale: scale
            });
        });
        // Drop baked variant bitmaps so the next frame redraws at the new size.
        if (typeof graphicsManager !== 'undefined' && graphicsManager._variantCache) {
            graphicsManager._variantCache.clear();
        }
        if (this._hitMaskCache) this._hitMaskCache = Object.create(null);
    },

    roleForcesEscort(role) {
        return role === 'repair' || role === 'shieldBattery' || role === 'blocker'
            || role === 'gunner' || role === 'jammer' || role === 'tether';
    },

    resolveCombatEventsForEntry(entry) {
        if (entry && Array.isArray(entry.combatEvents) && entry.combatEvents.length) {
            return entry.combatEvents.map((ev) => Object.assign({}, ev));
        }
        const type = (entry && entry.type) || this.currentShipType;
        if (typeof enemyConfigManager !== 'undefined' && enemyConfigManager.getConfig) {
            const cfg = enemyConfigManager.getConfig(type);
            if (cfg && Array.isArray(cfg.combatEvents) && cfg.combatEvents.length) {
                return cfg.combatEvents.map((ev) => Object.assign({}, ev));
            }
        }
        return [];
    },

    beginChampionCombatEvents(entry) {
        const events = this.resolveCombatEventsForEntry(entry);
        this.activeCombatEvents = this.varyCombatEvents ? this.varyCombatEvents(events) : events;
        this.firedCombatEventIds = {};
        this.combatEventCooldowns = {};
        this.pendingCombatAnnounces = {};
        this.championCombatElapsedMs = 0;
    },

    getRuntimeGameState(gameState) {
        if (gameState && gameState.width) return gameState;
        return {
            width: (typeof game !== 'undefined' && (game.internalWidth || game.width)) || 200,
            height: (typeof game !== 'undefined' && (game.internalHeight || game.height)) || 300,
            cheats: (typeof game !== 'undefined' && game.cheatSystem && game.cheatSystem.cheats) || {}
        };
    },

    announceCombatEvent(ev) {
        if (!ev) return;
        const catalogId = (typeof combatEventConfigManager !== 'undefined')
            ? combatEventConfigManager.catalogIdForSpec(ev)
            : (ev.role || 'assault');
        const text = (typeof combatEventConfigManager !== 'undefined')
            ? combatEventConfigManager.getAnnounceText(ev)
            : ('INCOMING: ' + String(ev.role || ev.id || 'EVENT').toUpperCase());
        const accent = (typeof combatEventConfigManager !== 'undefined')
            ? (combatEventConfigManager.getConfig(catalogId).accent || '#e8c060')
            : '#e8c060';
        const warnMs = (typeof combatEventConfigManager !== 'undefined')
            ? combatEventConfigManager.getAnnounceMs(ev)
            : 1800;
        if (typeof levelInfoManager !== 'undefined' && levelInfoManager.showEventAnnounce) {
            levelInfoManager.showEventAnnounce(text, {
                accent: accent,
                holdMs: warnMs + 400,
                id: ev.id || null,
                role: ev.role || catalogId,
                catalogId: catalogId,
                type: ev.type || null
            });
        }
        if (typeof profileManager !== 'undefined' && profileManager.discover) {
            profileManager.discover('events', catalogId);
        }
        if (typeof soundManager !== 'undefined' && soundManager.playExplosion) {
            // Soft cue — reuse existing SFX without new assets
            try { soundManager.playShoot && soundManager.playShoot(); } catch (e) { /* ignore */ }
        }
        return warnMs;
    },

    evaluateCombatEvents(gameState) {
        if (!this.enemy || this.exploding || !this.activeCombatEvents.length) return;
        const state = this.getRuntimeGameState(gameState);
        const hpFrac = this.maxHealth > 0 ? (this.health / this.maxHealth) : 1;
        const shieldFrac = this.shieldMax > 0 ? (this.shield / this.shieldMax) : 1;
        const elapsedSec = this.championCombatElapsedMs / 1000;
        const now = (typeof performance !== 'undefined' && performance.now)
            ? performance.now()
            : Date.now();

        // Resolve announced events whose warn window elapsed
        const pendingIds = Object.keys(this.pendingCombatAnnounces || {});
        for (let p = 0; p < pendingIds.length; p++) {
            const pid = pendingIds[p];
            const pending = this.pendingCombatAnnounces[pid];
            if (!pending || now < pending.fireAt) continue;
            const ev = pending.ev;
            delete this.pendingCombatAnnounces[pid];
            if (!ev) continue;
            if (ev.once && this.firedCombatEventIds[ev.id]) continue;
            if (ev.action === 'summon') {
                this.spawnEventSide(ev, state);
            }
            this.firedCombatEventIds[ev.id] = true;
            this.combatEventCooldowns[ev.id] = now;
            if (!ev.once) {
                delete this.firedCombatEventIds[ev.id];
            }
        }

        for (let i = 0; i < this.activeCombatEvents.length; i++) {
            const ev = this.activeCombatEvents[i];
            if (!ev || !ev.id) continue;
            if (ev.once && this.firedCombatEventIds[ev.id]) continue;
            if (this.pendingCombatAnnounces[ev.id]) continue;
            if (ev.cooldownMs > 0 && this.combatEventCooldowns[ev.id]
                && (now - this.combatEventCooldowns[ev.id]) < ev.cooldownMs) {
                continue;
            }

            let fire = false;
            if (ev.trigger === 'hpBelow') {
                fire = hpFrac <= (ev.threshold != null ? ev.threshold : 0.35) && this.health > 0;
            } else if (ev.trigger === 'shieldBelow') {
                fire = this.shieldMax > 0
                    && shieldFrac <= (ev.threshold != null ? ev.threshold : 0.35);
            } else if (ev.trigger === 'elapsed') {
                fire = elapsedSec >= (ev.elapsedSec != null ? ev.elapsedSec : 0);
            }
            if (!fire) continue;

            const warnMs = this.announceCombatEvent(ev);
            this.pendingCombatAnnounces[ev.id] = {
                ev: ev,
                fireAt: now + (warnMs != null ? warnMs : 1800)
            };
        }
    },

    spawnEventSide(spec, gameState) {
        if (!spec || !gameState) return;
        const cluster = (this.enemy && this.enemy.cluster)
            || (this.pendingChampionEntry && this.pendingChampionEntry.cluster)
            || 'alpha';
        const role = spec.role || 'assault';
        const want = Math.max(1, Math.round(Number(spec.count) || 1));
        const type = spec.type || 'enemyBasic';
        let tax = { faction: 'pirate', enemyClass: 'assault' };
        if (typeof planetConfigManager !== 'undefined' && planetConfigManager.taxonomyForType) {
            tax = planetConfigManager.taxonomyForType(type) || tax;
        }
        const faction = (this.enemy && this.enemy.faction)
            || (this.pendingChampionEntry && this.pendingChampionEntry.faction)
            || tax.faction
            || 'pirate';
        const enemyClass = tax.enemyClass || 'assault';
        const tier = (typeof factionShipStyles !== 'undefined' && factionShipStyles.classTier)
            ? (factionShipStyles.classTier[enemyClass] || 2)
            : 1;
        const capBefore = this.sideEnemyCap;
        this.sideEnemyCap = Math.max(capBefore, this.sideEnemies.length + want);
        let spawned = 0;
        for (let n = 0; n < want; n++) {
            if (this.sideEnemies.length >= this.sideEnemyCap) break;
            const side = this.spawnScheduledNormal({
                id: 'evt_' + (spec.id || 'summon') + '_' + Date.now() + '_' + n,
                type: type,
                faction: faction,
                enemyClass: enemyClass,
                tier: tier,
                level: 1,
                champion: false,
                cluster: role === 'bomber' ? ('flyby_' + Math.floor(Math.random() * 9999)) : cluster,
                role: role,
                forceEscort: this.roleForcesEscort(role)
            }, gameState);
            if (side) spawned += 1;
        }
        this.sideEnemyCap = Math.max(capBefore, 3, this.sideEnemies.length);
        return spawned;
    },
});
