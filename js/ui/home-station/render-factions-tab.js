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
    /** Relation as a pixel plus / minus (or a dash at 0) instead of a number. */
    factionScoreIconHtml(score) {
        const kind = score > 0 ? 'pos' : score < 0 ? 'neg' : 'zero';
        const shape = kind === 'pos' ? '<path d="M6 2h4v4h4v4h-4v4H6v-4H2V6h4z"/>' : '<path d="M2 6h12v4H2z"/>';
        const val = (score > 0 ? '+' : '') + score;
        return `<span class="hs-faction-score is-${kind}" title="Relation ${val}" aria-label="Relation ${val}">` +
            `<svg viewBox="0 0 16 16" width="24" height="24" shape-rendering="crispEdges" aria-hidden="true">` +
            `<g fill="#05060a" stroke="#05060a" stroke-width="2">${shape}</g><g fill="currentColor">${shape}</g></svg></span>`;
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
        const tabs = ids.map((fid) => {
            const rel = fm.getRelation(fid);
            return `<button type="button" class="hs-tab hs-subnav-tab hs-faction-card is-${rel.tone}${fid === id ? ' active' : ''}" data-faction-open="${fid}" data-faction="${fid}" style="${this.factionCardStyle(fid)}" data-nav-item>` +
                `<div class="hs-faction-top">` +
                    `<span class="hs-faction-crest" title="${this.factionLabel(fid)}">${this.factionEmblemHtml({ faction: fid }, 64)}</span>` +
                    `<div class="hs-faction-main">` +
                        `<div class="hs-faction-head">` +
                            `${this.factionScoreIconHtml(rel.score)}` +
                        `</div>` +
                        this.factionMeterHtml(rel) +
                    `</div>` +
                `</div>` +
                `</button>`;
        }).join('');
        return `<div class="hs-factions hs-faction-detail is-${fm.getRelation(id).tone}">` +
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
    /** Contract rewards as icons only: the icon grows with the amount; weapon parts are always large. */
    renderContractRewards(reward) {
        const ir = typeof iconRenderer !== 'undefined' ? iconRenderer : null;
        const esc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
        const tier = (id, n) => {
            const t = id === 'credits' ? [80, 120] : [7, 11];
            return n < t[0] ? 28 : n < t[1] ? 36 : 44;
        };
        return `<span class="hs-contract-rewards">` + Object.keys(reward || {}).map((id) => {
            const n = Number(reward[id]) || 0;
            if (id.indexOf('part:weapon:') === 0) {
                const wid = id.slice(12);
                const w = typeof weaponConfigManager !== 'undefined' && weaponConfigManager.getWeapon ? weaponConfigManager.getWeapon(wid) : null;
                const img = ir && ir.weaponImgHtml ? ir.weaponImgHtml(wid, 48, '', false) : this.iconHtml('statWeapon', 48, 'hs-pixel', false);
                return `<span class="hs-cr hs-cr-part" title="Weapon part: ${esc(String((w && w.name) || wid).toUpperCase())}">${img}</span>`;
            }
            const size = tier(id, n);
            return `<span class="hs-cr hs-res-${id}" title="+${n} ${String(id).toUpperCase()}">${this.iconHtml(this.resourceIconKey(id), size, 'hs-pixel', false)}</span>`;
        }).join('') + `</span>`;
    },
    /** Ship sprite from its pixel grid, each cell drawn as an exact block (crisp when shown large). */
    factionShipSrcHd(fid, cls, cell) {
        const fss = typeof factionShipStyles !== 'undefined' ? factionShipStyles : null;
        if (!fss || !fss.getPixelSprite) return this.factionShipSrc(fid, cls);
        const key = 'hd|' + fid + '|' + cls + '|' + cell;
        const cache = this._factionShipSrc || (this._factionShipSrc = {});
        if (cache[key]) return cache[key];
        const grid = fss.getPixelSprite(fid, cls);
        const colors = fss.buildFactionColors(fid);
        if (!grid || !grid.length) return this.factionShipSrc(fid, cls);
        // Crop to the visible cells so the ship centres on its real shape, not on the sprite's empty margin.
        let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
        grid.forEach((row, y) => row.forEach((v, x) => {
            if (!v || !colors[v] || colors[v] === 'transparent') return;
            x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
        }));
        if (x1 < 0) return this.factionShipSrc(fid, cls);
        const c = document.createElement('canvas');
        c.width = (x1 - x0 + 1) * cell;
        c.height = (y1 - y0 + 1) * cell;
        const ctx = c.getContext('2d');
        grid.forEach((row, y) => row.forEach((v, x) => {
            if (!v || !colors[v] || colors[v] === 'transparent') return;
            ctx.fillStyle = colors[v];
            ctx.fillRect((x - x0) * cell, (y - y0) * cell, cell, cell);
        }));
        return (cache[key] = c.toDataURL());
    },
    factionSectionTabsHtml(sections, active, links, fid) {
        const tabIcons = { overview: 'navInfo', domain: 'navMap', details: 'navList', hero: 'navUser', archive: 'navBook' };
        const ico = (sid) => `<span class="hs-tab-icon">${this.tabIconHtml(tabIcons[sid] || 'navStar')}</span>`;
        return `<nav class="hs-fd-tabs" role="tablist" aria-label="Faction sections">` +
            sections.map(([sid, label]) =>
                `<button type="button" class="hs-tab hs-subnav-tab${sid === active ? ' active' : ''}" data-faction-section="${sid}" data-nav-item>` +
                `${ico(sid)}<span class="hs-tab-label">${label}</span></button>`).join('') +
            (links || []).map(([goto, label, icon]) =>
                `<button type="button" class="hs-tab hs-subnav-tab" data-faction-goto="${goto}" data-faction-id="${fid}" data-nav-item>` +
                `<span class="hs-tab-icon">${this.tabIconHtml(icon)}</span><span class="hs-tab-label">${label}</span></button>`).join('') +
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
        const ir = typeof iconRenderer !== 'undefined' ? iconRenderer : null;
        const accent = style.accent || style.hull || '#7ec8ff';
        const iconHtml = (key) => (ir && ir.imgHtml ? ir.imgHtml(key, 24, '', accent, false) : '');
        const styleKey = { terran: 'statShield', kronax: 'statDamage', voidborn: 'statSpeed', pirate: 'resScrap', machine: 'statEnergy' }[id] || 'statWeapon';
        // One fitting icon per faction trait (nav icon set, tinted in the faction accent).
        const traitIcons = {
            'ration law': 'navScroll', 'quota fleets': 'navChart', 'order by lottery': 'navStar',
            'blood rank': 'navTrophy', 'culling hunts': 'navCrosshair', 'scars as law': 'navSword',
            'erased names': 'navQuestion', 'fold-hunger': 'navAtom', 'cold rings': 'navPlanet',
            'debt slavery': 'navCoin', 'mutiny law': 'navFlag', 'wreck-cannibals': 'navSkull',
            'forced assimilation': 'navGear', 'surplus culling': 'navFactory', 'zero dissent': 'navLock'
        };
        const traitIcon = (t) => iconHtml(traitIcons[String(t).toLowerCase()] || 'navStar');
        const traitInfo = {
            'ration law': 'Supplies are rationed by decree.', 'quota fleets': 'Ships are built to fixed output targets.', 'order by lottery': 'Rank and duty are drawn by chance.',
            'blood rank': 'Status is earned in battle.', 'culling hunts': 'The weak are hunted out of the ranks.', 'scars as law': 'Wounds are proof of authority.',
            'erased names': 'Members give up their identity.', 'fold-hunger': 'Driven to consume space itself.', 'cold rings': 'Silent orbital strongholds.',
            'debt slavery': 'Crews are bound by what they owe.', 'mutiny law': 'Captains hold command only while they win.', 'wreck-cannibals': 'Stripping fallen ships for parts.',
            'forced assimilation': 'Conquered units are rewritten.', 'surplus culling': 'Excess units are scrapped.', 'zero dissent': 'No deviation is tolerated.'
        };
        const traitMore = {"ration law": ["Every colony of the Concord lives on a ledger: food, air and ammunition are issued by decree, never bought.", "Their fleets never overstock — ships carry exactly what the quota allows, and look the same lane after lane.", "Expect disciplined, steady fire rather than surprises; cutting their lanes hurts them more than killing hulls."], "quota fleets": ["Shipyards are given output targets, not designs. Whatever meets the number gets launched.", "Waves arrive in identical, regular formations with sturdy but unremarkable hulls.", "Learn one formation and you have learned them all — but there are always more behind it."], "order by lottery": ["Rank and duty are drawn by lot, so no officer is truly irreplaceable.", "Commanders change often; the doctrine does not. Nobody improvises, nobody hesitates.", "Their balanced, forgiving style is the baseline other peoples are measured against."], "blood rank": ["Kronax status is earned in the hunt; each kill, each scar moves a pilot up the pack.", "Pilots dive for the toughest target in range to climb the ranks.", "Fast, aggressive close-range strikes — stay mobile and punish them when the burst is spent."], "culling hunts": ["Young or weak pilots are driven out on the hunt-line to teach the rest to run faster.", "Packs thin their own stragglers, so what reaches you is the survivors.", "High burst damage with little staying power: break the first charge and the pack falters."], "scars as law": ["A wound unhealed is a rank held; closing it would be an admission of weakness.", "Heavily scarred hulls lead the formation and fly with no regard for their own armour.", "Their ambush runs are built around twin claw lances that shred up close."], "erased names": ["Those the Voidborn touch lose their names and records — the colony registers simply shrink.", "Their ships carry no markings and no known pilots to hail or bargain with.", "Odd firing angles and evasive movement: they strike from where you are not looking."], "fold-hunger": ["Voidborn hulls are grown from folded space and hunger for more of it.", "They appear and re-appear around rings of pale light instead of flying straight lines.", "A wavering arc curls around cover — keep moving instead of hiding."], "cold rings": ["Silent orbital rings hold their strongholds; sensors dim as one approaches.", "Their domains are quiet, empty-looking and dangerous.", "Planets held by them tend to stay held — they subtract rather than conquer."], "debt slavery": ["Crews are born into debts they can never repay and are sold against them at the Chain Market.", "Pirate hulls are crewed by people with nothing to lose and a ledger to settle.", "Chaotic, wide-coverage fire — numbers and desperation over precision, and good salvage when they fall."], "mutiny law": ["A captain lasts until the next mutiny; her hull then joins the dock, her officers the auction.", "Pirate fleets are coalitions of convenience held together by the loot code.", "Without a strong leader the formation breaks apart — fear of being left behind is the only glue."], "wreck-cannibals": ["Pirates strip fallen ships for hull-plate, guns and crew.", "Wrecks are valuable: they come back as the next ship.", "Salvage-minded and opportunistic: they hit whatever is in reach, every time."], "forced assimilation": ["The Machine forge rewrites conquered units to serve its own purpose.", "Captured designs appear in its lines, repainted in a lattice of nodes and struts.", "Efficient, sustained pressure: a constant stream of guided missile salvos."], "surplus culling": ["Excess or damaged units are scrapped on the spot to keep the forge efficient.", "Nothing idles, nothing is saved — hulls are spent as resources.", "A grinding pace: they do not retreat to repair, they replace."], "zero dissent": ["No deviation from the forge's calculation is tolerated; every unit answers one command.", "They fly in precise lattices without panic or improvisation.", "Predictable but relentless — the forge calculates, the warheads never argue."]};
        const ea = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
        // Row / block-title helpers: every label gets an icon in the faction accent (nav icon set).
        const row = (label, value, key) => `<div class="hs-fd-row"><span class="hs-fd-row-label">${key ? `<i class="hs-fd-row-ico">${iconHtml(key)}</i>` : ''}${label}</span><b>${value}</b></div>`;
        const title = (key, text) => `<h4><i class="hs-fd-row-ico">${iconHtml(key)}</i>${text}</h4>`;
        const resVal = (rid) => `<span class="hs-fd-resval">${this.iconHtml(this.resourceIconKey(rid), 24, 'hs-pixel', false)}${up(rid)}</span>`;
        const weaponChip = (w) => `<span class="hs-chip hs-fd-weapon">${ir && ir.weaponImgHtml ? ir.weaponImgHtml(w, 24, '', false) : ''}${up(w)}</span>`;
        // One-word behaviour term for the header: the noun before the colon of the playstyle line ("Opportunist: …").
        const behavior = String(f.playstyle || '').split(':')[0].trim().split(/\s+/).pop().toUpperCase();
        const hero = f.hero || null;
        const sections = [['overview', 'OVERVIEW'], ['domain', 'DOMAIN']];
        if (hero) sections.push(['hero', 'HERO']);
        if (f.loreLong || f.lore) sections.push(['archive', 'ARCHIVE']);
        const section = sections.some((x) => x[0] === this._factionSection) ? this._factionSection : 'overview';
        const bodies = {
            overview: () => `<div class="hs-fd-cols">` +
                `<section class="hs-panel hs-fd-block">${title('navUsers', 'STANDING')}` +
                    row('RELATION', `${rel.score > 0 ? '+' : ''}${rel.score} · ${rel.label}`, 'navHeart') +
                    row('TRADE', fm.isAllied(id) ? 'OPEN' : `LOCKED · +${FACTION_TRADE_REP} NEEDED`, 'navCart') +
                    row('PACT', fm.hasPact(id) ? 'ACTIVE' : 'NONE', 'navKey') +
                    row('CONTRACTS', contracts, 'navScroll') +
                    row('PLANETS HELD', planets, 'navPlanet') +
                `</section>` +
                `<section class="hs-panel hs-fd-block">${title('navCart', 'TRADE TERMS')}` +
                    row('SPECIALTY', `${resVal(terms.specialty)} · CHEAP`, 'navStar') +
                    row('DEMANDS', `${resVal(terms.demand)} · PAYS WELL`, 'navChart') +
                    row('DISCOUNT', `${Math.round(terms.discount * 100)}%`, 'navCoin') +
                `</section>` +
                `</div>`,
            domain: () => `<div class="hs-fd-cols">` +
                `<section class="hs-panel hs-fd-block">${title('navMap', 'TERRITORY')}` +
                    (f.homeGalaxy ? row('HOME', galaxyName(f.homeGalaxy), 'navHome') : '') +
                    `<div class="hs-fd-chips">${galaxyChips}</div>` +
                `</section>` +
                `<section class="hs-panel hs-fd-block">${title('navCrosshair', 'WEAPONS')}` +
                    (weapons.length ? `<div class="hs-fd-chips">${weapons.map(weaponChip).join('')}</div>` : '') +
                    `<p class="hs-fd-text">+20% damage with these weapons.${f.weaponNote ? ' ' + f.weaponNote : ''}</p>` +
                `</section>` +
                `</div>`,
            hero: () => (hero ? `<section class="hs-panel hs-fd-block hs-fd-herobox">` +
                (typeof heroPortrait !== 'undefined'
                    ? `<div class="hs-fd-heroportrait">${heroPortrait.html(heroPortrait.heroLook(id), fss && fss.getFactionStyle ? (fss.getFactionStyle(id) || {}).accent : null)}</div>` : '') +
                `<div class="hs-fd-herotext"><h4><span>HERO</span><b>${up(hero.name)}</b></h4>` +
                (hero.title ? `<p class="hs-fd-goal">${hero.title}</p>` : '') +
                (hero.lore ? `<p class="hs-fd-text">${hero.lore}</p>` : '') +
            `</div></section>` : ''),
            archive: () => {
                const lore = f.loreLong || f.lore;
                if (!lore) return '';
                // Illustration plate: the people's emblem over its home galaxy, with its whole fleet lined up.
                const classes = fss ? fss.classes : [];
                const ships = classes.map((cls) => {
                    const src = this.factionShipSrcHd ? this.factionShipSrcHd(id, cls, 4) : this.factionShipSrc(id, cls);
                    return src ? `<figure class="hs-arc-ship"><img src="${src}" alt=""><figcaption>${up(cls)}</figcaption></figure>` : '';
                }).join('');
                const plate = `<figure class="hs-arc-plate">` +
                    `<span class="hs-arc-emblem">${this.factionEmblemHtml({ faction: id }, 96)}</span>` +
                    `<div class="hs-arc-fleet">${ships}</div>` +
                    `<figcaption>${this.factionLabel(id)} · FLEET RECORD${f.homeGalaxy ? ' · ' + galaxyName(f.homeGalaxy) : ''}</figcaption>` +
                `</figure>`;
                const traits = (f.traits || []).map((t) => `<div class="hs-arc-entry"><span class="hs-arc-ico">${traitIcon(t)}</span>` +
                    `<div><b>${up(t)}</b><p class="hs-fd-text">${traitInfo[String(t).toLowerCase()] || ''}</p></div></div>`).join('');
                return `<section class="hs-panel hs-fd-block hs-arc"><div class="hs-arc-scroll">${title('navBook', 'ARCHIVE')}` +
                    `<div class="hs-arc-top">${plate}<div class="hs-arc-text"><p class="hs-fd-text">${lore}</p>` +
                        (f.goal ? `<p class="hs-arc-note"><b>GOAL</b> ${f.goal}</p>` : '') + `</div></div>` +
                    (traits ? `<div class="hs-arc-sub">KNOWN CUSTOMS</div><div class="hs-arc-grid">${traits}</div>` : '') +
                    ((f.playstyle || hero) ? `<div class="hs-arc-grid hs-arc-facts">` +
                        (f.playstyle ? `<div><div class="hs-arc-sub">IN BATTLE</div><p class="hs-fd-text">${f.playstyle}</p></div>` : '') +
                        (hero ? `<div><div class="hs-arc-sub">NOTORIOUS</div><p class="hs-fd-text"><b>${up(hero.name)}</b>${hero.title ? ' — ' + hero.title : ''}</p></div>` : '') +
                    `</div>` : '') +
                `</div></section>`;
            }
        };
        return `<div class="hs-fd" data-faction="${id}" style="${this.factionCardStyle(id)}">` +
                    `<aside class="hs-panel hs-fd-idbox">` +
                    `<span class="hs-faction-crest hs-faction-crest-lg hs-fd-crest">${this.factionEmblemHtml({ faction: id }, 96)}</span>` +
                    `<div class="hs-fd-col hs-fd-col-id" data-im-faction="${id}" data-im-key="emblem" data-im-name="${ea(this.factionLabel(id))}" data-im-info="${ea([rel.label, f.goal].filter(Boolean).join(' · '))}">` +
                        `<div class="hs-faction-head"><span class="hs-faction-name">${this.factionLabel(id)}</span><span class="hs-faction-status">${rel.label}</span></div>` +
                        (f.goal ? `<p class="hs-fd-goal">${f.goal}</p>` : '') +
                    `</div>` +
                                        (f.playstyle ? `<div class="hs-fd-col hs-fd-col-style" data-im-faction="${id}" data-im-key="${styleKey}" data-im-name="${ea(behavior)}" data-im-info="${ea(f.playstyle)}"><span class="hs-fd-col-ico">${iconHtml(styleKey)}</span>` +
                        `<div class="hs-fd-col-body"><span class="hs-fd-col-label">${ea(behavior)}</span><p class="hs-fd-text">${f.playstyle}</p></div></div>` : '') +
                    ((f.traits || []).length ? `<div class="hs-fd-col hs-fd-col-traits">` +
                        `<div class="hs-fd-traits">${f.traits.map((t) => `<span class="hs-fd-trait" data-trait-name="${up(t)}" data-trait-key="${traitIcons[String(t).toLowerCase()] || 'navStar'}" data-trait-faction="${id}" data-trait-info="${traitInfo[String(t).toLowerCase()] || ''}" data-trait-more="${ea((traitMore[String(t).toLowerCase()] || []).join('|'))}"><span class="hs-fd-trait-ico">${traitIcon(t)}</span><span class="hs-fd-trait-txt"><b>${up(t)}</b><em>${traitInfo[String(t).toLowerCase()] || ''}</em></span></span>`).join('')}</div></div>` : '') +
                    `</aside>` +
            `<div class="hs-fd-main">` +
            this.factionSectionTabsHtml(sections, section, [], id) +
            `<div class="hs-fd-section" role="tabpanel">${bodies[section]()}</div>` +
            `<div class="hs-faction-actions">` +
                (canPact ? `<button type="button" class="action-button secondary" data-faction-pact="${id}" data-nav-item>${fm.hasPact(id) ? 'END PACT' : 'PROPOSE PACT'}</button>` : '') +
            `</div>` +
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
            `<button type="button" class="hs-tab hs-subnav-tab${fid === id ? ' active' : ''}" data-faction-open="${fid}" data-nav-item>` +
            `<span class="hs-tab-icon" title="${this.factionLabel(fid)}">${this.factionEmblemHtml({ faction: fid }, 32)}</span></button>`).join('');
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
            `<button type="button" class="hs-tab hs-subnav-tab${fid === id ? ' active' : ''}" data-faction-trade="${fid}" data-nav-item>` +
            `<span class="hs-tab-icon" title="${this.factionLabel(fid)}">${this.factionEmblemHtml({ faction: fid }, 32)}</span></button>`
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
});
