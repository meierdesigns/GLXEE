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
        return {
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
                K('hauler_thief', 'HAULER THIEF', 'Hijacked freighter hull with loaded holds', 'kitHaulerThief', 'player_heavy', { res: { scrap: 80, ore: 60 } })
            ],
            machine: [
                K('boot_sequence', 'BOOT SEQUENCE', 'Freshly compiled unit with spare parts', 'kitBootSequence', 'player_scrap', { res: { scrap: 60 } }),
                K('harvester', 'HARVESTER UNIT', 'Resource drone chassis, holds full of ore', 'kitHarvester', 'player_heavy', { res: { ore: 100, scrap: 40 } }),
                K('scout_unit', 'SCOUT UNIT', 'Fast recon frame with a credit cache', 'kitScoutUnit', 'player_interceptor', { credits: 150 }),
                K('combat_protocol', 'COMBAT PROTOCOL', 'War routine loaded: assault frame, +1 weapon slot', 'kitCombatProtocol', 'player_assault', { slot: 1 })
            ]
        };
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
    /** Short bonus summary, e.g. "+120 SCRAP · +40 ORE". */
    kitBonusText(k) {
        const b = k.bonus || {};
        const parts = [];
        if (b.credits) parts.push('+' + b.credits + ' CR');
        Object.keys(b.res || {}).forEach((r) => parts.push('+' + b.res[r] + ' ' + r.toUpperCase()));
        if (b.slot) parts.push('+' + b.slot + ' WEAPON SLOT');
        const names = { front: 'NOSE', center: 'CORE', back: 'AFT', wing: 'WINGS' };
        Object.keys(b.areas || {}).forEach((a) => parts.push('+' + b.areas[a] + ' ' + (names[a] || a.toUpperCase())));
        (k.off || []).forEach((a) => parts.push('NO ' + (names[a] || a.toUpperCase())));
        return parts.join(' · ') || 'NO BONUS';
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
            const img = id ? (ir ? String(raw || '').replace(/\s(?:data-ui-tip|title)="[^"]*"/g, '') : '') : `<span class="hs-slot-glyph" data-slot-kind="${kind}"></span>`;
            return `<span style="--pk-c:${kindColor[kind]}" data-kind="${kind}"${hoverKey ? ` data-wslot="${hoverKey}"` : ''} class="pk-slot${lvl != null ? ' pk-lv' + lvl : ''}${id ? ' is-filled' : ''}" data-ui-tip-instant data-ui-tip-head="${name}" data-ui-tip="${title}" aria-label="${name}">${img}</span>`;
        };
        // Area pictogram: top-down hull with the area lit up (replaces the text label).
        const AREA_SHAPES = { front: '<path d="M8 1 L10.5 6 H5.5Z"/>', center: '<rect x="5.5" y="6.5" width="5" height="4"/>', back: '<path d="M5.5 11 H10.5 L11 15 H5Z"/>', wing: '<path d="M5 7 L0.5 13 L5 12Z M11 7 L15.5 13 L11 12Z"/>' };
        const areaIco = (id, label) => `<span class="pl-ico" title="${label}" aria-label="${label}"><svg viewBox="0 0 16 16" shape-rendering="crispEdges">` +
            Object.keys(AREA_SHAPES).map((k) => `<g class="${k === id ? 'on' : ''}">${AREA_SHAPES[k]}</g>`).join('') + '</svg></span>';
        const kindIco = (kind, label) => {
            const img = ir ? ir.imgHtml(kindIcon[kind], 32, 'hs-pixel') : '';
            return `<span class="pl-ico" title="${label}" aria-label="${label}">${img}</span>`;
        };
        let dl = {};
        try { dl = (slm && slm.defaultLoadoutFromShip && slm.defaultLoadoutFromShip(this.startShipId(), this.pendingFaction)) || {}; } catch (e) { /* show empty slots */ }
        // Start profiles: one part per type (weapon, defense, energy core, ability).
        dl.defenses = (dl.defenses || []).slice(0, 1); dl.abilities = (dl.abilities || []).slice(0, 1); dl.energy = (dl.energy || []).slice(0, 1);
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
        const wslots = { front: Math.min(1, caps.weapons), wing: Math.max(0, caps.weapons - 1), center: 0, back: 0 };
        // Core gun (nose-less hulls): slot 0 moves into the core, as one gun or a left / right pair.
        if (kitObj.coreGun && caps.weapons > 0) { wslots.front = 0; wslots.center = kitObj.coreGun === 'split' ? 2 : 1; }
        const wLv = (area) => (area === 'wing' || (area === 'center' && kitObj.coreGun === 'split') ? 0 : 1);
        const rows = list.map((a) => {
            if ((kitObj.off || []).indexOf(a.id) >= 0) {
                return `<div class="pl-row is-off">${areaIco(a.id, a.label)}<span class="pl-slots"><em>OFF</em></span></div>`;
            }
            const n = wslots[a.id] || 0;
            // Start profiles hold one weapon only: it sits in the nose (or the core); every other weapon slot is empty.
            const gun0 = (dl.weaponSlots || []).find(Boolean) || (dl.weapons && dl.weapons[0]) || startWeaponId;
            const ws = [gun0];
            const dmg = cfg.weaponDamage || cfg.damage;
            const txt = n ? Array.from({ length: n }, (_, i) => (a.id === 'front' ? filled('weapon', ws[0] || startWeaponId, wLv(a.id), 'front') : (a.id === 'center' ? filled('weapon', ws[0] || (dl.weapons && dl.weapons[0]) || startWeaponId, wLv(a.id), 'center') : filled('weapon', ws[1 + i] || null, wLv(a.id), 'wing:' + i)))).join('') : '<em>NO WEAPON SLOT</em>';
            return `<div class="pl-row">${areaIco(a.id, a.label)}<span class="pl-slots">${txt}</span></div>`;
        }).join('');
        const many = (kind, n, list) => Array.from({ length: n }, (_, i) => filled(kind, (list || [])[i] || null)).join('') || '<em>–</em>';
        const parts = `<div class="pl-parts">` +
            [['defense', caps.defenses, dl.defenses], ['energy', caps.energy, dl.energy], ['ability', caps.abilities, dl.abilities]].map(([k, n, l]) => `<div class="pl-row">${kindIco(k, k.toUpperCase())}<span class="pl-slots">${many(k, n || 0, l)}</span></div>`).join('') + `</div>`;
        return `<div class="profile-loadout-title">HULL AREAS</div>
            <div class="pl-wrap" data-tip-side="left">${rows}${parts}</div>`;
    },
    /** Kit bonus + blurb: its own full-width strip under the ship and the hull sidebar. */
    renderKitInfoHtml() {
        const kitObj = this.currentKit();
        const res = this.kitBonusText(kitObj);
        const kitRow = this.startKits().find((k) => k[0] === kitObj.id);
        const kitIcon = kitRow && kitRow[3] && typeof iconRenderer !== 'undefined' && iconRenderer.imgHtml ? iconRenderer.imgHtml(kitRow[3], 24, 'hs-pixel') : '';
        return `<div class="profile-loadout-line profile-kit-bonus"><span class="pkb-label">${kitIcon}KIT BONUS</span><b>${res}</b></div>
            <p class="profile-kit-desc">${kitObj.desc || (kitRow && kitRow[2]) || ''}</p>`;
    },
    /** Accent colour of the pending faction (portrait glow). */
    pilotAccent() {
        const fss = typeof factionShipStyles !== 'undefined' ? factionShipStyles : null;
        return fss && fss.getFactionStyle ? (fss.getFactionStyle(this.pendingFaction) || {}).accent : null;
    },
});
