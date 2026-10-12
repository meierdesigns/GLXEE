"use strict";

// Ship areas (nose, core, aft, wings) may touch but never overlap.
//
// Moving or resizing an area (setSegmentOffset / setSegmentScale /
// setWingOffset) rebuilds the layout; if two areas would overlap, the move is
// cut back to the last free position along the way (bisection), so a drag
// stops flush against the neighbouring area instead of passing into it.
(function noAreaOverlap() {
    const proto = ShipLoadoutManager.prototype;
    const EPS = 0.01;

    /** True when any two hull areas of this ship's current layout overlap. */
    proto.layoutHasAreaOverlap = function (shipId) {
        if (typeof shipConfigManager === 'undefined' || !shipConfigManager.getMergedModel
            || !this.applyLayoutToModel) return false;
        const base = shipConfigManager.getMergedModel(shipId);
        if (!base) return false;
        const model = Object.assign({}, base);
        this.applyLayoutToModel(model, shipId);
        const segs = (model.layout && model.layout.segments) || [];
        for (let i = 0; i < segs.length; i++) {
            for (let j = i + 1; j < segs.length; j++) {
                const a = segs[i];
                const b = segs[j];
                const ix = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
                const iy = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
                if (ix > EPS && iy > EPS) return true;
            }
        }
        // Areas also stay on their own side of the core: a big move could
        // jump a wing clean through the core without any overlap at the end.
        const by = {};
        segs.forEach((s) => { by[s.id] = s; });
        const c = by.center;
        if (c) {
            const cx = c.x + c.width / 2;
            const cy = c.y + c.height / 2;
            const mx = (s) => s.x + s.width / 2;
            const my = (s) => s.y + s.height / 2;
            if (by.wingLeft && mx(by.wingLeft) > cx) return true;
            if (by.wingRight && mx(by.wingRight) < cx) return true;
            if (by.front && my(by.front) > cy) return true;
            if (by.back && my(by.back) < cy) return true;
        }
        return false;
    };

    const areaKey = (seg) => (seg === 'wingLeft' || seg === 'wingRight' ? 'wing' : String(seg || 'center'));

    /**
     * Wrap a setter: `argIdx` are its numeric arguments, `readPrev` returns
     * their current stored values from a loadout snapshot.
     */
    const guard = (name, argIdx, readPrev) => {
        const base = proto[name];
        if (!base) return;
        proto[name] = function () {
            const args = Array.prototype.slice.call(arguments);
            const shipId = args[0];
            // Already overlapping (old save): don't lock the player out of fixing it.
            if (this.layoutHasAreaOverlap(shipId)) return base.apply(this, args);
            const before = JSON.parse(JSON.stringify(this.getLoadout(shipId)));
            const res = base.apply(this, args);
            if (!this.layoutHasAreaOverlap(shipId)) return res;
            const prev = readPrev(before, args);
            const target = argIdx.map((i) => Number(args[i]) || 0);
            // Each axis is cut back on its own: a corner drag that widens a
            // part into a wing still applies its full height change, and
            // the width stops flush against the wing — before, one blocked
            // axis froze the whole drag.
            const cur = prev.slice();
            const at = () => {
                const a = args.slice();
                argIdx.forEach((i, k) => { a[i] = cur[k]; });
                return base.apply(this, a);
            };
            // Unblocked axes first, so they don't wait on a blocked one.
            const order = argIdx.map((_, k) => k).sort((p, q) => {
                const free = (k) => {
                    const save = cur[k];
                    cur[k] = target[k];
                    at();
                    const ok = !this.layoutHasAreaOverlap(shipId);
                    cur[k] = save;
                    return ok ? 0 : 1;
                };
                return free(p) - free(q);
            });
            order.forEach((k) => {
                const from = cur[k];
                let lo = 0;
                let hi = 1;
                cur[k] = target[k];
                at();
                if (!this.layoutHasAreaOverlap(shipId)) return;
                for (let n = 0; n < 8; n++) {
                    const mid = (lo + hi) / 2;
                    cur[k] = from + (target[k] - from) * mid;
                    at();
                    if (this.layoutHasAreaOverlap(shipId)) hi = mid;
                    else lo = mid;
                }
                cur[k] = from + (target[k] - from) * lo;
            });
            const out = at();
            return Object.assign({}, out, { ok: true, blocked: 'OVERLAP' });
        };
    };

    guard('setSegmentOffset', [2, 3], (L, args) => {
        const o = (L.segmentOffset && L.segmentOffset[areaKey(args[1])]) || {};
        return [Number(o.x) || 0, Number(o.y) || 0];
    });
    guard('setSegmentScale', [2, 3], (L, args) => {
        const s = (L.segmentScale && L.segmentScale[areaKey(args[1])]) || {};
        return [s.x != null ? Number(s.x) : 1, s.y != null ? Number(s.y) : 1];
    });
    guard('setWingOffset', [1, 2], (L) => [Number(L.wingOffsetX) || 0, Number(L.wingOffsetY) || 0]);
})();
