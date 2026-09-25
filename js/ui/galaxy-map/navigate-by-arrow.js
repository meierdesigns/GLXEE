"use strict";

// GalaxyMapManager methods, split from galaxy-map.js.
extendClass(GalaxyMapManager, {
    navigateByArrow(key) {
        if (!this.selectedPlanetId) return;
        const neighbors = (typeof planetConfigManager !== 'undefined')
            ? planetConfigManager.getGalaxyNeighbors(this.galaxyId, this.selectedPlanetId)
            : [];
        // Allow cursor on locked planets; only require node exists
        const targets = neighbors.filter(n => this.nodeById[n]);
        if (!targets.length) return;

        const cur = this.nodeById[this.selectedPlanetId];
        if (!cur) return;

        let best = null;
        let bestScore = Infinity;
        targets.forEach(nid => {
            const n = this.nodeById[nid];
            const dx = n.x - cur.x;
            const dy = n.y - cur.y;
            let ok = false;
            if (key === 'ArrowLeft' && dx < -0.02) ok = true;
            if (key === 'ArrowRight' && dx > 0.02) ok = true;
            if (key === 'ArrowUp' && dy < -0.02) ok = true;
            if (key === 'ArrowDown' && dy > 0.02) ok = true;
            if (!ok) return;
            const primary = (key === 'ArrowLeft' || key === 'ArrowRight') ? Math.abs(dx) : Math.abs(dy);
            const secondary = (key === 'ArrowLeft' || key === 'ArrowRight') ? Math.abs(dy) : Math.abs(dx);
            const score = secondary * 2 - primary;
            if (score < bestScore) {
                bestScore = score;
                best = nid;
            }
        });

        if (!best && targets.length) {
            bestScore = Infinity;
            targets.forEach(nid => {
                const n = this.nodeById[nid];
                const d = Math.hypot(n.x - cur.x, n.y - cur.y);
                if (d < bestScore) {
                    bestScore = d;
                    best = nid;
                }
            });
        }
        if (best) this.selectPlanet(best);
    },

    selectPlanet(planetId) {
        this.selectedPlanetId = planetId;
        this.syncNodeHighlight();
        this.updateDetails();
        this.syncConfirmButton();
    },

    getStartOptions(planetId) {
        if (typeof profileManager !== 'undefined' && profileManager.getPlanetStartOptions) {
            return profileManager.getPlanetStartOptions(planetId);
        }
        const pid = String(planetId || '').toLowerCase().split('-')[0];
        return {
            canChoose: false,
            startLevelId: pid ? `${pid}-1` : null,
            resumeLevelId: pid ? `${pid}-1` : null,
            resumeLabel: 'STAGE 1'
        };
    },

    renderConfirmActionsHtml(info) {
        const unlocked = !!(info && info.unlocked);
        if (!unlocked) {
            return '<button class="action-button disabled" id="gmConfirm" data-nav-item disabled>LOCKED</button>';
        }
        const opts = this.getStartOptions(info && info.id);
        if (opts.canChoose) {
            return `
                <button class="action-button secondary" id="gmConfirmStart" data-nav-item data-start-mode="start">FROM START</button>
                <button class="action-button" id="gmConfirm" data-nav-item data-start-mode="resume">CONTINUE · ${opts.resumeLabel}</button>
            `;
        }
        return '<button class="action-button" id="gmConfirm" data-nav-item data-start-mode="resume">START MISSION</button>';
    },

    syncConfirmButton() {
        if (!this.overlay) return;
        const actions = this.overlay.querySelector('#gmActions');
        if (!actions) return;
        const info = this.getPlanetInfo(this.selectedPlanetId);
        const backBtn = actions.querySelector('#gmBack');
        const backHtml = backBtn ? backBtn.outerHTML : '';
        actions.innerHTML = this.renderConfirmActionsHtml(info) + (backHtml ? ` ${backHtml}` : '');
        this.bindConfirmActions();
    },

    bindConfirmActions() {
        if (!this.overlay) return;
        const startBtn = this.overlay.querySelector('#gmConfirmStart');
        const confirmBtn = this.overlay.querySelector('#gmConfirm');
        const backBtn = this.overlay.querySelector('#gmBack');
        if (startBtn) {
            startBtn.addEventListener('click', () => this.confirm('start'));
        }
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => {
                const mode = confirmBtn.getAttribute('data-start-mode') || 'resume';
                this.confirm(mode);
            });
        }
        if (backBtn) {
            backBtn.addEventListener('click', () => this.back());
        }
    },

    updateDetails() {
        const info = this.getPlanetInfo(this.selectedPlanetId);
        const set = (id, text) => {
            const el = this.overlay.querySelector('#' + id);
            if (el) el.textContent = text;
        };
        set('gmSectorName', info.name || '—');
        const planetBg = this.overlay.querySelector('.gm-sector-planet-bg');
        if (planetBg) planetBg.innerHTML = this.planetIconHtml(info.id, 240);
        set('gmDiff', info.unlocked ? (info.difficulty || '—') : '???');
        set('gmStages', info.unlocked
            ? (info.cleared
                ? 'CLEARED'
                : (info.stage.highestStage
                    ? (info.stage.highestStage >= 3 ? 'BOSS READY' : `NEXT STAGE ${info.stage.highestStage + 1}`)
                    : 'READY'))
            : 'LOCKED');
        set('gmEnemies', info.unlocked ? String(info.enemyCount) : '???');
        set('gmStatus', info.unlocked ? (info.cleared ? 'CLEARED' : 'OPEN') : 'LOCKED');
        const progressBar = this.overlay.querySelector('.galaxy-map-progress-bar');
        if (progressBar) progressBar.textContent = this.getGalaxyProgressLabel();
    },

    confirm(startMode) {
        const info = this.getPlanetInfo(this.selectedPlanetId);
        if (!info || !info.unlocked) return;
        const mode = startMode === 'start' ? 'start' : 'resume';
        const opts = this.getStartOptions(info.id);
        const levelId = mode === 'start'
            ? (opts.startLevelId || `${info.id}-1`)
            : (opts.resumeLevelId || `${info.id}-1`);
        const cb = this.onConfirm;
        const payload = {
            galaxyId: this.galaxyId,
            planetId: info.id,
            levelId: levelId,
            startMode: mode,
            name: info.name,
            difficulty: info.difficulty,
            description: info.description,
            enemyCount: info.enemyCount,
            obstacleCount: info.obstacleCount,
            reward: info.reward,
            unlocked: true
        };
        const wasEmbedded = !!this._mountEl;
        if (!wasEmbedded) this.hide();
        if (typeof cb === 'function') cb(payload);
    },

    back() {
        const cb = this.onBack;
        this.hide();
        if (typeof cb === 'function') cb();
    },
});
