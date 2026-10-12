"use strict";

function extendClass(Cls, members) {
    for (const key of Reflect.ownKeys(members)) {
        const desc = Object.getOwnPropertyDescriptor(members, key);
        desc.enumerable = false;
        Object.defineProperty(Cls.prototype, key, desc);
    }
}

export { extendClass };
