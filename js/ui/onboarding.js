"use strict";

/**
 * First-run onboarding: Story → Name → Scrap Fighter reveal.
 */
class OnboardingManager {
    constructor() {
        this.isVisible = false;
        this.overlay = null;
        this._keyHandler = null;
        this.step = 'story'; // story | name | scrap
        this.onComplete = null;
        this._pendingName = '';
    }

    show(options) {
        this.isVisible = true;
        this.onComplete = options && options.onComplete;
        this.step = 'story';
        this._pendingName = '';
        this.createUI();
        if (typeof menuStateManager !== 'undefined') {
            menuStateManager.setScreen('onboarding');
        }
    }

    hide() {
        this.isVisible = false;
        if (this._keyHandler) {
            document.removeEventListener('keydown', this._keyHandler);
            this._keyHandler = null;
        }
        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
        }
    }

    finish() {
        const cb = this.onComplete;
        this.hide();
        if (typeof cb === 'function') cb();
    }

    createUI() {
        if (this.overlay) this.overlay.remove();
        if (this._keyHandler) {
            document.removeEventListener('keydown', this._keyHandler);
            this._keyHandler = null;
        }

        this.overlay = document.createElement('div');
        this.overlay.className = 'profile-selection-overlay onboarding-overlay';

        if (this.step === 'story') {
            this.overlay.innerHTML = `
                <div class="profile-selection-content onboarding-content">
                    <h2 class="profile-selection-title">CRASH SITE</h2>
                    <div class="onboarding-story">
                        <p>YOUR SHIP DID NOT SURVIVE THE DESCENT.</p>
                        <p>ON THE SURFACE YOU SALVAGE WHAT YOU CAN — HULL PLATES, A BATTERED LASER, A FLICKERING SHIELD CELL.</p>
                        <p>FROM THE WRECKAGE YOU BOLT TOGETHER A SCRAP FIGHTER.</p>
                        <p>IT WILL NOT WIN A WAR. IT WILL GET YOU OFF THE GROUND.</p>
                    </div>
                    <div class="profile-selection-actions">
                        <button class="action-button" id="obNext">CONTINUE</button>
                    </div>
                    <div class="profile-selection-instructions"><p>ENTER Continue</p></div>
                </div>`;
        } else if (this.step === 'name') {
            this.overlay.innerHTML = `
                <div class="profile-selection-content onboarding-content">
                    <h2 class="profile-selection-title">PILOT CALLSIGN</h2>
                    <p class="onboarding-hint">ENTER YOUR NAME</p>
                    <input type="text" class="profile-name-input" id="obNameInput" maxlength="16" placeholder="NAME" autocomplete="off" spellcheck="false"/>
                    <div class="profile-selection-actions">
                        <button class="action-button" id="obNext">CONFIRM</button>
                    </div>
                    <div class="profile-selection-instructions"><p>ENTER Confirm</p></div>
                </div>`;
        } else {
            this.overlay.innerHTML = `
                <div class="profile-selection-content onboarding-content">
                    <h2 class="profile-selection-title">SCRAP FIGHTER</h2>
                    <p class="onboarding-hint">ASSEMBLED FROM CRASHED WRECKAGE</p>
                    <div class="onboarding-ship-wrap">
                        <canvas class="onboarding-ship-canvas" width="300" height="200"></canvas>
                    </div>
                    <p class="onboarding-ship-stats">LASER · ENERGY SHIELD · BARELY FLIGHTWORTHY</p>
                    <p class="hs-status">SCRAP FIGHTER READY</p>
                    <div class="profile-selection-actions">
                        <button class="action-button" id="obNext">TO MAIN MENU</button>
                    </div>
                    <div class="profile-selection-instructions"><p>ENTER Continue</p></div>
                </div>`;
        }

        document.body.appendChild(this.overlay);
        if (typeof VFBgMouseParallax !== 'undefined' && VFBgMouseParallax.refresh) {
            VFBgMouseParallax.refresh();
        }
        this.bindStep();
    }

    bindStep() {
        const next = this.overlay.querySelector('#obNext');
        if (next) next.addEventListener('click', () => this.advance());

        if (this.step === 'name') {
            const input = this.overlay.querySelector('#obNameInput');
            if (input) {
                input.focus();
                if (this._pendingName) input.value = this._pendingName;
            }
        }

        if (this.step === 'scrap') {
            this.renderScrapPreview();
        }

        this._keyHandler = (e) => {
            if (!this.isVisible) return;
            if (this.step === 'name' && e.target && e.target.id === 'obNameInput') {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.advance();
                }
                return;
            }
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.advance();
            }
        };
        document.addEventListener('keydown', this._keyHandler);
    }

    advance() {
        if (this.step === 'story') {
            this.step = 'name';
            this.createUI();
            return;
        }
        if (this.step === 'name') {
            const input = this.overlay.querySelector('#obNameInput');
            const name = input ? input.value : '';
            if (typeof profileManager === 'undefined') return;
            const p = profileManager.create(name);
            if (!p) {
                if (input) {
                    input.classList.add('nav-focused');
                    input.focus();
                }
                return;
            }
            profileManager.setActive(p.id);
            this._pendingName = p.name;
            this.step = 'scrap';
            this.createUI();
            return;
        }
        this.finish();
    }

    renderScrapPreview() {
        const canvas = this.overlay.querySelector('.onboarding-ship-canvas');
        if (!canvas) return;
        let ship = null;
        if (typeof shipConfigManager !== 'undefined') {
            ship = shipConfigManager.getMergedModel('player_scrap');
        }
        if (!ship) {
            ship = {
                id: 'player_scrap',
                name: 'Scrap Fighter',
                modelClass: 'starfighter',
                width: 20,
                height: 16
            };
        }
        if (typeof shipRenderer !== 'undefined' && shipRenderer.renderShipPreview) {
            shipRenderer.renderShipPreview(canvas, ship, 1.5);
        } else if (typeof combinedSelectionManager !== 'undefined' &&
            combinedSelectionManager.renderShipPreview) {
            combinedSelectionManager.renderShipPreview(canvas, ship, 1.5);
        }
    }
}

const onboardingManager = new OnboardingManager();
window.onboardingManager = onboardingManager;
