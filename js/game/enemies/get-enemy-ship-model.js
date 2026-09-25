"use strict";

// EnemyManager methods, split from enemies.js.
extendClass(EnemyManager, {
    // Get enemy ship model for weapon configuration
    async getEnemyShipModel(type) {
        try {
            const { shipAssetLoader } = await import('../../../assets/ships/ship-asset-loader.js');
            if (shipAssetLoader && shipAssetLoader.isLoaded()) {
                const hullId = (typeof enemyConfigManager !== 'undefined' && enemyConfigManager.getHullId)
                    ? enemyConfigManager.getHullId(type)
                    : type;
                let model = shipAssetLoader.getShip(hullId);
                if (typeof enemyConfigManager !== 'undefined' && model) {
                    model = enemyConfigManager.applyOverridesToModel(type, model);
                } else if (model) {
                    model = Object.assign({}, model, { forceEnemyOrientation: true });
                }
                return model;
            }
        } catch (error) {
            // ship asset loader unavailable
        }
        return null;
    },

    // Get current ship type
    getShipType() {
        return this.currentShipType;
    },

    // Set ship type based on level difficulty
    async setShipTypeByLevel(levelId) {
        let shipType = 'enemyBasic';

        switch(levelId) {
            case 1:
            case '1':
            case 'mars':
            case 'mars-1':
            case 'mars-2':
            case 'mars-3':
                shipType = 'enemyBasic';
                break;
            case 'mars-boss':
                shipType = 'enemyBoss';
                break;
            case 2:
            case '2':
            case 'jupiter':
            case 'jupiter-1':
            case 'jupiter-2':
            case 'jupiter-3':
                shipType = 'enemyFast';
                break;
            case 'jupiter-boss':
                shipType = 'enemyBoss';
                break;
            case 3:
            case '3':
            case 'saturn':
            case 'saturn-1':
            case 'saturn-2':
            case 'saturn-3':
                shipType = 'enemyHeavy';
                break;
            case 'saturn-boss':
                shipType = 'enemyBoss';
                break;
            case 4:
            case '4':
            case 'neptune':
            case 'neptune-1':
            case 'neptune-2':
            case 'neptune-3':
                shipType = 'enemyHeavy';
                break;
            case 'neptune-boss':
                shipType = 'enemyBoss';
                break;
            case 5:
            case '5':
            case 'pluto':
            case 'pluto-1':
            case 'pluto-2':
            case 'pluto-3':
            case 'pluto-boss':
                shipType = 'enemyBoss';
                break;
            default:
                if (typeof levelId === 'string' && levelId.endsWith('-boss')) {
                    shipType = 'enemyBoss';
                } else {
                    shipType = 'enemyBasic';
                }
        }

        await this.setShipType(shipType);
    },

    async init() {
        let levelEnemyType = null;
        let level = null;
        if (typeof game !== 'undefined') {
            level = (game.coreLevelManager || game.levelManager)?.getCurrentLevel?.();
            if (level && level.enemyType) levelEnemyType = level.enemyType;
        } else if (typeof gameCore !== 'undefined') {
            level = (gameCore.coreLevelManager || gameCore.levelManager)?.getCurrentLevel?.();
            if (level && level.enemyType) levelEnemyType = level.enemyType;
        }

        if (level && Array.isArray(level.enemies) && level.enemies.length) {
            this.setEnemySchedule(level.enemies, {
                enemySpeed: level.enemySpeed,
                enemyHealth: level.enemyHealth,
                isBoss: level.isBoss,
                planetId: level.planetId || 'mars'
            });
            if (typeof objectiveManager !== 'undefined') {
                objectiveManager.start(level.objective, level.enemies);
            }
        }
        if (!this.schedule.length) {
            const type = levelEnemyType || this.currentShipType || 'enemyBasic';
            this.setEnemySchedule([{
                id: 'main',
                type: type,
                champion: true,
                level: 2,
                spawnAt: 0
            }], {
                enemySpeed: level && level.enemySpeed,
                enemyHealth: level && level.enemyHealth,
                isBoss: level && level.isBoss,
                planetId: (level && level.planetId) || 'mars'
            });
            if (typeof objectiveManager !== 'undefined') {
                objectiveManager.start({ type: 'hunt', targetEnemyId: 'main' }, this.schedule);
            }
        }

        if (levelEnemyType) {
            await this.setShipType(levelEnemyType);
        } else if (!this.currentEnemyModel) {
            await this.setShipType(this.currentShipType);
        }

        if (typeof graphicsManager !== 'undefined' && !graphicsManager.currentEnemyModel) {
            graphicsManager.setEnemyShipType(this.currentShipType);
        }

        this.enemy = null;
        this.scheduleElapsedMs = 0;
        if (!this.spawnFrozen) {
            const fakeState = {
                width: (typeof game !== 'undefined' && (game.internalWidth || game.width)) || 200,
                height: (typeof game !== 'undefined' && (game.internalHeight || game.height)) || 300
            };
            this.updateSchedule(0, fakeState);
        }
    },
});
