"use strict";

// ProfileSelectionManager members, continued from core-part2.js: start galaxy card and preferred weapon.
/** Map height (viewBox units, width is 560) of the wizard's start-galaxy card: the step has the whole content area to itself. */
const GALAXY_MAP_H = 420;

extendClass(ProfileSelectionManager, {
    /**
     * Galaxies the pending faction can start in: the ones it populates (ruler or rival), home first, then those it rules before
     * contested ones. The current pick is always kept so a freshly generated galaxy never vanishes from the list.
     */
    getStartGalaxyIds(faction, current) {
        const pcm = typeof planetConfigManager !== 'undefined' ? planetConfigManager : null;
        if (!pcm || !pcm.getGalaxyIds) return ['milky_way'];
        const meta = pcm.getFactionMeta ? pcm.getFactionMeta(faction) : null;
        const home = (meta && meta.homeGalaxy) || 'milky_way';
        const rank = (gid) => {
            const c = pcm.getGalaxyControl ? pcm.getGalaxyControl(gid) : null;
            return gid === home ? 0 : (c && c.main === faction ? 1 : 2);
        };
        const ids = pcm.getGalaxyIds().filter((gid) => {
            if (gid === home || gid === current) return true;
            const c = pcm.getGalaxyControl ? pcm.getGalaxyControl(gid) : null;
            return !c || (c.factions || []).some((f) => f.id === faction);
        });
        return ids.map((gid, i) => [gid, i]).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map((e) => e[0]);
    },
    /** Left column of the wizard's galaxy card: the start galaxies with ruler emblem, rivals and the warp level needed from home. */
    renderStartGalaxyListHtml(selected, home) {
        const pcm = planetConfigManager;
        const emblem = (f, size) => (f && this.getFactionEmblemHtml ? this.getFactionEmblemHtml(f, size) : '');
        const items = this.getStartGalaxyIds(this.pendingFaction, selected).map((gid) => {
            const g = pcm.getGalaxy(gid);
            const c = pcm.getGalaxyControl ? pcm.getGalaxyControl(gid) : null;
            const ruler = (c && c.main) || (g && g.faction);
            const rivals = c && c.control === 'contested' ? c.rivals : [];
            const warp = gid !== home && typeof economyConfig !== 'undefined' && economyConfig.getGalaxyWarpRequirement
                ? economyConfig.getGalaxyWarpRequirement(gid, home) : 0;
            const tag = gid === home ? '<span class="tag is-home">★ HOME</span>' : (warp > 0 ? `<span class="tag" title="Warp drive level needed to reach it from home">WARP ${warp}</span>` : '');
            const sel = gid === selected;
            return `<li role="option" aria-selected="${sel}" class="${sel ? 'selected' : ''}" data-galaxy-id="${gid}"` +
                ` title="${String(ruler || '').toUpperCase()}${rivals.length ? ' · CONTESTED' : ''}">` +
                `<span class="ruler">${emblem(ruler, 20)}</span>` +
                `<span class="name">${String((g && g.name) || gid).toUpperCase()}</span>` +
                (rivals.length ? `<span class="rivals">${rivals.map((f) => emblem(f, 12)).join('')}</span>` : '') + tag +
                `</li>`;
        }).join('');
        return `<ul class="profile-start-galaxy-side" role="listbox" aria-label="Start galaxies">${items}</ul>`;
    },
    /** Start galaxy card: ‹ mini map · name · ruler · planets › (cycled with the arrows). */
    renderStartGalaxyCardHtml(gid, home, mapH) {
        const pcm = typeof planetConfigManager !== 'undefined' ? planetConfigManager : null;
        const g = pcm && pcm.getGalaxy ? pcm.getGalaxy(gid) : null;
        const name = String((g && g.name) || gid).toUpperCase();
        let map = (pcm && pcm.getGalaxyMap && pcm.getGalaxyMap(gid)) || {};
        // Uncharted galaxy: chart its arrival sector now (galaxy maps are
        // shared, and generation is idempotent), so the preview shows the real
        // layout the pilot will start on.
        if (!(map.nodes && map.nodes.length) && pcm && pcm.ensureGalaxyArrivalContent) {
            try {
                pcm.ensureGalaxyArrivalContent(gid, 'start|' + gid, { firstVisit: false });
                map = pcm.getGalaxyMap(gid) || map;
            } catch (e) { /* keep the spiral placeholder */ }
        }
        const nodes = map.nodes || [];
        const color = (g && g.baseColor) || 'var(--faction-accent, var(--color-primary))';
        const W = 560;
        const H = mapH || 220;   // the pilot wizard passes a taller map (GALAXY_MAP_H) so the step fills its screen
        const P = 20;
        const pos = {};
        nodes.forEach((n) => { pos[n.planetId] = { x: P + n.x * (W - P * 2), y: P + n.y * (H - P * 2) }; });
        const edges = (map.edges || []).map((e) => {
            const a = pos[e[0]];
            const b = pos[e[1]];
            if (!a || !b) return '';
            // Dotted pixel lane instead of a hairline.
            const len = Math.hypot(b.x - a.x, b.y - a.y);
            let d = '';
            for (let t = 14; t < len - 14; t += 6) {
                const x = Math.round(a.x + (b.x - a.x) * t / len);
                const y = Math.round(a.y + (b.y - a.y) * t / len);
                d += `M${x - 1} ${y - 1}h2v2h-2z`;
            }
            return `<path d="${d}"/>`;
        }).join('');
        // Seeded backdrop: star field + nebula dust in the galaxy colour.
        let seed = 0;
        for (const ch of String(gid)) seed = (Math.imul(seed, 31) + ch.charCodeAt(0)) >>> 0;
        const rnd = () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) >>> 8) / 16777216;
        let stars = '';
        for (let i = 0; i < 110; i++) {
            const sz = rnd() < 0.12 ? 2 : 1;
            stars += `<rect x="${Math.floor(rnd() * W)}" y="${Math.floor(rnd() * H)}" width="${sz}" height="${sz}" opacity="${(0.25 + rnd() * 0.6).toFixed(2)}"/>`;
        }
        let dust = '';
        for (let c = 0; c < 4; c++) {
            const cx = rnd() * W;
            const cy = rnd() * H;
            const rr = 30 + rnd() * 50;
            for (let i = 0; i < 70; i++) {
                const a = rnd() * Math.PI * 2;
                const d = Math.pow(rnd(), 0.7) * rr;
                const x = Math.floor((cx + Math.cos(a) * d * 1.6) / 4) * 4;
                const y = Math.floor((cy + Math.sin(a) * d) / 4) * 4;
                dust += `<rect x="${x}" y="${y}" width="4" height="4" opacity="${(0.05 + (1 - d / rr) * 0.18).toFixed(2)}"/>`;
            }
        }
        // Uncharted galaxy (no map until its first visit): a pixel spiral
        // in the galaxy colour stands in for the real layout.
        let spiral = '';
        if (!nodes.length) {
            const cx = W / 2;
            const cy = H / 2;
            for (let arm = 0; arm < 2; arm++) {
                for (let i = 0; i < 26; i++) {
                    const t = i / 26;
                    const ang = arm * Math.PI + t * Math.PI * 2.4;
                    const rad = 6 + t * (H * 0.46);
                    const x = Math.round(cx + Math.cos(ang) * rad * 1.9);
                    const y = Math.round(cy + Math.sin(ang) * rad * 0.8);
                    const sz = t < 0.25 ? 4 : (t < 0.7 ? 3 : 2);
                    spiral += `<rect x="${x}" y="${y}" width="${sz}" height="${sz}" opacity="${(1 - t * 0.7).toFixed(2)}"/>`;
                }
            }
            spiral += `<rect x="${cx - 5}" y="${cy - 5}" width="10" height="10" class="is-start"/>`;
        }
        const gm = typeof galaxyMapManager !== 'undefined' && galaxyMapManager.planetIconHtml ? galaxyMapManager : null;
        const dots = nodes.map((n) => {
            const q = pos[n.planetId];
            const start = n.planetId === map.startPlanetId;
            const sz = start ? 34 : 26;
            // Start planet: pixel corner brackets.
            const b = sz / 2 + 4;
            const br = start ? `<path class="start-bracket" d="M${q.x - b} ${q.y - b}h6v2h-4v4h-2zM${q.x + b} ${q.y - b}h-6v2h4v4h2zM${q.x - b} ${q.y + b}h6v-2h-4v-4h-2zM${q.x + b} ${q.y + b}h-6v-2h4v-4h2z"/>` : '';
            const icon = gm
                ? `<foreignObject x="${q.x - sz / 2}" y="${q.y - sz / 2}" width="${sz}" height="${sz}"><div xmlns="http://www.w3.org/1999/xhtml" class="profile-start-planet">${gm.planetIconHtml(n.planetId, sz, true)}</div></foreignObject>`
                : `<rect x="${q.x - 4}" y="${q.y - 4}" width="8" height="8"${start ? ' class="is-start"' : ''}/>`;
            return icon + br;
        }).join('');
        const control = pcm && pcm.getGalaxyControl ? pcm.getGalaxyControl(gid) : null;
        const ruler = control && control.main;
        const crest = ruler && this.getFactionEmblemHtml ? this.getFactionEmblemHtml(ruler, 48) : '';
        const state = control ? (control.control === 'contested' ? 'CONTESTED' : 'HELD') : '';
        return `
            ${mapH ? '' : '<button type="button" class="profile-start-galaxy-nav" data-galaxy-step="-1" tabindex="-1" aria-label="Previous galaxy">‹</button>'}
            ${mapH ? this.renderStartGalaxyListHtml(gid, home) : ''}
            <svg class="profile-start-galaxy-map" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="--galaxy-color:${color};aspect-ratio:${W} / ${H}" shape-rendering="crispEdges" aria-hidden="true">
                <g class="dust">${dust}</g><g class="stars">${stars}</g>
                <g class="suns">${nodes.length && pcm.getGalaxySuns ? pcm.getGalaxySuns(gid).map((sun) => {
                    const sx = Math.round(P + sun.x * (W - P * 2));
                    const sy = Math.round(P + sun.y * (H - P * 2));
                    const sr = Math.max(10, Math.round(sun.r * W * 0.55));
                    return `<rect x="${sx - sr * 2}" y="${sy - sr * 2}" width="${sr * 4}" height="${sr * 4}" rx="${sr * 2}" fill="${sun.glow}" opacity="0.18"/>` +
                        `<rect x="${sx - sr}" y="${sy - sr}" width="${sr * 2}" height="${sr * 2}" rx="${sr}" fill="${sun.color}"/>`;
                }).join('') : ''}</g>
                <g class="edges">${edges}</g><g class="dots">${dots}${spiral}</g>
            </svg>
            <div class="profile-start-galaxy-info">
                <button type="button" class="profile-start-galaxy-pick" data-galaxy-pick tabindex="-1" aria-haspopup="listbox" title="Choose a galaxy">
                    ${crest ? `<span class="profile-start-galaxy-crest" title="${String(ruler).toUpperCase()}">${crest}</span>` : ''}<strong class="profile-start-galaxy-name">${name}</strong><span class="profile-start-galaxy-caret">▾</span>
                </button>
                ${gid === home ? '<span class="profile-start-galaxy-home" title="Faction home galaxy">★ HOME</span>' : ''}
                ${ruler ? `<span class="profile-start-galaxy-ruler"><span>${String(ruler).toUpperCase()} · ${state}</span></span>` : ''}
                <span class="profile-start-galaxy-meta">${nodes.length
                    ? nodes.length + ' PLANETS · START ' + String(map.startPlanetId || '—').toUpperCase()
                    : 'UNCHARTED · ARRIVAL SECTOR CHARTED ON START'}</span>
                <button type="button" class="profile-start-galaxy-new" data-galaxy-new tabindex="-1" title="Create a new galaxy (N)">+ NEW GALAXY</button>
            </div>
            ${mapH ? '' : '<button type="button" class="profile-start-galaxy-nav" data-galaxy-step="1" tabindex="-1" aria-label="Next galaxy">›</button>'}
            ${mapH ? `<div class="profile-start-galaxy-navrow">
                <button type="button" class="profile-start-galaxy-nav" data-galaxy-step="-1" tabindex="-1" aria-label="Previous galaxy">${ProfileSelectionManager.btnIconHtml('back')}${ProfileSelectionManager.stepIconHtml('galaxy')}<span>PREV</span></button>
                <button type="button" class="profile-start-galaxy-nav" data-galaxy-step="1" tabindex="-1" aria-label="Next galaxy"><span>NEXT</span>${ProfileSelectionManager.stepIconHtml('galaxy')}${ProfileSelectionManager.btnIconHtml('next')}</button>
            </div>` : ''}`;
    },
    /** Preferred weapon of the pending faction as an icon + name (name step). */
    renderPreferredWeaponHtml() {
        const ids = (typeof factionShipStyles !== 'undefined' && factionShipStyles.getFactionDefaultWeapons)
            ? factionShipStyles.getFactionDefaultWeapons(this.pendingFaction) : ['laser'];
        const id = ids[0] || 'laser';
        const w = typeof weaponConfigManager !== 'undefined' && weaponConfigManager.getWeapon ? weaponConfigManager.getWeapon(id) : null;
        const icon = typeof iconRenderer !== 'undefined' && iconRenderer.weaponImgHtml
            ? iconRenderer.weaponImgHtml(id, 32, 'profile-weapon-icon-img') : '';
        return `<span class="profile-faction-preview-weapon" title="Preferred weapon">` +
            `<span class="profile-faction-preview-weapon-icon">${icon}</span>` +
            `<span>${String((w && w.name) || id).toUpperCase()}</span></span>`;
    },
});
