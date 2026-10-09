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

    /** Inline tokens that give a faction card its own faction colour (shape comes from CSS via data-faction). */
    factionCardStyle(id) {
        const st = typeof factionShipStyles !== 'undefined' && factionShipStyles.getFactionStyle ? factionShipStyles.getFactionStyle(id) : null;
        const c = st && st.accent;
        return c ? `--faction-accent:${c};--color-primary:${c};` : '';
    },

    /** Two opposing arrows; crossed out and dimmed when the faction does not trade. */
    factionTradeIconHtml(trades) {
        const arrows = '<polygon points="1,4 10,4 10,2 15,5 10,8 10,6 1,6"/><polygon points="15,10 6,10 6,8 1,11 6,14 6,12 15,12"/>';
        const label = trades ? 'TRADES' : 'NO TRADE';
        return `<span class="hs-faction-trade-ico ${trades ? 'is-open' : 'is-closed'}" title="${label}" aria-label="${label}">` +
            `<svg viewBox="0 0 16 16" width="22" height="22" shape-rendering="crispEdges" aria-hidden="true">` +
            `<g fill="currentColor">${arrows}</g>` +
            (trades ? '' : '<path d="M2 14L14 2" stroke="#05060a" stroke-width="4"/><path d="M2 14L14 2" stroke="#e04848" stroke-width="2"/>') +
            `</svg></span>`;
    },

    factionMeterHtml(rel) {
        // −100 … 0 (centre mark) … +100, value printed on the bar.
        const pct = Math.round((rel.score + 100) / 2);
        const val = (rel.score > 0 ? '+' : '') + rel.score;
        return `<div class="hs-faction-meter" title="Relation ${val} (−100 hostile · 0 neutral · +100 allied)">` +
            `<span class="hs-faction-meter-fill" style="width:${pct}%"></span>` +
            `<i class="hs-faction-meter-mid" aria-hidden="true"></i></div>`;
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
            return `<button type="button" class="hs-tab hs-subnav-tab hs-faction-card is-${rel.tone}${fid === id ? ' active' : ''}" data-faction-open="${fid}" data-faction="${fid}" style="${this.factionCardStyle(fid)}" data-nav-item title="${this.factionLabel(fid)}">` +
                `<div class="hs-faction-top">` +
                    `<span class="hs-faction-crest">${this.factionEmblemHtml({ faction: fid }, 64)}</span>` +
                    `<div class="hs-faction-main">` +
                        `<div class="hs-faction-head">` +
                            `<span class="hs-faction-name">${this.factionLabel(fid)}</span>` +
                            `<span class="hs-faction-score">${rel.score > 0 ? '+' : ''}${rel.score}</span>` +
                        `</div>` +
                        this.factionMeterHtml(rel) +
                    `</div>` +
                `</div>` +
                `<div class="hs-faction-stats"><span class="hs-faction-planets" title="Planets held">${this.iconHtml('menuPlanets', 22, 'hs-pixel', 'Planets')}${planets}</span>` +
                `<span class="hs-faction-status">${rel.label}</span>` +
                this.factionTradeIconHtml(fm.isAllied(fid)) + `</div>` +
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
        const sel = classes.indexOf(this._factionFleetShip) !== -1 || this._factionFleetShip === 'player' ? this._factionFleetShip : 'all';
        const zoom = Math.max(0.5, Math.min(2.5, Number(this._factionFleetZoom) || 1));
        const item = (cid, label, img) =>
            `<button type="button" class="hs-fd-fleet-item${sel === cid ? ' active' : ''}" data-faction-fleet="${cid}" data-nav-item>` +
            `<span class="hs-fd-fleet-thumb">${img}</span><span>${label}</span></button>`;
        const playerThumb = this.factionEmblemHtml({ faction: id }, 24);
        const list = item('all', 'ALL', '') + item('player', 'PLAYER', playerThumb) + classes.map((cls) => {
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
                    `<div class="hs-fd-fleet-stage" data-fleet-preview-viewport>` +
                        `<div class="hs-fd-fleet-toolbar">` +
                            `<button type="button" class="pe-btn pe-preview-btn" data-fleet-zoom="-0.25" title="Zoom out">−</button>` +
                            `<span class="hs-fd-fleet-zoom" data-fleet-zoom-label>${Math.round(zoom * 100)}%</span>` +
                            `<button type="button" class="pe-btn pe-preview-btn" data-fleet-zoom="0.25" title="Zoom in">+</button>` +
                            `<button type="button" class="pe-btn pe-preview-btn" data-fleet-zoom-reset title="Reset zoom">1:1</button>` +
                        `</div>` +
                        `<canvas data-fleet-preview data-faction="${id}" data-ship="${sel}" width="480" height="290" style="--fleet-zoom:${zoom}"></canvas>` +
                    `</div>` +
                `</div>` +
                `<div class="hs-fd-colors-wrap${this._factionColorsOpen ? ' is-open' : ''}">` +
                `<button type="button" class="pe-btn pe-preview-btn hs-fd-colors-toggle" data-faction-colors-toggle data-nav-item>COLORS ${this._factionColorsOpen ? '▼' : '▲'}</button>` +
                `<div class="hs-fd-colors">` +
                    `<div class="hs-fd-colors-head"><span>FACTION COLORS</span></div>` +
                    [['hull', 'HULL (BASE)'], ['edge', 'EDGE'], ['accent', 'ACCENT'], ['engine', 'ENGINE']].map(([k, label]) => {
                        const c = style[k];
                        if (!c) return '';
                        const dflt = fss.getDefaultFactionStyle(id)[k];
                        const ov = fss.getColorOverrides(id)[k] || {};
                        const [h0] = fss.hexToHsl(dflt);
                        const nearest = (steps, v) => steps.reduce((bi, x, i) => (Math.abs(x - v) < Math.abs(steps[bi] - v) ? i : bi), 0);
                        const sl = (part, min, max, val, title) =>
                            `<span class="hs-fd-slider-tag">${title}</span>` +
                            `<input type="range" class="hs-fd-adj hs-fd-adj-${part}" min="${min}" max="${max}" step="1" value="${val}" data-faction-adj="${part}" data-faction-key="${k}" data-faction-id="${id}" data-nav-item aria-label="${label} ${title}">`;
                        const satIdx = nearest(fss.satSteps, ov.s != null ? ov.s : 100);
                        const lightIdx = nearest(fss.lightSteps, ov.l != null ? ov.l : 0);
                        return `<div class="hs-fd-color-block" data-faction-color-block="${k}">` +
                            `<div class="hs-fd-color-row"><i class="hs-fd-color-chip" style="background:${c}"></i><span class="hs-fd-color-label">${label}</span><em>${String(c).toUpperCase()}</em></div>` +
                            `<div class="hs-fd-sliders">` +
                                sl('h', 0, 359, ov.h != null ? ov.h : Math.round(h0), 'HUE') +
                                sl('s', 0, 2, satIdx, 'SAT') +
                                sl('l', 0, 2, lightIdx, 'LIGHT') +
                                `<button type="button" class="pe-btn pe-preview-btn" ${Object.keys(ov).length ? '' : 'disabled'} data-faction-color-reset="${k}" data-faction-id="${id}" data-nav-item>RESET</button>` +
                            `</div></div>`;
                    }).join('') +
                    `<div class="hs-fd-colors-actions">` +
                        `<button type="button" class="pe-btn pe-preview-btn" ${fss.hasColorDraft(id) ? '' : 'disabled'} data-faction-colors-cancel="${id}" data-nav-item>CANCEL</button>` +
                        `<button type="button" class="pe-btn pe-preview-btn" ${fss.hasColorDraft(id) ? '' : 'disabled'} data-faction-colors-save="${id}" data-nav-item>SAVE</button>` +
                    `</div>` +
                `</div>` +
                `</div>` +
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
        q('[data-faction-colors-toggle]', () => {
            this._factionColorsOpen = !this._factionColorsOpen;
            const w = this.overlay.querySelector('.hs-fd-colors-wrap');
            if (w) w.classList.toggle('is-open', this._factionColorsOpen);
            const t = this.overlay.querySelector('[data-faction-colors-toggle]');
            if (t) t.textContent = 'COLORS ' + (this._factionColorsOpen ? '▼' : '▲');
        });
        q('[data-faction-color-reset]', (btn) => {
            factionShipStyles.clearColorDraft(btn.getAttribute('data-faction-id'), btn.getAttribute('data-faction-color-reset'));
            factionShipStyles.setColorOverride(btn.getAttribute('data-faction-id'), btn.getAttribute('data-faction-color-reset'), null, null);
            this.createUI();
        });
        // HUE is continuous; SAT and LIGHT are three steps (low / default / high).
        const stepValue = (part, v) => part === 's' ? factionShipStyles.satSteps[Number(v)]
            : part === 'l' ? factionShipStyles.lightSteps[Number(v)] : Number(v);
        this.overlay.querySelectorAll('[data-faction-adj]').forEach((inp) => {
            const fid = inp.getAttribute('data-faction-id'), key = inp.getAttribute('data-faction-key'), part = inp.getAttribute('data-faction-adj');
            // The open panel covers the preview: fade it while dragging so the live result shows.
            const wrap = inp.closest('.hs-fd-colors-wrap');
            const endDrag = () => {
                if (wrap) wrap.classList.remove('is-dragging');
                window.removeEventListener('pointerup', endDrag);
                window.removeEventListener('pointercancel', endDrag);
            };
            inp.addEventListener('pointerdown', () => {
                if (wrap) wrap.classList.add('is-dragging');
                window.addEventListener('pointerup', endDrag);
                window.addEventListener('pointercancel', endDrag);
            });
            // Live: recolour chip + hex while dragging; save and rebuild (preview, RESET) on release.
            inp.addEventListener('input', () => {
                const block = inp.closest('[data-faction-color-block]');
                const adj = {};
                block.querySelectorAll('[data-faction-adj]').forEach((r) => { adj[r.getAttribute('data-faction-adj')] = stepValue(r.getAttribute('data-faction-adj'), r.value); });
                const col = factionShipStyles.adjustColor(factionShipStyles.getDefaultFactionStyle(fid)[key], adj);
                block.querySelector('.hs-fd-color-chip').style.background = col;
                block.querySelector('em').textContent = col.toUpperCase();
                factionShipStyles.setColorDraft(fid, key, adj);
                this.overlay.querySelectorAll('[data-faction-colors-save], [data-faction-colors-cancel]').forEach((b) => { b.disabled = false; });
                const rst = block.querySelector('[data-faction-color-reset]');
                if (rst) rst.disabled = false;
                // Live preview: restart the fleet sim with the new colours (one per frame).
                if (this._factionColorRaf) return;
                this._factionColorRaf = requestAnimationFrame(() => {
                    this._factionColorRaf = null;
                    if (typeof graphicsManager !== 'undefined' && graphicsManager._voxelShipBake) graphicsManager._voxelShipBake = Object.create(null);
                    const cv = this.overlay && this.overlay.querySelector('[data-fleet-preview]');
                    if (cv) this.startFactionFleetPreview(cv.getAttribute('data-faction'), cv.getAttribute('data-ship'));
                });
            });
        });
        q('[data-faction-colors-cancel]', (btn) => {
            factionShipStyles.clearColorDraft(btn.getAttribute('data-faction-colors-cancel'));
            this.createUI();
        });
        q('[data-faction-colors-save]', (btn) => {
            factionShipStyles.commitColorDrafts(btn.getAttribute('data-faction-colors-save'));
            this.createUI();
        });
        q('[data-faction-fleet]', (btn) => {
            this._factionFleetShip = btn.getAttribute('data-faction-fleet');
            this.createUI();
        });
        const fleetCanvas = this.overlay.querySelector('[data-fleet-preview]');
        // Pan: drag the preview (useful when zoomed in on the player ship at the bottom).
        const setFleetPan = (x, y) => {
            this._factionFleetPan = { x: x, y: y };
            if (fleetCanvas) {
                fleetCanvas.style.setProperty('--fleet-px', x + 'px');
                fleetCanvas.style.setProperty('--fleet-py', y + 'px');
            }
        };
        const setFleetZoom = (value) => {
            this._factionFleetZoom = Math.max(0.5, Math.min(2.5, Math.round(value * 100) / 100));
            if (!fleetCanvas) return;
            fleetCanvas.style.setProperty('--fleet-zoom', this._factionFleetZoom);
            if (this._factionFleetZoom <= 1) setFleetPan(0, 0);
            const label = this.overlay.querySelector('[data-fleet-zoom-label]');
            if (label) label.textContent = `${Math.round(this._factionFleetZoom * 100)}%`;
        };
        q('[data-fleet-zoom]', (btn) => setFleetZoom((Number(this._factionFleetZoom) || 1) + Number(btn.getAttribute('data-fleet-zoom'))));
        q('[data-fleet-zoom-reset]', () => { setFleetZoom(1); setFleetPan(0, 0); });
        const fleetViewport = this.overlay.querySelector('[data-fleet-preview-viewport]');
        if (fleetViewport && fleetCanvas) {
            const pan0 = this._factionFleetPan || { x: 0, y: 0 };
            setFleetPan(pan0.x, pan0.y);
            fleetViewport.addEventListener('pointerdown', (e) => {
                if (e.target.closest && e.target.closest('.hs-fd-fleet-toolbar')) return;
                const z = Number(this._factionFleetZoom) || 1;
                const start = { x: e.clientX, y: e.clientY, p: Object.assign({}, this._factionFleetPan || { x: 0, y: 0 }) };
                const lim = (n, span) => Math.max(-span * (z - 0.0) , Math.min(span * (z - 0.0), n));
                fleetViewport.setPointerCapture && fleetViewport.setPointerCapture(e.pointerId);
                fleetViewport.classList.add('is-panning');
                const move = (ev) => {
                    const r = fleetViewport.getBoundingClientRect();
                    setFleetPan(Math.round(lim(start.p.x + ev.clientX - start.x, r.width * 0.6)), Math.round(lim(start.p.y + ev.clientY - start.y, r.height * 0.6)));
                };
                const up = () => {
                    fleetViewport.classList.remove('is-panning');
                    fleetViewport.removeEventListener('pointermove', move);
                    fleetViewport.removeEventListener('pointerup', up);
                    fleetViewport.removeEventListener('pointercancel', up);
                };
                fleetViewport.addEventListener('pointermove', move);
                fleetViewport.addEventListener('pointerup', up);
                fleetViewport.addEventListener('pointercancel', up);
            });
        }
        if (fleetViewport) {
            fleetViewport.addEventListener('wheel', (e) => {
                e.preventDefault();
                setFleetZoom((Number(this._factionFleetZoom) || 1) + (e.deltaY < 0 ? 0.1 : -0.1));
            }, { passive: false });
        }
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
