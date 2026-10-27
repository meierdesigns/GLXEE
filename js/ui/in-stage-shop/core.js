"use strict";

/**
 * In-stage shop: a kiosk beside some sluice gates (see objective-manager.js
 * getShopStation/isNearShopStation). Walk up, press E, buy a stage-only
 * buff or a temporary weapon with a shot limit, paid in real credits.
 */
class InStageShop {
    constructor() {
        this.isOpen = false;
        this.prevInteract = false;
        this.lastMsg = '';
    }

    catalog() {
        return {
            buffs: [
                { id: 'barrier', label: 'SHIELD BARRIER', desc: 'Halves incoming damage', cost: 60, ms: 60000 },
                { id: 'speed_boost', label: 'AFTERBURNER', desc: 'Faster movement', cost: 45, ms: 60000 },
                { id: 'power_shot', label: 'POWER SHOT', desc: 'Bigger, stronger shots', cost: 70, ms: 60000 }
            ],
            weapons: [
                { id: 'spread', label: 'SPREAD GUN', shots: 30, cost: 50 },
                { id: 'missile', label: 'MISSILES', shots: 12, cost: 80 },
                { id: 'plasma', label: 'PLASMA CANNON', shots: 20, cost: 90 }
            ]
        };
    }

    /** Called every frame while a stage is running and not paused. */
    update(deltaTime, keys) {
        if (typeof shopkeeperFace !== 'undefined') shopkeeperFace.update(deltaTime);
        if (this.isOpen) return;
        const near = typeof objectiveManager !== 'undefined' && objectiveManager.isNearShopStation
            && objectiveManager.isNearShopStation();
        if (!near) {
            this.prevInteract = false;
            return;
        }
        const interact = !!(keys && (keys['e'] || keys['E']));
        if (interact && !this.prevInteract) this.show();
        this.prevInteract = interact;
    }

    show() {
        if (this.isOpen) return;
        this.isOpen = true;
        if (typeof shopkeeperFace !== 'undefined') shopkeeperFace.setState('idle', 0);
        if (typeof game !== 'undefined' && game.gameState && game.gameState.pauseGame) game.gameState.pauseGame();
        this.renderDom();
    }

    close() {
        if (!this.isOpen) return;
        this.isOpen = false;
        if (this._faceRaf) cancelAnimationFrame(this._faceRaf);
        const el = document.getElementById('vf-in-stage-shop');
        if (el) el.remove();
        if (typeof game !== 'undefined' && game.gameState && game.gameState.resumeGame) game.gameState.resumeGame();
    }

    getCredits() {
        return (typeof profileManager !== 'undefined' && profileManager.getCredits) ? profileManager.getCredits() : 0;
    }

    buyBuff(item) {
        if (typeof profileManager === 'undefined' || !profileManager.canAffordCredits(item.cost)) {
            this.flashFace('sad');
            return;
        }
        profileManager.spendCredits(item.cost);
        if (typeof pickupManager !== 'undefined' && pickupManager.grantPowerUp) {
            pickupManager.grantPowerUp(item.id, item.ms);
        }
        this.flashFace('happy');
        this.renderDom();
    }

    buyWeapon(item) {
        if (typeof profileManager === 'undefined' || !profileManager.canAffordCredits(item.cost)) {
            this.flashFace('sad');
            return;
        }
        profileManager.spendCredits(item.cost);
        if (typeof bulletManager !== 'undefined' && bulletManager.equipTemporaryWeapon) {
            bulletManager.equipTemporaryWeapon(item.id, item.shots);
        }
        this.flashFace('happy');
        this.renderDom();
    }

    flashFace(state) {
        if (typeof shopkeeperFace !== 'undefined') shopkeeperFace.setState(state, 1200);
    }

    rowHtml(item, kind) {
        const afford = this.getCredits() >= item.cost;
        const sub = kind === 'weapon' ? `${item.shots} shots` : item.desc;
        return `<div class="vf-shop-row">` +
            `<div class="vf-shop-row-text"><b>${item.label}</b><span>${sub}</span></div>` +
            `<button type="button" data-shop-buy="${kind}:${item.id}" ${afford ? '' : 'disabled'}>${item.cost}c</button>` +
            `</div>`;
    }

    renderDom() {
        let el = document.getElementById('vf-in-stage-shop');
        if (!el) {
            el = document.createElement('div');
            el.id = 'vf-in-stage-shop';
            el.style.cssText = 'position:fixed;inset:0;z-index:9000;display:flex;align-items:center;justify-content:center;background:rgba(5,6,10,0.72);font-family:monospace;color:#e8f0ff;';
            document.body.appendChild(el);
            el.addEventListener('click', (e) => {
                const buyBtn = e.target.closest('[data-shop-buy]');
                if (buyBtn) {
                    const [kind, id] = buyBtn.getAttribute('data-shop-buy').split(':');
                    const list = kind === 'weapon' ? this.catalog().weapons : this.catalog().buffs;
                    const item = list.find((i) => i.id === id);
                    if (item) kind === 'weapon' ? this.buyWeapon(item) : this.buyBuff(item);
                    return;
                }
                if (e.target.closest('[data-shop-close]')) this.close();
            });
        }
        const c = this.catalog();
        el.innerHTML =
            `<div style="background:#10141c;border:2px solid #3a4a64;border-radius:6px;padding:14px;width:260px;max-width:90vw;">` +
            `<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">` +
            `<canvas id="vf-shop-face" width="40" height="40" style="image-rendering:pixelated;background:#05060a;border-radius:4px;"></canvas>` +
            `<div><div style="font-weight:bold;">TRAVELING TRADER</div><div style="opacity:0.7;font-size:12px;">${this.getCredits()}c on hand</div></div>` +
            `</div>` +
            `<div style="font-size:11px;opacity:0.7;margin:6px 0 2px;">STAGE-ONLY BUFFS</div>` +
            c.buffs.map((i) => this.rowHtml(i, 'buff')).join('') +
            `<div style="font-size:11px;opacity:0.7;margin:10px 0 2px;">TEMPORARY WEAPONS</div>` +
            c.weapons.map((i) => this.rowHtml(i, 'weapon')).join('') +
            `<button type="button" data-shop-close style="margin-top:12px;width:100%;">CLOSE [E]</button>` +
            `</div>`;
        el.querySelectorAll('.vf-shop-row').forEach((row) => {
            row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;padding:4px 0;';
        });
        el.querySelectorAll('.vf-shop-row-text').forEach((d) => {
            d.style.cssText = 'display:flex;flex-direction:column;font-size:12px;';
        });
        this.startFaceLoop();
    }

    startFaceLoop() {
        const canvas = document.getElementById('vf-shop-face');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const tick = () => {
            if (!this.isOpen) return;
            if (typeof shopkeeperFace !== 'undefined') {
                shopkeeperFace.update(16);
                shopkeeperFace.render(ctx, canvas.width, canvas.height);
            }
            this._faceRaf = requestAnimationFrame(tick);
        };
        tick();
    }
}

const inStageShop = new InStageShop();
window.inStageShop = inStageShop;
