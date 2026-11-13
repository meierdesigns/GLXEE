"use strict";

// ProfileSelectionManager: the faction info tabs of the "choose faction" step (LORE / GALAXY / PLAYSTYLE / WEAPON / ALLIES).
// Every tab shows icons and values instead of one line of text: home galaxy map + facts, rating bars, weapon stat bars, allies
// and rivals as emblem cards. renderFactionFacts() (core.js) still fills the plain fact boxes first; this replaces them.
extendClass(ProfileSelectionManager, {
    // Playstyle ratings 1-5, read off each faction's playstyle text (see planet-config/get-faction-meta.js).
    FACTION_RATINGS: {
        terran:   { damage: 3, defense: 3, speed: 3, evasion: 3, economy: 3, level: 'EASY · FORGIVING' },
        kronax:   { damage: 5, defense: 3, speed: 4, evasion: 2, economy: 2, level: 'HARD · HIGH RISK' },
        voidborn: { damage: 3, defense: 2, speed: 4, evasion: 5, economy: 2, level: 'TRICKY · TACTICAL' },
        pirate:   { damage: 3, defense: 2, speed: 3, evasion: 3, economy: 5, level: 'MEDIUM · OPPORTUNIST' },
        machine:  { damage: 3, defense: 5, speed: 2, evasion: 2, economy: 4, level: 'MEDIUM · GRINDER' }
    },
    /** HTML for the focus strip under lore: top stats + preferred / affinity weapons. */
    buildFactionFocusHtml(id, meta, ratings) {
        const ir = typeof iconRenderer !== 'undefined' ? iconRenderer : null;
        const wcm = typeof weaponConfigManager !== 'undefined' ? weaponConfigManager : null;
        const R = ratings || (this.FACTION_RATINGS && this.FACTION_RATINGS[id]) || (this.FACTION_RATINGS && this.FACTION_RATINGS.terran) || null;
        const statDefs = [
            ['damage', 'DAMAGE', 'statDamage'],
            ['defense', 'DEFENSE', 'statArmor'],
            ['speed', 'SPEED', 'statSpeed'],
            ['evasion', 'EVASION', 'ability_evasion_boost'],
            ['economy', 'ECONOMY', 'navCoin']
        ];
        let focusKeys = [];
        let focusLabels = [];
        if (R) {
            const ranked = statDefs
                .map(([k, label]) => ({ k, label, n: Number(R[k]) || 0 }))
                .sort((a, b) => b.n - a.n);
            const top = ranked[0] && ranked[0].n;
            // Highlight from 3/5 up — mid ratings should already read as a strength.
            const focused = ranked.filter((s) => s.n >= 3 || (top < 3 && s.n >= top)).slice(0, 3);
            if (ranked.every((s) => s.n === ranked[0].n)) {
                focusLabels = ['BALANCED'];
                focusKeys = [];
            } else {
                focusLabels = focused.map((s) => s.label);
                focusKeys = focused.map((s) => s.k);
            }
        }
        const bars = R ? statDefs.map(([k, label, iconKey]) => {
            const n = Math.max(0, Math.min(5, Number(R[k]) || 0));
            const isFocus = focusKeys.indexOf(k) >= 0 || n >= 3;
            const cells = Array.from({ length: 5 }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('');
            const ico = ir && iconKey
                ? String(ir.imgHtml(iconKey, 28, 'pff-stat-ico') || '').replace(/\s(?:data-ui-tip|title)="[^"]*"/g, '')
                : '';
            return `<span class="pff-stat${isFocus ? ' is-focus' : ''}" title="${label} ${n}/5">` +
                `<span class="pff-stat-ico-wrap" aria-hidden="true">${ico || `<b>${label}</b>`}</span>` +
                `<span class="pff-cells">${cells}</span></span>`;
        }).join('') : '';
        const preferred = (typeof factionShipStyles !== 'undefined' && factionShipStyles.getFactionDefaultWeapons)
            ? factionShipStyles.getFactionDefaultWeapons(id) : [];
        const affinity = (wcm && wcm.getFactionWeaponAffinity) ? wcm.getFactionWeaponAffinity(id) : [];
        const weaponChip = (wid, bonus) => {
            const w = wcm && wcm.getWeapon ? wcm.getWeapon(wid) : null;
            const label = String((w && w.name) || wid).replace(/_/g, ' ').toUpperCase();
            const ico = ir && ir.weaponImgHtml
                ? String(ir.weaponImgHtml(wid, 28, '', false) || '').replace(/\s(?:data-ui-tip|title)="[^"]*"/g, '')
                : '';
            return `<span class="pff-weapon${bonus ? ' is-bonus' : ''}" title="${label}${bonus ? ' · +20% DMG' : ''}">${ico}<b>${label}</b>${bonus ? '<em>+20%</em>' : ''}</span>`;
        };
        // Preferred stays preferred (no +20% badge here); affinity extras fill BONUS.
        // Same two-row cluster for every faction so the block height never jumps.
        const preferredHtml = preferred.map((wid) => weaponChip(wid, false)).join('')
            || '<span class="pff-empty">—</span>';
        const bonusIds = affinity.filter((wid) => preferred.indexOf(wid) === -1);
        const bonusHtml = (bonusIds.length ? bonusIds : preferred).map((wid) => weaponChip(wid, true)).join('')
            || '<span class="pff-empty">—</span>';
        // Faction weapon unlocks (e.g. pirate CHAIN on Spread): show in preview before you buy them.
        const ownedWeapons = preferred.concat(affinity.filter((w) => preferred.indexOf(w) === -1));
        const unlockTracks = (typeof economyConfig !== 'undefined' && economyConfig.itemUpgradeTrackDefs
            && economyConfig.itemUpgradeTrackDefs.weapons)
            ? economyConfig.itemUpgradeTrackDefs.weapons : {};
        const unlockChips = Object.keys(unlockTracks).map((track) => {
            const def = unlockTracks[track];
            if (!def || !def.weaponIds || !def.weaponIds.length) return '';
            const hits = def.weaponIds.filter((wid) => ownedWeapons.indexOf(wid) !== -1);
            if (!hits.length) return '';
            const names = hits.map((wid) => {
                const w = wcm && wcm.getWeapon ? wcm.getWeapon(wid) : null;
                return String((w && w.name) || wid).replace(/_/g, ' ').toUpperCase();
            }).join(' · ');
            const tip = `${def.desc || def.label} · on ${names}`;
            return `<span class="pff-unlock" title="${tip}"><b>${def.label}</b><em>${names}</em><small>${def.desc || ''}</small></span>`;
        }).filter(Boolean).join('');
        const unlockHtml = unlockChips
            || '<span class="pff-empty">—</span>';
        const styleLine = (meta && meta.playstyle) ? `<p class="pff-style">${meta.playstyle}</p>` : '';
        const level = R && R.level ? `<span class="pff-level">${R.level}</span>` : '';
        return `${styleLine}` +
            `<div class="pff-row"><span class="pff-label">FOCUS</span><span class="pff-chips">${focusLabels.map((t) => `<span class="pff-chip">${t}</span>`).join('')}${level}</span></div>` +
            `<div class="pff-bars">${bars}</div>` +
            `<div class="pff-weapons-cluster">` +
            `<div class="pff-row pff-weapons-row"><span class="pff-label">PREFERRED</span><span class="pff-weapons">${preferredHtml}</span></div>` +
            `<div class="pff-row pff-weapons-row"><span class="pff-label">BONUS +20%</span><span class="pff-weapons">${bonusHtml}</span></div>` +
            `<div class="pff-row pff-weapons-row pff-unlock-row"><span class="pff-label">UNLOCK</span><span class="pff-weapons pff-unlocks">${unlockHtml}</span></div>` +
            `</div>`;
    },
    /** Segmented pixel bar: `n` of `max` cells lit, icon + label on the left, value text on the right. */
    pfxBar(label, iconKey, n, max, valueText) {
        const ir = typeof iconRenderer !== 'undefined' ? iconRenderer : null;
        const acc = this.pfxAccent;
        const m = ir && iconKey ? /src="([^"]+)"/.exec(ir.imgHtml(iconKey, 40, '', acc, false) || '') : null;
        const icon = m ? `<i class="pfx-ico" style="--pfx-img:url('${m[1]}');--pfx-c:${acc}"></i>` : '';
        const cells = Array.from({ length: max }, (_, i) => `<i class="${i < Math.round(n) ? 'on' : ''}"></i>`).join('');
        return `<div class="pfx-bar"><span class="pfx-bar-ico">${icon}</span><span class="pfx-bar-label">${label}</span>` +
            `<span class="pfx-bar-cells">${cells}</span><b class="pfx-bar-val">${valueText}</b></div>`;
    },
    pfxTile(iconHtml, label, value) {
        return `<div class="pfx-tile"><span class="pfx-tile-ico">${iconHtml || ''}</span><span class="pfx-tile-label">${label}</span><b class="pfx-tile-val">${value}</b></div>`;
    },
    pfxGalaxyMap(gid, color) {
        // Deterministic per galaxy: building it (planet generation + 70 stars + lanes) on every faction pick cost ~15 ms.
        const key = gid + '|' + color;
        const cache = this._pfxMapCache || (this._pfxMapCache = {});
        if (cache[key]) return cache[key];
        const out = this.buildPfxGalaxyMap(gid, color);
        if (out.nodes) cache[key] = out;                                  // an uncharted galaxy may still be generating: retry next time
        return out;
    },
    /** Builds the other factions' galaxy maps while the browser is idle, so picking them later costs nothing. */
    prewarmPfxMaps() {
        if (this._pfxWarmQueued) return;
        const pcm = typeof planetConfigManager !== 'undefined' ? planetConfigManager : null;
        if (!pcm || !pcm.getFactionMeta) return;
        const todo = this.getFactionIds().filter((f) => {
            const m = pcm.getFactionMeta(f), g = m && pcm.getGalaxy ? pcm.getGalaxy(m.homeGalaxy || 'milky_way') : null;
            return m && !(this._pfxMapCache || {})[(m.homeGalaxy || 'milky_way') + '|' + ((g && g.baseColor) || this.getFactionColor(f))];
        });
        const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 120));
        const next = () => {
            this._pfxWarmQueued = false;
            const f = todo.shift();
            if (!f || !this.overlay) return;
            try {
                const m = pcm.getFactionMeta(f), gid = m.homeGalaxy || 'milky_way', g = pcm.getGalaxy ? pcm.getGalaxy(gid) : null;
                this.pfxGalaxyMap(gid, (g && g.baseColor) || this.getFactionColor(f));
            } catch (e) { /* warm-up only */ }
            if (todo.length) { this._pfxWarmQueued = true; idle(next); }
        };
        this._pfxWarmQueued = true;
        idle(next);
    },
    buildPfxGalaxyMap(gid, color) {
        const pcm = planetConfigManager;
        let map = (pcm.getGalaxyMap && pcm.getGalaxyMap(gid)) || {};
        if (!(map.nodes && map.nodes.length) && pcm.ensureGalaxyArrivalContent) {
            try { pcm.ensureGalaxyArrivalContent(gid, 'start|' + gid, { firstVisit: false }); map = pcm.getGalaxyMap(gid) || map; } catch (e) { /* uncharted */ }
        }
        const W = 360, H = 130, P = 16, nodes = map.nodes || [], pos = {};
        nodes.forEach((n) => { pos[n.planetId] = { x: P + n.x * (W - P * 2), y: P + n.y * (H - P * 2) }; });
        let seed = 0;
        for (const ch of String(gid)) seed = (Math.imul(seed, 31) + ch.charCodeAt(0)) >>> 0;
        const rnd = () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) >>> 8) / 16777216;
        let stars = '';
        for (let i = 0; i < 70; i++) stars += `<rect x="${Math.floor(rnd() * W)}" y="${Math.floor(rnd() * H)}" width="1" height="1" opacity="${(0.25 + rnd() * 0.6).toFixed(2)}"/>`;
        const lanes = (map.edges || []).map((e) => {
            const a = pos[e[0]], b = pos[e[1]];
            if (!a || !b) return '';
            const len = Math.hypot(b.x - a.x, b.y - a.y);
            let d = '';
            for (let t = 8; t < len - 8; t += 5) d += `M${Math.round(a.x + (b.x - a.x) * t / len)} ${Math.round(a.y + (b.y - a.y) * t / len)}h1v1h-1z`;
            return `<path d="${d}"/>`;
        }).join('');
        const dots = nodes.map((n) => {
            const p = pos[n.planetId], start = n.planetId === map.startPlanetId;
            return `<rect x="${Math.round(p.x) - (start ? 3 : 2)}" y="${Math.round(p.y) - (start ? 3 : 2)}" width="${start ? 6 : 4}" height="${start ? 6 : 4}" class="${start ? 'start' : ''}"/>`;
        }).join('');
        return { nodes: nodes.length, start: map.startPlanetId, svg: `<svg class="pfx-map-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" shape-rendering="crispEdges" style="--gx:${color}">` +
            `<g class="stars">${stars}</g><g class="lanes">${lanes}</g><g class="dots">${dots}</g></svg>` };
    },
    renderFactionTabsRich(id, meta) {
        if (!this.overlay || !meta) return;
        const ir = typeof iconRenderer !== 'undefined' ? iconRenderer : null;
        const acc = this.pfxAccent = this.getFactionColor(id);
        const pcm = planetConfigManager;
        const panel = (k) => this.overlay.querySelector(`.profile-faction-tabpanel[data-panel="${k}"]`);
        const emb = (f, s) => this.getFactionEmblemHtml(f, s);

        // LORE: trait chips + the hero above the text.
        const lore = panel('lore');
        if (lore) {
            let head = lore.querySelector('.pfx-lore-head');
            if (!head) { head = document.createElement('div'); head.className = 'pfx-lore-head'; lore.insertBefore(head, lore.firstChild); }
            const hero = meta.hero ? `<span class="pfx-hero">${ir ? ir.imgHtml('menuFactions', 18, '', acc, false) : ''}<b>${meta.hero.name}</b></span>` : '';
            head.innerHTML = `<div class="pfx-chips">${(meta.traits || []).map((t) => `<span class="pfx-chip">${String(t).toUpperCase()}</span>`).join('')}</div>${hero}`;
        }

        // GALAXY: home galaxy, ruler, a live map and the numbers behind it.
        const gid = meta.homeGalaxy || 'milky_way', g = pcm.getGalaxy ? pcm.getGalaxy(gid) : null;
        const gcol = (g && g.baseColor) || acc;
        const gm = this.pfxGalaxyMap(gid, gcol);
        const gname = String((g && g.name) || gid.replace(/_/g, ' ')).toUpperCase();
        const startPlanet = gm.start && pcm.getPlanet ? (pcm.getPlanet(gm.start) || {}).name : '';
        const galaxyKey = { milky_way: 'galaxyMilkyWay', andromeda: 'galaxyAndromeda' }[gid] || 'galaxyDefault';
        const gp = panel('home');
        if (gp) gp.innerHTML = `<div class="pfx pfx-galaxy">
            <div class="pfx-head"><span class="pfx-head-ico">${ir ? ir.imgHtml(galaxyKey, 40, '', gcol, false) : ''}</span>
                <span class="pfx-head-text"><small>HOME GALAXY</small><b>${gname}</b></span>
                <span class="pfx-ruler">${emb(g && g.faction || id, 24)}<small>RULED BY ${this.getFactionLabel(g && g.faction || id)}</small></span></div>
            <div class="pfx-map">${gm.svg}</div>
            <div class="pfx-tiles">${this.pfxTile(ir ? ir.imgHtml('menuGalaxies', 22, '', acc, false) : '', 'PLANETS', gm.nodes || (g && g.planetIds ? g.planetIds.length : '?'))}
                ${this.pfxTile(ir ? ir.imgHtml('menuFactions', 22, '', acc, false) : '', 'START', String(startPlanet || 'ARRIVAL SECTOR').toUpperCase())}
                ${this.pfxTile(ir ? ir.imgHtml('statShield', 22, '', acc, false) : '', 'CONTROL', 'HELD')}</div></div>`;

        this.prewarmPfxMaps();

        // PLAYSTYLE: description, five rating bars, a difficulty line.
        const R = this.FACTION_RATINGS[id] || this.FACTION_RATINGS.terran;
        const sp = panel('style');
        if (sp) sp.innerHTML = `<div class="pfx pfx-style"><p class="pfx-lead">${meta.playstyle || ''}</p>
            <div class="pfx-bars">${this.pfxBar('DAMAGE', 'statDamage', R.damage, 5, R.damage + '/5')}
                ${this.pfxBar('DEFENSE', 'statShield', R.defense, 5, R.defense + '/5')}
                ${this.pfxBar('SPEED', 'statSpeed', R.speed, 5, R.speed + '/5')}
                ${this.pfxBar('EVASION', 'statSpeed', R.evasion, 5, R.evasion + '/5')}
                ${this.pfxBar('ECONOMY', 'resScrap', R.economy, 5, R.economy + '/5')}</div>
            <div class="pfx-foot"><span class="pfx-foot-label">DIFFICULTY</span><b>${R.level}</b></div></div>`;

        // WEAPON: the faction's starting weapon with its numbers + unlockable traits.
        const ids = typeof factionShipStyles !== 'undefined' && factionShipStyles.getFactionDefaultWeapons ? factionShipStyles.getFactionDefaultWeapons(id) : [];
        const wid = ids[0] || 'laser', w = typeof weaponConfigManager !== 'undefined' ? weaponConfigManager.getWeapon(wid) : null;
        const wp = panel('weapon');
        if (wp && w) {
            const rate = 1000 / Math.max(1, w.cooldown), tags = [];
            if (w.pierce) tags.push('PIERCING');
            if ((w.bulletCount || 1) > 1) tags.push((w.bulletCount) + ' SHOTS');
            if (w.spreadAngle) tags.push('SPREAD');
            if (w.waveAmp) tags.push('WAVERING');
            const affinity = (typeof weaponConfigManager !== 'undefined' && weaponConfigManager.getFactionWeaponAffinity)
                ? weaponConfigManager.getFactionWeaponAffinity(id) : [];
            const owned = ids.concat(affinity.filter((x) => ids.indexOf(x) === -1));
            const unlockTracks = (typeof economyConfig !== 'undefined' && economyConfig.itemUpgradeTrackDefs
                && economyConfig.itemUpgradeTrackDefs.weapons)
                ? economyConfig.itemUpgradeTrackDefs.weapons : {};
            const unlockCards = Object.keys(unlockTracks).map((track) => {
                const def = unlockTracks[track];
                if (!def || !def.weaponIds || !def.weaponIds.length) return '';
                const hits = def.weaponIds.filter((x) => owned.indexOf(x) !== -1);
                if (!hits.length) return '';
                const names = hits.map((x) => {
                    const ww = weaponConfigManager.getWeapon ? weaponConfigManager.getWeapon(x) : null;
                    return String((ww && ww.name) || x).replace(/_/g, ' ').toUpperCase();
                }).join(' · ');
                return `<div class="pfx-unlock-card"><span class="pfx-unlock-label">${def.label}</span>` +
                    `<b>${names}</b><small>${def.desc || ''}</small></div>`;
            }).filter(Boolean).join('');
            wp.innerHTML = `<div class="pfx pfx-weapon">
                <div class="pfx-head"><span class="pfx-head-ico">${ir && ir.weaponImgHtml ? ir.weaponImgHtml(wid, 40, '', false) : ''}</span>
                    <span class="pfx-head-text"><small>STARTING WEAPON</small><b>${String(w.name || wid).toUpperCase()}</b></span>
                    <span class="pfx-chips">${tags.map((t) => `<span class="pfx-chip">${t}</span>`).join('')}</span></div>
                <p class="pfx-lead">${meta.weaponNote || w.description || ''}</p>
                <div class="pfx-bars">${this.pfxBar('DAMAGE', 'statDamage', Math.min(5, w.damage / 8), 5, w.damage)}
                    ${this.pfxBar('FIRE RATE', 'statSpeed', Math.min(5, rate), 5, rate.toFixed(1) + '/S')}
                    ${this.pfxBar('PROJECTILE', 'statSpeed', Math.min(5, w.speed / 4), 5, w.speed)}
                    ${this.pfxBar('ENERGY', 'statEnergy', Math.max(1, 5 - w.energyCost / 2), 5, w.energyCost + ' / SHOT')}</div>` +
                (unlockCards ? `<div class="pfx-unlocks"><span class="pfx-group-label">UNLOCKABLE</span>${unlockCards}</div>` : '') +
                `</div>`;
        }

        // ALLIES: who fights beside them and who stands against them.
        const allies = pcm.getFactionAllies ? pcm.getFactionAllies(id) : [];
        const rivals = this.getFactionIds().filter((f) => f !== id && allies.indexOf(f) === -1);
        const card = (f, kind) => {
            const m = pcm.getFactionMeta(f) || {};
            return `<div class="pfx-card ${kind}" style="--fc:${this.getFactionColor(f)}"><span class="pfx-card-emb">${emb(f, 36)}</span>` +
                `<span class="pfx-card-text"><b>${this.getFactionLabel(f)}</b><small>${String((m.traits && m.traits[0]) || '').toUpperCase()}</small></span></div>`;
        };
        const ap = panel('allies');
        if (ap) ap.innerHTML = `<div class="pfx pfx-allies">
            <div class="pfx-group"><span class="pfx-group-label good">ALLIES</span>${allies.length ? `<div class="pfx-cards">${allies.map((f) => card(f, 'ally')).join('')}</div><small class="pfx-note">Fight side by side — their ships never attack each other.</small>` : '<small class="pfx-note">Stands alone against every other faction.</small>'}</div>
            <div class="pfx-group"><span class="pfx-group-label bad">RIVALS</span><div class="pfx-cards">${rivals.map((f) => card(f, 'rival')).join('')}</div></div></div>`;
    }
});
