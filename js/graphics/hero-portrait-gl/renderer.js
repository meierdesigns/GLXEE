"use strict";

// Pilot portrait renderer: WebGL2 raymarched 3D head → pixel pass → 2D canvases (96x108, shown pixelated).
// One shared GL context draws every registered <canvas class="hp-gl">; each canvas animates on its own clock.
// heroPortraitGL.supported() is false without WebGL2; heroPortrait.html() then falls back to the SVG generator.
const heroPortraitGL = (() => {
    const OW = 80, OH = 90, SS = 3;
    const FACS = { terran: 0, kronax: 1, voidborn: 2, pirate: 3, machine: 4 };
    const UNIFORMS = ['uRes', 'uMesh', 'uD', 'uE', 'uTime', 'uYaw', 'uPitch', 'uBlink', 'uBreath', 'uGaze', 'uA', 'uB', 'uC', 'uSkin', 'uHair', 'uEye', 'uPaint', 'uAcc', 'uCloth', 'uTrim'];
    let state = null;          // null = untried, false = unsupported, object = ready
    const entries = new Set();
    let timer = 0, lastFrame = 0;

    const hex = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
    const lin = (c) => c.map((v) => Math.pow(Math.max(0, Math.min(1, v)), 2.2));
    const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

    function compile(gl, type, src, name) {
        const sh = gl.createShader(type);
        gl.shaderSource(sh, src); gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(name + ': ' + gl.getShaderInfoLog(sh));
        return sh;
    }
    function program(gl, vs, fs, name) {
        const pr = gl.createProgram();
        gl.attachShader(pr, compile(gl, gl.VERTEX_SHADER, vs, name + ' vs'));
        gl.attachShader(pr, compile(gl, gl.FRAGMENT_SHADER, fs, name + ' fs'));
        gl.linkProgram(pr);
        if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(name + ' link: ' + gl.getProgramInfoLog(pr));
        return pr;
    }
    function init() {
        if (state !== null) return state;
        state = false;
        try {
            const canvas = document.createElement('canvas');
            canvas.width = OW; canvas.height = OH;
            const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false, alpha: false });
            if (!gl || !window.HP_GLSL || !HP_GLSL.shade) return state;
            const pa = program(gl, HP_GLSL.vert, HP_GLSL.lib + HP_GLSL.scene + HP_GLSL.shade, 'scene');
            const pb = program(gl, HP_GLSL.vert, HP_GLSL.post, 'post');
            const tex = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, OW * SS, OH * SS, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            const fbo = gl.createFramebuffer();
            gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            const loc = {};
            UNIFORMS.forEach((u) => { loc[u] = gl.getUniformLocation(pa, u); });
            // G-buffer for the scanned head: albedo, world normal, depth (same size as the scene pass)
            const mk = (fmt, ifmt, type) => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, OW * SS, OH * SS, 0, fmt, type, null); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); return t; };
            const gAlb = mk(gl.RGBA, gl.RGBA8, gl.UNSIGNED_BYTE), gNrm = mk(gl.RGBA, gl.RGBA8, gl.UNSIGNED_BYTE), gDepth = mk(gl.DEPTH_COMPONENT, gl.DEPTH_COMPONENT24, gl.UNSIGNED_INT);
            const gFbo = gl.createFramebuffer();
            gl.bindFramebuffer(gl.FRAMEBUFFER, gFbo);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, gAlb, 0);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, gNrm, 0);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, gDepth, 0);
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.useProgram(pa);
            gl.uniform1i(gl.getUniformLocation(pa, 'uGAlb'), 2); gl.uniform1i(gl.getUniformLocation(pa, 'uGNrm'), 3); gl.uniform1i(gl.getUniformLocation(pa, 'uGDepth'), 4);
            canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); state = false; });
            state = { canvas, gl, pa, pb, tex, fbo, loc, gAlb, gNrm, gDepth, gFbo, mesh: null, locB: { uTex: gl.getUniformLocation(pb, 'uTex'), uOut: gl.getUniformLocation(pb, 'uOut'), uBlock: gl.getUniformLocation(pb, 'uBlock') } };
        } catch (err) {
            if (window.console) console.warn('[heroPortraitGL] disabled:', err.message);
            state = false;
        }
        if (state) loadMesh(state);
        return state;
    }
    // The head scan loads asynchronously; until then (or if it fails) portraits use the all-SDF head.
    function loadMesh(g) {
        if (typeof heroPortraitMesh === 'undefined' || !HP_GLSL.meshVert) return;
        heroPortraitMesh.load().then(({ mesh, col, nrm }) => {
            const gl = g.gl, pm = program(gl, HP_GLSL.meshVert, HP_GLSL.meshFrag, 'mesh');
            const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
            const attr = (data, name, size) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); const l = gl.getAttribLocation(pm, name); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, size, gl.FLOAT, false, 0, 0); };
            attr(mesh.pos, 'aPos', 3); attr(mesh.nrm, 'aNrm', 3); attr(mesh.uv, 'aUv', 2);
            const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.idx, gl.STATIC_DRAW);
            gl.bindVertexArray(null);
            const tex = (img) => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img); gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); return t; };
            const loc = {};
            ['uRes', 'uYaw', 'uPitch', 'uBlink', 'uA', 'uB', 'uC', 'uD', 'uE', 'uSkin', 'uHair', 'uCloth', 'uTrim', 'uPass', 'uCol', 'uNrmMap'].forEach((u) => { loc[u] = gl.getUniformLocation(pm, u); });
            g.mesh = { pm, vao, count: mesh.idx.length, texCol: tex(col), texNrm: tex(nrm), loc };
            entries.forEach((e) => draw(e, e.lastT || 0.6));
        }).catch((err) => { if (window.console) console.warn('[heroPortraitGL] head scan unavailable, using the SDF head:', err.message); });
    }

    // Look → shader parameters (colours linear).
    function params(look, accent) {
        const D = heroPortrait.data;
        const lk = typeof look === 'string' ? heroPortrait.heroLook(look) : (look || heroPortrait.heroLook('terran'));
        const faction = D.SPECIES[lk.faction] ? lk.faction : 'terran', S = D.SPECIES[faction];
        const mod = (v, n) => (((v || 0) % n) + n) % n;
        const acc = hex(accent || '#c8a040');
        const human = faction === 'terran' || faction === 'pirate';
        const HUM = { headW: -0.1, headL: 0.0, jaw: 0.1, chin: 0.15, cheek: 0.5, noseS: -0.1 };    // human default: longer face, narrower, defined chin and cheekbones
        const sl = (v, k) => (v === undefined ? (human ? HUM[k] : 0) : (Math.max(0, Math.min(4, v)) - 2) / 2);      // slider 0..4 → -1..1 (unset = default)
        return {
            A: [(lk.gender != null ? lk.gender : (lk.sex === 1 ? 6 : 0)) / 6, FACS[faction], mod(lk.hair, 10), 0],
            B: [mod(lk.face, 5), mod(lk.mouth, 4), mod(lk.beard, 4), mod(lk.scar, 4)],
            C: [mod(lk.nose, 5), mod(lk.brow, 3), mod(lk.gear, 3), mod(lk.eye, 6)],
            D: [sl(lk.headW, 'headW'), sl(lk.headL, 'headL'), sl(lk.jaw, 'jaw'), sl(lk.chin, 'chin')], E: [sl(lk.cheek, 'cheek'), sl(lk.noseS, 'noseS'), 0, 0],
            skin: lin(hex(S.skins[mod(lk.skin, S.skins.length)])), hair: lin(hex(D.HAIRS[mod(lk.hairc, D.HAIRS.length)])),
            eye: lin(hex(faction === 'voidborn' ? D.GLOWS[mod(lk.hairCol, D.GLOWS.length)] : D.EYE_COLS[mod(lk.eye, D.EYE_COLS.length)])).map((v) => v * (human ? 0.4 : 1)), paint: lin(hex(D.PAINTS[mod(lk.hairCol, D.PAINTS.length)])),
            acc: lin(acc), cloth: lin(hex(S.cloth).map((v) => v * 1.4 + 0.15)), trim: lin(hex(S.trim))
        };
    }
    // Idle animation: slow head sway, breathing, periodic blink, gaze that wanders (mostly at the viewer).
    function pose(t, seed) {
        const cyc = Math.floor(t / 4.3), tb = cyc * 4.3 + 1.0 + 2.4 * hash(cyc + seed);
        const ph = (t - tb) / 0.2, blink = ph > 0 && ph < 1 ? 1 - Math.abs(2 * ph - 1) : 0;
        const gi = Math.floor(t / 2.6), gf = Math.min(1, (t / 2.6 - gi) * 4);
        const tgt = (i) => (hash(i + seed * 3) < 0.55 ? [0, 0] : [(hash(i * 1.7 + seed) - 0.5) * 1.8, (hash(i * 2.3 + seed) - 0.5) * 0.8]);
        const a = tgt(gi - 1), b = tgt(gi), k = gf * gf * (3 - 2 * gf);
        return { blink, gaze: [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k - 0.3], yaw: 0.16 + Math.sin(t * 0.37 + seed) * 0.05, pitch: -0.045 + Math.sin(t * 0.51 + seed * 2) * 0.012, breath: Math.sin(t * 1.3 + seed) };
    }
    function draw(entry, t) {
        const g = init();
        if (!g) return;
        const { gl, loc } = g, P = entry.params, po = pose(t, entry.seed);
        entry.lastT = t;
        const M = g.mesh;
        const useM = M && P.A[1] !== 2;                           // voidborn have no human scan
        if (useM) {                                               // pass M: rasterise the head scan into the G-buffer
            const ml = M.loc;
            gl.useProgram(M.pm);
            gl.bindFramebuffer(gl.FRAMEBUFFER, g.gFbo);
            gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
            gl.viewport(0, 0, OW * SS, OH * SS);
            gl.clearColor(0, 0, 0, 0); gl.clearDepth(1);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); gl.disable(gl.CULL_FACE);
            gl.uniform2f(ml.uRes, OW * SS, OH * SS); gl.uniform1f(ml.uYaw, po.yaw); gl.uniform1f(ml.uPitch, po.pitch); gl.uniform1f(ml.uBlink, po.blink);
            gl.uniform4fv(ml.uA, P.A); gl.uniform4fv(ml.uB, P.B); gl.uniform4fv(ml.uC, P.C); gl.uniform4fv(ml.uD, P.D); gl.uniform4fv(ml.uE, P.E); gl.uniform3fv(ml.uSkin, P.skin); gl.uniform3fv(ml.uHair, P.hair); gl.uniform3fv(ml.uCloth, P.cloth); gl.uniform3fv(ml.uTrim, P.trim); gl.uniform1f(ml.uPass, 0);
            gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, M.texCol); gl.uniform1i(ml.uCol, 0);
            gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, M.texNrm); gl.uniform1i(ml.uNrmMap, 1);
            gl.bindVertexArray(M.vao);
            gl.drawElements(gl.TRIANGLES, M.count, gl.UNSIGNED_SHORT, 0);
            const mk = P.B[1], ew = P.B[0];
            if (mk >= 1) { gl.uniform1f(ml.uPass, 1); gl.drawElements(gl.TRIANGLES, M.count, gl.UNSIGNED_SHORT, 0); }
            if (ew === 2) { gl.uniform1f(ml.uPass, 2); gl.drawElements(gl.TRIANGLES, M.count, gl.UNSIGNED_SHORT, 0); }
            gl.bindVertexArray(null);
            gl.disable(gl.DEPTH_TEST);
        }
        gl.useProgram(g.pa);
        gl.bindFramebuffer(gl.FRAMEBUFFER, g.fbo);
        gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
        gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, g.gAlb);
        gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, g.gNrm);
        gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, g.gDepth);
        gl.uniform1f(loc.uMesh, useM ? 1 : 0);
        gl.viewport(0, 0, OW * SS, OH * SS);
        gl.uniform2f(loc.uRes, OW * SS, OH * SS);
        gl.uniform1f(loc.uTime, t); gl.uniform1f(loc.uYaw, po.yaw); gl.uniform1f(loc.uPitch, po.pitch);
        gl.uniform1f(loc.uBlink, po.blink); gl.uniform1f(loc.uBreath, po.breath); gl.uniform2f(loc.uGaze, po.gaze[0], po.gaze[1]);
        gl.uniform4fv(loc.uA, P.A); gl.uniform4fv(loc.uB, P.B); gl.uniform4fv(loc.uC, P.C); gl.uniform4fv(loc.uD, P.D); gl.uniform4fv(loc.uE, P.E);
        ['skin', 'hair', 'eye', 'paint', 'acc', 'cloth', 'trim'].forEach((k) => gl.uniform3fv(loc['u' + k[0].toUpperCase() + k.slice(1)], P[k]));
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, OW, OH);
        gl.useProgram(g.pb);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, g.tex);
        gl.uniform1i(g.locB.uTex, 0); gl.uniform2f(g.locB.uOut, OW, OH); gl.uniform1f(g.locB.uBlock, P.A[1] === FACS.terran || P.A[1] === FACS.pirate ? 1 : 0);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        entry.ctx.drawImage(g.canvas, 0, 0);
    }

    const reduced = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    function visible(c) {
        const r = c.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
    }
    function loop(now) {
        timer = 0;
        for (const e of entries) {
            if (!e.canvas.isConnected) { entries.delete(e); continue; }
            if (!reduced() && now - e.last > 40 && visible(e.canvas)) { e.last = now; draw(e, (now - e.t0) / 1000); }
        }
        if (entries.size && !document.hidden) timer = requestAnimationFrame(loop);
    }
    function register(canvas) {
        if (canvas.__hp || !init()) return;
        let look = null;
        try { look = JSON.parse(canvas.dataset.look); } catch (err) { look = 'terran'; }
        const entry = { canvas, ctx: canvas.getContext('2d'), params: params(look, canvas.dataset.accent || null), seed: Math.random() * 40, t0: performance.now(), last: 0 };
        canvas.__hp = entry;
        entries.add(entry);
        draw(entry, 0.6);
        if (!timer) timer = requestAnimationFrame(loop);
    }
    function scan(root) {
        (root || document).querySelectorAll('canvas.hp-gl').forEach(register);
    }
    function observe() {
        const mo = new MutationObserver((muts) => {
            for (const m of muts) m.addedNodes.forEach((n) => { if (n.nodeType === 1) { if (n.matches && n.matches('canvas.hp-gl')) register(n); else if (n.querySelectorAll) scan(n); } });
        });
        mo.observe(document.documentElement, { childList: true, subtree: true });
        document.addEventListener('visibilitychange', () => { if (!document.hidden && entries.size && !timer) timer = requestAnimationFrame(loop); });
        const st = document.createElement('style');
        st.textContent = 'canvas.hero-portrait.hp-gl{display:block;width:100%;height:auto;image-rendering:pixelated;object-fit:cover;object-position:50% 0}';
        document.head.appendChild(st);
        scan(document);
    }
    const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/'/g, '&#39;').replace(/"/g, '&quot;');
    function canvasHtml(look, accent) {
        return `<canvas class="hero-portrait hp-gl" width="${OW}" height="${OH}" data-look='${esc(JSON.stringify(look))}'${accent ? ` data-accent="${esc(accent)}"` : ''} role="img" aria-label="Pilot portrait"></canvas>`;
    }
    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observe); else observe();
    }
    return { supported: () => !!init(), canvasHtml, register, scan, draw, params };
})();
