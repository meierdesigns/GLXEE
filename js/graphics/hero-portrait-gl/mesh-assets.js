"use strict";

// Pilot portrait renderer, part 5: loads the head scan (glTF binary + colour and normal maps).
// "3D Head Scan" by Lee Perry-Smith (Infinite Realities), CC BY 3.0 — see assets/heads/LICENSE.txt.
const heroPortraitMesh = (() => {
    const BASE = 'assets/heads/';
    let promise = null;

    function parseGlb(buf) {
        const dv = new DataView(buf);
        if (dv.getUint32(0, true) !== 0x46546c67) throw new Error('not a glb');
        const jl = dv.getUint32(12, true);
        const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, jl)));
        const base = 20 + jl + 8;
        const read = (i, T) => {
            const a = json.accessors[i], v = json.bufferViews[a.bufferView];
            const n = { SCALAR: 1, VEC2: 2, VEC3: 3 }[a.type], off = base + (v.byteOffset || 0) + (a.byteOffset || 0);
            return new T(buf.slice(off, off + a.count * n * T.BYTES_PER_ELEMENT));
        };
        const at = json.meshes[0].primitives[0].attributes;
        return { pos: read(at.POSITION, Float32Array), nrm: read(at.NORMAL, Float32Array), uv: read(at.TEXCOORD_0, Float32Array), idx: read(json.meshes[0].primitives[0].indices, Uint16Array) };
    }
    function image(src) {
        return new Promise((resolve, reject) => { const im = new Image(); im.onload = () => resolve(im); im.onerror = () => reject(new Error('image ' + src)); im.src = src; });
    }
    function load() {
        if (!promise) {
            promise = Promise.all([
                fetch(BASE + 'head-scan.glb').then((r) => { if (!r.ok) throw new Error('glb ' + r.status); return r.arrayBuffer(); }).then(parseGlb),
                image(BASE + 'head-scan-color.jpg'), image(BASE + 'head-scan-normal.jpg')
            ]).then(([mesh, col, nrm]) => ({ mesh, col, nrm }));
        }
        return promise;
    }
    return { load };
})();
