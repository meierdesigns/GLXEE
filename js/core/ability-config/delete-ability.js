"use strict";

// AbilityConfigManager methods, split from ability-config.js.
extendClass(AbilityConfigManager, {
    deleteAbility(id) {
        const key = String(id);
        const a = this.configs[key];
        if (!a || !a.custom) return false;
        delete this.configs[key];
        this.save();
        return true;
    },

    resetAbility(id) {
        const defaults = this.createDefaults();
        const key = String(id);
        if (defaults[key]) {
            this.configs[key] = defaults[key];
            this.save();
            return this.configs[key];
        }
        return this.getAbility(key);
    },

    resetAll() {
        this.configs = this.createDefaults();
        this.save();
    },

    save() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.configs));
        } catch (e) {
            console.warn('AbilityConfigManager: save failed', e);
        }
    },

    load() {
        try {
            const raw = localStorage.getItem(this.storageKey);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            const defaults = this.createDefaults();
            Object.keys(defaults).forEach((id) => {
                if (parsed[id]) {
                    this.configs[id] = this.makeAbility(Object.assign({}, defaults[id], parsed[id], { id: id }));
                }
            });
            Object.keys(parsed).forEach((id) => {
                if (!this.configs[id]) {
                    this.configs[id] = this.makeAbility(Object.assign({}, parsed[id], { id: id, custom: true }));
                }
            });
        } catch (e) {
            console.warn('AbilityConfigManager: load failed', e);
        }
    },
});
