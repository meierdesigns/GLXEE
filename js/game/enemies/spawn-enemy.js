"use strict";

// EnemyManager methods, split from enemies.js.
extendClass(EnemyManager, {
    spawnEnemy(entry) {
        const scheduleEntry = entry || this.pendingChampionEntry || null;
        if (!this.activeCombatEvents.length) {
            this.beginChampionCombatEvents(scheduleEntry);
        }
        const levelScale = this.championScale(scheduleEntry && scheduleEntry.level);

        let shipWidth = 20;
        let shipHeight = 16;

        let canvasWidth = 200;
        let canvasHeight = 300;
        if (typeof game !== 'undefined') {
            canvasWidth = game?.internalWidth || game?.baseWidth || game?.width || 200;
            canvasHeight = game?.internalHeight || game?.baseHeight || game?.height || 300;
        }
        
        let enemySpeed = 0.4;
        let enemyVerticalSpeed = 0.25;
        let enemyMaxHealth = 100;
        
        if (typeof graphicsManager !== 'undefined' && graphicsManager.currentEnemyModel) {
            const model = graphicsManager.currentEnemyModel;
            enemySpeed = model.speed || 0.4;
            enemyVerticalSpeed = model.verticalSpeed || 0.25;
            enemyMaxHealth = model.maxHealth || 100;
        }

        let currentLevel = null;
        if (typeof game !== 'undefined') {
            currentLevel = (game.coreLevelManager || game.levelManager)?.getCurrentLevel?.() || null;
        } else if (typeof gameCore !== 'undefined') {
            currentLevel = (gameCore.coreLevelManager || gameCore.levelManager)?.getCurrentLevel?.() || null;
        }
        if (currentLevel) {
            if (currentLevel.enemyHealth) {
                enemyMaxHealth = currentLevel.enemyHealth;
            }
            if (currentLevel.enemySpeed) {
                enemySpeed = Math.max(0.2, currentLevel.enemySpeed * 0.5);
                enemyVerticalSpeed = enemySpeed * 0.6;
            }
            if (currentLevel.isBoss) {
                enemyMaxHealth = Math.round(enemyMaxHealth * 1.15);
            }
        }

        if (this.levelMods && this.levelMods.enemyHealth) {
            enemyMaxHealth = this.levelMods.enemyHealth;
        }
        enemyMaxHealth = Math.round(enemyMaxHealth * levelScale * 0.8);
        enemySpeed = enemySpeed * (1 + 0.1 * ((scheduleEntry && scheduleEntry.level ? scheduleEntry.level : 1) - 1));
        enemyVerticalSpeed = enemyVerticalSpeed * (1 + 0.08 * ((scheduleEntry && scheduleEntry.level ? scheduleEntry.level : 1) - 1));
        if (typeof difficultyConfigManager !== 'undefined') {
            const profile = difficultyConfigManager.getProfile();
            enemySpeed *= profile.enemySpeedMul;
            enemyMaxHealth = Math.max(1, Math.round(enemyMaxHealth * profile.enemyHealthMul));
        }
        
        const champType = (scheduleEntry && scheduleEntry.type)
            || (currentLevel && currentLevel.isBoss ? 'boss' : 'spaceship');
        const champFaction = (scheduleEntry && scheduleEntry.faction) || 'pirate';
        const champClass = (scheduleEntry && scheduleEntry.enemyClass) || 'assault';
        const champTier = (scheduleEntry && scheduleEntry.tier != null)
            ? scheduleEntry.tier
            : (scheduleEntry && scheduleEntry.level) || 1;
        const champLevel = scheduleEntry && scheduleEntry.level;
        const hitProfile = this.resolveEnemyHitProfile({
            faction: champFaction,
            enemyClass: champClass,
            tier: champTier,
            level: champLevel,
            type: (scheduleEntry && scheduleEntry.type) || this.currentShipType,
            drawScale: 1
        });
        shipWidth = hitProfile.width;
        shipHeight = hitProfile.height;
        // contentScale applied via applyEnemyHitProfile / explicit sizes below
        const contentScale = (typeof game !== 'undefined' && game && game.contentScale != null)
            ? Math.max(0.5, Math.min(3, Number(game.contentScale) || 1))
            : 1;
        shipWidth = Math.max(6, Math.round(shipWidth * contentScale));
        shipHeight = Math.max(6, Math.round(shipHeight * contentScale));

        const champFlightProfile = (typeof flightProfiles !== 'undefined')
            ? flightProfiles.resolve(champFaction, champClass)
            : null;
        if (champFlightProfile) {
            enemySpeed *= champFlightProfile.speedMul;
            enemyVerticalSpeed *= champFlightProfile.speedMul;
        }
        // Randomize initial horizontal direction so enemies don't always
        // appear to head right first (they still bounce both ways after).
        if (Math.random() < 0.5) {
            enemySpeed = -Math.abs(enemySpeed);
        } else {
            enemySpeed = Math.abs(enemySpeed);
        }

        this.enemy = {
            x: canvasWidth / 2 - shipWidth / 2,
            y: 25,
            width: shipWidth,
            height: shipHeight,
            speed: enemySpeed,
            verticalSpeed: enemyVerticalSpeed,
            color: 'var(--gray-1000)',
            type: champType,
            faction: champFaction,
            enemyClass: champClass,
            tier: champTier,
            flightProfile: champFlightProfile,
            wobblePhase: Math.random() * Math.PI * 2,
            cluster: (scheduleEntry && scheduleEntry.cluster) || 'alpha',
            entryId: scheduleEntry && scheduleEntry.id,
            level: champLevel,
            champion: true,
            isBoss: !!(currentLevel && currentLevel.isBoss),
            minY: 25,
            maxY: canvasHeight / 3,
            sprite: hitProfile.sprite,
            colors: hitProfile.colors,
            collision: hitProfile.collision
        };
        
        this.maxHealth = enemyMaxHealth;
        
        if (typeof graphicsManager !== 'undefined' && graphicsManager.currentEnemyModel) {
            const model = graphicsManager.currentEnemyModel;
            this.evasionCooldown = model.evasionCooldown || 5000;
            this.evasionDuration = model.evasionDuration || 1000;
            this.evasionSpeed = model.evasionSpeed || 2;
            this.evasionChance = model.evasionChance != null ? model.evasionChance : 1;
            this.predictionSkill = model.predictionSkill != null ? model.predictionSkill : 0;
            this.armor = model.armor != null ? model.armor : 0;
            this.shieldMax = model.shieldMax != null ? Math.round(model.shieldMax * levelScale) : 0;
            this.shieldRegen = model.shieldRegen != null ? model.shieldRegen : 0;
            this.damageReduction = model.damageReduction != null ? model.damageReduction : 0;
            this.reflectChance = model.reflectChance != null ? model.reflectChance : 0;
            this.defenseMechanisms = Array.isArray(model.defenseMechanisms)
                ? model.defenseMechanisms.slice()
                : [];
        } else if (typeof enemyConfigManager !== 'undefined') {
            const cfg = enemyConfigManager.getConfig(this.currentShipType);
            this.armor = (cfg && cfg.armor) || 0;
            this.shieldMax = cfg ? Math.round((cfg.shieldMax || 0) * levelScale) : 0;
            this.shieldRegen = (cfg && cfg.shieldRegen) || 0;
            this.damageReduction = (cfg && cfg.damageReduction) || 0;
            this.reflectChance = (cfg && cfg.reflectChance) || 0;
            this.defenseMechanisms = (cfg && cfg.defenseMechanisms) ? cfg.defenseMechanisms.slice() : [];
            this.evasionChance = cfg && cfg.evasionChance != null ? cfg.evasionChance : 1;
            this.predictionSkill = cfg && cfg.predictionSkill != null ? cfg.predictionSkill : 0;
        } else {
            this.armor = 0;
            this.shieldMax = 0;
            this.shieldRegen = 0;
            this.damageReduction = 0;
            this.reflectChance = 0;
            this.defenseMechanisms = [];
        }
        if (typeof difficultyConfigManager !== 'undefined') {
            const ai = difficultyConfigManager.resolveEnemy(
                this.enemy.faction, this.enemy.tier,
                { evasionChance: this.evasionChance, predictionSkill: this.predictionSkill }
            );
            this.evasionChance = ai.evasionChance;
            this.predictionSkill = ai.predictionSkill;
            this.enemy.damageMul = ai.damageMul;
        }
        this.shield = this.shieldMax;
        
        this.health = this.maxHealth;
        this.exploding = false;
        this.explosionTimer = 0;
        this.sideFleeing = false;

        const discoveredType = (scheduleEntry && scheduleEntry.type) || this.currentShipType;
        if (typeof profileManager !== 'undefined' && profileManager.discoverEnemyContents && discoveredType) {
            profileManager.discoverEnemyContents(discoveredType);
        }
    },

    /**
     * Apply armor / shield / reflect against incoming damage.
     * Mutates target.shield when present. Returns remaining HP damage (0 if fully blocked).
     */
    applyDefenseToDamage(target, rawDamage) {
        let dmg = Number(rawDamage) || 0;
        if (dmg <= 0) return 0;

        const reflect = (target.reflectChance != null ? target.reflectChance : 0) / 100;
        const mechs = target.defenseMechanisms || [];
        const canReflect = reflect > 0 && (
            mechs.indexOf('energy_shield') !== -1 || mechs.indexOf('adaptive_shield') !== -1 || reflect > 0
        );
        if (canReflect && Math.random() < reflect) {
            return 0;
        }

        let reduction = (target.damageReduction != null ? target.damageReduction : 0) / 100;
        if (mechs.indexOf('massive_armor') !== -1) reduction = Math.min(0.75, reduction + 0.1);
        else if (mechs.indexOf('heavy_armor') !== -1) reduction = Math.min(0.75, reduction + 0.05);
        if (mechs.indexOf('adaptive_shield') !== -1) reduction = Math.min(0.75, reduction + 0.05);
        dmg *= (1 - Math.max(0, Math.min(0.75, reduction)));

        // Soft armor: diminishing returns, never nullifies light weapons vs regen.
        const armor = target.armor != null ? Number(target.armor) : 0;
        if (armor > 0) {
            const mitigation = Math.min(0.65, armor / (armor + 100));
            dmg *= (1 - mitigation);
        }
        // Floor: at least 20% of post-reflect damage (or 1) reaches shield/HP.
        const floor = Math.max(1, Number(rawDamage) * 0.2);
        dmg = Math.max(floor, dmg);

        if (target.shield != null && target.shield > 0) {
            const absorbed = Math.min(target.shield, dmg);
            target.shield -= absorbed;
            dmg -= absorbed;
        }

        return Math.max(0, dmg);
    },

    takeDamage(damage) {
        const target = {
            armor: this.armor,
            shield: this.shield,
            damageReduction: this.damageReduction,
            reflectChance: this.reflectChance,
            defenseMechanisms: this.defenseMechanisms
        };
        const playerDamageMul = (typeof difficultyConfigManager !== 'undefined')
            ? difficultyConfigManager.getProfile().playerDamageMul : 1;
        const remaining = this.applyDefenseToDamage(target, Number(damage) * playerDamageMul);
        this.shield = target.shield;
        this.health -= remaining;
        if (this.health <= 0) {
            this.health = 0;
            this.startExplosion();
            return true; // Enemy defeated
        }
        this.evaluateCombatEvents(this.getRuntimeGameState(null));
        return false;
    },

    damageSideEnemy(side, damage) {
        if (!side) return false;
        const playerDamageMul = (typeof difficultyConfigManager !== 'undefined')
            ? difficultyConfigManager.getProfile().playerDamageMul : 1;
        const remaining = this.applyDefenseToDamage(side, Number(damage) * playerDamageMul);
        side.health -= remaining;
        return side.health <= 0;
    },

    killEnemy() {
        // Instant kill cheat - kill enemy immediately
        if (this.enemy) {
            this.health = 0;
            this.startExplosion();
            return true;
        }
        return false;
    },
});
