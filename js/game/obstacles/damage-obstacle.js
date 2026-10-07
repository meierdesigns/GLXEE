"use strict";

// ObstacleManager methods: weapon-scaled rock damage, splash and boulders
// that shed destructible chunks as they're worn down.
const BOULDER_CHANCE = 0.35;
const BOULDER_MIN = 26;       // px: rocks this big shed chunks when hit
const CHUNK_SIZE = 10;

extendClass(ObstacleManager, {
    /** Rock damage from a bullet: stronger weapons chew through faster. */
    bulletRockDamage(bullet) {
        const dmg = Number(bullet && bullet.damage) || 8;
        return Math.max(2, Math.round(dmg / 3.5));
    },

    /** Splash radius around the impact; missiles / heavy shots blast wider. */
    bulletSplashRadius(bullet) {
        const kind = String((bullet && (bullet.weaponType || bullet.type || bullet.weapon)) || '').toLowerCase();
        const dmg = Number(bullet && bullet.damage) || 8;
        let r = Math.min(20, 6 + dmg * 0.55);
        if (kind.includes('missile') || (bullet && bullet.homing)) r = Math.max(r, 28);
        else if (kind.includes('plasma') || kind.includes('nova')) r = Math.max(r, 20);
        else if (kind.includes('spread')) r = Math.max(r, 12);
        return r;
    },

    /**
     * Damage obstacle at `index`; returns true if it was destroyed.
     * Boulders shed a chunk each time they lose a quarter of their health.
     */
    damageObstacle(index, amount, hitX, hitY) {
        const o = this.obstacles[index];
        if (!o || o.isFog || !o.isDestructible) return false;
        const before = o.health;
        o.health -= Math.max(1, amount);
        if (o.health <= 0) {
            this.removeObstacle(index);
            return true;
        }
        if (o.isBoulder && o.maxHealth > 0) {
            const step = o.maxHealth / (o.shedSteps || 4);
            const lost = Math.floor((o.maxHealth - o.health) / step) - Math.floor((o.maxHealth - before) / step);
            // One heavy hit never tears off more than two chunks.
            for (let k = 0; k < Math.min(2, lost); k++) this.shedChunk(o, hitX, hitY);
            // Once most of it is gone the rest crumbles instead of lingering
            // as a skeleton.
            if (o._solid0 && o._left != null && o._left < o._solid0 * 0.35) {
                const k = this.obstacles.indexOf(o);
                if (k >= 0) this.removeObstacle(k);
                return true;
            }
        }
        return false;
    },

    /** Splash every other destructible rock near (x, y). */
    splashObstacles(x, y, radius, amount, skip) {
        if (!(radius > 0)) return;
        // Snapshot: chunks/fragments spawned by this blast aren't hit by it,
        // and indices are re-resolved since removals shift the array.
        const targets = this.obstacles.slice();
        for (const o of targets) {
            if (!o || o === skip || o.isFog || !o.isDestructible) continue;
            const cx = Math.max(o.x, Math.min(x, o.x + o.width));
            const cy = Math.max(o.y, Math.min(y, o.y + o.height));
            const d = Math.hypot(cx - x, cy - y);
            if (d > radius) continue;
            const falloff = d < radius * 0.5 ? 1 : 0.5;
            const j = this.obstacles.indexOf(o);
            if (j < 0) continue;
            this.damageObstacle(j, Math.max(1, Math.round(amount * falloff)), x, y);
        }
    },

    /** Break a chunk off a boulder at the hit side, leaving a crater. */
    shedChunk(o, hitX, hitY) {
        const cx = o.x + o.width / 2;
        const cy = o.y + o.height / 2;
        const hx = hitX != null ? hitX : cx;
        const hy = hitY != null ? hitY : cy;
        const a = Math.atan2(hy - cy, hx - cx) + (Math.random() - 0.5) * 0.9;
        const sp = 0.5 + Math.random() * 0.6;
        this.spawnDebris({ x: hx - 4, y: hy - 4, width: 8, height: 8, _hiRes: o._hiRes,
            horizontalSpeed: o.horizontalSpeed, verticalSpeed: o.verticalSpeed });
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        // Bite a crater out of the boulder's own art; the bitten-off pixels
        // become the chunk, so nothing re-rolls its look.
        const bite = this.carveBoulder(o, ca, sa);
        const bx = bite ? bite.x : cx + ca * o.width * 0.4;
        const by = bite ? bite.y : cy + sa * o.height * 0.4;
        const shared = (typeof renderManager !== 'undefined' && renderManager.getCombatVoxelCell)
            ? renderManager.getCombatVoxelCell() : null;
        const unit = (shared != null && shared > 0) ? shared : CHUNK_SIZE;
        const cw = bite ? bite.w : unit;
        const ch = bite ? bite.h : unit;
        this.obstacles.push({
            x: bx - cw / 2,
            y: by - ch / 2,
            width: cw,
            height: ch,
            horizontalSpeed: Math.cos(a) * sp + (o.horizontalSpeed || 0),
            verticalSpeed: Math.sin(a) * sp + (o.verticalSpeed || 0),
            rotation: 0,
            rotationSpeed: 0,
            type: 'small_asteroid',
            kind: 'asteroid',
            cluster: o.cluster || 'alpha',
            color: o.color,
            health: 1,
            maxHealth: 1,
            isDestructible: true,
            reflectsShots: false,
            isFog: false,
            fragmentOnDestroy: false,
            fragmentCount: 0,
            fragmentGeneration: (o.fragmentGeneration || 0) + 1,
            collisionDamage: Math.max(1, Math.round((o.collisionDamage || 15) * 0.4)),
            opticalMode: 'none',
            explosionId: o.explosionId || 'asteroid_burst',
            sprite: 'obstacleSmall',
            opacity: 1,
            wallDepth: o.wallDepth || (Math.random() < 0.55 ? 'under' : 'over'),
            _hiRes: bite ? bite.art : undefined
        });
    },

    /**
     * Erase a round bite at the boulder's edge in direction (ca, sa) and
     * re-outline the wound. Returns the bite centre (world px) and a canvas
     * holding the removed pixels, or null if the art isn't baked yet.
     */
    carveBoulder(o, ca, sa) {
        const img = o._hiRes;
        if (!img || !img.getContext || typeof document === 'undefined') return null;
        const gw = img.width;
        const gh = img.height;
        const ctx = img.getContext('2d');
        const data = ctx.getImageData(0, 0, gw, gh);
        const px = data.data;
        const solid = (x, y) => x >= 0 && y >= 0 && x < gw && y < gh && px[(y * gw + x) * 4 + 3] > 0;
        // March inwards from outside along the ray to the first solid cell.
        const mx = gw / 2, my = gh / 2;
        const reach = Math.hypot(gw, gh) / 2;
        let ex = -1, ey = -1;
        for (let t = reach; t >= 0; t -= 0.5) {
            const x = Math.floor(mx + ca * t), y = Math.floor(my + sa * t);
            if (solid(x, y)) { ex = x; ey = y; break; }
        }
        if (ex < 0) return null;
        const sx = o.width / gw, sy = o.height / gh;
        const r = Math.max(1.5, (CHUNK_SIZE / sx) * 0.45);
        // Centre the bite slightly inside the edge so it takes a real piece.
        const bcx = ex - ca * r * 0.5, bcy = ey - sa * r * 0.5;
        const cells = Math.ceil(r * 2) + 1;
        const art = document.createElement('canvas');
        art.width = cells;
        art.height = cells;
        const aData = art.getContext('2d').createImageData(cells, cells);
        const ox = Math.round(bcx - cells / 2), oy = Math.round(bcy - cells / 2);
        let removed = 0;
        for (let y = oy; y < oy + cells; y++) {
            for (let x = ox; x < ox + cells; x++) {
                if (!solid(x, y) || Math.hypot(x + 0.5 - bcx, y + 0.5 - bcy) > r) continue;
                const k = (y * gw + x) * 4;
                const a = ((y - oy) * cells + (x - ox)) * 4;
                for (let c = 0; c < 4; c++) aData.data[a + c] = px[k + c];
                px[k + 3] = 0;
                removed++;
            }
        }
        if (!removed) return null;
        if (o._solid0 == null) {
            let n = removed;
            for (let i = 3; i < px.length; i += 4) if (px[i] > 0) n++;
            o._solid0 = n;
        }
        const clear = (x, y) => { px[(y * gw + x) * 4 + 3] = 0; };
        // Erode spindly strands: cells with at most one solid neighbour.
        for (let pass = 0; pass < 2; pass++) {
            for (let y = 0; y < gh; y++) {
                for (let x = 0; x < gw; x++) {
                    if (!solid(x, y)) continue;
                    const nb = solid(x - 1, y) + solid(x + 1, y) + solid(x, y - 1) + solid(x, y + 1);
                    if (nb <= 1) clear(x, y);
                }
            }
        }
        // Keep only the largest connected mass; loose islands fly off.
        const comp = new Int32Array(gw * gh).fill(-1);
        const sizes = [];
        for (let i = 0; i < gw * gh; i++) {
            if (comp[i] >= 0 || px[i * 4 + 3] === 0) continue;
            const id = sizes.length;
            let n = 0;
            const stack = [i];
            comp[i] = id;
            while (stack.length) {
                const c = stack.pop();
                n++;
                const x = c % gw, y = (c - x) / gw;
                [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].forEach(([nx, ny]) => {
                    if (!solid(nx, ny)) return;
                    const k = ny * gw + nx;
                    if (comp[k] < 0) { comp[k] = id; stack.push(k); }
                });
            }
            sizes.push(n);
        }
        let keep = 0;
        sizes.forEach((n, id) => { if (n > sizes[keep]) keep = id; });
        let left = 0, lx = 0, ly = 0, ln = 0;
        for (let i = 0; i < gw * gh; i++) {
            if (comp[i] >= 0 && comp[i] !== keep && px[i * 4 + 3] > 0) {
                const x = i % gw;
                lx += x; ly += (i - x) / gw; ln++;
                px[i * 4 + 3] = 0;
            } else if (px[i * 4 + 3] > 0) left++;
        }
        o._left = left;
        if (ln) {
            const s2 = Math.max(3, Math.sqrt(ln) * sx);
            this.spawnDebris({ x: o.x + (lx / ln) * sx - s2 / 2, y: o.y + (ly / ln) * sy - s2 / 2,
                width: s2, height: s2, _hiRes: img,
                horizontalSpeed: o.horizontalSpeed, verticalSpeed: o.verticalSpeed });
        }
        // Dark rim along the fresh wound (matches the baked outline).
        for (let y = oy - 1; y <= oy + cells; y++) {
            for (let x = ox - 1; x <= ox + cells; x++) {
                if (!solid(x, y)) continue;
                if (solid(x - 1, y) && solid(x + 1, y) && solid(x, y - 1) && solid(x, y + 1)) continue;
                const k = (y * gw + x) * 4;
                px[k] = 5; px[k + 1] = 6; px[k + 2] = 10; px[k + 3] = 255;
            }
        }
        ctx.putImageData(data, 0, 0);
        // Solid mask so shots pass through the crater.
        const mask = new Uint8Array(gw * gh);
        for (let i = 0; i < mask.length; i++) mask[i] = px[i * 4 + 3] > 0 ? 1 : 0;
        o._mask = { w: gw, h: gh, a: mask };
        art.getContext('2d').putImageData(aData, 0, 0);
        // Keep the boulder's pixel scale so the chunk matches the hole.
        art._w = cells * sx;
        art._h = cells * sy;
        return { x: o.x + (ox + cells / 2) * sx, y: o.y + (oy + cells / 2) * sy, w: art._w, h: art._h, art };
    },

    /** True if the carved boulder has solid art inside world rect r. */
    maskOverlapsRect(o, r) {
        const m = o._mask;
        if (!m) return true;
        const sx = m.w / o.width, sy = m.h / o.height;
        const x0 = Math.max(0, Math.floor((r.x - o.x) * sx));
        const y0 = Math.max(0, Math.floor((r.y - o.y) * sy));
        const x1 = Math.min(m.w - 1, Math.floor((r.x + r.width - o.x) * sx));
        const y1 = Math.min(m.h - 1, Math.floor((r.y + r.height - o.y) * sy));
        for (let y = y0; y <= y1; y++) {
            for (let x = x0; x <= x1; x++) if (m.a[y * m.w + x]) return true;
        }
        return false;
    },

    /** Turn a plain asteroid into a big boulder with breakable parts. */
    makeBoulder(o) {
        // Some boulders are huge; most are wider than tall (slabs).
        const huge = Math.random() < 0.35;
        const s = huge ? 42 + Math.floor(Math.random() * 18) : BOULDER_MIN + Math.floor(Math.random() * 14);
        const w = Math.round(s * (1.2 + Math.random() * 0.6));
        o.x -= (w - o.width) / 2;
        o.width = w;
        o.height = Math.round(s * (0.7 + Math.random() * 0.25));
        o.isBoulder = true;
        o.shedSteps = huge ? 5 : 3;
        o.health = o.maxHealth = Math.round((4 + Math.random() * 3) * (huge ? 1.45 : 1));
        o.fragmentOnDestroy = true;
        o.fragmentCount = huge ? 4 : 3;
        o.fragmentSizeRatio = 0.5;
        o.fragmentHealth = 1;
        o.collisionDamage = Math.max(o.collisionDamage || 15, 25);
        o.horizontalSpeed *= 0.7;
        o.verticalSpeed *= 0.7;
        o._hiRes = null;
        return o;
    },

    maybeBoulder(o) {
        if (o && !o.isFog && o.kind === 'asteroid' && o.isDestructible
            && !o.reflectsShots && (o.opticalMode || 'none') === 'none'
            && Math.random() < BOULDER_CHANCE) {
            this.makeBoulder(o);
        }
        return o;
    },
});
