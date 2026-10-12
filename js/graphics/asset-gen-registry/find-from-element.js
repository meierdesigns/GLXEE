"use strict";

// AssetGenRegistry methods, split from asset-gen-registry.js.
extendClass(AssetGenRegistry, {
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
    },

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
    },

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
    },

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
    },

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
    },

    shipNames() {
        return [
            "player-starfighter", "player-starfighter-advanced",
            "player-heavy-fighter", "player-assault", "player-interceptor",
            "player-bomber", "player-bomber-heavy", "player-stealth", "player-stealth-advanced",
            "player-destroyer", "player-carrier", "player-frigate",
            "player-corvette", "player-gunship", "player-dreadnought"
        ];
    },

    enemyNames() {
        return [
            "enemy-fighter", "enemy-battleship", "enemy-cruiser",
            "enemy-interceptor", "enemy-scout", "enemy-destroyer",
            "enemy-carrier", "enemy-frigate", "enemy-corvette",
            "enemy-gunship", "enemy-dreadnought", "enemy-bomber", "enemy-stealth"
        ];
    },

    listShips() {
        return this.shipNames().map((id) => this.entry("ship", id, {
            folder: "ships",
            fileId: id,
            size: 64,
            filenamePrefix: "ships/vf_ship",
            spriteKey: id
        }));
    },

    /** Hull segment assets for every ship/enemy/faction hull (wingLeft mirrored → wingRight). */
    segmentIds() {
        return ["front", "center", "back", "wingLeft"];
    },

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
    },

    listEnemies() {
        return this.enemyNames().map((id) => this.entry("enemy", id, {
            folder: "ships",
            fileId: id,
            size: this.enemyAssetSize(id),
            filenamePrefix: "ships/vf_enemy",
            spriteKey: id
        }));
    },

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
    },
});
