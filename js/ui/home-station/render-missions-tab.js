"use strict";

// HomeStationUI methods: the MISSIONS tab (hangar area, before CRAFT).
// Lists the current galaxy's planets as contracts; ACCEPT & LAUNCH makes one
// the active mission and starts it right away, the bounty is paid when a
// stage on that planet is cleared.
extendClass(HomeStationUI, {
    renderMissionsTab(profile) {
        const board = (typeof profileManager !== 'undefined' && profileManager.getMissionBoard)
            ? profileManager.getMissionBoard(profile) : [];
        const esc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
        const done = Number(profile.missionsCompleted) || 0;
        const rows = board.map((m) => {
            const locked = m.status === 'locked';
            const stages = m.stagesTotal ? `${Math.min(m.stagesDone, m.stagesTotal)}/${m.stagesTotal} STAGES` : '';
            const ico = (key) => `<span class="hs-go-ico">${this.iconHtml(key, 24, 'hs-pixel', false)}</span>`;
            const action = m.active
                ? `<button type="button" class="action-button hs-line-action hs-mission-go" data-mission-launch="${m.planetId}" data-nav-item title="Launch" aria-label="Launch">${ico('navRocket')}</button>` +
                  `<button type="button" class="action-button secondary hs-line-action hs-mission-abort" data-mission-abandon data-nav-item title="Abandon" aria-label="Abandon">${ico('navDoor')}</button>`
                : `<button type="button" class="action-button hs-line-action hs-mission-go${locked ? ' is-locked' : ''}" data-mission-accept="${m.planetId}" data-nav-item title="${locked ? 'Locked' : 'Launch'}" aria-label="${locked ? 'Locked' : 'Launch'}"${locked ? ' disabled' : ''}>` +
                  `${ico(locked ? 'navLock' : 'navRocket')}</button>`;
            // Who sends you (your faction) and whose hold the planet weakens (the hostile faction fought there).
            const pcm = typeof planetConfigManager !== 'undefined' ? planetConfigManager : null;
            const fss = typeof factionShipStyles !== 'undefined' ? factionShipStyles : null;
            const giver = pcm && pcm.getPlayerFaction ? pcm.getPlayerFaction() : '';
            const hostile = pcm && pcm.getHostileFactions ? (pcm.getHostileFactions(m.planetId) || []) : [];
            const chip = (fid, cls) => {
                const st = fss && fss.getFactionStyle ? fss.getFactionStyle(fid) : null;
                return `<span class="hs-mission-fac ${cls}" style="--fac:${(st && st.accent) || 'var(--color-primary)'}">` +
                    `${this.factionEmblemHtml({ faction: fid }, 24)}<b>${this.factionLabel(fid)}</b></span>`;
            };
            const shipCls = (fss && fss.classes && fss.classes[0]) || 'fighter';
            const foes = hostile.slice(0, 2).map((f) => {
                const src = this.factionShipSrcHd(f, shipCls, 8);
                return `<span class="hs-mission-foe" title="Enemy: ${esc(this.factionLabel(f))}">${src ? `<img src="${src}" alt="">` : this.factionEmblemHtml({ faction: f }, 40)}</span>`;
            }).join('');
            const planetIcon = (typeof galaxyMapManager !== 'undefined' && galaxyMapManager.planetIconHtml)
                ? galaxyMapManager.planetIconHtml(m.planetId, 72, true) : this.iconHtml('menuPlanets', 48, 'hs-pixel', false);
            const crest = giver ? `<span class="hs-mi-crest">${this.factionEmblemHtml({ faction: giver }, 22)}</span>` : '';
            const total = Number(m.stagesTotal) || 0;
            const got = Math.min(Number(m.stagesDone) || 0, total);
            const pips = total ? `<span class="hs-mission-pips" aria-hidden="true">` +
                Array.from({ length: total }, (_, i) => `<i class="${i < got ? 'on' : ''}"></i>`).join('') + `</span>` : '';
            return `<div class="hs-line hs-mission is-${m.status}${m.active ? ' is-active' : ''}">` +
                `<span class="hs-mission-icons-l" title="${esc(m.name)}"><span class="hs-mi-planet">${planetIcon}</span>${crest}</span>` +
                `<span class="hs-line-name">` +
                `<span class="hs-mission-type">${m.type}</span>` +
                `<strong class="hs-mission-goal">${esc(m.name)}</strong>` +
                `</span>` +
                `<span class="hs-mission-foe-wrap">${foes}</span>` +
                `<span class="hs-mission-info hs-mission-icons">` +
                `<span class="hs-mi" title="Difficulty: ${esc(m.difficulty)}">${this.iconHtml('navCrosshair', 24, 'hs-pixel', false)}</span>` +
                (total ? `<span class="hs-mission-stages" title="${got}/${total} stages cleared">${pips}<b>${got}/${total}</b></span>` : '') +
                (m.active ? `<span class="hs-mi is-on" title="Active mission">${this.iconHtml('navFlag', 24, 'hs-pixel', false)}</span>` : '') +
                `</span>` +
                `<span class="hs-mission-reward" title="Bounty paid when a stage on ${esc(m.name)} is cleared">` +
                `${locked ? '<span class="hs-muted">—</span>' : this.renderContractRewards(m.reward)}</span>` +
                `<span class="hs-mission-actions">${action}</span>` +
                `</div>`;
        }).join('');
        return `<div class="hs-section hs-panel hs-missions-root hs-faction-contracts">` +
            `${this.panelTitle('hsExplore', 'MISSION BOARD')}` +
            `<p class="hs-muted hs-hint">Contracts in your current galaxy. LIBERATE pays the full bounty, PATROL a cleared planet pays half. ` +
            `The bounty is paid when you clear a stage on the target planet · ${done} completed.</p>` +
            `<div class="hs-tab-fill hs-mission-list">${rows || this.emptyHtml('navScroll', 'NO CONTRACTS IN THIS GALAXY')}</div>` +
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
        const launch = (planetId) => {
            const m = profileManager.getMissionBoard().find((x) => x.planetId === planetId);
            if (!m) return;
            this.startMission({ planetId: m.planetId, id: m.planetId, name: m.name });
        };
        this.overlay.querySelectorAll('[data-mission-accept]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const pid = btn.getAttribute('data-mission-accept');
                if (!profileManager.acceptMission(pid)) {
                    this.playButtonResult(btn, false, 'NOT AVAILABLE');
                    return;
                }
                launch(pid);
            });
        });
        this.overlay.querySelectorAll('[data-mission-launch]').forEach((btn) => {
            btn.addEventListener('click', () => launch(btn.getAttribute('data-mission-launch')));
        });
        this.overlay.querySelectorAll('[data-mission-abandon]').forEach((btn) => {
            btn.addEventListener('click', () => {
                profileManager.abandonMission();
                this.statusMsg = 'MISSION ABANDONED';
                this.createUI();
            });
        });
    },
});
