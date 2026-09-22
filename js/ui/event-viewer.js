"use strict";

/**
 * Event Viewer — combat-event archive for discovered summon roles.
 * Open: Explorations → ARCHIVE → EVENTS
 */
class EventViewerUI {
    constructor() {
        this.visible = false;
        this.selectedIndex = 0;
        this.events = [];
        this.overlay = null;
        this._keyHandler = (e) => this.handleKeyDown(e);
    }

    getEventList() {
        const all = (typeof combatEventConfigManager !== 'undefined')
            ? combatEventConfigManager.getList()
            : [];
        const devMode = typeof startScreenManager !== 'undefined' && startScreenManager.devMode;
        if (devMode || typeof profileManager === 'undefined' || !profileManager.hasActiveProfile()) {
            return all.slice();
        }
        const allowed = {};
        (profileManager.getDiscovered('events') || []).forEach((id) => {
            allowed[String(id)] = true;
        });
        return all.filter((ev) => !!allowed[String(ev.id)]);
    }

    show(options) {
        if (options && Object.prototype.hasOwnProperty.call(options, 'onClose')) {
            this.onClose = options.onClose;
        }
        this.events = this.getEventList();
        if (!this.events.length) return;
        const preferId = options && (options.eventId || options.catalogId);
        if (preferId) {
            const idx = this.events.findIndex((e) => e.id === preferId);
            if (idx >= 0) this.selectedIndex = idx;
        }
        this.selectedIndex = Math.max(0, Math.min(this.selectedIndex, this.events.length - 1));
        this.visible = true;
        this.createUI();
        document.addEventListener('keydown', this._keyHandler);
        if (!(options && options.skipPersist) && typeof menuStateManager !== 'undefined') {
            menuStateManager.setScreen('event-viewer', {
                eventId: this.events[this.selectedIndex].id
            });
        }
    }

    hide() {
        this.visible = false;
        document.removeEventListener('keydown', this._keyHandler);
        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
        }
    }

    close() {
        this.hide();
        if (typeof this.onClose === 'function') this.onClose();
    }

    persist() {
        if (typeof menuStateManager === 'undefined') return;
        const ev = this.events[this.selectedIndex];
        if (!ev) return;
        menuStateManager.setScreen('event-viewer', { eventId: ev.id });
    }

    createUI() {
        if (this.overlay) this.overlay.remove();
        this.overlay = document.createElement('div');
        this.overlay.className = 'content-viewer-overlay';
        this.overlay.innerHTML = `
            <div class="content-viewer-panel">
                <h2 class="content-viewer-title">EVENTS</h2>
                <div class="content-viewer-body" id="evViewerBody">
                    <aside class="content-viewer-list" id="evList"></aside>
                    <div class="pe-resize-handle" aria-hidden="true"></div>
                    <div class="content-viewer-detail" id="evDetail"></div>
                </div>
                <div class="content-viewer-footer">
                    <button type="button" class="pe-btn" id="evClose">CLOSE</button>
                </div>
                <div class="content-viewer-hint">↑↓ Navigate • ESC Close</div>
            </div>
        `;
        document.body.appendChild(this.overlay);
        if (typeof VFBgMouseParallax !== 'undefined' && VFBgMouseParallax.refresh) {
            VFBgMouseParallax.refresh();
        }
        this.renderList();
        this.renderDetail();
        this.overlay.querySelector('#evClose').addEventListener('click', () => this.close());
        this.mountDevToggles();
    }

    mountDevToggles() {
        this._devToggles = null;
        if (typeof devProfileToggles === 'undefined' || !devProfileToggles.active()) return;
        const footer = this.overlay.querySelector('.content-viewer-footer');
        const hint = this.overlay.querySelector('.content-viewer-hint');
        this._devToggles = devProfileToggles.mount(footer, hint, {
            known: () => {
                const ev = this.events[this.selectedIndex];
                return !!(ev && profileManager.isDiscovered('events', ev.id));
            },
            toggleKnown: () => {
                const ev = this.events[this.selectedIndex];
                if (ev) profileManager.toggleDiscovered('events', ev.id);
            },
            onChange: () => {
                this.events = this.getEventList();
                this.selectedIndex = Math.max(0, Math.min(this.selectedIndex, this.events.length - 1));
                this.renderList();
                this.renderDetail();
                if (this._devToggles) this._devToggles.refresh();
            }
        });
    }

    renderList() {
        const list = this.overlay && this.overlay.querySelector('#evList');
        if (!list) return;
        list.innerHTML = '';
        this.events.forEach((ev, index) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'content-viewer-item' + (index === this.selectedIndex ? ' selected' : '');
            const swatch = `<span class="cv-event-swatch" style="background:${ev.accent || '#888'}"></span>`;
            btn.innerHTML =
                swatch +
                `<span class="cv-item-label">${ev.shortName || ev.name}` +
                (typeof devProfileToggles !== 'undefined' && devProfileToggles.active()
                    ? (typeof devProfileToggles.badgesHtml === 'function'
                        ? devProfileToggles.badgesHtml({
                            known: profileManager.isDiscovered('events', ev.id)
                        })
                        : '')
                    : '') +
                `</span>`;
            btn.addEventListener('click', () => {
                this.selectedIndex = index;
                this.renderList();
                this.renderDetail();
                this.persist();
            });
            list.appendChild(btn);
        });
        const selected = list.querySelector('.content-viewer-item.selected');
        if (selected) selected.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    }

    renderDetail() {
        const root = this.overlay && this.overlay.querySelector('#evDetail');
        const ev = this.events[this.selectedIndex];
        if (!root || !ev) return;
        root.innerHTML = `
            <div class="content-viewer-hero">
                <div class="cv-event-hero-swatch" style="background:${ev.accent || '#888'}"></div>
                <div class="cv-ship-hero-text">
                    <h3 class="content-viewer-name">${ev.name}</h3>
                    <p class="content-viewer-desc">${ev.description || ''}</p>
                </div>
            </div>
            <div class="content-viewer-stats cv-stat-clusters cv-stat-clusters-plain">
                <div class="cv-stat-cluster">
                    <div class="cv-stat-cluster-title">Signal</div>
                    <div class="stat-row"><span class="stat-label">Role</span><span class="stat-value">${String(ev.role || ev.id).toUpperCase()}</span></div>
                    <div class="stat-row"><span class="stat-label">Announce</span><span class="stat-value">${ev.announce || '—'}</span></div>
                    <div class="stat-row"><span class="stat-label">Warn</span><span class="stat-value">${Math.round((ev.announceMs || 0) / 100) / 10}s</span></div>
                </div>
                <div class="cv-stat-cluster">
                    <div class="cv-stat-cluster-title">Counter</div>
                    <p class="content-viewer-desc" style="margin:0">${ev.counter || '—'}</p>
                </div>
            </div>
        `;
    }

    handleKeyDown(e) {
        if (!this.visible) return;
        if (e.key === 'Escape') {
            e.preventDefault();
            this.close();
            return;
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.selectedIndex = Math.min(this.events.length - 1, this.selectedIndex + 1);
            this.renderList();
            this.renderDetail();
            this.persist();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.selectedIndex = Math.max(0, this.selectedIndex - 1);
            this.renderList();
            this.renderDetail();
            this.persist();
        }
    }
}

const eventViewerUI = new EventViewerUI();
