"use strict";

// Hangar sidebar: show one ship area at a time (always open) with
// previous / next buttons above it, instead of an accordion of closed sections.
(function () {
    HomeStationUI.prototype._areaPager = true; // replaces the accordion behaviour
    const original = HomeStationUI.prototype.renderComponentTree;

    function branches(container) {
        return Array.from(container.querySelectorAll(':scope .hs-tree-root > .hs-tree-branch'));
    }

    function labelOf(branch) {
        const s = branch.querySelector(':scope > summary');
        return s ? s.textContent.replace(/\s+/g, ' ').trim().toUpperCase() : 'AREA';
    }

    function apply(ui, container) {
        const list = branches(container);
        if (!list.length) return;
        const idx = Math.max(0, Math.min(list.length - 1, ui._areaIdx || 0));
        ui._areaIdx = idx;
        list.forEach((b, i) => {
            b.classList.toggle('is-paged-out', i !== idx);
            b.classList.toggle('is-paged-in', i === idx);
            if (i === idx && !b.open) b.open = true;
        });
        // Everything stays expanded: no collapsing of areas or their sub-sections.
        container.querySelectorAll('.hs-tree-branch.is-paged-in, .hs-tree-branch.is-paged-in details').forEach((d) => {
            if (!d.open) d.open = true;
            if (!d._noCollapse) {
                d._noCollapse = true;
                const sum = d.querySelector(':scope > summary');
                if (sum) sum.addEventListener('click', (e) => { if (!e.target.closest('input, label, button, select')) e.preventDefault(); });
            }
        });
        const tc = container.closest('.hs-component-tree-container');
        const aside = container.closest('.hs-hangar-list');
        const shipsBox = aside && aside.querySelector('#hsHangarShipsContainer');
        const isCurrent = container.getAttribute('data-ship-id') === ui.hangarShipId;
        // The area bar is pinned above the scrolling ship list, so the
        // scrollbar starts below it and the bar never scrolls away.
        let head = tc ? tc.querySelector('.hs-component-tree-header') : null;
        const pinned = aside ? aside.querySelector(':scope > .hs-component-tree-header.is-pinned') : null;
        if (isCurrent && shipsBox) {
            if (!head) head = pinned;
            if (head && head !== pinned) {
                if (pinned) pinned.remove();
                head.classList.add('is-pinned');
                aside.insertBefore(head, shipsBox);
            }
        } else if (!head) {
            return;
        }
        if (!head) return;
        // Icon buttons: ‹ [nose] [core] [wings] [aft] ›  (selected area lit)
        const kindOf = (b) => {
            const t = labelOf(b);
            return /NOSE|FRONT/.test(t) ? 'front' : /CORE|CENTER/.test(t) ? 'center' : /WING/.test(t) ? 'wing' : /AFT|BACK|REAR/.test(t) ? 'back' : 'center';
        };
        // Zoomed, bright close-ups of each area (16x16 grid): hull in light, details in accent.
        const H = 'class="ai-hull"', A = 'class="ai-acc"';
        const art = {
            front: '<path ' + H + ' d="M7 1h2v2h1v2h1v2h1v3H4V7h1V5h1V3h1z"/><path ' + A + ' d="M7 4h2v3H7z"/><path ' + H + ' d="M3 12h10v2H3z"/>',
            center: '<path ' + H + ' d="M3 2h10v12H3z"/><path d="M5 4h6v8H5z" fill="#05060a"/><path ' + A + ' d="M6 6h4v4H6z"/><path ' + H + ' d="M7 7h2v2H7z"/>',
            wing: '<path ' + H + ' d="M1 4h4v2h2v2h2v2h2v2h4v2H1z"/><path ' + A + ' d="M2 12h4v1H2zM4 8h2v1H4z"/><path ' + H + ' d="M14 4h1v6h-1z"/>',
            back: '<path ' + H + ' d="M3 2h10v6H3z"/><path d="M4 3h8v4H4z" fill="#05060a"/><path ' + H + ' d="M3 9h4v3H3zM9 9h4v3H9z"/><path ' + A + ' d="M4 13h2v2H4zM10 13h2v2h-2z"/>'
        };
        const icon = (kind) => '<svg viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">' + (art[kind] || art.center) + '</svg>';
        head.innerHTML = '<button type="button" class="hs-area-nav is-step" data-nav-item data-area-step="-1" title="Previous area" aria-label="Previous area">‹</button>' +
            '<span class="hs-area-icons">' + list.map((b, i) =>
                '<button type="button" class="hs-area-nav is-icon' + (i === idx ? ' is-current' : '') + '" data-nav-item data-area-go="' + i + '" title="' +
                labelOf(b).replace(/[0-9]+$/, '').trim() + '" aria-label="' + labelOf(b) + '">' + icon(kindOf(b)) + '</button>').join('') + '</span>' +
            '<button type="button" class="hs-area-nav is-step" data-nav-item data-area-step="1" title="Next area" aria-label="Next area">›</button>';
        const go = (n) => { ui._areaIdx = n; apply(ui, container); };
        head.querySelectorAll('[data-area-step]').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.preventDefault(); e.stopPropagation();
                go((idx + Number(btn.getAttribute('data-area-step')) + list.length) % list.length);
            });
        });
        head.querySelectorAll('[data-area-go]').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.preventDefault(); e.stopPropagation();
                go(Number(btn.getAttribute('data-area-go')));
            });
        });
    }

    HomeStationUI.prototype.renderComponentTree = function (shipId, treeContainer) {
        const r = original.apply(this, arguments);
        const c = treeContainer || (this.overlay && this.overlay.querySelector('.hs-component-tree[data-ship-id]'));
        if (c) apply(this, c);
        return r;
    };
})();
