# 🛸 GLXEE - ASSET DATABASE

> **CLASSIFICATION: TECHNICAL SPECIFICATIONS**  
> **CLEARANCE LEVEL: ENGINEERING**  
> **AUTHORIZATION: UNITED GALACTIC DEFENSE FORCE**

---

## 🌌 ASSET MANAGEMENT SYSTEM

Welcome to the **GLXEE Asset Database**, the comprehensive repository of all spacecraft, weaponry, environmental elements, and tactical components used in the intergalactic combat simulation.

### 🎯 ASSET CATEGORIZATION

All assets are organized into specialized categories for efficient management and deployment:

---

## 🚀 SPACECRAFT HANGAR (`ships/`)

### ⚡ PLAYER VESSEL FLEET

#### **Starfighter Class** - `player-starfighter-model.js`
- **CLASSIFICATION**: High-speed interceptor
- **TIER**: I (Entry-level combat vessel)
- **DIMENSIONS**: 20x16 pixels
- **SPECIALIZATION**: Precision strikes, hit-and-run tactics
- **COMBAT RATING**: ⭐⭐⭐

#### **Interceptor Class** - `player-interceptor-model.js`
- **CLASSIFICATION**: Advanced strike craft
- **TIER**: II (Intermediate combat vessel)
- **DIMENSIONS**: 20x16 pixels
- **SPECIALIZATION**: Rapid engagement, tactical superiority
- **COMBAT RATING**: ⭐⭐⭐⭐

#### **Heavy Fighter Class** - `player-heavy-fighter-model.js`
- **CLASSIFICATION**: Armored assault vessel
- **TIER**: III (Heavy combat vessel)
- **DIMENSIONS**: 20x16 pixels
- **SPECIALIZATION**: Sustained combat, heavy weapons platform
- **COMBAT RATING**: ⭐⭐⭐⭐⭐

#### **Assault Ship Class** - `player-assault-model.js`
- **CLASSIFICATION**: Heavy weapons platform
- **TIER**: IV (Elite combat vessel)
- **DIMENSIONS**: 20x16 pixels
- **SPECIALIZATION**: Maximum firepower, siege operations
- **COMBAT RATING**: ⭐⭐⭐⭐⭐⭐

### 🛡️ HOSTILE THREAT VESSELS

#### **Scout Class** - `scout-model.js`
- **CLASSIFICATION**: Reconnaissance vessel
- **THREAT LEVEL**: Low
- **DIMENSIONS**: 16x12 pixels
- **CAPABILITIES**: Intelligence gathering, early warning
- **DANGER RATING**: ⚠️

#### **Fighter Class** - `fighter-model.js`
- **CLASSIFICATION**: Standard combat vessel
- **THREAT LEVEL**: Medium
- **DIMENSIONS**: 18x14 pixels
- **CAPABILITIES**: Standard combat operations
- **DANGER RATING**: ⚠️⚠️

#### **Interceptor Class** - `interceptor-model.js`
- **CLASSIFICATION**: High-speed attack craft
- **THREAT LEVEL**: High
- **DIMENSIONS**: 20x16 pixels
- **CAPABILITIES**: Rapid strikes, evasion tactics
- **DANGER RATING**: ⚠️⚠️⚠️

#### **Cruiser Class** - `cruiser-model.js`
- **CLASSIFICATION**: Heavy combat vessel
- **THREAT LEVEL**: Critical
- **DIMENSIONS**: 24x20 pixels
- **CAPABILITIES**: Heavy weapons, sustained combat
- **DANGER RATING**: ⚠️⚠️⚠️⚠️

#### **Battleship Class** - `battleship-model.js`
- **CLASSIFICATION**: Ultimate warship
- **THREAT LEVEL**: Extreme
- **DIMENSIONS**: 28x24 pixels
- **CAPABILITIES**: Maximum firepower, siege warfare
- **DANGER RATING**: ⚠️⚠️⚠️⚠️⚠️

### 🛰️ FACTION SILHOUETTE GRID (`enemy-{faction}-{enemyClass}`)

Procedural / generated hostile hulls use a **fixed lo-fi grid** (18×14) with a **shared gray palette**. Identity is silhouette topology only — not hull color coding.

| Faction | Classes |
|:--------|:--------|
| terran · kronax · voidborn · pirate · machine | scout · assault · heavy · elite · capital |

- Style registry: `js/graphics/faction-ship-styles.js`
- Loader: `assets/ships/ship-asset-loader.js` + `assets/sprite-loader.js`
- Asset-gen keys: `enemy-{faction}-{enemyClass}`

### 📡 COMBAT-EVENT SUPPORT CRAFT

Champion escorts (repair / shield battery / gunners / jammer / tether) reference archetypes in `js/core/combat-event-config.js` and spawn through `js/game/enemies.js`.

---

## ⚔️ WEAPON SYSTEMS (`weapons/`)

### 🔫 PRIMARY WEAPON MODULES

#### **Plasma Cannon** - `laser.js`
- **CLASSIFICATION**: Standard energy weapon
- **DAMAGE OUTPUT**: 15 HP per projectile
- **RATE OF FIRE**: Standard (60 RPM)
- **ENERGY CONSUMPTION**: Low
- **EFFECTIVENESS**: Optimal for single targets

#### **Spread-Fire Array** - `spread-shot.js`
- **CLASSIFICATION**: Multi-target suppression weapon
- **DAMAGE OUTPUT**: 15 HP per projectile (3 projectiles)
- **RATE OF FIRE**: Standard (60 RPM)
- **ENERGY CONSUMPTION**: Medium
- **EFFECTIVENESS**: Excellent for multiple targets

#### **Rapid-Fire Module** - `rapid-fire.js`
- **CLASSIFICATION**: High-speed assault weapon
- **DAMAGE OUTPUT**: 15 HP per projectile (2 projectiles)
- **RATE OF FIRE**: High (120 RPM)
- **ENERGY CONSUMPTION**: High
- **EFFECTIVENESS**: Superior for sustained combat

---

## 🪐 ENVIRONMENTAL ASSETS (`backgrounds/`)

### 🌍 PLANETARY ENVIRONMENTS

#### **Mars Desert Zone** - `mars.js`
- **ENVIRONMENT TYPE**: Harsh desert terrain
- **ATMOSPHERIC CONDITIONS**: Thin, dust-laden atmosphere
- **VISUAL CHARACTERISTICS**: Red-orange color palette
- **HAZARDS**: Dust storms, sand formations

#### **Jupiter Storm Zone** - `jupiter.js`
- **ENVIRONMENT TYPE**: Gas giant atmospheric layers
- **ATMOSPHERIC CONDITIONS**: Dense, turbulent gas layers
- **VISUAL CHARACTERISTICS**: Swirling cloud patterns
- **HAZARDS**: Atmospheric disturbances, energy storms

#### **Saturn Ring System** - `saturn.js`
- **ENVIRONMENT TYPE**: Complex ring particle fields
- **ATMOSPHERIC CONDITIONS**: Ring particle density variations
- **VISUAL CHARACTERISTICS**: Ring shadow patterns
- **HAZARDS**: Ring debris, gravitational anomalies

#### **Neptune Ice Depths** - `neptune.js`
- **ENVIRONMENT TYPE**: Frozen methane oceans
- **ATMOSPHERIC CONDITIONS**: Cryogenic methane atmosphere
- **VISUAL CHARACTERISTICS**: Blue-ice color palette
- **HAZARDS**: Ice formations, cryogenic hazards

#### **Pluto Void Frontier** - `pluto.js`
- **ENVIRONMENT TYPE**: Deep space void
- **ATMOSPHERIC CONDITIONS**: Near-vacuum conditions
- **VISUAL CHARACTERISTICS**: Dark, starfield background
- **HAZARDS**: Dark matter anomalies, void creatures

---

## 🛡️ OBSTACLE SYSTEMS (`obstacles/`)

### ⚡ ENERGY BARRIERS

#### **Energy Shield** - `energy-shield.js`
- **CLASSIFICATION**: Reflective barrier technology
- **DURABILITY**: 1 HP (fragile but effective)
- **SPECIAL PROPERTIES**: Reflects incoming projectiles
- **PHYSICS**: Advanced diagonal reflection algorithms
- **VISUAL**: Clean, reflective appearance with hollow core

### 🪨 ASTEROID FORMATIONS

#### **Small Asteroid** - `small-asteroid.js`
- **CLASSIFICATION**: Minor space debris
- **DURABILITY**: 1 HP
- **SIZE**: 12x12 pixels
- **BEHAVIOR**: Destructible, blocks projectiles

#### **Medium Asteroid** - `medium-asteroid.js`
- **CLASSIFICATION**: Standard space debris
- **DURABILITY**: 2 HP
- **SIZE**: 16x16 pixels
- **BEHAVIOR**: Destructible, blocks projectiles

#### **Large Asteroid** - `large-asteroid.js`
- **CLASSIFICATION**: Major space debris
- **DURABILITY**: 3 HP
- **SIZE**: 20x20 pixels
- **BEHAVIOR**: Destructible, blocks projectiles

---

## 🎵 AUDIO SYSTEMS (`sounds/`)

### 🔊 SOUND EFFECTS

#### **Weapon Audio** - `sound-effects.js`
- **PLASMA CANNON**: High-energy discharge sounds
- **SPREAD FIRE**: Multi-projectile launch audio
- **RAPID FIRE**: High-speed burst sequences
- **IMPACT EFFECTS**: Hull impacts, shield deflections
- **EXPLOSION SOUNDS**: Destruction audio sequences

#### **Environmental Audio** - `music.js`
- **BACKGROUND MUSIC**: Dynamic combat soundtrack
- **AMBIENT SOUNDS**: Environmental audio cues
- **TACTICAL ALERTS**: Warning and notification sounds
- **VICTORY THEMES**: Mission completion audio

---

## 🎨 USER INTERFACE ASSETS (`ui/`)

### 🖥️ INTERFACE COMPONENTS

#### **Weapon Icons** - `shot-type-icons.js`
- **NORMAL SHOT ICON**: Single projectile indicator
- **SPREAD SHOT ICON**: Multi-projectile indicator
- **RAPID FIRE ICON**: High-speed burst indicator
- **VISUAL DESIGN**: Retro-futuristic iconography

---

## 🎯 LEVEL CONFIGURATIONS (`levels/`)

### 🌍 PLANETARY THEATER SETTINGS

#### **Mars Level** - `mars.js`
- **DIFFICULTY**: Easy
- **OBSTACLE PATTERNS**: Basic rock formations, dust clouds
- **SPAWN RATES**: Low threat density
- **MOVEMENT SPEEDS**: Standard velocity

#### **Jupiter Level** - `jupiter.js`
- **DIFFICULTY**: Medium
- **OBSTACLE PATTERNS**: Atmospheric disturbances, energy storms
- **SPAWN RATES**: Moderate threat density
- **MOVEMENT SPEEDS**: Variable velocity

#### **Saturn Level** - `saturn.js`
- **DIFFICULTY**: Hard
- **OBSTACLE PATTERNS**: Ring debris, gravitational anomalies
- **SPAWN RATES**: High threat density
- **MOVEMENT SPEEDS**: Complex velocity patterns

#### **Neptune Level** - `neptune.js`
- **DIFFICULTY**: Expert
- **OBSTACLE PATTERNS**: Ice formations, cryogenic hazards
- **SPAWN RATES**: Very high threat density
- **MOVEMENT SPEEDS**: High velocity

#### **Pluto Level** - `pluto.js`
- **DIFFICULTY**: Legendary
- **OBSTACLE PATTERNS**: Dark matter anomalies, void creatures
- **SPAWN RATES**: Maximum threat density
- **MOVEMENT SPEEDS**: Extreme velocity

---

## 🔧 ASSET FORMAT SPECIFICATIONS

### 📐 SPRITE DEFINITION STANDARD

All visual assets use JavaScript modules with pixel art sprites defined as 2D arrays:

```javascript
// Example spacecraft sprite definition
const spacecraftSprite = [
    [0, 0, 1, 1, 1, 0, 0],  // Row 1: Background, hull, hull, hull, background
    [0, 1, 2, 2, 2, 1, 0],  // Row 2: Background, armor, core, core, armor, background
    [1, 2, 3, 3, 3, 2, 1],  // Row 3: Hull, armor, engine, engine, engine, armor, hull
    // ... additional rows for complete sprite
];

// Color palette mapping
const colorPalette = {
    0: 'transparent',    // Background/void
    1: '#2D5016',        // Dark green (hull)
    2: '#3A7D32',        // Medium green (armor)
    3: '#4CAF50'         // Light green (engine/energy)
};
```

### 🎨 COLOR SYSTEM

- **0**: Transparent background
- **1**: Primary hull color (darkest shade)
- **2**: Secondary armor color (medium shade)
- **3**: Tertiary energy color (lightest shade)
- **4+**: Special effects and highlights

---

## 🚀 ASSET DEPLOYMENT

### 🎯 USAGE PATTERNS

Assets are loaded by the GraphicsManager and accessed via:

```javascript
// Spacecraft asset retrieval
const starfighter = graphicsManager.getSprite('starfighter');
const interceptor = graphicsManager.getSprite('interceptor');

// Weapon system retrieval
const plasmaCannon = graphicsManager.getWeapon('laser');
const spreadArray = graphicsManager.getWeapon('spread-shot');

// Obstacle asset retrieval
const asteroid = graphicsManager.getObstacle('small-asteroid');
const energyShield = graphicsManager.getObstacle('energy-shield');
```

---

## 🔬 TECHNICAL SPECIFICATIONS

### 📊 ASSET STATISTICS

- **TOTAL SPRITES**: 50+ individual assets
- **SPACECRAFT MODELS**: 9 different vessel classes
- **WEAPON SYSTEMS**: 4 primary weapon modules
- **ENVIRONMENTAL ASSETS**: 5 planetary theaters
- **OBSTACLE TYPES**: 6 different formations
- **AUDIO FILES**: 20+ sound effects and music tracks

---

*"In the vast arsenal of intergalactic warfare, every asset is a weapon, every sprite a soldier, every sound a battle cry. Welcome to the GLXEE Asset Database - where precision meets power."*

**- Chief Engineer Marcus Rodriguez, UGDF Technical Division**

---

**CLASSIFICATION: TECHNICAL SPECIFICATIONS**  
**LAST UPDATED**: 2024  
**VERSION**: 1.0.0  
**STATUS**: OPERATIONAL
