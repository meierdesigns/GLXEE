"use strict";

// ModuleSprites data lives in module-sprites/*.js, which index.html loads before this file.

// Generic fallbacks by kind / role
ModuleSprites.mount_weapon = ModuleSprites.mount_laser;
ModuleSprites.mount_defense = ModuleSprites.mount_heavy_armor;
ModuleSprites.mount_ability = ModuleSprites.mount_weapon_systems;
ModuleSprites.mount_energy = ModuleSprites.mount_energy_core;
ModuleSprites.mount_charge_shield_sync = ModuleSprites.mount_energy_shield;
ModuleSprites.mount_shield_divert = ModuleSprites.mount_adaptive_shield;
ModuleSprites.mount_plating = ModuleSprites.mount_heavy_armor;
ModuleSprites.mount_hardpoint = ModuleSprites.mount_laser;
ModuleSprites.mount_thruster = ModuleSprites.mount_charge_drive;
ModuleSprites.mount_pod = ModuleSprites.mount_weapon_systems;
ModuleSprites.mount_core = ModuleSprites.mount_energy_core;

window.ModuleSprites = ModuleSprites;
