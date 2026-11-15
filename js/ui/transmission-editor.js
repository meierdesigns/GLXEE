"use strict";

// Transmission Editor (dev mode → Settings → Transmission Editor):
// Edits the launch-cutscene "TRANSMISSION · n/4" dialogue beats (VFStoryDialogue.lines)
// plus each story path's title/blurb (story-paths.js). Overrides live in localStorage
// and are picked up immediately by VFStoryDialogue.forStory / plainBlurb and by
// story-paths.js' storyPathDefs() — no reload needed. Use EXPORT to copy the finished
// text back into story-dialogue.js / story-paths.js for a permanent change.
class TransmissionEditorUI {
    constructor() {
        this.overridesKey = 'vf_transmission_overrides_v1';
        this.selectedStoryId = null;
        this.ensureOverlay();
    }

    loadOverrides() {
        try {
            const raw = localStorage.getItem(this.overridesKey);
            const parsed = raw ? JSON.parse(raw) : {};
            return (parsed && typeof parsed === 'object') ? parsed : {};
        } catch (e) { return {}; }
    }

    saveOverrides(all) {
        try {
            localStorage.setItem(this.overridesKey, JSON.stringify(all));
        } catch (e) { /* storage unavailable or quota exceeded */ }
        if (typeof VFStoryDialogue !== 'undefined' && VFStoryDialogue.invalidateOverrides) {
            VFStoryDialogue.invalidateOverrides();
        }
    }

    /** Drops an override entry once it no longer carries any real change. */
    _prune(entry) {
        if (!entry) return null;
        const hasTitle = typeof entry.title === 'string' && entry.title.trim();
        const hasBlurb = typeof entry.blurb === 'string' && entry.blurb.trim();
        const hasLines = Array.isArray(entry.lines) && entry.lines.length
            && entry.lines.some((l) => l && String(l.text || '').trim());
        return (hasTitle || hasBlurb || hasLines) ? entry : null;
    }

    patchOverride(storyId, patch) {
        const all = this.loadOverrides();
        const next = this._prune(Object.assign({}, all[storyId] || {}, patch));
        if (next) all[storyId] = next; else delete all[storyId];
        this.saveOverrides(all);
    }

    resetStory(storyId) {
        const all = this.loadOverrides();
        delete all[storyId];
        this.saveOverrides(all);
        this.render();
    }

    /** All story paths grouped by start kit, as defined in story-paths.js. */
    getStoryPathDefs() {
        if (typeof profileSelectionManager !== 'undefined' && profileSelectionManager.storyPathDefs) {
            try { return profileSelectionManager.storyPathDefs() || {}; } catch (e) { /* ignore */ }
        }
        return {};
    }

    findPath(storyId) {
        const defs = this.getStoryPathDefs();
        for (const kitId in defs) {
            const hit = (defs[kitId] || []).find((p) => p.id === storyId);
            if (hit) return { kitId, path: hit };
        }
        return null;
    }

    getBuiltinLines(storyId) {
        if (typeof VFStoryDialogue === 'undefined' || !VFStoryDialogue._build) return [];
        const map = VFStoryDialogue._build();
        return (map[storyId] || []).map((l) => ({ who: l.who, text: l.text }));
    }

    getBuiltinBlurb(storyId, fallback) {
        if (typeof VFStoryDialogue !== 'undefined' && VFStoryDialogue.synopsis[storyId]) {
            return VFStoryDialogue.synopsis[storyId];
        }
        return fallback || '';
    }

    /** Effective (override-aware) title/blurb/lines for a story path, plain-id lookup. */
    getEffective(storyId, builtinTitle, builtinBlurb) {
        const ov = this.loadOverrides()[storyId] || {};
        const builtinLines = this.getBuiltinLines(storyId);
        return {
            title: (typeof ov.title === 'string' && ov.title.trim()) ? ov.title : builtinTitle,
            blurb: (typeof ov.blurb === 'string' && ov.blurb.trim()) ? ov.blurb : this.getBuiltinBlurb(storyId, builtinBlurb),
            lines: (Array.isArray(ov.lines) && ov.lines.length) ? ov.lines.map((l) => ({ who: l.who || '', text: l.text || '' })) : builtinLines,
            overridden: !!this._prune(ov)
        };
    }

    ensureOverlay() {
        if (document.getElementById('transmissionEditorOverlay')) return;
        const overlay = document.createElement('div');
        overlay.id = 'transmissionEditorOverlay';
        overlay.className = 'difficulty-editor-overlay hidden';
        overlay.innerHTML = `
            <div class="difficulty-editor-panel">
                <header class="difficulty-editor-header">
                    <h2>TRANSMISSION EDITOR</h2>
                    <button type="button" class="pe-btn" id="teExportAll">EXPORT ALL</button>
                    <button type="button" class="de-close" id="teClose">×</button>
                </header>
                <div class="difficulty-editor-body">
                    <aside class="difficulty-editor-nav" id="teNav"></aside>
                    <main class="difficulty-editor-controls" id="teControls"></main>
                </div>
                <footer class="difficulty-editor-footer">
                    <button type="button" class="pe-btn" id="teBack">BACK</button>
                </footer>
            </div>`;
        document.body.appendChild(overlay);
        const q = (s) => overlay.querySelector(s);
        q('#teClose').addEventListener('click', () => this.hide());
        q('#teBack').addEventListener('click', () => this.hide());
        q('#teExportAll').addEventListener('click', () => this.exportAll());
        overlay.addEventListener('keydown', (e) => {
            if (e.target && (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT')) {
                if (e.key === 'Escape') this.hide();
                return;
            }
            e.stopPropagation();
            if (e.key === 'Escape') this.hide();
        });
    }

    show() {
        this.ensureOverlay();
        // VFStoryDialogue / ProfileSelectionManager live in the lazy-loaded profiles
        // bundle; pull it in if something opened this editor before that happened.
        if (typeof profileSelectionManager === 'undefined' && typeof window.ensureVfProfiles === 'function') {
            window.ensureVfProfiles(() => this.show());
            return;
        }
        this._returnToSettings = !!(typeof startScreenManager !== 'undefined' && startScreenManager
            && (startScreenManager.showSettings || startScreenManager.overlayMode || startScreenManager.embeddedMode));
        if (typeof startScreenManager !== 'undefined' && startScreenManager) {
            if (startScreenManager.overlayMode) startScreenManager.hideOverlay();
            if (startScreenManager.embeddedMode) startScreenManager.hideEmbedded();
        }
        if (typeof settingsManager !== 'undefined' && settingsManager.hideSettings) settingsManager.hideSettings();
        const overlay = document.getElementById('transmissionEditorOverlay');
        if (overlay.parentNode !== document.body) document.body.appendChild(overlay);
        overlay.classList.remove('hidden');
        if (!this.selectedStoryId) {
            const defs = this.getStoryPathDefs();
            const firstKit = Object.keys(defs)[0];
            const firstPath = firstKit && defs[firstKit][0];
            if (firstPath) this.selectedStoryId = firstPath.id;
        }
        this.render();
    }

    hide() {
        const overlay = document.getElementById('transmissionEditorOverlay');
        if (overlay) overlay.classList.add('hidden');
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
        this.renderNav();
        const host = document.getElementById('teControls');
        host.innerHTML = '';
        const found = this.selectedStoryId ? this.findPath(this.selectedStoryId) : null;
        if (!found) {
            const hint = document.createElement('p');
            hint.className = 'ss-code-hint';
            hint.textContent = 'Wähle links eine Transmission aus.';
            host.appendChild(hint);
            return;
        }
        this.renderStoryEditor(host, found.kitId, found.path);
    }

    renderNav() {
        const nav = document.getElementById('teNav');
        if (!nav) return;
        nav.innerHTML = '';
        const defs = this.getStoryPathDefs();
        const overrides = this.loadOverrides();
        Object.keys(defs).forEach((kitId) => {
            const section = document.createElement('div');
            section.className = 'de-section-title';
            section.textContent = kitId.replace(/_/g, ' ').toUpperCase();
            nav.appendChild(section);
            (defs[kitId] || []).forEach((path) => {
                const b = document.createElement('button');
                b.type = 'button';
                b.className = 'de-profile-btn';
                b.textContent = (this._prune(overrides[path.id]) ? '✎ ' : '') + path.title;
                if (path.id === this.selectedStoryId) b.classList.add('pe-primary');
                b.addEventListener('click', () => {
                    this.selectedStoryId = path.id;
                    this.render();
                });
                nav.appendChild(b);
            });
        });
    }

    renderStoryEditor(host, kitId, path) {
        const eff = this.getEffective(path.id, path.title, path.blurb);

        const title = document.createElement('div');
        title.className = 'de-section-title';
        title.textContent = 'TRANSMISSION · ' + path.id + ' (kit: ' + kitId + ')' + (eff.overridden ? ' — ÜBERSCHRIEBEN' : '');
        host.appendChild(title);

        // Title
        const titleRow = document.createElement('div');
        titleRow.className = 'de-slider-row';
        const titleLabel = document.createElement('label');
        titleLabel.textContent = 'TITEL';
        const titleInput = document.createElement('input');
        titleInput.type = 'text';
        titleInput.value = eff.title;
        titleInput.spellcheck = false;
        titleInput.addEventListener('keydown', (e) => e.stopPropagation());
        titleInput.addEventListener('change', () => {
            this.patchOverride(path.id, { title: titleInput.value.trim() || null });
            this.renderNav();
        });
        titleRow.append(titleLabel, titleInput);
        host.appendChild(titleRow);

        // Blurb (shown on the cutscene title card + logbook synopsis)
        const blurbTitle = document.createElement('div');
        blurbTitle.className = 'de-section-title';
        blurbTitle.textContent = 'BLURB (Kartentext / Logbuch)';
        host.appendChild(blurbTitle);
        const blurbArea = document.createElement('textarea');
        blurbArea.rows = 2;
        blurbArea.style.width = '100%';
        blurbArea.spellcheck = false;
        blurbArea.value = eff.blurb;
        blurbArea.addEventListener('keydown', (e) => e.stopPropagation());
        blurbArea.addEventListener('change', () => {
            this.patchOverride(path.id, { blurb: blurbArea.value.trim() || null });
        });
        host.appendChild(blurbArea);

        // Dialogue lines ("TRANSMISSION · n/4")
        const linesTitle = document.createElement('div');
        linesTitle.className = 'de-section-title';
        linesTitle.textContent = 'TRANSMISSION LINES';
        host.appendChild(linesTitle);
        const hint = document.createElement('p');
        hint.className = 'ss-code-hint';
        hint.textContent = 'who = Absender (z.B. COMMAND, OPS, YOU). "YOU" wird im Spiel durch den Pilotennamen ersetzt.';
        host.appendChild(hint);

        const lines = eff.lines.slice();
        const linesHost = document.createElement('div');
        host.appendChild(linesHost);

        const commitLines = () => this.patchOverride(path.id, { lines: lines.slice() });

        const renderLines = () => {
            linesHost.innerHTML = '';
            lines.forEach((line, i) => {
                const row = document.createElement('div');
                row.className = 'de-slider-row';
                const whoInput = document.createElement('input');
                whoInput.type = 'text';
                whoInput.value = line.who || '';
                whoInput.placeholder = 'WHO';
                whoInput.style.maxWidth = '140px';
                whoInput.spellcheck = false;
                whoInput.addEventListener('keydown', (e) => e.stopPropagation());
                whoInput.addEventListener('change', () => { lines[i].who = whoInput.value; commitLines(); });

                const textInput = document.createElement('input');
                textInput.type = 'text';
                textInput.value = line.text || '';
                textInput.placeholder = 'Zeile …';
                textInput.style.flex = '1';
                textInput.spellcheck = false;
                textInput.addEventListener('keydown', (e) => e.stopPropagation());
                textInput.addEventListener('change', () => { lines[i].text = textInput.value; commitLines(); });

                const removeBtn = document.createElement('button');
                removeBtn.type = 'button';
                removeBtn.className = 'pe-btn';
                removeBtn.textContent = '×';
                removeBtn.addEventListener('click', () => {
                    lines.splice(i, 1);
                    commitLines();
                    renderLines();
                });

                row.append(whoInput, textInput, removeBtn);
                linesHost.appendChild(row);
            });
        };
        renderLines();

        const addLineBtn = document.createElement('button');
        addLineBtn.type = 'button';
        addLineBtn.className = 'pe-btn';
        addLineBtn.textContent = '+ ADD LINE';
        addLineBtn.addEventListener('click', () => {
            lines.push({ who: 'COMMAND', text: '' });
            commitLines();
            renderLines();
        });
        host.appendChild(addLineBtn);

        // Actions
        const btnRow = document.createElement('div');
        btnRow.className = 'de-slider-row';

        const previewBtn = document.createElement('button');
        previewBtn.type = 'button';
        previewBtn.className = 'pe-btn pe-primary';
        previewBtn.textContent = 'PREVIEW';
        previewBtn.addEventListener('click', () => this.previewStory(path));
        btnRow.appendChild(previewBtn);

        const exportBtn = document.createElement('button');
        exportBtn.type = 'button';
        exportBtn.className = 'pe-btn';
        exportBtn.textContent = 'EXPORT STORY';
        exportBtn.addEventListener('click', () => this.exportStory(path));
        btnRow.appendChild(exportBtn);

        const resetBtn = document.createElement('button');
        resetBtn.type = 'button';
        resetBtn.className = 'pe-btn';
        resetBtn.textContent = 'RESET';
        resetBtn.addEventListener('click', () => {
            if (window.confirm('Änderungen für "' + path.id + '" verwerfen?')) this.resetStory(path.id);
        });
        btnRow.appendChild(resetBtn);

        host.appendChild(btnRow);

        const status = document.createElement('p');
        status.className = 'ss-code-hint';
        status.id = 'teStatus';
        host.appendChild(status);
    }

    /** Launches the real launch-cutscene with the current (unsaved-to-code) edits. */
    previewStory(path) {
        if (typeof launchCutsceneManager === 'undefined') return;
        const eff = this.getEffective(path.id, path.title, path.blurb);
        const activeProfile = (typeof profileManager !== 'undefined' && profileManager.getActiveProfile)
            ? profileManager.getActiveProfile() : null;
        const faction = (activeProfile && activeProfile.faction) || 'pirate';
        const shipId = (activeProfile && activeProfile.activeShipId) || null;
        this.hide();
        launchCutsceneManager.play({
            faction,
            shipId,
            profile: activeProfile,
            story: {
                id: path.id,
                title: eff.title,
                blurb: eff.blurb,
                cut: path.cut,
                missions: path.missions,
                dialogue: eff.lines
            },
            onDone: () => this.show()
        });
    }

    _code(storyId, eff) {
        const linesCode = eff.lines
            .filter((l) => String(l.text || '').trim())
            .map((l) => '    D(' + JSON.stringify(l.who || 'VOICE') + ', ' + JSON.stringify(l.text) + '),')
            .join('\n');
        return [
            '// ——— ' + storyId + ' (' + eff.title + ') ———',
            '// → js/ui/profile-selection/story-dialogue.js : lines.' + storyId,
            storyId + ': [',
            linesCode,
            '],',
            '',
            '// → js/ui/profile-selection/story-dialogue.js : synopsis.' + storyId,
            storyId + ': ' + JSON.stringify(eff.blurb) + ',',
            '',
            '// → js/ui/profile-selection/story-paths.js : P(\'' + storyId + '\', title, ...)',
            'title: ' + JSON.stringify(eff.title)
        ].join('\n');
    }

    async _copyOrShow(text, status) {
        try {
            await navigator.clipboard.writeText(text);
            if (status) status.textContent = 'In die Zwischenablage kopiert — in story-dialogue.js / story-paths.js einfügen.';
        } catch (e) {
            this._showExportFallback(text);
            if (status) status.textContent = 'Zwischenablage blockiert — Text zum Kopieren eingeblendet.';
        }
    }

    _showExportFallback(text) {
        const host = document.getElementById('teControls');
        if (!host) return;
        const ta = document.createElement('textarea');
        ta.rows = 14;
        ta.style.width = '100%';
        ta.style.fontFamily = 'monospace';
        ta.style.fontSize = '11px';
        ta.value = text;
        ta.addEventListener('keydown', (e) => e.stopPropagation());
        host.appendChild(ta);
        ta.focus();
        ta.select();
    }

    exportStory(path) {
        const eff = this.getEffective(path.id, path.title, path.blurb);
        const status = document.getElementById('teStatus');
        this._copyOrShow(this._code(path.id, eff), status);
    }

    exportAll() {
        const overrides = this.loadOverrides();
        const ids = Object.keys(overrides).filter((id) => this._prune(overrides[id]));
        if (!ids.length) {
            window.alert('Keine Änderungen vorhanden.');
            return;
        }
        const defs = this.getStoryPathDefs();
        const blocks = ids.map((id) => {
            const found = this.findPath(id) || { path: { title: id, blurb: '' } };
            const eff = this.getEffective(id, found.path.title, found.path.blurb);
            return this._code(id, eff);
        });
        this._copyOrShow(blocks.join('\n\n'), null);
        window.alert(ids.length + ' geänderte Transmission(en) in die Zwischenablage kopiert.');
    }
}
const transmissionEditorUI = new TransmissionEditorUI();
