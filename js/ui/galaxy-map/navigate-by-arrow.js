"use strict";

// GalaxyMapManager methods, split from galaxy-map.js.
extendClass(GalaxyMapManager, {
    /**
     * Arrow targets from the current cursor. From a planet: linked planets
     * plus every trading post anchored to it (deep-space posts have two
     * anchors). From a post: its anchor planets, their linked planets and
     * the other posts sharing an anchor.
     */
    getArrowTargets() {
        const posts = this.getTradingPosts();
        const current = this.getSelectedPost();
        const anchorsOf = (p) => p.anchors || [p.planetId];
        const origin = current ? anchorsOf(current) : [this.selectedPlanetId];
        const out = [];
        const seen = {};
        const add = (kind, id, x, y) => {
            const key = kind + ':' + id;
            if (seen[key]) return;
            if ((kind === 'post' && current && id === current.id)
                || (kind === 'planet' && !current && id === this.selectedPlanetId)) return;
            seen[key] = true;
            out.push({ kind: kind, id: id, x: x, y: y });
        };
        const addPlanet = (pid) => {
            const n = this.nodeById[pid];
            if (n) add('planet', pid, n.x, n.y);
        };
        origin.forEach((pid) => {
            if (current) addPlanet(pid);
            const neighbors = (typeof planetConfigManager !== 'undefined' && pid)
                ? planetConfigManager.getGalaxyNeighbors(this.galaxyId, pid)
                : [];
            neighbors.forEach(addPlanet);
            posts.forEach((p) => {
                if (anchorsOf(p).indexOf(pid) !== -1) add('post', p.id, p.x, p.y);
            });
        });
        // Anything close by on screen is reachable too, so arrows are
        // symmetric (a post right below a planet is one press away both ways).
        const here = current || this.nodeById[this.selectedPlanetId];
        if (here) {
            const near = (x, y) => Math.hypot((x - here.x) * 544, (y - here.y) * 224) < 150;
            posts.forEach((p) => { if (near(p.x, p.y)) add('post', p.id, p.x, p.y); });
            (this.map.nodes || []).forEach((n) => { if (near(n.x, n.y)) addPlanet(n.planetId); });
        }
        return out;
    },

    navigateByArrow(key) {
        if (this._flight || this._ambush) return;
        if (!this.selectedPlanetId) return;
        const post = this.getSelectedPost();
        const cur = post || this.nodeById[this.selectedPlanetId];
        if (!cur) return;
        const targets = this.getArrowTargets();
        if (!targets.length) return;

        // Compare in map pixels (the map is ~544×224), not normalised 0..1
        // units, so left/right and up/down weigh distances the way they look.
        const SX = 544;
        const SY = 224;
        const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[key];
        if (!dir) return;
        let best = null;
        let bestScore = Infinity;
        targets.forEach((t) => {
            const dx = (t.x - cur.x) * SX;
            const dy = (t.y - cur.y) * SY;
            const dist = Math.hypot(dx, dy);
            if (dist < 1) return;
            // Angle off the pressed direction: within 75° counts, and
            // straighter + closer targets win.
            const cos = (dx * dir[0] + dy * dir[1]) / dist;
            if (cos < Math.cos(75 * Math.PI / 180)) return;
            const off = Math.acos(Math.min(1, cos));
            const score = dist * (1 + off * 1.6);
            if (score < bestScore) {
                bestScore = score;
                best = t;
            }
        });
        if (!best) return;
        if (best.kind === 'post') this.selectPost(best.id);
        else this.selectPlanet(best.id);
        // The camera follows: selection and ship stay in view, zooming out with the distance.
        if (this.frameSelectionCamera) this.frameSelectionCamera('follow');
    },

    selectPlanet(planetId) {
        this.selectedPostId = null;
        this.selectedBorder = null;
        this.selectedPlanetId = planetId;
        this.syncNodeHighlight();
        this.updateDetails();
        this.syncConfirmButton();
    },

    /**
     * Select a border checkpoint (route from open → shut). The card shows
     * it; actions stay those of the open planet whose clearing unseals it.
     */
    selectBorder(openId, shutId) {
        this.selectedPostId = null;
        this.selectedPlanetId = openId;
        this.selectedBorder = { open: openId, shut: shutId };
        this.syncNodeHighlight();
        this.updateDetails();
        this.syncConfirmButton();
    },

    /** Border checkpoint art sized for the planet card. */
    borderCardSvg(openId) {
        const art = this.borderArtFor(this.borderRulerStyle());
        const w = art[0].length, h = art.length;
        return `<svg class="gm-border-card" viewBox="${-w / 2} ${-h / 2} ${w} ${h}">` +
            this.blockadeSvgRaw(0, 0, openId, null, w / 21) + '</svg>';
    },

    getStartOptions(planetId) {
        if (typeof profileManager !== 'undefined' && profileManager.getPlanetStartOptions) {
            return profileManager.getPlanetStartOptions(planetId);
        }
        const pid = planetIdOfLevelId(planetId);
        return {
            canChoose: false,
            startLevelId: pid ? `${pid}-1` : null,
            resumeLevelId: pid ? `${pid}-1` : null,
            resumeLabel: 'STAGE 1'
        };
    },

    /** Standalone trading posts of this galaxy (own map nodes). */
    getTradingPosts() {
        if (typeof profileManager === 'undefined' || !profileManager.getTradingPosts) return [];
        return profileManager.getTradingPosts(this.galaxyId);
    },

    getSelectedPost() {
        if (!this.selectedPostId) return null;
        return this.getTradingPosts().find((p) => p.id === this.selectedPostId) || null;
    },

    /** Select a trading post; its anchor planet stays the arrow-nav origin. */
    selectPost(postId) {
        const post = this.getTradingPosts().find((p) => p.id === postId);
        if (!post) return;
        this.selectedBorder = null;
        this.selectedPostId = post.id;
        this.selectedPlanetId = post.planetId;
        this.syncNodeHighlight();
        this.updateDetails();
        this.syncConfirmButton();
    },

    dockAt(postId) {
        if (typeof this.onDock !== 'function') return;
        const post = this.getTradingPosts().find((p) => p.id === postId);
        if (!post || !profileManager.isTradingPostUnlocked(post)) {
            if (post) {
                this.statusMsg = post.name + ' · REACH ' + profileManager.getTradingPostUnlockLabel(post) + ' TO UNLOCK';
            }
            return;
        }
        if (!this.isShipAt('post', post.id)) return;
        this.onDock(post);
    },

    isShipAt(kind, id) {
        if (typeof profileManager === 'undefined' || !profileManager.isShipAt) return true;
        return profileManager.isShipAt(this.galaxyId, kind, id);
    },

    /**
     * Move the ship to a planet or post. Only the map SVG and the action row
     * are redrawn in place — a full createUI would rebuild the overlay and make
     * the background jump.
     */
    commitFlight(kind, id) {
        if (typeof profileManager === 'undefined' || !profileManager.setShipLocation) return;
        profileManager.setShipLocation(this.galaxyId, kind, id);
        const area = this.overlay && this.overlay.querySelector('#gmMapArea');
        if (area) {
            area.innerHTML = this.renderMapSvg();
            this.bindNodeClicks();
            this.bindPostClicks();
            this.bindMapZoom();
            this.raiseSelectedMarker();
        }
        this.updateDetails();
        this.syncConfirmButton();
    },

    /** Pixel padlock over an unreachable planet / station in the card. */
    lockBadgeHtml() {
        return '<span class="gm-lock-badge" title="LOCKED" aria-label="Locked">' +
            '<svg viewBox="0 0 12 14" width="48" height="56" shape-rendering="crispEdges" aria-hidden="true">' +
            '<path class="gm-lock-shackle" d="M3 6V3h1V2h1V1h2v1h1v1h1v3H8V3H7V2H5v1H4v3z"/>' +
            '<rect class="gm-lock-body" x="1" y="6" width="10" height="7"/>' +
            '<rect class="gm-lock-hole" x="5" y="8" width="2" height="3"/>' +
            '</svg></span>';
    },

    renderConfirmActionsHtml(info) {
        const post = this.getSelectedPost();
        if (post) {
            if (!profileManager.isTradingPostUnlocked(post)) {
                return `<button class="action-button disabled" id="gmConfirm" data-nav-item disabled>${this.btnIconHtml('lock')}${post.name} · LOCKED</button>`;
            }
            if (!this.isShipAt('post', post.id)) {
                return `<button class="action-button" id="gmConfirm" data-nav-item data-start-mode="fly">${this.btnIconHtml('hsTravel')}FLY TO ${post.name}</button>`;
            }
            // Faction stations can also be raided (faction-holdings.js).
            const ownSide = typeof planetConfigManager !== 'undefined' && planetConfigManager.isFriendlyFaction
                && planetConfigManager.isFriendlyFaction(post.faction);
            if (post.factionStation && !ownSide) {
                return `<button class="action-button secondary" id="gmConfirmStart" data-nav-item data-start-mode="raid">${this.btnIconHtml('menuWeapons')}RAID</button>` +
                    `<button class="action-button" id="gmConfirm" data-nav-item data-start-mode="dock">${this.btnIconHtml('hsStation')}DOCK · ${post.name}</button>`;
            }
            return `<button class="action-button" id="gmConfirm" data-nav-item data-start-mode="dock">${this.btnIconHtml('hsStation')}DOCK · ${post.name}</button>`;
        }
        const unlocked = !!(info && info.unlocked);
        if (!unlocked) {
            return `<button class="action-button disabled" id="gmConfirm" data-nav-item disabled>${this.btnIconHtml('lock')}LOCKED</button>`;
        }
        if (!this.isShipAt('planet', info.id)) {
            return `<button class="action-button" id="gmConfirm" data-nav-item data-start-mode="fly">${this.btnIconHtml('hsTravel')}FLY TO ${String(info.name || info.id).toUpperCase()}</button>`;
        }
        // The ruler's base, once all its stations are gone, can be assaulted.
        const hold = profileManager.getFactionHoldings ? profileManager.getFactionHoldings(this.galaxyId) : null;
        const ownRuler = hold && typeof planetConfigManager !== 'undefined' && planetConfigManager.isFriendlyFaction
            && planetConfigManager.isFriendlyFaction(hold.ruler);
        if (hold && !ownRuler && !hold.baseLost && hold.base === info.id && !hold.stations.length
            && profileManager.isHoldingBaseRevealed(this.galaxyId)) {
            return `<button class="action-button secondary" id="gmConfirmStart" data-nav-item data-start-mode="assault">${this.btnIconHtml('menuWeapons')}ASSAULT BASE</button>` +
                `<button class="action-button gm-mission-btn" id="gmConfirm" data-nav-item data-start-mode="resume">${this.missionIconHtml ? this.missionIconHtml() : ''}START MISSION</button>`;
        }
        // Liberated planet: nothing left to fight (unless it's invaded again;
        // dev mode can still replay stages).
        const invaded = profileManager.getInvadedPlanetId && profileManager.getInvadedPlanetId(this.galaxyId) === info.id;
        if (this.isCleared && this.isCleared(info.id) && !invaded && !(this.isDevMode && this.isDevMode())) {
            return `<button class="action-button disabled" id="gmConfirm" data-nav-item disabled>LIBERATED</button>`;
        }
        const opts = this.getStartOptions(info && info.id);
        // Dev mode: the stage picked in the stepper is what launches.
        const pick = this.isDevMode && this.isDevMode() && this.getDevStagePick ? this.getDevStagePick(info && info.id) : null;
        if (pick) {
            const n = this.getStagesPerPlanet(info.id);
            const label = pick > n ? `BOSS ${n + 1}/${n + 1}` : `STAGE ${pick}/${n + 1}`;
            return `<button class="action-button gm-mission-btn" id="gmConfirm" data-nav-item data-start-mode="resume">${this.missionIconHtml(32)}${label}</button>`;
        }
        const resumeLabel = opts.canChoose ? (opts.resumeLabel || 'START MISSION') : 'START MISSION';
        return `<button class="action-button gm-mission-btn" id="gmConfirm" data-nav-item data-start-mode="resume">${this.missionIconHtml(32)}${resumeLabel}</button>`;
    },

    /** One faction as a coloured name (faction accent, dark outline). */
    factionLabelHtml(fid) {
        const id = String(fid || '').toLowerCase();
        const meta = typeof planetConfigManager !== 'undefined' && planetConfigManager.getFactionMeta
            ? planetConfigManager.getFactionMeta(id) : null;
        const st = typeof factionShipStyles !== 'undefined' && factionShipStyles.getFactionStyle
            ? factionShipStyles.getFactionStyle(id) : null;
        const color = (st && st.accent) || 'var(--color-primary)';
        const label = String((meta && meta.label) || id).toUpperCase().replace(/</g, '&lt;');
        return `<span class="gm-faction-chip" style="--chip:${color}"><span class="gm-faction-dot"></span>${label}</span>`;
    },

    /** Factions settling a planet (ruling first), for the sector card. */
    planetFactionsLabelHtml(planetId) {
        let list = [];
        try {
            list = typeof planetConfigManager !== 'undefined' && planetConfigManager.getPlanetFactions
                ? planetConfigManager.getPlanetFactions(planetId) || [] : [];
        } catch (e) { list = []; }
        return list.length ? list.slice(0, 3).map((f) => this.factionLabelHtml(f)).join(' ') : '—';
    },

    syncConfirmButton() {
        if (!this.overlay) return;
        const actions = this.overlay.querySelector('#gmActions');
        if (!actions) return;
        const info = this.getPlanetInfo(this.selectedPlanetId);
        const backBtn = actions.querySelector('#gmBack');
        const backHtml = backBtn ? backBtn.outerHTML : '';
        this._actionFocus = null; // buttons are rebuilt; focus returns to the map
        if (this.selectedBorder) {
            // Checkpoint: nothing to start here — one button jumps to the
            // planet whose clearing opens it.
            const openId = this.selectedBorder.open;
            const name = String((this.getPlanetInfo(openId) || {}).name || openId).toUpperCase();
            actions.innerHTML = `<button class="action-button" id="gmBorderFocus" data-nav-item>${this.btnIconHtml('hsExplore')}SHOW ${name}</button>` + (backHtml ? ` ${backHtml}` : '');
            actions.querySelector('#gmBorderFocus').addEventListener('click', () => this.selectPlanet(openId));
            const back = actions.querySelector('#gmBack');
            if (back) back.addEventListener('click', () => this.back());
            return;
        }
        actions.innerHTML = this.renderConfirmActionsHtml(info) + (backHtml ? ` ${backHtml}` : '');
        this.bindConfirmActions();
        // The stage row reads the same progress as the button: rebuild it
        // with it, else it kept the state from when the map was opened.
        const stepper = this.overlay.querySelector('#gmStageStepper');
        // A selected station / border gate shows no planet stages.
        if (stepper && info) stepper.innerHTML = (info.unlocked && !this.selectedPostId && !this.selectedBorder) ? this.planetStagesHtml(info.id) : '';
    },

    bindConfirmActions() {
        if (!this.overlay) return;
        const startBtn = this.overlay.querySelector('#gmConfirmStart');
        const confirmBtn = this.overlay.querySelector('#gmConfirm');
        const backBtn = this.overlay.querySelector('#gmBack');
        if (startBtn && !startBtn.disabled && !startBtn.classList.contains('disabled')) {
            startBtn.addEventListener('click', () => this.confirm(startBtn.getAttribute('data-start-mode') || 'start'));
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
        if (unlockHint) {
            const unlockFrom = !info.unlocked
                ? (this.map.edges || []).map((edge) => edge[0] === info.id ? edge[1] : (edge[1] === info.id ? edge[0] : null))
                    .find((pid) => pid && this.isUnlocked(pid))
                : null;
            unlockHint.textContent = unlockFrom
                ? `CLEAR ${String(this.getPlanetInfo(unlockFrom).name).toUpperCase()} TO UNLOCK`
                : (!info.unlocked ? 'CLEAR A CONNECTED PLANET TO UNLOCK' : '');
        }
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
