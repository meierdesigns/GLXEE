"use strict";

class DifficultyEditorUI {
    constructor() {
        this.visible = false;
        this.profileId = (typeof difficultyConfigManager !== 'undefined')
            ? difficultyConfigManager.current : 'normal';
        this.ensureOverlay();
    }

    ensureOverlay() {
        if (document.getElementById('difficultyEditorOverlay')) return;
        const overlay = document.createElement('div');
        overlay.id = 'difficultyEditorOverlay';
        overlay.className = 'difficulty-editor-overlay hidden';
        overlay.innerHTML = `
            <div class="difficulty-editor-panel">
                <header class="difficulty-editor-header">
                    <h2>COMBAT DIFFICULTY</h2>
                    <button type="button" class="de-close" id="deClose">×</button>
                </header>
                <div class="difficulty-editor-body">
                    <aside class="difficulty-editor-nav">
                        <div class="de-section-title">PRESET</div>
                        <div id="deProfiles"></div>
                        <div class="de-section-title">ENEMY AI</div>
                        <label class="de-select-label">FACTION
                            <select id="deFaction"></select>
                        </label>
                        <label class="de-select-label">SHIP TIER
                            <select id="deTier">
                                <option value="1">TIER 1</option>
                                <option value="2">TIER 2</option>
                                <option value="3">TIER 3</option>
                                <option value="4">TIER 4</option>
                            </select>
                        </label>
                    </aside>
                    <main class="difficulty-editor-controls" id="deControls"></main>
                </div>
                <footer class="difficulty-editor-footer">
                    <button type="button" class="pe-btn" id="deReset">RESET PRESET</button>
                    <button type="button" class="pe-btn pe-primary" id="deSave">SAVE</button>
                    <button type="button" class="pe-btn" id="deBack">BACK</button>
                </footer>
            </div>`;
        document.body.appendChild(overlay);
        overlay.querySelector('#deClose').addEventListener('click', () => this.hide());
        overlay.querySelector('#deBack').addEventListener('click', () => this.hide());
        overlay.querySelector('#deSave').addEventListener('click', () => this.save());
        overlay.querySelector('#deReset').addEventListener('click', () => this.reset());
        overlay.querySelector('#deFaction').addEventListener('change', () => this.renderAI());
        overlay.querySelector('#deTier').addEventListener('change', () => this.renderAI());
    }

    show() {
        this.ensureOverlay();
        this.visible = true;
        this._returnToSettings = !!(typeof startScreenManager !== 'undefined'
            && startScreenManager
            && (startScreenManager.showSettings
                || startScreenManager.overlayMode
                || startScreenManager.embeddedMode));
        if (typeof startScreenManager !== 'undefined' && startScreenManager) {
            if (startScreenManager.overlayMode) startScreenManager.hideOverlay();
            if (startScreenManager.embeddedMode) startScreenManager.hideEmbedded();
        }
        if (typeof settingsManager !== 'undefined' && settingsManager.hideSettings) {
            settingsManager.hideSettings();
        }
        const overlay = document.getElementById('difficultyEditorOverlay');
        if (overlay.parentNode !== document.body) document.body.appendChild(overlay);
        overlay.classList.remove('hidden');
        this.render();
    }

    hide() {
        this.visible = false;
        const overlay = document.getElementById('difficultyEditorOverlay');
        if (overlay) overlay.classList.add('hidden');
        if (this._returnToSettings && typeof startScreenManager !== 'undefined' && startScreenManager) {
            this._returnToSettings = false;
            startScreenManager.showSettings = true;
            startScreenManager.showCredits = false;
            if (startScreenManager.hasActiveProfile && startScreenManager.hasActiveProfile()
                && typeof homeStationUI !== 'undefined') {
                if (!homeStationUI.isVisible) {
                    homeStationUI.show({ skipPersist: true });
                }
                startScreenManager.show({ asOverlay: true, showSettings: true });
            } else {
                startScreenManager.show({ forceMenu: true });
            }
        }
    }

    makeSlider(label, key, min, max, step, value, onInput) {
        const row = document.createElement('div');
        row.className = 'de-slider-row';
        const title = document.createElement('label');
        title.textContent = label;
        const output = document.createElement('output');
        output.textContent = Number(value).toFixed(step < 1 ? 2 : 0);
        const input = document.createElement('input');
        input.type = 'range';
        input.min = min;
        input.max = max;
        input.step = step;
        input.value = value;
        input.dataset.key = key;
        input.addEventListener('input', () => {
            output.textContent = Number(input.value).toFixed(step < 1 ? 2 : 0);
            onInput(Number(input.value));
        });
        row.append(title, input, output);
        return row;
    }

    render() {
        const manager = window.difficultyConfigManager;
        if (!manager) return;
        const profiles = document.getElementById('deProfiles');
        profiles.innerHTML = '';
        Object.keys(manager.profiles).forEach((id) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'de-profile-btn' + (id === this.profileId ? ' active' : '');
            button.textContent = id.toUpperCase();
            button.addEventListener('click', () => {
                this.profileId = id;
                this.render();
            });
            profiles.appendChild(button);
        });
        const faction = document.getElementById('deFaction');
        faction.innerHTML = Object.keys(manager.factionProfiles)
            .map((id) => `<option value="${id}">${id.toUpperCase()}</option>`).join('');
        this.renderProfile();
        this.renderAI();
    }

    renderProfile() {
        const root = document.getElementById('deControls');
        const profile = window.difficultyConfigManager.getProfile(this.profileId);
        root.innerHTML = '<h3>GLOBAL COMBAT VALUES</h3>';
        const fields = [
            ['Enemy damage', 'enemyDamageMul', 0, 3, 0.05],
            ['Player damage', 'playerDamageMul', 0, 3, 0.05],
            ['Enemy health', 'enemyHealthMul', 0.25, 4, 0.05],
            ['Enemy speed', 'enemySpeedMul', 0.25, 3, 0.05],
            ['Number of enemies', 'enemyCountMul', 0.25, 3, 0.05],
            ['Max active enemies', 'enemyMaxActive', 1, 10, 1],
            ['Obstacle frequency', 'obstacleSpawnMul', 0.25, 3, 0.05]
        ];
        fields.forEach(([label, key, min, max, step]) => {
            root.appendChild(this.makeSlider(label, key, min, max, step, profile[key], (value) => {
                profile[key] = value;
            }));
        });
        root.dataset.profile = this.profileId;
        root._profileDraft = profile;
    }

    renderAI() {
        const manager = window.difficultyConfigManager;
        const faction = document.getElementById('deFaction').value;
        const tier = document.getElementById('deTier').value;
        const cfg = manager.factionProfiles[faction];
        const tierCfg = manager.tierProfiles[tier];
        const root = document.getElementById('deControls');
        const old = root.querySelector('.de-ai-controls');
        if (old) old.remove();
        const aiRoot = document.createElement('section');
        aiRoot.className = 'de-ai-controls';
        const heading = document.createElement('h3');
        heading.textContent = `${faction.toUpperCase()} — TIER ${tier} AI`;
        aiRoot.appendChild(heading);
        [['Evasion', 'evasion'], ['Prediction', 'prediction'], ['Damage', 'damage']]
            .forEach(([label, key]) => {
                aiRoot.appendChild(this.makeSlider(label, key, 0, 3, 0.05, (cfg[key] || 1) * (tierCfg[key] || 1), (value) => {
                    cfg[key] = value / (tierCfg[key] || 1);
                }));
            });
        root.appendChild(aiRoot);
    }

    save() {
        const root = document.getElementById('deControls');
        const draft = root._profileDraft;
        if (draft) window.difficultyConfigManager.setProfile(this.profileId, draft);
        window.difficultyConfigManager.setDifficulty(this.profileId);
        if (typeof settingsManager !== 'undefined') {
            settingsManager.settings.difficulty = this.profileId;
            settingsManager.applyDifficultySettings();
            settingsManager.updateSettingsDisplay();
        }
        if (typeof startScreenManager !== 'undefined' && startScreenManager.settingsItems) {
            const difficultyItem = startScreenManager.settingsItems.find((item) => item.name === 'Difficulty');
            if (difficultyItem) {
                difficultyItem.value = String(this.profileId || 'normal').toUpperCase();
            }
        }
        this.hide();
    }

    reset() {
        window.difficultyConfigManager.resetProfile(this.profileId);
        this.render();
    }
}

const difficultyEditorUI = new DifficultyEditorUI();
window.difficultyEditorUI = difficultyEditorUI;
