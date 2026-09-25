"use strict";

// CombinedSelectionManager methods, split from combined-selection.js.
extendClass(CombinedSelectionManager, {
    // Create fallback player ships
    createFallbackPlayerShips() {
        this.playerShips = [
            {
                name: "Starfighter",
                type: "player",
                modelClass: "starfighter",
                tier: 1,
                width: 20,
                height: 16,
                speed: 4.0,
                maxHealth: 100,
                armor: 20,
                damage: 30,
                description: "Balanced combat craft. Good all-around performance.",
                weapons: ["Laser", "Rapid Fire"],
                specialAbilities: ["Shield Regen", "Weapon Systems"],
                sprite: [
                    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
                    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
                    [0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0],
                    [0,0,0,0,0,0,0,0,1,2,2,1,0,0,0,0,0,0,0,0],
                    [0,0,0,0,0,0,0,1,2,3,3,2,1,0,0,0,0,0,0,0],
                    [0,0,0,0,0,0,1,2,3,3,3,3,2,1,0,0,0,0,0,0],
                    [0,0,0,0,0,1,2,3,3,3,3,3,3,2,1,0,0,0,0,0],
                    [0,0,0,0,1,2,3,3,3,3,3,3,3,3,2,1,0,0,0,0],
                    [0,0,0,1,2,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0],
                    [0,0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0],
                    [0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0],
                    [0,0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0],
                    [0,0,0,1,2,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0],
                    [0,0,0,0,1,2,3,3,3,3,3,3,3,3,2,1,0,0,0,0],
                    [0,0,0,0,0,1,2,3,3,3,3,3,3,2,1,0,0,0,0,0],
                    [0,0,0,0,0,0,1,2,2,4,4,2,2,1,0,0,0,0,0,0]
                ],
                colors: {
                    0: 'transparent',
                    1: 'var(--current-text-secondary)',  // Dark gray
                    2: 'var(--current-text)',  // Medium gray
                    3: 'var(--current-text)',  // Light gray
                    4: 'var(--current-text)'   // White
                }
            },
            {
                name: "Interceptor",
                type: "player",
                modelClass: "interceptor",
                tier: 2,
                width: 16,
                height: 12,
                speed: 5.0,
                maxHealth: 80,
                armor: 15,
                damage: 25,
                description: "Fast and agile attack craft. High speed and rapid fire rate.",
                weapons: ["Rapid Fire", "Laser", "Spread"],
                specialAbilities: ["High Speed", "Rapid Fire", "Agile Maneuver"],
                sprite: [
                    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
                    [0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0],
                    [0,0,0,0,0,0,1,2,2,1,0,0,0,0,0,0],
                    [0,0,0,0,0,1,2,3,3,2,1,0,0,0,0,0],
                    [0,0,0,0,1,2,3,3,3,3,2,1,0,0,0,0],
                    [0,0,0,1,2,3,3,3,3,3,3,2,1,0,0,0],
                    [0,0,1,2,3,3,3,3,3,3,3,3,2,1,0,0],
                    [0,1,2,3,3,3,3,3,3,3,3,3,3,2,1,0],
                    [0,0,1,2,3,3,3,3,3,3,3,3,2,1,0,0],
                    [0,0,0,1,2,3,3,3,3,3,3,2,1,0,0,0],
                    [0,0,0,0,1,2,3,3,3,3,2,1,0,0,0,0],
                    [0,0,0,0,0,1,2,4,4,2,1,0,0,0,0,0]
                ],
                colors: {
                    0: 'transparent',
                    1: 'var(--current-text-secondary)',  // Dark gray
                    2: 'var(--current-text)',  // Medium gray
                    3: 'var(--current-text)',  // Light gray
                    4: 'var(--current-text)'   // White
                }
            },
            {
                name: "Heavy Fighter",
                type: "player",
                modelClass: "heavy_fighter",
                tier: 3,
                width: 24,
                height: 18,
                speed: 2.5,
                maxHealth: 150,
                armor: 40,
                damage: 45,
                description: "Heavily armored combat unit. High health and powerful weapons.",
                weapons: ["Spread", "Plasma"],
                specialAbilities: ["Heavy Armor", "Powerful Cannon", "Shield Generator"],
                sprite: [
                    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
                    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
                    [0,0,0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0],
                    [0,0,0,0,0,0,0,0,0,1,2,2,2,2,1,0,0,0,0,0,0,0,0,0],
                    [0,0,0,0,0,0,0,0,1,2,3,3,3,3,2,1,0,0,0,0,0,0,0,0],
                    [0,0,0,0,0,0,0,1,2,3,3,3,3,3,3,2,1,0,0,0,0,0,0,0],
                    [0,0,0,0,0,0,1,2,3,3,3,3,3,3,3,3,2,1,0,0,0,0,0,0],
                    [0,0,0,0,0,1,2,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0,0,0],
                    [0,0,0,0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0,0],
                    [0,0,0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0],
                    [0,0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0],
                    [0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0],
                    [0,0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0],
                    [0,0,0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0],
                    [0,0,0,0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0,0],
                    [0,0,0,0,0,1,2,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0,0,0],
                    [0,0,0,0,0,0,1,2,3,3,3,3,3,3,3,3,2,1,0,0,0,0,0,0],
                    [0,0,0,0,0,0,0,1,2,2,4,4,4,4,2,2,1,0,0,0,0,0,0,0]
                ],
                colors: {
                    0: 'transparent',
                    1: 'var(--current-text-secondary)',  // Dark gray
                    2: 'var(--current-text)',  // Medium gray
                    3: 'var(--current-text)',  // Light gray
                    4: 'var(--current-text)'   // White
                }
            },
            {
                name: "Assault",
                type: "player",
                modelClass: "assault",
                tier: 3,
                width: 20,
                height: 16,
                speed: 3.5,
                maxHealth: 120,
                armor: 25,
                damage: 35,
                description: "Versatile combat craft with balanced weapon systems.",
                weapons: ["Laser", "Spread", "Rapid"],
                specialAbilities: ["Balanced Combat", "Versatile Weapons", "Adaptive Shield"],
                sprite: [
                    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
                    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
                    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
                    [0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0],
                    [0,0,0,0,0,0,0,1,2,2,1,0,0,0,0,0,0,0,0,0],
                    [0,0,0,0,0,0,1,2,3,3,2,1,0,0,0,0,0,0,0,0],
                    [0,0,0,0,0,1,2,3,3,3,3,2,1,0,0,0,0,0,0,0],
                    [0,0,0,0,1,2,3,3,3,3,3,3,2,1,0,0,0,0,0,0],
                    [0,0,0,1,2,3,3,3,3,3,3,3,3,2,1,0,0,0,0,0],
                    [0,0,1,2,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0,0],
                    [0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0],
                    [1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0],
                    [0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0],
                    [0,0,1,2,2,2,2,2,2,2,2,2,2,2,2,1,0,0,0,0],
                    [0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0],
                    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
                ],
                colors: {
                    0: 'transparent',
                    1: 'var(--current-text-secondary)',  // Dark gray
                    2: 'var(--current-text)',  // Medium gray
                    3: 'var(--current-text)'   // Light gray
                }
            },
            {
                name: "Bomber",
                type: "player",
                modelClass: "bomber",
                tier: 4,
                width: 22,
                height: 18,
                speed: 2.0,
                maxHealth: 200,
                armor: 50,
                damage: 60,
                description: "Heavy bomber with devastating firepower.",
                weapons: ["Plasma", "Bomb", "Spread"],
                specialAbilities: ["Heavy Bombs", "Devastating Firepower", "Armor Plating"],
                sprite: [
                    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
                    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
                    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
                    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
                    [0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0],
                    [0,0,0,0,0,0,0,1,2,2,2,2,1,0,0,0,0,0,0,0,0,0],
                    [0,0,0,0,0,0,1,2,3,3,3,3,2,1,0,0,0,0,0,0,0,0],
                    [0,0,0,0,0,1,2,3,3,3,3,3,3,2,1,0,0,0,0,0,0,0],
                    [0,0,0,0,1,2,3,3,3,3,3,3,3,3,2,1,0,0,0,0,0,0],
                    [0,0,0,1,2,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0,0,0],
                    [0,0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0,0],
                    [0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0],
                    [1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0],
                    [0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0],
                    [0,0,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,0,0,0,0],
                    [0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0],
                    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
                    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
                ],
                colors: {
                    0: 'transparent',
                    1: 'var(--current-text-secondary)',  // Dark gray
                    2: 'var(--current-text)',  // Medium gray
                    3: 'var(--current-text)'   // Light gray
                }
            },
            {
                name: "Stealth",
                type: "player",
                modelClass: "stealth",
                tier: 5,
                width: 18,
                height: 14,
                speed: 6.0,
                maxHealth: 90,
                armor: 10,
                damage: 40,
                description: "Stealth fighter with advanced cloaking technology.",
                weapons: ["Stealth Laser", "EMP", "Rapid"],
                specialAbilities: ["Cloaking", "EMP Burst", "Stealth Mode"],
                sprite: [
                    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
                    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
                    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
                    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
                    [0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0],
                    [0,0,0,0,0,0,0,1,2,2,1,0,0,0,0,0,0,0],
                    [0,0,0,0,0,0,1,2,3,3,2,1,0,0,0,0,0,0],
                    [0,0,0,0,0,1,2,3,3,3,3,2,1,0,0,0,0,0],
                    [0,0,0,0,1,2,3,3,3,3,3,3,2,1,0,0,0,0],
                    [0,0,0,1,2,3,3,3,3,3,3,3,3,2,1,0,0,0],
                    [0,0,1,2,3,3,3,3,3,3,3,3,3,3,2,1,0,0],
                    [0,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,0],
                    [0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0],
                    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
                ],
                colors: {
                    0: 'transparent',
                    1: 'var(--current-text-secondary)',  // Dark gray
                    2: 'var(--current-text)',  // Medium gray
                    3: 'var(--current-text)'   // Light gray
                }
            }
        ];
    },
});
