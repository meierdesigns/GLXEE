"use strict";

// IconSprites data lives in icon-sprites/*.js, which index.html loads before this file.

IconSprites.shotNormal = IconSprites.shotLaser;
IconSprites.menuWeapons = IconSprites.statWeapon;
IconSprites.menuAbilities = IconSprites.statAbilities;
IconSprites.menuDefense = IconSprites.statArmor;
IconSprites.menuVolker = IconSprites.menuPeoples;
IconSprites.menuFactions = IconSprites.menuPeoples;
IconSprites.galaxy_milky_way = IconSprites.galaxyMilkyWay;
IconSprites.galaxy_andromeda = IconSprites.galaxyAndromeda;
IconSprites.galaxy_default = IconSprites.galaxyDefault;
IconSprites.faction_terran = IconSprites.factionTerran;
IconSprites.faction_kronax = IconSprites.factionKronax;
IconSprites.faction_voidborn = IconSprites.factionVoidborn;
IconSprites.faction_pirate = IconSprites.factionPirate;
IconSprites.faction_machine = IconSprites.factionMachine;

window.IconSprites = IconSprites;

/** Display labels for icon tooltips (overrides auto-format from key). */
const IconLabels = {
    shotLaser: 'LASER',
    shotNormal: 'LASER',
    shotSpread: 'SPREAD',
    shotRapid: 'RAPID',
    shotPlasma: 'PLASMA',
    shotMissile: 'MISSILE',
    shotIon: 'ION',
    shotWave: 'WAVE',
    shotBurst: 'BURST',
    shotPierce: 'PIERCE',
    shotNova: 'NOVA',
    statHealth: 'HEALTH',
    statArmor: 'DEFENSE',
    statEnergy: 'ENERGY',
    statShield: 'SHIELD',
    statDamage: 'DAMAGE',
    statSpeed: 'SPEED',
    statWeapon: 'WEAPONS',
    statAbilities: 'ABILITIES',
    menuStart: 'START',
    menuProfiles: 'PROFILES',
    menuShips: 'SHIPS',
    menuPlanets: 'PLANETS',
    menuEnemies: 'ENEMIES',
    menuWeapons: 'WEAPONS',
    menuAbilities: 'ABILITIES',
    menuDefense: 'DEFENSE',
    menuPeoples: 'FACTIONS',
    menuVolker: 'FACTIONS',
    menuFactions: 'FACTIONS',
    menuSettings: 'SETTINGS',
    menuCredits: 'CREDITS',
    menuAssets: 'ASSETS',
    menuRetry: 'RETRY',
    menuHome: 'HOME',
    hsStation: 'STATION',
    hsShop: 'SHOP',
    hsCraft: 'CRAFT',
    hsComponents: 'COMPONENTS',
    hsHangar: 'HANGAR',
    hsStores: 'STORES',
    hsCargo: 'CARGO',
    hsBlueprint: 'BLUEPRINT',
    hsShip: 'SHIP',
    hsTeleport: 'TELEPORT',
    hsUpgrade: 'UPGRADE',
    hsTravel: 'TRAVEL',
    hsExplore: 'EXPLORE',
    resScrap: 'SCRAP',
    resOre: 'ORE',
    resCrystal: 'CRYSTAL',
    resVoltex: 'VOLTEX',
    resMissing: 'MISSING RESOURCE',
    galaxyMilkyWay: 'MILKY WAY',
    galaxyAndromeda: 'ANDROMEDA',
    galaxyDefault: 'GALAXY',
    galaxy_milky_way: 'MILKY WAY',
    galaxy_andromeda: 'ANDROMEDA',
    galaxy_default: 'GALAXY',
    factionTerran: 'TERRAN',
    factionKronax: 'KRONAX',
    factionVoidborn: 'VOIDBORN',
    factionPirate: 'PIRATE',
    factionMachine: 'MACHINE',
    faction_terran: 'TERRAN',
    faction_kronax: 'KRONAX',
    faction_voidborn: 'VOIDBORN',
    faction_pirate: 'PIRATE',
    faction_machine: 'MACHINE'
};
window.IconLabels = IconLabels;
