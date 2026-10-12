"use strict";

// HomeStationUI members, continued from render-factions-tab.js (kept under ~500 lines per file).
extendClass(HomeStationUI, {
    renderFactionContractsTab(profile) {
        const list = (typeof profileManager !== 'undefined' && profileManager.getFactionContracts)
            ? profileManager.getFactionContracts(profile) : [];
        const filter = this._factionContractFilter || 'all';
        const shown = list.filter((c) => filter === 'all' || c.kind === filter || c.factionId === filter);
        const esc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
        const active = profile.activeMission;
        const filters = [['all', 'ALL'], ['renegade', 'RENEGADES'], ['conquer', 'CONQUEST'], ['defend', 'DEFENSE'], ['bounty', 'BOUNTY HUNTS']]
            .concat(this._factionContractFaction ? [[this._factionContractFaction, this.factionLabel(this._factionContractFaction)]] : []);
        const filterHtml = filters.map(([fid, label]) =>
            `<button type="button" class="hs-shop-cat${filter === fid ? ' active' : ''}" data-fcontract-filter="${fid}" data-nav-item>${label}</button>`
        ).join('');
        const rows = shown.map((c) => {
            const busy = active && !c.active;
            const ico = (key) => `<span class="hs-go-ico">${this.iconHtml(key, 24, 'hs-pixel', false)}</span>`;
            const action = c.active
                ? `<button type="button" class="action-button hs-line-action hs-mission-go" data-fcontract-launch data-nav-item title="Launch" aria-label="Launch">${ico('navRocket')}</button>` +
                  `<button type="button" class="action-button secondary hs-line-action hs-mission-abort" data-mission-abandon data-nav-item title="Abandon" aria-label="Abandon">${ico('navDoor')}</button>`
                : `<button type="button" class="action-button hs-line-action hs-mission-go" data-fcontract-accept="${esc(c.id)}" data-nav-item aria-label="Launch" title="${busy ? 'Finish or abandon your active mission first' : 'Launch'}"${busy ? ' disabled' : ''}>` +
                  `${ico('navRocket')}</button>`;
            const foeFac = c.enemyFaction || (c.kind === 'renegade' ? c.factionId : null);
            const shipCls = (typeof factionShipStyles !== 'undefined' && factionShipStyles.classes && factionShipStyles.classes[0]) || 'fighter';
            const foeSrc = this.factionShipSrcHd(foeFac || 'pirate', shipCls, 8);
            const foeIcon = foeSrc ? `<img src="${foeSrc}" alt="">` : (foeFac ? this.factionEmblemHtml({ faction: foeFac }, 40) : this.iconHtml('navSkull', 32, 'hs-pixel', false));
            const foeTip = foeFac ? `Enemy: ${this.factionLabel(foeFac)}${c.kind === 'renegade' ? ' deserter' : ''}` : `Enemy: ${c.target || 'gang'} gang`;
            const rankN = Math.max(1, ['EASY', 'NORMAL', 'HARD', 'EXPERT', 'NIGHTMARE'].indexOf(String(c.difficulty).toUpperCase()) + 1);
            return `<div class="hs-line hs-mission is-${c.kind}${c.active ? ' is-active' : ''}${c.remote ? ' is-remote' : ''}">` +
                `<span class="hs-mission-icons-l" title="${esc(c.planetName)} · ${esc(this.factionLabel(c.factionId))}">` +
                `<span class="hs-mi-planet">${(typeof galaxyMapManager !== 'undefined' && galaxyMapManager.planetIconHtml && c.planetId) ? galaxyMapManager.planetIconHtml(c.planetId, 72, true) : this.iconHtml('menuPlanets', 48, 'hs-pixel', false)}</span>` +
                `<span class="hs-mi-crest">${this.factionEmblemHtml({ faction: c.factionId }, 48)}</span>` +
                `</span>` +
                `<span class="hs-line-name">` +
                `<span class="hs-mission-type">${c.type}</span>` +
                (c.goal ? `<strong class="hs-mission-goal">${esc(c.goal)}</strong>` : '') +
                `</span>` +
                `<span class="hs-mission-foe" title="${esc(foeTip)}">${foeIcon}</span>` +
                `<span class="hs-mission-info hs-mission-icons">` +
                `<span class="hs-mi-col" title="Difficulty: ${esc(c.difficulty)}"><span class="hs-mi">${this.iconHtml('navCrosshair', 24, 'hs-pixel', false)}</span>` +
                    `<span class="hs-mi-val hs-mi-rank" aria-label="${esc(c.difficulty)}">${Array.from({ length: 5 }, (_, i) => `<i class="${i < rankN ? 'on' : ''}"></i>`).join('')}</span></span>` +
                `<span class="hs-mi-col" title="${esc(c.galaxyName)}${c.remote ? ' · remote contract: teleports you there, pays 25% more' : ''}"><span class="hs-mi">${this.iconHtml(c.remote ? 'navRocket' : 'navMap', 24, 'hs-pixel', false)}</span>` +
                    `<span class="hs-mi-val">${esc(c.galaxyName)}</span></span>` +
                `<span class="hs-mi-col" title="+${c.rep} reputation"><span class="hs-mi">${this.iconHtml('navStar', 24, 'hs-pixel', false)}</span><span class="hs-mi-val">+${c.rep}</span></span>` +
                (c.active ? `<span class="hs-mi-col" title="Active contract"><span class="hs-mi is-on">${this.iconHtml('navFlag', 24, 'hs-pixel', false)}</span><span class="hs-mi-val">ACTIVE</span></span>` : '') +
                `</span>` +
                `<span class="hs-mission-reward">${this.renderContractRewards(c.reward)}</span>` +
                `<span class="hs-mission-actions">${action}</span>` +
                `</div>`;
        }).join('');
        return `<div class="hs-section hs-panel hs-missions-root hs-faction-contracts">` +
            `${this.panelTitle('hsExplore', 'FACTION CONTRACTS')}` +
            `<div class="hs-row hs-fcontract-filters">${filterHtml}</div>` +
            `<p class="hs-muted hs-hint">Hunt renegades (marked with a red slash and beacon), seize planets from rivals, defend allied ground or wipe out gangs — in every galaxy you can already reach. Remote contracts teleport you there and pay 25% more. ` +
            `Paid when you clear a stage on the target planet.</p>` +
            `<div class="hs-tab-fill hs-mission-list">${rows || this.emptyHtml('navScroll', 'NO CONTRACTS · improve relations or extend your warp range')}</div>` +
            `</div>`;
    },
    bindFactionEvents() {
        const q = (sel, fn) => this.overlay.querySelectorAll(sel).forEach((btn) => btn.addEventListener('click', () => fn(btn)));
        q('[data-faction-open]', (btn) => {
            this._factionDetail = btn.getAttribute('data-faction-open');
            this.persistTab();
            this.createUI();
        });
        q('[data-faction-colors-toggle]', () => {
            this._factionColorsOpen = !this._factionColorsOpen;
            const w = this.overlay.querySelector('.hs-fd-colors-wrap');
            if (w) w.classList.toggle('is-open', this._factionColorsOpen);
            const t = this.overlay.querySelector('[data-faction-colors-toggle]');
            if (t) t.textContent = 'COLORS ' + (this._factionColorsOpen ? '▼' : '▲');
        });
        q('[data-faction-color-reset]', (btn) => {
            factionShipStyles.clearColorDraft(btn.getAttribute('data-faction-id'), btn.getAttribute('data-faction-color-reset'));
            factionShipStyles.setColorOverride(btn.getAttribute('data-faction-id'), btn.getAttribute('data-faction-color-reset'), null, null);
            this.createUI();
        });
        // HUE is continuous; SAT and LIGHT are three steps (low / default / high).
        const stepValue = (part, v) => part === 's' ? factionShipStyles.satSteps[Number(v)]
            : part === 'l' ? factionShipStyles.lightSteps[Number(v)] : Number(v);
        this.overlay.querySelectorAll('[data-faction-adj]').forEach((inp) => {
            const fid = inp.getAttribute('data-faction-id'), key = inp.getAttribute('data-faction-key'), part = inp.getAttribute('data-faction-adj');
            // The open panel covers the preview: fade it while dragging so the live result shows.
            const wrap = inp.closest('.hs-fd-colors-wrap');
            const endDrag = () => {
                if (wrap) wrap.classList.remove('is-dragging');
                window.removeEventListener('pointerup', endDrag);
                window.removeEventListener('pointercancel', endDrag);
            };
            inp.addEventListener('pointerdown', () => {
                if (wrap) wrap.classList.add('is-dragging');
                window.addEventListener('pointerup', endDrag);
                window.addEventListener('pointercancel', endDrag);
            });
            // Live: recolour chip + hex while dragging; save and rebuild (preview, RESET) on release.
            inp.addEventListener('input', () => {
                const block = inp.closest('[data-faction-color-block]');
                const adj = {};
                block.querySelectorAll('[data-faction-adj]').forEach((r) => { adj[r.getAttribute('data-faction-adj')] = stepValue(r.getAttribute('data-faction-adj'), r.value); });
                const col = factionShipStyles.adjustColor(factionShipStyles.getDefaultFactionStyle(fid)[key], adj);
                block.querySelector('.hs-fd-color-chip').style.background = col;
                block.querySelector('em').textContent = col.toUpperCase();
                factionShipStyles.setColorDraft(fid, key, adj);
                this.overlay.querySelectorAll('[data-faction-colors-save], [data-faction-colors-cancel]').forEach((b) => { b.disabled = false; });
                const rst = block.querySelector('[data-faction-color-reset]');
                if (rst) rst.disabled = false;
                // Live preview: restart the fleet sim with the new colours (one per frame).
                if (this._factionColorRaf) return;
                this._factionColorRaf = requestAnimationFrame(() => {
                    this._factionColorRaf = null;
                    if (typeof graphicsManager !== 'undefined' && graphicsManager._voxelShipBake) graphicsManager._voxelShipBake = Object.create(null);
                    const cv = this.overlay && this.overlay.querySelector('[data-fleet-preview]');
                    if (cv) this.startFactionFleetPreview(cv.getAttribute('data-faction'), cv.getAttribute('data-ship'));
                });
            });
        });
        q('[data-faction-colors-cancel]', (btn) => {
            factionShipStyles.clearColorDraft(btn.getAttribute('data-faction-colors-cancel'));
            this.createUI();
        });
        q('[data-faction-colors-save]', (btn) => {
            factionShipStyles.commitColorDrafts(btn.getAttribute('data-faction-colors-save'));
            this.createUI();
        });
        q('[data-faction-fleet]', (btn) => {
            this._factionFleetShip = btn.getAttribute('data-faction-fleet');
            this.createUI();
        });
        const fleetCanvas = this.overlay.querySelector('[data-fleet-preview]');
        // Pan: drag the preview (useful when zoomed in on the player ship at the bottom).
        const setFleetPan = (x, y) => {
            this._factionFleetPan = { x: x, y: y };
            if (fleetCanvas) {
                fleetCanvas.style.setProperty('--fleet-px', x + 'px');
                fleetCanvas.style.setProperty('--fleet-py', y + 'px');
            }
        };
        const setFleetZoom = (value) => {
            this._factionFleetZoom = Math.max(0.5, Math.min(2.5, Math.round(value * 100) / 100));
            if (!fleetCanvas) return;
            fleetCanvas.style.setProperty('--fleet-zoom', this._factionFleetZoom);
            if (this._factionFleetZoom <= 1) setFleetPan(0, 0);
            const label = this.overlay.querySelector('[data-fleet-zoom-label]');
            if (label) label.textContent = `${Math.round(this._factionFleetZoom * 100)}%`;
        };
        q('[data-fleet-zoom]', (btn) => setFleetZoom((Number(this._factionFleetZoom) || 1) + Number(btn.getAttribute('data-fleet-zoom'))));
        q('[data-fleet-zoom-reset]', () => { setFleetZoom(1); setFleetPan(0, 0); });
        const fleetViewport = this.overlay.querySelector('[data-fleet-preview-viewport]');
        if (fleetViewport && fleetCanvas) {
            const pan0 = this._factionFleetPan || { x: 0, y: 0 };
            setFleetPan(pan0.x, pan0.y);
            fleetViewport.addEventListener('pointerdown', (e) => {
                if (e.target.closest && e.target.closest('.hs-fd-fleet-toolbar')) return;
                const z = Number(this._factionFleetZoom) || 1;
                const start = { x: e.clientX, y: e.clientY, p: Object.assign({}, this._factionFleetPan || { x: 0, y: 0 }) };
                const lim = (n, span) => Math.max(-span * (z - 0.0) , Math.min(span * (z - 0.0), n));
                fleetViewport.setPointerCapture && fleetViewport.setPointerCapture(e.pointerId);
                fleetViewport.classList.add('is-panning');
                const move = (ev) => {
                    const r = fleetViewport.getBoundingClientRect();
                    setFleetPan(Math.round(lim(start.p.x + ev.clientX - start.x, r.width * 0.6)), Math.round(lim(start.p.y + ev.clientY - start.y, r.height * 0.6)));
                };
                const up = () => {
                    fleetViewport.classList.remove('is-panning');
                    fleetViewport.removeEventListener('pointermove', move);
                    fleetViewport.removeEventListener('pointerup', up);
                    fleetViewport.removeEventListener('pointercancel', up);
                };
                fleetViewport.addEventListener('pointermove', move);
                fleetViewport.addEventListener('pointerup', up);
                fleetViewport.addEventListener('pointercancel', up);
            });
        }
        if (fleetViewport) {
            fleetViewport.addEventListener('wheel', (e) => {
                e.preventDefault();
                setFleetZoom((Number(this._factionFleetZoom) || 1) + (e.deltaY < 0 ? 0.1 : -0.1));
            }, { passive: false });
        }
        if (fleetCanvas) this.startFactionFleetPreview(fleetCanvas.getAttribute('data-faction'), fleetCanvas.getAttribute('data-ship'));
        else this.stopFactionFleetPreview();
        q('[data-faction-section]', (btn) => {
            this._factionSection = btn.getAttribute('data-faction-section');
            this.persistTab();
            this.createUI();
        });
        q('[data-faction-goto]', (btn) => {
            const id = btn.getAttribute('data-faction-id');
            const tab = btn.getAttribute('data-faction-goto');
            if (tab === 'ftrade') this._factionTrade = id;
            if (tab === 'fcontracts') {
                this._factionContractFaction = id;
                this._factionContractFilter = id;
            }
            this.tab = tab;
            this.persistTab();
            this.createUI();
        });
        q('[data-faction-pact]', (btn) => {
            const id = btn.getAttribute('data-faction-pact');
            const active = factionManager.togglePact(id);
            this.statusMsg = active ? `PACT WITH ${id.toUpperCase()} SIGNED` : `PACT WITH ${id.toUpperCase()} ENDED`;
            this.createUI();
        });
        q('[data-faction-trade]', (btn) => {
            this._factionTrade = btn.getAttribute('data-faction-trade');
            this.createUI();
        });
        q('[data-ftrade-buy]', (btn) => {
            const mat = btn.getAttribute('data-ftrade-buy');
            const n = Number(btn.getAttribute('data-amount')) || 10;
            const cost = factionManager.getTradeQuote(this._factionTrade, mat).buy * n;
            if (!profileManager.spendCredits(cost, true)) {
                this.playButtonResult(btn, false, 'NOT ENOUGH CREDITS');
                return;
            }
            const p = profileManager.getActiveProfile();
            if (!p.resources) p.resources = {};
            p.resources[mat] = (Number(p.resources[mat]) || 0) + n;
            profileManager.save();
            this.statusMsg = `BOUGHT ${n} ${mat.toUpperCase()} FOR ${cost} CR`;
            this.createUI();
        });
        q('[data-ftrade-sell]', (btn) => {
            const mat = btn.getAttribute('data-ftrade-sell');
            const n = Number(btn.getAttribute('data-amount')) || 10;
            const p = profileManager.getActiveProfile();
            if (!p || (Number((p.resources || {})[mat]) || 0) < n) {
                this.playButtonResult(btn, false, 'NOT ENOUGH ' + mat.toUpperCase());
                return;
            }
            const pay = factionManager.getTradeQuote(this._factionTrade, mat).sell * n;
            p.resources[mat] -= n;
            profileManager.addCredits(pay, true);
            profileManager.save();
            this.statusMsg = `SOLD ${n} ${mat.toUpperCase()} FOR ${pay} CR`;
            this.createUI();
        });
        q('[data-fcontract-filter]', (btn) => {
            this._factionContractFilter = btn.getAttribute('data-fcontract-filter');
            this.createUI();
        });
        const launchActive = () => {
            const m = profileManager.getActiveProfile().activeMission;
            if (!m) return;
            const cfg = (typeof planetConfigManager !== 'undefined' && planetConfigManager.getConfig(m.planetId)) || {};
            this.startMission({ planetId: m.planetId, id: m.planetId, name: String(cfg.name || m.planetId).toUpperCase(), galaxyId: m.galaxyId });
        };
        q('[data-fcontract-accept]', (btn) => {
            const res = profileManager.acceptFactionContract(btn.getAttribute('data-fcontract-accept'));
            if (!res.ok) {
                this.playButtonResult(btn, false, res.reason || 'NOT AVAILABLE');
                if (res.travelled) this.createUI();
                return;
            }
            launchActive();
        });
        q('[data-fcontract-launch]', launchActive);
        q('[data-mission-abandon]', () => {
            profileManager.abandonMission();
            this.statusMsg = 'CONTRACT ABANDONED';
            this.createUI();
        });
    },
});

// Hovering the header's identity / playstyle block or a trait temporarily replaces the tab content below it with the
// big-icon rows of that group (identity + playstyle together, traits on their own); leaving brings the tab back.
(function () {
    const SEL_INFO = '.hs-fd-col[data-im-name]';
    const SEL_TRAIT = '.hs-fd-trait[data-trait-key]';
    let panel = null;
    let current = null;
    let scope = null;
    let groupSel = '';
    let pinned = false;
    function clear(immediate) {
        pinned = false;
        const p = panel;
        panel = null;
        current = null;
        scope = null;
        if (!p) return;
        if (immediate) { p.remove(); return; }
        p.classList.add('is-out');
        setTimeout(function () { p.remove(); }, 140);
    }
    function describe(el) {
        return el.hasAttribute('data-im-name')
            ? { key: el.getAttribute('data-im-key'), name: el.getAttribute('data-im-name'), info: el.getAttribute('data-im-info') }
            : { key: el.getAttribute('data-trait-key'), name: el.getAttribute('data-trait-name'), info: el.getAttribute('data-trait-info'), more: (el.getAttribute('data-trait-more') || '').split('|').filter(Boolean) };
    }
    function factionOf(el) { return el.getAttribute('data-im-faction') || el.getAttribute('data-trait-faction'); }
    function bigIcon(key, fid, accent) {
        const ir = typeof iconRenderer !== 'undefined' ? iconRenderer : null;
        if (!ir || !ir.imgHtml) return '';
        if (key === 'emblem') {
            const base = typeof factionShipStyles !== 'undefined' && factionShipStyles.emblemCamelKey ? factionShipStyles.emblemCamelKey(fid) : '';
            return base ? ir.imgHtml(base + '@4x', 64, '', accent, false) : '';
        }
        return ir.imgHtml(key, 64, '', accent, false);
    }
    function entries(root, sel) { return Array.prototype.slice.call(root.querySelectorAll(sel)); }
    function open(el, sel) {
        clear(true);
        const fd = el.closest('.hs-fd');
        const host = fd ? fd.querySelector('.hs-fd-section') : null;
        if (!host) return;
        const fid = factionOf(el);
        const st = typeof factionShipStyles !== 'undefined' && factionShipStyles.getFactionStyle ? factionShipStyles.getFactionStyle(fid) : null;
        const accent = (st && (st.accent || st.hull)) || '#7ec8ff';
        const root = sel === SEL_TRAIT ? (el.parentElement || el) : (el.closest('.hs-fd-idbox') || el.closest('.hs-fd-hero-info') || el);
        const p = document.createElement('div');
        p.className = 'hs-fd-hover';
        p.style.setProperty('--trait-accent', accent);
        const fac = typeof factionManager !== 'undefined' && factionManager.getFaction ? factionManager.getFaction(fid) : null;
        const head = document.createElement('div');
        head.className = 'hs-trait-modal-fac';
        head.textContent = String((fac && fac.label) || fid || '').toUpperCase() + (sel === SEL_TRAIT ? ' · TRAITS' : '');
        p.appendChild(head);
        [el].forEach(function (n, i) {
            const d = describe(n);
            const row = document.createElement('div');
            row.className = 'hs-trait-modal-row' + (n === el ? ' is-hot' : '');
            row.style.animationDelay = (i * 70) + 'ms';
            const ico = document.createElement('span');
            ico.className = 'hs-trait-modal-ico';
            ico.setAttribute('data-ico', d.key || '');
            ico.innerHTML = bigIcon(d.key, fid, accent);
            const txt = document.createElement('span');
            txt.className = 'hs-trait-modal-txt';
            const name = document.createElement('b');
            name.textContent = d.name || '';
            const info = document.createElement('em');
            info.textContent = d.info || '';
            txt.appendChild(name);
            txt.appendChild(info);
            const labels = ['ORIGIN', 'HOW IT SHOWS', 'FOR YOU'];
            (d.more || []).forEach(function (line, li) {
                const sec = document.createElement('div');
                sec.className = 'hs-trait-modal-sec';
                const lb = document.createElement('span');
                lb.textContent = labels[li] || '';
                const tx = document.createElement('p');
                tx.textContent = line;
                sec.appendChild(lb);
                sec.appendChild(tx);
                txt.appendChild(sec);
            });
            row.appendChild(ico);
            row.appendChild(txt);
            p.appendChild(row);
        });
        host.appendChild(p);
        panel = p;
        current = el;
        scope = root;
        groupSel = sel;
    }
    function highlight(el) {
        if (!panel || !scope) return;
        const wasPinned = pinned;
        const sel = groupSel;
        open(el, sel);
        if (wasPinned && panel) { pinned = true; panel.classList.add('is-pinned'); }
    }
    document.addEventListener('mouseover', function (e) {
        const t = e.target.closest && e.target.closest(SEL_TRAIT);
        const el = t || (e.target.closest && e.target.closest(SEL_INFO));
        if (!el || el === current) return;
        const sel = t ? SEL_TRAIT : SEL_INFO;
        if (panel && scope && groupSel === sel && scope.contains(el)) highlight(el); else open(el, sel);
    });
    // Click keeps the hovered group open; clicking the same item again, a tab or anything outside closes it.
    document.addEventListener('click', function (e) {
        const t = e.target.closest && e.target.closest(SEL_TRAIT);
        const el = t || (e.target.closest && e.target.closest(SEL_INFO));
        if (el && panel && scope && scope.contains(el)) {
            if (pinned && el === current) { clear(false); return; }
            if (el !== current) highlight(el);
            pinned = true;
            panel.classList.add('is-pinned');
            return;
        }
        if (pinned) clear(false);
    });
    document.addEventListener('mouseout', function (e) {
        if (pinned || !current || !scope) return;
        const to = e.relatedTarget;
        if (to && scope.contains(to)) return;
        if (scope.contains(e.target)) clear(false);
    });
})();
