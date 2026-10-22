"use strict";

// Victory / defeat screens: the planet that was fought on (icon, name,
// galaxy) and a stepper of its stages (1..N + BOSS) — cleared ones checked,
// the one just fought marked WON or LOST, later ones locked.
// Ambush encounters show the destroyed lead enemy ship instead of a planet.
extendClass(GameControlSystem, {
    /** Lead / champion ship type for an ambush (or other encounter) sector. */
    getOutcomeEnemyShipType(level, cfg) {
        const fromGfx = cfg && cfg.graphics && cfg.graphics.enemyShip;
        if (fromGfx) return String(fromGfx);
        if (level && level.enemyType) return String(level.enemyType);
        const list = (level && level.enemies) || (cfg && cfg.enemies) || [];
        const lead = list.filter((e) => e && e.champion).pop() || list[0];
        return String((lead && lead.type) || 'enemyBasic');
    },

    paintOutcomeAmbushShip(box) {
        const canvas = box && box.querySelector('canvas.outcome-ambush-ship');
        if (!canvas) return;
        const type = canvas.dataset.enemyType || 'enemyBasic';
        const size = 320;
        if (canvas.width !== size) canvas.width = size;
        if (canvas.height !== size) canvas.height = size;
        const paint = (model) => {
            if (!model || !canvas.isConnected) return;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            ctx.imageSmoothingEnabled = false;
            if (ctx.mozImageSmoothingEnabled !== undefined) ctx.mozImageSmoothingEnabled = false;
            if (ctx.webkitImageSmoothingEnabled !== undefined) ctx.webkitImageSmoothingEnabled = false;
            if (ctx.msImageSmoothingEnabled !== undefined) ctx.msImageSmoothingEnabled = false;
            ctx.clearRect(0, 0, size, size);
            const loader = (typeof graphicsManager !== 'undefined' && graphicsManager.shipAssetLoader)
                || (typeof shipAssetLoader !== 'undefined' ? shipAssetLoader : null);
            if (loader && loader.renderShip) {
                const shipW = model.width || 16;
                const shipH = model.height || 12;
                const fit = Math.max(1, Math.floor(Math.min(size / shipW, size / shipH) * 0.72));
                const rw = shipW * fit;
                const rh = shipH * fit;
                const ox = Math.floor((size - rw) / 2);
                const oy = Math.floor((size - rh) / 2);
                loader.renderShip(ctx, model, ox, oy, fit, null, 0);
                return;
            }
            if (typeof shipRenderer !== 'undefined' && shipRenderer.renderShipPreview) {
                if (shipRenderer.init) shipRenderer.init();
                shipRenderer.renderShipPreview(canvas, model, 1);
            }
        };
        let model = null;
        // Ambushes are always pirate — paint the pirate class visual, not the
        // hull type's default faction (fighter→terran, interceptor→kronax, …).
        if (typeof factionShipStyles !== 'undefined' && factionShipStyles.resolveFactionShipVisual) {
            let enemyClass = 'assault';
            let tier = 1;
            if (typeof planetConfigManager !== 'undefined' && planetConfigManager.taxonomyForType) {
                const tax = planetConfigManager.taxonomyForType(type);
                if (tax && tax.enemyClass) enemyClass = tax.enemyClass;
            }
            const level = this.coreLevelManager && this.coreLevelManager.getCurrentLevel
                ? this.coreLevelManager.getCurrentLevel() : null;
            const lead = ((level && level.enemies) || []).find((e) => e && e.champion)
                || ((level && level.enemies) || [])[0];
            if (lead && lead.level != null) tier = Math.max(1, Number(lead.level) || 1);
            const visual = factionShipStyles.resolveFactionShipVisual({
                faction: 'pirate',
                enemyClass: enemyClass,
                typeId: type,
                tier: tier,
                level: tier
            });
            if (visual && visual.model) model = visual.model;
        }
        if (!model && typeof enemyConfigManager !== 'undefined' && enemyConfigManager.getMergedModel) {
            model = enemyConfigManager.getMergedModel(type);
        }
        if (model) {
            paint(model);
            return;
        }
        if (typeof enemyManager !== 'undefined' && enemyManager.getEnemyShipModel) {
            enemyManager.getEnemyShipModel(type).then(paint).catch(() => {});
        }
    },

    renderOutcomeStepperHtml(result) {
        const level = this.coreLevelManager && this.coreLevelManager.getCurrentLevel
            ? this.coreLevelManager.getCurrentLevel() : null;
        if (!level) return '';
        const pid = String(level.planetId || (level.id && String(level.id).split('-')[0]) || '').toLowerCase();
        if (!pid) return '';
        const pcm = typeof planetConfigManager !== 'undefined' ? planetConfigManager : null;
        const isAmbush = pid.indexOf('ambush_') === 0;
        const cfg = pcm && pcm.getConfig ? pcm.getConfig(pid) : null;
        const gid = (cfg && cfg.galaxyId)
            || (pcm && (pcm.getWorldGalaxyOfPlanet ? pcm.getWorldGalaxyOfPlanet(pid) : pcm.getPlanetGalaxyId(pid)))
            || (isAmbush ? pid.slice('ambush_'.length) : null);
        const galaxy = gid && pcm && pcm.getGalaxy ? pcm.getGalaxy(gid) : null;
        let name = String(level.planetName || (cfg && cfg.name) || '').toUpperCase();
        // Never show the internal ambush id (AMBUSH_MILKY_WAY) after a stub rebuild.
        if (isAmbush && (!name || name === pid.toUpperCase() || name.indexOf('AMBUSH_') === 0)) {
            const variant = cfg && cfg.ambushVariant;
            name = variant === 'pack' ? 'PIRATE PACK'
                : (variant === 'swarm' ? 'PIRATE SWARM' : 'PIRATE AMBUSH');
        }
        if (!name) name = pid.toUpperCase();
        let icon = '';
        if (isAmbush) {
            const shipType = this.getOutcomeEnemyShipType(level, cfg);
            icon = `<canvas class="outcome-ambush-ship" width="320" height="320" data-enemy-type="${shipType}" aria-hidden="true"></canvas>`;
        } else if (typeof galaxyMapManager !== 'undefined' && galaxyMapManager.planetIconHtml) {
            // Victory and defeat share the wide layout with the large globe.
            icon = galaxyMapManager.planetIconHtml(pid, 620, true);
        }

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
                const transit = !boss && isTransitStage(pid, i);
                const done = boss ? !!st.bossCleared : i <= (st.highestStage || 0);
                let state = done ? 'done' : 'locked';
                if (i === current) state = result === 'won' ? 'won' : 'lost';
                const mark = state === 'won' || state === 'done' ? '✓' : (state === 'lost' ? '✕' : (boss ? '☠' : (transit ? '»' : String(i))));
                list.push(`<li class="outcome-step is-${state}${boss ? ' is-boss' : ''}" title="${boss ? 'BOSS' : (transit ? 'TRANSIT ' : 'STAGE ') + i}">` +
                    `<span class="outcome-step-dot">${mark}</span></li>`);
            }
            const which = level.isBoss ? 'BOSS' : 'STAGE ' + current + '/' + (n + 1);
            steps = `<ol class="outcome-stepper">${list.join('')}</ol>` +
                `<p class="outcome-status">${which} ${result === 'won' ? 'CLEARED' : 'FAILED'}</p>`;
        }
        // Atmosphere haze tone of the planet (same rings as the sector card, css part-23).
        // The icon is an <img>; read the haze tone from a small inline-SVG render of the same planet.
        const atmoSvg = (!isAmbush && typeof galaxyMapManager !== 'undefined' && galaxyMapManager.planetAtmoColor)
            ? galaxyMapManager.planetIconHtml(pid, 64, false) : '';
        const atmo = atmoSvg ? galaxyMapManager.planetAtmoColor(atmoSvg) : '';
        const atmoAttr = atmo ? ` style="--atmo:${atmo};--dk:${galaxyMapManager.planetAtmoScale(atmoSvg)}"` : '';
        return `<span class="outcome-planet-icon${isAmbush ? ' is-ambush-wreck' : ''}${atmo ? ' has-atmo' : ''}"${atmoAttr} aria-hidden="true">${icon}</span>` +
            `<div class="outcome-planet">` +
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
        box.classList.toggle('is-ambush', !!(box.querySelector('canvas.outcome-ambush-ship')));
        if (this.paintOutcomeAmbushShip) this.paintOutcomeAmbushShip(box);
    }
});
