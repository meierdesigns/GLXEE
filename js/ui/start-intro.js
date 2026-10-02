"use strict";

// Boot intro in Game Boy boot style: 144px low-res screen, 4-shade palette, pixel starfield,
// logo scrolls down 1px per step, chime, then blinking PRESS START. Played on app start when
// the restored screen is not the home station. Any key / click skips.
const VFStartIntro = {
    duration: 5200,
    active: false,
    // DMG shades, darkest → lightest
    palette: ['#0f1a0f', '#306230', '#8bac0f', '#c4f0a0'],

    injectStyles() {
        if (document.getElementById('vf-start-intro-style')) return;
        const style = document.createElement('style');
        style.id = 'vf-start-intro-style';
        style.textContent = `
.vf-start-intro { position: fixed; inset: 0; z-index: 100000; background: #05060a; cursor: pointer;
    display: flex; align-items: center; justify-content: center; transition: opacity 400ms steps(4); }
.vf-start-intro.is-leaving { opacity: 0; pointer-events: none; }
.vf-start-intro canvas { width: 100%; height: 100%; image-rendering: pixelated; image-rendering: crisp-edges; }
.vf-start-intro::after { content: ''; position: absolute; inset: 0; pointer-events: none;
    background: repeating-linear-gradient(to bottom, rgba(0,0,0,0.22) 0 1px, transparent 1px 3px);
    box-shadow: inset 0 0 120px rgba(0,0,0,0.75); }`;
        document.head.appendChild(style);
    },

    // Render text as hard 1-bit pixels (no antialiasing) into a sprite canvas
    makeTextSprite(text, px, color) {
        const c = document.createElement('canvas');
        const x = c.getContext('2d');
        const font = `700 ${px}px 'Silkscreen', 'Courier New', monospace`;
        x.font = font;
        c.width = Math.ceil(x.measureText(text).width) + 2;
        c.height = Math.ceil(px * 1.2);
        x.font = font;
        x.textBaseline = 'top';
        x.fillStyle = '#fff';
        x.fillText(text, 1, 0);
        const img = x.getImageData(0, 0, c.width, c.height);
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);
        for (let i = 0; i < img.data.length; i += 4) {
            const on = img.data[i + 3] > 110;
            img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b;
            img.data[i + 3] = on ? 255 : 0;
        }
        x.putImageData(img, 0, 0);
        return c;
    },

    chime() {
        try {
            // Creating AudioContext before any user gesture logs a console
            // warning and stays suspended — skip until the page is unlocked.
            if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
            if (typeof soundManager !== 'undefined' && soundManager.ensureContext) {
                const ctx = soundManager.ensureContext();
                if (!ctx) return;
                [[1046.5, 0, 0.09], [2093, 0.09, 0.5]].forEach(([f, at, len]) => {
                    const o = ctx.createOscillator();
                    const g = ctx.createGain();
                    o.type = 'square';
                    o.frequency.value = f;
                    g.gain.setValueAtTime(0.06, ctx.currentTime + at);
                    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + len);
                    o.connect(g).connect(ctx.destination);
                    o.start(ctx.currentTime + at);
                    o.stop(ctx.currentTime + at + len + 0.05);
                });
                return;
            }
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return;
            const ac = new AC();
            if (ac.state === 'suspended') ac.resume();
            // Classic two-note square "ding-DING"
            [[1046.5, 0, 0.09], [2093, 0.09, 0.5]].forEach(([f, at, len]) => {
                const o = ac.createOscillator();
                const g = ac.createGain();
                o.type = 'square';
                o.frequency.value = f;
                g.gain.setValueAtTime(0.06, ac.currentTime + at);
                g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + at + len);
                o.connect(g).connect(ac.destination);
                o.start(ac.currentTime + at);
                o.stop(ac.currentTime + at + len + 0.05);
            });
            setTimeout(() => ac.close(), 1200);
        } catch (e) { /* audio blocked before user gesture — fine */ }
    },

    play(options) {
        const opts = options || {};
        if (this.active) return Promise.resolve();
        this.active = true;
        this.injectStyles();

        const P = this.palette;
        const root = document.createElement('div');
        root.className = 'vf-start-intro';
        root.innerHTML = '<canvas></canvas>';
        document.body.appendChild(root);
        const canvas = root.querySelector('canvas');
        const ctx = canvas.getContext('2d');

        const H = 144;
        let W = 160;
        const resize = () => {
            W = Math.max(160, Math.round(H * window.innerWidth / Math.max(1, window.innerHeight)));
            canvas.width = W;
            canvas.height = H;
            ctx.imageSmoothingEnabled = false;
        };
        resize();
        window.addEventListener('resize', resize);

        let titleSprite = null;
        let subSprite = null;
        let startSprite = null;
        const buildSprites = () => {
            titleSprite = this.makeTextSprite(opts.title || 'GLXEE', 24, P[3]);
            subSprite = opts.subtitle ? this.makeTextSprite(opts.subtitle.toUpperCase(), 8, P[2]) : null;
            startSprite = this.makeTextSprite('PRESS START', 8, P[3]);
        };
        buildSprites();
        if (document.fonts && document.fonts.load) {
            document.fonts.load("700 24px 'Silkscreen'").then(buildSprites).catch(() => {});
        }

        const stars = [];
        for (let i = 0; i < 70; i++) {
            stars.push({ x: Math.random() * 400, y: Math.random() * H, s: 1 + Math.floor(Math.random() * 3) });
        }

        const STEP = 1000 / 30; // 30 fps, stepped like old hardware
        const logoY = Math.round(H / 2 - 22);
        const scrollStart = 400;
        const scrollEnd = 2000;
        let chimed = false;
        const start = performance.now();
        let last = 0;
        let raf = 0;

        const frame = (now) => {
            raf = requestAnimationFrame(frame);
            const t = now - start;
            if (t - last < STEP) return;
            last = t;

            ctx.fillStyle = P[0];
            ctx.fillRect(0, 0, W, H);

            // Stepped parallax starfield scrolling left; speeds by layer
            for (const s of stars) {
                s.x -= s.s * (t < scrollEnd ? 0.5 : 1);
                if (s.x < 0) { s.x += W; s.y = Math.floor(Math.random() * H); }
                ctx.fillStyle = P[s.s];
                ctx.fillRect(Math.floor(s.x % W), s.y, s.s === 3 ? 2 : 1, 1);
            }

            // Logo scrolls down 1px steps from above the screen
            const p = Math.min(1, Math.max(0, (t - scrollStart) / (scrollEnd - scrollStart)));
            const ty = Math.floor(-30 + (logoY + 30) * p);
            if (titleSprite) {
                const tx = Math.floor((W - titleSprite.width) / 2);
                // Flash inverted for a few frames when it lands
                if (t > scrollEnd && t < scrollEnd + 200 && Math.floor(t / 66) % 2 === 0) {
                    ctx.fillStyle = P[3];
                    ctx.fillRect(0, ty - 2, W, titleSprite.height + 2);
                } else {
                    ctx.drawImage(titleSprite, tx, ty);
                }
            }
            if (t >= scrollEnd && !chimed) { chimed = true; this.chime(); }

            if (t > scrollEnd + 500 && subSprite) {
                ctx.drawImage(subSprite, Math.floor((W - subSprite.width) / 2), logoY + 30);
            }
            // Blinking PRESS START, hard on/off
            if (t > scrollEnd + 1000 && startSprite && Math.floor(t / 500) % 2 === 0) {
                ctx.drawImage(startSprite, Math.floor((W - startSprite.width) / 2), H - 24);
            }
            // Horizontal border bars
            ctx.fillStyle = P[1];
            ctx.fillRect(0, 6, W, 1);
            ctx.fillRect(0, H - 7, W, 1);
        };
        raf = requestAnimationFrame(frame);

        return new Promise((resolve) => {
            let finished = false;
            const finish = () => {
                if (finished) return;
                finished = true;
                clearTimeout(timer);
                window.removeEventListener('keydown', onKey, true);
                root.removeEventListener('pointerdown', onKey);
                root.classList.add('is-leaving');
                resolve();
                setTimeout(() => {
                    cancelAnimationFrame(raf);
                    window.removeEventListener('resize', resize);
                    if (root.parentNode) root.parentNode.removeChild(root);
                    this.active = false;
                }, 450);
            };
            const onKey = (e) => {
                // Swallow the skip input so it does not also trigger a menu action
                e.preventDefault();
                e.stopPropagation();
                finish();
            };
            window.addEventListener('keydown', onKey, true);
            root.addEventListener('pointerdown', onKey);
            const timer = setTimeout(finish, opts.duration || this.duration);
        });
    }
};

window.VFStartIntro = VFStartIntro;
