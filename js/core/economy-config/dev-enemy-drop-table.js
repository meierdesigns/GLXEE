"use strict";

// EconomyConfig methods: dev-mode loot chance table (enemy viewer).
extendClass(EconomyConfig, {
    buildEnemyDropDevRows(dropBonus) {
        const rows = [];
        const push = (role, info, typeId) => {
            const rates = this.previewKillDropRates(info, dropBonus);
            rows.push({
                role: role,
                type: typeId || '—',
                enemyClass: String((info && info.enemyClass) || '—').toUpperCase(),
                blueprint: rates.blueprint,
                part: rates.part,
                resScale: rates.resourceScale,
                info: info
            });
        };

        const classOrder = ['scout', 'assault', 'heavy', 'elite', 'capital'];
        classOrder.forEach((cls) => {
            push('Side · ' + cls.toUpperCase(), { champion: false, isBoss: false, enemyClass: cls }, '—');
        });
        push('Champion', { champion: true, isBoss: false, enemyClass: 'elite' }, '—');
        push('Boss', { champion: true, isBoss: true, enemyClass: 'capital' }, '—');

        if (typeof enemyConfigManager !== 'undefined' && enemyConfigManager.getTypeIds) {
            const ids = enemyConfigManager.getTypeIds().slice().sort();
            ids.forEach((typeId) => {
                let cls = 'assault';
                if (typeof planetConfigManager !== 'undefined' && planetConfigManager.taxonomyForType) {
                    const tax = planetConfigManager.taxonomyForType(typeId);
                    if (tax && tax.enemyClass) cls = tax.enemyClass;
                }
                push('Type · side', { type: typeId, champion: false, isBoss: false, enemyClass: cls }, typeId);
                const bossish = typeId === 'enemyBoss' || typeId === 'battleship';
                if (bossish) {
                    push('Type · boss', {
                        type: typeId,
                        champion: true,
                        isBoss: true,
                        enemyClass: cls === 'scout' ? 'capital' : cls
                    }, typeId);
                }
            });
        }
        return rows;
    },

    buildEnemyDropDevTableHtml(dropBonus, highlightType) {
        const rows = this.buildEnemyDropDevRows(dropBonus);
        const hi = String(highlightType || '').toLowerCase();
        const body = rows.map((r) => {
            const match = hi && r.type !== '—' && String(r.type).toLowerCase() === hi;
            const sel = match ? ' class="is-selected"' : '';
            return '<tr' + sel + '>' +
                '<td>' + r.role + '</td>' +
                '<td>' + r.type + '</td>' +
                '<td>' + r.enemyClass + '</td>' +
                '<td>' + this.formatDropPct(r.blueprint) + '</td>' +
                '<td>' + this.formatDropPct(r.part) + '</td>' +
                '<td>×' + (Math.round(r.resScale * 100) / 100) + '</td>' +
                '</tr>';
        }).join('');
        const bonusNote = dropBonus > 0
            ? '<p class="cv-drop-dev-note">+ Station drop bonus: ' + this.formatDropPct(dropBonus) + ' BP / half on parts</p>'
            : '';
        return '<div class="cv-drop-dev">' +
            '<h4 class="cv-drop-dev-title">LOOT DROP CHANCES (DEV)</h4>' +
            bonusNote +
            '<div class="cv-drop-dev-scroll"><table class="hs-ship-table cv-drop-dev-table">' +
            '<thead><tr>' +
            '<th>Role</th><th>Type</th><th>Class</th><th>Blueprint</th><th>Part</th><th>Resources</th>' +
            '</tr></thead><tbody>' + body + '</tbody></table></div>';
    },
});
