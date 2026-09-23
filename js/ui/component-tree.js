// Component Tree View for Hangar UI
class ComponentTree {
    constructor() {
        this.expandedDepth = 1;
        this.expandedNodes = new Set();
    }

    /**
     * Render a complete component tree with slots
     * @param {Object} hangarSlots - Slot configuration from shipLoadoutManager
     * @param {Object} loadout - Current ship loadout
     * @param {Object} inventory - Available components
     * @returns {string} HTML for the tree
     */
    render(hangarSlots, loadout, inventory) {
        if (!hangarSlots || !hangarSlots.slots) return '<div class="hs-tree-empty">No components</div>';

        const tree = {};
        
        // Group slots by kind (weapons, defenses, abilities, energy)
        const kinds = ['weapons', 'defenses', 'abilities', 'energy'];
        
        for (const kind of kinds) {
            const slots = (hangarSlots.slots || []).filter((s) => s && s.kind === kind);
            if (slots.length > 0) {
                tree[kind] = slots;
            }
        }

        return `<div class="hs-tree-root">${
            kinds
                .filter((kind) => tree[kind])
                .map((kind) => this.renderBranch(kind, tree[kind], loadout, inventory))
                .join('')
        }</div>`;
    }

    /**
     * Render a component kind branch (e.g., "WEAPONS", "DEFENSES")
     */
    renderBranch(kind, slots, loadout, inventory) {
        const label = this.labelForKind(kind);
        const isExpanded = this.expandedDepth >= 1;
        const nodeId = `hs-tree-${kind}`;

        return `
            <details class="hs-tree-branch" ${isExpanded ? 'open' : ''} id="${nodeId}">
                <summary class="hs-tree-branch-label">
                    <span class="hs-tree-toggle">▶</span>
                    <span class="hs-tree-icon">${this.iconForKind(kind)}</span>
                    <span class="hs-tree-text">${label} ${slots.length}</span>
                </summary>
                <div class="hs-tree-items">
                    ${slots.map((slot, idx) => this.renderSlot(kind, slot, loadout, inventory, idx)).join('')}
                </div>
            </details>
        `;
    }

    /**
     * Render a single slot with dropdown for equipping
     */
    renderSlot(kind, slot, loadout, inventory, slotIndex) {
        const slotId = `hs-tree-slot-${kind}-${slotIndex}`;
        const equipped = this.getEquippedModule(loadout, kind, slotIndex);
        const isExpanded = this.expandedDepth >= 2;

        const availableComponents = (inventory && inventory[kind]) || [];
        const options = availableComponents.map((comp) => {
            const selected = equipped && equipped.id === comp.id ? ' selected' : '';
            return `<option value="${comp.id}"${selected}>${comp.name || comp.id}</option>`;
        }).join('');

        return `
            <details class="hs-tree-item" ${isExpanded ? 'open' : ''} id="${slotId}">
                <summary class="hs-tree-item-label">
                    <span class="hs-tree-toggle">▶</span>
                    <span class="hs-tree-slot-name">SLOT ${slotIndex + 1}</span>
                    ${equipped ? `<span class="hs-tree-equipped">${equipped.name || equipped.id}</span>` : '<span class="hs-tree-empty-slot">—</span>'}
                </summary>
                <div class="hs-tree-slot-content">
                    <select class="hs-tree-slot-select" data-slot-kind="${kind}" data-slot-index="${slotIndex}">
                        <option value="">UNEQUIP</option>
                        ${options}
                    </select>
                </div>
            </details>
        `;
    }

    /**
     * Get the currently equipped module for a slot
     */
    getEquippedModule(loadout, kind, slotIndex) {
        if (!loadout || !loadout[kind]) return null;
        const equipped = loadout[kind][slotIndex];
        return equipped || null;
    }

    /**
     * Get label for component kind
     */
    labelForKind(kind) {
        return {
            'weapons': 'WEAPONS',
            'defenses': 'DEFENSES',
            'abilities': 'ABILITIES',
            'energy': 'ENERGY'
        }[kind] || kind.toUpperCase();
    }

    /**
     * Get icon for component kind
     */
    iconForKind(kind) {
        const icons = {
            'weapons': '⚔',
            'defenses': '🛡',
            'abilities': '✦',
            'energy': '⚡'
        };
        return icons[kind] || '◆';
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
        const root = document.querySelector('#hsComponentTree');
        if (!root) return;

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
    }
}

// Create global instance
window.componentTree = new ComponentTree();
