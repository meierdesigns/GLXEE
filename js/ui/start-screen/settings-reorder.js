"use strict";

// StartScreenManager methods: drag & drop order of the rows inside each settings section.
// The order is saved per row key in localStorage and applied to settingsItems before the
// panel is built, so keyboard navigation follows the visible order.
const SETTINGS_GROUPS_KEY = 'vf_settings_groups_v1';
const SETTINGS_DEFAULT_GROUPS = {
    fx: [
        { id: 'light', title: 'LIGHT', rows: ['uiFx:glow', 'uiFx:hdr', 'uiFx:vignette'] },
        { id: 'scan', title: 'SCANLINES', rows: ['uiFx:scanlines', 'uiFx:scanSize', 'uiFx:scanSpeed', 'uiFx:scanWarp'] },
        { id: 'tube', title: 'TUBE', rows: ['uiFx:crt', 'uiFx:chroma', 'uiFx:noise', 'uiFx:flicker'] },
        { id: 'bloom', title: 'BLOOM', rows: ['uiFx:bloom', 'uiFx:bloomSpread', 'uiFx:bloomThreshold'] },
        { id: 'misc', title: 'GENERAL', rows: ['uiFx:fxScale', 'uiFx:arcade', 'uiFx:fxArea'] },
    ],
};
const SETTINGS_NAV_KEY = 'vf_settings_nav_v2';
const SETTINGS_DEFAULT_CLUSTERS = [
    { id: 'appearance', title: 'APPEARANCE', sections: ['theme', 'look', 'style', 'voxel', 'fx'] },
    { id: 'game', title: 'GAME', sections: ['game', 'enemies', 'shots'] },
    { id: 'audio', title: 'AUDIO', sections: ['sound'] },
    { id: 'tools', title: 'TOOLS', sections: ['assets'] },
];

extendClass(StartScreenManager, {
    /** Compact solid drag preview (the browser's own ghost of a glowing row looks washed out). */
    setSettingsDragImage(e, source, text) {
        const ghost = document.createElement('div');
        ghost.className = 'settings-drag-ghost';
        const icon = source.querySelector('.settings-section-icon');
        if (icon) ghost.appendChild(icon.cloneNode(true));
        const t = document.createElement('span');
        t.textContent = text;
        ghost.appendChild(t);
        document.body.appendChild(ghost);
        try { e.dataTransfer.setDragImage(ghost, 14, ghost.offsetHeight / 2); } catch (err) { /* optional */ }
        setTimeout(() => ghost.remove(), 0);
    },

    /** Moves the absolutely positioned drop bar to the gap before `ref` (or after the last child) without touching the layout. */
    positionDropLine(line, container, parent, ref) {
        if (line.parentNode !== container) container.appendChild(line);
        const c = container.getBoundingClientRect();
        let y;
        if (ref) y = ref.getBoundingClientRect().top - 4;
        else {
            const last = Array.from(parent.children).filter((n) => n !== line).pop();
            y = last ? last.getBoundingClientRect().bottom + 2 : parent.getBoundingClientRect().top;
        }
        line.style.top = Math.round(y - c.top + container.scrollTop) + 'px';
    },

    settingsItemKey(item) {
        return `${item.type || ''}:${item.fxKey || item.lookKey || item.enemyClass || item.shotKind || item.action || item.name || ''}`;
    },

    /** Next/previous settings row in the order shown on screen (rows can be regrouped by the user). */
    stepSettingsIndex(dir) {
        const host = this.getUIHost && this.getUIHost();
        const rows = host ? Array.from(host.querySelectorAll('.settings-row[data-settings-index]')) : [];
        const at = rows.findIndex((r) => Number(r.dataset.settingsIndex) === this.settingsIndex);
        if (at < 0) return Math.max(0, Math.min(this.settingsItems.length - 1, this.settingsIndex + dir));
        const next = rows[Math.max(0, Math.min(rows.length - 1, at + dir))];
        return Number(next.dataset.settingsIndex);
    },

    /** Splits one section's rows into movable sub-clusters (saved per section). */
    buildSectionGroups(det) {
        const list = det.querySelector('.settings-section-list');
        if (!list) return;
        const sid = det.dataset.section;
        const rows = Array.from(list.children).filter((r) => r.dataset.settingsKey);
        if (!rows.length) return;
        const byKey = new Map(rows.map((r) => [r.dataset.settingsKey, r]));
        let all = {};
        try { all = JSON.parse(localStorage.getItem(SETTINGS_GROUPS_KEY) || '{}') || {}; } catch (e) { all = {}; }
        const base = all[sid] || SETTINGS_DEFAULT_GROUPS[sid] || [{ id: 'main', title: '', rows: rows.map((r) => r.dataset.settingsKey) }];
        const layout = base.map((g) => ({ id: String(g.id), title: String(g.title || ''), rows: (g.rows || []).filter((k) => byKey.has(k)) }));
        const placed = new Set(layout.flatMap((g) => g.rows));
        rows.forEach((r) => {
            if (placed.has(r.dataset.settingsKey)) return;
            const last = layout[layout.length - 1] || (layout[0] = { id: 'main', title: '', rows: [] });
            last.rows.push(r.dataset.settingsKey);
        });

        list.style.position = 'relative';
        list.classList.add('settings-grouped');
        list.replaceChildren();
        const line = document.createElement('div');
        line.className = 'settings-drop-line is-abs';
        let drag = null;
        let target = null;
        let lastKey = '';
        const root = document.documentElement;
        const endDrag = () => {
            if (drag) drag.el.classList.remove('is-dragging');
            drag = null; target = null; lastKey = '';
            line.remove();
            root.removeAttribute('data-vf-dragging');
        };
        const save = () => {
            const out = Array.from(list.querySelectorAll(':scope > .settings-group')).map((g) => ({
                id: g.dataset.group,
                title: g.querySelector('.settings-group-title').textContent,
                rows: Array.from(g.querySelectorAll('.settings-row')).map((r) => r.dataset.settingsKey),
            }));
            all[sid] = out;
            try { localStorage.setItem(SETTINGS_GROUPS_KEY, JSON.stringify(all)); } catch (e) { /* optional */ }
        };
        const place = (parent, ref, key) => {
            if (key === lastKey) return;
            lastKey = key;
            target = { parent, ref };
            this.positionDropLine(line, list, parent, ref);
        };
        const before = (e, el) => { const r = el.getBoundingClientRect(); return e.clientY < r.top + r.height / 2; };
        const startDrag = (e, el, type, text) => {
            drag = { el, type };
            el.classList.add('is-dragging');
            root.setAttribute('data-vf-dragging', 'on');
            e.dataTransfer.effectAllowed = 'move';
            try { e.dataTransfer.setData('text/plain', text); } catch (err) { /* optional */ }
            this.setSettingsDragImage(e, el, text);
        };
        const dropHere = (e) => {
            if (!drag || !target) return;
            e.preventDefault();
            target.parent.insertBefore(drag.el, target.ref);
            endDrag();
            save();
        };
        const wireRow = (row) => {
            const label = row.querySelector('.settings-row-label');
            if (!label) return;
            label.draggable = true;
            label.title = 'Drag to reorder or move to another cluster';
            label.addEventListener('dragstart', (e) => { e.stopPropagation(); startDrag(e, row, 'row', label.textContent.trim()); });
            label.addEventListener('dragend', endDrag);
            row.addEventListener('dragover', (e) => {
                if (!drag || drag.type !== 'row' || drag.el === row) return;
                e.preventDefault();
                const b = before(e, row);
                place(row.parentNode, b ? row : row.nextElementSibling, row.dataset.settingsKey + (b ? '<' : '>'));
            });
            row.addEventListener('drop', dropHere);
        };
        const makeGroup = (g) => {
            const blk = document.createElement('div');
            blk.className = 'settings-group';
            blk.dataset.group = g.id;
            const head = document.createElement('div');
            head.className = 'settings-group-head';
            head.draggable = true;
            head.title = 'Drag to move the cluster, double-click to rename';
            const title = document.createElement('span');
            title.className = 'settings-group-title';
            title.textContent = g.title;
            head.appendChild(title);
            const del = document.createElement('button');
            del.type = 'button';
            del.className = 'settings-cluster-del';
            del.textContent = '✕';
            del.title = 'Remove empty cluster';
            del.addEventListener('click', () => { blk.remove(); save(); });
            head.appendChild(del);
            head.addEventListener('dblclick', () => {
                const next = window.prompt('Cluster name', title.textContent);
                if (next != null) { title.textContent = next.trim().toUpperCase().slice(0, 24); head.classList.toggle('is-untitled', !title.textContent); save(); }
            });
            head.classList.toggle('is-untitled', !g.title);
            const body = document.createElement('div');
            body.className = 'settings-group-body';
            g.rows.forEach((k) => { const r = byKey.get(k); wireRow(r); body.appendChild(r); });
            head.addEventListener('dragstart', (e) => startDrag(e, blk, 'group', title.textContent || 'Cluster'));
            head.addEventListener('dragend', endDrag);
            blk.addEventListener('dragover', (e) => {
                if (!drag || drag.el === blk) return;
                if (drag.type === 'group') {
                    e.preventDefault();
                    const b = before(e, blk);
                    const nx = blk.nextElementSibling;
                    place(list, b ? blk : (nx && nx.classList.contains('settings-group') ? nx : addBtn), g.id + (b ? '<' : '>'));
                } else if (head.contains(e.target) || e.target === body || !body.children.length) {
                    e.preventDefault();
                    place(body, body.firstElementChild, g.id + ':top');
                }
            });
            blk.addEventListener('drop', dropHere);
            blk.appendChild(head);
            blk.appendChild(body);
            return blk;
        };
        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'settings-nav-add';
        addBtn.textContent = '+ CLUSTER';
        addBtn.addEventListener('click', () => {
            const blk = makeGroup({ id: 'g' + Date.now(), title: 'NEW', rows: [] });
            list.insertBefore(blk, addBtn);
            save();
        });
        layout.forEach((g) => list.appendChild(makeGroup(g)));
        list.appendChild(addBtn);
    },

    /** Master/detail layout: clustered section list on the left, the open section on the right. */
    buildSettingsMaster(panel) {
        if (!panel.querySelector('details.settings-section[data-section="debug"]')) {
            const debug = document.createElement('details');
            debug.className = 'settings-section';
            debug.dataset.section = 'debug';
            debug.open = false;
            debug.innerHTML = `
                <summary class="settings-section-title">
                    <span class="settings-section-name">DEBUG</span>
                </summary>
                <div class="settings-section-list">
                    <div class="settings-grouped">
                        <div class="settings-group">
                            <div class="settings-group-head"><span>DIAGNOSTICS</span></div>
                            <div class="settings-group-body">
                                <div class="settings-row">
                                    <span class="settings-row-label">FPS COUNTER</span>
                                    <button type="button" class="settings-cycle-btn" data-debug-action="fps">OFF</button>
                                </div>
                                <div class="settings-row">
                                    <span class="settings-row-label">PERFORMANCE MODE</span>
                                    <button type="button" class="settings-cycle-btn" data-debug-action="perf">OFF</button>
                                </div>
                            </div>
                        </div>
                        <div class="settings-group">
                            <div class="settings-group-head"><span>ACTIONS</span></div>
                            <div class="settings-group-body">
                                <div class="settings-row">
                                    <span class="settings-row-label">RELOAD GAME</span>
                                    <button type="button" class="settings-cycle-btn" data-debug-action="reload">RUN</button>
                                </div>
                                <div class="settings-row">
                                    <span class="settings-row-label">CLEAR LOCAL SETTINGS</span>
                                    <button type="button" class="settings-cycle-btn" data-debug-action="clear">CLEAR</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>`;
            panel.appendChild(debug);
            debug.querySelectorAll('[data-debug-action]').forEach((button) => {
                button.addEventListener('click', () => {
                    const action = button.dataset.debugAction;
                    if (action === 'reload') window.location.reload();
                    if (action === 'clear') {
                        try { localStorage.clear(); sessionStorage.clear(); } catch (e) { /* optional */ }
                        window.location.reload();
                    }
                    if (action === 'fps') {
                        const on = document.documentElement.toggleAttribute('data-vf-debug-fps');
                        button.textContent = on ? 'ON' : 'OFF';
                    }
                    if (action === 'perf') {
                        const on = document.documentElement.toggleAttribute('data-vf-performance');
                        button.textContent = on ? 'ON' : 'OFF';
                        try {
                            if (window.vfPerf) {
                                window.vfPerf.sway = on ? 'OFF' : 'AUTO';
                                window.vfPerf.heavy = 'OFF';
                                window.vfPerf.anim = on ? 'OFF' : 'ON';
                                localStorage.setItem('vf-perf', JSON.stringify(window.vfPerf));
                            }
                            document.documentElement.setAttribute('data-vf-perf-heavy', 'off');
                            document.documentElement.setAttribute('data-vf-perf-anim', on ? 'off' : 'on');
                            if (window.VFBgMouseParallaxParts && VFBgMouseParallaxParts.applyIntensity) {
                                VFBgMouseParallaxParts.applyIntensity(on ? 'OFF' : 'NORMAL', true);
                            }
                            if (on && typeof uiAppearanceManager !== 'undefined' && uiAppearanceManager.setFx) {
                                uiAppearanceManager.setFx('framePx', 'OFF');
                            }
                        } catch (e) { /* ignore */ }
                    }
                });
            });
        }
        const dets = Array.from(panel.querySelectorAll('details.settings-section'));
        if (!dets.length) return;
        const byId = new Map(dets.map((d) => [d.dataset.section, d]));
        let saved = null;
        try { saved = JSON.parse(localStorage.getItem(SETTINGS_NAV_KEY) || 'null'); } catch (e) { saved = null; }
        const layout = (Array.isArray(saved) && saved.length ? saved : SETTINGS_DEFAULT_CLUSTERS)
            .map((c) => ({ id: String(c.id), title: String(c.title || 'CLUSTER'), sections: (c.sections || []).filter((id) => byId.has(id)) }));
        const placed = new Set(layout.flatMap((c) => c.sections));
        dets.forEach((d) => {
            if (placed.has(d.dataset.section)) return;
            const home = SETTINGS_DEFAULT_CLUSTERS.find((c) => c.sections.includes(d.dataset.section));
            const target = (home && layout.find((c) => c.id === home.id)) || layout[layout.length - 1] || (layout[0] = { id: 'main', title: 'SETTINGS', sections: [] });
            target.sections.push(d.dataset.section);
        });

        dets.forEach((d) => this.buildSectionGroups(d));
        const nav = document.createElement('div');
        nav.className = 'settings-nav';
        const detail = document.createElement('div');
        detail.className = 'settings-detail';
        const items = new Map();
        const line = document.createElement('div');
        line.className = 'settings-drop-line is-abs';
        let target = null;
        let drag = null;
        let lastKey = '';
        const root = document.documentElement;
        const endDrag = () => {
            if (drag) drag.el.classList.remove('is-dragging');
            drag = null; lastKey = ''; target = null;
            line.remove();
            root.removeAttribute('data-vf-dragging');
        };
        const save = () => {
            const out = Array.from(nav.querySelectorAll(':scope > .settings-cluster-block')).map((blk) => ({
                id: blk.dataset.cluster,
                title: blk.querySelector('.settings-cluster-title').textContent,
                sections: Array.from(blk.querySelectorAll('.settings-nav-item')).map((b) => b.dataset.section),
            }));
            try { localStorage.setItem(SETTINGS_NAV_KEY, JSON.stringify(out)); } catch (e) { /* optional */ }
        };
        const show = (id) => {
            dets.forEach((d) => {
                const on = d.dataset.section === id;
                if (d.open !== on) d.open = on;
                items.get(d.dataset.section).classList.toggle('active', on);
            });
        };
        // Where the dragged thing would land: [parent, referenceNode], or null.
        const place = (parent, ref, key) => {
            if (key === lastKey) return;
            lastKey = key;
            target = { parent, ref };
            this.positionDropLine(line, nav, parent, ref);
        };
        const before = (e, el) => { const r = el.getBoundingClientRect(); return e.clientY < r.top + r.height / 2; };
        const startDrag = (e, el, type, text, iconSrc) => {
            drag = { el, type };
            el.classList.add('is-dragging');
            root.setAttribute('data-vf-dragging', 'on');
            e.dataTransfer.effectAllowed = 'move';
            try { e.dataTransfer.setData('text/plain', text); } catch (err) { /* optional */ }
            this.setSettingsDragImage(e, iconSrc || el, text);
        };
        const dropHere = (e) => {
            if (!drag || !target) return;
            e.preventDefault();
            target.parent.insertBefore(drag.el, target.ref);
            endDrag();
            save();
        };

        const makeItem = (d) => {
            const id = d.dataset.section;
            const head = d.querySelector(':scope > summary.settings-section-title');
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'settings-nav-item';
            btn.dataset.section = id;
            btn.draggable = true;
            btn.title = 'Click to open, drag to reorder or move to another cluster';
            const icon = head && head.querySelector('.settings-section-icon');
            if (icon) btn.appendChild(icon.cloneNode(true));
            const name = document.createElement('span');
            name.textContent = head ? head.textContent.trim() : id;
            btn.appendChild(name);
            btn.addEventListener('click', () => show(id));
            btn.addEventListener('dragstart', (e) => startDrag(e, btn, 'section', name.textContent));
            btn.addEventListener('dragend', endDrag);
            btn.addEventListener('dragover', (e) => {
                if (!drag || drag.type !== 'section' || drag.el === btn) return;
                e.preventDefault();
                const b = before(e, btn);
                place(btn.parentNode, b ? btn : btn.nextElementSibling, id + (b ? '<' : '>'));
            });
            btn.addEventListener('drop', dropHere);
            items.set(id, btn);
            detail.appendChild(d);
            d.addEventListener('toggle', () => { if (d.open) show(id); });
            return btn;
        };

        const makeCluster = (c) => {
            const blk = document.createElement('div');
            blk.className = 'settings-cluster-block';
            blk.dataset.cluster = c.id;
            const head = document.createElement('div');
            head.className = 'settings-cluster-head';
            head.draggable = true;
            head.title = 'Drag to move the cluster, double-click to rename';
            const title = document.createElement('span');
            title.className = 'settings-cluster-title';
            title.textContent = c.title;
            head.appendChild(title);
            const del = document.createElement('button');
            del.type = 'button';
            del.className = 'settings-cluster-del';
            del.textContent = '✕';
            del.title = 'Remove empty cluster';
            del.addEventListener('click', () => { blk.remove(); save(); });
            head.appendChild(del);
            head.addEventListener('dblclick', () => {
                const next = window.prompt('Cluster name', title.textContent);
                if (next && next.trim()) { title.textContent = next.trim().toUpperCase().slice(0, 24); save(); }
            });
            const body = document.createElement('div');
            body.className = 'settings-cluster-body';
            c.sections.forEach((id) => body.appendChild(makeItem(byId.get(id))));
            head.addEventListener('dragstart', (e) => startDrag(e, blk, 'cluster', title.textContent));
            head.addEventListener('dragend', endDrag);
            blk.addEventListener('dragover', (e) => {
                if (!drag || drag.el === blk) return;
                if (drag.type === 'cluster') {
                    e.preventDefault();
                    const b = before(e, blk);
                    place(nav, b ? blk : (blk.nextElementSibling && blk.nextElementSibling.classList.contains('settings-cluster-block') ? blk.nextElementSibling : add), c.id + (b ? '<' : '>'));
                } else if (e.target === head || head.contains(e.target) || !body.children.length || e.target === body) {
                    // Over the header (or an empty cluster): the item goes to the top of this cluster.
                    e.preventDefault();
                    place(body, body.firstElementChild, c.id + ':top');
                }
            });
            blk.addEventListener('drop', dropHere);
            blk.appendChild(head);
            blk.appendChild(body);
            return blk;
        };
        layout.forEach((c) => nav.appendChild(makeCluster(c)));

        const add = document.createElement('button');
        add.type = 'button';
        add.className = 'settings-nav-add';
        add.textContent = '+ CLUSTER';
        add.addEventListener('click', () => {
            nav.insertBefore(makeCluster({ id: 'c' + Date.now(), title: 'NEW', sections: [] }), add);
            save();
        });
        nav.appendChild(add);

        panel.querySelectorAll('.settings-cluster').forEach((c) => c.remove());
        panel.classList.add('settings-panel-master');
        panel.appendChild(nav);
        panel.appendChild(detail);
        const open = dets.find((d) => d.open) || dets[0];
        show(open.dataset.section);
    },
});
