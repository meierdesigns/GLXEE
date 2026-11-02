"use strict";

// Soundtrack Editor (dev mode → Settings → Soundtrack Editor): assigns a
// YouTube URL or a local audio file to a stage or an enemy type, overriding
// the planet track / procedural drone. Priority at playback time (see
// js/game/sounds/soundtrack-override.js): active enemy type > stage > planet.
class SoundtrackEditorUI {
    constructor() {
        this.selectedKind = 'stage';
        this.selectedId = null;
        this.ensureOverlay();
    }

    getStageIds() {
        if (typeof levelManager !== 'undefined' && levelManager.getAllStageIds) {
            try {
                const ids = levelManager.getAllStageIds();
                if (Array.isArray(ids) && ids.length) return ids;
            } catch (e) { /* fall through */ }
        }
        return [];
    }

    getEnemyTypeIds() {
        const ids = [];
        if (typeof enemyConfigManager !== 'undefined' && enemyConfigManager.getTypeIds) {
            try { ids.push(...enemyConfigManager.getTypeIds()); } catch (e) { /* ignore */ }
        }
        if (!ids.length && typeof planetConfigManager !== 'undefined' && planetConfigManager.availableEnemyTypes) {
            ids.push(...planetConfigManager.availableEnemyTypes);
        }
        ids.push('boss');
        return [...new Set(ids)];
    }

    ensureOverlay() {
        if (document.getElementById('soundtrackEditorOverlay')) return;
        const overlay = document.createElement('div');
        overlay.id = 'soundtrackEditorOverlay';
        overlay.className = 'difficulty-editor-overlay hidden';
        overlay.innerHTML = `
            <div class="difficulty-editor-panel">
                <header class="difficulty-editor-header">
                    <h2>SOUNDTRACK EDITOR</h2>
                    <button type="button" class="de-close" id="steClose">×</button>
                </header>
                <div class="difficulty-editor-body">
                    <aside class="difficulty-editor-nav">
                        <div class="de-section-title">MENU</div>
                        <div id="steMenuList"></div>
                        <div class="de-section-title">STAGES</div>
                        <div id="steStageList"></div>
                        <div class="de-section-title">ENEMY TYPES</div>
                        <div id="steEnemyList"></div>
                    </aside>
                    <main class="difficulty-editor-controls" id="steControls"></main>
                </div>
                <footer class="difficulty-editor-footer">
                    <button type="button" class="pe-btn" id="steBack">BACK</button>
                </footer>
            </div>`;
        document.body.appendChild(overlay);
        const q = (s) => overlay.querySelector(s);
        q('#steClose').addEventListener('click', () => this.hide());
        q('#steBack').addEventListener('click', () => this.hide());
        overlay.addEventListener('keydown', (e) => {
            if (e.target && (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT')) {
                if (e.key === 'Escape') this.hide();
                return;
            }
            e.stopPropagation();
            if (e.key === 'Escape') this.hide();
        });
    }

    renderNavButton(container, label, kind, id, trackGetter) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'de-profile-btn';
        const hasTrack = typeof soundtrackConfigManager !== 'undefined' && soundtrackConfigManager.hasTrack(trackGetter());
        b.textContent = (hasTrack ? '♪ ' : '') + label;
        if (kind === this.selectedKind && id === this.selectedId) b.classList.add('pe-primary');
        b.addEventListener('click', () => {
            this.selectedKind = kind;
            this.selectedId = id;
            this.render();
        });
        container.appendChild(b);
    }

    show() {
        this.ensureOverlay();
        this._returnToSettings = !!(typeof startScreenManager !== 'undefined' && startScreenManager
            && (startScreenManager.showSettings || startScreenManager.overlayMode || startScreenManager.embeddedMode));
        if (typeof startScreenManager !== 'undefined' && startScreenManager) {
            if (startScreenManager.overlayMode) startScreenManager.hideOverlay();
            if (startScreenManager.embeddedMode) startScreenManager.hideEmbedded();
        }
        if (typeof settingsManager !== 'undefined' && settingsManager.hideSettings) settingsManager.hideSettings();
        const overlay = document.getElementById('soundtrackEditorOverlay');
        if (overlay.parentNode !== document.body) document.body.appendChild(overlay);
        overlay.classList.remove('hidden');
        this.render();
    }

    hide() {
        const overlay = document.getElementById('soundtrackEditorOverlay');
        if (overlay) overlay.classList.add('hidden');
        if (typeof localAudioManager !== 'undefined') localAudioManager.stop();
        if (this._returnToSettings && typeof startScreenManager !== 'undefined' && startScreenManager) {
            this._returnToSettings = false;
            startScreenManager.showSettings = true;
            startScreenManager.showCredits = false;
            if (startScreenManager.hasActiveProfile && startScreenManager.hasActiveProfile()
                && typeof homeStationUI !== 'undefined') {
                if (!homeStationUI.isVisible) homeStationUI.show({ skipPersist: true });
                startScreenManager.show({ asOverlay: true, showSettings: true });
            } else {
                startScreenManager.show({ forceMenu: true });
            }
        }
    }

    render() {
        const menuList = document.getElementById('steMenuList');
        const stageList = document.getElementById('steStageList');
        const enemyList = document.getElementById('steEnemyList');
        menuList.innerHTML = '';
        stageList.innerHTML = '';
        enemyList.innerHTML = '';

        this.renderNavButton(menuList, 'Main Menu', 'menu', 'menu',
            () => soundtrackConfigManager.getMenuTrack());
        this.getStageIds().forEach((id) => {
            this.renderNavButton(stageList, id, 'stage', id,
                () => soundtrackConfigManager.getStageTrack(id));
        });
        this.getEnemyTypeIds().forEach((id) => {
            this.renderNavButton(enemyList, id, 'enemy', id,
                () => soundtrackConfigManager.getEnemyTrack(id));
        });

        const host = document.getElementById('steControls');
        host.innerHTML = '';
        if (!this.selectedId) {
            const hint = document.createElement('p');
            hint.className = 'ss-code-hint';
            hint.textContent = 'Pick a stage or enemy type on the left. Enemy-type overrides win over stage overrides, which win over the planet track.';
            host.appendChild(hint);
            return;
        }
        this.renderEditorFor(host, this.selectedKind, this.selectedId);
    }

    renderEditorFor(host, kind, id) {
        const title = document.createElement('div');
        title.className = 'de-section-title';
        title.textContent = (kind === 'menu' ? 'MAIN MENU' : kind === 'stage' ? 'STAGE: ' + id : 'ENEMY TYPE: ' + id);
        host.appendChild(title);

        const getTrack = () => {
            const t = kind === 'menu' ? soundtrackConfigManager.getMenuTrack()
                : kind === 'stage' ? soundtrackConfigManager.getStageTrack(id)
                : soundtrackConfigManager.getEnemyTrack(id);
            return t || { youtubeUrl: '', localAudioData: '', localAudioName: '' };
        };
        const setTrack = (data) => {
            if (kind === 'menu') soundtrackConfigManager.setMenuTrack(data);
            else if (kind === 'stage') soundtrackConfigManager.setStageTrack(id, data);
            else soundtrackConfigManager.setEnemyTrack(id, data);
            if (kind === 'menu' && typeof soundManager !== 'undefined' && soundManager.startMenuMusic) {
                // Re-apply immediately so a change is audible while the editor is open.
                soundManager.startMenuMusic();
            }
            this.render();
        };

        const track = getTrack();

        const urlRow = document.createElement('div');
        urlRow.className = 'de-slider-row';
        const urlLabel = document.createElement('label');
        urlLabel.textContent = 'YOUTUBE URL';
        const urlInput = document.createElement('input');
        urlInput.type = 'text';
        urlInput.placeholder = 'https://youtu.be/...';
        urlInput.value = track.youtubeUrl || '';
        urlInput.spellcheck = false;
        urlInput.addEventListener('keydown', (e) => e.stopPropagation());
        urlInput.addEventListener('change', () => {
            setTrack({ youtubeUrl: urlInput.value.trim(), localAudioData: '', localAudioName: '' });
        });
        urlRow.append(urlLabel, urlInput);
        host.appendChild(urlRow);

        const fileRow = document.createElement('div');
        fileRow.className = 'de-slider-row';
        const fileLabel = document.createElement('label');
        fileLabel.textContent = 'LOCAL AUDIO';
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'audio/*';
        fileInput.addEventListener('change', () => {
            const file = fileInput.files && fileInput.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                setTrack({ youtubeUrl: '', localAudioData: reader.result, localAudioName: file.name });
            };
            reader.readAsDataURL(file);
        });
        fileRow.append(fileLabel, fileInput);
        host.appendChild(fileRow);

        if (track.localAudioName) {
            const fileNote = document.createElement('p');
            fileNote.className = 'ss-code-hint';
            fileNote.textContent = 'Current file: ' + track.localAudioName;
            host.appendChild(fileNote);
        }

        const btnRow = document.createElement('div');
        btnRow.className = 'de-slider-row';
        const previewBtn = document.createElement('button');
        previewBtn.type = 'button';
        previewBtn.className = 'pe-btn';
        previewBtn.textContent = 'PREVIEW';
        previewBtn.addEventListener('click', () => {
            const t = getTrack();
            if (t.localAudioData && typeof localAudioManager !== 'undefined') {
                localAudioManager.setVolume(0.3);
                localAudioManager.play('preview:' + kind + ':' + id, t.localAudioData);
            } else if (t.youtubeUrl && typeof youtubeSoundtrackManager !== 'undefined') {
                youtubeSoundtrackManager.setEnabled(true);
                youtubeSoundtrackManager.setVolume(0.3);
                youtubeSoundtrackManager.playUrl('preview:' + kind + ':' + id, t.youtubeUrl);
            }
        });
        const clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.className = 'pe-btn';
        clearBtn.textContent = 'CLEAR';
        clearBtn.addEventListener('click', () => {
            if (typeof localAudioManager !== 'undefined') localAudioManager.stop();
            if (typeof youtubeSoundtrackManager !== 'undefined') youtubeSoundtrackManager.stop();
            setTrack(null);
        });
        btnRow.append(previewBtn, clearBtn);
        host.appendChild(btnRow);
    }
}

const soundtrackEditorUI = new SoundtrackEditorUI();
