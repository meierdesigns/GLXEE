"use strict";

// Import all abilities
import { balancedCombatAbility } from './balanced-combat.js';
import { versatileWeaponsAbility } from './versatile-weapons.js';
import { adaptiveShieldAbility } from './adaptive-shield.js';
import { evasionBoostAbility } from './evasion-boost.js';
import { weaponSystemsAbility } from './weapon-systems.js';
import { playerControlAbility } from './player-control.js';
import { massiveArmorAbility } from './massive-armor.js';
import { devastatingCannonAbility } from './devastating-cannon.js';
import { energyShieldAbility } from './energy-shield.js';
import { bossAiAbility } from './boss-ai.js';

// Ability Manager - Centralized ability system
export class AbilityManager {
    constructor() {
        this.abilities = new Map();
        this.activeAbilities = new Map();
        this.initializeAbilities();
    }
    
    // Initialize all abilities
    initializeAbilities() {
        // Player ship abilities
        this.abilities.set('balanced_combat', balancedCombatAbility);
        this.abilities.set('versatile_weapons', versatileWeaponsAbility);
        this.abilities.set('adaptive_shield', adaptiveShieldAbility);
        this.abilities.set('evasion_boost', evasionBoostAbility);
        this.abilities.set('weapon_systems', weaponSystemsAbility);
        this.abilities.set('player_control', playerControlAbility);
        
        // Enemy ship abilities
        this.abilities.set('massive_armor', massiveArmorAbility);
        this.abilities.set('devastating_cannon', devastatingCannonAbility);
        this.abilities.set('energy_shield', energyShieldAbility);
        this.abilities.set('boss_ai', bossAiAbility);
    }
    
    // Get ability by name
    getAbility(name) {
        return this.abilities.get(name);
    }
    
    // Get abilities for a ship
    getShipAbilities(shipAbilities) {
        const shipAbilityObjects = [];
        
        for (const abilityName of shipAbilities) {
            const ability = this.getAbility(abilityName);
            if (ability) {
                shipAbilityObjects.push(ability);
            }
        }
        
        return shipAbilityObjects;
    }
    
    // Activate an ability
    activateAbility(abilityName, shipId) {
        const ability = this.getAbility(abilityName);
        if (!ability) return false;
        
        // Check if ability can be activated
        if (ability.activation.type === 'manual') {
            const activeKey = `${shipId}_${abilityName}`;
            const lastActivation = this.activeAbilities.get(activeKey);
            
            if (lastActivation && Date.now() - lastActivation < ability.activation.cooldown) {
                return false; // Still on cooldown
            }
            
            // Mark as activated
            this.activeAbilities.set(activeKey, Date.now());
        }
        
        return true;
    }
    
    // Check if ability is active
    isAbilityActive(abilityName, shipId) {
        const ability = this.getAbility(abilityName);
        if (!ability) return false;
        
        if (ability.activation.type === 'always_active') {
            return true;
        }
        
        const activeKey = `${shipId}_${abilityName}`;
        const lastActivation = this.activeAbilities.get(activeKey);
        
        if (!lastActivation) return false;
        
        const elapsed = Date.now() - lastActivation;
        return elapsed < ability.activation.duration;
    }
    
    // Get ability effects for a ship
    getShipEffects(shipAbilities, shipId) {
        const effects = {
            damageModifier: 1.0,
            speedModifier: 1.0,
            healthModifier: 1.0,
            armorModifier: 1.0,
            accuracyModifier: 1.0,
            cooldownModifier: 1.0,
            shieldStrength: 1.0,
            damageReduction: 0,
            evasionChance: 0,
            criticalChance: 0
        };
        
        for (const abilityName of shipAbilities) {
            const ability = this.getAbility(abilityName);
            if (!ability) continue;
            
            // Check if ability is active
            if (!this.isAbilityActive(abilityName, shipId)) continue;
            
            // Apply ability effects
            const abilityEffects = ability.effects;
            for (const [effectName, value] of Object.entries(abilityEffects)) {
                if (effects.hasOwnProperty(effectName)) {
                    if (effectName.includes('Modifier')) {
                        effects[effectName] *= value;
                    } else {
                        effects[effectName] += value;
                    }
                }
            }
        }
        
        return effects;
    }
    
    // Get ability descriptions for UI
    getAbilityDescriptions(shipAbilities) {
        const descriptions = [];
        
        for (const abilityName of shipAbilities) {
            const ability = this.getAbility(abilityName);
            if (ability) {
                const cfgIcon = (typeof abilityConfigManager !== 'undefined')
                    ? abilityConfigManager.getIcon(abilityName)
                    : null;
                descriptions.push({
                    name: ability.name,
                    description: ability.description,
                    icon: cfgIcon || ability.icon,
                    color: ability.color,
                    type: ability.type,
                    tier: ability.tier,
                    uiDescription: ability.uiDescription,
                    detailedDescription: ability.detailedDescription
                });
            }
        }
        
        return descriptions;
    }
    
    // Update ability cooldowns
    updateAbilities(deltaTime) {
        // This would be called from the game loop to update ability states
        // For now, we rely on timestamp-based checking
    }
}

// Create global instance
export const abilityManager = new AbilityManager();
