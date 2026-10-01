"use strict";

// Victory / defeat screens: the planet that was fought on (icon, name,
// galaxy) and a stepper of its stages (1..N + BOSS) — cleared ones checked,
// the one just fought marked WON or LOST, later ones locked.
extendClass(GameControlSystem, {
    renderOutcomeStepperHtml(result) {
        const level = this.coreLevelManager && this.coreLevelManager.getCurrentLevel
            ? this.coreLevelManager.getCurrentLevel() : null;
        if (!level) return '';
        const pid = String(level.planetId || (level.id && String(level.id).split('-')[0]) || '').toLowerCase();
        if (!pid) return '';
        const pcm = typeof planetConfigManager !== 'undefined' ? planetConfigManager : null;
        const cfg = pcm && pcm.getConfig ? pcm.getConfig(pid) : null;
        const gid = pcm && (pcm.getWorldGalaxyOfPlanet ? pcm.getWorldGalaxyOfPlanet(pid) : pcm.getPlanetGalaxyId(pid));
        const galaxy = gid && pcm.getGalaxy ? pcm.getGalaxy(gid) : null;
        const icon = typeof galaxyMapManager !== 'undefined' && galaxyMapManager.planetIconHtml
            ? galaxyMapManager.planetIconHtml(pid, 56, true) : '';
        const name = String(level.planetName || (cfg && cfg.name) || pid).toUpperCase();
        const isAmbush = pid.indexOf('ambush_') === 0;

        let steps = '';
        if (!isAmbush) {
            const n = Math.max(1, Math.round(Number(level.stagesPerPlanet) || (typeof getPlanetStageCount === 'function' ? getPlanetStageCount(pid) : 3)));
            const p = typeof profileManager !== 'undefined' && profileManager.getActiveProfile
                ? profileManager.getActiveProfile() : null;
            const gp = p && gid && profileManager.ensureGalaxyProgress ? profileManager.ensureGalaxyProgress(p, gid) : null;
            const st = (gp && gp.stages && gp.stages[pid]) || { highestStage: 0, bossCleared: false };
            const current = level.isBoss ? n + 1 : Math.max(1, Number(level.stageIndex) || 1);
            const list = [];
            for (let i = 1; i <= n + 1; i++) {
                const boss = i === n + 1;
                const done = boss ? !!st.bossCleared : i <= (st.highestStage || 0);
                let state = done ? 'done' : 'locked';
                if (i === current) state = result === 'won' ? 'won' : 'lost';
                const mark = state === 'won' || state === 'done' ? '✓' : (state === 'lost' ? '✕' : (boss ? '☠' : String(i)));
                list.push(`<li class="outcome-step is-${state}${boss ? ' is-boss' : ''}" title="${boss ? 'BOSS' : 'STAGE ' + i}">` +
                    `<span class="outcome-step-dot">${mark}</span></li>`);
            }
            const which = level.isBoss ? 'BOSS' : 'STAGE ' + current + '/' + (n + 1);
            steps = `<ol class="outcome-stepper">${list.join('')}</ol>` +
                `<p class="outcome-status">${which} ${result === 'won' ? 'CLEARED' : 'FAILED'}</p>`;
        }
        return `<div class="outcome-planet">` +
            `<span class="outcome-planet-icon">${icon}</span>` +
            `<span class="outcome-planet-text"><strong>${name}</strong>` +
            `<span>${galaxy ? String(galaxy.name || gid).toUpperCase() : ''}${isAmbush ? ' · AMBUSH' : ''}</span></span>` +
            `</div>${steps}`;
    },

    /** Puts / refreshes the stepper block right after `anchor`. */
    applyOutcomeStepper(anchor, result) {
        if (!anchor || !anchor.parentNode) return;
        let box = anchor.parentNode.querySelector(':scope > .outcome-progress');
        if (!box) {
            box = document.createElement('div');
            box.className = 'outcome-progress';
            anchor.insertAdjacentElement('afterend', box);
        }
        box.dataset.result = result;
        box.innerHTML = this.renderOutcomeStepperHtml(result);
        box.hidden = !box.innerHTML;
    }
});
