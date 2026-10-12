"use strict";

// ProfileSelectionManager members, continued from core.js: starter kits and loadout.
extendClass(ProfileSelectionManager, {
    /** Starter kits per faction (lore flavoured): id, label, blurb, icon key, hull, bonus {credits, res, slot}. */
    kitDefs() {
        const K = (id, label, text, icon, ship, bonus) => ({ id, label, text, icon, ship, bonus: bonus || {} });
        return {
            terran: [
                K('standard_issue', 'STANDARD ISSUE', 'Alliance-issue fighter and a small stipend', 'menuShips', 'player_scrap', { credits: 100 }),
                K('fleet_charter', 'FLEET CHARTER', 'A navy commission: fast patrol interceptor', 'credits', 'player_interceptor', { credits: 200 }),
                K('engineer_corps', 'ENGINEER CORPS', 'Dockyard supplies and a sturdy hull', 'scrap', 'player_heavy', { res: { scrap: 80, ore: 40 } }),
                K('test_pilot', 'TEST PILOT', 'Prototype assault frame with a spare gun mount', 'hsCraft', 'player_assault', { slot: 1 })
            ],
            kronax: [
                K('clan_blood', 'CLAN BLOOD', 'Your clan\'s first hull and a pouch of ore', 'menuShips', 'player_scrap', { res: { ore: 60 } }),
                K('warlord_tithe', 'WARLORD\'S TITHE', 'Tribute from conquered mines on a heavy ship', 'ore', 'player_heavy', { res: { ore: 120, crystal: 20 } }),
                K('raider_pack', 'RAIDER PACK', 'Loot from early raids and a swift hunter', 'credits', 'player_interceptor', { credits: 150 }),
                K('duelist', 'DUELIST', 'Born to fight: assault ship with an extra gun', 'hsCraft', 'player_assault', { slot: 1 })
            ],
            voidborn: [
                K('void_drifter', 'VOID DRIFTER', 'Wanderer of the dark with a sliver of crystal', 'menuShips', 'player_scrap', { res: { crystal: 15 } }),
                K('rift_seeker', 'RIFT SEEKER', 'Rift-tuned interceptor and crystal shards', 'crystal', 'player_interceptor', { res: { crystal: 40 } }),
                K('echo_deep', 'ECHO OF THE DEEP', 'Salvage from a drowned fleet on a heavy hull', 'ore', 'player_heavy', { res: { crystal: 25, ore: 20 } }),
                K('ascendant', 'ASCENDANT', 'The void answers: assault ship, extra weapon slot', 'hsCraft', 'player_assault', { slot: 1 })
            ],
            pirate: [
                K('scavenger', 'SCAVENGER', 'Patched-up wreck and a heap of scrap', 'scrap', 'player_scrap', { res: { scrap: 120 } }),
                K('smuggler', 'SMUGGLER', 'Fast ship and a stash of dirty credits', 'credits', 'player_interceptor', { credits: 250 }),
                K('brigand', 'BRIGAND', 'Stolen assault frame with an extra gun mount', 'hsCraft', 'player_assault', { slot: 1 }),
                K('hauler_thief', 'HAULER THIEF', 'Hijacked freighter hull with loaded holds', 'ore', 'player_heavy', { res: { scrap: 80, ore: 60 } })
            ],
            machine: [
                K('boot_sequence', 'BOOT SEQUENCE', 'Freshly compiled unit with spare parts', 'menuShips', 'player_scrap', { res: { scrap: 60 } }),
                K('harvester', 'HARVESTER UNIT', 'Resource drone chassis, holds full of ore', 'ore', 'player_heavy', { res: { ore: 100, scrap: 40 } }),
                K('scout_unit', 'SCOUT UNIT', 'Fast recon frame with a credit cache', 'credits', 'player_interceptor', { credits: 150 }),
                K('combat_protocol', 'COMBAT PROTOCOL', 'War routine loaded: assault frame, +1 weapon slot', 'hsCraft', 'player_assault', { slot: 1 })
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
                `<span class="profile-kit-icon">${k && typeof iconRenderer !== 'undefined' && iconRenderer.imgHtml ? iconRenderer.imgHtml(k, 24, 'hs-pixel') : ''}</span>` +
                `<span class="profile-kit-text"><b>${l}</b><small>${t.toUpperCase()}</small></span></button>`).join('')}
        </div>
        </div>`;
    },
    /** Free hull-area levels a new pilot may hand out in the start step. */
    startAreaBudget() { return 2; },
    /** SHIP EDITOR under the ship: set the hull areas (slot sizes) with the start budget. */
    renderLoadoutHtml() {
        const o = this._startOpts || {};
        const kitObj = this.currentKit();
        const areas = o.areas || (o.areas = { front: 0, center: 0, back: 0, wing: 0 });
        const slm = typeof shipLoadoutManager !== 'undefined' ? shipLoadoutManager : null;
        const list = slm && slm.getShipAreas ? slm.getShipAreas() : [{ id: 'front', label: 'NOSE' }, { id: 'center', label: 'CORE' }, { id: 'back', label: 'AFT' }, { id: 'wing', label: 'WINGS' }];
        const max = slm && slm.getMaxAreaLevel ? slm.getMaxAreaLevel() : 2;
        const size = (l) => (slm && slm.slotSizeLabel ? slm.slotSizeLabel(l) : 'SML'[l]);
        const used = Object.keys(areas).reduce((n, k) => n + (areas[k] || 0), 0);
        const left = Math.max(0, this.startAreaBudget() - used);
        const rows = list.map((a) => {
            const l = areas[a.id] || 0;
            const opens = slm && slm.getAreaSlotBonus ? slm.getAreaSlotBonus(a.id, l).length : 0;
            return `<div class="profile-area-row"><span class="profile-area-name">${a.label}</span>` +
                `<button type="button" class="profile-area-btn" data-area="${a.id}" data-d="-1" tabindex="-1"${l <= 0 ? ' disabled' : ''}>−</button>` +
                `<b class="profile-area-size">${size(l)}</b>` +
                `<button type="button" class="profile-area-btn" data-area="${a.id}" data-d="1" tabindex="-1"${l >= max || left <= 0 ? ' disabled' : ''}>+</button>` +
                `<small>${opens ? '+' + opens + ' SLOT' + (opens > 1 ? 'S' : '') : 'BASE'}</small></div>`;
        }).join('');
        const res = this.kitBonusText(kitObj);
        const kitRow = this.startKits().find((k) => k[0] === kitObj.id);
        const kitIcon = kitRow && kitRow[3] && typeof iconRenderer !== 'undefined' && iconRenderer.imgHtml ? iconRenderer.imgHtml(kitRow[3], 24, 'hs-pixel') : '';
        return `<div class="profile-loadout-title">SHIP EDITOR · HULL AREAS <span class="profile-area-left">${left} POINT${left === 1 ? '' : 'S'} LEFT</span></div>
            ${rows}
            <div class="profile-loadout-line profile-kit-bonus"><span class="pkb-label">${kitIcon}KIT BONUS</span><b>${res}</b></div>`;
    },
    /** Accent colour of the pending faction (portrait glow). */
    pilotAccent() {
        const fss = typeof factionShipStyles !== 'undefined' ? factionShipStyles : null;
        return fss && fss.getFactionStyle ? (fss.getFactionStyle(this.pendingFaction) || {}).accent : null;
    },
});
