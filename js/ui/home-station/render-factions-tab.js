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
        const pct = Math.round((rel.score + 100) / 2);
        return `<div class="hs-faction-meter" title="Relation ${rel.score}"><span style="width:${pct}%"></span></div>`;
    },

    renderFactionsTab(profile) {
        const fm = typeof factionManager !== 'undefined' ? factionManager : null;
        if (!fm || !fm.getRelation) return `<div class="hs-section">${this.panelTitle('menuPeoples', 'FACTIONS')}<p class="hs-muted">No faction data.</p></div>`;
        if (this._factionDetail && fm.factions[this._factionDetail]) {
            return this.renderFactionDetail(profile, this._factionDetail);
        }
        const owners = fm.state.controlledPlanets || {};
        const cards = fm.getFactionIds().map((id) => {
            const f = fm.getFaction(id);
            const rel = fm.getRelation(id);
            const planets = Object.keys(owners).filter((p) => owners[p] === id).length;
            return `<button type="button" class="hs-panel hs-faction-card is-${rel.tone}" data-faction-open="${id}" data-nav-item>` +
                `<div class="hs-faction-head">` +
                    `<span class="hs-faction-crest">${this.factionEmblemHtml({ faction: id }, 48)}</span>` +
                    `<span class="hs-faction-name">${this.factionLabel(id)}</span>` +
                    `<span class="hs-faction-status">${rel.label}</span>` +
                `</div>` +
                this.factionMeterHtml(rel) +
                `<div class="hs-faction-stats"><span>RELATION ${rel.score > 0 ? '+' : ''}${rel.score}</span><span>PLANETS ${planets}</span>` +
                `<span>${fm.isAllied(id) ? 'TRADES' : 'NO TRADE'}</span></div>` +
                (f.goal ? `<p class="hs-faction-goal">${f.goal}</p>` : '') +
                `</button>`;
        }).join('');
        return `<div class="hs-factions">` +
            `${this.panelTitle('menuPeoples', 'FACTION RELATIONS')}` +
            `<p class="hs-muted hs-hint">Click a faction for details. Contracts raise your reputation; from +${FACTION_TRADE_REP} or with a pact a faction trades with you.</p>` +
            `<div class="hs-faction-grid">${cards}</div>` +
            `</div>`;
    },

    renderFactionDetail(profile, id) {
        const fm = factionManager;
        const f = fm.getFaction(id);
        const rel = fm.getRelation(id);
        const owners = fm.state.controlledPlanets || {};
        const planets = Object.keys(owners).filter((p) => owners[p] === id).length;
        const galaxies = (typeof planetConfigManager !== 'undefined' && planetConfigManager.getGalaxyFactionIds)
            ? planetConfigManager.getGalaxyIds().filter((gid) => planetConfigManager.getGalaxyFactionIds(gid).indexOf(id) !== -1)
            : [];
        const galaxyNames = galaxies.map((gid) => {
            const g = planetConfigManager.getGalaxy(gid) || {};
            return `<span class="hs-chip">${String(g.name || gid).replace(/_/g, ' ').toUpperCase()}</span>`;
        }).join('') || '<span class="hs-muted">NONE KNOWN</span>';
        const contracts = (typeof profileManager !== 'undefined' && profileManager.getFactionContracts)
            ? profileManager.getFactionContracts(profile).filter((c) => c.factionId === id).length : 0;
        const canPact = fm.getAllegiance() && fm.getAllegiance() !== id;
        const terms = fm.getTradeTerms(id);
        const lore = f.loreLong || f.lore || '';
        return `<div class="hs-factions hs-faction-detail is-${rel.tone}">` +
            `<nav class="hs-faction-picker hs-faction-tabs" aria-label="Factions">` +
                `<button type="button" class="hs-tab hs-subnav-tab" data-faction-back data-nav-item title="All factions">` +
                    `<span class="hs-tab-icon">${this.tabIconHtml('menuPeoples')}</span><span class="hs-tab-label">ALL</span></button>` +
                fm.getFactionIds().map((fid) =>
                    `<button type="button" class="hs-tab hs-subnav-tab${fid === id ? ' active' : ''}" data-faction-open="${fid}" data-nav-item title="${this.factionLabel(fid)}">` +
                    `<span class="hs-tab-icon">${this.factionEmblemHtml({ faction: fid }, 32)}</span>` +
                    `<span class="hs-tab-label">${this.factionLabel(fid)}</span></button>`
                ).join('') +
            `</nav>` +
            `<div class="hs-panel hs-faction-detail-head">` +
                `<span class="hs-faction-crest hs-faction-crest-lg">${this.factionEmblemHtml({ faction: id }, 96)}</span>` +
                `<div class="hs-faction-detail-info">` +
                    `<div class="hs-faction-head"><span class="hs-faction-name">${this.factionLabel(id)}</span><span class="hs-faction-status">${rel.label}</span></div>` +
                    this.factionMeterHtml(rel) +
                    `<div class="hs-faction-stats"><span>RELATION ${rel.score > 0 ? '+' : ''}${rel.score}</span><span>PLANETS ${planets}</span><span>CONTRACTS ${contracts}</span></div>` +
                    (f.goal ? `<p class="hs-faction-goal">${f.goal}</p>` : '') +
                `</div>` +
            `</div>` +
            (lore ? `<div class="hs-panel"><p class="hs-faction-goal">${lore}</p></div>` : '') +
            `<div class="hs-panel">${this.panelTitle('hsStation', 'PRESENCE')}<div class="hs-row">${galaxyNames}</div></div>` +
            `<div class="hs-panel">${this.panelTitle('hsShop', 'TRADE TERMS')}` +
                `<p class="hs-faction-goal">SPECIALTY ${terms.specialty.toUpperCase()} (cheap) · DEMANDS ${terms.demand.toUpperCase()} (pays well) · DISCOUNT ${Math.round(terms.discount * 100)}%</p>` +
            `</div>` +
            `<div class="hs-faction-actions">` +
                (fm.isAllied(id) ? `<button type="button" class="action-button" data-faction-goto="ftrade" data-faction-id="${id}" data-nav-item>TRADE</button>` : '') +
                `<button type="button" class="action-button" data-faction-goto="fcontracts" data-faction-id="${id}" data-nav-item>CONTRACTS</button>` +
                (canPact ? `<button type="button" class="action-button secondary" data-faction-pact="${id}" data-nav-item>${fm.hasPact(id) ? 'END PACT' : 'PROPOSE PACT'}</button>` : '') +
            `</div>` +
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
        const filters = [['all', 'ALL'], ['job', 'FACTION JOBS'], ['bounty', 'BOUNTY HUNTS']]
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
            const target = c.kind === 'bounty' ? `HUNT ${esc(c.target)} · ` : '';
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
            `<p class="hs-muted hs-hint">Jobs and bounty hunts in every galaxy you can already reach. Remote contracts teleport you there and pay 25% more. ` +
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
        q('[data-faction-back]', () => {
            this._factionDetail = null;
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
