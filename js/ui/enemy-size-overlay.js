"use strict";

/**
 * Floating size tuner (enemies + shots). Opens from the HUD (top-left)
 * without dimming the playfield so sizes can be judged live/paused.
 */
class EnemySizeOverlay {
    constructor() {
        this.active = false;
        this._pausedByUs = false;
        this._wasPaused = false;
        this.root = null;
        this.list = null;
        this._onKey = (e) => this.handleKey(e);
        this.ensureDom();
        this.bindHudButton();
    }

    ensureDom() {
        let root = document.getElementById('enemySizeOverlay');
        if (!root) {
            root = document.createElement('div');
            root.id = 'enemySizeOverlay';
            root.className = 'enemy-size-overlay hidden';
            root.setAttribute('role', 'dialog');
            root.setAttribute('aria-modal', 'false');
            root.setAttribute('aria-label', 'Size settings');
            root.innerHTML =
                '<div class="enemy-size-panel">' +
                '<header class="enemy-size-head">' +
                '<strong>SIZES</strong>' +
                '<button type="button" class="enemy-size-close" data-eso-close aria-label="Close">✕</button>' +
                '</header>' +
                '<p class="enemy-size-hint">PAUSED · watch the field · no dim</p>' +
                '<div class="enemy-size-list" data-eso-list></div>' +
                '</div>';
            document.body.appendChild(root);
            root.querySelector('[data-eso-close]').addEventListener('click', () => this.hide());
        } else {
            const title = root.querySelector('.enemy-size-head strong');
            if (title) title.textContent = 'SIZES';
            root.setAttribute('aria-label', 'Size settings');
        }
        this.root = root;
        this.list = root.querySelector('[data-eso-list]');
        // Click outside the panel does nothing — no dim layer to dismiss.
    }

    bindHudButton() {
        const btn = document.getElementById('enemySizeHudBtn');
        if (!btn || btn.dataset.esoBound) return;
        btn.dataset.esoBound = '1';
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.toggle();
        });
    }

    classRows() {
        return [
            { id: 'player', label: 'PLAYER', kind: 'player' },
            { id: 'scout', label: 'SCOUT', kind: 'enemy' },
            { id: 'assault', label: 'ASSAULT', kind: 'enemy' },
            { id: 'heavy', label: 'HEAVY', kind: 'enemy' },
            { id: 'elite', label: 'ELITE', kind: 'enemy' },
            { id: 'capital', label: 'CAPITAL', kind: 'enemy' },
            { id: 'player', label: 'PLAYER SHOTS', kind: 'shot' },
            { id: 'enemy', label: 'ENEMY SHOTS', kind: 'shot' },
            { id: 'boss', label: 'BOSS SHOTS', kind: 'shot' },
            { id: 'player', label: 'PLAYER SHOTS', kind: 'shotspeed' },
            { id: 'enemy', label: 'ENEMY SHOTS', kind: 'shotspeed' },
            { id: 'boss', label: 'BOSS SHOTS', kind: 'shotspeed' }
        ];
    }

    steps(kind) {
        if (kind === 'shot') {
            if (typeof uiAppearanceManager !== 'undefined' && uiAppearanceManager.getShotSizeOptions) {
                return uiAppearanceManager.getShotSizeOptions();
            }
            return ['S', 'M', 'L', 'XL', 'XXL'];
        }
        if (kind === 'player') {
            if (typeof uiAppearanceManager !== 'undefined' && uiAppearanceManager.getPlayerSizeOptions) {
                return uiAppearanceManager.getPlayerSizeOptions();
            }
            return ['S', 'M', 'L', 'XL', 'XXL'];
        }
        if (typeof uiAppearanceManager !== 'undefined' && uiAppearanceManager.getEnemySizeOptions) {
            return uiAppearanceManager.getEnemySizeOptions();
        }
        return ['S', 'M', 'L', 'XL', 'XXL'];
    }

    currentStep(row) {
        if (row.kind === 'shot') {
            if (typeof uiAppearanceManager !== 'undefined' && uiAppearanceManager.getShotSize) {
                return uiAppearanceManager.getShotSize(row.id);
            }
            return 'L';
        }
        if (row.kind === 'player') {
            if (typeof uiAppearanceManager !== 'undefined' && uiAppearanceManager.getPlayerSize) {
                return uiAppearanceManager.getPlayerSize();
            }
            return 'L';
        }
        if (typeof uiAppearanceManager !== 'undefined' && uiAppearanceManager.getEnemyClassSize) {
            return uiAppearanceManager.getEnemyClassSize(row.id);
        }
        return 'L';
    }

    rebuild() {
        if (!this.list) return;
        this.list.innerHTML = '';
        let lastKind = null;
        this.classRows().forEach((row) => {
            if (row.kind !== lastKind) {
                lastKind = row.kind;
                const div = document.createElement('div');
                div.className = 'enemy-size-section';
                div.textContent = row.kind === 'shotspeed' ? 'SHOT SPEEDS'
                    : (row.kind === 'shot' ? 'SHOTS' : (row.kind === 'player' ? 'PLAYER' : 'ENEMIES'));
                this.list.appendChild(div);
            }
            const range = this.pxRange(row.kind);
            const px = this.currentPx(row);
            const el = document.createElement('div');
            el.className = 'enemy-size-row';
            el.dataset.class = row.id;
            el.dataset.kind = row.kind;
            el.innerHTML =
                `<span class="enemy-size-label">${row.label}</span>` +
                `<input type="number" class="enemy-size-input" data-eso-num min="${range.min}" max="${range.max}" step="1" value="${px}" aria-label="${row.label} size in pixels">` +
                `<input type="range" class="enemy-size-slider" data-eso-range min="${range.min}" max="${range.max}" step="1" value="${px}" aria-label="${row.label} size slider">` +
                `<span class="enemy-size-unit">${row.kind === 'shotspeed' ? '%' : 'PX'}</span>`;
            const num = el.querySelector('[data-eso-num]');
            const rng = el.querySelector('[data-eso-range]');
            rng.addEventListener('input', () => {
                num.value = rng.value;
                this.setPx(row, rng.value);
            });
            num.addEventListener('change', () => {
                const v = Math.max(range.min, Math.min(range.max, Number(num.value) || range.min));
                num.value = v;
                rng.value = v;
                this.setPx(row, v);
            });
            this.list.appendChild(el);
        });
    }

    /** Slider / input bounds in px per row kind. */
    pxRange(kind) {
        if (kind === 'shotspeed') return { min: 20, max: 300 };
        if (kind === 'shot') return { min: 1, max: 40 };
        if (kind === 'player') return { min: 6, max: 60 };
        return { min: 12, max: 200 };
    }

    currentPx(row) {
        if (row.kind === 'shotspeed') {
            return typeof uiAppearanceManager !== 'undefined' && uiAppearanceManager.getShotSpeedPct ? uiAppearanceManager.getShotSpeedPct(row.id) : 100;
        }
        if (typeof uiAppearanceManager === 'undefined' || !uiAppearanceManager.getSizePx) return 0;
        return Math.round(uiAppearanceManager.getSizePx(row.kind, row.id));
    }

    setPx(row, px) {
        if (row.kind === 'shotspeed') {
            if (typeof uiAppearanceManager !== 'undefined' && uiAppearanceManager.setShotSpeedPct) uiAppearanceManager.setShotSpeedPct(row.id, px);
            this.refreshFleetPreview();
            return;
        }
        if (typeof uiAppearanceManager === 'undefined' || !uiAppearanceManager.setSizePx) return;
        uiAppearanceManager.setSizePx(row.kind, row.id, px);
        this.refreshFleetPreview();
    }

    /** Live-update the station FLEETS preview while tuning sizes. */
    refreshFleetPreview(factionId) {
        if (typeof homeStationUI === 'undefined' || !homeStationUI || !homeStationUI.overlay) return;
        if (!homeStationUI.startFactionFleetPreview) return;
        const canvas = homeStationUI.overlay && homeStationUI.overlay.querySelector('[data-fleet-preview]');
        if (!canvas) return;
        homeStationUI.startFactionFleetPreview(
            factionId || canvas.getAttribute('data-faction'),
            canvas.getAttribute('data-ship')
        );
    }

    toggle() {
        if (this.active) this.hide();
        else this.show();
    }

    show() {
        this.ensureDom();
        this.bindHudButton();
        if (this.active) {
            this.rebuild();
            return;
        }
        this.active = true;
        const inCombat = typeof game !== 'undefined' && game.gameState && game.gameState.gameRunning;
        this._wasPaused = !!(inCombat && game.gameState.isPaused);
        this._pausedByUs = false;

        // Freeze combat without the dark pause menu / canvas dim.
        if (inCombat && !game.gameState.isPaused) {
            game.gameState.pauseGame();
            this._pausedByUs = true;
        }
        const pauseOverlay = document.getElementById('pauseOverlay');
        if (pauseOverlay) pauseOverlay.classList.add('hidden');

        // Keep above the station/profile stack when opened from FLEETS.
        if (this.root && this.root.parentElement !== document.body) {
            document.body.appendChild(this.root);
        }

        this.rebuild();
        const hint = this.root.querySelector('.enemy-size-hint');
        if (hint) {
            const onFleet = typeof homeStationUI !== 'undefined' && homeStationUI && homeStationUI.tab === 'ffleet';
            hint.textContent = onFleet
                ? 'DEV · watch the fleet preview · no dim'
                : 'PAUSED · watch the field · no dim';
        }
        this.root.classList.remove('hidden');
        document.addEventListener('keydown', this._onKey, true);
        const btn = document.getElementById('enemySizeHudBtn');
        if (btn) btn.classList.add('is-active');
        document.querySelectorAll('[data-fleet-sizes]').forEach((b) => b.classList.add('is-active'));
    }

    hide() {
        if (!this.active) return;
        this.active = false;
        if (this.root) this.root.classList.add('hidden');
        document.removeEventListener('keydown', this._onKey, true);
        const btn = document.getElementById('enemySizeHudBtn');
        if (btn) btn.classList.remove('is-active');
        document.querySelectorAll('[data-fleet-sizes]').forEach((b) => b.classList.remove('is-active'));

        if (this._pausedByUs && typeof game !== 'undefined' && game.gameState) {
            // We paused only for sizing — resume play.
            game.gameState.resumeGame();
            const pauseOverlay = document.getElementById('pauseOverlay');
            if (pauseOverlay) pauseOverlay.classList.add('hidden');
        } else if (this._wasPaused) {
            // Came from normal pause — restore the pause menu.
            const pauseOverlay = document.getElementById('pauseOverlay');
            if (pauseOverlay) pauseOverlay.classList.remove('hidden');
            if (typeof uiManager !== 'undefined' && uiManager.updatePauseMenuDisplay) {
                uiManager.pauseMenuIndex = 0;
                uiManager.updatePauseMenuDisplay();
            }
        }
        this._pausedByUs = false;
        this._wasPaused = false;
    }

    handleKey(e) {
        if (!this.active) return;
        if (e.key === 'Escape' || e.key === 'Esc') {
            e.preventDefault();
            e.stopPropagation();
            this.hide();
        }
    }

    isOpen() {
        return !!this.active;
    }
}

const enemySizeOverlay = new EnemySizeOverlay();
window.enemySizeOverlay = enemySizeOverlay;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => enemySizeOverlay.bindHudButton());
} else {
    enemySizeOverlay.bindHudButton();
}
