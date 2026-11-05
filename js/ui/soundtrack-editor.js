"use strict";

// Soundtrack Editor (dev mode → Settings → Soundtrack Editor):
// YouTube / local audio / vftrack JSON per menu·stage·enemy, plus planet
// tracker library import/export for LLM-authored chiptune loops.
class SoundtrackEditorUI {
    constructor() {
        this.selectedKind = 'planet';
        this.selectedId = 'mars';
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

    getPlanetIds() {
        return ['mars', 'jupiter', 'saturn', 'neptune', 'pluto',
            'mars-boss', 'jupiter-boss', 'saturn-boss', 'neptune-boss', 'pluto-boss'];
    }

    getFactionIds() {
        if (typeof VFTrackerFactionCompose !== 'undefined') return VFTrackerFactionCompose.FACTIONS.slice();
        return ['terran', 'kronax', 'voidborn', 'pirate', 'machine'];
    }

    getFactionCombatKeys() {
        const out = [];
        this.getPlanetIds().filter((p) => p.indexOf('boss') === -1).forEach((p) => {
            this.getFactionIds().forEach((f) => {
                out.push(p + ':' + f);
                out.push(p + '-boss:' + f);
            });
        });
        this.getFactionIds().forEach((f) => out.push('faction:' + f));
        return out;
    }

    getEndingKeys() {
        const out = ['victory', 'lose'];
        this.getFactionIds().forEach((f) => {
            out.push('victory:' + f);
            out.push('lose:' + f);
        });
        return out;
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
                        <div class="de-section-title">PLANET TRACKER</div>
                        <div id="stePlanetList"></div>
                        <div class="de-section-title">PLANET × FACTION</div>
                        <div id="steFactionList"></div>
                        <div class="de-section-title">VICTORY / LOSE</div>
                        <div id="steEndingList"></div>
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

    renderNavButton(container, label, kind, id, hasMark) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'de-profile-btn';
        b.textContent = (hasMark ? '♪ ' : '') + label;
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
        if (typeof vfTrackerManager !== 'undefined') vfTrackerManager.stop();
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
        const planetList = document.getElementById('stePlanetList');
        const factionList = document.getElementById('steFactionList');
        const endingList = document.getElementById('steEndingList');
        const stageList = document.getElementById('steStageList');
        const enemyList = document.getElementById('steEnemyList');
        menuList.innerHTML = '';
        planetList.innerHTML = '';
        if (factionList) factionList.innerHTML = '';
        if (endingList) endingList.innerHTML = '';
        stageList.innerHTML = '';
        enemyList.innerHTML = '';

        const menuHas = typeof soundtrackConfigManager !== 'undefined'
            && soundtrackConfigManager.hasTrack(soundtrackConfigManager.getMenuTrack());
        this.renderNavButton(menuList, 'Main Menu', 'menu', 'menu', menuHas);

        this.getPlanetIds().forEach((id) => {
            const custom = typeof vfTrackerManager !== 'undefined' && vfTrackerManager.library[id];
            this.renderNavButton(planetList, id, 'planet', id, !!custom);
        });
        if (factionList) {
            this.getFactionCombatKeys().forEach((id) => {
                const custom = typeof vfTrackerManager !== 'undefined' && vfTrackerManager.library[id];
                this.renderNavButton(factionList, id, 'planet', id, !!custom);
            });
        }
        if (endingList) {
            this.getEndingKeys().forEach((id) => {
                const custom = typeof vfTrackerManager !== 'undefined' && vfTrackerManager.library[id];
                this.renderNavButton(endingList, id, 'planet', id, !!custom);
            });
        }

        this.getStageIds().forEach((id) => {
            const has = typeof soundtrackConfigManager !== 'undefined'
                && soundtrackConfigManager.hasTrack(soundtrackConfigManager.getStageTrack(id));
            this.renderNavButton(stageList, id, 'stage', id, has);
        });
        this.getEnemyTypeIds().forEach((id) => {
            const has = typeof soundtrackConfigManager !== 'undefined'
                && soundtrackConfigManager.hasTrack(soundtrackConfigManager.getEnemyTrack(id));
            this.renderNavButton(enemyList, id, 'enemy', id, has);
        });

        const host = document.getElementById('steControls');
        host.innerHTML = '';
        if (!this.selectedId) {
            const hint = document.createElement('p');
            hint.className = 'ss-code-hint';
            hint.textContent = 'Planet×faction combat, victory/lose, then stage/enemy overrides. Hostile faction comes from the planet.';
            host.appendChild(hint);
            return;
        }
        if (this.selectedKind === 'planet') this.renderPlanetTracker(host, this.selectedId);
        else this.renderOverrideEditor(host, this.selectedKind, this.selectedId);
    }

    _stopPreview() {
        if (typeof localAudioManager !== 'undefined') localAudioManager.stop();
        if (typeof youtubeSoundtrackManager !== 'undefined') youtubeSoundtrackManager.stop();
        if (typeof vfTrackerManager !== 'undefined') vfTrackerManager.stop();
    }

    _addTrackerTools(host, opts) {
        const { getJson, setJson, libraryKey, title } = opts;

        const section = document.createElement('div');
        section.className = 'de-section-title';
        section.textContent = title || 'VF TRACKER (.vftrack.json)';
        host.appendChild(section);

        const hint = document.createElement('p');
        hint.className = 'ss-code-hint';
        hint.textContent = 'Code / LLM authored chiptune. Import JSON from Gemini etc., or export + edit with assets/soundtracks/LLM_PROMPT.md';
        host.appendChild(hint);

        const ta = document.createElement('textarea');
        ta.rows = 14;
        ta.spellcheck = false;
        ta.style.width = '100%';
        ta.style.fontFamily = 'monospace';
        ta.style.fontSize = '11px';
        ta.value = getJson() || '';
        ta.addEventListener('keydown', (e) => e.stopPropagation());
        host.appendChild(ta);

        const status = document.createElement('p');
        status.className = 'ss-code-hint';
        status.id = 'steTrackerStatus';
        host.appendChild(status);

        const btnRow = document.createElement('div');
        btnRow.className = 'de-slider-row';

        const applyBtn = document.createElement('button');
        applyBtn.type = 'button';
        applyBtn.className = 'pe-btn pe-primary';
        applyBtn.textContent = 'APPLY JSON';
        applyBtn.addEventListener('click', () => {
            try {
                setJson(ta.value);
                status.textContent = 'Applied.';
                this.render();
            } catch (e) {
                status.textContent = 'Error: ' + (e && e.message ? e.message : e);
            }
        });

        const previewBtn = document.createElement('button');
        previewBtn.type = 'button';
        previewBtn.className = 'pe-btn';
        previewBtn.textContent = 'PREVIEW';
        previewBtn.addEventListener('click', () => {
            try {
                const data = JSON.parse(ta.value);
                this._stopPreview();
                if (typeof soundManager !== 'undefined' && soundManager.ensureContext) soundManager.ensureContext();
                if (typeof vfTrackerManager !== 'undefined') {
                    const bus = (typeof soundManager !== 'undefined' && soundManager.musicBusVolume)
                        ? Math.max(0.25, soundManager.musicBusVolume()) : 0.35;
                    vfTrackerManager.setVolume(bus);
                    vfTrackerManager.play('preview:' + (libraryKey || 'edit'), data);
                    status.textContent = 'Playing preview…';
                }
            } catch (e) {
                status.textContent = 'Error: ' + (e && e.message ? e.message : e);
            }
        });

        const stopBtn = document.createElement('button');
        stopBtn.type = 'button';
        stopBtn.className = 'pe-btn';
        stopBtn.textContent = 'STOP';
        stopBtn.addEventListener('click', () => {
            this._stopPreview();
            status.textContent = 'Stopped.';
        });

        const exportBtn = document.createElement('button');
        exportBtn.type = 'button';
        exportBtn.className = 'pe-btn';
        exportBtn.textContent = 'EXPORT';
        exportBtn.addEventListener('click', () => {
            try {
                const compact = VFTrackerParse.toCompact(JSON.parse(ta.value));
                const json = JSON.stringify(compact, null, 2);
                const blob = new Blob([json], { type: 'application/json' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = (libraryKey || 'track') + '.vftrack.json';
                document.body.appendChild(a);
                a.click();
                setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 400);
                status.textContent = 'Exported.';
            } catch (e) {
                status.textContent = 'Export error: ' + (e && e.message ? e.message : e);
            }
        });

        const importBtn = document.createElement('button');
        importBtn.type = 'button';
        importBtn.className = 'pe-btn';
        importBtn.textContent = 'IMPORT FILE';
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json,application/json,.vftrack.json';
        fileInput.style.display = 'none';
        fileInput.addEventListener('change', () => {
            const file = fileInput.files && fileInput.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                ta.value = String(reader.result || '');
                status.textContent = 'Loaded ' + file.name + ' — press APPLY JSON.';
            };
            reader.readAsText(file);
        });
        importBtn.addEventListener('click', () => fileInput.click());

        const promptBtn = document.createElement('button');
        promptBtn.type = 'button';
        promptBtn.className = 'pe-btn';
        promptBtn.textContent = 'COPY LLM PROMPT';
        promptBtn.addEventListener('click', async () => {
            const planet = libraryKey || this.selectedId || 'mars';
            const prompt = this.buildLlmPrompt(planet);
            try {
                await navigator.clipboard.writeText(prompt);
                status.textContent = 'LLM prompt copied.';
            } catch (e) {
                ta.value = prompt;
                status.textContent = 'Clipboard blocked — prompt pasted into the editor.';
            }
        });

        const resetBtn = document.createElement('button');
        resetBtn.type = 'button';
        resetBtn.className = 'pe-btn';
        resetBtn.textContent = 'RESET DEFAULT';
        resetBtn.addEventListener('click', () => {
            setJson(null);
            status.textContent = 'Reverted to built-in default.';
            this.render();
        });

        btnRow.append(applyBtn, previewBtn, stopBtn, exportBtn, importBtn, promptBtn, resetBtn, fileInput);
        host.appendChild(btnRow);
    }

    buildLlmPrompt(planet) {
        const p = String(planet || 'mars');
        return [
            'You write chiptune tracker songs for GLXEE / VolleyFire.',
            'Output ONLY valid JSON, format "vftrack" version 1. No markdown.',
            '',
            'Schema: format, version, meta{title,author,planet,notes}, bpm, rowsPerBeat:1,',
            'rowsPerPattern:16, channels:4, instruments[{id,name,wave,volume,attack,decay,sustain,release,filter}],',
            'patterns[{id, channels:["tok tok ..."]}], order:[0], loop:true.',
            '',
            'Each channels[i] has exactly 16 space-separated tokens.',
            'Tokens: "." | "OFF" | "C-2:1" | "C-2:1:64" | "C#4:2:40" | "Eb3:3:32"',
            'waves: sine|square|sawtooth|triangle|noise. Volume on notes 0-64.',
            'ch0 bass, ch1 lead, ch2 arp, ch3 kick+hat. Sci-fi minor mood.',
            '',
            'Write a vftrack for planet "' + p + '". BPM 84-118. Title something thematic.',
            'Return only the JSON object.'
        ].join('\n');
    }

    renderPlanetTracker(host, planetId) {
        const title = document.createElement('div');
        title.className = 'de-section-title';
        title.textContent = 'PLANET TRACKER: ' + planetId;
        host.appendChild(title);

        this._addTrackerTools(host, {
            libraryKey: planetId,
            title: 'VF TRACKER JSON',
            getJson: () => {
                if (typeof vfTrackerManager === 'undefined') return '';
                return vfTrackerManager.exportJson(planetId) || '';
            },
            setJson: (text) => {
                if (typeof vfTrackerManager === 'undefined') throw new Error('tracker manager missing');
                if (text == null || String(text).trim() === '') {
                    vfTrackerManager.setTrack(planetId, null);
                    return;
                }
                vfTrackerManager.importJson(planetId, text);
            }
        });
    }

    renderOverrideEditor(host, kind, id) {
        const title = document.createElement('div');
        title.className = 'de-section-title';
        title.textContent = (kind === 'menu' ? 'MAIN MENU' : kind === 'stage' ? 'STAGE: ' + id : 'ENEMY TYPE: ' + id);
        host.appendChild(title);

        const getTrack = () => {
            const t = kind === 'menu' ? soundtrackConfigManager.getMenuTrack()
                : kind === 'stage' ? soundtrackConfigManager.getStageTrack(id)
                : soundtrackConfigManager.getEnemyTrack(id);
            return t || { youtubeUrl: '', localAudioData: '', localAudioName: '', trackerData: null };
        };
        const setTrack = (data) => {
            if (kind === 'menu') soundtrackConfigManager.setMenuTrack(data);
            else if (kind === 'stage') soundtrackConfigManager.setStageTrack(id, data);
            else soundtrackConfigManager.setEnemyTrack(id, data);
            if (kind === 'menu' && typeof soundManager !== 'undefined' && soundManager.startMenuMusic) {
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
            setTrack({
                youtubeUrl: urlInput.value.trim(),
                localAudioData: '',
                localAudioName: '',
                trackerData: null
            });
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
                setTrack({
                    youtubeUrl: '',
                    localAudioData: reader.result,
                    localAudioName: file.name,
                    trackerData: null
                });
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
        previewBtn.textContent = 'PREVIEW MEDIA';
        previewBtn.addEventListener('click', () => {
            const t = getTrack();
            this._stopPreview();
            if (t.localAudioData && typeof localAudioManager !== 'undefined') {
                localAudioManager.setVolume(0.3);
                localAudioManager.play('preview:' + kind + ':' + id, t.localAudioData);
            } else if (t.trackerData && typeof vfTrackerManager !== 'undefined') {
                if (typeof soundManager !== 'undefined' && soundManager.ensureContext) soundManager.ensureContext();
                vfTrackerManager.setVolume(0.35);
                vfTrackerManager.play('preview:' + kind + ':' + id, t.trackerData);
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
            this._stopPreview();
            setTrack(null);
        });
        btnRow.append(previewBtn, clearBtn);
        host.appendChild(btnRow);

        this._addTrackerTools(host, {
            libraryKey: kind + '-' + id,
            title: 'OR ASSIGN VF TRACKER JSON',
            getJson: () => {
                const t = getTrack();
                if (!t.trackerData) return '';
                try {
                    return JSON.stringify(VFTrackerParse.toCompact(t.trackerData), null, 2);
                } catch (e) {
                    return JSON.stringify(t.trackerData, null, 2);
                }
            },
            setJson: (text) => {
                if (text == null || String(text).trim() === '') {
                    const cur = getTrack();
                    if (cur.youtubeUrl || cur.localAudioData) {
                        setTrack({
                            youtubeUrl: cur.youtubeUrl || '',
                            localAudioData: cur.localAudioData || '',
                            localAudioName: cur.localAudioName || '',
                            trackerData: null
                        });
                    } else {
                        setTrack(null);
                    }
                    return;
                }
                const data = VFTrackerParse.toCompact(JSON.parse(text));
                setTrack({
                    youtubeUrl: '',
                    localAudioData: '',
                    localAudioName: '',
                    trackerData: data
                });
            }
        });
    }
}

const soundtrackEditorUI = new SoundtrackEditorUI();
