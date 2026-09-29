"use strict";

/**
 * Screen 2 — Galaxy planet node-network map.
 */
class GalaxyMapManager {
    constructor() {
        this.isVisible = false;
        this.galaxyId = null;
        this.selectedPlanetId = null;
        this.hoveredPlanetId = null;
        this.overlay = null;
        this._keyHandler = null;
        this._mountEl = null;
        this._inputActive = true;
        this.onConfirm = null;
        this.onBack = null;
        this.onExplored = null;
        this.onDock = null;
        this.onEscape = null;
        this.statusMsg = '';
        this.map = null;
        this.nodeById = {};
        this.mapZoom = 3;
        this.mapPan = null;
    }

    show(options) {
        this.isVisible = true;
        this.galaxyId = options && options.galaxyId;
        this.onConfirm = options && options.onConfirm;
        this.onBack = options && options.onBack;
        this.onExplored = options && options.onExplored;
        this.onDock = options && options.onDock;
        this.onEscape = options && options.onEscape;
        this._mountEl = (options && options.mount) || null;
        // Embedded maps are interactive immediately; keyboard navigation can
        // still be used without requiring a separate activation step.
        this._inputActive = true;
        this.statusMsg = '';
        if (
            typeof planetConfigManager !== 'undefined' &&
            planetConfigManager.ensureGalaxyArrivalContent &&
            typeof profileManager !== 'undefined'
        ) {
            const profile = profileManager.getActiveProfile && profileManager.getActiveProfile();
            const firstVisit = profile
                ? !profileManager.hasDiscoveredGalaxy(this.galaxyId, profile)
                : true;
            const arrival = planetConfigManager.ensureGalaxyArrivalContent(
                this.galaxyId,
                profile ? (String(profile.id) + '|' + this.galaxyId) : ('map|' + this.galaxyId),
                { firstVisit: firstVisit }
            );
            if (arrival && arrival.ok && arrival.seeded && arrival.startPlanetId && profileManager.unlockPlanet) {
                profileManager.unlockPlanet(arrival.startPlanetId);
            }
            if (profile && firstVisit && profileManager.discoverGalaxy) {
                profileManager.discoverGalaxy(this.galaxyId);
            }
        }
        this.loadMap();
        this.createUI();
        if (typeof menuStateManager !== 'undefined' && !this._mountEl) {
            menuStateManager.setScreen('galaxyMap');
        }
    }

    hide() {
        this.isVisible = false;
        this._mountEl = null;
        this._inputActive = false;
        this.hoveredPlanetId = null;
        this.onEscape = null;
        if (this._keyHandler) {
            document.removeEventListener('keydown', this._keyHandler);
            this._keyHandler = null;
        }
        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
        }
    }

    isInputActive() {
        return !!this._inputActive;
    }

    setInputActive(active) {
        this._inputActive = !!active;
        if (this.overlay) {
            this.overlay.classList.toggle('is-input-active', this._inputActive);
        }
        if (this._mountEl) {
            this._mountEl.classList.toggle('is-map-active', this._inputActive);
        }
        return this._inputActive;
    }

    armInput() {
        return this.setInputActive(true);
    }

    disarmInput() {
        return this.setInputActive(false);
    }

    loadMap() {
        this.map = (typeof planetConfigManager !== 'undefined')
            ? planetConfigManager.getGalaxyMap(this.galaxyId)
            : { startPlanetId: 'mars', nodes: [], edges: [] };
        this.nodeById = {};
        (this.map.nodes || []).forEach(n => {
            this.nodeById[n.planetId] = n;
        });

        const startId = this.map.startPlanetId;
        const unlockedStart = startId && this.isUnlocked(startId);
        if (unlockedStart) {
            this.selectedPlanetId = startId;
        } else {
            const firstUnlocked = (this.map.nodes || []).find(n => this.isUnlocked(n.planetId));
            this.selectedPlanetId = firstUnlocked ? firstUnlocked.planetId : (startId || null);
        }
        // Cursor starts where the ship is.
        this.selectedPostId = null;
        const loc = (typeof profileManager !== 'undefined' && profileManager.getShipLocation)
            ? profileManager.getShipLocation(this.galaxyId)
            : null;
        if (loc && loc.kind === 'planet' && this.nodeById[loc.id]) {
            this.selectedPlanetId = loc.id;
        } else if (loc && loc.kind === 'post' && profileManager.getTradingPost) {
            const post = profileManager.getTradingPost(loc.id);
            if (post && this.nodeById[post.planetId]) {
                this.selectedPlanetId = post.planetId;
                this.selectedPostId = post.id;
            }
        }
    }

    isUnlocked(planetId) {
        if (typeof profileManager === 'undefined') return true;
        return profileManager.isPlanetUnlocked(this.galaxyId, planetId);
    }

    isCleared(planetId) {
        if (typeof profileManager === 'undefined') return false;
        return profileManager.isPlanetCleared(this.galaxyId, planetId);
    }

    getStagesPerPlanet() {
        if (typeof game !== 'undefined' && game.levelManager && game.levelManager.stagesPerPlanet) {
            return Math.max(1, Math.round(Number(game.levelManager.stagesPerPlanet)) || 3);
        }
        if (typeof gameCore !== 'undefined' && gameCore.levelManager && gameCore.levelManager.stagesPerPlanet) {
            return Math.max(1, Math.round(Number(gameCore.levelManager.stagesPerPlanet)) || 3);
        }
        return 3;
    }

    getPlanetStageProgressLabel(planetId) {
        const pid = String(planetId || '').toLowerCase();
        if (!pid) return '';
        const stage = (typeof profileManager !== 'undefined')
            ? profileManager.getPlanetStageState(this.galaxyId, pid)
            : { highestStage: 0, bossCleared: false };
        const highest = Math.max(0, Math.round(Number(stage.highestStage) || 0));
        const cleared = this.isCleared(pid);
        if (!cleared && !stage.bossCleared && highest <= 0) return '';
        const total = this.getStagesPerPlanet();
        const done = (cleared || stage.bossCleared) ? total : Math.min(highest, total);
        return `${done}/${total}`;
    }

    getPlanetInfo(planetId) {
        const pid = String(planetId || '').toLowerCase();
        let name = pid.toUpperCase();
        let difficulty = '';
        let description = '3 stages + boss chamber';
        let enemyCount = 5;
        let obstacleCount = 3;
        if (typeof planetConfigManager !== 'undefined') {
            const cfg = planetConfigManager.getConfig(pid);
            if (cfg) {
                name = cfg.name || name;
                difficulty = cfg.difficulty || '';
                description = cfg.description || description;
                enemyCount = (cfg.enemies && cfg.enemies.length) || enemyCount;
                const pf = planetConfigManager.getPlanetFactions ? planetConfigManager.getPlanetFactions(pid) : (cfg.factions || []);
                if (Array.isArray(pf) && pf.length > 1) {
                    description = 'ALLIED: ' + pf.map((f) => String(f).toUpperCase()).join(' + ')
                        + ' · ' + description;
                }
            }
        }
        const stage = (typeof profileManager !== 'undefined')
            ? profileManager.getPlanetStageState(this.galaxyId, pid)
            : { highestStage: 0, bossCleared: false };
        const unlocked = this.isUnlocked(pid);
        const cleared = this.isCleared(pid);
        return {
            id: pid,
            name,
            difficulty,
            description,
            enemyCount,
            obstacleCount,
            reward: 'XP',
            unlocked,
            cleared,
            stage
        };
    }

    getGalaxyProgressLabel() {
        if (typeof profileManager === 'undefined') return '0/0 CLEARED';
        return profileManager.getGalaxyProgress(this.galaxyId).label;
    }

    getGalaxyName() {
        if (typeof planetConfigManager !== 'undefined') {
            const g = planetConfigManager.getGalaxy(this.galaxyId);
            if (g) {
                if (planetConfigManager.getGalaxyControlLabel) {
                    return g.name + ' · ' + planetConfigManager.getGalaxyControlLabel(this.galaxyId);
                }
                const faction = planetConfigManager.getGalaxyFaction
                    ? planetConfigManager.getGalaxyFaction(this.galaxyId)
                    : g.faction;
                const factionTag = faction ? (' · ' + String(faction).toUpperCase()) : '';
                return g.name + factionTag;
            }
        }
        return String(this.galaxyId || '').toUpperCase();
    }

    /** Top-right badge: the faction that rules this galaxy (its main faction). */
    renderGalaxyRulerBadge() {
        if (typeof planetConfigManager === 'undefined' || !planetConfigManager.getGalaxyControl) return '';
        const c = planetConfigManager.getGalaxyControl(this.galaxyId);
        if (!c || !c.main) return '';
        const styleOf = (f) => (typeof factionShipStyles !== 'undefined' && factionShipStyles.getFactionStyle
            ? factionShipStyles.getFactionStyle(f) : null);
        const emblemOf = (f, size) => (typeof profileSelectionManager !== 'undefined' && profileSelectionManager.getFactionEmblemHtml
            ? profileSelectionManager.getFactionEmblemHtml(f, size) : '');
        const style = styleOf(c.main);
        const accent = (style && style.accent) || 'var(--color-primary)';
        const emblem = emblemOf(c.main, 48);
        const state = c.control === 'contested' ? 'CONTESTED' : 'HELD';
        const g = planetConfigManager.getGalaxy ? planetConfigManager.getGalaxy(this.galaxyId) : null;
        const galaxyName = (g && g.name) || String(this.galaxyId || '').toUpperCase();
        // Ruler card: emblem + galaxy name + control state (faction reads from the emblem).
        const ruler = `<div class="galaxy-map-ruler-card" style="--ruler-accent:${accent}" title="Ruled by ${String(c.main).toUpperCase()}">` +
            (emblem ? `<span class="galaxy-map-ruler-emblem">${emblem}</span>` : '') +
            `<span class="galaxy-map-ruler-text"><span class="galaxy-map-ruler-galaxy">${galaxyName}</span>` +
            `<span class="galaxy-map-ruler-label">${state}</span>${this.renderHoldingsLine()}</span></div>`;
        return `<div class="galaxy-map-ruler">${ruler}${this.renderGalaxySituationCard(c, emblemOf, styleOf)}</div>`;
    }

    /** "BASE MARS · 2 WARCAMPS" (or "BASE DESTROYED") under the ruler state. */
    renderHoldingsLine() {
        const pm = typeof profileManager !== 'undefined' ? profileManager : null;
        const h = pm && pm.getFactionHoldings ? pm.getFactionHoldings(this.galaxyId) : null;
        if (!h || !h.base) return '';
        if (h.baseLost) return '<span class="galaxy-map-ruler-holdings">BASE DESTROYED</span>';
        const cfg = planetConfigManager.getConfig ? planetConfigManager.getConfig(h.base) : null;
        const baseName = pm.isHoldingBaseRevealed(this.galaxyId)
            ? String((cfg && cfg.name) || h.base).toUpperCase() : 'UNKNOWN';
        const label = pm.getFactionExpansion(h.ruler).label;
        const n = h.stations.length;
        return `<span class="galaxy-map-ruler-holdings">BASE ${baseName}${n ? ' · ' + n + ' ' + label + (n === 1 ? '' : 'S') : ''}</span>`;
    }

    /** Card under the ruler: active mission here, else the galaxy's conflict, else a hint. */
    renderGalaxySituationCard(c, emblemOf, styleOf) {
        const esc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
        const p = (typeof profileManager !== 'undefined' && profileManager.getActiveProfile) ? profileManager.getActiveProfile() : null;
        // Invasion of this galaxy comes first (invasion-scenario.js).
        const inv = (typeof profileManager !== 'undefined' && profileManager.getActiveInvasion)
            ? profileManager.getActiveInvasion(p) : null;
        if (inv && inv.galaxyId === this.galaxyId) {
            const icfg = planetConfigManager.getConfig ? planetConfigManager.getConfig(inv.planetId) : null;
            const iplanet = String((icfg && icfg.name) || inv.planetId).toUpperCase();
            const ist = styleOf(inv.attacker);
            return `<div class="galaxy-map-situation is-invasion" style="--ruler-accent:${(ist && ist.accent) || '#ff4a3a'}">` +
                `<span class="galaxy-map-situation-kind">INVASION</span>` +
                `<span class="galaxy-map-situation-row"><span class="galaxy-map-situation-emblem">${emblemOf(inv.attacker, 14)}</span>` +
                `<span class="galaxy-map-situation-title">${esc(String(inv.attacker).toUpperCase())} ATTACKS ${esc(iplanet)}</span></span>` +
                `<span class="galaxy-map-situation-sub">FLY THERE AND WIN A STAGE TO REPEL IT</span>` +
                `</div>`;
        }
        const m = p && p.activeMission;
        if (m && m.galaxyId === this.galaxyId) {
            const cfg = planetConfigManager.getConfig ? planetConfigManager.getConfig(m.planetId) : null;
            const planet = String((cfg && cfg.name) || m.planetId || '').toUpperCase();
            const reward = Object.keys(m.reward || {}).map((k) => m.reward[k] + ' ' + (k === 'credits' ? 'CR' : k.toUpperCase())).join(' · ');
            const fStyle = m.factionId ? styleOf(m.factionId) : null;
            const accent = (fStyle && fStyle.accent) || 'var(--color-primary)';
            return `<div class="galaxy-map-situation is-mission" style="--ruler-accent:${accent}">` +
                `<span class="galaxy-map-situation-kind">ACTIVE MISSION</span>` +
                `<span class="galaxy-map-situation-title">${esc(String(m.type || 'MISSION').toUpperCase())} · ${esc(planet)}</span>` +
                (reward ? `<span class="galaxy-map-situation-sub">REWARD ${esc(reward)}</span>` : '') +
                `</div>`;
        }
        if (c.control === 'contested' && c.rivals && c.rivals.length) {
            const map = planetConfigManager.getGalaxyMap ? (planetConfigManager.getGalaxyMap(this.galaxyId) || {}) : {};
            const front = (map.nodes || []).filter((n) => {
                const f = planetConfigManager.getPlanetFactions ? planetConfigManager.getPlanetFactions(n.planetId) : [];
                // Frontline = a planet held by an invading rival.
                return f && f.length && c.rivals.indexOf(f[0]) !== -1;
            }).length;
            const rivalStyle = styleOf(c.rivals[0]);
            const accent = (rivalStyle && rivalStyle.accent) || 'var(--color-primary)';
            const emblems = c.rivals.map((f) => `<span class="galaxy-map-situation-emblem" title="${esc(String(f).toUpperCase())}">${emblemOf(f, 14)}</span>`).join('');
            return `<div class="galaxy-map-situation is-conflict" style="--ruler-accent:${accent}">` +
                `<span class="galaxy-map-situation-kind">CONFLICT</span>` +
                `<span class="galaxy-map-situation-row">${emblems}` +
                `<span class="galaxy-map-situation-title">${esc(c.rivals.map((f) => String(f).toUpperCase()).join(' · '))} INVASION</span></span>` +
                `<span class="galaxy-map-situation-sub">${front ? front + ' FRONTLINE PLANET' + (front === 1 ? '' : 'S') : 'RAIDS ON THE BORDER'}</span>` +
                `</div>`;
        }
        return `<div class="galaxy-map-situation is-calm">` +
            `<span class="galaxy-map-situation-kind">NO ACTIVE MISSION</span>` +
            `<span class="galaxy-map-situation-sub">TAKE ONE AT THE HANGAR MISSION BOARD</span>` +
            `</div>`;
    }

    planetIconHtml(planetId, size) {
        const sid = String(planetId || 'mars').toLowerCase();
        const px = size || 48;
        if (typeof planetSVGManager !== 'undefined') {
            if (!planetSVGManager.planets || !Object.keys(planetSVGManager.planets).length) {
                planetSVGManager.init();
            }
            // Large views get a finer grid instead of an upscaled icon.
            const zoom = (typeof this.mapZoom === 'number' && Number.isFinite(this.mapZoom))
                ? this.mapZoom : 1;
            const detail = px >= 160 || zoom >= 2.5
                ? 4
                : (px >= 80 || zoom >= 1.35 ? 2 : 1);
            let svg = planetSVGManager.getPlanetSVGDetailed
                ? planetSVGManager.getPlanetSVGDetailed(sid, detail)
                : planetSVGManager.getPlanetSVG(sid);
            if (svg) {
                const uid = 'gm_' + sid + '_' + Math.random().toString(36).slice(2, 7);
                svg = svg
                    .replace(/id="([^"]+)"/g, (m, id) => `id="${uid}_${id}"`)
                    .replace(/url\(#([^)]+)\)/g, (m, id) => `url(#${uid}_${id})`)
                    .replace(/width="[^"]*"/, `width="${px}"`)
                    .replace(/height="[^"]*"/, `height="${px}"`);
                return `<span class="gm-planet-icon">${svg}</span>`;
            }
        }
        return `<span class="gm-planet-fallback" style="width:${px}px;height:${px}px">${sid.charAt(0).toUpperCase()}</span>`;
    }
}
