"use strict";

// HomeStationUI methods: the FACTIONS area. Three tabs:
//   factions   — RELATIONS: one card per faction, click opens its detail view
//   ftrade     — TRADE: buy / sell materials with allied factions
//   fcontracts — CONTRACTS: faction jobs and bounty hunts in reachable galaxies
// Logic lives in js/core/faction-relations.js.
extendClass(HomeStationUI, {
    factionLabel(id) {
        const f = typeof factionManager !== 'undefined' ? factionManager.getFaction(id) : null;
        return String((f && f.label) || id).toUpperCase();
    },

    factionMeterHtml(rel) {
        // −100 … 0 (centre mark) … +100, value printed on the bar.
        const pct = Math.round((rel.score + 100) / 2);
        const val = (rel.score > 0 ? '+' : '') + rel.score;
        return `<div class="hs-faction-meter" title="Relation ${val} (−100 hostile · 0 neutral · +100 allied)">` +
            `<span class="hs-faction-meter-fill" style="width:${pct}%"></span>` +
            `<i class="hs-faction-meter-mid" aria-hidden="true"></i>` +
            `<b class="hs-faction-meter-val">${val}</b></div>`;
    },

    renderFactionsTab(profile) {
        const fm = typeof factionManager !== 'undefined' ? factionManager : null;
        if (!fm || !fm.getRelation) return `<div class="hs-section">${this.panelTitle('menuPeoples', 'FACTIONS')}<p class="hs-muted">No faction data.</p></div>`;
        const ids = fm.getFactionIds();
        if (!ids.length) return `<div class="hs-section">${this.panelTitle('menuPeoples', 'FACTIONS')}<p class="hs-muted">No faction data.</p></div>`;
        // The faction cards are index-card tabs; the selected one's details sit below.
        if (!fm.factions[this._factionDetail]) {
            const own = fm.getAllegiance && fm.getAllegiance();
            this._factionDetail = ids.indexOf(own) !== -1 ? own : ids[0];
        }
        const id = this._factionDetail;
        const owners = fm.state.controlledPlanets || {};
        const tabs = ids.map((fid) => {
            const rel = fm.getRelation(fid);
            const planets = Object.keys(owners).filter((p) => owners[p] === fid).length;
            return `<button type="button" class="hs-tab hs-subnav-tab hs-faction-card is-${rel.tone}${fid === id ? ' active' : ''}" data-faction-open="${fid}" data-nav-item title="${this.factionLabel(fid)}">` +
                `<div class="hs-faction-head">` +
                    `<span class="hs-faction-crest">${this.factionEmblemHtml({ faction: fid }, 48)}</span>` +
                    `<span class="hs-faction-name">${this.factionLabel(fid)}</span>` +
                    `<span class="hs-faction-status">${rel.label}</span>` +
                `</div>` +
                this.factionMeterHtml(rel) +
                `<div class="hs-faction-stats"><span>RELATION ${rel.score > 0 ? '+' : ''}${rel.score}</span><span>PLANETS ${planets}</span>` +
                `<span>${fm.isAllied(fid) ? 'TRADES' : 'NO TRADE'}</span></div>` +
                `</button>`;
        }).join('');
        return `<div class="hs-factions hs-faction-detail is-${fm.getRelation(id).tone}">` +
            `<p class="hs-muted hs-hint">Contracts raise your reputation; from +${FACTION_TRADE_REP} or with a pact a faction trades with you.</p>` +
            `<nav class="hs-faction-grid hs-faction-tabs" role="tablist" aria-label="Factions">${tabs}</nav>` +
            `<div class="hs-faction-tabpanel" role="tabpanel">${this.renderFactionDetail(profile, id)}</div>` +
            `</div>`;
    },

    /** Faction ship sprite as an image URL: the PNG asset if loaded, else the pixel grid. */
    factionShipSrc(fid, cls) {
        const fss = typeof factionShipStyles !== 'undefined' ? factionShipStyles : null;
        if (!fss) return '';
        const key = fss.spriteKey(fid, cls);
        const cache = this._factionShipSrc || (this._factionShipSrc = {});
        if (cache[key]) return cache[key];
        const png = typeof spriteLoader !== 'undefined' && spriteLoader.getSprite ? spriteLoader.getSprite(key) : null;
        if (png && png.src) return (cache[key] = png.src);
        const grid = fss.getPixelSprite(fid, cls);
        const colors = fss.buildFactionColors(fid);
        if (!grid || !grid.length) return '';
        const c = document.createElement('canvas');
        c.width = grid[0].length;
        c.height = grid.length;
        const ctx = c.getContext('2d');
        grid.forEach((row, y) => row.forEach((v, x) => {
            if (!v || !colors[v] || colors[v] === 'transparent') return;
            ctx.fillStyle = colors[v];
            ctx.fillRect(x, y, 1, 1);
        }));
        return (cache[key] = c.toDataURL());
    },

    factionSectionTabsHtml(sections, active) {
        return `<nav class="hs-fd-tabs" role="tablist" aria-label="Faction sections">` +
            sections.map(([sid, label]) =>
                `<button type="button" class="hs-tab hs-subnav-tab${sid === active ? ' active' : ''}" data-faction-section="${sid}" data-nav-item>` +
                `<span class="hs-tab-label">${label}</span></button>`).join('') +
            `</nav>`;
    },

    renderFactionDetail(profile, id) {
        const fm = factionManager;
        const f = fm.getFaction(id);
        const rel = fm.getRelation(id);
        const fss = typeof factionShipStyles !== 'undefined' ? factionShipStyles : null;
        const style = fss ? fss.getFactionStyle(id) : {};
        const up = (v) => String(v || '').replace(/_/g, ' ').toUpperCase();
        const galaxyName = (gid) => {
            const g = typeof planetConfigManager !== 'undefined' && planetConfigManager.getGalaxy ? planetConfigManager.getGalaxy(gid) : null;
            return up((g && g.name) || gid);
        };
        const galaxies = (typeof planetConfigManager !== 'undefined' && planetConfigManager.getGalaxyFactionIds)
            ? planetConfigManager.getGalaxyIds().filter((gid) => planetConfigManager.getGalaxyFactionIds(gid).indexOf(id) !== -1)
            : [];
        const galaxyChips = galaxies.map((gid) => `<span class="hs-chip">${galaxyName(gid)}</span>`).join('') || '<span class="hs-muted">NONE KNOWN</span>';
        const contracts = (typeof profileManager !== 'undefined' && profileManager.getFactionContracts)
            ? profileManager.getFactionContracts(profile).filter((c) => c.factionId === id).length : 0;
        const owners = fm.state.controlledPlanets || {};
        const planets = Object.keys(owners).filter((p) => owners[p] === id).length;
        const canPact = fm.getAllegiance() && fm.getAllegiance() !== id;
        const terms = fm.getTradeTerms(id);
        const weapons = typeof weaponConfigManager !== 'undefined' && weaponConfigManager.getFactionWeaponAffinity
            ? weaponConfigManager.getFactionWeaponAffinity(id) : [];
        const row = (label, value) => `<div class="hs-fd-row"><span>${label}</span><b>${value}</b></div>`;
        const hero = f.hero || null;
        const sections = [['overview', 'OVERVIEW']];
        if (hero) sections.push(['hero', 'HERO']);
        if (f.loreLong || f.lore) sections.push(['archive', 'ARCHIVE']);
        const section = sections.some((x) => x[0] === this._factionSection) ? this._factionSection : 'overview';
        const bodies = {
            overview: () => `<div class="hs-fd-cols">` +
                `<section class="hs-panel hs-fd-block"><h4>STANDING</h4>` +
                    row('RELATION', `${rel.score > 0 ? '+' : ''}${rel.score} · ${rel.label}`) +
                    row('TRADE', fm.isAllied(id) ? 'OPEN' : `LOCKED · +${FACTION_TRADE_REP} NEEDED`) +
                    row('PACT', fm.hasPact(id) ? 'ACTIVE' : 'NONE') +
                    row('CONTRACTS', contracts) +
                    row('PLANETS HELD', planets) +
                `</section>` +
                `<section class="hs-panel hs-fd-block"><h4>TERRITORY</h4>` +
                    (f.homeGalaxy ? row('HOME', galaxyName(f.homeGalaxy)) : '') +
                    `<div class="hs-fd-chips">${galaxyChips}</div>` +
                `</section>` +
                `<section class="hs-panel hs-fd-block"><h4>TRADE TERMS</h4>` +
                    row('SPECIALTY', `${up(terms.specialty)} · CHEAP`) +
                    row('DEMANDS', `${up(terms.demand)} · PAYS WELL`) +
                    row('DISCOUNT', `${Math.round(terms.discount * 100)}%`) +
                `</section>` +
                `<section class="hs-panel hs-fd-block"><h4>WEAPONS</h4>` +
                    (weapons.length ? `<div class="hs-fd-chips">${weapons.map((w) => `<span class="hs-chip">${up(w)}</span>`).join('')}</div>` : '') +
                    `<p class="hs-fd-text">+20% damage with these weapons.${f.weaponNote ? ' ' + f.weaponNote : ''}</p>` +
                `</section>` +
            `</div>`,
            hero: () => (hero ? `<section class="hs-panel hs-fd-block"><h4>HERO · ${up(hero.name)}</h4>` +
                (hero.title ? `<p class="hs-fd-goal">${hero.title}</p>` : '') +
                (hero.lore ? `<p class="hs-fd-text">${hero.lore}</p>` : '') +
            `</section>` : ''),
            archive: () => ((f.loreLong || f.lore) ? `<section class="hs-panel hs-fd-block"><h4>ARCHIVE</h4><p class="hs-fd-text">${f.loreLong || f.lore}</p></section>` : '')
        };
        return `<div class="hs-fd">` +
            `<section class="hs-panel hs-fd-hero">` +
                `<span class="hs-faction-crest hs-faction-crest-lg">${this.factionEmblemHtml({ faction: id }, 96)}</span>` +
                `<div class="hs-fd-hero-info">` +
                    `<div class="hs-faction-head"><span class="hs-faction-name">${this.factionLabel(id)}</span><span class="hs-faction-status">${rel.label}</span></div>` +
                    (f.goal ? `<p class="hs-fd-goal">${f.goal}</p>` : '') +
                    (f.playstyle ? `<p class="hs-fd-text">${f.playstyle}</p>` : '') +
                    ((f.traits || []).length ? `<div class="hs-fd-chips">${f.traits.map((t) => `<span class="hs-chip">${up(t)}</span>`).join('')}</div>` : '') +
                `</div>` +
            `</section>` +
            this.factionSectionTabsHtml(sections, section) +
            `<div class="hs-fd-section" role="tabpanel">${bodies[section]()}</div>` +
            `<div class="hs-faction-actions">` +
                (fm.isAllied(id) ? `<button type="button" class="action-button" data-faction-goto="ftrade" data-faction-id="${id}" data-nav-item>TRADE</button>` : '') +
                `<button type="button" class="action-button" data-faction-goto="fcontracts" data-faction-id="${id}" data-nav-item>CONTRACTS</button>` +
                (canPact ? `<button type="button" class="action-button secondary" data-faction-pact="${id}" data-nav-item>${fm.hasPact(id) ? 'END PACT' : 'PROPOSE PACT'}</button>` : '') +
            `</div>` +
            `</div>`;
    },

    /** FLEETS tab: pick a faction, list its ship classes, live preview on the right. */
    renderFactionFleetTab(profile) {
        const fm = typeof factionManager !== 'undefined' ? factionManager : null;
        const fss = typeof factionShipStyles !== 'undefined' ? factionShipStyles : null;
        if (!fm || !fss) return `<div class="hs-section">${this.panelTitle('hsHangar', 'FLEETS')}<p class="hs-muted">No fleet data.</p></div>`;
        const ids = fm.getFactionIds();
        if (ids.indexOf(this._factionDetail) === -1) {
            const own = fm.getAllegiance && fm.getAllegiance();
            this._factionDetail = ids.indexOf(own) !== -1 ? own : ids[0];
        }
        const id = this._factionDetail;
        const style = fss.getFactionStyle(id);
        const up = (v) => String(v || '').replace(/_/g, ' ').toUpperCase();
        const classes = fss.classes;
        const sel = classes.indexOf(this._factionFleetShip) !== -1 ? this._factionFleetShip : 'all';
        const item = (cid, label, img) =>
            `<button type="button" class="hs-fd-fleet-item${sel === cid ? ' active' : ''}" data-faction-fleet="${cid}" data-nav-item>` +
            `<span class="hs-fd-fleet-thumb">${img}</span><span>${label}</span></button>`;
        const list = item('all', 'ALL', '') + classes.map((cls) => {
            const src = this.factionShipSrc(id, cls);
            return item(cls, up(cls), src ? `<img src="${src}" alt="">` : '');
        }).join('');
        const swatch = (label, color) => color
            ? `<span class="hs-fd-swatch"><i style="background:${color}"></i>${label}<em>${String(color).toUpperCase()}</em></span>` : '';
        const picker = ids.map((fid) =>
            `<button type="button" class="hs-tab hs-subnav-tab${fid === id ? ' active' : ''}" data-faction-open="${fid}" data-nav-item title="${this.factionLabel(fid)}">` +
            `<span class="hs-tab-icon">${this.factionEmblemHtml({ faction: fid }, 32)}</span>` +
            `<span class="hs-tab-label">${this.factionLabel(fid)}</span></button>`).join('');
        return `<div class="hs-factions hs-fd hs-faction-fleets">` +
            `<nav class="hs-fd-tabs hs-fleet-faction-picker" aria-label="Factions">${picker}</nav>` +
            `<section class="hs-panel hs-fd-block"><h4>${this.factionLabel(id)} FLEET · ${up(style.silhouette || '')} HULLS</h4>` +
                `<div class="hs-fd-fleet">` +
                    `<div class="hs-fd-fleet-list" role="listbox">${list}</div>` +
                    `<div class="hs-fd-fleet-stage"><canvas data-fleet-preview data-faction="${id}" data-ship="${sel}" width="240" height="135"></canvas></div>` +
                `</div>` +
                `<div class="hs-fd-chips">${swatch('HULL', style.hull)}${swatch('EDGE', style.edge)}${swatch('ACCENT', style.accent)}${swatch('ENGINE', style.engine)}</div>` +
                (style.prompt ? `<p class="hs-fd-text">${style.prompt.charAt(0).toUpperCase() + style.prompt.slice(1)}.</p>` : '') +
            `</section>` +
            `</div>`;
    },

    renderFactionTradeTab(profile) {
        const fm = typeof factionManager !== 'undefined' ? factionManager : null;
        if (!fm || !fm.getTradeQuote) return '';
        const allies = fm.getFactionIds().filter((id) => fm.isAllied(id));
        if (!allies.length) {
            return `<div class="hs-section hs-panel">${this.panelTitle('hsShop', 'FACTION TRADE')}` +
                `<p class="hs-muted hs-empty-slot">NO ALLIED FACTIONS · sign a pact or reach +${FACTION_TRADE_REP} reputation through contracts.</p></div>`;
        }
        if (allies.indexOf(this._factionTrade) === -1) this._factionTrade = allies[0];
        const id = this._factionTrade;
        const terms = fm.getTradeTerms(id);
        const res = profile.resources || {};
        const picker = allies.map((fid) =>
            `<button type="button" class="hs-tab hs-subnav-tab${fid === id ? ' active' : ''}" data-faction-trade="${fid}" data-nav-item title="${this.factionLabel(fid)}">` +
            `<span class="hs-tab-icon">${this.factionEmblemHtml({ faction: fid }, 32)}</span>` +
            `<span class="hs-tab-label">${this.factionLabel(fid)}</span></button>`
        ).join('');
        const rows = terms.materials.map((mat) => {
            const q = fm.getTradeQuote(id, mat);
            const tag = mat === terms.specialty ? '<small class="hs-trade-tag">SPECIALTY</small>'
                : (mat === terms.demand ? '<small class="hs-trade-tag is-demand">IN DEMAND</small>' : '');
            const have = Number(res[mat]) || 0;
            return `<div class="hs-line hs-trade-line">` +
                `<span class="hs-line-name"><span class="hs-chip-icon">${this.iconHtml(this.resourceIconKey(mat), 20, 'hs-pixel hs-pixel-20')}</span>` +
                `<strong>${mat.toUpperCase()}</strong>${tag}<small class="hs-muted">HAVE ${have}</small></span>` +
                `<span class="hs-trade-quote">BUY ${q.buy} · SELL ${q.sell} CR</span>` +
                `<span class="hs-trade-actions">` +
                    `<button type="button" class="action-button hs-line-action" data-ftrade-buy="${mat}" data-amount="10" data-nav-item>BUY 10</button>` +
                    `<button type="button" class="action-button secondary hs-line-action" data-ftrade-sell="${mat}" data-amount="10" data-nav-item${have < 10 ? ' disabled' : ''}>SELL 10</button>` +
                `</span>` +
                `</div>`;
        }).join('');
        return `<div class="hs-section hs-panel hs-faction-trade">` +
            `${this.panelTitle('hsShop', 'FACTION TRADE')}` +
            `<div class="hs-faction-picker">${picker}</div>` +
            `<p class="hs-muted hs-hint">${this.factionLabel(id)} sells ${terms.specialty.toUpperCase()} cheap and pays extra for ${terms.demand.toUpperCase()}. Better relations, better prices (${Math.round(terms.discount * 100)}%).</p>` +
            `<div class="hs-tab-fill">${rows}</div>` +
            `</div>`;
    },

    renderFactionContractsTab(profile) {
        const list = (typeof profileManager !== 'undefined' && profileManager.getFactionContracts)
            ? profileManager.getFactionContracts(profile) : [];
        const filter = this._factionContractFilter || 'all';
        const shown = list.filter((c) => filter === 'all' || c.kind === filter || c.factionId === filter);
        const esc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
        const active = profile.activeMission;
        const filters = [['all', 'ALL'], ['renegade', 'RENEGADES'], ['conquer', 'CONQUEST'], ['defend', 'DEFENSE'], ['bounty', 'BOUNTY HUNTS']]
            .concat(this._factionContractFaction ? [[this._factionContractFaction, this.factionLabel(this._factionContractFaction)]] : []);
        const filterHtml = filters.map(([fid, label]) =>
            `<button type="button" class="hs-shop-cat${filter === fid ? ' active' : ''}" data-fcontract-filter="${fid}" data-nav-item>${label}</button>`
        ).join('');
        const rows = shown.map((c) => {
            const busy = active && !c.active;
            const action = c.active
                ? `<button type="button" class="action-button hs-line-action" data-fcontract-launch data-nav-item>LAUNCH</button>` +
                  `<button type="button" class="action-button secondary hs-line-action" data-mission-abandon data-nav-item>ABANDON</button>`
                : `<button type="button" class="action-button hs-line-action" data-fcontract-accept="${esc(c.id)}" data-nav-item${busy ? ' disabled title="Finish or abandon your active mission first"' : ''}>` +
                  `${c.remote ? 'TELEPORT &amp; LAUNCH' : 'ACCEPT &amp; LAUNCH'}</button>`;
            const target = c.goal ? `<span class="hs-mission-goal">${esc(c.goal)}</span> · ` : '';
            return `<div class="hs-line hs-mission is-${c.kind}${c.active ? ' is-active' : ''}${c.remote ? ' is-remote' : ''}">` +
                `<span class="hs-line-name">` +
                `<span class="hs-mission-type">${c.type}</span>` +
                `<strong><span class="hs-contract-emblem">${this.factionEmblemHtml({ faction: c.factionId }, 16)}</span>${this.factionLabel(c.factionId)} · ${esc(c.planetName)}</strong>` +
                `<small class="hs-mission-meta">${target}${esc(c.galaxyName)}${c.remote ? ' (TELEPORT)' : ''} · ${c.difficulty} · +${c.rep} REP${c.active ? ' · ACTIVE' : ''}</small>` +
                `</span>` +
                `<span class="hs-mission-reward">${this.renderMissionReward ? this.renderMissionReward(c.reward) : ''}</span>` +
                `<span class="hs-mission-actions">${action}</span>` +
                `</div>`;
        }).join('');
        return `<div class="hs-section hs-panel hs-missions-root hs-faction-contracts">` +
            `${this.panelTitle('hsExplore', 'FACTION CONTRACTS')}` +
            `<div class="hs-row hs-fcontract-filters">${filterHtml}</div>` +
            `<p class="hs-muted hs-hint">Hunt renegades (marked with a red slash and beacon), seize planets from rivals, defend allied ground or wipe out gangs — in every galaxy you can already reach. Remote contracts teleport you there and pay 25% more. ` +
            `Paid when you clear a stage on the target planet.</p>` +
            `<div class="hs-tab-fill hs-mission-list">${rows || '<p class="hs-muted hs-empty-slot">NO CONTRACTS · improve relations or extend your warp range</p>'}</div>` +
            `</div>`;
    },

    bindFactionEvents() {
        const q = (sel, fn) => this.overlay.querySelectorAll(sel).forEach((btn) => btn.addEventListener('click', () => fn(btn)));
        q('[data-faction-open]', (btn) => {
            this._factionDetail = btn.getAttribute('data-faction-open');
            this.createUI();
        });
        q('[data-faction-fleet]', (btn) => {
            this._factionFleetShip = btn.getAttribute('data-faction-fleet');
            this.createUI();
        });
        const fleetCanvas = this.overlay.querySelector('[data-fleet-preview]');
        if (fleetCanvas) this.startFactionFleetPreview(fleetCanvas.getAttribute('data-faction'), fleetCanvas.getAttribute('data-ship'));
        else this.stopFactionFleetPreview();
        q('[data-faction-section]', (btn) => {
            this._factionSection = btn.getAttribute('data-faction-section');
            this.createUI();
        });
        q('[data-faction-goto]', (btn) => {
            const id = btn.getAttribute('data-faction-id');
            const tab = btn.getAttribute('data-faction-goto');
            if (tab === 'ftrade') this._factionTrade = id;
            if (tab === 'fcontracts') {
                this._factionContractFaction = id;
                this._factionContractFilter = id;
            }
            this.tab = tab;
            this.persistTab();
            this.createUI();
        });
        q('[data-faction-pact]', (btn) => {
            const id = btn.getAttribute('data-faction-pact');
            const active = factionManager.togglePact(id);
            this.statusMsg = active ? `PACT WITH ${id.toUpperCase()} SIGNED` : `PACT WITH ${id.toUpperCase()} ENDED`;
            this.createUI();
        });
        q('[data-faction-trade]', (btn) => {
            this._factionTrade = btn.getAttribute('data-faction-trade');
            this.createUI();
        });
        q('[data-ftrade-buy]', (btn) => {
            const mat = btn.getAttribute('data-ftrade-buy');
            const n = Number(btn.getAttribute('data-amount')) || 10;
            const cost = factionManager.getTradeQuote(this._factionTrade, mat).buy * n;
            if (!profileManager.spendCredits(cost, true)) {
                this.playButtonResult(btn, false, 'NOT ENOUGH CREDITS');
                return;
            }
            const p = profileManager.getActiveProfile();
            if (!p.resources) p.resources = {};
            p.resources[mat] = (Number(p.resources[mat]) || 0) + n;
            profileManager.save();
            this.statusMsg = `BOUGHT ${n} ${mat.toUpperCase()} FOR ${cost} CR`;
            this.createUI();
        });
        q('[data-ftrade-sell]', (btn) => {
            const mat = btn.getAttribute('data-ftrade-sell');
            const n = Number(btn.getAttribute('data-amount')) || 10;
            const p = profileManager.getActiveProfile();
            if (!p || (Number((p.resources || {})[mat]) || 0) < n) {
                this.playButtonResult(btn, false, 'NOT ENOUGH ' + mat.toUpperCase());
                return;
            }
            const pay = factionManager.getTradeQuote(this._factionTrade, mat).sell * n;
            p.resources[mat] -= n;
            profileManager.addCredits(pay, true);
            profileManager.save();
            this.statusMsg = `SOLD ${n} ${mat.toUpperCase()} FOR ${pay} CR`;
            this.createUI();
        });
        q('[data-fcontract-filter]', (btn) => {
            this._factionContractFilter = btn.getAttribute('data-fcontract-filter');
            this.createUI();
        });
        const launchActive = () => {
            const m = profileManager.getActiveProfile().activeMission;
            if (!m) return;
            const cfg = (typeof planetConfigManager !== 'undefined' && planetConfigManager.getConfig(m.planetId)) || {};
            this.startMission({ planetId: m.planetId, id: m.planetId, name: String(cfg.name || m.planetId).toUpperCase(), galaxyId: m.galaxyId });
        };
        q('[data-fcontract-accept]', (btn) => {
            const res = profileManager.acceptFactionContract(btn.getAttribute('data-fcontract-accept'));
            if (!res.ok) {
                this.playButtonResult(btn, false, res.reason || 'NOT AVAILABLE');
                if (res.travelled) this.createUI();
                return;
            }
            launchActive();
        });
        q('[data-fcontract-launch]', launchActive);
        q('[data-mission-abandon]', () => {
            profileManager.abandonMission();
            this.statusMsg = 'CONTRACT ABANDONED';
            this.createUI();
        });
    }
});
