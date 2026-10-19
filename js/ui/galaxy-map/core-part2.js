"use strict";

// GalaxyMapManager members, continued from core.js (kept under ~500 lines per file).
/** Dev layout editor settings for the enemy card: x/y offset (px), size (%) and layer per element. Stored per browser. */
const enemyCardLayout = {
    KEY: 'vf_enemy_card_layout_v1',
    ELS: ['title', 'bar', 'face', 'ship', 'planet'],
    LABELS: { title: 'TITLE', bar: 'BAR', face: 'FACE', ship: 'SHIP', planet: 'PLANET' },
    DEF_Z: { title: 6, bar: 5, face: 4, ship: 3, planet: 0 },
    /** Shipped defaults (x/y px, s %, z layer); anything missing falls back to neutral. Paste COPY output here. */
    BAKED: {"title":{"x":0,"y":0,"s":100,"z":6},"bar":{"x":0,"y":0,"s":100,"z":5},"face":{"x":473,"y":-70,"s":140,"z":4},"ship":{"x":158,"y":-5,"s":105,"z":5},"planet":{"x":-167,"y":9,"s":180,"z":0}},
    defaults() { const o = {}; this.ELS.forEach((k) => { const b = this.BAKED[k] || {}; o[k] = { x: b.x || 0, y: b.y || 0, s: b.s || 100, z: b.z !== undefined ? b.z : this.DEF_Z[k] }; }); return o; },
    load() {
        let v = {};
        try { v = JSON.parse(localStorage.getItem(this.KEY) || '{}') || {}; } catch (e) { v = {}; }
        const out = this.defaults();
        this.ELS.forEach((k) => {
            if (!v[k]) return;
            const e = v[k];
            out[k] = {
                x: Math.round(+e.x || 0), y: Math.round(+e.y || 0),
                s: Math.max(20, Math.min(300, Math.round(+e.s || 100))),
                z: Number.isFinite(+e.z) && e.z !== undefined ? Math.round(+e.z) : this.DEF_Z[k]
            };
        });
        return out;
    },
    save(v) { try { localStorage.setItem(this.KEY, JSON.stringify(v)); } catch (e) { /* ignore */ } },
    reset() { try { localStorage.removeItem(this.KEY); } catch (e) { /* ignore */ } },
    /** Writes every custom property onto one node. The planet sits behind the card (z < 5) or in front of it. */
    paint(n, l) {
        this.ELS.forEach((k) => {
            n.style.setProperty(`--ec-${k}-x`, l[k].x + 'px');
            n.style.setProperty(`--ec-${k}-y`, l[k].y + 'px');
            n.style.setProperty(`--ec-${k}-s`, String(l[k].s / 100));
            n.style.setProperty(`--ec-${k}-z`, String(l[k].z));
        });
        const front = l.planet.z >= 5;
        n.style.setProperty('--ec-planet-segz', front ? '3' : '1');
        n.style.setProperty('--ec-planet-mz', front ? '10' : '0');
    },
    /** Inline custom properties for a freshly built card. */
    css(v) {
        const l = v || this.load(), n = { style: { setProperty(k, val) { this.t.push(k + ':' + val); }, t: [] } };
        this.paint(n, l);
        return n.style.t.join(';');
    },
    /** Re-applies the saved settings to the page and to every enemy card on screen. */
    applyLive(v) {
        const l = v || this.load();
        this.paint(document.documentElement, l);
        document.querySelectorAll('.gm-enemy-card-in').forEach((el) => this.paint(el, l));
    },
    openModal() {
        const ecl = this;
        if (typeof galaxyMapManager === 'undefined' || document.querySelector('.ecl-back')) return;
        let cur = ecl.load();
        let last = 'face';
        const back = document.createElement('div');
        back.className = 'ecl-back';
        back.innerHTML = '<div class="ecl-modal" role="dialog" aria-label="Enemy card layout">' +
            '<div class="ecl-title">ENEMY CARD LAYOUT</div>' +
            '<div class="ecl-hint">Click or drag an element. Arrow keys nudge it (Shift = 10px). The planet is either behind or in front of the card.</div>' +
            '<div class="ecl-fit"><div class="ecl-stage"></div></div>' +
            '<div class="ecl-ctl"><span class="ecl-chips">' + ecl.ELS.map((k) => `<button type="button" class="action-button ecl-chip" data-ecl-sel="${k}">${ecl.LABELS[k]}</button>`).join('') + '</span>' +
            '<span class="ecl-row">SIZE <button type="button" class="action-button" data-ecl="s-">−</button>' +
            '<input type="range" class="ecl-range" min="20" max="300" step="5" data-ecl-range><button type="button" class="action-button" data-ecl="s+">+</button><b class="ecl-val" data-ecl-sval></b></span>' +
            '<span class="ecl-row">LAYER <button type="button" class="action-button" data-ecl="z-">▼</button><b class="ecl-val" data-ecl-zval></b><button type="button" class="action-button" data-ecl="z+">▲</button></span></div>' +
            '<div class="ecl-actions"><span class="ecl-right"><button type="button" class="action-button" data-ecl="reset">RESET</button><button type="button" class="action-button" data-ecl="copy">COPY AS DEFAULT</button></span>' +
            '<span class="ecl-right"><button type="button" class="action-button" data-ecl="cancel">CANCEL</button>' +
            '<button type="button" class="action-button" data-ecl="save">SAVE</button></span></div></div>';
        document.body.appendChild(back);
        const stage = back.querySelector('.ecl-stage'), fitBox = back.querySelector('.ecl-fit');
        const range = back.querySelector('[data-ecl-range]');
        let sc = 1, SW = 640, SH = 220;
        const fit = () => {
            sc = Math.max(0.1, Math.min(1, (back.firstElementChild.clientWidth - 40) / SW, (back.clientHeight * 0.9 - 260) / SH));
            stage.style.width = SW + 'px'; stage.style.height = SH + 'px';
            fitBox.style.width = Math.round(SW * sc) + 'px'; fitBox.style.height = Math.round(SH * sc) + 'px';
            stage.style.transform = 'scale(' + sc + ')';
        };
        fit();
        window.addEventListener('resize', fit);
        const paintAll = () => {
            ecl.paint(stage, cur);
            const card = stage.querySelector('.gm-enemy-card-in');
            if (card) ecl.paint(card, cur);
        };
        const refreshUi = () => {
            stage.dataset.sel = last;
            back.querySelectorAll('[data-ecl-sel]').forEach((b) => b.classList.toggle('is-on', b.getAttribute('data-ecl-sel') === last));
            range.value = cur[last].s;
            back.querySelector('[data-ecl-sval]').textContent = cur[last].s + '%';
            back.querySelector('[data-ecl-zval]').textContent = String(cur[last].z);
        };
        const draw = () => {
            const gm = galaxyMapManager, pid = gm.selectedPlanetId;
            // Preferred: an exact copy of the live bottom bar (same geometry, planet card included); the mock is the fallback.
            const live = document.querySelector('.galaxy-map-panels');
            const liveBar = live && live.querySelector('.galaxy-map-ruler.is-bar');
            if (liveBar && liveBar.querySelector('.gm-enemy-card-in') && liveBar.offsetWidth > 50) {
                SW = liveBar.offsetWidth; SH = liveBar.offsetHeight;
                const copy = live.cloneNode(true);
                copy.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
                stage.classList.add('is-clone');
                stage.innerHTML = '<div class="galaxy-map-embedded"><div class="gm-map-stage"></div></div>';
                stage.querySelector('.gm-map-stage').appendChild(copy);
                paintAll(); refreshUi(); fit();
                return;
            }
            SW = 640; SH = 220; stage.classList.remove('is-clone');
            const pInfo = pid && gm.getPlanetInfo ? gm.getPlanetInfo(pid) : null;
            const art = pid && gm.planetIconHtml ? gm.planetIconHtml(pid, 260) : '';
            stage.innerHTML = (art ? `<div class="ecl-planet">${art}</div>` : '') +
                gm.enemyCardHtml({ id: null, name: (pInfo && pInfo.name) || 'Node Array' }, ((pid && typeof planetConfigManager !== 'undefined' && planetConfigManager.getHostileFactions && planetConfigManager.getHostileFactions(pid) || [])[0]) || 'machine');
            paintAll();
            refreshUi();
            fit();
        };
        const SEL = { title: '.gm-enemy-title', bar: '.gm-enemy-text', face: '.gm-enemy-avatar', ship: '.gm-enemy-ship', planet: '.ecl-planet, .gm-sector-planet-bg' };
        const upd = (k, patch) => { Object.assign(cur[k], patch); cur[k].s = Math.max(20, Math.min(300, cur[k].s)); paintAll(); refreshUi(); };
        stage.addEventListener('pointerdown', (e) => {
            const k = Object.keys(SEL).find((key) => e.target.closest(SEL[key]));
            if (!k) return;
            e.preventDefault();
            last = k; refreshUi();
            const sx = e.clientX, sy = e.clientY, ox = cur[k].x, oy = cur[k].y;
            const mv = (ev) => upd(k, { x: Math.round(ox + (ev.clientX - sx) / sc), y: Math.round(oy + (ev.clientY - sy) / sc) });
            const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
            window.addEventListener('pointermove', mv);
            window.addEventListener('pointerup', up);
        });
        range.addEventListener('input', () => upd(last, { s: +range.value }));
        const close = () => { document.removeEventListener('keydown', onKey, true); window.removeEventListener('resize', fit); back.remove(); };
        const onKey = (e) => {
            if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(); return; }
            const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
            if (d && !(e.target && e.target.type === 'range')) { e.preventDefault(); e.stopImmediatePropagation(); const m = e.shiftKey ? 10 : 1; upd(last, { x: cur[last].x + d[0] * m, y: cur[last].y + d[1] * m }); }
        };
        document.addEventListener('keydown', onKey, true);
        back.addEventListener('click', (e) => {
            if (e.target === back) { close(); return; }
            const chip = e.target.closest('[data-ecl-sel]');
            if (chip) { last = chip.getAttribute('data-ecl-sel'); refreshUi(); return; }
            const b = e.target.closest('[data-ecl]');
            if (!b) return;
            const act = b.getAttribute('data-ecl');
            if (act === 's-' || act === 's+') { upd(last, { s: cur[last].s + (act === 's+' ? 5 : -5) }); return; }
            if (act === 'z-' || act === 'z+') { upd(last, { z: cur[last].z + (act === 'z+' ? 1 : -1) }); return; }
            if (act === 'copy') { const t = JSON.stringify(cur); b.textContent = 'COPIED'; try { navigator.clipboard.writeText(t); } catch (err) { window.prompt('Copy:', t); } return; }
            if (act === 'reset') { cur = ecl.defaults(); draw(); return; }
            if (act === 'save') { ecl.save(cur); ecl.applyLive(cur); }
            close();
        });
        draw();
    }
};
enemyCardLayout.applyLive();
document.addEventListener('click', (e) => {
    if (typeof startScreenManager === 'undefined' || !startScreenManager.devMode) return;
    if (!e.target.closest || e.target.closest('.ecl-back') || !e.target.closest('.gm-enemy-card')) return;
    e.preventDefault(); e.stopPropagation();
    enemyCardLayout.openModal();
}, true);

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
    renderGalaxyRulerBadge(mode) {
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
        if (mode === 'split') return { ruler: ruler, sit: sit };
        return ruler + sit;
    },
    /** Enemy card of the selected planet: the hostile faction's hero portrait and one of its ships. */
    enemyCardHtml(info, factionOverride) {
        if (!info || typeof planetConfigManager === 'undefined') return '';
        const pcm = planetConfigManager;
        const hostile = factionOverride ? null : pcm.getHostileFactions ? pcm.getHostileFactions(info.id) : (pcm.getPlanetFactions ? pcm.getPlanetFactions(info.id) : []);
        const f = factionOverride || (hostile && hostile[0]);
        if (!f || (!factionOverride && this.isUnlocked && !this.isUnlocked(info.id))) return '';
        const fss = typeof factionShipStyles !== 'undefined' ? factionShipStyles : null;
        const accent = (fss && fss.getFactionStyle && (fss.getFactionStyle(f) || {}).accent) || 'var(--color-primary)';
        const portrait = typeof heroPortrait !== 'undefined' && heroPortrait.html
            ? heroPortrait.html(heroPortrait.heroLook(f), accent, { nobg: true }) : '';
        const hs = typeof homeStationUI !== 'undefined' ? homeStationUI : null;
        const shipSrc = hs && hs.factionShipSrcHd ? hs.factionShipSrcHd(f, 'assault', 4) : '';
        const meta = pcm.getFactionMeta ? pcm.getFactionMeta(f) : null;
        const name = String((meta && meta.hero && meta.hero.name) || f).toUpperCase();
        const emblem = typeof profileSelectionManager !== 'undefined' && profileSelectionManager.getFactionEmblemHtml
            ? profileSelectionManager.getFactionEmblemHtml(f, 22) : '';
        const planetName = String(info.name || '').toUpperCase();
        return `<div class="gm-enemy-card-in" style="--ruler-accent:${accent};${enemyCardLayout.css()}" data-ui-tip="ENEMY · ${name}">` +
            (portrait ? `<span class="gm-enemy-avatar">${portrait}</span>` : '') +
            `<span class="gm-enemy-title">${planetName}</span>` +
            `<span class="gm-enemy-text">${emblem ? `<span class="gm-enemy-emblem">${emblem}</span>` : ''}<span class="gm-enemy-kind">ENEMY</span><span class="gm-enemy-name">${name}</span></span>` +
            (shipSrc ? `<img class="gm-enemy-ship" src="${shipSrc}" alt="" draggable="false">` : '') +
            `</div>`;
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
            const frontNodes = (map.nodes || []).filter((n) => {
                const f = planetConfigManager.getPlanetFactions ? planetConfigManager.getPlanetFactions(n.planetId) : [];
                // Frontline = a planet held by an invading rival.
                return f && f.length && c.rivals.indexOf(f[0]) !== -1;
            });
            const front = frontNodes.length;
            const frontPlanets = frontNodes.map((n) => {
                const cfg = planetConfigManager.getConfig ? planetConfigManager.getConfig(n.planetId) : null;
                return { id: n.planetId, name: String((cfg && cfg.name) || n.planetId || '').toUpperCase() };
            });
            const rivalStyle = styleOf(c.rivals[0]);
            const accent = (rivalStyle && rivalStyle.accent) || 'var(--color-primary)';
            this._situationAccent = accent;
            const emblems = c.rivals.map((f) => `<span class="galaxy-map-situation-emblem" title="${esc(String(f).toUpperCase())}">${emblemOf(f, 32)}</span>`).join('');
            this._situation = { kind: 'CONFLICT', planetId: frontPlanets.length ? frontPlanets[0].id : null, rivals: c.rivals.slice(), front: front, frontPlanets: frontPlanets,
                objective: front ? front + ' frontline planet' + (front === 1 ? '' : 's') + ' held by the invaders — ' + frontPlanets.map((p) => p.name).join(', ') + '. Take them back.' : 'Raids on the border. Clear planets to push the invaders back.' };
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
    /** Current situation (invasion / active mission / conflict) of the player's galaxy, also without a mounted map. */
    getSituationInfo() {
        if (typeof planetConfigManager === 'undefined' || typeof profileManager === 'undefined') return null;
        const gid = profileManager.getCurrentGalaxyId ? profileManager.getCurrentGalaxyId() : this.galaxyId;
        if (!gid) return null;
        const keep = { g: this.galaxyId, s: this._situation, a: this._situationAccent };
        try {
            this.galaxyId = gid;
            const c = (planetConfigManager.getGalaxyControl && planetConfigManager.getGalaxyControl(gid)) || {};
            const styleOf = (f) => (typeof factionShipStyles !== 'undefined' && factionShipStyles.getFactionStyle ? factionShipStyles.getFactionStyle(f) : null);
            const emblemOf = (f, size) => (typeof profileSelectionManager !== 'undefined' && profileSelectionManager.getFactionEmblemHtml
                ? profileSelectionManager.getFactionEmblemHtml(f, size) : '');
            this.renderGalaxySituationCard(c, emblemOf, styleOf);
            return { sit: this._situation, accent: this._situationAccent };
        } finally {
            this.galaxyId = keep.g; this._situation = keep.s; this._situationAccent = keep.a;
        }
    },
    openSituationModal(given) {
        const sit = given || this._situation;
        const host = document.querySelector('.home-station-content') || document.body;
        if (!sit || !host || host.querySelector('.gm-mission-modal')) return;
        const esc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
        const emblemOf = (f, size) => (typeof profileSelectionManager !== 'undefined' && profileSelectionManager.getFactionEmblemHtml
            ? profileSelectionManager.getFactionEmblemHtml(f, size) : '');
        const row = (k, v) => v ? `<div class="gm-mm-row"><span>${k}</span><b>${esc(v)}</b></div>` : '';
        const facRow = (k, factions) => (factions && factions.length)
            ? `<div class="gm-mm-row gm-mm-row-fac"><span>${k}</span><span class="gm-mm-facs">` +
                factions.map((f) => `<span class="gm-mm-fac-chip">${emblemOf(f, 24)}<b>${esc(String(f).toUpperCase())}</b></span>`).join('') +
                `</span></div>` : '';
        const body = row('SITUATION', sit.kind) + row('PLANET', sit.planet) + row('MISSION', sit.mission) +
            facRow('ATTACKER', sit.attacker ? [sit.attacker] : null) + facRow('DEFENDER', sit.defender ? [sit.defender] : null) +
            facRow('INVADERS', sit.rivals) + row('REWARD', sit.reward);
        const frontList = sit.frontPlanets && sit.frontPlanets.length
            ? `<div class="gm-mm-row gm-mm-row-planets"><span>FRONTLINE PLANETS</span><span class="gm-mm-planets">` +
                sit.frontPlanets.map((p) => {
                    const found = !!(this.nodeById && this.nodeById[p.id]);
                    return found
                        ? `<button type="button" class="gm-mm-planet-chip" data-planet="${esc(p.id)}">${esc(p.name)}</button>`
                        : `<button type="button" class="gm-mm-planet-chip" disabled data-ui-tip="NOT YET CHARTED — EXPLORE THIS GALAXY TO FIND IT">${esc(p.name)}</button>`;
                }).join('') +
                `</span></div>` : '';
        const goBtn = sit.planetId && this.nodeById && this.nodeById[sit.planetId]
            ? `<button type="button" class="action-button" id="gmMmGo">${this.btnIconHtml ? this.btnIconHtml('hsTravel') : ''}SHOW PLANET</button>` : '';
        const modal = document.createElement('div');
        modal.className = 'gm-mission-modal';
        modal.innerHTML = `<div class="gm-mm-dialog" role="dialog" aria-label="Mission">` +
            `<h3 class="gm-mm-title">${esc(sit.kind)}</h3>` +
            `<div class="gm-mm-body">${body}${frontList}</div>` +
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
        modal.querySelectorAll('.gm-mm-planet-chip').forEach((chip) => {
            chip.addEventListener('click', () => {
                const pid = chip.getAttribute('data-planet');
                close();
                this.selectPlanet(pid);
                if (this.frameSelectionCamera) this.frameSelectionCamera('follow');
            });
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
            // Map nodes: cap detail for spin cost (≤8). Slightly coarser on purpose
            // so the galaxy map stays smooth; sector-card previews stay finer.
            let detail;
            if (mapNode && this.planetDetailMul) {
                detail = zoomDetail * this.planetDetailMul(sid);
                try {
                    const svgEl = typeof document !== 'undefined' ? document.querySelector('.galaxy-map-svg') : null;
                    const vb = this.getMapViewBox
                        ? this.getMapViewBox(
                            typeof GM_MAP_W !== 'undefined' ? GM_MAP_W : 640,
                            typeof GM_MAP_H !== 'undefined' ? GM_MAP_H : 320,
                            typeof GM_MAP_PAD !== 'undefined' ? GM_MAP_PAD : 48
                        )
                        : null;
                    if (svgEl && vb && vb[2] > 0) {
                        const screenPx = px * (svgEl.clientWidth / vb[2]);
                        const cells = this.planetGridCells ? this.planetGridCells(sid) : 18;
                        // ~2.5 CSS px per art cell — a bit coarser, much cheaper to spin.
                        const need = Math.ceil(screenPx / Math.max(8, cells * 2.5));
                        if (need > detail) detail = need;
                        const gp = (typeof uiAppearanceManager !== 'undefined' && uiAppearanceManager.getGlobalPixelPx)
                            ? uiAppearanceManager.getGlobalPixelPx() : 0;
                        // Global Pixel Size: one art cell == gp screen px.
                        if (gp > 0) {
                            const live = this.mapScreenScale ? this.mapScreenScale() : 0;
                            if (live > 0) detail = Math.max(1, Math.ceil(px * live / (cells * gp) - 0.05)); // round up; snapPixelImg trims to the exact grid
                        }
                    }
                } catch (e) { /* zoom detail only */ }
                detail = (typeof uiAppearanceManager !== 'undefined' && uiAppearanceManager.getGlobalPixelPx && uiAppearanceManager.getGlobalPixelPx() > 0) ? Math.min(8, detail) : Math.min(8, detail);
                if (typeof uiAppearanceManager !== 'undefined' && uiAppearanceManager.getGlobalPixelPx && uiAppearanceManager.getGlobalPixelPx() > 0) detail = Math.max(1, Math.min(8, detail));
            } else {
                detail = px >= 160 ? Math.max(8, zoomDetail) : (px >= 80 ? Math.max(2, zoomDetail) : zoomDetail);
                const gp2 = (typeof uiAppearanceManager !== 'undefined' && uiAppearanceManager.getGlobalPixelPx)
                    ? uiAppearanceManager.getGlobalPixelPx() : 0;
                // Global Pixel Size: big non-node views (selected planet, sector card): one art cell == gp px.
                if (gp2 > 0) {
                    const cells2 = this.planetGridCells ? this.planetGridCells(sid) : 18;
                    detail = Math.max(1, Math.min(8, Math.round(px / (cells2 * gp2))));
                }
            }
            // Current rotation frame, so zoom re-renders don't jump.
            // First paint: if the target model isn't ready yet, use a medium stand-in
            // (detail 2 — still readable) and let the spin timer upgrade (data-spin-frame -1).
            // Detail 1 was too blocky when stretched to map-node size.
            const placeholder = detail > 2 && planetSVGManager.hasSpinModel && !planetSVGManager.hasSpinModel(sid, detail, lightDir);
            const standIn = placeholder ? Math.min(2, detail) : detail;
            const spinDetail = (planetSVGManager.clampSpinDetail
                ? planetSVGManager.clampSpinDetail(standIn)
                : Math.min(8, standIn));
            const spinModel = planetSVGManager.getPlanetSpinModel ? planetSVGManager.getPlanetSpinModel(sid, spinDetail, lightDir) : null;
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
                // Attribute carries the TARGET detail (not the placeholder's 1), so the
                // spin timer can upgrade the coarse first paint to the fine globe.
                return `<span class="gm-planet-icon gm-planet-icon-img" data-planet-spin="${sid}|${detail}${lightDir == null ? '' : '|' + lightDir}" data-planet-px="${px}"${spinModel ? ` data-spin-frame="${spinFrame}"` : ''}>` +
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
                return `<span class="gm-planet-icon" data-planet-spin="${sid}|${detail}${lightDir == null ? '' : '|' + lightDir}" data-planet-px="${px}"${spinModel ? ` data-spin-frame="${spinFrame}"` : ''}>${svg}</span>`;
            }
        }
        return `<span class="gm-planet-fallback" style="width:${px}px;height:${px}px">${sid.charAt(0).toUpperCase()}</span>`;
    },
});
