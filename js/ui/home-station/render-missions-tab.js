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
            const action = m.active
                ? `<button type="button" class="action-button hs-line-action" data-mission-launch="${m.planetId}" data-nav-item>LAUNCH</button>` +
                  `<button type="button" class="action-button secondary hs-line-action" data-mission-abandon data-nav-item>ABANDON</button>`
                : `<button type="button" class="action-button hs-line-action" data-mission-accept="${m.planetId}" data-nav-item${locked ? ' disabled' : ''}>` +
                  `${locked ? 'LOCKED' : 'ACCEPT &amp; LAUNCH'}</button>`;
            return `<div class="hs-line hs-mission is-${m.status}${m.active ? ' is-active' : ''}">` +
                `<span class="hs-line-name">` +
                `<span class="hs-mission-type">${m.type}</span>` +
                `<strong>${esc(m.name)}</strong>` +
                `<small class="hs-mission-meta">${m.difficulty}${stages ? ' · ' + stages : ''}${m.active ? ' · ACTIVE' : ''}</small>` +
                `</span>` +
                `<span class="hs-mission-reward" title="Bounty paid when a stage on ${esc(m.name)} is cleared">` +
                `${locked ? '<span class="hs-muted">—</span>' : this.renderMissionReward(m.reward)}</span>` +
                `<span class="hs-mission-actions">${action}</span>` +
                `</div>`;
        }).join('');
        return `<div class="hs-section hs-panel hs-missions-root">` +
            `${this.panelTitle('hsExplore', 'MISSION BOARD')}` +
            `<p class="hs-muted hs-hint">Contracts in your current galaxy. LIBERATE pays the full bounty, PATROL a cleared planet pays half. ` +
            `The bounty is paid when you clear a stage on the target planet · ${done} completed.</p>` +
            `<div class="hs-tab-fill hs-mission-list">${rows || '<p class="hs-muted hs-empty-slot">NO CONTRACTS IN THIS GALAXY</p>'}</div>` +
            `</div>`;
    },

    /** Bounty chips (+amount), not a cost grid — nothing here is "short". */
    renderMissionReward(reward) {
        return `<span class="hs-cost-grid hs-mission-bounty">` + Object.keys(reward || {}).map((id) =>
            `<span class="hs-cost-cell hs-res-${id}" title="${String(id).toUpperCase()}">` +
            `<span class="hs-cost-icon">${this.iconHtml(this.resourceIconKey(id), 20, 'hs-pixel hs-pixel-20')}</span>` +
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
