"use strict";

/**
 * Enemy Viewer — browse enemy types with ship icons; open Enemy Editor from here.
 * Open: Start menu → ENEMIES, Pause → ENEMIES
 */
class EnemyViewerUI {
    constructor() {
        this.visible = false;
        this.selectedIndex = 0;
        this.enemies = [];
        this.overlay = null;
        this.previewCanvas = null;
        this.previewCtx = null;
        this.previewAnimId = null;
        this.previewZoom = 1;
        this.previewFullscreen = false;
        this.previewPanX = 0;
        this.previewPanY = 0;
        this.previewPanning = false;
        this.previewPanLastX = 0;
        this.previewPanLastY = 0;
        this.previewSim = null;
        this.previewLastTs = 0;
        this._keyHandler = (e) => this.handleKeyDown(e);
        this._onAssetsReady = () => {
            if (this.visible) {
                this.renderList();
                this.renderDetail();
                this.resetPreviewSim();
            }
        };
        if (typeof window !== 'undefined') {
            window.addEventListener('vf-sprites-loaded', this._onAssetsReady);
            window.addEventListener('vf-ships-loaded', this._onAssetsReady);
        }
    }

    getEnemyList() {
        if (typeof enemyConfigManager === 'undefined') {
            return [
                { id: 'enemyBasic', name: 'BASIC', description: '', factions: ['pirate'], primaryFaction: 'pirate', maxHealth: 100, armor: 15, damage: 25, speed: 1.5, weapon: 'laser', shootInterval: 1200, verticalSpeed: 0.3, minY: 25, maxY: 100 },
                { id: 'enemyFast', name: 'FAST', description: '', factions: ['kronax'], primaryFaction: 'kronax', maxHealth: 80, armor: 8, damage: 20, speed: 2.75, weapon: 'laser', shootInterval: 900, verticalSpeed: 0.4, minY: 25, maxY: 100 },
                { id: 'enemyHeavy', name: 'HEAVY', description: '', factions: ['machine'], primaryFaction: 'machine', maxHealth: 180, armor: 35, damage: 40, speed: 1.0, weapon: 'plasma', shootInterval: 1500, verticalSpeed: 0.2, minY: 25, maxY: 100 },
                { id: 'enemyBoss', name: 'BOSS', description: '', factions: ['voidborn'], primaryFaction: 'voidborn', maxHealth: 400, armor: 50, damage: 60, speed: 0.4, weapon: 'plasma', shootInterval: 800, verticalSpeed: 0.15, minY: 20, maxY: 80 }
            ];
        }
        const factionOrder = typeof enemyConfigManager.getFactionOptions === 'function'
            ? enemyConfigManager.getFactionOptions()
            : ['terran', 'kronax', 'voidborn', 'pirate', 'machine'];
        let typeIds = enemyConfigManager.getTypeIds();
        const devMode = typeof startScreenManager !== 'undefined' && startScreenManager.devMode;
        if (!devMode && typeof profileManager !== 'undefined' && profileManager.hasActiveProfile()) {
            const allowed = {};
            profileManager.getDiscovered('enemies').forEach((id) => { allowed[id] = true; });
            typeIds = typeIds.filter((id) => !!allowed[id]);
        }
        const list = typeIds.map((id) => {
            const cfg = enemyConfigManager.getConfig(id);
            const factions = (cfg && Array.isArray(cfg.factions) && cfg.factions.length)
                ? cfg.factions.slice()
                : [enemyConfigManager.getDefaultFaction
                    ? enemyConfigManager.getDefaultFaction(id)
                    : 'pirate'];
            return {
                id: id,
                name: enemyConfigManager.getDisplayName(id) || (cfg && cfg.name) || id,
                description: (cfg && cfg.description) || '',
                factions: factions,
                primaryFaction: factions[0] || 'unassigned',
                maxHealth: (cfg && cfg.maxHealth) || 0,
                armor: (cfg && cfg.armor) || 0,
                damage: (cfg && cfg.damage) || 0,
                speed: (cfg && cfg.speed) || 0,
                weapon: (cfg && cfg.defaultWeapon) || '—',
                shootInterval: (cfg && cfg.shootInterval) || 1200,
                verticalSpeed: (cfg && cfg.verticalSpeed) || 0.3,
                minY: (cfg && cfg.minY != null) ? cfg.minY : 25,
                maxY: (cfg && cfg.maxY != null) ? cfg.maxY : 100,
                shieldMax: (cfg && cfg.shieldMax) || 0
            };
        });
        list.sort((a, b) => {
            const ai = factionOrder.indexOf(a.primaryFaction);
            const bi = factionOrder.indexOf(b.primaryFaction);
            const ao = ai === -1 ? 999 : ai;
            const bo = bi === -1 ? 999 : bi;
            if (ao !== bo) return ao - bo;
            return String(a.name).localeCompare(String(b.name));
        });
        return list;
    }

    /**
     * Expand enemies into faction clusters (multi-faction enemies appear in each group).
     * Returns [{ faction, enemies: [{ enemy, index }] }]
     */
    getFactionClusters() {
        const factionOrder = typeof enemyConfigManager !== 'undefined' && enemyConfigManager.getFactionOptions
            ? enemyConfigManager.getFactionOptions()
            : ['terran', 'kronax', 'voidborn', 'pirate', 'machine'];
        const buckets = {};
        this.enemies.forEach((enemy, index) => {
            const factions = (enemy.factions && enemy.factions.length)
                ? enemy.factions
                : [enemy.primaryFaction || 'unassigned'];
            factions.forEach((f) => {
                const key = f || 'unassigned';
                if (!buckets[key]) buckets[key] = [];
                buckets[key].push({ enemy, index });
            });
        });
        const keys = Object.keys(buckets).sort((a, b) => {
            const ai = factionOrder.indexOf(a);
            const bi = factionOrder.indexOf(b);
            const ao = ai === -1 ? 999 : ai;
            const bo = bi === -1 ? 999 : bi;
            if (ao !== bo) return ao - bo;
            return a.localeCompare(b);
        });
        return keys.map((faction) => ({ faction, enemies: buckets[faction] }));
    }

    getShipModel(typeId) {
        if (typeof factionShipStyles !== 'undefined' && factionShipStyles.resolveFactionShipVisual) {
            const visual = factionShipStyles.resolveFactionShipVisual({ typeId: typeId });
            if (visual && visual.model) return visual.model;
        }
        if (typeof enemyConfigManager !== 'undefined' && enemyConfigManager.getBaseModel) {
            const model = enemyConfigManager.getBaseModel(typeId);
            if (model) return model;
        }
        return {
            name: typeId,
            type: 'enemy',
            modelClass: 'fighter',
            width: 16,
            height: 12,
            sprite: [
                [0, 0, 1, 1, 0, 0],
                [0, 1, 2, 2, 1, 0],
                [1, 2, 3, 3, 2, 1],
                [0, 1, 2, 2, 1, 0]
            ],
            colors: {
                0: 'transparent',
                1: 'var(--current-text-secondary)',
                2: 'var(--current-text)',
                3: 'var(--current-text)'
            }
        };
    }

    resolvePreviewFaction(enemy) {
        if (!enemy) return 'pirate';
        if (enemy.primaryFaction) return enemy.primaryFaction;
        if (enemy.factions && enemy.factions.length) return enemy.factions[0];
        if (typeof planetConfigManager !== 'undefined' && planetConfigManager.taxonomyForType) {
            return planetConfigManager.taxonomyForType(enemy.id).faction || 'pirate';
        }
        return 'pirate';
    }

    resolvePreviewClass(enemy) {
        if (!enemy) return 'assault';
        if (typeof planetConfigManager !== 'undefined' && planetConfigManager.taxonomyForType) {
            return planetConfigManager.taxonomyForType(enemy.id).enemyClass || 'assault';
        }
        return 'assault';
    }

    paintShipIcon(canvas, typeId) {
        if (!canvas) return;
        const enemy = this.enemies.find((e) => e.id === typeId);
        const faction = this.resolvePreviewFaction(enemy);
        const enemyClass = this.resolvePreviewClass(enemy);
        let ship = this.getShipModel(typeId);
        if (typeof factionShipStyles !== 'undefined' && factionShipStyles.resolveFactionShipVisual) {
            const visual = factionShipStyles.resolveFactionShipVisual({
                faction: faction,
                enemyClass: enemyClass,
                typeId: typeId
            });
            if (visual && visual.model) ship = visual.model;
            canvas.setAttribute('data-ag-type', 'factionShip');
            canvas.setAttribute('data-ag-id', visual.spriteKey);
            canvas.setAttribute('data-ag-key', visual.spriteKey);
        } else {
            if (typeof shipRenderer !== 'undefined') {
                if (shipRenderer.init) shipRenderer.init();
                shipRenderer.renderShipPreview(canvas, ship, 1);
            }
            const spriteName = typeof shipRenderer !== 'undefined' && shipRenderer.getSpriteNameForShip
                ? shipRenderer.getSpriteNameForShip(ship)
                : null;
            if (spriteName) canvas.setAttribute('data-ag-key', spriteName);
            else if (typeId) canvas.setAttribute('data-ag-key', String(typeId));
        }
        if (typeof graphicsManager !== 'undefined' && graphicsManager.renderEnemyShip) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                const scale = Math.min(canvas.width / 30, canvas.height / 24) * 0.85;
                graphicsManager.renderEnemyShip(ctx, {
                    x: (canvas.width - 16) / 2,
                    y: (canvas.height - 12) / 2,
                    width: 16,
                    height: 12,
                    type: typeId,
                    faction: faction,
                    enemyClass: enemyClass,
                    tier: (typeof factionShipStyles !== 'undefined' && factionShipStyles.classTier)
                        ? factionShipStyles.classTier[enemyClass]
                        : 2
                }, scale);
            }
        } else if (typeof shipRenderer !== 'undefined') {
            if (shipRenderer.init) shipRenderer.init();
            shipRenderer.renderShipPreview(canvas, ship, 1);
        }
        const spriteName = ship && ship.factionSpriteKey;
        const hasSprite = typeof spriteLoader !== 'undefined' && spriteName && spriteLoader.getSprite(spriteName);
        const shipsReady = typeof graphicsManager !== 'undefined'
            && graphicsManager.shipAssetLoader
            && graphicsManager.shipAssetLoader.isLoaded();
        if ((!hasSprite || !shipsReady) && !canvas.dataset.vfRetryBound) {
            canvas.dataset.vfRetryBound = '1';
            const retry = () => {
                if (!canvas.isConnected || !this.visible) return;
                this.paintShipIcon(canvas, typeId);
            };
            window.addEventListener('vf-sprites-loaded', retry, { once: true });
            window.addEventListener('vf-ships-loaded', retry, { once: true });
            window.addEventListener('vf-asset-accepted', retry, { once: true });
        }
    }

    show(options) {
        if (options && Object.prototype.hasOwnProperty.call(options, 'onClose')) {
            this.onClose = options.onClose;
        }
        this.enemies = this.getEnemyList();
        if (!this.enemies.length) return;
        const preferId = options && options.enemyType;
        if (preferId) {
            const idx = this.enemies.findIndex((e) => e.id === preferId);
            if (idx >= 0) this.selectedIndex = idx;
        }
        this.selectedIndex = Math.max(0, Math.min(this.selectedIndex, this.enemies.length - 1));
        this.visible = true;
        this.createUI();
        document.addEventListener('keydown', this._keyHandler);
        if (!(options && options.skipPersist) && typeof menuStateManager !== 'undefined') {
            menuStateManager.setScreen('enemy-viewer', {
                enemyType: this.enemies[this.selectedIndex].id
            });
        }
    }

    hide() {
        this.visible = false;
        this.stopPreview();
        this.cleanupPreviewControls();
        this.setPreviewFullscreen(false);
        document.removeEventListener('keydown', this._keyHandler);
        if (this._panelResize) {
            this._panelResize.destroy();
            this._panelResize = null;
        }
        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
        }
        this.previewCanvas = null;
        this.previewCtx = null;
        this.previewSim = null;
    }
}
