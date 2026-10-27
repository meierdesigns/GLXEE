"use strict";

// Full-screen launch cutscene after new-pilot creation. Style follows the
// chosen story path (hunt / escort / raid / salvage / …) so each story feels
// different before the home-station handoff. SKIP-able after a short arm delay.
class LaunchCutsceneManager {
    constructor() {
        this.active = false;
        this.phase = null;
        this._onDone = null;
        this._raf = 0;
        this._startT = 0;
        this._phaseStartT = 0;
        this.overlay = null;
        this.canvas = null;
        this.ctx = null;
        this._planet = null;
        this._shipImg = null;
        this._shipImgKey = null;
        this._faction = 'pirate';
        this._story = null;
        this._style = 'lift';
        this._bits = null;
        this._keyHandler = null;
        // Title holds long enough to read; card stays up through most of act.
        this.durations = { title: 1600, act: 1400, exit: 700 };
    }

    isActive() { return !!this.active; }

    /** Resolve a cutscene style id from story metadata. */
    resolveStyle(story, faction) {
        const cut = String((story && (story.cut || story.style)) || '').toLowerCase();
        if (cut) return cut;
        const t = String((story && story.missions && story.missions[0] && story.missions[0].type) || 'patrol').toLowerCase();
        const fac = String(faction || '').toLowerCase();
        if (fac === 'voidborn' && (t === 'patrol' || t === 'clear')) return 'rift';
        if (fac === 'machine' && (t === 'patrol' || t === 'clear')) return 'compile';
        return t;
    }

    play({ faction, shipId, profile, story, onDone }) {
        if (this.active) this._cleanup();
        this.active = true;
        this._onDone = (typeof onDone === 'function') ? onDone : null;
        this._faction = String(faction || (profile && profile.faction) || 'pirate').toLowerCase();
        this._story = story || (profile && profile.storyPath) || null;
        this._style = this.resolveStyle(this._story, this._faction);
        this._bits = this._seedBits();
        this._skipArmedAt = (typeof performance !== 'undefined' ? performance.now() : Date.now()) + 500;
        this._buildOverlay();
        this._loadShipImage(shipId, this._faction);
        if (typeof HeroPlanetBackdrop !== 'undefined') {
            this._planet = new HeroPlanetBackdrop();
            this._planet.setFaction(this._faction);
            this._planet.mount(this.overlay);
            this._planet.el.classList.add('launch-cutscene-planet');
        }
        this._startT = 0;
        this._phaseStartT = 0;
        this.setPhase('title');
        const loop = (t) => {
            if (!this.active) return;
            if (!this._startT) { this._startT = t; this._phaseStartT = t; }
            this._tick(t);
            this._raf = requestAnimationFrame(loop);
        };
        this._raf = requestAnimationFrame(loop);
    }

    setPhase(phase) {
        this.phase = phase;
        this._phaseStartT = 0;
    }

    skip() {
        const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
        if (this._skipArmedAt && now < this._skipArmedAt) return;
        this._finish();
    }

    _seedBits() {
        const bits = [];
        let s = 2166136261;
        const raw = String((this._story && this._story.id) || this._style) + '|' + this._faction;
        for (let i = 0; i < raw.length; i++) { s ^= raw.charCodeAt(i); s = Math.imul(s, 16777619); }
        const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
        for (let i = 0; i < 48; i++) bits.push({ x: rnd(), y: rnd(), v: 0.3 + rnd() * 1.2, s: 1 + (rnd() * 3) | 0 });
        return bits;
    }

    _buildOverlay() {
        const overlay = document.createElement('div');
        overlay.className = 'launch-cutscene';
        overlay.setAttribute('data-cut', this._style);
        const canvas = document.createElement('canvas');
        canvas.className = 'launch-cutscene-canvas';
        overlay.appendChild(canvas);
        const card = document.createElement('div');
        card.className = 'launch-cutscene-card';
        const esc = (s) => String(s || '').replace(/[&<>"']/g, (ch) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[ch]));
        const title = (this._story && this._story.title) || 'LAUNCH';
        const blurb = (this._story && this._story.blurb) || '';
        this._titleText = String(title);
        this._blurbText = String(blurb);
        card.innerHTML = `<div class="launch-cutscene-kicker">STORY</div>` +
            `<div class="launch-cutscene-title">${esc(title)}</div>` +
            (blurb ? `<div class="launch-cutscene-blurb">${esc(blurb)}</div>` : '');
        overlay.appendChild(card);
        this._card = card;
        const skipBtn = document.createElement('button');
        skipBtn.type = 'button';
        skipBtn.className = 'launch-cutscene-skip';
        skipBtn.textContent = 'SKIP ▶';
        skipBtn.addEventListener('click', () => this.skip());
        overlay.appendChild(skipBtn);
        document.body.appendChild(overlay);
        this.overlay = overlay;
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.ctx.imageSmoothingEnabled = false;
        this._syncSize();
        this._resizeHandler = () => this._syncSize();
        window.addEventListener('resize', this._resizeHandler);
        this._keyHandler = (e) => {
            if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                this.skip();
            }
        };
        setTimeout(() => {
            if (!this.active || this._keyHandlerBound) return;
            document.addEventListener('keydown', this._keyHandler, true);
            this._keyHandlerBound = true;
        }, 0);
    }

    _syncSize() {
        if (!this.canvas) return;
        const w = window.innerWidth;
        const h = window.innerHeight;
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = Math.round(w * dpr);
        this.canvas.height = Math.round(h * dpr);
        this.canvas.style.width = w + 'px';
        this.canvas.style.height = h + 'px';
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.ctx.imageSmoothingEnabled = false;
        this.W = w;
        this.H = h;
    }

    _loadShipImage(shipId, faction) {
        if (typeof shipRenderer === 'undefined' || !shipRenderer.renderShipPreview || typeof shipConfigManager === 'undefined' || !shipConfigManager.getMergedModel) return;
        if (typeof spriteLoader !== 'undefined' && spriteLoader.isLoaded && !spriteLoader.isLoaded()) {
            window.addEventListener('vf-sprites-loaded', () => { this._shipImgKey = null; this._loadShipImage(shipId, faction); }, { once: true });
            return;
        }
        const id = shipId || 'player_scrap';
        const cacheKey = id + '|' + faction;
        if (this._shipImgKey === cacheKey) return;
        try {
            const model = shipConfigManager.getMergedModel(id);
            if (!model) { this._shipImgKey = null; return; }
            const cfg = shipConfigManager.getConfig && shipConfigManager.getConfig(id);
            if (faction && !(cfg && cfg.custom)) model.faction = faction;
            const inner = document.createElement('canvas');
            inner.width = 60; inner.height = 80;
            shipRenderer.renderShipPreview(inner, model, 1);
            const img = new Image();
            img.onload = () => { if (this._shipImgKey === cacheKey) this._shipImg = img; };
            img.src = inner.toDataURL();
            this._shipImgKey = cacheKey;
        } catch (err) { this._shipImgKey = null; }
    }

    _tick(t) {
        if (!this._phaseStartT) this._phaseStartT = t;
        const elapsed = t - this._phaseStartT;
        const dur = this.durations[this.phase] || 0;
        const p = Math.min(1, dur ? elapsed / dur : 1);
        if (this._card) {
            // Keep title readable for title + most of act; fade only late in exit.
            let op = 0;
            if (this.phase === 'title') op = Math.min(1, p * 3);
            else if (this.phase === 'act') op = p < 0.75 ? 1 : 1 - (p - 0.75) / 0.25;
            else op = Math.max(0, 1 - p * 2);
            this._card.style.opacity = String(op);
        }
        this._draw(p);
        if (elapsed >= dur) {
            if (this.phase === 'title') this.setPhase('act');
            else if (this.phase === 'act') this.setPhase('exit');
            else if (this.phase === 'exit') this._finish();
        }
    }

    _accent() {
        const pal = (typeof factionShipStyles !== 'undefined' && factionShipStyles.getFactionStyle)
            ? factionShipStyles.getFactionStyle(this._faction) : null;
        return (pal && (pal.accent || pal.hull)) || '#7ec8ff';
    }

    _drawShip(c, sx, sy, scale, alpha, rot) {
        if (!this._shipImg || !this._shipImgKey) return;
        const sh = 90 * scale;
        const sw = sh * (this._shipImg.width / this._shipImg.height || 0.73);
        c.save();
        c.globalAlpha = alpha;
        c.imageSmoothingEnabled = false;
        c.translate(sx, sy);
        if (rot) c.rotate(rot);
        c.drawImage(this._shipImg, -sw / 2, -sh / 2, sw, sh);
        c.restore();
    }

    _drawGlow(c, sx, sy, scale, accent, strength) {
        const r = 18 * scale * (0.8 + strength);
        const g = c.createRadialGradient(sx, sy + 18 * scale, 2, sx, sy + 18 * scale, r);
        g.addColorStop(0, accent + 'cc');
        g.addColorStop(1, accent + '00');
        c.globalAlpha = 0.45 + strength * 0.5;
        c.fillStyle = g;
        c.beginPath();
        c.arc(sx, sy + 18 * scale, r, 0, Math.PI * 2);
        c.fill();
        c.globalAlpha = 1;
    }

    _drawBits(c, accent, mode, p) {
        const bits = this._bits || [];
        c.fillStyle = accent;
        for (let i = 0; i < bits.length; i++) {
            const b = bits[i];
            let x = b.x * this.W, y = b.y * this.H;
            if (mode === 'ash') { y = ((b.y + p * b.v * 0.4) % 1) * this.H; x += Math.sin((p + b.x) * 8) * 6; }
            else if (mode === 'streak') { x = ((b.x + p * b.v) % 1) * this.W; }
            else if (mode === 'rift') { const a = (b.x + p) * Math.PI * 2; x = this.W * 0.5 + Math.cos(a) * (40 + b.y * 120); y = this.H * 0.5 + Math.sin(a) * (40 + b.y * 80); }
            else if (mode === 'grid') { x = Math.floor(b.x * 16) / 16 * this.W; y = Math.floor(b.y * 10) / 10 * this.H; }
            else { y = ((b.y + p * 0.15) % 1) * this.H; }
            c.globalAlpha = 0.25 + (i % 5) * 0.1;
            c.fillRect(x | 0, y | 0, b.s, b.s);
        }
        c.globalAlpha = 1;
    }

    _pose(p) {
        // Returns {sx,sy,scale,alpha,rot,glow,extras} for the active style × phase.
        const W = this.W, H = this.H, st = this._style, ph = this.phase;
        const cx = W * 0.5, cy = H * 0.56;
        let sx = cx, sy = cy, scale = 1, alpha = 1, rot = 0, glow = 0.4, extras = null;
        const ease = (t) => t * t;
        if (ph === 'title') {
            sy = cy + 8; scale = 0.95; glow = 0.25;
        } else if (st === 'hunt' || st === 'raid') {
            if (ph === 'act') {
                const e = ease(p);
                sx = W * (-0.1 + e * 1.2);
                sy = H * (0.62 - e * 0.18);
                rot = -0.45; scale = 1.05; glow = 0.9;
            } else {
                const e = ease(p);
                sx = W * (1.1 + e * 0.3); sy = H * 0.42 - e * H * 0.2;
                rot = -0.6; scale = Math.max(0.1, 1 - e); alpha = 1 - e; glow = 0.5;
            }
        } else if (st === 'escort') {
            if (ph === 'act') {
                sy = cy - p * H * 0.08; glow = 0.5 + p * 0.3;
                extras = 'escort';
            } else {
                const e = ease(p);
                sx = cx + e * W * 0.5; sy = cy - H * 0.08 - e * H * 0.45;
                scale = Math.max(0.08, 1.1 - e); alpha = 1 - Math.max(0, p - 0.65) / 0.35;
                extras = 'escort';
            }
        } else if (st === 'salvage') {
            if (ph === 'act') {
                sx = cx + (1 - p) * W * 0.2; sy = cy - p * 20; glow = 0.35;
                extras = 'beam';
            } else {
                const e = ease(p);
                sx = cx + e * W * 0.45; sy = cy - 20 - e * H * 0.4;
                scale = Math.max(0.1, 1 - e * 0.9); alpha = 1 - e; glow = 0.3;
            }
        } else if (st === 'defend') {
            if (ph === 'act') {
                sy = cy - 10; scale = 1 + Math.sin(p * Math.PI) * 0.08; glow = 0.6 + p * 0.3;
                extras = 'shield';
            } else {
                const e = ease(p);
                sx = cx + e * W * 0.4; sy = cy - 10 - e * H * 0.4;
                scale = Math.max(0.1, 1 - e); alpha = 1 - e;
            }
        } else if (st === 'rift') {
            extras = 'rift';
            if (ph === 'act') {
                const e = ease(p);
                sx = cx; sy = cy - e * 30; scale = 1 - e * 0.2; glow = 0.7;
            } else {
                const e = ease(p);
                sx = cx; sy = cy - 30; scale = Math.max(0.02, 0.8 - e); alpha = 1 - e; glow = 1;
            }
        } else if (st === 'compile') {
            extras = 'grid';
            if (ph === 'act') {
                alpha = Math.min(1, p * 2); scale = 0.6 + p * 0.4; sy = cy; glow = p;
            } else {
                const e = ease(p);
                sx = cx + e * W * 0.35; sy = cy - e * H * 0.4;
                scale = Math.max(0.1, 1 - e * 0.8); alpha = 1 - e;
            }
        } else if (st === 'patrol' || st === 'clear') {
            if (ph === 'act') {
                const e = p;
                sx = cx + Math.sin(e * Math.PI) * W * 0.22;
                sy = cy - e * H * 0.06; rot = Math.sin(e * Math.PI) * 0.25; glow = 0.55;
            } else {
                const e = ease(p);
                sx = cx + W * 0.22 + e * W * 0.4; sy = cy - H * 0.06 - e * H * 0.4;
                scale = Math.max(0.08, 1 - e); alpha = 1 - e;
            }
        } else {
            // lift (default) + trial
            if (ph === 'act') {
                sy = cy - p * H * 0.08; scale = 1 + p * 0.12; glow = 0.5 + p * 0.4;
            } else {
                const e = ease(p);
                sx = cx + e * W * 0.55; sy = cy - H * 0.08 - e * H * 0.5;
                scale = Math.max(0.05, 1.15 - e * 1.1);
                alpha = Math.max(0, 1 - Math.max(0, p - 0.7) / 0.3); glow = 0.4;
            }
        }
        return { sx, sy, scale, alpha, rot, glow, extras };
    }

    _draw(p) {
        const c = this.ctx;
        if (!c || !this.W) return;
        c.clearRect(0, 0, this.W, this.H);
        const accent = this._accent();
        const st = this._style;
        const bitMode = st === 'hunt' || st === 'raid' || st === 'trial' ? 'ash'
            : (st === 'rift' ? 'rift' : (st === 'compile' ? 'grid' : (st === 'escort' || st === 'patrol' ? 'streak' : 'ash')));
        if (this.phase !== 'title' || p > 0.2) this._drawBits(c, accent, bitMode, p + (this.phase === 'exit' ? 1 : 0));

        if (st === 'rift' || (this._pose && false)) { /* ring drawn with pose extras */ }
        const pose = this._pose(this.phase === 'title' ? 0 : p);

        if (pose.extras === 'rift' || st === 'rift') {
            const cx = this.W * 0.5, cy = this.H * 0.52;
            const rad = 70 + (this.phase === 'exit' ? p * 40 : p * 10);
            c.strokeStyle = accent;
            c.globalAlpha = 0.55;
            c.lineWidth = 3;
            c.beginPath(); c.ellipse(cx, cy, rad * 1.4, rad * 0.55, 0, 0, Math.PI * 2); c.stroke();
            c.globalAlpha = 0.25;
            c.beginPath(); c.ellipse(cx, cy, rad * 0.9, rad * 0.35, 0, 0, Math.PI * 2); c.stroke();
            c.globalAlpha = 1;
        }
        const wreckX = this.W * 0.5, wreckY = this.H * 0.72;
        if (pose.extras === 'beam' || st === 'salvage') {
            const sceneAlpha = this.phase === 'title' ? Math.min(1, p * 2) : 1;
            this._drawDebris(c, accent, wreckX, wreckY - 6, 110, p, sceneAlpha * 0.8);
            this._drawWreck(c, wreckX, wreckY, 1, sceneAlpha);
            if (this.phase === 'act') {
                c.strokeStyle = accent;
                c.globalAlpha = 0.4 + Math.sin(p * Math.PI * 8) * 0.25;
                c.lineWidth = 2;
                c.beginPath();
                c.moveTo(pose.sx, pose.sy + 30);
                c.lineTo(wreckX, wreckY - 4);
                c.stroke();
                c.globalAlpha = 1;
            }
        }
        if (pose.extras === 'shield' || st === 'defend') {
            const stCx = this.W * 0.5, stCy = this.H * 0.5;
            const sceneAlpha = this.phase === 'title' ? Math.min(1, p * 2) : 1;
            this._drawStation(c, stCx, stCy, 1, sceneAlpha);
            if (this.phase === 'act') {
                this._drawThreats(c, accent, stCx, stCy, p);
                c.strokeStyle = accent;
                c.globalAlpha = 0.35 + Math.sin(p * Math.PI * 4) * 0.2;
                c.lineWidth = 2;
                c.beginPath();
                c.arc(stCx, stCy, 60 + p * 6, 0, Math.PI * 2);
                c.stroke();
                c.globalAlpha = 1;
            }
        }
        if (pose.extras === 'escort' || st === 'escort') {
            this._drawConvoyShip(c, pose.sx - 80, pose.sy + 20, pose.scale * 0.7, pose.alpha * 0.85, pose.rot * 0.3);
            this._drawConvoyShip(c, pose.sx + 80, pose.sy + 26, pose.scale * 0.7, pose.alpha * 0.85, pose.rot * 0.3);
        }
        if (st === 'hunt' || st === 'raid') {
            const tx = this.phase === 'title' ? this.W * 0.72 : pose.sx + (this.W - pose.sx) * 0.45;
            const ty = this.phase === 'title' ? this.H * 0.42 : pose.sy - (pose.sy - this.H * 0.4) * 0.3;
            const sceneAlpha = this.phase === 'exit' ? Math.max(0, 1 - p * 1.4) : 1;
            this._drawTarget(c, tx, ty, p, accent, sceneAlpha);
        }
        if (st === 'patrol' || st === 'clear') {
            this._drawWaypoints(c, accent, this.phase === 'title' ? -1 : p);
        }

        this._drawGlow(c, pose.sx, pose.sy, pose.scale, accent, pose.glow);
        this._drawShip(c, pose.sx, pose.sy, pose.scale, pose.alpha, pose.rot);
    }

    /** Broken hull silhouette for salvage/hull-recovery stories: a jagged fuselage, a
        torn-off panel hanging askew, and a couple of lit seam cracks. */
    _drawWreck(c, cx, cy, scale, alpha) {
        c.save();
        c.globalAlpha = alpha;
        c.translate(cx, cy);
        c.scale(scale, scale);
        c.fillStyle = '#23232b';
        c.beginPath();
        c.moveTo(-54, -10); c.lineTo(-20, -22); c.lineTo(18, -16); c.lineTo(50, -4);
        c.lineTo(46, 12); c.lineTo(10, 18); c.lineTo(-30, 14); c.lineTo(-54, 6);
        c.closePath();
        c.fill();
        c.save();
        c.translate(38, -26);
        c.rotate(0.5);
        c.fillStyle = '#1b1b22';
        c.fillRect(-14, -6, 28, 12);
        c.restore();
        c.strokeStyle = '#ffcf6a';
        c.globalAlpha = alpha * 0.8;
        c.lineWidth = 1.5;
        c.beginPath();
        c.moveTo(-20, -18); c.lineTo(-8, -4); c.lineTo(6, -10);
        c.stroke();
        c.restore();
        c.globalAlpha = 1;
    }

    /** Scattered debris chunks drifting slowly around a salvage point, seeded from the
        story's own RNG so the field is stable across the title/act phases. */
    _drawDebris(c, accent, cx, cy, spread, p, alpha) {
        const bits = this._bits || [];
        c.globalAlpha = alpha;
        for (let i = 0; i < 7; i++) {
            const b = bits[i] || { x: 0.2 * i, y: 0.3, v: 1 };
            const drift = (p * (0.15 + b.v * 0.1)) % 1;
            const x = cx + (b.x - 0.5) * spread;
            const y = cy + (b.y - 0.5) * spread * 0.6 - drift * 6;
            c.fillStyle = i % 3 === 0 ? accent : '#4a4a55';
            c.fillRect(x | 0, y | 0, 3 + (i % 2), 3 + (i % 2));
        }
        c.globalAlpha = 1;
    }

    /** Blocky outpost silhouette for defend stories: a central spire with a docking
        collar and one pulsing beacon light. */
    _drawStation(c, cx, cy, scale, alpha) {
        c.save();
        c.globalAlpha = alpha;
        c.translate(cx, cy);
        c.scale(scale, scale);
        c.fillStyle = '#2c2f38';
        c.fillRect(-10, -36, 20, 72);
        c.fillRect(-34, -8, 68, 16);
        c.fillStyle = '#1b1d24';
        c.fillRect(-10, -36, 20, 10);
        c.fillRect(-10, 26, 20, 10);
        c.fillStyle = '#ffcf6a';
        c.globalAlpha = alpha * (0.5 + Math.sin((this._startT || 0) * 0.01) * 0.3);
        c.fillRect(-2, -2, 4, 4);
        c.restore();
        c.globalAlpha = 1;
    }

    /** Small hostile markers converging on the defended point, closing in as the act plays out. */
    _drawThreats(c, accent, cx, cy, p) {
        for (let i = 0; i < 3; i++) {
            const a = (i / 3) * Math.PI * 2 + p * 1.5;
            const r = 140 - p * 70;
            const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.5;
            c.fillStyle = '#ff5a4a';
            c.globalAlpha = 0.7;
            c.beginPath();
            c.moveTo(x, y - 4); c.lineTo(x + 5, y + 4); c.lineTo(x - 5, y + 4);
            c.closePath();
            c.fill();
        }
        c.globalAlpha = 1;
    }

    /** Boxy freighter hull for escort stories — distinct from the player's own ship
        silhouette so the convoy reads as separate craft, not clones. */
    _drawConvoyShip(c, cx, cy, scale, alpha, tilt) {
        c.save();
        c.globalAlpha = alpha;
        c.translate(cx, cy);
        c.rotate(tilt || 0);
        c.scale(scale, scale);
        c.fillStyle = '#3a3f4c';
        c.fillRect(-10, -22, 20, 44);
        c.fillStyle = '#50566a';
        c.fillRect(-10, -22, 20, 8);
        c.fillStyle = '#ffcf6a';
        c.globalAlpha = alpha * 0.8;
        c.fillRect(-4, 18, 8, 6);
        c.restore();
        c.globalAlpha = 1;
    }

    /** Locked-on hostile marker with a closing reticle, for hunt/raid stories. */
    _drawTarget(c, cx, cy, p, accent, alpha) {
        c.save();
        c.globalAlpha = alpha == null ? 1 : alpha;
        c.translate(cx, cy);
        c.fillStyle = '#ff5a4a';
        c.beginPath();
        c.moveTo(0, -10); c.lineTo(7, 8); c.lineTo(-7, 8);
        c.closePath();
        c.fill();
        c.strokeStyle = accent;
        c.globalAlpha = (alpha == null ? 1 : alpha) * (0.6 + Math.sin(p * Math.PI * 6) * 0.3);
        c.lineWidth = 1.5;
        c.beginPath(); c.arc(0, 0, 16 + Math.sin(p * 10) * 2, 0, Math.PI * 2); c.stroke();
        c.beginPath(); c.moveTo(-22, 0); c.lineTo(-16, 0); c.moveTo(16, 0); c.lineTo(22, 0); c.stroke();
        c.beginPath(); c.moveTo(0, -22); c.lineTo(0, -16); c.moveTo(0, 16); c.lineTo(0, 22); c.stroke();
        c.restore();
        c.globalAlpha = 1;
    }

    /** Route beacons for patrol/clear stories: a shallow arc of waypoint diamonds, the
        current one picked out in the faction accent colour. p<0 (title phase) shows the
        full route with none active yet. */
    _drawWaypoints(c, accent, p) {
        const cx = this.W * 0.5, cy = this.H * 0.56;
        for (let i = 0; i < 3; i++) {
            const t = i / 2;
            const x = cx + (t - 0.5) * this.W * 0.55;
            const y = cy - Math.sin(t * Math.PI) * 40;
            const active = p >= 0 && Math.abs(p - t) < 0.18;
            c.fillStyle = active ? accent : '#5a5a66';
            c.globalAlpha = active ? 1 : 0.5;
            c.save();
            c.translate(x, y);
            c.rotate(Math.PI / 4);
            c.fillRect(-4, -4, 8, 8);
            c.restore();
        }
        c.globalAlpha = 1;
    }

    _finish() {
        this._cleanup();
        const cb = this._onDone;
        this._onDone = null;
        if (cb) cb();
    }

    _cleanup() {
        this.active = false;
        if (this._raf) cancelAnimationFrame(this._raf);
        this._raf = 0;
        if (this._resizeHandler) window.removeEventListener('resize', this._resizeHandler);
        this._resizeHandler = null;
        if (this._keyHandler && this._keyHandlerBound) {
            document.removeEventListener('keydown', this._keyHandler, true);
        }
        this._keyHandler = null;
        this._keyHandlerBound = false;
        if (this._planet) { this._planet.unmount(); this._planet = null; }
        if (this.overlay && this.overlay.parentNode) this.overlay.parentNode.removeChild(this.overlay);
        this.overlay = null;
        this.canvas = null;
        this.ctx = null;
        this._card = null;
        this._story = null;
        this._titleText = '';
        this._blurbText = '';
        this._bits = null;
    }
}
const launchCutsceneManager = new LaunchCutsceneManager();
