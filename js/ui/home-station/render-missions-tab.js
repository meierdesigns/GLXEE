"use strict";

// HomeStationUI methods: MISSION LOG tab.
// MAIN QUEST = start-profile story chain. SIDE QUESTS = accepted at stations,
// planets, or the hangar board. Offers depend on where the ship is docked.
extendClass(HomeStationUI, {
    renderMissionsTab(profile) {
        const pm = typeof profileManager !== 'undefined' ? profileManager : null;
        const log = pm && pm.getMissionLog ? pm.getMissionLog(profile) : { main: null, side: [], active: null, currentMain: null };
        const offers = pm && pm.getSideQuestOffers ? pm.getSideQuestOffers(profile) : [];
        const esc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
        const done = Number(profile.missionsCompleted) || 0;
        const active = log.active;
        const kindTag = (k) => {
            const map = { planet: 'PLANET', find_planet: 'LOCATE', station: 'STATION', find_galaxy: 'GALAXY' };
            return map[k] || 'TARGET';
        };
        const targetText = (m) => {
            if (!m) return '';
            if (m.targetKind === 'station') return m.stationName || m.planetName || 'STATION';
            if (m.targetKind === 'find_galaxy') return m.galaxyName || 'UNKNOWN GALAXY';
            return m.planetName || m.objective || (m.planetId || '').toUpperCase();
        };
        const rewardHtml = (reward) => this.renderContractRewards
            ? this.renderContractRewards(reward)
            : (this.renderMissionReward ? this.renderMissionReward(reward) : '');

        // —— MAIN QUEST ——
        let mainHtml = '';
        if (log.main && log.main.missions && log.main.missions.length) {
            const idx = Math.max(0, Number(log.main.missionIndex) || 0);
            const steps = log.main.missions.map((m, i) => {
                const st = m.done || i < idx ? 'done' : (i === idx ? 'active' : 'locked');
                const isFocus = !!(active && active.main && active.storyMissionId === m.id);
                return `<li class="hs-log-step is-${st}${isFocus ? ' is-focus' : ''}" title="${esc(m.hint || m.objective || '')}">` +
                    `<span class="hs-log-step-idx">${i + 1}</span>` +
                    `<span class="hs-log-step-body">` +
                    `<b>${esc(m.name)}</b>` +
                    `<small>${kindTag(m.targetKind)} · ${esc(targetText(m))}</small>` +
                    `</span>` +
                    `<span class="hs-log-step-diff">${esc(String(m.difficulty || '').toUpperCase())}</span>` +
                    `</li>`;
            }).join('');
            const cur = log.currentMain;
            const trackBtn = cur && !(active && active.main)
                ? `<button type="button" class="action-button hs-line-action" data-log-track-main data-nav-item title="Track main quest">TRACK</button>`
                : (cur ? `<span class="hs-mi is-on" title="Tracking">${this.iconHtml('navFlag', 24, 'hs-pixel', false)}</span>` : '');
            mainHtml = `<section class="hs-log-block hs-log-main">` +
                `<header class="hs-log-head">` +
                `<span class="hs-log-badge">MAIN QUEST</span>` +
                `<strong class="hs-log-title">${esc(log.main.title)}</strong>` +
                `${trackBtn}` +
                `</header>` +
                (log.main.blurb ? `<p class="hs-muted hs-log-blurb">${esc(log.main.blurb)}</p>` : '') +
                (cur && cur.objective ? `<p class="hs-log-objective"><b>OBJECTIVE</b> ${esc(cur.objective)}</p>` : '') +
                (cur && cur.hint ? `<p class="hs-muted hs-log-hint">${esc(cur.hint)}</p>` : '') +
                `<ol class="hs-log-steps">${steps}</ol>` +
                `</section>`;
        } else {
            mainHtml = `<section class="hs-log-block hs-log-main">` +
                `<header class="hs-log-head"><span class="hs-log-badge">MAIN QUEST</span><strong class="hs-log-title">NONE</strong></header>` +
                `<p class="hs-muted">No story path on this pilot — start a new profile to pick one.</p></section>`;
        }

        // —— SIDE QUESTS (accepted) ——
        const sideRows = (log.side || []).map((s) => {
            const isFocus = !!(active && active.sideId === s.id);
            return `<div class="hs-line hs-log-side${isFocus ? ' is-active' : ''}">` +
                `<span class="hs-line-name">` +
                `<span class="hs-mission-type">${esc(String(s.type || 'SIDE').toUpperCase())}</span>` +
                `<strong class="hs-mission-goal">${esc(s.name)}</strong>` +
                `<small class="hs-muted">${kindTag(s.targetKind)} · ${esc(targetText(s))} · via ${esc(s.sourceName || s.source || '')}</small>` +
                `</span>` +
                `<span class="hs-mission-reward">${rewardHtml(s.reward)}</span>` +
                `<span class="hs-mission-actions">` +
                (isFocus
                    ? `<span class="hs-mi is-on" title="Tracking">${this.iconHtml('navFlag', 24, 'hs-pixel', false)}</span>`
                    : `<button type="button" class="action-button hs-line-action" data-log-track-side="${esc(s.id)}" data-nav-item title="Track">TRACK</button>`) +
                `<button type="button" class="action-button secondary hs-line-action" data-log-abandon-side="${esc(s.id)}" data-nav-item title="Abandon">${this.iconHtml('navDoor', 24, 'hs-pixel', false)}</button>` +
                `</span></div>`;
        }).join('');

        const sideHtml = `<section class="hs-log-block hs-log-sidequests">` +
            `<header class="hs-log-head"><span class="hs-log-badge">SIDE QUESTS</span>` +
            `<strong class="hs-log-title">${(log.side || []).length}/5</strong></header>` +
            `<div class="hs-mission-list">${sideRows || this.emptyHtml('navScroll', 'NO SIDE QUESTS ACCEPTED')}</div>` +
            `</section>`;

        // —— OFFERS at current location ——
        const loc = pm && pm.getShipLocation ? pm.getShipLocation(pm.getCurrentGalaxyId(profile), profile) : null;
        const locLabel = loc
            ? (loc.kind === 'post' ? 'STATION' : 'PLANET') + ' OFFERS'
            : 'BOARD OFFERS';
        const offerRows = offers.map((o) =>
            `<div class="hs-line hs-log-offer">` +
            `<span class="hs-line-name">` +
            `<span class="hs-mission-type">${esc(String(o.type || 'SIDE').toUpperCase())}</span>` +
            `<strong class="hs-mission-goal">${esc(o.name)}</strong>` +
            `<small class="hs-muted">${kindTag(o.targetKind)} · ${esc(targetText(o))} · ${esc(o.sourceName || '')}</small>` +
            `</span>` +
            `<span class="hs-mission-reward">${rewardHtml(o.reward)}</span>` +
            `<span class="hs-mission-actions">` +
            `<button type="button" class="action-button hs-line-action" data-log-accept="${esc(o.id)}" data-nav-item title="Accept sidequest">ACCEPT</button>` +
            `</span></div>`
        ).join('');

        const offersHtml = `<section class="hs-log-block hs-log-offers">` +
            `<header class="hs-log-head"><span class="hs-log-badge">${esc(locLabel)}</span>` +
            `<strong class="hs-log-title">AVAILABLE</strong></header>` +
            `<p class="hs-muted hs-hint">Accept sidequests here, at docked stations, or on planets. Main quest stays in the log.</p>` +
            `<div class="hs-mission-list">${offerRows || this.emptyHtml('navScroll', 'NO OFFERS HERE')}</div>` +
            `</section>`;

        return `<div class="hs-section hs-panel hs-missions-root hs-mission-log">` +
            `${this.panelTitle('hsExplore', 'MISSION LOG')}` +
            `<p class="hs-muted hs-hint">Main quest from your start profile · sidequests at stations &amp; planets · ${done} completed.</p>` +
            `<div class="hs-tab-fill hs-log-body">${mainHtml}${sideHtml}${offersHtml}</div>` +
            `</div>`;
    },

    /** Bounty chips (+amount), not a cost grid — nothing here is "short". */
    renderMissionReward(reward, iconSize) {
        return `<span class="hs-cost-grid hs-mission-bounty">` + Object.keys(reward || {}).map((id) =>
            `<span class="hs-cost-cell hs-res-${id}" title="${String(id).toUpperCase()}">` +
            `<span class="hs-cost-icon">${this.iconHtml(this.resourceIconKey(id), iconSize || 20, 'hs-pixel hs-pixel-' + (iconSize || 20))}</span>` +
            `<span class="hs-cost-amt">+${reward[id]}</span></span>`
        ).join('') + `</span>`;
    },

    bindMissionEvents() {
        if (!this.overlay || typeof profileManager === 'undefined') return;
        const pm = profileManager;
        this.overlay.querySelectorAll('[data-log-accept]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const res = pm.acceptSideQuest(btn.getAttribute('data-log-accept'));
                if (!res || res.ok === false) {
                    this.playButtonResult(btn, false, (res && res.reason) || 'NOT AVAILABLE');
                    return;
                }
                this.statusMsg = 'SIDE QUEST ACCEPTED';
                this.createUI();
            });
        });
        this.overlay.querySelectorAll('[data-log-abandon-side]').forEach((btn) => {
            btn.addEventListener('click', () => {
                pm.abandonSideQuest(btn.getAttribute('data-log-abandon-side'));
                this.statusMsg = 'SIDE QUEST ABANDONED';
                this.createUI();
            });
        });
        this.overlay.querySelectorAll('[data-log-track-main]').forEach((btn) => {
            btn.addEventListener('click', () => {
                pm.trackMainQuest();
                this.statusMsg = 'MAIN QUEST TRACKED';
                this.createUI();
            });
        });
        this.overlay.querySelectorAll('[data-log-track-side]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-log-track-side');
                const log = pm.getMissionLog();
                const entry = (log.side || []).find((s) => s.id === id);
                if (entry) pm.focusMission(entry, { side: true });
                pm.save();
                this.statusMsg = 'SIDE QUEST TRACKED';
                this.createUI();
            });
        });
    },
});
