"use strict";

/** Station upgrade tree nodes: core through warp drive. Used by EconomyConfig.stationUpgradeNodes. */
function createBaseStationUpgradeNodes() {
    return {
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
        }
    };
}
