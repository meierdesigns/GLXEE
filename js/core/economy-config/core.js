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
            ...createBaseStationUpgradeNodes(),
            ...createAdvancedStationUpgradeNodes()
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
        // Frame level = sum of the 4 hull area levels (each 0..2, S/M/L).
        this.maxShipFrameLevel = 8;
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

    /**
     * Hull area upgrade (slot size S→M→L). Level 2 adds crystal; the core
     * costs most (it holds defense + energy), the aft least.
     */
    getShipAreaUpgradeCost(areaId, nextLevel) {
        const lv = Math.max(1, Math.round(Number(nextLevel) || 1));
        if (lv > 2) return null;
        const mul = { front: 1, center: 1.25, back: 0.9, wing: 1.1 }[areaId];
        if (!mul) return null;
        const cost = {
            scrap: Math.round((lv === 1 ? 90 : 190) * mul),
            ore: Math.round((lv === 1 ? 30 : 75) * mul)
        };
        if (lv >= 2) cost.crystal = Math.round(35 * mul);
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
}
