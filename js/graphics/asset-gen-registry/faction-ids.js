"use strict";

// AssetGenRegistry methods, split from asset-gen-registry.js.
extendClass(AssetGenRegistry, {
    factionIds() {
        if (typeof factionShipStyles !== "undefined" && factionShipStyles.factions) {
            return factionShipStyles.factions.slice();
        }
        if (typeof planetConfigManager !== "undefined" && planetConfigManager.availableFactions) {
            return planetConfigManager.availableFactions.slice();
        }
        return ["terran", "kronax", "voidborn", "pirate", "machine"];
    },

    enemyClassIds() {
        if (typeof factionShipStyles !== "undefined" && factionShipStyles.classes) {
            return factionShipStyles.classes.slice();
        }
        if (typeof planetConfigManager !== "undefined" && planetConfigManager.availableEnemyClasses) {
            return planetConfigManager.availableEnemyClasses.slice();
        }
        return ["scout", "assault", "heavy", "elite", "capital"];
    },

    listFactions() {
        return this.factionIds().map((id) => {
            const key = (typeof factionShipStyles !== "undefined" && factionShipStyles.emblemKey)
                ? factionShipStyles.emblemKey(id)
                : ("faction-" + id);
            const prompt = (typeof factionShipStyles !== "undefined" && factionShipStyles.buildEmblemPrompt)
                ? factionShipStyles.buildEmblemPrompt(id)
                : this.defaultPrompt("faction", id);
            let label = String(id).toUpperCase();
            if (typeof planetConfigManager !== "undefined" && planetConfigManager.getFactionMeta) {
                const meta = planetConfigManager.getFactionMeta(id);
                if (meta && meta.label) label = meta.label;
            }
            return this.entry("faction", key, {
                folder: "icons",
                fileId: key,
                size: 32,
                filenamePrefix: "icons/vf_faction",
                spriteKey: key,
                label: label,
                promptSuffix: prompt,
                faction: id,
                kind: "emblem"
            });
        });
    },

    listFactionShips() {
        const factions = this.factionIds();
        const classes = this.enemyClassIds();
        const out = [];
        factions.forEach((faction) => {
            classes.forEach((enemyClass) => {
                const key = (typeof factionShipStyles !== "undefined" && factionShipStyles.spriteKey)
                    ? factionShipStyles.spriteKey(faction, enemyClass)
                    : ("enemy-" + faction + "-" + enemyClass);
                const prompt = (typeof factionShipStyles !== "undefined" && factionShipStyles.buildShipPrompt)
                    ? factionShipStyles.buildShipPrompt(faction, enemyClass)
                    : this.defaultPrompt("factionShip", key);
                out.push(this.entry("factionShip", key, {
                    folder: "ships",
                    fileId: key,
                    size: (typeof factionShipStyles !== "undefined"
                        && factionShipStyles.resolutionForClass)
                        ? factionShipStyles.resolutionForClass(enemyClass)
                        : (enemyClass === "scout" ? 16
                            : (enemyClass === "assault" || enemyClass === "heavy" ? 32 : 64)),
                    filenamePrefix: "ships/vf_faction_ship",
                    spriteKey: key,
                    label: String(faction).toUpperCase() + " · " + String(enemyClass).toUpperCase(),
                    promptSuffix: prompt,
                    faction: faction,
                    enemyClass: enemyClass,
                    kind: "ship"
                }));
            });
        });
        return out;
    },

    listWeapons() {
        const names = [
            "laser-basic", "laser-advanced", "laser-heavy",
            "rapid-fire-basic", "rapid-fire-advanced", "rapid-fire-heavy",
            "spread-shot-basic", "spread-shot-advanced", "spread-shot-heavy",
            "plasma-basic", "plasma-advanced", "plasma-heavy",
            "missile-basic", "missile-advanced", "missile-heavy",
            "ion-cannon", "photon-torpedo", "quantum-torpedo",
            "disruptor-beam", "antimatter-cannon", "gravity-bomb",
            "energy-burst", "shield-breaker",
            "enemy-laser-basic", "enemy-laser-advanced", "enemy-laser-heavy"
        ];
        return names.map((id) => this.entry("weapon", id, {
            folder: "weapons",
            fileId: id,
            size: 32,
            filenamePrefix: "weapons/vf_shot",
            spriteKey: id
        }));
    },

    listPlanets() {
        const names = [
            "mars-surface", "mars-canyon", "mars-volcano", "mars-dust-storm",
            "jupiter-atmosphere", "jupiter-red-spot", "jupiter-moons",
            "saturn-rings", "saturn-storm", "saturn-titan",
            "neptune-storm", "neptune-ice", "neptune-dark-spot",
            "pluto-surface", "pluto-ice", "pluto-charon"
        ];
        return names.map((id) => this.entry("planet", id, {
            folder: "levels",
            fileId: id,
            size: 128,
            filenamePrefix: "planets/vf_planet",
            spriteKey: id
        }));
    },

    listObstacles() {
        const names = [
            "small-asteroid", "medium-asteroid", "large-asteroid", "energy-shield"
        ];
        return names.map((id) => this.entry("obstacle", id, {
            folder: "obstacles",
            fileId: id,
            size: 32,
            filenamePrefix: "obstacles/vf_obstacle",
            spriteKey: id
        }));
    },
});
