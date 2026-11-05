"use strict";

/**
 * Shared by the weapon/ability/defense/energy library viewers: every equippable item's stats
 * are not fixed — they scale across the category's MODULES upgrade tracks (economyConfig
 * .moduleUpgradeDefs), so a flat number in the wiki would be wrong the moment the player
 * upgrades anything. This lists each track's own label/description — the real upgrade system,
 * not invented numbers — as "stat rows" so every item's page reads "this varies, upgradeable
 * via these tracks" instead of implying a fixed value.
 */
function contentViewerUpgradeRangeRowsHtml(category) {
    if (typeof economyConfig === 'undefined' || !economyConfig.moduleUpgradeDefs) return '';
    const tracks = economyConfig.moduleUpgradeDefs[category];
    if (!tracks) return '';
    return Object.keys(tracks).map((track) => {
        const meta = tracks[track];
        return `<div class="stat-row"><span class="stat-label">Range: ${meta.label}</span>` +
            `<span class="stat-value">${meta.desc} · L0–L${meta.maxLevel}</span></div>`;
    }).join('');
}
