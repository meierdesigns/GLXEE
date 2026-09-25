"use strict";

// Sprite Loader - Loads PNG sprites and provides rendering functionality
class SpriteLoader {
    constructor() {
        this.sprites = new Map();
        this.loaded = false;
        this.loadingPromises = new Map();
    }

    // Load a single sprite
    async loadSprite(name, path) {
        if (this.sprites.has(name)) {
            return this.sprites.get(name);
        }

        if (this.loadingPromises.has(name)) {
            return this.loadingPromises.get(name);
        }

        const promise = new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                this.sprites.set(name, img);
                this.loadingPromises.delete(name);
                resolve(img);
            };
            img.onerror = () => {
                this.loadingPromises.delete(name);
                reject(new Error(`Failed to load sprite: ${path}`));
            };
            img.src = path;
        });

        this.loadingPromises.set(name, promise);
        return promise;
    }

    /**
     * Read assets/<folder>/manifest.json (list of PNG stems that exist).
     * Avoids probing every procedural IconSprites key and spamming 404s.
     */
    async readSpriteManifest(folder) {
        try {
            const res = await fetch(`assets/${folder}/manifest.json`, { cache: 'no-store' });
            if (!res.ok) return null;
            const data = await res.json();
            if (Array.isArray(data)) {
                return data.map(String).filter(Boolean);
            }
            if (data && Array.isArray(data.files)) {
                return data.files.map(String).filter(Boolean);
            }
        } catch (_) {
            /* no manifest */
        }
        return null;
    }

    async loadSpriteGroup(names, folder) {
        const manifest = await this.readSpriteManifest(folder);
        const wanted = Array.isArray(names) ? names.map(String) : [];
        const toLoad = manifest
            ? wanted.filter((n) => manifest.indexOf(n) !== -1)
            : wanted;
        if (!toLoad.length) return false;

        const results = await Promise.allSettled(
            toLoad.map((name) => this.loadSprite(name, `assets/${folder}/${name}.png`))
        );
        let loadedCount = 0;
        results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                loadedCount += 1;
            } else {
                console.warn(`Failed to load sprite: ${toLoad[index]}`, result.reason);
            }
        });
        return loadedCount > 0;
    }

    // Load all ship sprites
    async loadShipSprites() {
        const shipSprites = [
            // Player ships
            'player-starfighter', 'player-starfighter-advanced',
            'player-heavy-fighter', 'player-assault', 'player-interceptor',
            'player-bomber', 'player-bomber-heavy', 'player-stealth', 'player-stealth-advanced',
            'player-destroyer', 'player-carrier', 'player-frigate',
            'player-corvette', 'player-gunship', 'player-dreadnought',
            
            // Enemy ships
            'enemy-fighter', 'enemy-battleship', 'enemy-cruiser',
            'enemy-interceptor', 'enemy-scout', 'enemy-destroyer',
            'enemy-carrier', 'enemy-frigate', 'enemy-corvette',
            'enemy-gunship', 'enemy-dreadnought', 'enemy-bomber', 'enemy-stealth'
        ];
        if (typeof factionShipStyles !== 'undefined' && factionShipStyles.listFactionShipSpriteKeys) {
            factionShipStyles.listFactionShipSpriteKeys().forEach((k) => {
                if (shipSprites.indexOf(k) === -1) shipSprites.push(k);
            });
        } else {
            ['terran', 'kronax', 'voidborn', 'pirate', 'machine'].forEach((f) => {
                ['scout', 'assault', 'heavy', 'elite', 'capital'].forEach((c) => {
                    shipSprites.push('enemy-' + f + '-' + c);
                });
            });
        }
        // Hull segments (front/center/back/wingLeft) — loaded only if present in manifest
        const segs = ['front', 'center', 'back', 'wingLeft', 'wingRight', 'wing'];
        const withSegs = shipSprites.slice();
        shipSprites.forEach((base) => {
            segs.forEach((seg) => {
                withSegs.push(base + '-' + seg);
            });
        });
        return this.loadSpriteGroup(withSegs, 'ships/sprites');
    }

    // Load all weapon sprites
    async loadWeaponSprites() {
        const weaponSprites = [
            // Player weapons
            'laser-basic', 'laser-advanced', 'laser-heavy',
            'rapid-fire-basic', 'rapid-fire-advanced', 'rapid-fire-heavy',
            'spread-shot-basic', 'spread-shot-advanced', 'spread-shot-heavy',
            'plasma-basic', 'plasma-advanced', 'plasma-heavy',
            'missile-basic', 'missile-advanced', 'missile-heavy',
            
            // Advanced weapons
            'ion-cannon', 'photon-torpedo', 'quantum-torpedo',
            'disruptor-beam', 'antimatter-cannon', 'gravity-bomb',
            'energy-burst', 'shield-breaker',
            
            // Enemy weapons
            'enemy-laser-basic', 'enemy-laser-advanced', 'enemy-laser-heavy'
        ];
        return this.loadSpriteGroup(weaponSprites, 'weapons/sprites');
    }

    // Load all level sprites
    async loadLevelSprites() {
        const levelSprites = [
            // Mars
            'mars-surface', 'mars-canyon', 'mars-volcano', 'mars-dust-storm',
            'mars-polar-cap', 'mars-phobos', 'mars-deimos', 'mars-sinope',
            
            // Jupiter
            'jupiter-atmosphere', 'jupiter-moons', 'jupiter-red-spot',
            'jupiter-lightning', 'jupiter-magnetosphere', 'jupiter-io', 'jupiter-amalthea',
            
            // Saturn
            'saturn-rings', 'saturn-storm', 'saturn-titan', 'saturn-aurora',
            'saturn-enceladus', 'saturn-europa', 'saturn-himalia',
            
            // Neptune
            'neptune-storm', 'neptune-ice', 'neptune-wind', 'neptune-dark-spot',
            'neptune-triton', 'neptune-ganymede', 'neptune-elara',
            
            // Pluto
            'pluto-surface', 'pluto-ice', 'pluto-mountains', 'pluto-nitrogen',
            'pluto-charon', 'pluto-callisto', 'pluto-pasiphae'
        ];
        return this.loadSpriteGroup(levelSprites, 'levels/sprites');
    }

    async loadSpriteQuiet(name, path) {
        if (this.sprites.has(name)) {
            return this.sprites.get(name);
        }
        if (this.loadingPromises.has(name)) {
            return this.loadingPromises.get(name);
        }
        const promise = new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                this.sprites.set(name, img);
                this.loadingPromises.delete(name);
                resolve(img);
            };
            img.onerror = () => {
                this.loadingPromises.delete(name);
                resolve(null);
            };
            img.src = path;
        });
        this.loadingPromises.set(name, promise);
        return promise;
    }

    /** Load PNG overrides listed in each folder's manifest.json only. */
    async loadOverrideSprites() {
        const folders = [
            'icons/sprites',
            'modules/sprites',
            'obstacles/sprites'
        ];
        for (let i = 0; i < folders.length; i++) {
            const folder = folders[i];
            const names = await this.readSpriteManifest(folder);
            if (!names || !names.length) continue;
            await Promise.all(
                names.map((name) => this.loadSpriteQuiet(name, `assets/${folder}/${name}.png`))
            );
        }
        return true;
    }

    /**
     * Hot-reload a single sprite from a relative URL (optionally cache-busted).
     */
    async reloadSprite(name, url) {
        const key = String(name || '');
        if (!key) return null;
        this.sprites.delete(key);
        this.loadingPromises.delete(key);
        const path = url || null;
        if (!path) return null;
        // loadSprite expects assets/... path without query for errors — allow full URL
        if (this.loadingPromises.has(key)) {
            return this.loadingPromises.get(key);
        }
        const promise = new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                this.sprites.set(key, img);
                this.loadingPromises.delete(key);
                resolve(img);
            };
            img.onerror = () => {
                this.loadingPromises.delete(key);
                reject(new Error('Failed to reload sprite: ' + path));
            };
            img.src = path;
        });
        this.loadingPromises.set(key, promise);
        return promise;
    }

    // Load all sprites
    async loadAllSprites() {
        try {
            const [shipsLoaded] = await Promise.all([
                this.loadShipSprites(),
                this.loadWeaponSprites(),
                this.loadLevelSprites(),
                this.loadOverrideSprites()
            ]);

            // Ship sprites are enough for UI previews; do not block on weapons/levels
            this.loaded = !!shipsLoaded;
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('vf-sprites-loaded', {
                    detail: { loaded: this.loaded, count: this.sprites.size }
                }));
            }
            return this.loaded;
        } catch (error) {
            console.error('Failed to load sprites:', error);
            return false;
        }
    }
}
