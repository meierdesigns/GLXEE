"use strict";

// EnemyManager methods, split from enemies.js.
extendClass(EnemyManager, {
    /**
     * Match renderEnemyShip footprint: faction visual size × drawScale × tier scaleMul,
     * then tighten AABB + attach sprite mask for pixel-accurate hits.
     */
    resolveEnemyHitProfile(opts) {
        const o = opts || {};
        const drawScale = o.drawScale != null ? o.drawScale : 1;
        let model = null;
        let scaleMul = 1;
        if (typeof factionShipStyles !== 'undefined' && factionShipStyles.resolveFactionShipVisual) {
            const visual = factionShipStyles.resolveFactionShipVisual({
                faction: o.faction,
                enemyClass: o.enemyClass,
                tier: o.tier,
                level: o.level,
                typeId: o.type || o.typeId,
                width: o.width,
                height: o.height
            });
            if (visual && visual.model) {
                model = visual.model;
                scaleMul = visual.scaleMul != null ? visual.scaleMul : 1;
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
                width: Math.max(6, Math.round(16 * drawScale)),
                height: Math.max(6, Math.round(12 * drawScale)),
                sprite: null,
                colors: null,
                collision: null
            };
        }
        let fullScale = drawScale * scaleMul;
        // Hard cap: no enemy wider than 1.5× the player footprint (28px).
        const maxW = 28 * 1.5 * drawScale;
        if ((model.width || 16) * fullScale > maxW) fullScale = maxW / (model.width || 16);
        const drawW = Math.max(4, (model.width || 16) * fullScale);
        const drawH = Math.max(4, (model.height || 12) * fullScale);
        const sprite = model.sprite || null;
        const colors = model.colors || null;
        // Hit mask from the actually rendered ship (voxel segments / PNG crops,
        // vertical enemy flip) — falls back to the logical sprite grid.
        const baked = this.bakeEnemyHitMask(model);
        const maskSprite = baked || sprite;
        let insetL = 0;
        let insetT = 0;
        let insetR = 0;
        let insetB = 0;
        if (maskSprite && maskSprite.length && maskSprite[0] && maskSprite[0].length) {
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
            if (maxC >= minC && maxR >= minR) {
                const pw = drawW / cols;
                const ph = drawH / rows;
                insetL = minC * pw;
                insetT = minR * ph;
                insetR = (cols - 1 - maxC) * pw;
                insetB = (rows - 1 - maxR) * ph;
            }
        }
        return {
            width: Math.max(4, Math.round(drawW)),
            height: Math.max(4, Math.round(drawH)),
            sprite: sprite,
            colors: colors,
            collision: {
                sprite: maskSprite,
                colors: colors,
                drawW: drawW,
                drawH: drawH,
                insetL: insetL,
                insetT: insetT,
                insetR: insetR,
                insetB: insetB
            }
        };
    },

    /**
     * Render the model once offscreen (the same renderShip path the game
     * uses) and turn its alpha into a boolean grid. Cached per visual; not
     * cached while sprites are still loading (empty render).
     */
    bakeEnemyHitMask(model) {
        if (!model || typeof document === 'undefined') return null;
        const loader = typeof graphicsManager !== 'undefined' && graphicsManager.shipAssetLoader;
        if (!loader || !loader.isLoaded || !loader.isLoaded() || !loader.renderShip) return null;
        const key = [model.factionSpriteKey || model.name || model.id, model.width, model.height].join('|');
        this._hitMaskCache = this._hitMaskCache || Object.create(null);
        if (this._hitMaskCache[key]) return this._hitMaskCache[key];
        const k = 3; // sub-pixel resolution of the mask
        const mw = Math.max(1, Math.round(model.width || 16));
        const mh = Math.max(1, Math.round(model.height || 12));
        const cols = mw * k;
        const rows = mh * k;
        try {
            const c = document.createElement('canvas');
            c.width = cols;
            c.height = rows;
            const ctx = c.getContext('2d', { willReadFrequently: true });
            loader.renderShip(ctx, model, 0, 0, k, null, 0, {});
            const data = ctx.getImageData(0, 0, cols, rows).data;
            const grid = [];
            let solid = 0;
            for (let r = 0; r < rows; r++) {
                const row = new Array(cols);
                for (let q = 0; q < cols; q++) {
                    const on = data[(r * cols + q) * 4 + 3] > 110 ? 1 : 0;
                    row[q] = on;
                    solid += on;
                }
                grid.push(row);
            }
            if (solid < 4) return null; // art not loaded yet — retry next spawn
            this._hitMaskCache[key] = grid;
            return grid;
        } catch (e) {
            return null;
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
        entity.width = Math.max(4, Math.round(profile.width * contentScale));
        entity.height = Math.max(4, Math.round(profile.height * contentScale));
        entity.sprite = profile.sprite;
        entity.colors = profile.colors;
        entity.collision = this.scaleEnemyCollision(profile.collision, contentScale);
        return entity;
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
            cheats: (typeof game !== 'undefined' && game.cheats) || {}
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
            levelInfoManager.showEventAnnounce(text, { accent: accent, holdMs: warnMs + 400 });
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
        return spawned;
    },
});
