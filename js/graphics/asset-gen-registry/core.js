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
                    "tiny top-down hard-surface sci-fi spacecraft subsystem, " + name
                    + ", compact armored mechanical module with vents, panel seams, "
                    + "cabling and a clear functional silhouette, engineered to dock flush "
                    + "to a spaceship hull, chunky 8x8 pixel silhouette, fills frame, "
                    + "high contrast grayscale only, solid simple shape, no text, no fantasy ornament"
                );
            case "icon":
                return (
                    "retro sci-fi spacecraft UI icon, " + name
                    + ", industrial technical glyph, hard-surface geometry, "
                    + "16x16 pixel feel, grayscale only, no text"
                );
            case "ability":
                return (
                    "retro sci-fi ship-system icon, " + name
                    + ", tactical holographic circuitry, reactor or control-system motif, "
                    + "16x16 pixel feel, grayscale only, no text"
                );
            case "ship":
                return (
                    "top-down retro sci-fi player spacecraft, " + name
                    + ", hard-surface plated hull, engine vents, modular panel geometry, "
                    + "crisp pixel silhouette, grayscale only, no text"
                );
            case "enemy":
                return (
                    "top-down hostile retro sci-fi spacecraft, " + name
                    + ", armored industrial hull, weapon hardpoints, mechanical panel seams, "
                    + "hostile silhouette, grayscale only, no text"
                );
            case "shipSegment":
                return this.segmentPrompt(id);
            case "faction":
                return "faction emblem icon, " + name + ", simple glyph, 16x16 pixel feel, game UI icon, grayscale only";
            case "factionShip":
                return (
                    "top-down faction-specific retro sci-fi spacecraft, " + name
                    + ", unmistakable faction engineering language, readable hard-surface "
                    + "panel hierarchy, weapon hardpoints and engine architecture, "
                    + "hostile silhouette, crisp pixels, grayscale only, no text"
                );
            case "weapon":
                return (
                    "retro sci-fi spacecraft weapon module, " + name
                    + ", compact industrial emitter with barrel, coils, vents and energy core, "
                    + "vertical top-down sprite, pure grayscale luminance only, no color, no text"
                );
            case "planet":
                return "planet surface / scene tile, " + name + ", game background sprite, grayscale only";
            case "obstacle":
                return (
                    "retro sci-fi space obstacle, " + name
                    + ", industrial wreckage or engineered structure, "
                    + "mechanical layered silhouette, grayscale only, no text"
                );
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
}
