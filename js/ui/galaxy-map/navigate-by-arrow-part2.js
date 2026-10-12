"use strict";

// GalaxyMapManager members, continued from navigate-by-arrow.js (kept under ~500 lines per file).
extendClass(GalaxyMapManager, {
    updateDetails() {
        if (!this.overlay) return;
        const info = this.getPlanetInfo(this.selectedPlanetId);
        const set = (id, text) => {
            const el = this.overlay.querySelector('#' + id);
            if (el) el.textContent = text;
        };
        const border = this.selectedBorder;
        if (border) {
            const nm = (id) => String((this.getPlanetInfo(id) || {}).name || id).toUpperCase();
            set('gmSectorName', 'BORDER CHECKPOINT');
            const bg = this.overlay.querySelector('.gm-sector-planet-bg');
            if (bg) {
                bg.innerHTML = this.borderCardSvg(border.open);
                bg.classList.remove('has-atmo');
            }
            const holdings = profileManager.getFactionHoldings ? profileManager.getFactionHoldings(this.galaxyId) : null;
            const fac = this.overlay.querySelector('#gmFaction');
            if (fac) fac.innerHTML = holdings && holdings.ruler ? this.factionLabelHtml(holdings.ruler) : '—';
            set('gmDiffLabel', 'Route');
            set('gmDiff', nm(border.open) + ' → ' + nm(border.shut));
            set('gmStagesLabel', 'Beyond');
            set('gmStages', nm(border.shut) + ' (LOCKED)');
            set('gmEnemiesLabel', 'To open');
            set('gmEnemies', 'CLEAR ' + nm(border.open));
            set('gmStatusLabel', 'Status');
            set('gmStatus', 'SEALED');
            const bStepper = this.overlay.querySelector('#gmStageStepper');
            if (bStepper) bStepper.innerHTML = '';
            set('gmUnlockHint', 'The route stays sealed until ' + nm(border.open) + ' is cleared.');
            return;
        }
        const post = this.getSelectedPost();
        if (post) {
            const open = profileManager.isTradingPostUnlocked(post);
            set('gmSectorName', post.name);
            const bg = this.overlay.querySelector('.gm-sector-planet-bg');
            if (bg) {
                bg.innerHTML = this.postIconSvg(open, post) + (open ? '' : this.lockBadgeHtml());
                // Stations have no atmosphere.
                bg.classList.remove('has-atmo');
            }
            // Trading posts: economic profile instead of combat stats.
            const eco = profileManager.getTradingPostEconomy(post);
            const kindShort = { weapon: 'WPN', defense: 'DEF', ability: 'ABL', energy: 'NRG' };
            const sells = ['weapon', 'defense', 'ability', 'energy']
                .filter((k) => eco.sells[k])
                .map((k) => eco.sells[k] + ' ' + kindShort[k]).join(' · ');
            const pFac = this.overlay.querySelector('#gmFaction');
            if (pFac) pFac.innerHTML = post.faction ? this.factionLabelHtml(post.faction) : '—';
            set('gmDiffLabel', 'Economy');
            set('gmDiff', eco.wealth + ' · ' + eco.stockValue.toLocaleString('en-US') + ' CR');
            const cats = (post.categories || []).filter((c) => c !== 'resources')
                .map((c) => c.toUpperCase()).join(' · ');
            const known = profileManager.getActiveProfile && (profileManager.getActiveProfile().unlockedTraders || [])
                .indexOf(post.id) !== -1;
            set('gmStagesLabel', 'Trades');
            set('gmStages', (cats || 'RESOURCES') + (sells && cats.indexOf('PARTS') !== -1 ? ' (' + sells + ')' : '') + (known ? ' ✓' : ''));
            set('gmEnemiesLabel', 'Seeks');
            set('gmEnemies', eco.seeks.map((id) => (typeof economyConfig !== 'undefined' && economyConfig.getResourceLabel)
                ? economyConfig.getResourceLabel(id) : String(id).toUpperCase()).join(' · '));
            set('gmStatusLabel', 'Status');
            set('gmStatus', open ? 'OPEN' : 'REACH ' + profileManager.getTradingPostUnlockLabel(post));
            const postStepper = this.overlay.querySelector('#gmStageStepper');
            if (postStepper) postStepper.innerHTML = '';
            return;
        }
        const facEl = this.overlay.querySelector('#gmFaction');
        if (facEl) facEl.innerHTML = this.planetFactionsLabelHtml(info.id);
        const facLabel = this.overlay.querySelector('#gmFactionLabel');
        if (facLabel) facLabel.textContent = 'Faction';
        set('gmDiffLabel', 'Difficulty');
        set('gmStagesLabel', 'Stages');
        set('gmEnemiesLabel', 'Enemies');
        set('gmStatusLabel', 'Status');
        set('gmSectorName', info.name || '—');
        const planetBg = this.overlay.querySelector('.gm-sector-planet-bg');
        if (planetBg) {
            const icon = this.planetIconHtml(info.id, 260);
            const atmo = this.planetAtmoColor(icon);
            planetBg.innerHTML = icon + (info.unlocked ? '' : this.lockBadgeHtml());
            planetBg.classList.toggle('has-atmo', !!atmo);
            planetBg.style.setProperty('--atmo', atmo || 'transparent');
            planetBg.style.setProperty('--dk', this.planetAtmoScale(icon));
        }
        set('gmDiff', info.unlocked ? (info.difficulty || '—') : '???');
        set('gmStages', info.unlocked
            ? (info.cleared
                ? 'CLEARED'
                : (info.stage.highestStage
                    ? (info.stage.highestStage >= this.getStagesPerPlanet(info.id) ? `BOSS READY · ${this.getStagesPerPlanet(info.id) + 1}/${this.getStagesPerPlanet(info.id) + 1}` : `NEXT STAGE ${info.stage.highestStage + 1}/${this.getStagesPerPlanet(info.id) + 1}`)
                    : 'READY'))
            : 'LOCKED');
        set('gmEnemies', info.unlocked ? String(info.enemyCount) : '???');
        set('gmStatus', info.unlocked ? (info.cleared ? 'CLEARED' : 'OPEN') : 'LOCKED');
        const stepper = this.overlay.querySelector('#gmStageStepper');
        if (stepper) stepper.innerHTML = (info.unlocked && !this.selectedPostId && !this.selectedBorder) ? this.planetStagesHtml(info.id) : '';
        const unlockHint = this.overlay.querySelector('#gmUnlockHint');
        if (unlockHint) unlockHint.innerHTML = this.unlockHintHtml(info);
        const progressBar = this.overlay.querySelector('.gm-explore-progress .gm-progress-text')
            || this.overlay.querySelector('.galaxy-map-progress-bar .gm-progress-text')
            || this.overlay.querySelector('.galaxy-map-progress-bar');
        if (progressBar) {
            progressBar.textContent = this.getExploreProgressLabel() || this.getGalaxyProgressLabel();
        }
    },
    confirm(startMode) {
        // A flight in progress owns the map; an ambush waits for its choice.
        if (this._ambush) { this.resolveAmbush('fight'); return; }
        if (this._flight) return;
        // Checkpoint selected: confirm just jumps to the planet that opens it.
        if (this.selectedBorder) { this.selectPlanet(this.selectedBorder.open); return; }
        const post = this.getSelectedPost();
        if (post && startMode === 'raid' && post.factionStation) {
            // Raid: fight at the station's planet; winning destroys the station.
            profileManager.beginHoldingRaid(this.galaxyId, post.id, post.planetId);
            profileManager._suppressHoldingTick = true;
            profileManager.setShipLocation(this.galaxyId, 'planet', post.planetId);
            profileManager._suppressHoldingTick = false;
            this.selectedPostId = null;
            this.selectedPlanetId = post.planetId;
            this.confirm('start');
            return;
        }
        if (post) {
            if (!profileManager.isTradingPostUnlocked(post)) return;
            if (!this.isShipAt('post', post.id)) this.flyTo('post', post.id);
            else this.dockAt(post.id);
            return;
        }
        const info = this.getPlanetInfo(this.selectedPlanetId);
        if (!info || !info.unlocked) return;
        if (!this.isShipAt('planet', info.id)) {
            this.flyTo('planet', info.id);
            return;
        }
        if (startMode === 'assault') {
            profileManager.beginHoldingRaid(this.galaxyId, 'base', info.id);
            startMode = 'start';
        }
        const mode = startMode === 'start' ? 'start' : 'resume';
        const opts = this.getStartOptions(info.id);
        // Dev mode: a stage picked in the stepper overrides progress.
        // A cleared stage clicked in the stepper replays from that stage.
        const replayId = this._replayLevelId;
        this._replayLevelId = null;
        const levelId = replayId || (this.getDevStageLevelId && this.getDevStageLevelId(info.id))
            || (mode === 'start'
                ? (opts.startLevelId || `${info.id}-1`)
                : (opts.resumeLevelId || `${info.id}-1`));
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
    /** Launch icon for the mission buttons (pixel, tinted in the accent). */
    /** Small icon before a card button label ('lock' = pixel padlock). */
    btnIconHtml(name, size) {
        const px = size || 16;
        if (name === 'lock') {
            return '<svg class="gm-mission-icon gm-btn-lock" viewBox="0 0 12 14" shape-rendering="crispEdges" aria-hidden="true">' +
                '<path class="gm-lock-shackle" d="M3 6V3h1V2h1V1h2v1h1v1h1v3H8V3H7V2H5v1H4v3z"/>' +
                '<rect class="gm-lock-body" x="1" y="6" width="10" height="7"/></svg>';
        }
        if (typeof iconRenderer === 'undefined' || !iconRenderer.imgHtml) return '';
        return iconRenderer.imgHtml(name, px, 'gm-mission-icon', undefined, false);
    },
    missionIconHtml(size) {
        if (typeof iconRenderer === 'undefined' || !iconRenderer.imgHtml) return '';
        return iconRenderer.imgHtml('menuStart', size || 32, 'gm-mission-icon', undefined, false);
    },
});
