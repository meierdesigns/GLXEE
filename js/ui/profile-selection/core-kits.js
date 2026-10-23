"use strict";

// ProfileSelectionManager members, continued from core.js: starter kits and loadout.
extendClass(ProfileSelectionManager, {
    /** Starter kits per faction (lore flavoured): id, label, blurb, icon key, hull, bonus {credits, res, slot}. */
    kitDefs() {
        // Each hull role also hands out its own free hull-area level, so the four profiles differ in the ship they build.
        const roleAreas = { player_scrap: { back: 1 }, player_interceptor: { wing: 1 }, player_heavy: { center: 1 }, player_assault: { front: 1 } };
        // Hull areas a start profile's ship is built without (nose = front, aft = back, wings = wing).
        const roleOff = { player_scrap: ['wing'], player_interceptor: ['back'], player_heavy: ['front'], player_assault: [] };
        // Hulls built without a nose carry their gun in the core: a pair left / right of the axis ('split') or one on the axis ('single').
        const roleCore = { player_heavy: 'split' };
        const K = (id, label, text, icon, ship, bonus) => ({ id, label, text, icon, ship, off: roleOff[ship] || [], coreGun: roleCore[ship] || null, bonus: Object.assign({ areas: roleAreas[ship] || {} }, bonus || {}) });
        // Faction doctrine, added on top of every profile of the faction: cargo shape, an extra hull area level and a stash.
        const DOCTRINE = {
            terran: { credits: 60, second: { player_assault: 'railgun', player_interceptor: 'laser_twin' } },                                                               // fleet command: money, balanced hold
            kronax: { invCols: -1, invGrowth: -0.15, areas: { center: 1 }, second: { player_assault: 'plasma', player_interceptor: 'spike_burst' } },                       // brutes: armoured core, cramped hold
            voidborn: { res: { crystal: 12 }, areas: { wing: 1 }, second: { player_assault: 'ion', player_interceptor: 'pierce' } },                              // wanderers: wing level, crystal shards
            pirate: { invCols: 2, invGrowth: 0.25, res: { scrap: 20 }, second: { player_assault: 'burst', player_interceptor: 'rapid' } },                           // smugglers: wide hold that fills fast
            machine: { invCols: -1, invRows: 1, invGrowth: 0.25, res: { ore: 20 }, areas: { front: 1 }, second: { player_assault: 'pierce' } }   // drones: tall modular hold, nose module
        };
        const defs = {
            terran: [
                K('standard_issue', 'STANDARD ISSUE', 'Alliance-issue fighter and a small stipend', 'kitStandardIssue', 'player_scrap', { credits: 100 }),
                K('fleet_charter', 'FLEET CHARTER', 'A navy commission: fast patrol interceptor', 'kitFleetCharter', 'player_interceptor', { credits: 200 }),
                K('engineer_corps', 'ENGINEER CORPS', 'Dockyard supplies and a sturdy hull', 'kitEngineerCorps', 'player_heavy', { res: { scrap: 80, ore: 40 } }),
                K('test_pilot', 'TEST PILOT', 'Prototype assault frame with a spare gun mount', 'kitTestPilot', 'player_assault', { slot: 1 })
            ],
            kronax: [
                K('clan_blood', 'CLAN BLOOD', 'Your clan\'s first hull and a pouch of ore', 'kitClanBlood', 'player_scrap', { res: { ore: 60 } }),
                K('warlord_tithe', 'WARLORD\'S TITHE', 'Tribute from conquered mines on a heavy ship', 'kitWarlordTithe', 'player_heavy', { res: { ore: 120, crystal: 20 } }),
                K('raider_pack', 'RAIDER PACK', 'Loot from early raids and a swift hunter', 'kitRaiderPack', 'player_interceptor', { credits: 150 }),
                K('duelist', 'DUELIST', 'Born to fight: assault ship with an extra gun', 'kitDuelist', 'player_assault', { slot: 1 })
            ],
            voidborn: [
                K('void_drifter', 'VOID DRIFTER', 'Wanderer of the dark with a sliver of crystal', 'kitVoidDrifter', 'player_scrap', { res: { crystal: 15 } }),
                K('rift_seeker', 'RIFT SEEKER', 'Rift-tuned interceptor and crystal shards', 'kitRiftSeeker', 'player_interceptor', { res: { crystal: 40 } }),
                K('echo_deep', 'ECHO OF THE DEEP', 'Salvage from a drowned fleet on a heavy hull', 'kitEchoDeep', 'player_heavy', { res: { crystal: 25, ore: 20 } }),
                K('ascendant', 'ASCENDANT', 'The void answers: assault ship, extra weapon slot', 'kitAscendant', 'player_assault', { slot: 1 })
            ],
            pirate: [
                K('scavenger', 'SCAVENGER', 'Patched-up wreck and a heap of scrap', 'kitScavenger', 'player_scrap', { res: { scrap: 120 } }),
                K('smuggler', 'SMUGGLER', 'Fast ship and a stash of dirty credits', 'kitSmuggler', 'player_interceptor', { credits: 250 }),
                K('brigand', 'BRIGAND', 'Stolen assault frame with an extra gun mount', 'kitBrigand', 'player_assault', { slot: 1 }),
                K('hauler_thief', 'HAULER THIEF', 'Hijacked freighter hull with loaded holds', 'kitHaulerThief', 'player_heavy', { res: { scrap: 80, ore: 60 }, invRows: 1, invGrowth: 0.25 })
            ],
            machine: [
                K('boot_sequence', 'BOOT SEQUENCE', 'Freshly compiled unit with spare parts', 'kitBootSequence', 'player_scrap', { res: { scrap: 60 } }),
                K('harvester', 'HARVESTER UNIT', 'Resource drone chassis, holds full of ore', 'kitHarvester', 'player_heavy', { res: { ore: 100, scrap: 40 }, invRows: 1, invGrowth: 0.25 }),
                K('scout_unit', 'SCOUT UNIT', 'Fast recon frame with a credit cache', 'kitScoutUnit', 'player_interceptor', { credits: 150 }),
                K('combat_protocol', 'COMBAT PROTOCOL', 'War routine loaded: assault frame, +1 weapon slot', 'kitCombatProtocol', 'player_assault', { slot: 1 })
            ]
        };
        Object.keys(defs).forEach((f) => {
            const d = DOCTRINE[f] || {};
            defs[f].forEach((kit) => {
                const b = kit.bonus;
                // Some hulls also start with a second weapon type, owned in the inventory.
                if (d.second && d.second[kit.ship] && this.startPartFits('weapon', d.second[kit.ship])) b.weapon2 = d.second[kit.ship];
                ['credits', 'invRows', 'invCols', 'invGrowth'].forEach((n) => { if (d[n]) b[n] = (Number(b[n]) || 0) + d[n]; });
                if (d.res) { b.res = Object.assign({}, b.res); Object.keys(d.res).forEach((r) => { b.res[r] = (b.res[r] || 0) + d.res[r]; }); }
                if (d.areas) { b.areas = Object.assign({}, b.areas); Object.keys(d.areas).forEach((a) => { const t = (kit.off || []).indexOf(a) < 0 ? a : 'center'; b.areas[t] = (b.areas[t] || 0) + d.areas[a]; }); }   // a hull without that area levels its core instead
            });
        });
        return defs;
    },
    /** Does a start part fit a fresh hull's slots? Every start slot is at most M (slot-sizes.js), so L parts never do. */
    startPartFits(kind, id) {
        const slm = typeof shipLoadoutManager !== 'undefined' ? shipLoadoutManager : null;
        return !id || !slm || !slm.getPartSizeLevel || slm.getPartSizeLevel(kind, id) <= 1;
    },
    /** Wing slot rows of the start ship: the kit's wing level (a pair per row), its bought slots, and room for the second weapon. */
    startWingRows(kit) {
        const k = kit || this.currentKit();
        if ((k.off || []).indexOf('wing') >= 0) return 0;
        const slm = typeof shipLoadoutManager !== 'undefined' ? shipLoadoutManager : null;
        const b = k.bonus || {};
        const lv = Math.min(2, Number((b.areas || {}).wing) || 0);
        const pairs = slm && slm.getAreaSlotBonus ? Math.ceil(slm.getAreaSlotBonus('wing', lv).filter((x) => x === 'weapons').length / 2) : 0;
        return Math.max(pairs + (Number(b.slot) || 0), b.weapon2 ? 1 : 0);
    },
    /** Weapon slots of the start ship in slot order (nose / core gun, then the wing rows): part id or null when empty. */
    startWeaponSlots(gun) {
        const k = this.currentKit();
        const out = [gun, (k.bonus || {}).weapon2 || null];
        out.length = 1 + this.startWingRows(k);
        return Array.from(out, (x) => x || null);
    },
    /** Once per page load, at idle: build every faction's kit icons and ship sprites so the first faction switch has nothing left to generate (no frame drops). */
    warmFactionAssets() {
        if (this._warmed || this.mode !== 'create') return;
        this._warmed = true;
        const ids = this.getFactionIds();
        const defs = this.kitDefs();
        const idle = window.requestIdleCallback || ((f) => setTimeout(f, 60));
        let i = 0;
        const step = () => {
            if (i >= ids.length) return;
            const id = ids[i++];
            try {
                const ir = typeof iconRenderer !== 'undefined' && iconRenderer.imgHtml ? iconRenderer : null;
                const rk = (k) => (typeof homeStationUI !== 'undefined' && homeStationUI.resourceIconKey ? homeStationUI.resourceIconKey(k) : null);
                (defs[id] || []).forEach((k) => {
                    const key = ['credits', 'scrap', 'ore', 'crystal'].indexOf(k.icon) >= 0 ? rk(k.icon) : k.icon;
                    if (ir && key) ir.imgHtml(key, 24, 'hs-pixel');
                    if (ir && key) ir.imgHtml(key, 28, 'hs-pixel');
                });
                const loader = typeof graphicsManager !== 'undefined' && graphicsManager.shipAssetLoader;
                if (loader && (!loader.isLoaded || loader.isLoaded()) && typeof shipConfigManager !== 'undefined' && shipConfigManager.getMergedModel) {
                    const c = document.createElement('canvas'); c.width = 40; c.height = 30;
                    (defs[id] || []).forEach((k) => {
                        const model = Object.assign({}, shipConfigManager.getMergedModel(k.ship), { id: k.ship, faction: id, factionPreview: true });
                        if (typeof shipLoadoutManager !== 'undefined' && shipLoadoutManager.applyLayoutToModel) shipLoadoutManager.applyLayoutToModel(model, k.ship);
                        model.faction = id;
                        loader.renderShip(c.getContext('2d'), model, 2, 2, 0.5, null, 0, { showThrusterGlow: true, allowColorMountSprites: true });
                    });
                }
            } catch (e) { /* warm-up is best effort */ }
            idle(step);
        };
        idle(step);
    },
    /** Kits of the pending faction. */
    factionKits() {
        const d = this.kitDefs();
        return d[this.pendingFaction] || d.terran;
    },
    /** The selected kit of the pending faction (falls back to its first one). */
    currentKit() {
        const o = this._startOpts || (this._startOpts = {});
        const list = this.factionKits();
        let k = list.find((x) => x.id === o.kit);
        if (!k) { k = list[0]; o.kit = k.id; o.ship = k.ship; }
        return k;
    },
    /** Top-down hull pictogram with one area lit up (front / center / back / wing). */
    areaSvg(id) {
        const AREA_SHAPES = { front: '<path d="M8 1 L10.5 6 H5.5Z"/>', center: '<rect x="5.5" y="6.5" width="5" height="4"/>', back: '<path d="M5.5 11 H10.5 L11 15 H5Z"/>', wing: '<path d="M5 7 L0.5 13 L5 12Z M11 7 L15.5 13 L11 12Z"/>' };
        return '<svg viewBox="0 0 16 16" shape-rendering="crispEdges">' +
            Object.keys(AREA_SHAPES).map((k) => `<g class="${k === id ? 'on' : ''}">${AREA_SHAPES[k]}</g>`).join('') + '</svg>';
    },
    /** Cargo hold pictogram: 3 x 3 cells with a column / row lit up, or a growth arrow (up = fast, down = slow). */
    cargoSvg(kind, up) {
        const cell = (x, y, on) => `<rect class="${on ? 'on' : ''}" x="${x}" y="${y}" width="4" height="4"/>`;
        if (kind === 'growth') {
            return '<svg viewBox="0 0 16 16" shape-rendering="crispEdges">' + cell(1, 11, true) + cell(6, 11, true) + cell(11, 11, true) +
                (up ? '<path class="on" d="M8 1 L13 6 H10 V9 H6 V6 H3Z"/>' : '<path class="on" d="M6 1 H10 V4 H13 L8 9 L3 4 H6Z"/>') + '</svg>';
        }
        let cells = '';
        [1, 6, 11].forEach((y) => [1, 6, 11].forEach((x) => { cells += cell(x, y, kind === 'col' ? x === 11 : y === 11); }));
        return '<svg viewBox="0 0 16 16" shape-rendering="crispEdges">' + cells + '</svg>';
    },
    /** Kit bonuses as items: full text (tooltip / summary), icon html, short value, drawback flag. */
    kitBonusItems(k) {
        const b = k.bonus || {};
        const items = [];
        const ir = typeof iconRenderer !== 'undefined' && iconRenderer.imgHtml ? iconRenderer : null;
        const rk = (id) => (typeof homeStationUI !== 'undefined' && homeStationUI.resourceIconKey ? homeStationUI.resourceIconKey(id) : null);
        const resIco = (id) => { const key = rk(id); return ir && key ? ir.imgHtml(key, 24, 'hs-pixel', undefined, false) : ''; };
        const add = (text, ico, val, minus) => items.push({ text, ico, val, minus: !!minus });
        if (b.credits) add('+' + b.credits + ' CR', resIco('credits'), '+' + b.credits);
        Object.keys(b.res || {}).forEach((r) => add('+' + b.res[r] + ' ' + r.toUpperCase(), resIco(r), '+' + b.res[r]));
        if (b.slot) add('+' + b.slot + ' WEAPON SLOT', ir ? ir.imgHtml('statWeapon', 24, 'hs-pixel', undefined, false) : '', '+' + b.slot);
        const names = { front: 'NOSE', center: 'CORE', back: 'AFT', wing: 'WINGS' };
        Object.keys(b.areas || {}).forEach((a) => add('+' + b.areas[a] + ' ' + (names[a] || a.toUpperCase()), this.areaSvg(a), '+' + b.areas[a]));
        if (b.weapon2) {
            const w = typeof weaponConfigManager !== 'undefined' && weaponConfigManager.getWeapon ? weaponConfigManager.getWeapon(b.weapon2) : null;
            const ico = ir && ir.weaponImgHtml ? ir.weaponImgHtml(b.weapon2, 24, 'hs-pixel', false) : '';
            add('+' + String((w && w.name) || b.weapon2).replace(/_/g, ' ').toUpperCase() + ' WEAPON', ico, '+');
        }
        const sign = (n) => (n > 0 ? '+' : '-') + Math.abs(n);
        if (b.invRows) add(sign(b.invRows) + ' CARGO ROW', this.cargoSvg('row'), sign(b.invRows), b.invRows < 0);
        if (b.invCols) add(sign(b.invCols) + ' CARGO COL', this.cargoSvg('col'), sign(b.invCols), b.invCols < 0);
        if (b.invGrowth) add(b.invGrowth > 0 ? 'FAST CARGO GROWTH' : 'SLOW CARGO GROWTH', this.cargoSvg('growth', b.invGrowth > 0), sign(Math.round(b.invGrowth * 100)) + '%', b.invGrowth < 0);
        (k.off || []).forEach((a) => add('NO ' + (names[a] || a.toUpperCase()), this.areaSvg(a), 'OFF', true));
        return items;
    },
    /** Short bonus summary, e.g. "+120 SCRAP · +40 ORE". */
    kitBonusText(k) {
        return this.kitBonusItems(k).map((it) => it.text).join(' · ') || 'NO BONUS';
    },
    /** Starter kits: [id, label, what you get, icon key]. */
    startKits() {
        const rk = (id) => (typeof homeStationUI !== 'undefined' && homeStationUI.resourceIconKey) ? homeStationUI.resourceIconKey(id) : null;
        const ik = (k) => (['credits', 'scrap', 'ore', 'crystal'].indexOf(k.icon) >= 0 ? rk(k.icon) : k.icon);
        return this.factionKits().map((k) => [k.id, k.label, k.text, ik(k)]);
    },
    /** Every start profile launches in its own hull. */
    kitShipId(kit) {
        const k = this.factionKits().find((x) => x.id === kit);
        return k ? k.ship : this.factionKits()[0].ship;
    },
    /** Hulls a new pilot can start in; each start profile suggests one, the SHIP row overrides it. */
    startShips() { return ['player_scrap', 'player_interceptor', 'player_heavy', 'player_assault']; },
    /** The hull chosen for the new pilot: the SHIP pick, else the start profile's own hull. */
    startShipId() {
        this.currentKit();
        const o = this._startOpts || {};
        return (o.ship && this.startShips().indexOf(o.ship) >= 0) ? o.ship : this.kitShipId(o.kit);
    },
    /** Ship name + key stats under the preview (start step). */
    renderKitShipInfo() {
        const el = this.overlay && this.overlay.querySelector('.profile-kit-ship');
        if (!el || typeof shipConfigManager === 'undefined') return;
        const cfg = shipConfigManager.getConfig(this.startShipId()) || {};
        const ir = typeof iconRenderer !== 'undefined' && iconRenderer.imgHtml ? iconRenderer : null;
        // Icon is tinted via CSS mask (colour per stat); the label is only a tooltip.
        const stat = (l, v, key, cls) => {
            const m = ir ? /src="([^"]+)"/.exec(ir.imgHtml(key, 28, 'hs-pixel') || '') : null;
            return `<span class="pk-stat pk-${cls}" title="${l}" aria-label="${l}">` +
                `<i class="pk-ico"${m ? ` style="--pk-img:url('${m[1]}')"` : ''}></i><b>${v}</b></span>`;
        };
        const html = `<strong>${String(cfg.name || '').toUpperCase()}</strong><div class="profile-kit-stats">` +
            stat('SPEED', cfg.speed, 'statSpeed', 'speed') + stat('HULL', cfg.maxHealth, 'statHealth', 'hull') +
            stat('ARMOR', cfg.armor, 'statArmor', 'armor') + stat('DAMAGE', cfg.weaponDamage || cfg.damage, 'statDamage', 'damage') + '</div>' +
            `<small>${cfg.description || ''}</small>`;
        if (el.dataset.html !== html) { el.dataset.html = html; el.innerHTML = html; }   // untouched when unchanged: no icon reload flicker
    },
    /** START PROFILE list (left column of the start step): one selectable row per kit with what it grants. */
    renderKitListHtml() {
        const sel = this.currentKit().id;
        return `<div class="profile-start-col"><div class="profile-start-row profile-kit-list" data-start-row="kit">
            <span class="profile-start-label">START PROFILE</span>
            ${this.startKits().map(([v, l, t, k]) => `<button type="button" class="profile-start-chip profile-kit-item${sel === v ? ' selected' : ''}"` +
                ` data-start-opt="kit" data-value="${v}" aria-pressed="${sel === v}" tabindex="-1" title="${t}">` +
                `<span class="profile-kit-icon">${(() => { const m = k && typeof iconRenderer !== 'undefined' && iconRenderer.imgHtml ? /src="([^"]+)"/.exec(iconRenderer.imgHtml(k, 64, 'hs-pixel') || '') : null; return m ? `<i class="pk-kit-ico" style="--pk-img:url('${m[1]}')"></i>` : ''; })()}</span>` +
                `<span class="profile-kit-text"><b>${l}</b></span></button>`).join('')}
        </div>
        </div>`;
    },
    /** Free hull-area levels a new pilot may hand out in the start step. */
    startAreaBudget() { return 2; },
    /** Read-only hull overview under the ship: size and slots per area, plus the weapon the hull starts with. */
    renderLoadoutHtml() {
        const kitObj = this.currentKit();
        const slm = typeof shipLoadoutManager !== 'undefined' ? shipLoadoutManager : null;
        const list = slm && slm.getShipAreas ? slm.getShipAreas() : [{ id: 'front', label: 'NOSE' }, { id: 'center', label: 'CORE' }, { id: 'back', label: 'AFT' }, { id: 'wing', label: 'WINGS' }];
        const max = slm && slm.getMaxAreaLevel ? slm.getMaxAreaLevel() : 2;
        const size = (l) => (slm && slm.slotSizeLabel ? slm.slotSizeLabel(l) : 'SML'[l]);
        const base = (kitObj.bonus && kitObj.bonus.areas) || {};
        const cfg = (typeof shipConfigManager !== 'undefined' && shipConfigManager.getConfig(this.startShipId())) || {};
        const weapon = String(cfg.defaultWeapon || cfg.weapon || 'laser').replace(/_/g, ' ').toUpperCase();
        const startWeaponId = String(cfg.defaultWeapon || cfg.weapon || 'laser');
        const ir = typeof iconRenderer !== 'undefined' && iconRenderer.imgHtml ? iconRenderer : null;
        const kindColor = { weapon: '#ff6a4a', defense: '#7aa8ff', energy: '#ffd24a', ability: '#6dff8a' };
        const kindIcon = { weapon: 'statWeapon', defense: 'statArmor', energy: 'statEnergy', ability: 'statAbilities' };
        // One slot box: the installed part's icon, or the slot type's icon dimmed when empty.
        // Hover text of a part: name plus its stats from the weapon / ability configs.
        const tipOf = (kind, id) => {
            const lines = [];
            const e = slm && slm.getModuleConfigEntry ? slm.getModuleConfigEntry(kind, id) : null;
            const num = (label, v, unit) => { if (v != null && v !== '' && isFinite(v) && Number(v) !== 0) lines.push(label + ': ' + (Math.round(Number(v) * 100) / 100) + (unit || '')); };
            if (e) {
                const desc = e.uiDescription || e.description;
                if (desc) lines.push(String(desc).toUpperCase());
                if (kind === 'weapon') {
                    num('DAMAGE', e.damage); num('BULLETS', e.bulletCount > 1 ? e.bulletCount : 0);
                    if (e.cooldown) lines.push('FIRE RATE: ' + (Math.round(1000 / e.cooldown * 10) / 10) + '/S');
                    num('SHOT SPEED', e.speed); num('ENERGY COST', e.energyCost);
                } else {
                    num('COOLDOWN', e.cooldown ? e.cooldown / 1000 : 0, 'S'); num('DURATION', e.duration ? e.duration / 1000 : 0, 'S');
                    num('ENERGY COST', e.energyCost); num('ENERGY', e.maxEnergy || e.energy); num('REGEN', e.regen || e.energyRegen, '/S');
                    num('ARMOR', e.armor); num('SHIELD', e.shield || e.shieldHealth);
                }
            }
            // Numbers from the ability definition (effects / activation), e.g. "SHIELD STRENGTH: +25%".
            const ab = kind !== 'weapon' && typeof abilityManager !== 'undefined' && abilityManager.getAbility ? abilityManager.getAbility(id) : null;
            if (ab && ab.effects) {
                Object.keys(ab.effects).forEach((k) => {
                    const v = Number(ab.effects[k]);
                    if (!isFinite(v) || v === 0 || v === 1) return;
                    const label = k.replace(/([A-Z])/g, ' $1').toUpperCase();
                    const rounded = Math.round(v * 100) / 100;
                    let txt;
                    if (/reduction|chance|resist/i.test(k) && v > 0 && v < 1) txt = Math.round(v * 100) + '%';
                    else if (v >= 0.5 && v <= 3) txt = (v >= 1 ? '+' : '−') + Math.round(Math.abs(v - 1) * 100) + '%';
                    else txt = String(rounded);
                    lines.push(label + ': ' + txt);
                });
            }
            if (ab && ab.activation) {
                if (ab.activation.cooldown) lines.push('COOLDOWN: ' + ab.activation.cooldown / 1000 + 'S');
                if (ab.activation.duration) lines.push('DURATION: ' + ab.activation.duration / 1000 + 'S');
                if (ab.activation.cost) lines.push('ENERGY COST: ' + ab.activation.cost);
            }
            const regen = kind === 'energy' && slm && slm.getEnergyCoreRegen ? slm.getEnergyCoreRegen(id) : 0;
            if (regen) lines.push('ENERGY RECOVERY: +' + regen + '/S');
            const fx = kind !== 'weapon' && slm && slm.getAbilityStatEffect ? slm.getAbilityStatEffect(id) : null;
            if (fx) {
                const pct = (m) => (m >= 1 ? '+' : '−') + Math.round(Math.abs(m - 1) * 100) + '%';
                if (fx.speedMul) lines.push('MOVE SPEED: ' + pct(fx.speedMul));
                if (fx.damageMul) lines.push('DAMAGE: ' + pct(fx.damageMul));
                if (fx.fireRateMul) lines.push('FIRE RATE: ' + pct(fx.fireRateMul));
                if (fx.armor) lines.push('ARMOR: ' + (fx.armor > 0 ? '+' : '') + fx.armor);
            }
            return lines.join('&#10;').replace(/"/g, '&quot;') || 'NO STATS';
        };
        const slot = (kind, id, lvl, hoverKey) => {
            let key = kindIcon[kind];
            if (id && slm && slm.resolveModuleIcon) { try { key = slm.resolveModuleIcon({ kind, id }) || key; } catch (e) { /* keep type icon */ } }
            const name = id ? String(id).replace(/_/g, ' ').toUpperCase() : 'EMPTY ' + kind.toUpperCase() + ' SLOT';
            // Slot size = base (slot-sizes.js): single centre-line slots M, split / wing slots S; a fresh pilot has no slot upgrades yet.
            const sLv = lvl != null ? lvl : 1;
            const partSz = id && slm && slm.partSizeLabel ? slm.partSizeLabel(kind, id) : null;
            const sizeTxt = '&#10;SLOT SIZE: ' + size(sLv) + (partSz ? '&#10;PART SIZE: ' + partSz : '');
            const title = (id ? tipOf(kind, id) : 'NO PART INSTALLED') + sizeTxt;
            const raw = !id || !ir ? '' : (kind === 'weapon' && ir.weaponImgHtml ? ir.weaponImgHtml(id, 32, 'hs-pixel', false) : ir.imgHtml(key, 32, 'hs-pixel', kindColor[kind], false));
            let img = id ? (ir ? String(raw || '').replace(/\s(?:data-ui-tip|title)="[^"]*"/g, '') : '') : `<span class="hs-slot-glyph" data-slot-kind="${kind}"></span>`;
            // Filled slot: the part as its physical item, at its own footprint inside the slot.
            if (id && typeof physicalItem !== 'undefined') {
                const box = [40, 56, 72][Math.max(0, Math.min(2, sLv))] - 4;
                const pLv = Math.max(0, Math.min(2, slm && slm.getPartSizeLevel ? slm.getPartSizeLevel(kind, id) | 0 : 0));
                const w = pLv === 1 ? Math.round(box / 2) : box;
                img = `<span class="hs-slotview-part" style="width:${w}px;height:${box}px">${physicalItem.wrap(kind, id, w - 4, box - 4, kindColor[kind], img)}</span>`;
            }
            return `<span style="--pk-c:${kindColor[kind]}" data-kind="${kind}"${hoverKey ? ` data-wslot="${hoverKey}"` : ''} class="pk-slot${lvl != null ? ' pk-lv' + lvl : ''}${id ? ' is-filled' : ''}" data-ui-tip-instant data-ui-tip-head="${name}" data-ui-tip="${title}" aria-label="${name}">${img}</span>`;
        };
        // Area pictogram: top-down hull with the area lit up (replaces the text label).
        const areaIco = (id, label) => `<span class="pl-ico" title="${label}" aria-label="${label}">${this.areaSvg(id)}</span>`;
        const kindIco = (kind, label) => {
            const img = ir ? ir.imgHtml(kindIcon[kind], 32, 'hs-pixel') : '';
            return `<span class="pl-ico" title="${label}" aria-label="${label}">${img}</span>`;
        };
        let dl = {};
        try { dl = (slm && slm.defaultLoadoutFromShip && slm.defaultLoadoutFromShip(this.startShipId(), this.pendingFaction)) || {}; } catch (e) { /* show empty slots */ }
        // Start profiles: one part per type (weapon, defense, energy core, ability).
        // Only parts that fit the start slots are handed out.
        const fit = (kind, l) => (l || []).filter((id) => this.startPartFits(kind, id)).slice(0, 1);
        dl.defenses = fit('defense', dl.defenses); dl.abilities = fit('ability', dl.abilities); dl.energy = fit('energy', dl.energy);
        const pname = (id) => String(id).replace(/_/g, ' ').toUpperCase();
                const filled = (kind, id, lvl, hoverKey) => slot(kind, id, lvl, hoverKey);   // name + stats only as hover tooltip
        const cls = (typeof homeStationUI !== 'undefined' && homeStationUI.shipModelClass && homeStationUI.shipModelClass(this.startShipId(), cfg)) || cfg.modelClass || 'starfighter';
        const caps = slm && slm.getBaseSlotCaps ? slm.getBaseSlotCaps(cls) : { weapons: 1, defenses: 0, abilities: 0, energy: 1 };
        if (slm && slm.baseWeaponMounts) caps.weapons = slm.baseWeaponMounts(caps);
        // Small start base: one slot of each type; the kit's area bonuses open more.
        caps.weapons = 1; caps.defenses = 1; caps.abilities = 1; caps.energy = 1;
        // Areas only carry weapon slots: the nose gun, then the wing guns as mirrored pairs.
        const lvOf = (id) => Math.min(max, Number(base[id]) || 0);
        list.forEach((a) => { (slm && slm.getAreaSlotBonus ? slm.getAreaSlotBonus(a.id, lvOf(a.id)) : []).forEach((k) => { caps[k] = (caps[k] || 0) + 1; }); });
        // The kit's second weapon is equipped in slot 1 (the pilot gets that slot with the kit).
        const w2 = kitObj.bonus && kitObj.bonus.weapon2;
        if (w2) caps.weapons = Math.max(caps.weapons, 2);
        const wslots = { front: Math.min(1, caps.weapons), wing: Math.max(0, caps.weapons - 1), center: 0, back: 0 };
        // Core gun (nose-less hulls): slot 0 moves into the core, as one gun or a left / right pair.
        if (kitObj.coreGun && caps.weapons > 0) { wslots.front = 0; wslots.center = kitObj.coreGun === 'split' ? 2 : 1; }
        const wLv = (area) => (area === 'wing' || (area === 'center' && kitObj.coreGun === 'split') ? 0 : 1);
        const rows = list.map((a) => {
            if ((kitObj.off || []).indexOf(a.id) >= 0) {
                return `<div class="pl-row is-off">${areaIco(a.id, a.label)}<span class="pl-slots"><em>OFF</em></span></div>`;
            }
            const n = wslots[a.id] || 0;
            // The start gun sits in the nose (or the core), the kit's second weapon in the first wing slot; the rest stay empty.
            const gun0 = (dl.weaponSlots || []).find(Boolean) || (dl.weapons && dl.weapons[0]) || startWeaponId;
            const ws = [gun0, w2 || null];
            const dmg = cfg.weaponDamage || cfg.damage;
            const txt = n ? Array.from({ length: n }, (_, i) => (a.id === 'front' ? filled('weapon', ws[0] || startWeaponId, wLv(a.id), 'front') : (a.id === 'center' ? filled('weapon', ws[0] || (dl.weapons && dl.weapons[0]) || startWeaponId, wLv(a.id), 'center') : filled('weapon', ws[1 + i] || null, i === 0 && w2 && slm && slm.getPartSizeLevel ? Math.max(wLv(a.id), slm.getPartSizeLevel('weapon', w2)) : wLv(a.id), 'wing:' + i)))).join('') : '<em>NO WEAPON SLOT</em>';
            return `<div class="pl-row">${areaIco(a.id, a.label)}<span class="pl-slots">${txt}</span></div>`;
        }).join('');
        const many = (kind, n, list) => Array.from({ length: n }, (_, i) => filled(kind, (list || [])[i] || null)).join('') || '<em>–</em>';
        const parts = `<div class="pl-parts">` +
            [['defense', caps.defenses, dl.defenses], ['energy', caps.energy, dl.energy], ['ability', caps.abilities, dl.abilities]].map(([k, n, l]) => `<div class="pl-row">${kindIco(k, k.toUpperCase())}<span class="pl-slots">${many(k, n || 0, l)}</span></div>`).join('') + `</div>`;
        const invHtml = this.renderStartInvHtml(kitObj, [['weapon', (dl.weaponSlots || []).find(Boolean) || (dl.weapons && dl.weapons[0]) || startWeaponId],
            ['defense', dl.defenses[0]], ['energy', dl.energy[0]], ['ability', dl.abilities[0]], ['weapon', w2]], kindColor, tipOf);
        // Ship stats take the sidebar's top (the inventory below already shows every part).
        const ir2 = typeof iconRenderer !== 'undefined' && iconRenderer.imgHtml ? iconRenderer : null;
        const stat = (l, v, key, cls) => {
            const m = ir2 ? /src="([^"]+)"/.exec(ir2.imgHtml(key, 28, 'hs-pixel') || '') : null;
            // Layout inline: older start-step rules restyle .pk-stat.
            return `<span class="pk-stat pk-${cls}" style="display:grid;grid-template-columns:32px 1fr;grid-template-areas:'i v' 'i l';column-gap:10px;align-items:center;padding:8px 10px">` +
                `<i class="pk-ico" style="grid-area:i;display:block;width:32px;height:32px${m ? `;--pk-img:url('${m[1]}')` : ''}"></i>` +
                `<b style="grid-area:v;font-size:20px;line-height:1.1">${v != null ? v : '–'}</b><small style="grid-area:l;font-size:12px;letter-spacing:2px">${l}</small></span>`;
        };
        const stats = stat('SPEED', cfg.speed, 'statSpeed', 'speed') + stat('HULL', cfg.maxHealth, 'statHealth', 'hull') +
            stat('ARMOR', cfg.armor, 'statArmor', 'armor') + stat('DAMAGE', cfg.weaponDamage || cfg.damage, 'statDamage', 'damage');
        // Equipped weapons in slot order, each with a slot / fire-key badge (several guns: A / S / D, one gun: SPACE).
        const wcm = typeof weaponConfigManager !== 'undefined' ? weaponConfigManager : null;
        const gunId = (dl.weaponSlots || []).find(Boolean) || (dl.weapons && dl.weapons[0]) || startWeaponId;
        const fam = this.startWeaponSlots(gunId);
        const keyOf = (i) => (fam.length > 1 ? ['A', 'S', 'D'][i] || 'SPACE' : 'SPACE');
        // Slot size: the nose / core gun is a single M mount (a split core S), wing pairs S; the kit's gun gets a slot grown to fit it.
        const partLv = (id) => (id && slm && slm.getPartSizeLevel ? slm.getPartSizeLevel('weapon', id) : 0);
        const slotLv = (i, id) => Math.max(i === 0 ? (kitObj.coreGun === 'split' ? 0 : 1) : 0, partLv(id));
        const sizeTip = (i, id) => 'SLOT SIZE: ' + size(slotLv(i, id)) + (id ? '&#10;PART SIZE: ' + size(partLv(id)) : '');
        const weapons = fam.map((wid, wi) => {
            if (!wid) {
                return `<span class="pk-weapon is-empty" data-slot="${wi}" style="--pk-c:#8a84a8" data-ui-tip-instant data-ui-tip-head="EMPTY WEAPON SLOT" data-ui-tip="SLOT ${wi + 1} · KEY ${keyOf(wi)}&#10;${sizeTip(wi)}">` +
                    `<span class="hs-slot-glyph" data-slot-kind="weapon"></span><span class="pk-wslot">${wi + 1}</span><span class="pk-wkey">${keyOf(wi) === 'SPACE' ? 'SPC' : keyOf(wi)}</span></span>`;
            }
            const w = wcm && wcm.getWeapon ? wcm.getWeapon(wid) : null;
            const wname = String((w && w.name) || wid).replace(/_/g, ' ').toUpperCase();
            const ico = ir && ir.weaponImgHtml ? String(ir.weaponImgHtml(wid, 32, 'hs-pixel', false) || '').replace(/\s(?:data-ui-tip|title)="[^"]*"/g, '') : '';
            const facBonus = wcm && wcm.getFactionWeaponMul && wcm.getFactionWeaponMul(this.pendingFaction, wid) > 1;
            const hullBonus = wcm && wcm.getShipClassWeaponMul && wcm.getShipClassWeaponMul(cls, wid) > 1;
            const tip = ['SLOT ' + (wi + 1) + ' · KEY ' + keyOf(wi), sizeTip(wi, wid), facBonus ? '+20% DAMAGE (FACTION)' : '', hullBonus ? '+20% DAMAGE (HULL)' : ''].filter(Boolean).join('&#10;');
            const col = wcm && wcm.getWeaponUiColor ? wcm.getWeaponUiColor(wid) : '#ff6a4a';
            return `<span class="pk-weapon${wi === 0 ? ' is-focus' : ''}" data-slot="${wi}" style="--pk-c:${col}" data-ui-tip-instant data-ui-tip-head="${wname}" data-ui-tip="${tip}">${ico}<span class="pk-wslot">${wi + 1}</span><span class="pk-wkey">${keyOf(wi) === 'SPACE' ? 'SPC' : keyOf(wi)}</span></span>`;
        }).join('');
        return `<div class="profile-loadout-title">WEAPONS</div>
            <div class="profile-side-weapons" data-tip-side="left">${weapons}</div>
            <div class="profile-loadout-title">STATS</div>
            <div class="profile-side-stats" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">${stats}</div>
            <div class="profile-start-inv" data-tip-side="left">${invHtml}</div>`;
    },
    /** Start inventory: the kit's grid (hull start size + kit rows) holding the start parts. */
    renderStartInvHtml(kitObj, parts, kindColor, tipOf) {
        const slm = typeof shipLoadoutManager !== 'undefined' ? shipLoadoutManager : null;
        const ship = this.startShipId();
        const st = slm && slm.inventoryStart ? slm.inventoryStart(ship) : [4, 2];
        const cols = Math.max(3, Math.min(8, st[0] + (Number((kitObj.bonus || {}).invCols) || 0)));
        const rows = Math.max(1, st[1] + (Number((kitObj.bonus || {}).invRows) || 0));
        const ir = typeof iconRenderer !== 'undefined' && iconRenderer.imgHtml ? iconRenderer : null;
        const cells = parts.filter((p) => p[1]).map(([kind, id, inst = true]) => {
            const lv = Math.max(0, Math.min(2, slm && slm.getPartSizeLevel ? slm.getPartSizeLevel(kind, id) | 0 : 0));
            const span = [[1, 1], [1, 2], [2, 2]][lv];
            const body = typeof physicalItem !== 'undefined' ? physicalItem.wrap(kind, id, span[0] * 48 + (span[0] - 1) * 4 - 8, span[1] * 48 + (span[1] - 1) * 4 - 8, kindColor[kind], '') : '';
            const name = String(id).replace(/_/g, ' ').toUpperCase();
            // Same data as the shipyard inventory: full part stats, size, status.
            const tip = (tipOf ? tipOf(kind, id) + '&#10;' : '') + 'SIZE: ' + (slm && slm.partSizeLabel ? slm.partSizeLabel(kind, id) : 'S') + '&#10;STATUS: ' + (inst ? 'INSTALLED' : 'IN INVENTORY');
            // Part icon lives only in the tooltip (hidden on the cell); hangar bay cells do the same.
            let key = kind === 'weapon' ? null : (slm && slm.resolveModuleIcon ? slm.resolveModuleIcon({ kind, id }) : null);
            const raw = !ir ? '' : (kind === 'weapon' && ir.weaponImgHtml
                ? ir.weaponImgHtml(id, 32, 'hs-pixel', false)
                : ir.imgHtml(key || 'statArmor', 32, 'hs-pixel', kindColor[kind], false));
            const ico = String(raw || '').replace(/\s(?:data-ui-tip|title)="[^"]*"/g, '');
            return `<span class="hs-pick-cell${inst ? ' is-equipped' : ''}" style="grid-column: span ${span[0]}; grid-row: span ${span[1]}; --pk-c:${kindColor[kind]}" data-ui-tip-instant data-ui-tip-compact data-ui-tip-head="${name}" data-ui-tip="${tip}">${body}<span class="hs-pick-ico">${ico}</span><span class="hs-pick-size">${slm && slm.partSizeLabel ? slm.partSizeLabel(kind, id) : ''}</span></span>`;
        }).join('');
        // Cells as big as the sidebar allows, at most 56px: fitted to the free width AND height (.profile-start-inv is a size
        // container), so a tall grid scales down instead of scrolling. 50px = title + gap + picker padding / border; 16px = picker padding / border.
        const cs = `clamp(16px, min((100cqw - 16px - ${(cols - 1) * 4}px) / ${cols}, (100cqh - 50px - ${(rows - 1) * 4}px) / ${rows}), 56px)`;
        return `<div class="profile-start-inv-title">INVENTORY <b>${cols} × ${rows}</b></div><div class="hs-slot-picker hs-bay-inv" style="--cs:${cs}"><div class="hs-pick-grid" style="grid-template-columns: repeat(${cols}, var(--cs)); grid-template-rows: repeat(${rows}, var(--cs)); width: calc(${cols} * var(--cs) + ${cols - 1} * 4px); height: calc(${rows} * var(--cs) + ${rows - 1} * 4px)">${cells}</div></div>`;
    },
    /** Kit bonus + blurb: its own strip above the ship, beside the hull sidebar. */
    renderKitInfoHtml() {
        const kitObj = this.currentKit();
        const kitRow = this.startKits().find((k) => k[0] === kitObj.id);
        const kitIcon = kitRow && kitRow[3] && typeof iconRenderer !== 'undefined' && iconRenderer.imgHtml ? iconRenderer.imgHtml(kitRow[3], 24, 'hs-pixel') : '';
        // One chip per bonus: icon + short value, the full text as tooltip; drawbacks (cargo cuts, missing hull areas) greyed.
        const chips = this.kitBonusItems(kitObj).map((it) => `<span class="pkb-chip${it.minus ? ' is-minus' : ''}" data-ui-tip-instant data-ui-tip="${it.text}" aria-label="${it.text}">` +
            `<span class="pkb-ico">${it.ico}</span><b>${it.val}</b></span>`).join('');
        return `<div class="pkb-head"><span class="pkb-label">${kitIcon}KIT BONUS</span><p class="profile-kit-desc">${kitObj.desc || (kitRow && kitRow[2]) || ''}</p></div>
            <div class="pkb-chips">${chips}</div>`;
    },
    /** Accent colour of the pending faction (portrait glow). */
    pilotAccent() {
        const fss = typeof factionShipStyles !== 'undefined' ? factionShipStyles : null;
        return fss && fss.getFactionStyle ? (fss.getFactionStyle(this.pendingFaction) || {}).accent : null;
    },
});
