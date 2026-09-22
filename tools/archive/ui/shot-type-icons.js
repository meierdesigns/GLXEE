"use strict";

// Shot-type icon assets (16x16) — mirrors IconSprites for module consumers
export const weaponIcons = (typeof IconSprites !== 'undefined' && IconSprites) ? {
    laser: { name: 'LASER_ICON', sprite: IconSprites.shotLaser, width: 16, height: 16 },
    spread: { name: 'SPREAD_ICON', sprite: IconSprites.shotSpread, width: 16, height: 16 },
    rapid: { name: 'RAPID_ICON', sprite: IconSprites.shotRapid, width: 16, height: 16 },
    plasma: { name: 'PLASMA_ICON', sprite: IconSprites.shotPlasma, width: 16, height: 16 },
    missile: { name: 'MISSILE_ICON', sprite: IconSprites.shotMissile, width: 16, height: 16 },
    ion: { name: 'ION_ICON', sprite: IconSprites.shotIon, width: 16, height: 16 },
    wave: { name: 'WAVE_ICON', sprite: IconSprites.shotWave, width: 16, height: 16 },
    burst: { name: 'BURST_ICON', sprite: IconSprites.shotBurst, width: 16, height: 16 },
    pierce: { name: 'PIERCE_ICON', sprite: IconSprites.shotPierce, width: 16, height: 16 },
    nova: { name: 'NOVA_ICON', sprite: IconSprites.shotNova, width: 16, height: 16 }
} : {};

export const shotTypeList = [
    'laser', 'spread', 'rapid', 'plasma', 'missile',
    'ion', 'wave', 'burst', 'pierce', 'nova'
];
