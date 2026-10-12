"use strict";

// Menu → LAYOUT: sort and regroup the station navigation (MENU_AREAS).
// Areas can be reordered; each tab can be moved up / down inside its area,
// moved to another area, or made the area's default (★ = where a click on
// the area lands). Changes save at once (saveMenuAreas) and rebuild the
// station's tab rows. RESET restores the built-in layout.
extendClass(StartScreenManager, {
    fillEmbeddedLayout(body) {
        const panel = document.createElement('div');
        panel.className = 'hs-menu-panel-section hs-layout-editor';
        body.appendChild(panel);
        if (typeof MENU_AREAS === 'undefined') {
            panel.innerHTML = '<p class="hs-menu-panel-copy">No menu layout available.</p>';
            return;
        }
        const hs = typeof homeStationUI !== 'undefined' ? homeStationUI : null;
        const tabLabel = (id) => {
            if (id === 'station') return 'STORAGE';
            if (id === 'hangar') return 'SHIPYARD';
            const meta = hs && hs._tabMeta && hs._tabMeta[id];
            return (meta && meta.label) || String(id).toUpperCase();
        };
        const esc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

        // MENU row: its tabs in their current order. Station pages (e.g.
        // COMPONENTS) may move between the menu and the areas; the pure menu
        // pages (profiles / settings / layout / credits) stay in the menu.
        const MENU = '__menu';
        // (STORAGE stays in an area: the menu row can't host it.)
        const STATION_TABS = ['play', 'hangar', 'travel', 'explorations', 'factions', 'ffleet', 'ftrade',
            'fcontracts', 'upgrade', 'components', 'missions', 'craft', 'shop'];
        const embedded = (this.embeddedMenuTabs || []);
        const menuIds = () => (hs && hs.getMenuRowTabs ? hs.getMenuRowTabs().map((t) => t.id)
            : (typeof MENU_ORDER !== 'undefined' ? MENU_ORDER.esc.slice() : []));
        const menuLabel = (id) => {
            const e = embedded.find((t) => t.id === id);
            return e ? e.label : tabLabel(id);
        };
        // Icons: current (player choice or default) per tab / 'area:<id>'.
        const defaultIcon = (key) => {
            if (key.indexOf('area:') === 0) {
                const base = (typeof MENU_AREAS_DEFAULTS !== 'undefined' ? MENU_AREAS_DEFAULTS : MENU_AREAS)
                    .find((a) => 'area:' + a.id === key);
                return base ? base.icon : '';
            }
            if (key === 'station') return 'hsStores';
            const e = embedded.find((t) => t.id === key);
            if (e) return e.icon;
            const meta = hs && hs._tabMeta && hs._tabMeta[key];
            return (meta && meta.icon) || '';
        };
        const iconOf = (key) => (typeof getMenuIcon === 'function' ? getMenuIcon(key, defaultIcon(key)) : defaultIcon(key));
        // Cleaned variant (no grey fringe, centred) — same as the station tabs.
        const iconImg = (k, size) => {
            if (!hs || !hs.iconHtml || !k) return '';
            const key = hs.tabIconKey ? hs.tabIconKey(k) : k;
            return hs.iconHtml(key, size || 32, 'hs-pixel', false);
        };
        const iconBtn = (key) => `<button type="button" class="hs-layout-btn hs-layout-icon" data-act="icon" data-icon-key="${esc(key)}" title="Change icon" data-nav-item>${iconImg(iconOf(key))}</button>`;
        // Names: default per key, and the shown one (player rename or default).
        const defaultLabel = (key) => {
            if (key.indexOf('area:') === 0) {
                const a = MENU_AREAS.find((x) => 'area:' + x.id === key);
                return a ? a.label : key;
            }
            return menuLabel(key);
        };
        const labelOf = (key) => (typeof getMenuLabel === 'function' ? getMenuLabel(key, defaultLabel(key)) : defaultLabel(key));
        const renameBtn = (key) => `<button type="button" class="hs-layout-rename" data-act="rename" data-label-key="${esc(key)}" title="Rename" tabindex="-1">✎</button>`;
        const setMenu = (ids) => { if (typeof MENU_ORDER !== 'undefined') MENU_ORDER.esc = ids; };

        const apply = () => {
            if (typeof saveMenuAreas === 'function') saveMenuAreas();
            if (typeof saveMenuOrder === 'function') saveMenuOrder();
            if (hs && hs.applyMenuOrder) hs.applyMenuOrder();
            // Rebuild the station (its tab rows) and this panel.
            if (hs && hs.isVisible && hs.createUI) hs.createUI();
            else { body.innerHTML = ''; this.fillEmbeddedLayout(body); }
        };
        const move = (arr, i, d) => {
            const j = i + d;
            if (j < 0 || j >= arr.length) return false;
            const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
            return true;
        };

        const areasHtml = MENU_AREAS.map((area, ai) => {
            const rows = area.tabs.map((tab, ti) => {
                const others = MENU_AREAS.filter((a) => a !== area)
                    .map((a) => `<option value="${esc(a.id)}">${esc(a.label)}</option>`).join('');
                const isDefault = (area.defaultTab || area.tabs[0]) === tab;
                return `<li class="hs-layout-tab" data-area="${esc(area.id)}" data-tab="${esc(tab)}">` +
                    iconBtn(tab) +
                    `<button type="button" class="hs-layout-btn hs-layout-star${isDefault ? ' is-on' : ''}" data-act="default" title="Default tab of this area" data-nav-item>★</button>` +
                    `<span class="hs-layout-name" draggable="true" title="Drag to move">${esc(labelOf(tab))}</span>` + renameBtn(tab) +
                    `</li>`;
            }).join('');
            return `<section class="hs-layout-area" data-area="${esc(area.id)}">` +
                `<header class="hs-layout-area-head">` + iconBtn('area:' + area.id) +
                `<span class="hs-layout-area-name" draggable="true" title="Drag to reorder areas">${esc(labelOf('area:' + area.id))}</span>` + renameBtn('area:' + area.id) +
                `</header><ul class="hs-layout-tabs">${rows}</ul></section>`;
        }).join('');

        const menuRows = menuIds().map((id) => {
            const fixed = STATION_TABS.indexOf(id) === -1;
            return `<li class="hs-layout-tab${fixed ? ' is-fixed' : ''}" data-area="${MENU}" data-tab="${esc(id)}">` +
                iconBtn(id) + `<span class="hs-layout-name" draggable="true" title="${fixed ? 'Drag to reorder (menu page, stays in the menu)' : 'Drag to move'}">${esc(labelOf(id))}</span>` + renameBtn(id) +
                `</li>`;
        }).join('');
        const menuHtml = `<section class="hs-layout-area hs-layout-area-menu" data-area="${MENU}">` +
            `<header class="hs-layout-area-head"><span class="hs-layout-area-name">MENU</span></header>` +
            `<ul class="hs-layout-tabs">${menuRows}</ul></section>`;

        panel.innerHTML =
            '<h2 class="hs-menu-panel-section-title">MENU LAYOUT</h2>' +
            '<p class="hs-menu-panel-copy">Drag the area names to reorder the top bar; drag a tab name to reorder it or move it into another area. Click an icon to change it; hover a name and click ✎ to rename it. ★ marks the tab an area opens on. Every area keeps at least one tab. The MENU card orders the menu row; station pages can move between the menu and the areas.</p>' +
            `<div class="hs-layout-areas">${areasHtml}${menuHtml}</div>` +
            '<div class="hs-menu-panel-actions"><button type="button" class="action-button hs-menu-panel-action" data-act="reset" data-nav-item>RESET LAYOUT</button></div>';

        // ---- Drag & drop: tabs between / inside areas, areas left-right.
        let drag = null; // { kind: 'tab'|'area', area, tab }
        const clearMarks = () => panel.querySelectorAll('.is-drop-before, .is-drop-after, .is-drop-into, .is-dragging')
            .forEach((el) => el.classList.remove('is-drop-before', 'is-drop-after', 'is-drop-into', 'is-dragging'));
        const dropSpot = (e) => {
            if (!drag) return null;
            if (drag.kind === 'tab') {
                const row = e.target.closest('.hs-layout-tab');
                if (row) {
                    const r = row.getBoundingClientRect();
                    return { row, area: row.getAttribute('data-area'), tab: row.getAttribute('data-tab'),
                        after: e.clientY > r.top + r.height / 2 };
                }
                const areaEl = e.target.closest('.hs-layout-area');
                return areaEl ? { areaEl, area: areaEl.getAttribute('data-area'), tab: null, after: true } : null;
            }
            const areaEl = e.target.closest('.hs-layout-area');
            if (!areaEl) return null;
            const r = areaEl.getBoundingClientRect();
            return { areaEl, area: areaEl.getAttribute('data-area'), after: e.clientX > r.left + r.width / 2 };
        };
        panel.addEventListener('dragstart', (e) => {
            // Only the labels are handles (tab name / area name).
            const row = e.target.closest('.hs-layout-name') && e.target.closest('.hs-layout-tab');
            const head = e.target.closest('.hs-layout-area-name') && e.target.closest('.hs-layout-area-head');
            if (row) drag = { kind: 'tab', area: row.getAttribute('data-area'), tab: row.getAttribute('data-tab'), el: row };
            else if (head) {
                const areaEl = head.closest('.hs-layout-area');
                drag = { kind: 'area', area: areaEl.getAttribute('data-area'), el: areaEl };
            } else return;
            e.dataTransfer.effectAllowed = 'move';
            try { e.dataTransfer.setData('text/plain', drag.tab || drag.area); } catch (err) { /* ignore */ }
            drag.el.classList.add('is-dragging');
        });
        panel.addEventListener('dragover', (e) => {
            const spot = dropSpot(e);
            if (!spot) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            panel.querySelectorAll('.is-drop-before, .is-drop-after, .is-drop-into')
                .forEach((el) => el.classList.remove('is-drop-before', 'is-drop-after', 'is-drop-into'));
            if (spot.row) spot.row.classList.add(spot.after ? 'is-drop-after' : 'is-drop-before');
            else if (drag.kind === 'tab') spot.areaEl.classList.add('is-drop-into');
            else spot.areaEl.classList.add(spot.after ? 'is-drop-after' : 'is-drop-before');
        });
        panel.addEventListener('dragend', () => { drag = null; clearMarks(); });
        panel.addEventListener('drop', (e) => {
            const spot = dropSpot(e);
            const d = drag;
            drag = null;
            clearMarks();
            if (!spot || !d) return;
            e.preventDefault();
            if (d.kind === 'area') {
                if (spot.area === MENU) return;
                const from = MENU_AREAS.findIndex((a) => a.id === d.area);
                const item = MENU_AREAS[from];
                if (!item || spot.area === d.area) return;
                MENU_AREAS.splice(from, 1);
                let to = MENU_AREAS.findIndex((a) => a.id === spot.area);
                if (spot.after) to += 1;
                MENU_AREAS.splice(to, 0, item);
                apply();
                return;
            }
            if (d.area === MENU || spot.area === MENU) {
                if (spot.tab === d.tab) return;
                const ids = menuIds();
                const insertAt = (list) => {
                    let i = spot.tab ? list.indexOf(spot.tab) : list.length;
                    if (spot.tab && spot.after) i += 1;
                    return Math.max(0, i < 0 ? list.length : i);
                };
                if (d.area === MENU && spot.area === MENU) {
                    const next = ids.filter((t) => t !== d.tab);
                    next.splice(insertAt(next), 0, d.tab);
                    setMenu(next);
                } else if (spot.area === MENU) {
                    // Area → menu (station pages only; the area keeps one tab).
                    const src = MENU_AREAS.find((a) => a.id === d.area);
                    if (!src || src.tabs.length < 2 || STATION_TABS.indexOf(d.tab) === -1) return;
                    src.tabs = src.tabs.filter((t) => t !== d.tab);
                    if (src.defaultTab === d.tab) src.defaultTab = src.tabs[0];
                    const next = ids.filter((t) => t !== d.tab);
                    next.splice(insertAt(next), 0, d.tab);
                    setMenu(next);
                } else {
                    // Menu → area (station pages only).
                    const dst = MENU_AREAS.find((a) => a.id === spot.area);
                    if (!dst || STATION_TABS.indexOf(d.tab) === -1) return;
                    setMenu(ids.filter((t) => t !== d.tab));
                    dst.tabs.splice(insertAt(dst.tabs), 0, d.tab);
                }
                apply();
                return;
            }
            const src = MENU_AREAS.find((a) => a.id === d.area);
            const dst = MENU_AREAS.find((a) => a.id === spot.area);
            if (!src || !dst || spot.tab === d.tab) return;
            // Every area keeps at least one tab.
            if (src !== dst && src.tabs.length < 2) return;
            src.tabs = src.tabs.filter((t) => t !== d.tab);
            if (src !== dst && src.defaultTab === d.tab) src.defaultTab = src.tabs[0];
            let idx = spot.tab ? dst.tabs.indexOf(spot.tab) : dst.tabs.length;
            if (spot.tab && spot.after) idx += 1;
            dst.tabs.splice(Math.max(0, idx), 0, d.tab);
            apply();
        });

        // ---- Icon picker modal.
        const openIconPicker = (key) => {
            const cur = iconOf(key);
            const def = defaultIcon(key);
            // Every sprite once (identical pixel art only the first time);
            // the clean nav icons first.
            const all = typeof IconSprites !== 'undefined' && IconSprites
                ? Object.keys(IconSprites).filter((k) => k.indexOf('__') === -1 && Array.isArray(IconSprites[k])) : [];
            all.sort((a, b) => ((b.indexOf('nav') === 0) - (a.indexOf('nav') === 0)));
            const seenArt = {};
            const keys = all.filter((k) => {
                const sig = JSON.stringify(IconSprites[k].map((row) => row.map((v) => (v >= 10 ? 1 : 0))));
                if (seenArt[sig]) return false;
                seenArt[sig] = true;
                return true;
            });
            if (cur && keys.indexOf(cur) === -1) keys.unshift(cur);
            const back = document.createElement('div');
            back.className = 'hs-layout-icon-modal-back';
            back.innerHTML = `<div class="hs-layout-icon-modal" role="dialog" aria-label="Choose icon">` +
                `<h3 class="hs-menu-panel-section-title">CHOOSE ICON</h3>` +
                `<div class="hs-layout-icon-grid">` + keys.map((k) =>
                    `<button type="button" class="hs-layout-icon-pick${k === cur ? ' is-on' : ''}${k === def ? ' is-default' : ''}" data-pick="${esc(k)}" title="${esc(k)}${k === def ? ' (default)' : ''}">${iconImg(k, 32)}</button>`).join('') +
                `</div><div class="hs-menu-panel-actions">` +
                `<button type="button" class="action-button hs-menu-panel-action hs-layout-modal-btn" data-pick="__close">CANCEL</button>` +
                `<button type="button" class="action-button hs-menu-panel-action hs-layout-modal-btn" data-pick="__default">DEFAULT</button>` +
                `</div></div>`;
            document.body.appendChild(back);
            const close = () => {
                document.removeEventListener('keydown', onKey, true);
                back.remove();
            };
            // ESC closes only the modal (capture: the station never sees it).
            const onKey = (e) => {
                if (e.key === 'Escape' || e.key === 'Backspace') {
                    e.preventDefault(); e.stopImmediatePropagation(); close();
                } else if (e.key !== 'Tab' && e.key !== 'Enter' && e.key !== ' ') {
                    e.stopImmediatePropagation();
                }
            };
            document.addEventListener('keydown', onKey, true);
            back.addEventListener('click', (e) => {
                if (e.target === back) { close(); return; }
                const b = e.target.closest('[data-pick]');
                if (!b) return;
                const v = b.getAttribute('data-pick');
                close();
                if (v === '__close') return;
                if (typeof setMenuIcon === 'function') setMenuIcon(key, v === '__default' || v === def ? null : v);
                apply();
            });
            const on = back.querySelector('.hs-layout-icon-pick.is-on') || back.querySelector('[data-pick]');
            if (on) on.focus();
        };

        // ---- Inline rename: the pencil swaps the name for a text field.
        // ENTER / blur saves, ESC cancels, an empty name restores the default.
        const startRename = (btn) => {
            const key = btn.getAttribute('data-label-key');
            const nameEl = btn.previousElementSibling;
            if (!nameEl || nameEl.tagName === 'INPUT') return;
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'hs-layout-rename-input';
            input.value = labelOf(key);
            input.maxLength = 24;
            nameEl.replaceWith(input);
            btn.hidden = true;
            input.focus();
            input.select();
            let done = false;
            const finish = (save) => {
                if (done) return;
                done = true;
                if (save) {
                    const v = input.value.trim().toUpperCase();
                    if (typeof setMenuLabel === 'function') {
                        setMenuLabel(key, !v || v === defaultLabel(key) ? null : v);
                    }
                    apply();
                } else {
                    input.replaceWith(nameEl);
                    btn.hidden = false;
                }
            };
            input.addEventListener('keydown', (e) => {
                e.stopPropagation();
                if (e.key === 'Enter') { e.preventDefault(); finish(true); }
                else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
            });
            input.addEventListener('blur', () => finish(true));
            // Don't start a drag or a click on the row from inside the field.
            ['mousedown', 'click', 'dragstart'].forEach((t) => input.addEventListener(t, (e) => e.stopPropagation()));
        };

        panel.addEventListener('click', (e) => {
            const renameB = e.target.closest('button[data-act="rename"]');
            if (renameB) { startRename(renameB); return; }
            const iconB = e.target.closest('button[data-act="icon"]');
            if (iconB) { openIconPicker(iconB.getAttribute('data-icon-key')); return; }
            const btn = e.target.closest('button[data-act]');
            if (!btn || btn.disabled) return;
            const act = btn.getAttribute('data-act');
            if (act === 'reset') {
                if (typeof resetMenuAreas === 'function') resetMenuAreas();
                if (typeof resetMenuIcons === 'function') resetMenuIcons();
                if (typeof resetMenuLabels === 'function') resetMenuLabels();
                apply();
                return;
            }
            const areaEl = btn.closest('[data-area]');
            const ai = MENU_AREAS.findIndex((a) => a.id === (areaEl && areaEl.getAttribute('data-area')));
            if (ai < 0) return;
            const area = MENU_AREAS[ai];
            if (act === 'area-up' || act === 'area-down') {
                if (move(MENU_AREAS, ai, act === 'area-up' ? -1 : 1)) apply();
                return;
            }
            const tab = btn.closest('[data-tab]') && btn.closest('[data-tab]').getAttribute('data-tab');
            const ti = area.tabs.indexOf(tab);
            if (ti < 0) return;
            if (act === 'default') { area.defaultTab = tab; apply(); return; }
            if (act === 'tab-up' || act === 'tab-down') {
                if (move(area.tabs, ti, act === 'tab-up' ? -1 : 1)) apply();
            }
        });
        panel.addEventListener('change', (e) => {
            const sel = e.target.closest('select[data-act="tab-move"]');
            if (!sel || !sel.value) return;
            const row = sel.closest('[data-tab]');
            const from = MENU_AREAS.find((a) => a.id === row.getAttribute('data-area'));
            const to = MENU_AREAS.find((a) => a.id === sel.value);
            const tab = row.getAttribute('data-tab');
            if (!from || !to || from.tabs.length < 2) return;
            from.tabs = from.tabs.filter((t) => t !== tab);
            if (from.defaultTab === tab) from.defaultTab = from.tabs[0];
            to.tabs.push(tab);
            apply();
        });
    }
});
