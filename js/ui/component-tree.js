// Component Tree View for Hangar UI
class ComponentTree {
    constructor() {
        this.expandedDepth = 0;
        this.expandedNodes = new Set();
        this.shipId = null;
        this.storageKey = 'vf_component_tree_expanded_v1';
    }

    setShip(shipId) {
        const nextShipId = String(shipId || '');
        if (this.shipId === nextShipId) return;

        this.persistExpandedNodes();
        this.shipId = nextShipId;
        const stored = localStorage.getItem(`${this.storageKey}:${encodeURIComponent(nextShipId)}`);
        this.expandedNodes = new Set(stored ? stored.split('|').filter(Boolean) : []);
    }

    setNodeExpanded(nodeId, isExpanded) {
        if (!nodeId) return;
        if (isExpanded) {
            this.expandedNodes.add(nodeId);
        } else {
            this.expandedNodes.delete(nodeId);
        }
        this.persistExpandedNodes();
    }

    persistExpandedNodes() {
        if (this.shipId === null) return;
        localStorage.setItem(
            `${this.storageKey}:${encodeURIComponent(this.shipId)}`,
            [...this.expandedNodes].join('|')
        );
    }

    /**
     * Render a complete component tree with slots
     * @param {Object} hangarSlots - Slot configuration from shipLoadoutManager
     * @param {Object} loadout - Current ship loadout
     * @param {Object} inventory - Available components
     * @returns {string} HTML for the tree
     */
    render(hangarSlots, loadout, inventory, skinOptionsForSlot, styleOptionsForArea) {
        if (!hangarSlots || !hangarSlots.slots) return '<div class="hs-tree-empty">No components</div>';

        // With wing symmetry on, both wings share one style, so they show as
        // a single WINGS branch holding the slots of both sides.
        const wingConfig = styleOptionsForArea ? styleOptionsForArea('wingLeft') : null;
        const symmetric = !!(wingConfig && wingConfig.symmetric);
        const tree = {};
        const areas = symmetric
            ? ['front', 'center', 'wings', 'back']
            : ['front', 'center', 'wingLeft', 'wingRight', 'back'];
        areas.forEach((area) => {
            tree[area] = (hangarSlots.slots || []).filter((slot) => slot && (area === 'wings'
                ? slot.area === 'wingLeft' || slot.area === 'wingRight'
                : slot.area === area));
        });

        return `<div class="hs-tree-root">${
            areas
                .map((area) => this.renderBranch(
                    area,
                    tree[area],
                    loadout,
                    inventory,
                    skinOptionsForSlot,
                    styleOptionsForArea
                ))
                .join('')
        }</div>`;
    }

    /**
     * Render a ship-area branch (e.g., "LEFT WING", "AFT").
     */
    renderBranch(area, slots, loadout, inventory, skinOptionsForSlot, styleOptionsForArea) {
        const label = this.labelForArea(area);
        const nodeId = `hs-tree-area-${area}`;
        const isExpanded = this.expandedNodes.has(nodeId);
        const styleConfig = styleOptionsForArea
            ? styleOptionsForArea(area === 'wings' ? 'wingLeft' : area)
            : { styles: [] };
        const styles = Array.isArray(styleConfig) ? styleConfig : styleConfig.styles;
        const styleControls = styles.length > 1
            ? `<div class="hs-tree-area-style">
                    <span class="hs-tree-skin-label">HULL STYLE</span>
                    ${this.renderStyleCarousel(styles.map((style) => ({
                        active: style.active,
                        label: style.label,
                        attrs: `data-tree-area-style="${area}" data-segment-id="${style.segmentId}" data-style-index="${style.index}"`,
                        thumb: `data-thumb="area" data-thumb-area="${area === 'wings' ? 'wingRight' : area}" data-thumb-index="${style.index}"`
                    })))}
                </div>`
            : '';
        const symmetryControl = styleConfig.isWing
            ? `<button type="button" class="hs-tree-wing-symmetry${styleConfig.symmetric ? ' is-active' : ''}" data-tree-wing-symmetry="${styleConfig.symmetric ? 'on' : 'off'}">SYMMETRY ${styleConfig.symmetric ? 'ON' : 'OFF'}</button>`
            : '';

        return `
            <details class="hs-tree-branch" ${isExpanded ? 'open' : ''} id="${nodeId}">
                <summary class="hs-tree-branch-label">
                    <span class="hs-tree-toggle">▶</span>
                    <span class="hs-tree-icon">${this.iconForArea(area)}</span>
                    <span class="hs-tree-text">${label} ${slots.length}</span>
                </summary>
                <div class="hs-tree-items">
                    ${symmetryControl}
                    ${styleControls}
                    ${slots.length
                        ? slots.map((slot) => this.renderSlot(slot.kind, slot, loadout, inventory, skinOptionsForSlot)).join('')
                        : '<div class="hs-tree-empty">NO COMPONENTS</div>'}
                </div>
            </details>
        `;
    }

    /**
     * Horizontal style picker: ‹ / › step to the neighbouring style, and the
     * strip in between shows every style as a thumbnail. Each control carries
     * the same data attributes as the old text buttons, so the existing
     * click handlers apply the choice unchanged. Thumbnails are canvases
     * painted after render (see renderStyleThumbs).
     */
    renderStyleCarousel(options) {
        if (!options.length) return '';
        const activeIndex = Math.max(0, options.findIndex((opt) => opt.active));
        const prev = options[(activeIndex - 1 + options.length) % options.length];
        const next = options[(activeIndex + 1) % options.length];
        return `<div class="hs-style-carousel">
                <button type="button" class="hs-style-carousel-step" ${prev.attrs} aria-label="Previous style">‹</button>
                <div class="hs-style-carousel-track">
                    ${options.map((opt) => `<button type="button" class="hs-style-thumb${opt.active ? ' is-active' : ''}" ${opt.attrs} title="${opt.label}" aria-label="${opt.label}" aria-pressed="${!!opt.active}">
                        <canvas width="48" height="36" ${opt.thumb}></canvas>
                    </button>`).join('')}
                </div>
                <button type="button" class="hs-style-carousel-step" ${next.attrs} aria-label="Next style">›</button>
                <span class="hs-style-carousel-count">${activeIndex + 1}/${options.length}</span>
            </div>`;
    }

    /**
     * Render a single slot with dropdown for equipping
     */
    renderSlot(kind, slot, loadout, inventory, skinOptionsForSlot) {
        const slotIndex = slot.index;
        const slotId = `hs-tree-slot-${kind}-${slotIndex}`;
        const equipped = this.getEquippedModule(loadout, kind, slotIndex);
        const isExpanded = this.expandedNodes.has(slotId);
        const inventoryKey = this.loadoutKeyForKind(kind);

        const availableComponents = (inventory && inventory[inventoryKey]) || [];
        const options = availableComponents.map((comp) => {
            const selected = equipped === comp ? ' selected' : '';
            return `<option value="${comp}"${selected}>${comp}</option>`;
        }).join('');
        const skins = equipped && skinOptionsForSlot
            ? skinOptionsForSlot(kind, slot, equipped)
            : [];
        const skinControls = skins.length > 1
            ? `<div class="hs-tree-skin-controls">
                    <span class="hs-tree-skin-label">STYLE</span>
                    ${this.renderStyleCarousel(skins.map((skin) => ({
                        active: skin.active,
                        label: skin.label,
                        attrs: `data-tree-skin-set="${kind}" data-slot-index="${slotIndex}" data-mod-face="${slot.face || ''}" data-skin-id="${skin.id}"`,
                        thumb: `data-thumb="skin" data-thumb-kind="${kind}" data-thumb-module="${equipped}" data-thumb-skin="${skin.id}" data-thumb-face="${slot.face || ''}"`
                    })))}
                </div>`
            : '';

        return `
            <details class="hs-tree-item" ${isExpanded ? 'open' : ''} id="${slotId}">
                <summary class="hs-tree-item-label">
                    <span class="hs-tree-toggle">▶</span>
                    <span class="hs-tree-slot-name">${slot.label || `SLOT ${slotIndex + 1}`}</span>
                    ${equipped ? `<span class="hs-tree-equipped">${equipped}</span>` : '<span class="hs-tree-empty-slot">—</span>'}
                </summary>
                <div class="hs-tree-slot-content">
                    <select class="hs-tree-slot-select" data-slot-kind="${kind}" data-slot-index="${slotIndex}">
                        <option value="">UNEQUIP</option>
                        ${options}
                    </select>
                    ${skinControls}
                </div>
            </details>
        `;
    }

    /**
     * Get the currently equipped module for a slot
     */
    getEquippedModule(loadout, kind, slotIndex) {
        const key = this.loadoutKeyForKind(kind);
        if (!loadout || !loadout[key]) return null;
        const equipped = loadout[key][slotIndex];
        return equipped || null;
    }

    loadoutKeyForKind(kind) {
        return {
            weapon: 'weapons',
            defense: 'defenses',
            ability: 'abilities',
            energy: 'energy'
        }[kind] || kind;
    }

    /**
     * Get label for a structural ship area.
     */
    labelForArea(area) {
        return {
            front: 'NOSE',
            center: 'CORE',
            wingLeft: 'LEFT WING',
            wingRight: 'RIGHT WING',
            wings: 'WINGS',
            back: 'AFT'
        }[area] || area.toUpperCase();
    }

    /**
     * Get icon for a structural ship area.
     */
    iconForArea(area) {
        const icons = {
            front: '▲',
            center: '◆',
            wingLeft: '◀',
            wingRight: '▶',
            wings: '◀▶',
            back: '▼'
        };
        return icons[area] || '◆';
    }

    /**
     * Set the expand depth from slider value
     */
    setExpandDepth(depth) {
        this.expandedDepth = Math.max(0, Math.min(3, parseInt(depth, 10)));
        this.updateAllDetails();
    }

    /**
     * Update all details elements based on current depth
     */
    updateAllDetails() {
        const roots = document.querySelectorAll('.hs-component-tree[data-ship-id]');
        if (!roots.length) return;

        roots.forEach((root) => {
            // Update branches (depth 1)
            root.querySelectorAll('.hs-tree-branch').forEach((branch) => {
                if (this.expandedDepth >= 1) {
                    branch.setAttribute('open', '');
                } else {
                    branch.removeAttribute('open');
                }
            });

            // Update items/slots (depth 2)
            root.querySelectorAll('.hs-tree-item').forEach((item) => {
                if (this.expandedDepth >= 2) {
                    item.setAttribute('open', '');
                } else {
                    item.removeAttribute('open');
                }
            });
        });
    }
}

// Create global instance
window.componentTree = new ComponentTree();
