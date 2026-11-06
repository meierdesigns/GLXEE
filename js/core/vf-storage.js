"use strict";

/**
 * Thin localStorage facade — one try/catch path, JSON helpers, schema marks.
 * Does not migrate every legacy key; callers keep their own keys but share I/O.
 */
var VFStorage = {
    get: function (key, fallback) {
        try {
            var v = localStorage.getItem(key);
            return v == null ? fallback : v;
        } catch (e) {
            return fallback;
        }
    },
    set: function (key, value) {
        try {
            localStorage.setItem(key, String(value));
            return true;
        } catch (e) {
            return false;
        }
    },
    remove: function (key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (e) {
            return false;
        }
    },
    getJSON: function (key, fallback) {
        var raw = this.get(key, null);
        if (raw == null) return fallback;
        try {
            return JSON.parse(raw);
        } catch (e) {
            return fallback;
        }
    },
    setJSON: function (key, value) {
        try {
            return this.set(key, JSON.stringify(value));
        } catch (e) {
            return false;
        }
    },
    /** Soft schema stamp for a feature namespace (e.g. volume → '3'). */
    schema: function (name, next) {
        var key = 'vf_schema_' + name;
        if (next != null) this.set(key, String(next));
        return this.get(key, null);
    }
};
