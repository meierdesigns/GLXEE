"use strict";

// GalaxyMapManager members, continued from core.js (kept under ~500 lines per file).
extendClass(GalaxyMapManager, {
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
    },
    getGalaxyProgressLabel() {
        if (typeof profileManager === 'undefined') return '0/0 CLEARED';
        return profileManager.getGalaxyProgress(this.galaxyId).label;
    },
    /** Explore budget for the current galaxy: "EXPLORES used/budget". */
    getExploreProgressLabel() {
        const gid = String(this.galaxyId || '').toLowerCase();
        if (!gid || gid === 'milky_way') return '';
        const used = (typeof profileManager !== 'undefined' && profileManager.getExploreIndex)
            ? profileManager.getExploreIndex(gid)
            : 0;
        let budget = 1;
        if (typeof profileManager !== 'undefined' && profileManager.canExploreGalaxy) {
            const check = profileManager.canExploreGalaxy(gid);
            if (check && check.budget != null) budget = check.budget;
        } else if (typeof economyConfig !== 'undefined' && economyConfig.getExploreBudget) {
            budget = economyConfig.getExploreBudget(
                (typeof profileManager !== 'undefined')
                    ? profileManager.getStationUpgradeLevels()
                    : {}
            );
        }
        return `EXPLORES ${used}/${budget}`;
    },
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
    },
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
        // Segments for the shared bottom bar (planet card wraps these in create-ui).
        const holdingsTip = this.getHoldingsTip();
        const tip = holdingsTip || `Ruled by ${String(c.main).toUpperCase()}`;
        const sit = this.renderGalaxySituationCard(c, emblemOf, styleOf);
        this._barAccent = (this._situationAccent) || accent;
        const ruler = `<div class="galaxy-map-ruler-seg galaxy-map-ruler-card" style="--ruler-accent:${accent}" data-ui-tip="${tip}">` +
            (emblem ? `<span class="galaxy-map-ruler-emblem">${emblem}</span>` : '') +
            `<span class="galaxy-map-ruler-text"><span class="galaxy-map-ruler-galaxy">${galaxyName}</span>` +
            `<span class="galaxy-map-ruler-label">${state}</span></span></div>`;
        return ruler + sit;
    },
    /** Holdings text for the ruler-card tooltip (not shown inline). */
    getHoldingsTip() {
        const pm = typeof profileManager !== 'undefined' ? profileManager : null;
        const h = pm && pm.getFactionHoldings ? pm.getFactionHoldings(this.galaxyId) : null;
        if (!h || !h.base) return '';
        if (h.baseLost) return 'BASE DESTROYED';
        const cfg = planetConfigManager.getConfig ? planetConfigManager.getConfig(h.base) : null;
        const baseName = pm.isHoldingBaseRevealed(this.galaxyId)
            ? String((cfg && cfg.name) || h.base).toUpperCase() : 'UNKNOWN';
        const label = pm.getFactionExpansion(h.ruler).label;
        const n = h.stations.length;
        return `BASE ${baseName}${n ? ' · ' + n + ' ' + label + (n === 1 ? '' : 'S') : ''}`;
    },
    renderHoldingsLine() {
        const tip = this.getHoldingsTip();
        return tip ? `<span class="galaxy-map-ruler-holdings">${tip}</span>` : '';
    },
    /** Card under the ruler: active mission here, else the galaxy's conflict, else a hint. */
    renderGalaxySituationCard(c, emblemOf, styleOf) {
        const esc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
        const p = (typeof profileManager !== 'undefined' && profileManager.getActiveProfile) ? profileManager.getActiveProfile() : null;
        // Invasion of this galaxy comes first (invasion-scenario.js).
        const inv = (typeof profileManager !== 'undefined' && profileManager.getActiveInvasion)
            ? profileManager.getActiveInvasion(p, this.galaxyId) : null;
        if (inv) {
            const icfg = planetConfigManager.getConfig ? planetConfigManager.getConfig(inv.planetId) : null;
            const iplanet = String((icfg && icfg.name) || inv.planetId).toUpperCase();
            const ist = styleOf(inv.attacker);
            const invAccent = (ist && ist.accent) || '#ff4a3a';
            this._situationAccent = invAccent;
            this._situation = { kind: inv.ally ? 'ALLY UNDER ATTACK' : 'INVASION', planetId: inv.planetId, planet: iplanet,
                attacker: inv.attacker, defender: inv.defender, ally: !!inv.ally,
                objective: inv.ally ? 'Defend your ' + String(inv.defender).toUpperCase() + ' allies: win a stage on ' + iplanet + '.'
                    : 'Fly to ' + iplanet + ' and win a stage to repel the invasion.' };
            const invSub = inv.ally
                ? 'DEFEND YOUR ' + esc(String(inv.defender).toUpperCase()) + ' ALLIES · WIN A STAGE THERE'
                : 'FLY THERE AND WIN A STAGE TO REPEL IT';
            return `<div class="galaxy-map-ruler-seg galaxy-map-situation is-invasion" role="button" tabindex="0" data-ui-tip="${invSub}" style="--ruler-accent:${invAccent}">` +
                `<span class="galaxy-map-situation-kind">${inv.ally ? 'ALLY UNDER ATTACK' : 'INVASION'}</span>` +
                `<span class="galaxy-map-situation-row"><span class="galaxy-map-situation-go">${this.btnIconHtml ? this.btnIconHtml('navScroll', 32) : emblemOf(inv.attacker, 32)}</span>` +
                `<span class="galaxy-map-situation-text"><span class="galaxy-map-situation-title">${esc(String(inv.attacker).toUpperCase())} ATTACKS ${esc(iplanet)}</span>` +
                `<span class="galaxy-map-situation-sub">${invSub}</span></span></span>` +
                `</div>`;
        }
        const m = p && p.activeMission;
        if (m && m.galaxyId === this.galaxyId) {
            const cfg = planetConfigManager.getConfig ? planetConfigManager.getConfig(m.planetId) : null;
            const planet = String((cfg && cfg.name) || m.planetId || '').toUpperCase();
            const reward = Object.keys(m.reward || {}).map((k) => m.reward[k] + ' ' + (k === 'credits' ? 'CR' : k.toUpperCase())).join(' · ');
            const fStyle = m.factionId ? styleOf(m.factionId) : null;
            const accent = (fStyle && fStyle.accent) || 'var(--color-primary)';
            this._situationAccent = accent;
            this._situation = { kind: 'ACTIVE MISSION', planetId: m.planetId, planet: planet, attacker: m.factionId || null,
                mission: String(m.type || 'MISSION').toUpperCase(), reward: reward,
                objective: 'Complete the ' + String(m.type || 'mission').toLowerCase() + ' on ' + planet + '.' };
            const missionTip = reward ? `REWARD ${esc(reward)}` : 'OPEN MISSION';
            return `<div class="galaxy-map-ruler-seg galaxy-map-situation is-mission" role="button" tabindex="0" data-ui-tip="${missionTip}" style="--ruler-accent:${accent}">` +
                `<span class="galaxy-map-situation-kind">ACTIVE MISSION</span>` +
                `<span class="galaxy-map-situation-title">${esc(String(m.type || 'MISSION').toUpperCase())} · ${esc(planet)}</span>` +
                `<span class="galaxy-map-situation-sub">${missionTip}</span>` +
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
            this._situationAccent = accent;
            const emblems = c.rivals.map((f) => `<span class="galaxy-map-situation-emblem" title="${esc(String(f).toUpperCase())}">${emblemOf(f, 32)}</span>`).join('');
            this._situation = { kind: 'CONFLICT', planetId: null, rivals: c.rivals.slice(), front: front,
                objective: front ? front + ' frontline planet' + (front === 1 ? '' : 's') + ' held by the invaders. Take them back.' : 'Raids on the border. Clear planets to push the invaders back.' };
            const conflictSub = front ? front + ' FRONTLINE PLANET' + (front === 1 ? '' : 'S') : 'RAIDS ON THE BORDER';
            return `<div class="galaxy-map-ruler-seg galaxy-map-situation is-conflict" role="button" tabindex="0" data-ui-tip="${conflictSub}" style="--ruler-accent:${accent}">` +
                `<span class="galaxy-map-situation-kind">CONFLICT</span>` +
                `<span class="galaxy-map-situation-row">${emblems}` +
                `<span class="galaxy-map-situation-title">${esc(c.rivals.map((f) => String(f).toUpperCase()).join(' · '))} INVASION</span></span>` +
                `<span class="galaxy-map-situation-sub">${conflictSub}</span>` +
                `</div>`;
        }
        this._situationAccent = null;
        this._situation = { kind: 'NO ACTIVE MISSION', planetId: null, objective: 'Take a mission at the HANGAR mission board.' };
        return `<div class="galaxy-map-ruler-seg galaxy-map-situation is-calm" role="button" tabindex="0" data-ui-tip="TAKE ONE AT THE HANGAR MISSION BOARD">` +
            `<span class="galaxy-map-situation-kind">NO ACTIVE MISSION</span>` +
            `<span class="galaxy-map-situation-sub">TAKE ONE AT THE HANGAR MISSION BOARD</span>` +
            `</div>`;
    },
    /** Mission modal for the situation card: what is going on here and where to go. */
    openSituationModal() {
        const sit = this._situation;
        const host = document.querySelector('.home-station-content') || document.body;
        if (!sit || !host || host.querySelector('.gm-mission-modal')) return;
        const esc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
        const row = (k, v) => v ? `<div class="gm-mm-row"><span>${k}</span><b>${esc(v)}</b></div>` : '';
        const rivals = sit.rivals && sit.rivals.length ? sit.rivals.map((f) => String(f).toUpperCase()).join(' · ') : '';
        const body = row('SITUATION', sit.kind) + row('PLANET', sit.planet) + row('MISSION', sit.mission) +
            row('ATTACKER', sit.attacker ? String(sit.attacker).toUpperCase() : '') + row('DEFENDER', sit.defender ? String(sit.defender).toUpperCase() : '') +
            row('INVADERS', rivals) + row('REWARD', sit.reward);
        const goBtn = sit.planetId && this.nodeById && this.nodeById[sit.planetId]
            ? `<button type="button" class="action-button" id="gmMmGo">${this.btnIconHtml ? this.btnIconHtml('hsTravel') : ''}SHOW PLANET</button>` : '';
        const modal = document.createElement('div');
        modal.className = 'gm-mission-modal';
        modal.innerHTML = `<div class="gm-mm-dialog" role="dialog" aria-label="Mission">` +
            `<h3 class="gm-mm-title">${esc(sit.kind)}</h3>` +
            `<div class="gm-mm-body">${body}</div>` +
            `<p class="gm-mm-goal">${esc(sit.objective)}</p>` +
            `<div class="gm-mm-actions"><button type="button" class="action-button secondary" id="gmMmClose">${this.btnIconHtml ? this.btnIconHtml('back') : ''}CLOSE</button>${goBtn}</div></div>`;
        host.appendChild(modal);
        const close = () => {
            document.removeEventListener('keydown', onKey, true);
            modal.remove();
        };
        const onKey = (e) => {
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
        };
        document.addEventListener('keydown', onKey, true);
        modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
        modal.querySelector('#gmMmClose').addEventListener('click', close);
        const go = modal.querySelector('#gmMmGo');
        if (go) go.addEventListener('click', () => {
            close();
            this.selectPlanet(sit.planetId);
            if (this.frameSelectionCamera) this.frameSelectionCamera('follow');
        });
        (go || modal.querySelector('#gmMmClose')).focus();
    },
    /** Atmosphere haze tone baked into a planet SVG (palette atmoHaze, alpha 66); '' for stations / no atmosphere. */
    planetAtmoColor(iconHtml) {
        const m = /fill="(#[0-9a-f]{6})66"/i.exec(iconHtml || '');
        return m ? m[1] : '';
    },
    /** Disc size of a planet SVG relative to the 0.76 (haze starts at the limb) the haze rings were drawn for (ringed planets sit smaller in their grid). */
    planetAtmoScale(iconHtml) {
        const m = /data-disc="([\d.]+)"/.exec(iconHtml || '');
        const d = m ? Number(m[1]) : 0.76;
        return (Number.isFinite(d) && d > 0.2 ? d / 0.76 : 1).toFixed(3);
    },
    planetIconHtml(planetId, size, asImage, lightDir, mapNode) {
        const sid = String(planetId || 'mars').toLowerCase();
        const px = size || 48;
        if (typeof planetSVGManager !== 'undefined') {
            if (!planetSVGManager.planets || !Object.keys(planetSVGManager.planets).length) {
                planetSVGManager.init();
            }
            // Large views get a finer grid instead of an upscaled icon.
            // Map nodes follow the zoom (shared with the ship, getMapDetail);
            // big views (sector card) always get a fine grid.
            const zoomDetail = this.getMapDetail ? this.getMapDetail() : 1;
            const detail = mapNode && this.planetDetailMul
                ? Math.min(8, zoomDetail * this.planetDetailMul(sid))
                : (px >= 160 ? Math.max(8, zoomDetail) : (px >= 80 ? Math.max(2, zoomDetail) : zoomDetail));
            // Current rotation frame, so zoom re-renders don't jump.
            // First paint must be instant: when the fine model isn't built yet, show the
            // cheap coarse globe now; the spin timer swaps the fine one in (data-spin-frame -1).
            const placeholder = detail > 2 && planetSVGManager.hasSpinModel && !planetSVGManager.hasSpinModel(sid, detail, lightDir);
            const spinModel = planetSVGManager.getPlanetSpinModel ? planetSVGManager.getPlanetSpinModel(sid, placeholder ? 1 : detail, lightDir) : null;
            const realFrame = spinModel ? planetSVGManager.getPlanetSpinIndex(sid, spinModel) : null;
            const spinFrame = placeholder ? -1 : realFrame;
            let svg = spinModel ? planetSVGManager.getPlanetSpinFrame(spinModel, realFrame) : planetSVGManager.getPlanetSVGDetailed
                ? planetSVGManager.getPlanetSVGDetailed(sid, detail)
                : planetSVGManager.getPlanetSVG(sid);
            if (svg && asImage && planetSVGManager.planetSvgToImg) {
                // Map nodes: an <img> is rasterised once and just scaled while
                // zooming — inline SVG with thousands of rects repainted every frame.
                let conv;
                if (spinModel) {
                    spinModel.frameUrls = spinModel.frameUrls || {};
                    spinModel.frameScale = spinModel.frameScale || null;
                    if (!spinModel.frameUrls[realFrame]) {
                        conv = planetSVGManager.planetSvgToImg(svg);
                        spinModel.frameUrls[realFrame] = conv.url;
                        spinModel.frameScale = conv.scale;
                    }
                    conv = { url: spinModel.frameUrls[realFrame], scale: spinModel.frameScale || planetSVGManager.planetSvgToImg(svg).scale };
                } else {
                    conv = planetSVGManager.planetSvgToImg(svg);
                }
                const big = px * conv.scale;
                const off = -(big - px) / 2;
                if (planetSVGManager.startPlanetSpin) planetSVGManager.startPlanetSpin();
                return `<span class="gm-planet-icon gm-planet-icon-img" data-planet-spin="${sid}|${detail}${lightDir == null ? '' : '|' + lightDir}"${spinModel ? ` data-spin-frame="${spinFrame}"` : ''}>` +
                    `<img class="gm-planet-img" src="${conv.url}" alt="" draggable="false" style="width:${big}px;height:${big}px;left:${off}px;top:${off}px"></span>`;
            }
            if (svg) {
                const uid = 'gm_' + sid + '_' + Math.random().toString(36).slice(2, 7);
                svg = svg
                    .replace(/id="([^"]+)"/g, (m, id) => `id="${uid}_${id}"`)
                    .replace(/url\(#([^)]+)\)/g, (m, id) => `url(#${uid}_${id})`)
                    .replace(/width="[^"]*"/, `width="${px}"`)
                    .replace(/height="[^"]*"/, `height="${px}"`);
                // Slow axial rotation (planet-svgs/spin-frames.js).
                if (planetSVGManager.startPlanetSpin) planetSVGManager.startPlanetSpin();
                return `<span class="gm-planet-icon" data-planet-spin="${sid}|${detail}${lightDir == null ? '' : '|' + lightDir}"${spinModel ? ` data-spin-frame="${spinFrame}"` : ''}>${svg}</span>`;
            }
        }
        return `<span class="gm-planet-fallback" style="width:${px}px;height:${px}px">${sid.charAt(0).toUpperCase()}</span>`;
    },
});
