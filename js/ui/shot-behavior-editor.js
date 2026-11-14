"use strict";

/**
 * Shot Behavior Editor — tweak flight / hitbox / fire cadence per weapon.
 * Open: Dev Mode → Tools → SHOT BEHAVIOR, or Weapons viewer → EDIT BEHAVIOR.
 */
class ShotBehaviorEditorUI {
    constructor() {
        this.visible = false;
        this.returnTo = null;
        this.selectedId = 'laser';
        this.draft = null;
        this._previewBullets = [];
        this._previewAnimId = null;
        this._previewLastTs = 0;
        this._keyHandler = (e) => {
            if (e.key === 'Escape' && this.visible) {
                e.preventDefault();
                this.hide();
            }
        };
    }

    init() {
        this.ensureOverlay();
    }

    ensureOverlay() {
        if (document.getElementById('shotBehaviorEditorOverlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'shotBehaviorEditorOverlay';
        overlay.className = 'planet-editor-overlay shot-behavior-editor-overlay hidden';
        overlay.innerHTML = `
            <div class="planet-editor-panel">
                <div class="planet-editor-header">
                    <h2>SHOT BEHAVIOR</h2>
                    <div class="planet-editor-planet-select" id="sbeTypeSelect"></div>
                </div>
                <div class="planet-editor-body has-preview" id="sbeBody">
                    <div class="planet-editor-controls" id="sbeControls"></div>
                    <aside class="content-viewer-preview planet-editor-preview-wrap" id="sbePreviewWrap">
                        <div class="pe-preview-viewport" id="sbePreviewViewport">
                            <canvas id="sbePreview" width="160" height="240"></canvas>
                        </div>
                        <div class="pe-preview-label">FLIGHT PREVIEW</div>
                    </aside>
                </div>
                <div class="planet-editor-footer">
                    <button type="button" class="pe-btn" id="sbeReset">RESET</button>
                    <button type="button" class="pe-btn pe-primary" id="sbeSave">SAVE</button>
                    <button type="button" class="pe-btn" id="sbeClose">CLOSE</button>
                </div>
                <div class="content-viewer-hint">Dev Mode · edits apply after SAVE · ESC Close</div>
            </div>
        `;
        document.body.appendChild(overlay);

        overlay.querySelector('#sbeSave').addEventListener('click', () => this.save());
        overlay.querySelector('#sbeReset').addEventListener('click', () => this.reset());
        overlay.querySelector('#sbeClose').addEventListener('click', () => this.hide());
        document.addEventListener('keydown', this._keyHandler);
    }

    persistMenuState() {
        if (typeof menuStateManager !== 'undefined' && this.visible) {
            menuStateManager.setScreen('shot-behavior-editor', {
                weaponId: this.selectedId,
                returnTo: this.returnTo
            });
        }
    }

    show(weaponId, fromRestore, options) {
        this.ensureOverlay();
        if (weaponId) this.selectedId = String(weaponId);
        if (options && options.returnTo) this.returnTo = options.returnTo;
        else if (!fromRestore) this.returnTo = null;
        this.loadDraft();
        this.visible = true;
        document.getElementById('shotBehaviorEditorOverlay').classList.remove('hidden');
        this.renderTypeSelect();
        this.renderControls();
        this.resetPreview();
        this.startPreview();
        if (!fromRestore) this.persistMenuState();
    }

    hide() {
        this.visible = false;
        this.stopPreview();
        const el = document.getElementById('shotBehaviorEditorOverlay');
        if (el) el.classList.add('hidden');
        const backTo = this.returnTo;
        this.returnTo = null;
        if (backTo === 'weapon-viewer' && typeof weaponViewerUI !== 'undefined') {
            weaponViewerUI.show({ weaponId: this.selectedId });
            return;
        }
        if (typeof menuStateManager !== 'undefined') {
            const container = document.querySelector('.game-container');
            const inGame = container && container.style.display !== 'none';
            menuStateManager.setScreen(inGame ? 'ingame' : 'start');
        }
    }

    loadDraft() {
        if (typeof weaponConfigManager === 'undefined') {
            this.draft = {
                id: this.selectedId,
                name: this.selectedId,
                damage: 10,
                speed: 12,
                cooldown: 250,
                energyCost: 4,
                width: 2,
                height: 12,
                bulletCount: 1,
                spreadAngle: 0,
                bulletSpacing: 4,
                waveAmp: 0,
                pierce: false
            };
            return;
        }
        const w = weaponConfigManager.getWeapon(this.selectedId);
        this.draft = {
            id: w.id,
            name: w.name,
            description: w.description || '',
            damage: w.damage,
            speed: w.speed,
            cooldown: w.cooldown,
            energyCost: w.energyCost,
            width: w.width,
            height: w.height,
            bulletCount: w.bulletCount || 1,
            spreadAngle: w.spreadAngle || 0,
            bulletSpacing: w.bulletSpacing || 4,
            waveAmp: w.waveAmp || 0,
            pierce: !!w.pierce,
            bulletType: w.bulletType,
            iconKey: w.iconKey,
            faction: w.faction,
            lightRadius: w.lightRadius,
            lightIntensity: w.lightIntensity
        };
    }

    renderTypeSelect() {
        const root = document.getElementById('sbeTypeSelect');
        if (!root) return;
        root.innerHTML = '';
        const ids = typeof weaponConfigManager !== 'undefined'
            ? weaponConfigManager.getIds()
            : [this.selectedId];
        ids.forEach((id) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'pe-planet-btn' + (id === this.selectedId ? ' active' : '');
            const meta = typeof weaponConfigManager !== 'undefined'
                ? weaponConfigManager.getWeapon(id)
                : { name: id };
            const icon = (typeof iconRenderer !== 'undefined' && iconRenderer.weaponImgHtml)
                ? iconRenderer.weaponImgHtml(id, 14, 'cv-ability-icon-img', meta.name)
                : '';
            btn.innerHTML = `${icon} <span>${meta.name || id}</span>`;
            btn.addEventListener('click', () => {
                this.selectedId = id;
                this.loadDraft();
                this.renderTypeSelect();
                this.renderControls();
                this.resetPreview();
                this.persistMenuState();
            });
            root.appendChild(btn);
        });
    }

    renderControls() {
        const root = document.getElementById('sbeControls');
        if (!root || !this.draft) return;
        root.innerHTML = '';

        const head = document.createElement('div');
        head.className = 'ae-preview';
        const icon = (typeof iconRenderer !== 'undefined' && iconRenderer.weaponImgHtml)
            ? iconRenderer.weaponImgHtml(this.draft.id, 28, 'cv-ability-icon-img', this.draft.name)
            : '◆';
        head.innerHTML = `<span class="ae-preview-icon">${icon}</span>`
            + `<span class="ae-preview-name">${this.draft.name || this.draft.id}</span>`;
        root.appendChild(head);

        root.appendChild(this.makeSlider('Speed', this.draft.speed, 1, 24, 0.5, (v) => {
            this.draft.speed = v;
            this.resetPreview();
        }));
        root.appendChild(this.makeSlider('Damage', this.draft.damage, 1, 28, 1, (v) => {
            this.draft.damage = Math.round(v);
        }));
        root.appendChild(this.makeSlider('Cooldown ms', this.draft.cooldown, 80, 1200, 10, (v) => {
            this.draft.cooldown = Math.round(v);
        }));
        root.appendChild(this.makeSlider('Energy', this.draft.energyCost, 0, 12, 1, (v) => {
            this.draft.energyCost = Math.round(v);
        }));
        root.appendChild(this.makeSlider('Hit W', this.draft.width, 1, 4, 1, (v) => {
            this.draft.width = Math.round(v);
            this.resetPreview();
        }));
        root.appendChild(this.makeSlider('Hit H', this.draft.height, 3, 16, 1, (v) => {
            this.draft.height = Math.round(v);
            this.resetPreview();
        }));
        root.appendChild(this.makeSlider('Count', this.draft.bulletCount || 1, 1, 8, 1, (v) => {
            this.draft.bulletCount = Math.round(v);
            this.resetPreview();
        }));
        root.appendChild(this.makeSlider('Spread', this.draft.spreadAngle || 0, 0, 1.2, 0.05, (v) => {
            this.draft.spreadAngle = v;
            this.resetPreview();
        }));
        root.appendChild(this.makeSlider('Spacing', this.draft.bulletSpacing || 4, 0, 12, 1, (v) => {
            this.draft.bulletSpacing = Math.round(v);
            this.resetPreview();
        }));
        root.appendChild(this.makeSlider('Wave amp', this.draft.waveAmp || 0, 0, 4, 0.1, (v) => {
            this.draft.waveAmp = v;
            this.resetPreview();
        }));
        root.appendChild(this.makeToggle('Pierce', !!this.draft.pierce, (v) => {
            this.draft.pierce = v;
        }));
    }

    makeToggle(labelText, value, onChange) {
        const row = document.createElement('div');
        row.className = 'pe-row';
        const label = document.createElement('label');
        label.textContent = labelText;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'pe-btn' + (value ? ' pe-primary' : '');
        btn.textContent = value ? 'ON' : 'OFF';
        btn.addEventListener('click', () => {
            const next = !value;
            value = next;
            btn.textContent = next ? 'ON' : 'OFF';
            btn.classList.toggle('pe-primary', next);
            onChange(next);
        });
        row.appendChild(label);
        row.appendChild(btn);
        return row;
    }

    makeSlider(labelText, value, min, max, step, onChange) {
        const row = document.createElement('div');
        row.className = 'pe-row';
        const label = document.createElement('label');
        label.textContent = labelText;
        const val = document.createElement('span');
        val.className = 'pe-val';
        const format = (v) => (step < 1 ? Number(v).toFixed(2) : String(Math.round(v)));
        val.textContent = format(value);
        const input = document.createElement('input');
        input.type = 'range';
        input.min = String(min);
        input.max = String(max);
        input.step = String(step);
        input.value = String(value);
        input.addEventListener('input', () => {
            const v = Number(input.value);
            val.textContent = format(v);
            onChange(v);
        });
        row.appendChild(label);
        row.appendChild(val);
        row.appendChild(input);
        return row;
    }

    resetPreview() {
        this._previewBullets = [];
        this._previewAcc = 0;
        this.spawnPreviewVolley();
    }

    spawnPreviewVolley() {
        if (!this.draft) return;
        const canvas = document.getElementById('sbePreview');
        if (!canvas) return;
        const cx = canvas.width / 2;
        const y0 = canvas.height - 28;
        const count = Math.max(1, Math.round(this.draft.bulletCount || 1));
        const spread = Number(this.draft.spreadAngle) || 0;
        const spacing = Number(this.draft.bulletSpacing) || 0;
        const spd = Math.max(0.5, Number(this.draft.speed) || 10);
        const w = Math.max(1, Number(this.draft.width) || 2);
        const h = Math.max(3, Number(this.draft.height) || 8);
        const wave = Number(this.draft.waveAmp) || 0;
        const color = (typeof weaponConfigManager !== 'undefined' && weaponConfigManager.getWeaponUiColor)
            ? (weaponConfigManager.getWeaponUiColor(this.draft.id) || '#7ec8ff')
            : '#7ec8ff';
        for (let i = 0; i < count; i++) {
            const t = count === 1 ? 0 : (i / (count - 1)) - 0.5;
            const ang = t * spread * 2;
            const xOff = count > 1 && spread === 0 ? t * spacing * 2 : 0;
            this._previewBullets.push({
                x: cx - w / 2 + xOff,
                y: y0 - h,
                width: w,
                height: h,
                speed: spd * 0.55,
                angle: ang || undefined,
                waveAmp: wave,
                wavePhase: 0,
                type: wave > 0 ? 'wave_beam' : (this.draft.bulletType || 'laser_beam'),
                color
            });
        }
    }

    startPreview() {
        this.stopPreview();
        this._previewLastTs = 0;
        const tick = (ts) => {
            if (!this.visible) return;
            const dt = this._previewLastTs ? Math.min(40, ts - this._previewLastTs) : 16;
            this._previewLastTs = ts;
            this.updatePreview(dt);
            this.drawPreview();
            this._previewAnimId = requestAnimationFrame(tick);
        };
        this._previewAnimId = requestAnimationFrame(tick);
    }

    stopPreview() {
        if (this._previewAnimId) {
            cancelAnimationFrame(this._previewAnimId);
            this._previewAnimId = null;
        }
    }

    updatePreview(dtMs) {
        const sm = (dtMs || 16) / 16.67;
        const canvas = document.getElementById('sbePreview');
        if (!canvas) return;
        this._previewAcc = (this._previewAcc || 0) + dtMs;
        const cd = Math.max(120, Number(this.draft && this.draft.cooldown) || 300);
        if (this._previewAcc >= cd || this._previewBullets.length === 0) {
            this._previewAcc = 0;
            this.spawnPreviewVolley();
        }
        for (let i = this._previewBullets.length - 1; i >= 0; i--) {
            const b = this._previewBullets[i];
            const s = Math.max(0.5, Number(b.speed) || 6) * sm;
            let bdx = 0;
            let bdy = -s;
            if (b.type === 'wave_beam' && b.waveAmp) {
                b.wavePhase = (b.wavePhase || 0) + 0.25 * sm;
                bdx = Math.sin(b.wavePhase) * b.waveAmp * sm;
            } else if (b.angle != null && Number.isFinite(Number(b.angle))) {
                const a = Number(b.angle);
                bdx = Math.sin(a) * s;
                bdy = -Math.cos(a) * s;
            }
            if (Math.abs(bdy) < s * 0.55) {
                bdx = 0;
                bdy = -s;
            }
            b.x += bdx;
            b.y += bdy;
            if (b.y + b.height < 0) this._previewBullets.splice(i, 1);
        }
    }

    drawPreview() {
        const canvas = document.getElementById('sbePreview');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.fillStyle = '#07090e';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        // Muzzle marker
        ctx.fillStyle = '#3a4656';
        ctx.fillRect(canvas.width / 2 - 6, canvas.height - 18, 12, 10);
        ctx.fillStyle = '#7a8a9c';
        ctx.fillRect(canvas.width / 2 - 3, canvas.height - 22, 6, 4);
        for (let i = 0; i < this._previewBullets.length; i++) {
            const b = this._previewBullets[i];
            ctx.globalAlpha = 0.35;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(Math.round(b.x) - 1, Math.round(b.y) - 1, Math.max(1, b.width) + 2, Math.max(1, b.height) + 2);
            ctx.globalAlpha = 1;
            ctx.fillStyle = b.color || '#7ec8ff';
            ctx.fillRect(Math.round(b.x), Math.round(b.y), Math.max(1, b.width), Math.max(1, b.height));
            // Hitbox outline
            ctx.strokeStyle = 'rgba(255,80,80,0.85)';
            ctx.lineWidth = 1;
            ctx.strokeRect(Math.round(b.x) + 0.5, Math.round(b.y) + 0.5, Math.max(1, b.width) - 1, Math.max(1, b.height) - 1);
        }
        ctx.globalAlpha = 1;
    }

    save() {
        if (typeof weaponConfigManager === 'undefined' || !this.draft) return;
        weaponConfigManager.setWeapon(this.selectedId, this.draft);
        this.loadDraft();
        this.renderTypeSelect();
        this.renderControls();
        this.resetPreview();
        const header = document.querySelector('#shotBehaviorEditorOverlay .planet-editor-header h2');
        if (header) {
            const prev = header.textContent;
            header.textContent = 'SAVED';
            setTimeout(() => { header.textContent = prev || 'SHOT BEHAVIOR'; }, 700);
        }
    }

    reset() {
        if (typeof weaponConfigManager === 'undefined') return;
        weaponConfigManager.resetWeapon(this.selectedId);
        this.loadDraft();
        this.renderControls();
        this.resetPreview();
    }
}

const shotBehaviorEditorUI = new ShotBehaviorEditorUI();
shotBehaviorEditorUI.init();
window.shotBehaviorEditorUI = shotBehaviorEditorUI;
