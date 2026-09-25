"use strict";

// EconomyConfig methods, split from economy-config.js.
extendClass(EconomyConfig, {
    pickWeightedResourceId(table) {
        const pool = Array.isArray(table) ? table.filter((e) => {
            const id = String((e && e.id) || '').toLowerCase();
            return id && this.resourceIds.indexOf(id) !== -1;
        }) : [];
        if (!pool.length) return 'scrap';
        let total = 0;
        pool.forEach((e) => { total += Math.max(1, Number(e.weight) || 1); });
        let r = Math.random() * total;
        for (let i = 0; i < pool.length; i++) {
            r -= Math.max(1, Number(pool[i].weight) || 1);
            if (r <= 0) return String(pool[i].id).toLowerCase();
        }
        return String(pool[pool.length - 1].id).toLowerCase();
    },

    /**
     * Roll world pickups for a killed enemy.
     * Returns [{ id, amount }, ...] (often 1–3 entries).
     */
    rollEnemyKillDrops(info, planetId, yieldMul) {
        const table = this.getPlanetResourceTable(planetId);
        const scale = this.getEnemyDropScale(info);
        const mul = Math.max(0.5, Number(yieldMul) || 1);
        const rollCount = info && info.champion
            ? 2 + Math.floor(Math.random() * 2)
            : (scale >= 1.4 ? 1 + Math.floor(Math.random() * 2) : 1);
        const drops = [];
        for (let i = 0; i < rollCount; i++) {
            const id = this.pickWeightedResourceId(table);
            const entry = table.find((e) => String((e && e.id) || '').toLowerCase() === id) || null;
            const baseMin = entry ? Math.max(1, Math.round((Number(entry.min) || 1) * 0.12)) : 1;
            const baseMax = entry ? Math.max(baseMin, Math.round((Number(entry.max) || 2) * 0.18)) : 2;
            let amount = this.rollAmount(baseMin, baseMax);
            amount = Math.max(1, Math.round(amount * scale * mul));
            drops.push({ id, amount });
        }
        return drops;
    },

    formatCost(costMap) {
        const parts = [];
        Object.keys(costMap || {}).forEach((id) => {
            const n = costMap[id];
            if (n > 0) parts.push(`${n} ${this.getResourceLabel(id)}`);
        });
        return parts.join(' + ') || 'FREE';
    },

    canAfford(wallet, costMap) {
        const w = wallet || {};
        const c = costMap || {};
        return Object.keys(c).every((id) => (w[id] || 0) >= c[id]);
    },
});
