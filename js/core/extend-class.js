"use strict";

/**
 * Adds methods (and accessors) from an object literal to a class prototype.
 * Large classes are split across several files: the class is declared in
 * <name>/core.js and each other file in <name>/ calls extendClass with more
 * methods. Members are non-enumerable, matching methods declared in a class body.
 */
function extendClass(Cls, members) {
    for (const key of Reflect.ownKeys(members)) {
        const desc = Object.getOwnPropertyDescriptor(members, key);
        desc.enumerable = false;
        Object.defineProperty(Cls.prototype, key, desc);
    }
}

window.extendClass = extendClass;

// Root CSS custom property, read once per frame: getComputedStyle in render paths forces style recalc on every call.
const vfCssVar = (() => {
    const cache = new Map();
    let clearing = false;
    return (name) => {
        let v = cache.get(name);
        if (v !== undefined) return v;
        v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
        cache.set(name, v);
        if (!clearing) {
            clearing = true;
            requestAnimationFrame(() => { cache.clear(); clearing = false; });
        }
        return v;
    };
})();
