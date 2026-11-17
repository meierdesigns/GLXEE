"use strict";

/** Station upgrade tree nodes: cooling through fleet yard. Used by EconomyConfig.stationUpgradeNodes. */
function createAdvancedStationUpgradeNodes() {
    return {
        cooling: {
            id: 'cooling',
            label: 'COOLING GRID',
            icon: 'resCrystal',
            maxLevel: 5,
            requires: 'reactor',
            requireLevel: 2,
            treeX: 94,
            treeY: 46,
            desc: 'Stabilize reactor output for more store.',
            effect: (lv) => ({ resourceCap: lv * 35 }),
            costs: [
                { scrap: 110, ore: 40, crystal: 35 },
                { scrap: 180, ore: 70, crystal: 60 },
                { scrap: 270, ore: 110, crystal: 90, voltex: 30 },
                { scrap: 380, ore: 160, crystal: 125, voltex: 55 },
                { scrap: 520, ore: 220, crystal: 165, voltex: 85 }
            ]
        },
        refinery: {
            id: 'refinery',
            label: 'ORE REFINERY',
            icon: 'resOre',
            maxLevel: 6,
            requires: 'compactor',
            requireLevel: 2,
            treeX: 3,
            treeY: 64,
            desc: 'Refine ore streams into extra vault space.',
            effect: (lv) => ({ resourceCap: lv * 45 }),
            costs: [
                { scrap: 120, ore: 60 },
                { scrap: 190, ore: 100, crystal: 30 },
                { scrap: 280, ore: 150, crystal: 55, voltex: 20 },
                { scrap: 390, ore: 210, crystal: 85, voltex: 40 },
                { scrap: 520, ore: 280, crystal: 120, voltex: 65 },
                { scrap: 680, ore: 360, crystal: 160, voltex: 95 }
            ]
        },
        drone_bay: {
            id: 'drone_bay',
            label: 'DRONE BAY',
            icon: 'menuStart',
            maxLevel: 5,
            requires: 'docking_ring',
            requireLevel: 1,
            treeX: 24,
            treeY: 60,
            desc: 'Automated service drones free hangar slots.',
            effect: (lv) => ({ shipSlots: lv }),
            costs: [
                { scrap: 130, ore: 50, crystal: 25 },
                { scrap: 210, ore: 90, crystal: 50 },
                { scrap: 310, ore: 140, crystal: 80, voltex: 30 },
                { scrap: 430, ore: 200, crystal: 115, voltex: 55 },
                { scrap: 580, ore: 270, crystal: 155, voltex: 85 }
            ]
        },
        sensors: {
            id: 'sensors',
            label: 'SENSOR ARRAY',
            icon: 'hsBlueprint',
            maxLevel: 8,
            requires: 'fabricator',
            requireLevel: 1,
            treeX: 40,
            treeY: 66,
            desc: 'Better blueprint drop chance.',
            effect: (lv) => ({ dropBonus: lv * 0.015 }),
            costs: [
                { scrap: 80, crystal: 30 },
                { scrap: 140, ore: 40, crystal: 55 },
                { scrap: 220, ore: 70, crystal: 85, voltex: 30 },
                { scrap: 320, ore: 100, crystal: 120, voltex: 55 },
                { scrap: 430, ore: 140, crystal: 155, voltex: 80 },
                { scrap: 560, ore: 185, crystal: 195, voltex: 110 },
                { scrap: 710, ore: 240, crystal: 240, voltex: 145 },
                { scrap: 890, ore: 310, crystal: 295, voltex: 185 }
            ]
        },
        nav_computer: {
            id: 'nav_computer',
            label: 'NAV COMPUTER',
            icon: 'galaxyDefault',
            maxLevel: 5,
            requires: 'warp_drive',
            requireLevel: 1,
            treeX: 76,
            treeY: 60,
            desc: 'More explore unlocks per run in foreign galaxies.',
            effect: (lv) => ({ exploreBudget: lv }),
            costs: [
                { scrap: 120, crystal: 50 },
                { scrap: 200, ore: 50, crystal: 80, voltex: 20 },
                { scrap: 300, ore: 80, crystal: 110, voltex: 40 },
                { scrap: 420, ore: 120, crystal: 150, voltex: 70 },
                { scrap: 570, ore: 170, crystal: 200, voltex: 105 }
            ]
        },
        foundry: {
            id: 'foundry',
            label: 'NANO FOUNDRY',
            icon: 'resVoltex',
            maxLevel: 6,
            requires: 'fabricator',
            requireLevel: 3,
            treeX: 58,
            treeY: 62,
            desc: 'Advanced fab line for deeper craft discounts.',
            effect: (lv) => ({ craftDiscount: lv * 0.04 }),
            costs: [
                { scrap: 160, ore: 60, crystal: 50, voltex: 20 },
                { scrap: 250, ore: 100, crystal: 80, voltex: 40 },
                { scrap: 360, ore: 150, crystal: 115, voltex: 65 },
                { scrap: 490, ore: 210, crystal: 155, voltex: 95 },
                { scrap: 640, ore: 280, crystal: 205, voltex: 130 },
                { scrap: 820, ore: 360, crystal: 265, voltex: 170 }
            ]
        },
        quantum_array: {
            id: 'quantum_array',
            label: 'QUANTUM ARRAY',
            icon: 'galaxyAndromeda',
            maxLevel: 6,
            requires: 'sensors',
            requireLevel: 2,
            treeX: 38,
            treeY: 86,
            desc: 'Quantum scanners for rare blueprint drops.',
            effect: (lv) => ({ dropBonus: lv * 0.02 }),
            costs: [
                { scrap: 180, crystal: 70, voltex: 25 },
                { scrap: 280, ore: 60, crystal: 110, voltex: 45 },
                { scrap: 400, ore: 100, crystal: 160, voltex: 70 },
                { scrap: 540, ore: 150, crystal: 220, voltex: 100 },
                { scrap: 700, ore: 210, crystal: 290, voltex: 140 },
                { scrap: 900, ore: 280, crystal: 370, voltex: 190 }
            ]
        },
        stargate: {
            id: 'stargate',
            label: 'STARGATE LINK',
            icon: 'galaxyMilkyWay',
            maxLevel: 4,
            requires: 'nav_computer',
            requireLevel: 2,
            treeX: 78,
            treeY: 80,
            desc: 'Deep-route links. Raises warp tier further.',
            effect: (lv) => ({ warpDrive: lv }),
            costs: [
                { scrap: 280, ore: 100, crystal: 120, voltex: 50 },
                { scrap: 420, ore: 160, crystal: 180, voltex: 85 },
                { scrap: 600, ore: 240, crystal: 260, voltex: 130 },
                { scrap: 820, ore: 340, crystal: 360, voltex: 190 }
            ]
        },
        vault_omega: {
            id: 'vault_omega',
            label: 'OMEGA VAULT',
            icon: 'hsStores',
            maxLevel: 5,
            requires: 'refinery',
            requireLevel: 3,
            treeX: 2,
            treeY: 84,
            desc: 'Ultimate station vault expansion.',
            effect: (lv) => ({ resourceCap: lv * 80, cargoCap: lv * 20, storageSlots: lv * 8 }),
            costs: [
                { scrap: 300, ore: 150, crystal: 80, voltex: 40 },
                { scrap: 450, ore: 230, crystal: 130, voltex: 70 },
                { scrap: 640, ore: 330, crystal: 190, voltex: 110 },
                { scrap: 860, ore: 450, crystal: 260, voltex: 160 },
                { scrap: 1120, ore: 590, crystal: 350, voltex: 220 }
            ]
        },
        fleet_yard: {
            id: 'fleet_yard',
            label: 'FLEET YARD',
            icon: 'hsShip',
            maxLevel: 4,
            requires: 'drone_bay',
            requireLevel: 2,
            treeX: 22,
            treeY: 80,
            desc: 'Mass hangar expansion for large fleets.',
            effect: (lv) => ({ shipSlots: lv * 2 }),
            costs: [
                { scrap: 320, ore: 140, crystal: 90, voltex: 50 },
                { scrap: 480, ore: 220, crystal: 140, voltex: 85 },
                { scrap: 680, ore: 320, crystal: 200, voltex: 130 },
                { scrap: 920, ore: 440, crystal: 280, voltex: 190 }
            ]
        },
        // FACTIONS branch — diplomacy / trade / war council live on the station tree.
        embassy: {
            id: 'embassy',
            label: 'EMBASSY',
            icon: 'menuPeoples',
            maxLevel: 5,
            requires: 'core',
            requireLevel: 2,
            treeX: 88,
            treeY: 28,
            desc: 'Open a diplomatic wing. Reputation gains from contracts scale up.',
            effect: (lv) => ({ repGainMul: 1 + lv * 0.12 }),
            costs: [
                { scrap: 90, crystal: 40 },
                { scrap: 150, ore: 40, crystal: 70 },
                { scrap: 230, ore: 70, crystal: 110, voltex: 25 },
                { scrap: 330, ore: 110, crystal: 155, voltex: 50 },
                { scrap: 460, ore: 160, crystal: 210, voltex: 80 }
            ]
        },
        trade_desk: {
            id: 'trade_desk',
            label: 'TRADE DESK',
            icon: 'hsShop',
            maxLevel: 5,
            requires: 'embassy',
            requireLevel: 1,
            treeX: 92,
            treeY: 48,
            desc: 'Better faction trade prices (buy cheaper / sell higher).',
            effect: (lv) => ({ tradeBonus: lv * 0.04 }),
            costs: [
                { scrap: 110, ore: 40, crystal: 35 },
                { scrap: 180, ore: 70, crystal: 60 },
                { scrap: 270, ore: 110, crystal: 95, voltex: 30 },
                { scrap: 380, ore: 160, crystal: 135, voltex: 55 },
                { scrap: 520, ore: 220, crystal: 180, voltex: 85 }
            ]
        },
        war_room: {
            id: 'war_room',
            label: 'WAR ROOM',
            icon: 'navCrosshair',
            maxLevel: 4,
            requires: 'embassy',
            requireLevel: 2,
            treeX: 84,
            treeY: 52,
            desc: 'Faction contract payouts and reputation rewards rise.',
            effect: (lv) => ({ contractRepBonus: lv * 2, contractPayMul: 1 + lv * 0.08 }),
            costs: [
                { scrap: 140, ore: 50, crystal: 45 },
                { scrap: 220, ore: 90, crystal: 80, voltex: 25 },
                { scrap: 330, ore: 140, crystal: 120, voltex: 50 },
                { scrap: 470, ore: 200, crystal: 170, voltex: 85 }
            ]
        },
        // WEAPONS branch — each node builds one new weapon into the station stash (once).
        armory: {
            id: 'armory',
            label: 'ARMORY',
            icon: 'hsComponents',
            grantsWeapon: 'rapid',
            maxLevel: 1,
            requires: 'core',
            requireLevel: 1,
            treeX: 50,
            treeY: 60,
            desc: 'Opens the armoury: a rapid-fire cannon for the stash. Unlocks the weapon branch.',
            effect: () => ({}),
            costs: [{ scrap: 60, ore: 20 }]
        },
        // WEAPONS branch — each node builds one new weapon into the station stash (once).
        arm_plasma: {
            id: 'arm_plasma',
            label: 'PLASMA FOUNDRY',
            icon: 'hsComponents',
            grantsWeapon: 'plasma',
            maxLevel: 1,
            requires: 'armory',
            requireLevel: 1,
            treeX: 50,
            treeY: 60,
            desc: 'Builds a plasma cannon into the station stash.',
            effect: () => ({}),
            costs: [{ scrap: 110, ore: 45, crystal: 25 }]
        },
        // WEAPONS branch — each node builds one new weapon into the station stash (once).
        arm_missile: {
            id: 'arm_missile',
            label: 'MISSILE RACK',
            icon: 'hsComponents',
            grantsWeapon: 'missile',
            maxLevel: 1,
            requires: 'armory',
            requireLevel: 1,
            treeX: 50,
            treeY: 60,
            desc: 'Builds a missile launcher into the station stash.',
            effect: () => ({}),
            costs: [{ scrap: 120, ore: 50, crystal: 20 }]
        },
        // WEAPONS branch — each node builds one new weapon into the station stash (once).
        arm_ion: {
            id: 'arm_ion',
            label: 'ION LAB',
            icon: 'hsComponents',
            grantsWeapon: 'ion',
            maxLevel: 1,
            requires: 'armory',
            requireLevel: 1,
            treeX: 50,
            treeY: 60,
            desc: 'Builds an ion emitter into the station stash.',
            effect: () => ({}),
            costs: [{ scrap: 100, ore: 40, crystal: 45 }]
        },
        // WEAPONS branch — each node builds one new weapon into the station stash (once).
        arm_railgun: {
            id: 'arm_railgun',
            label: 'RAILGUN BAY',
            icon: 'hsComponents',
            grantsWeapon: 'railgun',
            maxLevel: 1,
            requires: 'arm_plasma',
            requireLevel: 1,
            treeX: 50,
            treeY: 60,
            desc: 'Builds a railgun into the station stash.',
            effect: () => ({}),
            costs: [{ scrap: 200, ore: 90, crystal: 70, voltex: 20 }]
        },
        // WEAPONS branch — each node builds one new weapon into the station stash (once).
        arm_pierce: {
            id: 'arm_pierce',
            label: 'LANCE FORGE',
            icon: 'hsComponents',
            grantsWeapon: 'pierce',
            maxLevel: 1,
            requires: 'arm_missile',
            requireLevel: 1,
            treeX: 50,
            treeY: 60,
            desc: 'Builds a piercing lance into the station stash.',
            effect: () => ({}),
            costs: [{ scrap: 190, ore: 85, crystal: 60, voltex: 15 }]
        },
        // WEAPONS branch — each node builds one new weapon into the station stash (once).
        arm_nova: {
            id: 'arm_nova',
            label: 'NOVA CORE',
            icon: 'hsComponents',
            grantsWeapon: 'nova',
            maxLevel: 1,
            requires: 'arm_ion',
            requireLevel: 1,
            treeX: 50,
            treeY: 60,
            desc: 'Builds a nova projector into the station stash.',
            effect: () => ({}),
            costs: [{ scrap: 210, ore: 80, crystal: 85, voltex: 30 }]
        }
    };
}
