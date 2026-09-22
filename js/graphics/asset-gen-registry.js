"use strict";

/**
 * Registry of regeneratable game graphics for the # Asset Generator.
 */
class AssetGenRegistry {
    constructor() {
        this.styleHint =
            "pixel art, pure grayscale only, monochrome gray shades, NO color NO hue, "
            + "solid magenta background #FF00FF, centered, single object, luminance mask for later tint";
    }

    entry(type, id, opts) {
        const o = opts || {};
        const size = o.size != null ? o.size : 64;
        const folder = o.folder || type;
        const fileId = o.fileId || id;
        const out = {
            type: type,
            id: id,
            label: o.label || this.formatLabel(id),
            promptSuffix: o.promptSuffix || this.defaultPrompt(type, id),
            size: size,
            targetPath: o.targetPath || ("assets/" + folder + "/sprites/" + fileId + ".png"),
            filenamePrefix: o.filenamePrefix || (folder + "/vf_" + type),
            spriteKey: o.spriteKey || id
        };
        if (o.faction != null) out.faction = o.faction;
        if (o.enemyClass != null) out.enemyClass = o.enemyClass;
        if (o.kind != null) out.kind = o.kind;
        if (o.segment != null) out.segment = o.segment;
        if (o.parentShip != null) out.parentShip = o.parentShip;
        if (o.mirrorOf != null) out.mirrorOf = o.mirrorOf;
        if (o.integrateModes != null) out.integrateModes = o.integrateModes;
        if (o.zone != null) out.zone = o.zone;
        return out;
    }

    formatLabel(id) {
        return String(id || "")
            .replace(/^mount_/, "")
            .replace(/^ability_/, "")
            .replace(/^shot/, "shot ")
            .replace(/[-_]/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase());
    }

    defaultPrompt(type, id) {
        const name = this.formatLabel(id).toLowerCase();
        switch (type) {
            case "mount":
                return (
                    "tiny top-down ship hardpoint module, " + name
                    + ", compact metal component, chunky 8x8 pixel silhouette, "
                    + "fills frame, high contrast grayscale only, solid simple shape"
                );
            case "icon":
                return "game UI icon, " + name + ", simple glyph, 16x16 pixel feel, grayscale only";
            case "ability":
                return "ability icon, " + name + ", game UI icon, 16x16 pixel feel, grayscale only";
            case "ship":
                return "top-down player spaceship, " + name + ", crisp silhouette, grayscale only";
            case "enemy":
                return "top-down enemy spaceship, " + name + ", hostile silhouette, grayscale only";
            case "shipSegment":
                return this.segmentPrompt(id);
            case "faction":
                return "faction emblem icon, " + name + ", simple glyph, 16x16 pixel feel, game UI icon, grayscale only";
            case "factionShip":
                return "top-down enemy spaceship, " + name + ", hostile silhouette, crisp pixels, grayscale only";
            case "weapon":
                return "weapon projectile sprite, " + name + ", vertical energy shot, pure grayscale luminance only, no color";
            case "planet":
                return "planet surface / scene tile, " + name + ", game background sprite, grayscale only";
            case "obstacle":
                return "space obstacle sprite, " + name + ", single object, grayscale only";
            default:
                return name + " game sprite, grayscale only";
        }
    }

    /** Prompt for a hull segment (front/center/back/wing). Wings are painted once and mirrored. */
    segmentPrompt(id) {
        const raw = String(id || "");
        const m = raw.match(/-(front|center|back|wingLeft|wingRight|wing)$/);
        const seg = m ? m[1] : "center";
        const shipName = this.formatLabel(raw.replace(/-(front|center|back|wingLeft|wingRight|wing)$/, "")).toLowerCase();
        if (seg === "wing" || seg === "wingLeft" || seg === "wingRight") {
            return (
                "top-down spaceship LEFT WING segment only for " + shipName
                + ", isolated wing panel pointing left, clean vertical root edge on the right for docking, "
                + "no fuselage, no thrusters, grayscale pixel art, solid magenta background #FF00FF, "
                + "will be mirrored for the right wing"
            );
        }
        if (seg === "front") {
            return (
                "top-down spaceship NOSE / FRONT segment only for " + shipName
                + ", pointed tip facing up, flat bottom docking edge, no wings, grayscale pixel art, "
                + "solid magenta background #FF00FF"
            );
        }
        if (seg === "back") {
            return (
                "top-down spaceship AFT / BACK segment only for " + shipName
                + ", thruster bay facing down, flat top docking edge, no wings, grayscale pixel art, "
                + "solid magenta background #FF00FF"
            );
        }
        return (
            "top-down spaceship CENTER FUSELAGE segment only for " + shipName
            + ", rectangular mid body, flat top and bottom docking edges, no wings, "
            + "grayscale pixel art, solid magenta background #FF00FF"
        );
    }

    getTypes() {
        return [
            { id: "mount", label: "MOUNTS" },
            { id: "icon", label: "ICONS" },
            { id: "ability", label: "ABILITIES" },
            { id: "ship", label: "SHIPS" },
            { id: "shipSegment", label: "SHIP SEGMENTS" },
            { id: "enemy", label: "ENEMIES" },
            { id: "faction", label: "FACTIONS" },
            { id: "weapon", label: "WEAPONS" },
            { id: "planet", label: "PLANETS" },
            { id: "obstacle", label: "OBSTACLES" }
        ];
    }

    list(type) {
        switch (type) {
            case "mount":
                return this.listMounts();
            case "icon":
                return this.listIcons();
            case "ability":
                return this.listAbilities();
            case "ship":
                return this.listShips();
            case "shipSegment":
                return this.listShipSegments();
            case "enemy":
                return this.listEnemies();
            case "faction":
                return this.listFactions();
            case "factionShip":
                return this.listFactionShips();
            case "weapon":
                return this.listWeapons();
            case "planet":
                return this.listPlanets();
            case "obstacle":
                return this.listObstacles();
            default:
                return [];
        }
    }

    get(type, id) {
        if (type === "faction") {
            const emblem = this.listFactions().find((e) => e.id === id);
            if (emblem) return emblem;
            return this.listFactionShips().find((e) => e.id === id) || null;
        }
        return this.list(type).find((e) => e.id === id) || null;
    }

    /** Emblems + ships for the unified FACTIONS library view. */
    listFactionLibrary() {
        return this.listFactions().concat(this.listFactionShips());
    }

    /** Resolve a sprite/icon key (or hangar module) to a registry entry. */
    findByKey(key) {
        if (!key) return null;
        const k = String(key);
        const types = this.getTypes();
        for (let i = 0; i < types.length; i++) {
            const entries = this.list(types[i].id);
            for (let j = 0; j < entries.length; j++) {
                const e = entries[j];
                if (e.id === k || e.spriteKey === k) return e;
            }
        }
        const ships = this.listFactionShips();
        for (let j = 0; j < ships.length; j++) {
            const e = ships[j];
            if (e.id === k || e.spriteKey === k) return e;
        }
        // factionTerran → faction-terran
        if (/^faction[A-Z]/.test(k)) {
            const id = k.slice(7).toLowerCase();
            const emblem = this.get("faction", "faction-" + id);
            if (emblem) return emblem;
        }
        if (k.indexOf("ability_") === 0) {
            const hit = this.get("ability", k.slice(8));
            if (hit) return hit;
        }
        if (k.indexOf("mount_") === 0) {
            const hit = this.get("mount", k);
            if (hit) return hit;
        }
        return null;
    }

    findFromElement(el) {
        if (!el || !el.closest) return null;
        const tagged = el.closest("[data-ag-type][data-ag-id]");
        if (tagged) {
            const hit = this.get(tagged.getAttribute("data-ag-type"), tagged.getAttribute("data-ag-id"));
            if (hit) return hit;
        }
        const withKey = el.closest("[data-ag-key]");
        if (withKey) {
            const hit = this.findByKey(withKey.getAttribute("data-ag-key"));
            if (hit) return hit;
        }
        const teCell = el.closest(".te-gfx-cell[data-key]");
        if (teCell) {
            const kind = teCell.getAttribute("data-kind");
            const key = teCell.getAttribute("data-key");
            if (kind === "icon" || kind === "ship") {
                const hit = this.findByKey(key);
                if (hit) return hit;
            }
            if (kind === "factory") {
                const map = {
                    player: "player-starfighter",
                    enemy: "enemy-fighter",
                    playerBullet: "laser-basic",
                    enemyBullet: "enemy-laser-basic",
                    obstacle: "medium-asteroid",
                    shield: "energy-shield",
                    obstacleSmall: "small-asteroid",
                    obstacleMedium: "medium-asteroid",
                    obstacleLarge: "large-asteroid"
                };
                const hit = this.findByKey(map[key] || key);
                if (hit) return hit;
            }
        }
        const iconEl = el.closest("[data-icon]");
        if (iconEl) {
            const hit = this.findByKey(iconEl.getAttribute("data-icon"));
            if (hit) return hit;
        }
        const hangarShip = el.closest("[data-hangar-ship]");
        if (hangarShip) {
            const hit = this.findByKey(hangarShip.getAttribute("data-hangar-ship"));
            if (hit) return hit;
        }
        const fleetChip = el.closest("[data-ag-type='factionShip'][data-ag-id]");
        if (fleetChip) {
            const hit = this.get("factionShip", fleetChip.getAttribute("data-ag-id"));
            if (hit) return hit;
        }
        const factionEl = el.closest("[data-ag-type='faction'][data-ag-id]");
        if (factionEl) {
            const hit = this.get("faction", factionEl.getAttribute("data-ag-id"));
            if (hit) return hit;
        }
        const modBtn = el.closest("[data-toggle-mod][data-mod-id]");
        if (modBtn) {
            const kind = modBtn.getAttribute("data-toggle-mod");
            const id = modBtn.getAttribute("data-mod-id");
            const mod = { kind: kind, id: id };
            if (typeof shipLoadoutManager !== "undefined") {
                if (shipLoadoutManager.resolveModuleShipSprite) {
                    const mountKey = shipLoadoutManager.resolveModuleShipSprite(mod);
                    const mountHit = this.findByKey(mountKey);
                    if (mountHit) return mountHit;
                }
                if (shipLoadoutManager.resolveModuleIcon) {
                    const iconKey = shipLoadoutManager.resolveModuleIcon(mod);
                    const iconHit = this.findByKey(iconKey);
                    if (iconHit) return iconHit;
                }
            }
            if (kind === "weapon") {
                const w = this.get("weapon", id);
                if (w) return w;
            }
            const a = this.get("ability", id);
            if (a) return a;
            const m = this.get("mount", id.indexOf("mount_") === 0 ? id : "mount_" + id);
            if (m) return m;
        }
        return null;
    }

    listMounts() {
        const keys = [];
        if (typeof ModuleSprites !== "undefined" && ModuleSprites) {
            Object.keys(ModuleSprites).forEach((k) => {
                if (!k || ModuleSprites[k] == null) return;
                if (k === "mount_weapon" || k === "mount_defense" || k === "mount_ability") return;
                keys.push(k);
            });
        }
        if (!keys.length) {
            [
                "mount_laser", "mount_spread", "mount_rapid", "mount_plasma", "mount_missile",
                "mount_ion", "mount_wave", "mount_burst", "mount_pierce", "mount_nova",
                "mount_heavy_armor", "mount_energy_shield", "mount_shield_generator"
            ].forEach((k) => keys.push(k));
        }
        return keys.map((id) => this.entry("mount", id, {
            folder: "modules",
            fileId: id,
            size: 8,
            filenamePrefix: "modules/vf_mount",
            spriteKey: id,
            kind: "mount",
            integrateModes: ["attach", "replace", "insert", "expand"],
            zone: this.mountDefaultZone(id)
        }));
    }

    mountDefaultZone(mountId) {
        const bare = String(mountId || "").replace(/^mount_/, "");
        if (typeof shipLoadoutManager !== "undefined" && shipLoadoutManager.getModuleIntegration) {
            let kind = "ability";
            if (typeof weaponConfigManager !== "undefined" && weaponConfigManager.getWeapon
                && weaponConfigManager.getWeapon(bare)) kind = "weapon";
            else if (shipLoadoutManager.isEnergyId && shipLoadoutManager.isEnergyId(bare)) kind = "energy";
            else if (shipLoadoutManager.isDefenseId && shipLoadoutManager.isDefenseId(bare)) kind = "defense";
            const integ = shipLoadoutManager.getModuleIntegration(kind, bare);
            return integ && integ.zone ? integ.zone : "center";
        }
        if (/armor|carapace/i.test(bare)) return "wing";
        if (/shield|energy/i.test(bare)) return "center";
        if (/drive|thruster|speed|maneuver/i.test(bare)) return "back";
        if (/laser|plasma|missile|spread|rapid|ion|wave|burst|pierce|nova/i.test(bare)) return "front";
        return "center";
    }

    listIcons() {
        const keys = [];
        const skip = { shotNormal: 1, menuWeapons: 1, menuAbilities: 1, menuDefense: 1 };
        if (typeof IconSprites !== "undefined" && IconSprites) {
            Object.keys(IconSprites).forEach((k) => {
                if (!k || skip[k] || IconSprites[k] == null) return;
                if (k.indexOf("ability_") === 0) return; // listed under abilities
                keys.push(k);
            });
        }
        return keys.map((id) => this.entry("icon", id, {
            folder: "icons",
            fileId: id,
            size: 16,
            filenamePrefix: "icons/vf_icon",
            spriteKey: id
        }));
    }

    listAbilities() {
        const ids = [];
        if (typeof abilityConfigManager !== "undefined" && abilityConfigManager.getIds) {
            abilityConfigManager.getIds().forEach((id) => ids.push(id));
        } else {
            [
                "player_control", "weapon_systems", "evasion_boost", "high_speed",
                "energy_shield", "heavy_armor", "shield_generator"
            ].forEach((id) => ids.push(id));
        }
        return ids.map((id) => {
            let iconKey = "ability_" + id;
            if (typeof abilityConfigManager !== "undefined" && abilityConfigManager.getAbility) {
                const a = abilityConfigManager.getAbility(id);
                if (a && a.icon) iconKey = a.icon;
            }
            return this.entry("ability", id, {
                folder: "icons",
                fileId: iconKey,
                size: 16,
                filenamePrefix: "abilities/vf_ability",
                spriteKey: iconKey,
                label: this.formatLabel(id),
                promptSuffix: this.defaultPrompt("ability", id)
            });
        });
    }

    shipNames() {
        return [
            "player-starfighter", "player-starfighter-advanced",
            "player-heavy-fighter", "player-assault", "player-interceptor",
            "player-bomber", "player-bomber-heavy", "player-stealth", "player-stealth-advanced",
            "player-destroyer", "player-carrier", "player-frigate",
            "player-corvette", "player-gunship", "player-dreadnought"
        ];
    }

    enemyNames() {
        return [
            "enemy-fighter", "enemy-battleship", "enemy-cruiser",
            "enemy-interceptor", "enemy-scout", "enemy-destroyer",
            "enemy-carrier", "enemy-frigate", "enemy-corvette",
            "enemy-gunship", "enemy-dreadnought", "enemy-bomber", "enemy-stealth"
        ];
    }

    listShips() {
        return this.shipNames().map((id) => this.entry("ship", id, {
            folder: "ships",
            fileId: id,
            size: 64,
            filenamePrefix: "ships/vf_ship",
            spriteKey: id
        }));
    }

    /** Hull segment assets for every ship/enemy/faction hull (wingLeft mirrored → wingRight). */
    segmentIds() {
        return ["front", "center", "back", "wingLeft"];
    }

    listShipSegments() {
        const parents = this.shipNames()
            .concat(this.enemyNames())
            .concat(this.listFactionShips().map((e) => e.spriteKey || e.id));
        const seen = {};
        const out = [];
        parents.forEach((parent) => {
            const base = String(parent || "");
            if (!base || seen[base]) return;
            seen[base] = 1;
            this.segmentIds().forEach((seg) => {
                const id = base + "-" + seg;
                const size = seg === "wingLeft" || seg === "wingRight" ? 32
                    : (seg === "center" ? 48 : 32);
                out.push(this.entry("shipSegment", id, {
                    folder: "ships",
                    fileId: id,
                    size: size,
                    filenamePrefix: "ships/vf_seg",
                    spriteKey: id,
                    label: this.formatLabel(base) + " · " + seg.toUpperCase(),
                    promptSuffix: this.segmentPrompt(id),
                    kind: "segment",
                    segment: seg,
                    parentShip: base,
                    mirrorOf: seg === "wingLeft" ? (base + "-wingRight") : null,
                    integrateModes: ["attach", "replace", "insert", "expand"]
                }));
            });
        });
        return out;
    }

    listEnemies() {
        return this.enemyNames().map((id) => this.entry("enemy", id, {
            folder: "ships",
            fileId: id,
            size: this.enemyAssetSize(id),
            filenamePrefix: "ships/vf_enemy",
            spriteKey: id
        }));
    }

    enemyAssetSize(id) {
        const key = String(id || "").toLowerCase();
        if (key.indexOf("scout") >= 0 || key.indexOf("interceptor") >= 0
            || key.indexOf("stealth") >= 0) {
            return 16;
        }
        if (key.indexOf("fighter") >= 0 || key.indexOf("bomber") >= 0
            || key.indexOf("corvette") >= 0 || key.indexOf("frigate") >= 0
            || key.indexOf("gunship") >= 0) {
            return 32;
        }
        return 64;
    }

    factionIds() {
        if (typeof factionShipStyles !== "undefined" && factionShipStyles.factions) {
            return factionShipStyles.factions.slice();
        }
        if (typeof planetConfigManager !== "undefined" && planetConfigManager.availableFactions) {
            return planetConfigManager.availableFactions.slice();
        }
        return ["terran", "kronax", "voidborn", "pirate", "machine"];
    }

    enemyClassIds() {
        if (typeof factionShipStyles !== "undefined" && factionShipStyles.classes) {
            return factionShipStyles.classes.slice();
        }
        if (typeof planetConfigManager !== "undefined" && planetConfigManager.availableEnemyClasses) {
            return planetConfigManager.availableEnemyClasses.slice();
        }
        return ["scout", "assault", "heavy", "elite", "capital"];
    }

    listFactions() {
        return this.factionIds().map((id) => {
            const key = (typeof factionShipStyles !== "undefined" && factionShipStyles.emblemKey)
                ? factionShipStyles.emblemKey(id)
                : ("faction-" + id);
            const prompt = (typeof factionShipStyles !== "undefined" && factionShipStyles.buildEmblemPrompt)
                ? factionShipStyles.buildEmblemPrompt(id)
                : this.defaultPrompt("faction", id);
            let label = String(id).toUpperCase();
            if (typeof planetConfigManager !== "undefined" && planetConfigManager.getFactionMeta) {
                const meta = planetConfigManager.getFactionMeta(id);
                if (meta && meta.label) label = meta.label;
            }
            return this.entry("faction", key, {
                folder: "icons",
                fileId: key,
                size: 32,
                filenamePrefix: "icons/vf_faction",
                spriteKey: key,
                label: label,
                promptSuffix: prompt,
                faction: id,
                kind: "emblem"
            });
        });
    }

    listFactionShips() {
        const factions = this.factionIds();
        const classes = this.enemyClassIds();
        const out = [];
        factions.forEach((faction) => {
            classes.forEach((enemyClass) => {
                const key = (typeof factionShipStyles !== "undefined" && factionShipStyles.spriteKey)
                    ? factionShipStyles.spriteKey(faction, enemyClass)
                    : ("enemy-" + faction + "-" + enemyClass);
                const prompt = (typeof factionShipStyles !== "undefined" && factionShipStyles.buildShipPrompt)
                    ? factionShipStyles.buildShipPrompt(faction, enemyClass)
                    : this.defaultPrompt("factionShip", key);
                out.push(this.entry("factionShip", key, {
                    folder: "ships",
                    fileId: key,
                    size: (typeof factionShipStyles !== "undefined"
                        && factionShipStyles.resolutionForClass)
                        ? factionShipStyles.resolutionForClass(enemyClass)
                        : (enemyClass === "scout" ? 16
                            : (enemyClass === "assault" || enemyClass === "heavy" ? 32 : 64)),
                    filenamePrefix: "ships/vf_faction_ship",
                    spriteKey: key,
                    label: String(faction).toUpperCase() + " · " + String(enemyClass).toUpperCase(),
                    promptSuffix: prompt,
                    faction: faction,
                    enemyClass: enemyClass,
                    kind: "ship"
                }));
            });
        });
        return out;
    }

    listWeapons() {
        const names = [
            "laser-basic", "laser-advanced", "laser-heavy",
            "rapid-fire-basic", "rapid-fire-advanced", "rapid-fire-heavy",
            "spread-shot-basic", "spread-shot-advanced", "spread-shot-heavy",
            "plasma-basic", "plasma-advanced", "plasma-heavy",
            "missile-basic", "missile-advanced", "missile-heavy",
            "ion-cannon", "photon-torpedo", "quantum-torpedo",
            "disruptor-beam", "antimatter-cannon", "gravity-bomb",
            "energy-burst", "shield-breaker",
            "enemy-laser-basic", "enemy-laser-advanced", "enemy-laser-heavy"
        ];
        return names.map((id) => this.entry("weapon", id, {
            folder: "weapons",
            fileId: id,
            size: 32,
            filenamePrefix: "weapons/vf_shot",
            spriteKey: id
        }));
    }

    listPlanets() {
        const names = [
            "mars-surface", "mars-canyon", "mars-volcano", "mars-dust-storm",
            "jupiter-atmosphere", "jupiter-red-spot", "jupiter-moons",
            "saturn-rings", "saturn-storm", "saturn-titan",
            "neptune-storm", "neptune-ice", "neptune-dark-spot",
            "pluto-surface", "pluto-ice", "pluto-charon"
        ];
        return names.map((id) => this.entry("planet", id, {
            folder: "levels",
            fileId: id,
            size: 128,
            filenamePrefix: "planets/vf_planet",
            spriteKey: id
        }));
    }

    listObstacles() {
        const names = [
            "small-asteroid", "medium-asteroid", "large-asteroid", "energy-shield"
        ];
        return names.map((id) => this.entry("obstacle", id, {
            folder: "obstacles",
            fileId: id,
            size: 32,
            filenamePrefix: "obstacles/vf_obstacle",
            spriteKey: id
        }));
    }
}

const assetGenRegistry = new AssetGenRegistry();
window.AssetGenRegistry = AssetGenRegistry;
window.assetGenRegistry = assetGenRegistry;
