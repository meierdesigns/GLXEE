"use strict";

/**
 * Sprite definitions and creation methods
 */
class SpriteFactory {
    constructor() {
        this.sprites = {};
        this.init();
    }

    init() {
        this.createSprites();
    }

    createSprites() {
        // Player sprite (volleyball)
        this.sprites.player = this.createPlayerSprite();
        
        // Enemy sprite (net block)
        this.sprites.enemy = this.createEnemySprite();
        
        // Bullet sprites
        this.sprites.playerBullet = this.createPlayerBulletSprite();
        this.sprites.enemyBullet = this.createEnemyBulletSprite();
        
        // Obstacle sprites
        this.sprites.obstacle = this.createObstacleSprite();
        this.sprites.shield = this.createShieldSprite();
        this.sprites.obstacleSmall = this.createSmallObstacleSprite();
        this.sprites.obstacleMedium = this.createMediumObstacleSprite();
        this.sprites.obstacleLarge = this.createLargeObstacleSprite();
        this.sprites.fog = this.createFogSprite();
        
        // Shot type + ability icons (from IconSprites when available)
        this.registerIconSprites();
    }

    registerIconSprites() {
        const fallback = {
            shotNormal: this.createShotNormalIcon.bind(this),
            shotLaser: this.createShotNormalIcon.bind(this),
            shotSpread: this.createShotSpreadIcon.bind(this),
            shotRapid: this.createShotRapidIcon.bind(this)
        };
        if (typeof IconSprites !== 'undefined' && IconSprites) {
            Object.keys(IconSprites).forEach((key) => {
                if (IconSprites[key]) this.sprites[key] = IconSprites[key];
            });
        }
        Object.keys(fallback).forEach((key) => {
            if (!this.sprites[key]) this.sprites[key] = fallback[key]();
        });
    }

    createPlayerSprite() {
        // 16x12 spaceship sprite - pointed nose, wings, engine
        return [
            [0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0],
            [0,0,0,0,0,0,1,2,2,1,0,0,0,0,0,0],
            [0,0,0,0,0,1,2,3,3,2,1,0,0,0,0,0],
            [0,0,0,0,1,2,3,3,3,3,2,1,0,0,0,0],
            [0,0,0,1,2,3,3,3,3,3,3,2,1,0,0,0],
            [0,1,1,2,3,3,3,3,3,3,3,3,2,1,1,0],
            [1,2,2,3,3,3,3,3,3,3,3,3,3,2,2,1],
            [0,1,2,3,3,3,2,2,2,2,3,3,3,2,1,0],
            [0,0,1,2,3,2,1,1,1,1,2,3,2,1,0,0],
            [0,0,0,1,2,1,0,1,1,0,1,2,1,0,0,0],
            [0,0,0,0,1,0,0,2,2,0,0,1,0,0,0,0],
            [0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0]
        ];
    }

    createEnemySprite() {
        // 16x12 aggressive enemy ship - downward facing
        return [
            [0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0],
            [0,0,0,0,1,0,0,2,2,0,0,1,0,0,0,0],
            [0,0,0,1,2,1,0,1,1,0,1,2,1,0,0,0],
            [0,0,1,2,3,2,1,1,1,1,2,3,2,1,0,0],
            [0,1,2,3,3,3,2,2,2,2,3,3,3,2,1,0],
            [1,2,2,3,3,3,3,3,3,3,3,3,3,2,2,1],
            [0,1,1,2,3,3,3,3,3,3,3,3,2,1,1,0],
            [0,0,0,1,2,3,3,3,3,3,3,2,1,0,0,0],
            [0,0,0,0,1,2,3,3,3,3,2,1,0,0,0,0],
            [0,0,0,0,0,1,2,3,3,2,1,0,0,0,0,0],
            [0,0,0,0,0,0,1,2,2,1,0,0,0,0,0,0],
            [0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0]
        ];
    }

    createPlayerBulletSprite() {
        // 3x12 laser beam - longer and thicker
        return [
            [0,1,0],
            [1,1,1],
            [1,1,1],
            [1,1,1],
            [1,1,1],
            [1,1,1],
            [1,1,1],
            [1,1,1],
            [1,1,1],
            [1,1,1],
            [1,1,1],
            [0,1,0]
        ];
    }

    createEnemyBulletSprite() {
        // 3x12 enemy laser beam - longer and thicker
        return [
            [1,0,1],
            [1,1,1],
            [1,1,1],
            [1,1,1],
            [1,1,1],
            [1,1,1],
            [1,1,1],
            [1,1,1],
            [1,1,1],
            [1,1,1],
            [1,1,1],
            [1,0,1]
        ];
    }

    createObstacleSprite() {
        // 6x8 asteroid obstacle - more solid, cohesive design
        return [
            [1,1,1,1,1,1],
            [1,2,2,2,2,1],
            [1,2,2,2,2,1],
            [1,2,2,2,2,1],
            [1,2,2,2,2,1],
            [1,2,2,2,2,1],
            [1,1,1,1,1,1],
            [1,1,1,1,1,1]
        ];
    }

    createShieldSprite() {
        // 6x8 shield obstacle - more solid, cohesive design
        return [
            [1,1,1,1,1,1],
            [1,2,2,2,2,1],
            [1,2,3,3,2,1],
            [1,2,3,3,2,1],
            [1,2,2,2,2,1],
            [1,1,1,1,1,1],
            [1,1,1,1,1,1],
            [1,1,1,1,1,1]
        ];
    }

    createSmallObstacleSprite() {
        // 4x4 small asteroid - very fragmented for lighting effects
        return [
            [1,0,0,1],
            [0,2,2,0],
            [0,2,2,0],
            [1,0,0,1]
        ];
    }

    createMediumObstacleSprite() {
        // 5x6 medium asteroid - medium fragmentation
        return [
            [1,1,0,1,1],
            [1,2,2,2,1],
            [0,2,3,2,0],
            [0,2,3,2,0],
            [1,2,2,2,1],
            [1,0,1,0,1]
        ];
    }

    createLargeObstacleSprite() {
        // 8x10 large asteroid - large but still fragmented
        return [
            [1,1,0,0,0,0,1,1],
            [1,2,2,0,0,2,2,1],
            [0,2,3,3,3,3,2,0],
            [0,2,3,4,4,3,2,0],
            [0,2,3,4,4,3,2,0],
            [0,2,3,3,3,3,2,0],
            [1,2,2,0,0,2,2,1],
            [1,1,0,0,0,0,1,1],
            [0,1,1,0,0,1,1,0],
            [0,0,1,1,1,1,0,0]
        ];
    }

    createFogSprite() {
        // Soft nebula / cloud blob
        return [
            [0,0,1,1,1,1,0,0,0,0],
            [0,1,2,2,2,2,1,1,0,0],
            [1,2,2,3,3,2,2,2,1,0],
            [1,2,3,3,3,3,2,2,1,1],
            [0,1,2,3,3,3,2,1,1,0],
            [0,1,2,2,2,2,1,1,0,0],
            [0,0,1,1,1,1,0,0,0,0],
            [0,0,0,1,1,0,0,0,0,0]
        ];
    }

    createShotNormalIcon() {
        // 16x16 normal shot icon - single large volleyball
        return [
            [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
            [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
            [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
            [0,0,0,0,0,6,6,8,8,6,6,0,0,0,0,0],
            [0,0,0,6,8,10,12,15,15,12,10,8,6,0,0,0],
            [0,0,6,8,10,12,15,15,15,15,12,10,8,6,0,0],
            [0,0,6,10,12,15,15,15,15,15,15,12,10,6,0,0],
            [0,0,8,12,15,15,15,15,15,15,15,15,12,8,0,0],
            [0,0,8,12,15,15,15,15,15,15,15,15,12,8,0,0],
            [0,0,6,10,12,15,15,15,15,15,15,12,10,6,0,0],
            [0,0,6,8,10,12,15,15,15,15,12,10,8,6,0,0],
            [0,0,0,6,8,10,12,15,15,12,10,8,6,0,0,0],
            [0,0,0,0,0,6,6,8,8,6,6,0,0,0,0,0],
            [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
            [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
            [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
        ];
    }

    createShotSpreadIcon() {
        // 16x16 spread shot icon - three volleyballs in fan pattern
        return [
            [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
            [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
            [0,8,10,8,0,0,0,0,0,0,0,8,10,8,0,0],
            [10,12,15,12,10,0,0,8,8,0,0,10,12,15,12,10],
            [0,8,10,8,0,0,8,10,10,8,0,0,8,10,8,0],
            [0,0,0,0,0,0,10,12,12,10,0,0,0,0,0,0],
            [0,0,0,0,0,0,8,10,10,8,0,0,0,0,0,0],
            [0,0,0,0,0,0,0,8,8,0,0,0,0,0,0,0],
            [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
            [0,0,0,0,0,6,8,10,10,8,6,0,0,0,0,0],
            [0,0,0,6,8,10,12,15,15,12,10,8,6,0,0,0],
            [0,0,6,8,10,12,15,15,15,15,12,10,8,6,0,0],
            [0,0,0,6,8,10,12,15,15,12,10,8,6,0,0,0],
            [0,0,0,0,0,6,8,10,10,8,6,0,0,0,0,0],
            [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
            [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
        ];
    }

    createShotRapidIcon() {
        // 16x16 rapid shot icon - two volleyballs with speed lines
        return [
            [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
            [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
            [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
            [6,6,0,0,6,8,10,12,0,6,8,10,12,0,0,6],
            [6,8,6,6,8,10,12,15,0,8,10,12,15,0,6,8],
            [6,6,0,0,6,8,10,12,0,6,8,10,12,0,0,6],
            [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
            [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
            [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
            [6,6,0,0,6,8,10,12,0,6,8,10,12,0,0,6],
            [6,8,6,6,8,10,12,15,0,8,10,12,15,0,6,8],
            [6,6,0,0,6,8,10,12,0,6,8,10,12,0,0,6],
            [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
            [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
            [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
            [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
        ];
    }

    getSprite(name) {
        return this.sprites[name];
    }

    getAllSprites() {
        return this.sprites;
    }
}

