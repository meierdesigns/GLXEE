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
    },

    selectPlanet(planetId) {
        this.selectedPostId = null;
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
        }
        this.updateDetails();
        this.syncConfirmButton();
    },

    renderConfirmActionsHtml(info) {
        const post = this.getSelectedPost();
        if (post) {
            if (!profileManager.isTradingPostUnlocked(post)) {
                return `<button class="action-button disabled" id="gmConfirm" data-nav-item disabled>${post.name} · LOCKED</button>`;
            }
            if (!this.isShipAt('post', post.id)) {
                return `<button class="action-button" id="gmConfirm" data-nav-item data-start-mode="fly">FLY TO ${post.name}</button>`;
            }
            return `<button class="action-button" id="gmConfirm" data-nav-item data-start-mode="dock">DOCK · ${post.name}</button>`;
        }
        const unlocked = !!(info && info.unlocked);
        if (!unlocked) {
            return '<button class="action-button disabled" id="gmConfirm" data-nav-item disabled>LOCKED</button>';
        }
        if (!this.isShipAt('planet', info.id)) {
            return `<button class="action-button" id="gmConfirm" data-nav-item data-start-mode="fly">FLY TO ${String(info.name || info.id).toUpperCase()}</button>`;
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
        const post = this.getSelectedPost();
        if (post) {
            const open = profileManager.isTradingPostUnlocked(post);
            set('gmSectorName', post.name);
            const bg = this.overlay.querySelector('.gm-sector-planet-bg');
            if (bg) bg.innerHTML = this.postIconSvg(open, post);
            // Trading posts: economic profile instead of combat stats.
            const eco = profileManager.getTradingPostEconomy(post);
            const kindShort = { weapon: 'WPN', defense: 'DEF', ability: 'ABL', energy: 'NRG' };
            const sells = ['weapon', 'defense', 'ability', 'energy']
                .filter((k) => eco.sells[k])
                .map((k) => eco.sells[k] + ' ' + kindShort[k]).join(' · ');
            set('gmDiffLabel', 'Economy');
            set('gmDiff', eco.wealth + ' · ' + eco.stockValue.toLocaleString('en-US') + ' CR');
            set('gmStagesLabel', 'Sells');
            set('gmStages', sells || '—');
            set('gmEnemiesLabel', 'Seeks');
            set('gmEnemies', eco.seeks.map((id) => (typeof economyConfig !== 'undefined' && economyConfig.getResourceLabel)
                ? economyConfig.getResourceLabel(id) : String(id).toUpperCase()).join(' · '));
            set('gmStatusLabel', 'Status');
            set('gmStatus', open ? 'OPEN' : 'REACH ' + profileManager.getTradingPostUnlockLabel(post));
            return;
        }
        set('gmDiffLabel', 'Difficulty');
        set('gmStagesLabel', 'Stages');
        set('gmEnemiesLabel', 'Enemies');
        set('gmStatusLabel', 'Status');
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
        // A flight in progress owns the map; an ambush waits for its choice.
        if (this._ambush) { this.resolveAmbush('fight'); return; }
        if (this._flight) return;
        const post = this.getSelectedPost();
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
