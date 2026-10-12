"use strict";

/**
 * Screen 1 — Galaxy selection with per-profile progress.
 */
class GalaxySelectionManager {
    constructor() {
        this.isVisible = false;
        this.selectedIndex = 0;
        this.galaxies = [];
        this.overlay = null;
        this._keyHandler = null;
        this.onConfirm = null;
        this.onCancel = null;
    }

    isGalaxyDiscovered(galaxyId, planets) {
        if (typeof startScreenManager !== 'undefined' && startScreenManager.devMode) {
            return true;
        }
        if (!(planets && planets.length)) return false;
        if (typeof profileManager === 'undefined' || !profileManager.getActiveProfile()) {
            return true;
        }
        const progress = profileManager.getGalaxyProgress(galaxyId);
        return (progress.unlockedCount || 0) > 0 || (progress.clearedCount || 0) > 0;
    }

    refreshGalaxies() {
        if (typeof planetConfigManager !== 'undefined' && planetConfigManager.getGalaxyTree) {
            this.galaxies = planetConfigManager.getGalaxyTree()
                .filter(g => this.isGalaxyDiscovered(g.id, g.planets))
                .map(g => {
                    const progress = (typeof profileManager !== 'undefined')
                        ? profileManager.getGalaxyProgress(g.id)
                        : { label: '0/0 CLEARED', totalPlanets: (g.planets || []).length, clearedCount: 0 };
                    return {
                        id: g.id,
                        name: g.name,
                        planetCount: (g.planets || []).length,
                        empty: false,
                        locked: false,
                        progressLabel: progress.label,
                        clearedCount: progress.clearedCount,
                        totalPlanets: progress.totalPlanets
                    };
                });
        } else {
            this.galaxies = [
                { id: 'milky_way', name: 'MILKY WAY', planetCount: 5, empty: false, locked: false, progressLabel: '0/5 CLEARED', clearedCount: 0, totalPlanets: 5 }
            ];
        }
        if (this.selectedIndex >= this.galaxies.length) {
            this.selectedIndex = Math.max(0, this.galaxies.length - 1);
        }
    }

    show(options) {
        this.isVisible = true;
        this.onConfirm = options && options.onConfirm;
        this.onCancel = options && options.onCancel;
        this.refreshGalaxies();
        this.createUI();
        if (typeof menuStateManager !== 'undefined') {
            menuStateManager.setScreen('galaxySelect');
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

    galaxyLogoKey(galaxyId) {
        const id = String(galaxyId || '').toLowerCase().replace(/[^a-z0-9_]/g, '_');
        const keyed = 'galaxy_' + id;
        if (typeof IconSprites !== 'undefined' && IconSprites[keyed]) return keyed;
        const camel = 'galaxy' + id.split('_').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
        if (typeof IconSprites !== 'undefined' && IconSprites[camel]) return camel;
        return 'galaxyDefault';
    }

    galaxyLogoHtml(galaxy) {
        if (galaxy.empty) {
            return '<div class="galaxy-belt-empty">EMPTY</div>';
        }
        if (typeof iconRenderer !== 'undefined' && iconRenderer.imgHtml) {
            const key = this.galaxyLogoKey(galaxy.id);
            const img = iconRenderer.imgHtml(key, 48, 'galaxy-thumb-logo');
            if (img) return img;
        }
        return '<div class="galaxy-belt-empty">★</div>';
    }

    createUI() {
        if (this.overlay) this.overlay.remove();

        this.overlay = document.createElement('div');
        this.overlay.className = 'galaxy-selection-overlay';
        this.overlay.innerHTML = `
            <div class="galaxy-selection-content">
                <h2 class="galaxy-selection-title">SELECT GALAXY</h2>
                <div class="galaxy-belt-container">
                    <div class="galaxy-belt">
                        ${this.galaxies.map((g, index) => `
                            <div class="galaxy-belt-item ${index === this.selectedIndex ? 'selected' : ''} ${g.locked ? 'locked' : ''}" data-index="${index}">
                                <div class="galaxy-belt-thumbs">${this.galaxyLogoHtml(g)}</div>
                                <div class="galaxy-belt-name">${g.name}</div>
                                <div class="galaxy-belt-progress">${g.locked ? 'LOCKED' : g.progressLabel}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="galaxy-details-container">
                    <div class="galaxy-info-detailed">
                        <h3 class="galaxy-name-large">${this.galaxies[this.selectedIndex]?.name || ''}</h3>
                        <div class="galaxy-stats-detailed">
                            <div class="stat-row">
                                <span class="stat-label">Planets:</span>
                                <span class="stat-value galaxy-stat-planets">${this.galaxies[this.selectedIndex]?.planetCount || 0}</span>
                            </div>
                            <div class="stat-row">
                                <span class="stat-label">Progress:</span>
                                <span class="stat-value galaxy-stat-progress">${this.galaxies[this.selectedIndex]?.progressLabel || '—'}</span>
                            </div>
                        </div>
                        ${this.galaxies[this.selectedIndex]?.locked ? '<div class="locked-indicator-large">GALAXY LOCKED</div>' : ''}
                    </div>
                </div>
                <div class="galaxy-selection-actions">
                    <button class="action-button" id="gsConfirm">ENTER GALAXY</button>
                    <button class="action-button secondary" id="gsCancel">BACK</button>
                </div>
                <div class="galaxy-selection-instructions">
                    <p>← → Select | ENTER Confirm | ESC Back</p>
                </div>
            </div>
        `;
        document.body.appendChild(this.overlay);
        this.bindEvents();
    }

    bindEvents() {
        this.overlay.querySelectorAll('.galaxy-belt-item').forEach(item => {
            item.addEventListener('click', () => {
                const idx = parseInt(item.dataset.index, 10);
                if (Number.isNaN(idx)) return;
                this.selectIndex(idx);
            });
            item.addEventListener('dblclick', () => {
                const idx = parseInt(item.dataset.index, 10);
                if (Number.isNaN(idx)) return;
                this.selectIndex(idx);
                this.confirm();
            });
        });

        const confirmBtn = this.overlay.querySelector('#gsConfirm');
        const cancelBtn = this.overlay.querySelector('#gsCancel');
        if (confirmBtn) confirmBtn.addEventListener('click', () => this.confirm());
        if (cancelBtn) cancelBtn.addEventListener('click', () => this.cancel());

        this._keyHandler = (e) => {
            if (!this.isVisible) return;
            if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault();
                this.navigate(-1);
            } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault();
                this.navigate(1);
            } else if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.confirm();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this.cancel();
            }
        };
        document.addEventListener('keydown', this._keyHandler);
    }

    navigate(dir) {
        if (!this.galaxies.length) return;
        let idx = this.selectedIndex + dir;
        while (idx >= 0 && idx < this.galaxies.length && this.galaxies[idx].locked) {
            idx += dir;
        }
        if (idx < 0 || idx >= this.galaxies.length) return;
        this.selectIndex(idx);
    }

    selectIndex(index) {
        if (index < 0 || index >= this.galaxies.length) return;
        this.selectedIndex = index;
        this.overlay.querySelectorAll('.galaxy-belt-item').forEach((el, i) => {
            el.classList.toggle('selected', i === index);
        });
        const g = this.galaxies[index];
        const nameEl = this.overlay.querySelector('.galaxy-name-large');
        const planetsEl = this.overlay.querySelector('.galaxy-stat-planets');
        const progressEl = this.overlay.querySelector('.galaxy-stat-progress');
        if (nameEl) nameEl.textContent = g.name;
        if (planetsEl) planetsEl.textContent = String(g.planetCount);
        if (progressEl) progressEl.textContent = g.locked ? 'LOCKED' : g.progressLabel;

        let locked = this.overlay.querySelector('.locked-indicator-large');
        const info = this.overlay.querySelector('.galaxy-info-detailed');
        if (g.locked && !locked && info) {
            locked = document.createElement('div');
            locked.className = 'locked-indicator-large';
            locked.textContent = 'GALAXY LOCKED';
            info.appendChild(locked);
        } else if (!g.locked && locked) {
            locked.remove();
        }
    }

    confirm() {
        const g = this.galaxies[this.selectedIndex];
        if (!g || g.locked) return;
        const cb = this.onConfirm;
        this.hide();
        if (typeof cb === 'function') cb(g.id);
    }

    cancel() {
        const cb = this.onCancel;
        this.hide();
        if (typeof cb === 'function') cb();
    }
}

const galaxySelectionManager = new GalaxySelectionManager();
window.galaxySelectionManager = galaxySelectionManager;
