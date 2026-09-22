"use strict";

/**
 * Economy constants: resources, shop/craft costs, blueprint drop chances.
 */
class EconomyConfig {
    constructor() {
        this.resourceIds = ['scrap', 'ore', 'crystal', 'voltex'];
        this.resourceLabels = {
            scrap: 'SCRAP',
            ore: 'ORE',
            crystal: 'CRYSTAL',
            voltex: 'VOLTEX'
        };
        /** Distinct tint per resource (icons / pickups / HUD). */
        this.resourceColors = {
            scrap: '#b8b0a0',
            ore: '#c49a4a',
            crystal: '#6ec8e8',
            voltex: '#c86ef0'
        };
        this.resourceIconKeys = {
            scrap: 'resScrap',
            ore: 'resOre',
            crystal: 'resCrystal',
            voltex: 'resVoltex'
        };
        /** Extra seconds after objective clear for the player to scoop pickups. */
        this.victoryLootGraceMs = 10000;
        /** Credits-equivalent unit value for the resource market. Credits are uncapped currency. */
        this.resourceTradeValue = {
            scrap: 1,
            ore: 2,
            crystal: 5,
            voltex: 12
        };
        this.resourceBuyMult = 1.5;
        this.resourceSellMult = 0.6;
        this.starterCredits = 250;
        this.starterShipId = 'player_scrap';
        this.blueprintDropChance = {
            scout: 0.02,
            assault: 0.04,
            heavy: 0.06,
            elite: 0.10,
            capital: 0.15,
            champion: 0.15,
            default: 0.03
        };
        this.defaultPlanetResources = {
            mars: [
                { id: 'scrap', weight: 4, min: 12, max: 28 },
                { id: 'ore', weight: 2, min: 6, max: 16 }
            ],
            jupiter: [
                { id: 'ore', weight: 3, min: 10, max: 22 },
                { id: 'crystal', weight: 2, min: 6, max: 16 }
            ],
            saturn: [
                { id: 'crystal', weight: 4, min: 12, max: 28 },
                { id: 'ore', weight: 1, min: 6, max: 12 }
            ],
            neptune: [
                { id: 'crystal', weight: 3, min: 10, max: 22 },
                { id: 'voltex', weight: 2, min: 5, max: 12 }
            ],
            pluto: [
                { id: 'voltex', weight: 4, min: 10, max: 22 },
                { id: 'crystal', weight: 1, min: 5, max: 12 }
            ]
        };
        /**
         * Home Station upgrade tree.
         * Levels start at 0. Costs are for purchasing the next level.
         */
        this.stationBaseStats = {
            resourceCap: 80,
            cargoCap: 40,
            shipSlots: 2,
            craftDiscount: 0,
            dropBonus: 0
        };
        this.stationUpgradeNodes = {
            core: {
                id: 'core',
                label: 'STATION CORE',
                icon: 'hsStation',
                maxLevel: 10,
                requires: null,
                requireLevel: 0,
                treeX: 50,
                treeY: 6,
                desc: 'Central hub. Unlocks branch upgrades.',
                effect: (lv) => ({ resourceCap: lv * 10, cargoCap: lv * 5 }),
                costs: [
                    { scrap: 40 },
                    { scrap: 80, ore: 20 },
                    { scrap: 120, ore: 40, crystal: 15 },
                    { scrap: 180, ore: 60, crystal: 30 },
                    { scrap: 250, ore: 90, crystal: 50, voltex: 20 },
                    { scrap: 320, ore: 120, crystal: 70, voltex: 35 },
                    { scrap: 400, ore: 160, crystal: 95, voltex: 50 },
                    { scrap: 500, ore: 200, crystal: 120, voltex: 70 },
                    { scrap: 620, ore: 250, crystal: 150, voltex: 95 },
                    { scrap: 760, ore: 310, crystal: 190, voltex: 120 }
                ]
            },
            storage: {
                id: 'storage',
                label: 'VAULT STORAGE',
                icon: 'hsStores',
                maxLevel: 10,
                requires: 'core',
                requireLevel: 1,
                treeX: 8,
                treeY: 24,
                desc: 'Raise max station resources per type.',
                effect: (lv) => ({ resourceCap: lv * 40 }),
                costs: [
                    { scrap: 50, ore: 15 },
                    { scrap: 90, ore: 35 },
                    { scrap: 140, ore: 55, crystal: 20 },
                    { scrap: 200, ore: 80, crystal: 40 },
                    { scrap: 280, ore: 110, crystal: 60, voltex: 15 },
                    { scrap: 360, ore: 140, crystal: 80, voltex: 30 },
                    { scrap: 450, ore: 180, crystal: 100, voltex: 45 },
                    { scrap: 560, ore: 220, crystal: 130, voltex: 65 },
                    { scrap: 690, ore: 270, crystal: 160, voltex: 85 },
                    { scrap: 840, ore: 330, crystal: 200, voltex: 110 }
                ]
            },
            hangar: {
                id: 'hangar',
                label: 'HANGAR BAYS',
                icon: 'hsShip',
                maxLevel: 8,
                requires: 'core',
                requireLevel: 1,
                treeX: 28,
                treeY: 20,
                desc: 'More ship slots in the hangar.',
                effect: (lv) => ({ shipSlots: lv }),
                costs: [
                    { scrap: 60, ore: 25 },
                    { scrap: 110, ore: 50, crystal: 15 },
                    { scrap: 180, ore: 80, crystal: 35 },
                    { scrap: 260, ore: 110, crystal: 55, voltex: 20 },
                    { scrap: 360, ore: 150, crystal: 80, voltex: 40 },
                    { scrap: 470, ore: 190, crystal: 105, voltex: 60 },
                    { scrap: 600, ore: 240, crystal: 135, voltex: 85 },
                    { scrap: 760, ore: 300, crystal: 170, voltex: 115 }
                ]
            },
            cargo: {
                id: 'cargo',
                label: 'CARGO BAY',
                icon: 'hsCargo',
                maxLevel: 10,
                requires: 'core',
                requireLevel: 1,
                treeX: 50,
                treeY: 26,
                desc: 'Raise mission cargo capacity.',
                effect: (lv) => ({ cargoCap: lv * 30 }),
                costs: [
                    { scrap: 45, ore: 20 },
                    { scrap: 85, ore: 40 },
                    { scrap: 130, ore: 60, crystal: 20 },
                    { scrap: 190, ore: 90, crystal: 40 },
                    { scrap: 270, ore: 120, crystal: 60, voltex: 25 },
                    { scrap: 350, ore: 155, crystal: 80, voltex: 40 },
                    { scrap: 450, ore: 195, crystal: 105, voltex: 60 },
                    { scrap: 570, ore: 240, crystal: 135, voltex: 80 },
                    { scrap: 710, ore: 295, crystal: 170, voltex: 105 },
                    { scrap: 880, ore: 360, crystal: 210, voltex: 135 }
                ]
            },
            impulse_drive: {
                id: 'impulse_drive',
                label: 'IMPULSE DRIVE',
                icon: 'hsTeleport',
                maxLevel: 3,
                requires: 'core',
                requireLevel: 1,
                treeX: 72,
                treeY: 20,
                desc: 'Stabilize home-galaxy station travel.',
                effect: (lv) => ({ impulseDrive: Math.min(1, lv) }),
                costs: [
                    { scrap: 70, ore: 30 },
                    { scrap: 140, ore: 60, crystal: 25 },
                    { scrap: 220, ore: 100, crystal: 50, voltex: 20 }
                ]
            },
            reactor: {
                id: 'reactor',
                label: 'POWER REACTOR',
                icon: 'hsShop',
                maxLevel: 6,
                requires: 'core',
                requireLevel: 1,
                treeX: 92,
                treeY: 24,
                desc: 'Boost store and cargo from core power.',
                effect: (lv) => ({ resourceCap: lv * 15, cargoCap: lv * 10 }),
                costs: [
                    { scrap: 90, ore: 40, crystal: 20 },
                    { scrap: 150, ore: 70, crystal: 40 },
                    { scrap: 230, ore: 110, crystal: 65, voltex: 20 },
                    { scrap: 330, ore: 150, crystal: 95, voltex: 40 },
                    { scrap: 450, ore: 200, crystal: 130, voltex: 65 },
                    { scrap: 590, ore: 260, crystal: 170, voltex: 95 }
                ]
            },
            compactor: {
                id: 'compactor',
                label: 'SCRAP COMPACTOR',
                icon: 'resScrap',
                maxLevel: 6,
                requires: 'storage',
                requireLevel: 2,
                treeX: 5,
                treeY: 44,
                desc: 'Compress vault loads for higher store caps.',
                effect: (lv) => ({ resourceCap: lv * 50 }),
                costs: [
                    { scrap: 80, ore: 30 },
                    { scrap: 140, ore: 55, crystal: 20 },
                    { scrap: 210, ore: 90, crystal: 40 },
                    { scrap: 300, ore: 130, crystal: 65, voltex: 25 },
                    { scrap: 410, ore: 175, crystal: 95, voltex: 45 },
                    { scrap: 540, ore: 230, crystal: 130, voltex: 70 }
                ]
            },
            docking_ring: {
                id: 'docking_ring',
                label: 'DOCKING RING',
                icon: 'menuShips',
                maxLevel: 5,
                requires: 'hangar',
                requireLevel: 2,
                treeX: 26,
                treeY: 40,
                desc: 'Extra external berths for more ships.',
                effect: (lv) => ({ shipSlots: lv }),
                costs: [
                    { scrap: 100, ore: 45, crystal: 15 },
                    { scrap: 170, ore: 80, crystal: 35 },
                    { scrap: 260, ore: 120, crystal: 60, voltex: 25 },
                    { scrap: 370, ore: 170, crystal: 90, voltex: 45 },
                    { scrap: 500, ore: 230, crystal: 125, voltex: 70 }
                ]
            },
            fabricator: {
                id: 'fabricator',
                label: 'FABRICATOR',
                icon: 'hsCraft',
                maxLevel: 8,
                requires: 'cargo',
                requireLevel: 2,
                treeX: 46,
                treeY: 46,
                desc: 'Lower craft costs.',
                effect: (lv) => ({ craftDiscount: lv * 0.06 }),
                costs: [
                    { scrap: 100, ore: 40, crystal: 25 },
                    { scrap: 160, ore: 70, crystal: 45 },
                    { scrap: 240, ore: 100, crystal: 70, voltex: 25 },
                    { scrap: 340, ore: 140, crystal: 100, voltex: 50 },
                    { scrap: 450, ore: 185, crystal: 130, voltex: 70 },
                    { scrap: 580, ore: 235, crystal: 165, voltex: 95 },
                    { scrap: 730, ore: 295, crystal: 205, voltex: 120 },
                    { scrap: 900, ore: 365, crystal: 250, voltex: 150 }
                ]
            },
            warp_drive: {
                id: 'warp_drive',
                label: 'WARP DRIVE',
                icon: 'hsUpgrade',
                maxLevel: 5,
                requires: 'impulse_drive',
                requireLevel: 1,
                treeX: 74,
                treeY: 40,
                desc: 'Unlock inter-galaxy travel. L1+ opens farther portals.',
                effect: (lv) => ({ warpDrive: lv }),
                costs: [
                    { scrap: 150, ore: 60, crystal: 40 },
                    { scrap: 240, ore: 90, crystal: 70, voltex: 25 },
                    { scrap: 360, ore: 130, crystal: 100, voltex: 50 },
                    { scrap: 500, ore: 180, crystal: 140, voltex: 80 },
                    { scrap: 680, ore: 240, crystal: 190, voltex: 120 }
                ]
            },
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
                effect: (lv) => ({ resourceCap: lv * 80, cargoCap: lv * 20 }),
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
            }
        };
        this.stationUpgradeOrder = [
            'core', 'storage', 'hangar', 'cargo', 'impulse_drive', 'reactor',
            'compactor', 'docking_ring', 'fabricator', 'warp_drive', 'cooling',
            'refinery', 'drone_bay', 'sensors', 'nav_computer', 'foundry',
            'vault_omega', 'fleet_yard', 'quantum_array', 'stargate'
        ];
        /** Warp level required to travel to each galaxy (milky_way always free). */
        this.galaxyWarpRequirement = {
            milky_way: 0,
            andromeda: 1,
            void_reach: 2,
            scrap_belt: 3,
            synth_grid: 4
        };
        /** Shop portal unlock costs (home galaxy not sold). */
        this.galaxyPortalCost = {
            andromeda: { scrap: 220, ore: 90, crystal: 110, voltex: 65 },
            void_reach: { scrap: 320, ore: 130, crystal: 160, voltex: 100 },
            scrap_belt: { scrap: 420, ore: 170, crystal: 200, voltex: 140 },
            synth_grid: { scrap: 540, ore: 220, crystal: 260, voltex: 190 }
        };
        this.maxShipFrameLevel = 9;
        this.moduleUpgradeDefs = {
            weapons: {
                power: { label: 'POWER', desc: '+Damage', maxLevel: 3 },
                cyclic: { label: 'CYCLIC', desc: '−Cooldown', maxLevel: 3 },
                barrel: { label: 'BARREL', desc: '+Projectiles / spread', maxLevel: 3 }
            },
            defenses: {
                capacity: { label: 'CAPACITY', desc: '+Shield / armor value', maxLevel: 3 },
                harden: { label: 'HARDEN', desc: 'Damage reduction', maxLevel: 3 },
                recover: { label: 'RECOVER', desc: '+Regen', maxLevel: 3 }
            },
            abilities: {
                efficiency: { label: 'EFFICIENCY', desc: '−Cooldown', maxLevel: 3 },
                potency: { label: 'POTENCY', desc: '+Effect strength', maxLevel: 3 },
                duration: { label: 'DURATION', desc: '+Duration', maxLevel: 3 }
            },
            charge: {
                focus: { label: 'FOCUS', desc: '−Charge time (shot & drive)', maxLevel: 3 },
                output: { label: 'OUTPUT', desc: '+Charge power / shield fill / burst', maxLevel: 3 },
                ballast: { label: 'BALLAST', desc: '−Slowdown while drive-charging', maxLevel: 3 }
            },
            energy: {
                capacity: { label: 'CAPACITY', desc: '+Energy pool', maxLevel: 3 },
                regen: { label: 'REGEN', desc: '+Energy recharge', maxLevel: 3 },
                efficiency: { label: 'EFFICIENCY', desc: '−Power drain', maxLevel: 3 }
            },
            collector: {
                radius: { label: 'RADIUS', desc: '+Pickup collect radius', maxLevel: 5 },
                yield: { label: 'YIELD', desc: '+Resources per kill drop', maxLevel: 5 },
                magnet: { label: 'MAGNET', desc: '+Pull strength toward ship', maxLevel: 5 }
            }
        };
        /** Base pixel radius for collecting mission resource pickups. */
        this.collectBaseRadius = 32;
        /** Relative kill-drop scale by enemy class / champion. */
        this.enemyDropScale = {
            scout: 0.55,
            assault: 0.85,
            heavy: 1.15,
            elite: 1.45,
            capital: 1.9,
            champion: 2.4,
            default: 0.75
        };
    }

    getGalaxyWarpRequirement(galaxyId) {
        const id = String(galaxyId || '').toLowerCase();
        if (Object.prototype.hasOwnProperty.call(this.galaxyWarpRequirement, id)) {
            return this.galaxyWarpRequirement[id];
        }
        return 99;
    }

    canTravelToGalaxy(galaxyId, stationLevels) {
        const req = this.getGalaxyWarpRequirement(galaxyId);
        if (req <= 0) return true;
        const warp = Math.max(0, Math.round(Number((stationLevels && stationLevels.warp_drive) || 0)));
        return warp >= req;
    }

    /**
     * Portal shop price in CREDITS for a destination galaxy.
     * Returns null when the galaxy is not sold (e.g. home milky_way).
     */
    getPortalCost(galaxyId) {
        const id = String(galaxyId || '').toLowerCase();
        if (!id || id === 'milky_way') return null;
        let mat = null;
        if (Object.prototype.hasOwnProperty.call(this.galaxyPortalCost, id)) {
            mat = Object.assign({}, this.galaxyPortalCost[id]);
        } else {
            const req = this.getGalaxyWarpRequirement(id);
            if (req <= 0) return null;
            mat = {
                scrap: 180 + req * 80,
                ore: 70 + req * 35,
                crystal: 90 + req * 40,
                voltex: 40 + req * 30
            };
        }
        return { credits: this.materialCostToCredits(mat) };
    }

    getPortalTier(galaxyId) {
        const req = this.getGalaxyWarpRequirement(galaxyId);
        return Math.max(1, Math.round(Number(req) || 1));
    }

    getExploreBudget(stationLevels) {
        const nav = Math.max(0, Math.round(Number((stationLevels && stationLevels.nav_computer) || 0)));
        return 1 + nav;
    }

    getShipFrameUpgradeCost(nextLevel) {
        const lv = Math.max(1, Math.round(Number(nextLevel) || 1));
        if (lv > this.maxShipFrameLevel) return null;
        const cost = {
            scrap: 40 + lv * 35,
            ore: Math.max(0, 10 + lv * 12)
        };
        if (lv >= 3) cost.crystal = 10 + (lv - 2) * 15;
        if (lv >= 6) cost.voltex = 8 + (lv - 5) * 12;
        return cost;
    }

    getModuleUpgradeCost(category, track, nextLevel) {
        const cat = this.moduleUpgradeDefs[category];
        if (!cat || !cat[track]) return null;
        const max = cat[track].maxLevel;
        const lv = Math.max(1, Math.round(Number(nextLevel) || 1));
        if (lv > max) return null;
        const cost = {
            scrap: 30 + lv * 25,
            ore: 8 + lv * 10
        };
        if (category === 'weapons') {
            if (lv >= 2) cost.crystal = 12 + lv * 8;
        } else if (category === 'defenses') {
            if (lv >= 2) cost.ore = (cost.ore || 0) + 10;
            if (lv >= 2) cost.crystal = 10 + lv * 6;
        } else if (category === 'charge') {
            if (lv >= 2) cost.crystal = 14 + lv * 9;
            if (lv >= 3) cost.voltex = 14;
        } else if (category === 'energy') {
            if (lv >= 2) cost.crystal = 14 + lv * 8;
            if (lv >= 3) cost.voltex = 10;
        } else if (category === 'collector') {
            if (lv >= 2) cost.ore = (cost.ore || 0) + 8 + lv * 6;
            if (lv >= 2) cost.crystal = 10 + lv * 7;
            if (lv >= 4) cost.voltex = 8 + lv * 4;
        } else {
            if (lv >= 2) cost.crystal = 15 + lv * 10;
            if (lv >= 3) cost.voltex = 12;
        }
        return cost;
    }

    emptyModuleUpgrades() {
        const out = { weapons: {}, defenses: {}, abilities: {} };
        Object.keys(this.moduleUpgradeDefs).forEach((cat) => {
            out[cat] = {};
            Object.keys(this.moduleUpgradeDefs[cat]).forEach((track) => {
                out[cat][track] = 0;
            });
        });
        return out;
    }

    getStationUpgradeNode(id) {
        return this.stationUpgradeNodes[id] || null;
    }

    getStationUpgradeCost(nodeId, nextLevel) {
        const node = this.getStationUpgradeNode(nodeId);
        if (!node) return null;
        const idx = Math.max(0, Math.round(Number(nextLevel) || 1) - 1);
        if (idx < 0 || idx >= node.costs.length) return null;
        return Object.assign({}, node.costs[idx]);
    }

    computeStationStats(levels) {
        const lv = levels || {};
        const stats = Object.assign({}, this.stationBaseStats, {
            impulseDrive: 0,
            warpDrive: 0,
            exploreBudget: 1
        });
        this.stationUpgradeOrder.forEach((id) => {
            const node = this.stationUpgradeNodes[id];
            if (!node || typeof node.effect !== 'function') return;
            const n = Math.max(0, Math.min(node.maxLevel, Math.round(Number(lv[id]) || 0)));
            if (n <= 0) return;
            const bonus = node.effect(n) || {};
            Object.keys(bonus).forEach((k) => {
                stats[k] = (stats[k] || 0) + (bonus[k] || 0);
            });
        });
        stats.resourceCap = Math.max(1, Math.round(stats.resourceCap));
        stats.cargoCap = Math.max(1, Math.round(stats.cargoCap));
        stats.shipSlots = Math.max(1, Math.round(stats.shipSlots));
        stats.craftDiscount = Math.max(0, Math.min(0.7, Number(stats.craftDiscount) || 0));
        stats.dropBonus = Math.max(0, Math.min(0.4, Number(stats.dropBonus) || 0));
        stats.impulseDrive = Math.max(0, Math.round(stats.impulseDrive || 0));
        stats.warpDrive = Math.max(0, Math.round(stats.warpDrive || 0));
        stats.exploreBudget = Math.max(1, Math.round(this.getExploreBudget(lv)));
        return stats;
    }

    getResourceLabel(id) {
        return this.resourceLabels[id] || String(id || '').toUpperCase();
    }

    getResourceColor(id) {
        const key = String(id || '').toLowerCase();
        return this.resourceColors[key] || '#b8b0a0';
    }

    getResourceIconKey(id) {
        const key = String(id || '').toLowerCase();
        return this.resourceIconKeys[key] || 'resScrap';
    }

    resourceIdFromIconKey(iconKey) {
        const k = String(iconKey || '');
        const entry = Object.keys(this.resourceIconKeys || {}).find((id) => this.resourceIconKeys[id] === k);
        return entry || null;
    }

    getVictoryLootGraceMs() {
        const n = Number(this.victoryLootGraceMs);
        return Math.max(3000, isFinite(n) ? n : 10000);
    }

    getResourceTradeValue(id) {
        const key = String(id || '').toLowerCase();
        const v = this.resourceTradeValue[key];
        return v != null ? v : 1;
    }

    isResourceTradeable(id) {
        const key = String(id || '').toLowerCase();
        return key && this.resourceIds.indexOf(key) !== -1;
    }

    /** Credits cost to buy `amount` units of a material resource. */
    getResourceBuyCost(id, amount) {
        const key = String(id || '').toLowerCase();
        const n = Math.max(0, Math.round(Number(amount) || 0));
        if (!this.isResourceTradeable(key) || n <= 0) return null;
        const unit = this.getResourceTradeValue(key) * this.resourceBuyMult;
        return { credits: Math.max(1, Math.ceil(unit * n)) };
    }

    /** Credits payout for selling `amount` units of a material resource. */
    getResourceSellPayout(id, amount) {
        const key = String(id || '').toLowerCase();
        const n = Math.max(0, Math.round(Number(amount) || 0));
        if (!this.isResourceTradeable(key) || n <= 0) return null;
        const unit = this.getResourceTradeValue(key) * this.resourceSellMult;
        return { credits: Math.max(1, Math.floor(unit * n)) };
    }

    /**
     * Convert a material cost map into an uncapped CREDITS price.
     */
    materialCostToCredits(costMap) {
        let total = 0;
        Object.keys(costMap || {}).forEach((id) => {
            const n = Math.max(0, Math.round(Number(costMap[id]) || 0));
            if (n <= 0) return;
            if (id === 'credits') {
                total += n;
                return;
            }
            total += n * this.getResourceTradeValue(id);
        });
        return Math.max(1, Math.ceil(total));
    }

    /**
     * Material breakdown for a ship (used by craft). Scrap is a real resource here.
     */
    getShopMaterialCost(shipConfig) {
        const cost = Math.max(0, Math.round(Number((shipConfig && shipConfig.cost) || 0)));
        if (cost <= 0) {
            return { scrap: 120 };
        }
        if (cost <= 50) {
            return {
                scrap: Math.ceil(cost * 4),
                ore: Math.ceil(cost * 2)
            };
        }
        if (cost <= 75) {
            return {
                scrap: Math.ceil(cost * 3.2),
                ore: Math.ceil(cost * 2.5),
                crystal: Math.ceil(cost * 1.2)
            };
        }
        return {
            scrap: Math.ceil(cost * 2.8),
            ore: Math.ceil(cost * 2.2),
            crystal: Math.ceil(cost * 1.6),
            voltex: Math.max(40, Math.ceil(cost * 0.6))
        };
    }

    /**
     * Shop buy price in CREDITS (money). Materials stay for craft/upgrades.
     */
    getShopCost(shipConfig) {
        return { credits: this.materialCostToCredits(this.getShopMaterialCost(shipConfig)) };
    }

    /** Craft costs materials (scrap/ore/…), more than shop credit value implies. */
    getCraftCost(shipConfig) {
        const shop = this.getShopMaterialCost(shipConfig);
        const craft = {};
        Object.keys(shop).forEach((id) => {
            craft[id] = Math.ceil(shop[id] * 1.5);
        });
        if (!craft.scrap) craft.scrap = 80;
        return craft;
    }

    /** Blueprint listing — CREDITS, cheaper than the finished ship. */
    getBlueprintCost(shipConfig) {
        const mat = this.getShopMaterialCost(shipConfig);
        const bpMat = {};
        Object.keys(mat).forEach((id) => {
            bpMat[id] = Math.max(20, Math.ceil(mat[id] * 0.45));
        });
        if (!bpMat.scrap) bpMat.scrap = 60;
        return { credits: this.materialCostToCredits(bpMat) };
    }

    /**
     * Part shop price in CREDITS.
     * kind: 'weapon' | 'defense' | 'ability' | 'energy'
     */
    getPartMaterialCost(kind, item) {
        if (kind === 'weapon') {
            const dmg = Math.max(1, Number((item && item.damage) || 10));
            const cd = Math.max(50, Number((item && item.cooldown) || 300));
            const score = Math.round(dmg * 2 + (400 / cd) * 8);
            if (score <= 20) return { scrap: 85, ore: 35 };
            if (score <= 35) return { scrap: 140, ore: 55, crystal: 25 };
            return { scrap: 200, ore: 80, crystal: 45, voltex: 20 };
        }
        const tier = Math.max(0, Math.round(Number((item && item.tier) || 1)));
        if (kind === 'energy') {
            if (tier <= 1) return { scrap: 95, ore: 40, crystal: 15 };
            if (tier <= 2) return { scrap: 150, ore: 60, crystal: 35 };
            return { scrap: 210, ore: 85, crystal: 50, voltex: 25 };
        }
        if (kind === 'ability') {
            if (tier <= 1) return { scrap: 110, ore: 45 };
            if (tier <= 2) return { scrap: 170, ore: 70, crystal: 40 };
            return { scrap: 240, ore: 95, crystal: 55, voltex: 30 };
        }
        if (tier <= 1) return { scrap: 100, ore: 40 };
        if (tier <= 2) return { scrap: 160, ore: 65, crystal: 35 };
        return { scrap: 220, ore: 85, crystal: 50, voltex: 25 };
    }

    getPartCost(kind, item) {
        return { credits: this.materialCostToCredits(this.getPartMaterialCost(kind, item)) };
    }

    getBlueprintDropChance(info) {
        if (!info) return this.blueprintDropChance.default;
        if (info.champion) return this.blueprintDropChance.champion;
        const cls = String(info.enemyClass || '').toLowerCase();
        if (this.blueprintDropChance[cls] != null) return this.blueprintDropChance[cls];
        return this.blueprintDropChance.default;
    }

    pickBlueprintShipId(excludeOwned) {
        const exclude = new Set(Array.isArray(excludeOwned) ? excludeOwned : []);
        exclude.add(this.starterShipId);
        let pool = [];
        if (typeof shipConfigManager !== 'undefined') {
            pool = shipConfigManager.getTypeIds().filter((id) => {
                if (exclude.has(id)) return false;
                if (id === this.starterShipId) return false;
                const cfg = shipConfigManager.getConfig(id);
                return cfg && !cfg.custom;
            });
        }
        if (!pool.length) {
            pool = ['player', 'player_interceptor', 'player_assault', 'player_heavy'].filter((id) => !exclude.has(id));
        }
        if (!pool.length) return null;
        return pool[Math.floor(Math.random() * pool.length)];
    }

    rollAmount(min, max) {
        const a = Math.max(0, Math.round(Number(min) || 0));
        const b = Math.max(a, Math.round(Number(max) || a));
        return a + Math.floor(Math.random() * (b - a + 1));
    }

    rollPlanetResources(resourceTable) {
        const table = Array.isArray(resourceTable) ? resourceTable : [];
        const granted = {};
        table.forEach((entry) => {
            const id = String((entry && entry.id) || '').toLowerCase();
            if (!id || this.resourceIds.indexOf(id) === -1) return;
            const amount = this.rollAmount(entry.min, entry.max);
            if (amount > 0) {
                granted[id] = (granted[id] || 0) + amount;
            }
        });
        return granted;
    }

    getPlanetResourceTable(planetId) {
        const pid = String(planetId || '').toLowerCase();
        if (typeof planetConfigManager !== 'undefined') {
            const cfg = planetConfigManager.getConfig(pid);
            if (cfg && Array.isArray(cfg.resources) && cfg.resources.length) {
                return cfg.resources;
            }
        }
        return this.defaultPlanetResources[pid] || this.defaultPlanetResources.mars || [
            { id: 'scrap', weight: 4, min: 1, max: 3 },
            { id: 'ore', weight: 2, min: 1, max: 2 }
        ];
    }

    getEnemyDropScale(info) {
        if (!info) return this.enemyDropScale.default;
        if (info.champion) return this.enemyDropScale.champion;
        const cls = String(info.enemyClass || '').toLowerCase();
        if (this.enemyDropScale[cls] != null) return this.enemyDropScale[cls];
        return this.enemyDropScale.default;
    }

    pickWeightedResourceId(table) {
        const pool = Array.isArray(table) ? table.filter((e) => {
            const id = String((e && e.id) || '').toLowerCase();
            return id && this.resourceIds.indexOf(id) !== -1;
        }) : [];
        if (!pool.length) return 'scrap';
        let total = 0;
        pool.forEach((e) => { total += Math.max(1, Number(e.weight) || 1); });
        let r = Math.random() * total;
        for (let i = 0; i < pool.length; i++) {
            r -= Math.max(1, Number(pool[i].weight) || 1);
            if (r <= 0) return String(pool[i].id).toLowerCase();
        }
        return String(pool[pool.length - 1].id).toLowerCase();
    }

    /**
     * Roll world pickups for a killed enemy.
     * Returns [{ id, amount }, ...] (often 1–3 entries).
     */
    rollEnemyKillDrops(info, planetId, yieldMul) {
        const table = this.getPlanetResourceTable(planetId);
        const scale = this.getEnemyDropScale(info);
        const mul = Math.max(0.5, Number(yieldMul) || 1);
        const rollCount = info && info.champion
            ? 2 + Math.floor(Math.random() * 2)
            : (scale >= 1.4 ? 1 + Math.floor(Math.random() * 2) : 1);
        const drops = [];
        for (let i = 0; i < rollCount; i++) {
            const id = this.pickWeightedResourceId(table);
            const entry = table.find((e) => String((e && e.id) || '').toLowerCase() === id) || null;
            const baseMin = entry ? Math.max(1, Math.round((Number(entry.min) || 1) * 0.12)) : 1;
            const baseMax = entry ? Math.max(baseMin, Math.round((Number(entry.max) || 2) * 0.18)) : 2;
            let amount = this.rollAmount(baseMin, baseMax);
            amount = Math.max(1, Math.round(amount * scale * mul));
            drops.push({ id, amount });
        }
        return drops;
    }

    formatCost(costMap) {
        const parts = [];
        Object.keys(costMap || {}).forEach((id) => {
            const n = costMap[id];
            if (n > 0) parts.push(`${n} ${this.getResourceLabel(id)}`);
        });
        return parts.join(' + ') || 'FREE';
    }

    canAfford(wallet, costMap) {
        const w = wallet || {};
        const c = costMap || {};
        return Object.keys(c).every((id) => (w[id] || 0) >= c[id]);
    }
}

const economyConfig = new EconomyConfig();
window.economyConfig = economyConfig;
