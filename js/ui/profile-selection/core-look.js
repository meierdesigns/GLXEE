"use strict";

// ProfileSelectionManager members, continued from core.js: faction look, lore, facts and ship preview.
extendClass(ProfileSelectionManager, {
    /** Faction emblem as a pixel icon, tinted in the faction accent. */
    getFactionEmblemHtml(id, size = 16, detail) {
        if (typeof iconRenderer === 'undefined' || typeof factionShipStyles === 'undefined') return '';
        const base = factionShipStyles.emblemCamelKey ? factionShipStyles.emblemCamelKey(id) : null;
        if (!base) return '';
        // VOXEL: nearest-neighbour upscale of the authored sprite (no Scale2x).
        // FLAT: Scale2x/@Hi for large draws so diagonals look smoother.
        let key = base;
        if (!this.wantsVoxelEmblems()) {
            const mag = Math.max(1, Number(detail) || 1) * size / 16;
            if (mag >= 3) key = base + '@4x';
            else if (mag >= 1.5) key = base + '@2x';
        } else if (typeof IconSprites !== 'undefined' && IconSprites[base + 'Hi'] && size >= 24) {
            // Hand-drawn 32x32 art instead of the 16x16 silhouette; big draws get one Scale2x pass (64 grid).
            key = base + (size >= 96 ? '@4x' : '@2x');
        } else if (typeof iconRenderer.detailKey === 'function') {
            key = iconRenderer.detailKey(base, size);
        }
        const style = factionShipStyles.getFactionStyle ? factionShipStyles.getFactionStyle(id) : null;
        return iconRenderer.imgHtml(key, size, 'profile-faction-emblem-img', style && style.accent, this.getFactionLabel(id));
    },
    /**
     * Re-skin the dialog in the chosen faction's palette and show that
     * faction's ship, so picking a faction previews what the game becomes.
     */
    applyPendingFactionLook() {
        if (!this.overlay) return;
        const id = this.pendingFaction;
        if (typeof menuStateManager !== 'undefined' && this.mode === 'create') menuStateManager.save({ pfaction: id });
        // The menu / profile backdrops follow the faction being picked (CSS: html[data-pf]).
        if (this.mode === 'create' && typeof document !== 'undefined' && document.documentElement.getAttribute('data-pf') !== id) {
            document.documentElement.setAttribute('data-pf', id);
            if (typeof VFBgMouseParallax !== 'undefined' && VFBgMouseParallax.refresh) VFBgMouseParallax.refresh();
            if (window.vfRepaintBackdrops) window.vfRepaintBackdrops();   // frozen (covered) hosts too: the menu hangar behind the dialog
        }
        const box = this.overlay.querySelector('.profile-selection-name-mode');
        this.applyFactionVars(box, id);
        const emblem = this.overlay.querySelector('.profile-faction-preview-emblem');
        if (emblem) emblem.innerHTML = this.getFactionEmblemHtml(id, 192, 4);
        const nameCrest = this.overlay.querySelector('.profile-name-crest');
        if (nameCrest) nameCrest.innerHTML = this.getFactionEmblemHtml(id, 48);
        const name = this.overlay.querySelector('.profile-faction-preview-name');
        if (name) name.textContent = this.getFactionLabel(id);
        const meta = typeof planetConfigManager !== 'undefined' && planetConfigManager.getFactionMeta
            ? planetConfigManager.getFactionMeta(id)
            : null;
        const hero = meta && meta.hero;
        const trait = this.overlay.querySelector('.profile-faction-preview-trait');
        if (trait) trait.textContent = meta && meta.traits.length ? meta.traits.join(' · ').toUpperCase() : '';
        const loreEl = this.overlay.querySelector('.profile-faction-lore-text');
        if (loreEl) this.renderFactionLore(loreEl, meta);
        const heroEl = this.overlay.querySelector('.profile-faction-preview-hero');
        if (heroEl) {
            heroEl.textContent = hero ? `HERO · ${hero.name}` : '';
            heroEl.title = hero ? `${hero.title} — ${hero.lore}` : '';
        }
        this.renderFactionFacts(id, meta);
        this.fitFactionText();
        // The faction hero's name is the default pilot name. It follows the
        // faction choice until the player types a name of their own.
        const input = this.overlay.querySelector('#profileNameInput');
        if (input && hero && this.mode === 'create') {
            const untouched = !input.value || input.value === this._heroDefaultName;
            if (untouched) {
                input.value = hero.name.slice(0, 16);
                this._heroDefaultName = input.value;
            }
            input.placeholder = hero.name;
        }
        this.renderFactionShipPreview(id);
        // Re-run the swap-in animation on everything that changed with the faction.
        const inStartStep = !!this.overlay.querySelector('.profile-kit-ship');
        if (!inStartStep && this._lastLookFaction && this._lastLookFaction !== id) {
            const els = this.overlay.querySelectorAll('.profile-faction-ship, .profile-faction-preview-text, .profile-faction-lore-text, .profile-faction-facts, .profile-name-crest');
            els.forEach((el) => { el.classList.remove('vf-fswap'); void el.offsetWidth; el.classList.add('vf-fswap'); });
        }
        this._lastLookFaction = id;
    },
    /** Fill the lore card: the active tab's text grows to the largest size that still fits the box (no empty lower half, no scrolling). */
    fitFactionText() {
        if (!this.overlay) return;
        const card = this.overlay.querySelector('.profile-faction-lore');
        const panel = card && card.querySelector('.profile-faction-tabpanel.active');
        if (!panel) return;
        const lore = panel.querySelector('.profile-faction-lore-text'), fact = panel.querySelector('.profile-faction-fact');
        const el = lore || fact || panel;                                           // the box whose font grows
        const kids = lore ? Array.from(lore.children) : fact ? Array.from(fact.querySelectorAll('.profile-faction-fact-body, .profile-faction-fact-label, .profile-faction-fact-value, .profile-faction-fact-note')) : [];
        const rel = (c) => c.classList.contains('profile-faction-lore-hero') || c.classList.contains('profile-faction-fact-note') ? '0.8em' : c.classList.contains('profile-faction-fact-label') ? '0.7em' : '1em';
        const run = () => {
            const cr = card.getBoundingClientRect();
            if (!cr.height) return;
            el.style.setProperty('overflow', 'visible', 'important'); el.style.setProperty('max-height', 'none', 'important'); el.style.setProperty('height', 'auto', 'important');
            kids.forEach((c) => { c.style.setProperty('font-size', rel(c), 'important'); c.style.setProperty('line-height', '1.5', 'important'); });   // children follow the fitted size
            const room = () => cr.bottom - el.getBoundingClientRect().top - 18;
            const used = () => { const last = kids[kids.length - 1] || el.lastElementChild; return last ? last.getBoundingClientRect().bottom - el.getBoundingClientRect().top : el.scrollHeight; };   // real content height (the box itself is stretched)
            let lo = 11, hi = 38;
            while (lo < hi) {
                const mid = Math.ceil((lo + hi) / 2);
                el.style.setProperty('font-size', mid + 'px', 'important');
                if (used() <= room()) lo = mid; else hi = mid - 1;
            }
            el.style.setProperty('font-size', lo + 'px', 'important');
            el.style.setProperty('line-height', '1.55', 'important');
            el.style.removeProperty('overflow'); el.style.removeProperty('max-height'); el.style.removeProperty('height');
        };
        run();
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (this.overlay) run(); });
        if (!this._fitBound) { this._fitBound = true; window.addEventListener('resize', () => this.fitFactionText()); }
    },
    /** Random pilot name in the faction's voice ("FIRST LAST", max 16 characters). */
    generatePilotName(faction) {
        const sets = {
            terran: [['MARCUS', 'ELENA', 'JONAS', 'IRIS', 'TOBIAS', 'NADIA', 'CALEB', 'MIRA', 'DEXTER', 'LENA'], ['HALE', 'VOSS', 'REYES', 'KANE', 'ORTEGA', 'BRIGHT', 'STONE', 'WELLS', 'ARDEN', 'CROSS']],
            kronax: [['SKARR', 'GORRAK', 'THRAX', 'VOLKA', 'KRAZ', 'DRUUM', 'ZARKO', 'BRUTA', 'KHORN', 'RAGOS'], ['VELKHAR', 'ASHFANG', 'BONEMAW', 'GRIMCLAW', 'SCARHIDE', 'DUSKRAK', 'BLOODMANE']],
            voidborn: [['ILLUN', 'ESHARA', 'VOHL', 'NYXA', 'ORUUM', 'SELEH', 'ZIRAEL', 'UMBRA', 'KETHE', 'AYLUN'], ['HOLLOW', 'RIFTBORN', 'ASHEN', 'WHISPER', 'DEEPSTILL', 'NULL', 'VEILED', 'ENDLESS']],
            pirate: [['REDBEARD', 'SALTY', 'ONE-EYE', 'MAD', 'BLACK', 'CAPTAIN', 'JACKAL', 'SCURVY', 'RUSTY', 'GREY'], ['JACK', 'MORGAN', 'FLINT', 'SILVER', 'BONES', 'KIDD', 'TEACH', 'DOGGER', 'HOOK', 'STORM']],
            machine: [['UNIT', 'NODE', 'AXIOM', 'CORE', 'VECTOR', 'CIPHER', 'MODULE', 'SIGMA', 'KERNEL', 'DELTA'], ['7', '0X1A', '404', 'PRIME', '9-B', 'ALPHA', 'X-12', 'ZERO', '88', 'OMEGA']]
        };
        const set = sets[String(faction || '').toLowerCase()] || sets.terran;
        const pick = (a) => a[Math.floor(Math.random() * a.length)];
        for (let i = 0; i < 30; i++) {
            const name = pick(set[0]) + ' ' + pick(set[1]);
            if (name.length <= 16) return name;
        }
        return pick(set[0]).slice(0, 16);
    },
    /**
     * Lore as structure: the short summary as a lead line, the long text
     * split into paragraphs of ~2 sentences, the hero's title as a footer.
     */
    renderFactionLore(el, meta) {
        el.textContent = '';
        if (!meta) return;
        const add = (cls, text) => {
            const p = document.createElement('p');
            p.className = cls;
            p.textContent = text;
            el.appendChild(p);
        };
        if (meta.lore && meta.lore !== meta.loreLong) add('profile-faction-lore-lead', meta.lore);
        const sentences = String(meta.loreLong || '').match(/[^.!?]+[.!?]+(\s|$)/g) || [];
        for (let i = 0; i < sentences.length; i += 2) {
            add('profile-faction-lore-para', sentences.slice(i, i + 2).join('').trim());
        }
        if (meta.hero && meta.hero.title) {
            add('profile-faction-lore-hero', `${meta.hero.name} — ${meta.hero.title}`);
        }
    },
    /** Home galaxy, playstyle and preferred weapon (what new ships start with). */
    renderFactionFacts(id, meta) {
        const ir = typeof iconRenderer !== 'undefined' ? iconRenderer : null;
        const accent = this.getFactionColor(id);
        const fill = (fact, iconHtml, value, note) => {
            const box = this.overlay.querySelector(`.profile-faction-fact[data-fact="${fact}"]`);
            if (!box) return;
            box.querySelector('.profile-faction-fact-icon').innerHTML = iconHtml || '';
            box.querySelector('.profile-faction-fact-value').textContent = value || '—';
            const n = box.querySelector('.profile-faction-fact-note');
            if (n) n.textContent = note || '';
        };
        const galaxy = String((meta && meta.homeGalaxy) || '');
        const galaxyKey = { milky_way: 'galaxyMilkyWay', andromeda: 'galaxyAndromeda' }[galaxy] || 'galaxyDefault';
        fill('home', ir ? ir.imgHtml(galaxyKey, 40, '', accent, false) : '', galaxy.replace(/_/g, ' ').toUpperCase());

        const styleKey = { terran: 'statShield', kronax: 'statDamage', voidborn: 'statSpeed',
            pirate: 'resScrap', machine: 'statEnergy' }[id] || 'statWeapon';
        fill('style', ir ? ir.imgHtml(styleKey, 40, '', accent, false) : '', meta && meta.playstyle);

        const ids = typeof factionShipStyles !== 'undefined' && factionShipStyles.getFactionDefaultWeapons
            ? factionShipStyles.getFactionDefaultWeapons(id) : [];
        const wid = ids[0] || 'laser';
        const w = typeof weaponConfigManager !== 'undefined' ? weaponConfigManager.getWeapon(wid) : null;
        const name = String((w && w.name) || wid).toUpperCase();
        const stats = w ? ` · DMG ${w.damage} · ${(1000 / Math.max(1, w.cooldown)).toFixed(1)}/S` : '';
        const allies = typeof planetConfigManager !== 'undefined' && planetConfigManager.getFactionAllies
            ? planetConfigManager.getFactionAllies(id) : [];
        const alliesBox = this.overlay.querySelector('.profile-faction-fact[data-fact="allies"]');
        fill('allies', ir ? ir.imgHtml('menuFactions', 40, '', accent, false) : '',
            allies.length ? allies.map((a) => this.getFactionLabel(a)).join(' · ') : 'NONE',
            allies.length ? 'Fight side by side — their ships never attack each other.' : 'Stands alone against every other faction.');
        if (alliesBox && allies.length) {
            const v = alliesBox.querySelector('.profile-faction-fact-value');
            v.innerHTML = allies.map((a) =>
                `<span class="profile-faction-ally" style="color:${this.getFactionColor(a)}">` +
                `${this.getFactionEmblemHtml(a, 24)}${this.getFactionLabel(a)}</span>`).join('');
        }
        fill('weapon', ir && ir.weaponImgHtml ? ir.weaponImgHtml(wid, 40, '', false) : '',
            name + stats, meta && meta.weaponNote);
        if (this.renderFactionTabsRich) { try { this.renderFactionTabsRich(id, meta); } catch (e) { /* keep the plain facts */ } }
    },
    /** Faction palette + frame shape on one dialog box. */
    applyFactionVars(box, id) {
        const style = typeof factionShipStyles !== 'undefined' && factionShipStyles.getFactionStyle
            ? factionShipStyles.getFactionStyle(id)
            : null;
        if (!box || !style) return;
        const accent = style.accent || '#c8d0d8';
        const hull = style.hull || '#7a8490';
        // Everything coloured follows the bezel: it waits until the new faction's cables are plugged in.
        const paint = () => {
            box.style.setProperty('--color-primary', accent);
            box.style.setProperty('--color-secondary', hull);
            box.style.setProperty('--color-border', hull);
            box.style.setProperty('--color-accent', accent);
            box.style.setProperty('--faction-accent', accent);
            box.style.setProperty('--faction-hull', hull);
            box.style.setProperty('--faction-edge', style.edge || '#2a3038');
            // The dialog frame itself (border + glow) reads --ui-border.
            box.style.setProperty('--ui-border', accent);
            // Light "white" tone of this faction (text, interactables) — same rule
            // as the app-wide faction palette, scoped to this box.
            const light = (typeof themeContextManager !== 'undefined' && themeContextManager.lightenHex)
                ? themeContextManager.lightenHex(accent, 0.72) : '#ffffff';
            box.style.setProperty('--color-second-basecolor', light);
            box.style.setProperty('--color-text', light);
            box.style.setProperty('--color-text-secondary', (typeof themeContextManager !== 'undefined' && themeContextManager.lightenHex)
                ? themeContextManager.lightenHex(accent, 0.45) : light);
            box.dataset.faction = id;
        };
        // The screen bezel follows the faction while it is being chosen.
        const bz = document.getElementById('vf-bezel');
        if (!box.dataset.faction) paint(); // a freshly built dialog never shows unthemed
        if (bz && box.classList.contains('profile-selection-name-mode')) {
            bz.setAttribute('data-preview', '1');
            const applyBezel = () => {
                paint();
                delete bz.dataset.pendingFaction;
                bz.setAttribute('data-faction', id);
                // The whole GUI (window background, cables, palette) follows the pick, not only the bezel. data-preview keeps it out of the saved snapshot.
                if (typeof factionShipStyles !== 'undefined' && factionShipStyles.stampDocumentTheme) {
                    document.documentElement.setAttribute('data-vf-faction', id);
                    factionShipStyles.stampDocumentTheme(id);
                    if (typeof factionGui !== 'undefined') factionGui.sync(id);
                }
                bz.style.setProperty('--retro-ink', accent);
                bz.style.setProperty('--color-primary', accent);
                const crest = bz.querySelector('.vf-pilot-crest');
                if (crest) crest.setAttribute('data-f', id);
            };
            if (bz.getAttribute('data-faction') !== id && typeof factionGui !== 'undefined') {
                // Cables are swapped first; the bezel recolours after the new ones are in.
                bz.dataset.pendingFaction = id;
                factionGui.swap(id, applyBezel);
            } else applyBezel();
        } else paint();
    },
    /** Default player hull drawn in the faction's silhouette and colours. */
    renderFactionShipPreview(id, attempt) {
        const tries = attempt || 0;
        clearTimeout(this._shipPreviewTimer);
        // After a page refresh the ship assets / managers load asynchronously: retry until ready.
        const retry = () => {
            if (tries >= 60) return;
            this._shipPreviewTimer = setTimeout(() => {
                if (this.overlay && this.pendingFaction === id) this.renderFactionShipPreview(id, tries + 1);
            }, 150);
        };
        const canvas = this.overlay && this.overlay.querySelector('.profile-faction-ship');
        const ctx = canvas && canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const loader = typeof graphicsManager !== 'undefined' && graphicsManager.shipAssetLoader;
        if (!loader || (loader.isLoaded && !loader.isLoaded())
            || typeof shipConfigManager === 'undefined' || !shipConfigManager.getMergedModel) { retry(); return; }
        try {
            const inStart = this.mode === 'create' && !!this.overlay.querySelector('.profile-kit-ship');
            const shipId = inStart ? this.startShipId() : 'player_scrap';
            if (inStart) this.renderKitShipInfo();
            const model = Object.assign({}, shipConfigManager.getMergedModel(shipId), { id: shipId, faction: id, factionPreview: true });
            if (typeof shipLoadoutManager !== 'undefined' && shipLoadoutManager.applyLayoutToModel) {
                shipLoadoutManager.applyLayoutToModel(model, shipId);
            }
            model.faction = id;
            const mw = Math.max(1, model.width || 20);
            const mh = Math.max(1, model.height || 16);
            // Start step: draw at in-game resolution (18 px wide hull) and let CSS scale it up, so pixels are as chunky as in the game.
            if (inStart) {
                const gw = Math.round(mw * 0.5) + 6, gh = Math.round(mh * 0.5) + 6;
                if (canvas.width !== gw || canvas.height !== gh) { canvas.width = gw; canvas.height = gh; canvas.style.aspectRatio = `${gw} / ${gh}`; }
            }
            const scale = inStart ? 0.5 : Math.max(1, Math.floor(Math.min((canvas.width - 16) / mw, (canvas.height - 16) / mh)));
            ctx.imageSmoothingEnabled = false;
            // Same renderer and options as the in-game player ship, no extra outline or filter.
            const tmp = document.createElement('canvas');
            tmp.width = canvas.width; tmp.height = canvas.height;
            const tctx = tmp.getContext('2d');
            tctx.imageSmoothingEnabled = false;
            loader.renderShip(tctx, model, Math.floor((canvas.width - mw * scale) / 2),
                Math.floor((canvas.height - mh * scale) / 2), scale, null, 0, { showThrusterGlow: true, allowColorMountSprites: true });
            ctx.drawImage(tmp, 0, 0);
        } catch (e) {
            /* preview is cosmetic, but assets may still be arriving */
            retry();
        }
    },
    getFactionLabel(id) {
        if (typeof planetConfigManager !== 'undefined' && planetConfigManager.getFactionMeta) {
            const meta = planetConfigManager.getFactionMeta(id);
            if (meta && meta.label) return meta.label;
        }
        return String(id || '').toUpperCase();
    },
    getFactionColor(id) {
        if (typeof factionShipStyles !== 'undefined' && factionShipStyles.getFactionColor) {
            return factionShipStyles.getFactionColor(id);
        }
        if (typeof planetConfigManager !== 'undefined' && planetConfigManager.getFactionPlanetTheme) {
            const theme = planetConfigManager.getFactionPlanetTheme(id);
            if (theme && theme.baseColor) return theme.baseColor;
        }
        return '#888888';
    },
});
