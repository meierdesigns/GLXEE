"use strict";

// Boss AI Ability - Battleship
export const bossAiAbility = {
    name: "Boss AI",
    description: "Advanced artificial intelligence with tactical decision making",
    type: "passive",
    tier: 5,
    
    // Visual effects
    icon: "ability_boss_ai",
    color: "var(--current-accent)",
    
    // Game mechanics
    effects: {
        aiIntelligence: 1.5,       // 50% smarter AI
        tacticalAwareness: 1.3,    // 30% better tactics
        reactionTime: 0.7,          // 30% faster reactions
        patternRecognition: 1.4,   // 40% better pattern recognition
        adaptiveBehavior: 1.2      // 20% adaptive behavior
    },
    
    // Activation conditions
    activation: {
        type: "always_active",
        cooldown: 0,
        duration: 0,
        cost: 0
    },
    
    // Visual feedback
    visualEffects: {
        particles: {
            type: "ai_processing",
            color: "var(--current-accent)",
            intensity: 0.3
        },
        sound: "ai_processing"
    },
    
    // Description for UI
    uiDescription: "Advanced AI with superior tactical decision making",
    detailedDescription: "Sophisticated artificial intelligence that makes tactical decisions, adapts to player behavior, and uses advanced combat strategies. This AI is capable of learning and adapting during combat."
};
