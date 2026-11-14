"use strict";

/**
 * App-styled floating tooltips for [data-ui-tip] (icons and labeled controls).
 */
class UiTooltipManager {
    constructor() {
        this.el = null;
        this._active = null;
        this._bound = false;
        this._raf = 0;
        this._moveBound = false;
        this._delayTimer = 0;
    }

    ensureEl() {
        if (this.el && this.el.isConnected) return this.el;
        const tip = document.createElement('div');
        tip.className = 'ui-tooltip';
        tip.setAttribute('role', 'tooltip');
        // Mount on <html>, not <body>: body carries overflow:clip + bezel clip-path
        // and stage scale, which shears tips that open near the rim (bezel tools).
        document.documentElement.appendChild(tip);
        this.el = tip;
        return tip;
    }

    init() {
        if (this._bound) return;
        this._bound = true;
        document.addEventListener('pointerover', (e) => this.onOver(e), true);
        document.addEventListener('pointerout', (e) => this.onOut(e), true);
        document.addEventListener('focusout', (e) => this.onFocusOut(e), true);
        document.addEventListener('pointerdown', () => this.hide(), true);
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.hide();
        }, true);
        window.addEventListener('blur', () => this.hide());
        window.addEventListener('scroll', () => this.hide(), true);
        window.addEventListener('resize', () => this.hide());
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) this.hide();
        });
    }

    bindMoveWatch() {
        if (this._moveBound) return;
        this._moveBound = true;
        document.addEventListener('pointermove', this._onMove, true);
    }

    unbindMoveWatch() {
        if (!this._moveBound) return;
        this._moveBound = false;
        document.removeEventListener('pointermove', this._onMove, true);
    }

    resolveTip(target) {
        if (!target || !target.closest) return null;
        // Prefer data-ui-tip; also adopt native title= so browser chrome never shows.
        const el = target.closest('[data-ui-tip], [title]');
        if (!el || !el.isConnected) return null;
        // Rich host tooltips (upgrade tree) own their hover chrome.
        if (el.closest('.hs-upg-node')) return null;
        // Navbar area buttons carry their own label; no tooltip.
        if (el.closest('.hs-area-btn')) return null;
        // <title> inside SVG is not an attribute tip.
        if (el.tagName === 'title') return null;
        let tip = el.getAttribute('data-ui-tip');
        if (!tip || !String(tip).trim()) {
            tip = el.getAttribute('title');
            if (!tip || !String(tip).trim()) return null;
            // Move title → data-ui-tip once so the OS tooltip never appears.
            el.setAttribute('data-ui-tip', tip);
            el.removeAttribute('title');
        }
        tip = String(tip).trim();
        // Only icon-only controls and ones needing a longer explanation get a
        // tip; a control whose visible text already is the tip stays quiet.
        // Icon+amount chips (pilot resources, victory loot, …) keep a short
        // name tip even though they show a number — the amount is not a label.
        const rich = el.hasAttribute('data-ui-tip-head') || tip.length > 40 || tip.indexOf('\n') >= 0;
        const labelText = (el.textContent || '').replace(/\s+/g, ' ').trim();
        const tipNorm = tip.replace(/\s+/g, ' ').trim();
        if (!rich && labelText && tipNorm.toLowerCase() === labelText.toLowerCase()) return null;
        return { el: el, tip: tip };
    }

    onOver(e) {
        // No tooltips while a hangar part is being dragged.
        if (document.body.classList.contains('hs-part-grabbing')) return;
        const hit = this.resolveTip(e.target);
        if (!hit) return;
        this.show(hit.el, hit.tip);
    }

    onOut(e) {
        if (!this._active) return;
        const related = e.relatedTarget;
        if (related && this._active.contains(related)) return;
        const next = this.resolveTip(related);
        if (next) {
            if (next.el !== this._active) this.show(next.el, next.tip);
            return;
        }
        // Leaving into null / non-tip / detached DOM — always clear.
        this.hide();
    }

    onFocusOut(e) {
        if (!this._active) return;
        const related = e.relatedTarget;
        if (related && this._active.contains(related)) return;
        const next = this.resolveTip(related);
        if (next) {
            if (next.el !== this._active) this.show(next.el, next.tip);
            return;
        }
        this.hide();
    }

    _onMove = (e) => {
        if (!this._active) {
            this.unbindMoveWatch();
            return;
        }
        // Coalesce: elementFromPoint every pointermove was a layout tax across the app.
        this._moveX = e.clientX;
        this._moveY = e.clientY;
        if (this._moveRaf) return;
        this._moveRaf = requestAnimationFrame(() => {
            this._moveRaf = 0;
            if (!this._active) return;
            if (!this._active.isConnected) {
                this.hide();
                return;
            }
            const under = document.elementFromPoint(this._moveX, this._moveY);
            const hit = this.resolveTip(under);
            if (!hit) {
                this.hide();
                return;
            }
            if (hit.el !== this._active) this.show(hit.el, hit.tip);
        });
    };

    show(anchor, text) {
        if (!anchor || !anchor.isConnected) {
            this.hide();
            return;
        }
        const tip = this.ensureEl();
        const wasVisible = tip.classList.contains('visible');
        this._active = anchor;
        this.bindMoveWatch();
        if (this._delayTimer) clearTimeout(this._delayTimer);
        this._delayTimer = 0;
        // Moving between tips while one is shown swaps instantly; a fresh
        // hover waits a beat so passing the cursor over icons stays quiet.
        if (wasVisible) {
            this.reveal(anchor, text);
            return;
        }
        const delay = anchor.hasAttribute('data-ui-tip-instant')
            ? 0
            : (anchor.hasAttribute('data-ui-tip-compact')
                ? UiTooltipManager.COMPACT_DELAY_MS
                : UiTooltipManager.SHOW_DELAY_MS);
        this._delayTimer = setTimeout(() => {
            this._delayTimer = 0;
            if (this._active !== anchor || !anchor.isConnected) return;
            this.reveal(anchor, text);
        }, delay);
    }

    reveal(anchor, text) {
        const tip = this.ensureEl();
        // Optional heading (data-ui-tip-head) and "LABEL: value" rows laid out
        // as a small table; plain tips stay a single text block.
        const head = anchor && anchor.getAttribute && anchor.getAttribute('data-ui-tip-head');
        tip.classList.toggle('ui-tooltip-rich', !!head);
        tip.classList.toggle('ui-tooltip-compact', !!(anchor && anchor.hasAttribute && anchor.hasAttribute('data-ui-tip-compact')));
        if (head) {
            tip.textContent = '';
            const h = document.createElement('div');
            h.className = 'ui-tooltip-head';
            // Inventory cells: physical item left, name to its right (full footprint, not cropped).
            const compact = !!(anchor && anchor.hasAttribute && anchor.hasAttribute('data-ui-tip-compact'));
            const itemBody = anchor.querySelector && anchor.querySelector('.hs-item-body');
            const itemBg = itemBody && (itemBody.style.backgroundImage || (getComputedStyle(itemBody).backgroundImage || ''));
            // Captured here so the SIZE_FIT schematic below (same anchor, same hover) can draw
            // the actual part icon instead of a plain filled square.
            this._lastTipIconCss = (itemBg && itemBg !== 'none') ? itemBg : null;
            if (!this._lastTipIconCss) {
                const icoEl = anchor.querySelector && anchor.querySelector('.hs-pick-ico img, .hs-slotview-part img');
                if (icoEl && icoEl.src) this._lastTipIconCss = 'url("' + icoEl.src + '")';
            }
            if (itemBg && itemBg !== 'none') {
                const srcW = Math.max(1, itemBody.offsetWidth || itemBody.clientWidth || 48);
                const srcH = Math.max(1, itemBody.offsetHeight || itemBody.clientHeight || 48);
                const max = compact ? 32 : 88;
                const floor = compact ? 24 : 48;
                const scale = Math.min(max / srcW, max / srcH, 1);
                const pw = Math.max(floor, Math.round(srcW * scale));
                const ph = Math.max(floor, Math.round(srcH * scale));
                const preview = document.createElement('span');
                preview.className = 'ui-tooltip-item';
                preview.setAttribute('aria-hidden', 'true');
                preview.style.cssText = 'display:block;width:' + pw + 'px;height:' + ph + 'px;flex-shrink:0;'
                    + 'background-image:' + itemBg + ';background-size:contain;background-position:center;background-repeat:no-repeat;image-rendering:pixelated';
                h.appendChild(preview);
                h.classList.add('has-item');
            } else {
                const ico = anchor.querySelector && anchor.querySelector('.hs-pick-ico img, .hs-slotview-part img');
                if (ico && ico.src) {
                    const im = document.createElement('img');
                    im.src = ico.src; im.alt = ''; im.draggable = false;
                    im.className = 'ui-tooltip-item-ico';
                    im.style.cssText = 'width:28px;height:28px;image-rendering:pixelated;vertical-align:middle;margin-right:8px;flex-shrink:0';
                    h.appendChild(im);
                }
            }
            if (anchor.classList && anchor.classList.contains('is-blueprint')) {
                const bpBadge = document.createElement('span');
                bpBadge.className = 'ui-tooltip-bp-badge';
                bpBadge.setAttribute('aria-hidden', 'true');
                bpBadge.title = 'Blueprint';
                h.appendChild(bpBadge);
                h.classList.add('has-bp');
            }
            const title = document.createElement('span');
            title.className = 'ui-tooltip-title';
            title.textContent = head;
            h.appendChild(title);
            tip.appendChild(h);
            // Pre-rendered rich body (e.g. BUY tip with resource icons + affordance).
            const tipBody = anchor.querySelector && anchor.querySelector('template[data-ui-tip-body]');
            if (tipBody && (anchor.hasAttribute('data-ui-tip-html') || tipBody.content)) {
                const wrap = document.createElement('div');
                wrap.className = 'ui-tooltip-html';
                wrap.appendChild(tipBody.content.cloneNode(true));
                tip.appendChild(wrap);
            } else
            String(text).split('\n').forEach((line) => {
                // SIZE_FIT:<slot letter>:<part letter> — a little schematic of the slot's
                // footprint with the part's footprint nested inside it (both S/M/L), instead of
                // two "SLOT SIZE: S" / "PART SIZE: S" text rows: this is the actual visual used
                // for slot/part size everywhere else (hs-hangar-slot pins, hs-pick-cell spans),
                // so the tooltip shows the same shape instead of restating it as letters.
                const fit = line.match(/^SIZE_FIT:([SML]):([SML])$/);
                if (fit) {
                    const [, slotL, partL] = fit;
                    const row = document.createElement('div');
                    row.className = 'ui-tooltip-row ui-tooltip-sizefit';
                    const schema = document.createElement('span');
                    schema.className = 'ui-tooltip-sizefit-schema is-slot-' + slotL + ' is-part-' + partL;
                    schema.setAttribute('aria-hidden', 'true');
                    const slotBox = document.createElement('span');
                    slotBox.className = 'ui-tooltip-sizefit-slot';
                    const partBox = document.createElement('span');
                    partBox.className = 'ui-tooltip-sizefit-part';
                    if (this._lastTipIconCss) {
                        partBox.classList.add('has-icon');
                        partBox.style.backgroundImage = this._lastTipIconCss;
                    }
                    slotBox.appendChild(partBox);
                    schema.appendChild(slotBox);
                    const label = document.createElement('span');
                    label.className = 'ui-tooltip-sizefit-label';
                    label.textContent = slotL === partL ? ('SLOT & PART ' + slotL) : ('SLOT ' + slotL + ' · PART ' + partL);
                    row.append(schema, label);
                    tip.appendChild(row);
                    return;
                }
                const m = line.match(/^([^:]{1,24}):\s*(.+)$/);
                const row = document.createElement('div');
                row.className = m ? 'ui-tooltip-row' : 'ui-tooltip-note';
                if (m) {
                    const k = document.createElement('span');
                    k.className = 'ui-tooltip-key';
                    k.textContent = m[1];
                    const v = document.createElement('span');
                    v.className = 'ui-tooltip-val';
                    v.textContent = m[2];
                    row.append(k, v);
                } else {
                    const ir = typeof iconRenderer !== 'undefined' && iconRenderer.imgHtml ? iconRenderer : null;
                    const resIcon = {
                        credits: 'resCredits',
                        scrap: 'resScrap',
                        ore: 'resOre',
                        crystal: 'resCrystal',
                        voltex: 'resVoltex'
                    };
                    const resColor = (id) => (typeof economyConfig !== 'undefined' && economyConfig.resourceColors && economyConfig.resourceColors[id])
                        || (id === 'credits' ? '#ffd24a' : '#b8b0a0');
                    const buyLine = line.match(/^BUY (\w+) x(\d+) · (\d+) CR · (CAN|SHORT)$/);
                    const totalLine = line.match(/^TOTAL · (\d+) CR · (CAN BUY|NOT ENOUGH CREDITS)$/);
                    if ((buyLine || totalLine) && ir) {
                        row.className = 'ui-tooltip-stats' + ((buyLine && buyLine[4] === 'SHORT') || (totalLine && totalLine[2] !== 'CAN BUY') ? ' is-short' : ' is-ok');
                        row.style.cssText = 'display:flex;gap:10px;align-items:center;flex-wrap:wrap';
                        const chip = (key, val, col) => {
                            const s = document.createElement('span');
                            s.style.cssText = 'display:inline-flex;gap:6px;align-items:center';
                            s.innerHTML = String(ir.imgHtml(key, 16, 'hs-pixel', col, false) || '').replace(/\s(?:data-ui-tip|title)="[^"]*"/g, '')
                                + '<span>' + val + '</span>';
                            row.appendChild(s);
                        };
                        if (buyLine) {
                            const id = buyLine[1];
                            const label = (typeof economyConfig !== 'undefined' && economyConfig.getResourceLabel)
                                ? economyConfig.getResourceLabel(id)
                                : id.toUpperCase();
                            chip(resIcon[id] || 'resScrap', buyLine[2] + ' ' + label, resColor(id));
                            chip(resIcon.credits, buyLine[3] + ' CR', resColor('credits'));
                            const st = document.createElement('span');
                            st.className = 'ui-tooltip-affordance';
                            st.textContent = buyLine[4] === 'CAN' ? 'CAN BUY' : 'SHORT';
                            st.style.cssText = 'margin-left:auto;letter-spacing:1px;opacity:' + (buyLine[4] === 'CAN' ? '1' : '0.7');
                            row.appendChild(st);
                        } else {
                            chip(resIcon.credits, totalLine[1] + ' CR', resColor('credits'));
                            const st = document.createElement('span');
                            st.className = 'ui-tooltip-affordance';
                            st.textContent = totalLine[2];
                            st.style.cssText = 'margin-left:auto;letter-spacing:1px;font-weight:bold;opacity:' + (totalLine[2] === 'CAN BUY' ? '1' : '0.7');
                            row.appendChild(st);
                        }
                    } else {
                    const chips = (() => {
                        // Weapon stat line "DMG 11 · SPD 13 · 4.5/S" (rate optional) -> the same stat icons as the hangar rows.
                        // 4th slot: 'up' | 'down' | null vs currently equipped gun on the ship.
                        const sm = line.match(/^DMG (\S+) · SPD (\S+)(?: · (\S+))?$/);
                        if (sm) {
                            const delta = this._weaponStatDeltas(anchor, sm);
                            return [
                                ['statDamage', sm[1], '#ff6a4a', delta[0]],
                                ['statSpeed', sm[2], '#4ad8ff', delta[1]],
                                sm[3] ? ['shotRapid', sm[3], '#ffa04a', delta[2]] : null
                            ].filter(Boolean);
                        }
                        // Weapon fire mode "MODE AUTO" / "MODE CHARGE".
                        const mm = line.match(/^MODE (AUTO|CHARGE)$/);
                        if (mm) {
                            return [[mm[1] === 'CHARGE' ? 'statEnergy' : 'shotRapid', mm[1], mm[1] === 'CHARGE' ? '#ffd24a' : '#ffa04a', null]];
                        }
                        // Ability/defense/energy "TYPE · TIER n" (tier optional) -> type + tier icons.
                        // Single keyword only — never match meta lines (EQUIPPED, MOVE TO …).
                        const tm = line.match(/^(PASSIVE|ACTIVE|TOGGLE|CHANNEL|INSTANT|AURA|BUFF|SHIELD|DRIVE|SYSTEM)(?: · TIER (\d+))?$/);
                        if (tm) {
                            const out = [['statAbilities', tm[1], '#c08cff', null]];
                            if (tm[2]) out.push(['hsBlueprint', 'T' + tm[2], '#ffd24a', null]);
                            return out;
                        }
                        // Ability stat-mod line(s), e.g. "+0.3 SPEED" or "+1 DAMAGE · +2 ARMOR"
                        // (render-shop-tab.js hangarModuleTip, concrete numbers computed from
                        // this ship's own base stats) -> same icon as the matching ship stat
                        // elsewhere instead of plain text.
                        const statIcon = { SPEED: 'statSpeed', DAMAGE: 'statDamage', ARMOR: 'statArmor', 'FIRE RATE': 'shotRapid' };
                        const statCol = { SPEED: '#4ad8ff', DAMAGE: '#ff6a4a', ARMOR: '#5ce1ff', 'FIRE RATE': '#ffa04a' };
                        const statParts = line.split(' · ').map((part) => part.match(/^([+-]\d+(?:\.\d+)?) (SPEED|DAMAGE|ARMOR|FIRE RATE)$/));
                        if (statParts.length && statParts.every(Boolean)) {
                            return statParts.map((pm) => {
                                const n = Number(pm[1]);
                                const d = Number.isFinite(n) ? (n < 0 ? 'down' : (n > 0 ? 'up' : null)) : null;
                                return [statIcon[pm[2]], pm[1] + ' ' + pm[2], statCol[pm[2]], d];
                            });
                        }
                        return null;
                    })();
                    if (chips && ir) {
                        row.className = 'ui-tooltip-stats';
                        row.style.cssText = 'display:flex;gap:' + (compact ? '8px' : '14px') + ';align-items:center;flex-wrap:nowrap';
                        chips.forEach(([key, val, col, delta]) => {
                            const s = document.createElement('span');
                            s.className = 'ui-tooltip-stat' + (delta === 'down' ? ' is-bad' : (delta === 'up' ? ' is-good' : ''));
                            s.style.cssText = 'display:inline-flex;gap:4px;align-items:center;white-space:nowrap';
                            const mark = delta === 'down' ? '<span class="hs-stat-worse">▼</span>'
                                : (delta === 'up' ? '<span class="hs-stat-better">▲</span>' : '');
                            s.innerHTML = String(ir.imgHtml(key, 16, 'hs-pixel', col, false) || '').replace(/\s(?:data-ui-tip|title)="[^"]*"/g, '')
                                + '<b class="hs-stat-num">' + val + '</b>' + mark;
                            row.appendChild(s);
                        });
                    } else {
                        row.textContent = line;
                    }
                    }
                }
                tip.appendChild(row);
            });
        } else {
            tip.textContent = text;
        }
        if (this._raf) cancelAnimationFrame(this._raf);
        this._raf = requestAnimationFrame(() => {
            this._raf = 0;
            if (this._active !== anchor || !anchor.isConnected) return;
            this.position(anchor, tip);
            tip.classList.add('visible');
        });
    }

    /** Keep a viewport box fully inside the window with a pad. */
    clampBox(left, top, tw, th, pad) {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const maxL = Math.max(pad, vw - tw - pad);
        const maxT = Math.max(pad, vh - th - pad);
        return {
            left: Math.max(pad, Math.min(left, maxL)),
            top: Math.max(pad, Math.min(top, maxT))
        };
    }

    position(anchor, tip) {
        if (!anchor || !tip || !anchor.isConnected) {
            this.hide();
            return;
        }
        const r = anchor.getBoundingClientRect();
        if (r.width <= 0 && r.height <= 0) {
            this.hide();
            return;
        }
        // Tip lives on <html> as position:fixed → true viewport pixels (no body scale).
        const tw = tip.offsetWidth || tip.getBoundingClientRect().width || 0;
        const th = tip.offsetHeight || tip.getBoundingClientRect().height || 0;
        const pad = 8;
        const gap = 10;
        tip.classList.remove('below', 'side-left', 'side-right');
        const place = (left, top, sideClass) => {
            const box = this.clampBox(left, top, tw, th, pad);
            if (sideClass) tip.classList.add(sideClass);
            tip.style.left = Math.round(box.left) + 'px';
            tip.style.top = Math.round(box.top) + 'px';
        };
        // Sidebars: open beside the panel (right of the left one, left of the
        // right one) instead of covering the neighbouring rows.
        // Slot-layout cells: right beside the cell itself.
        if (anchor.closest('.hs-slotview')) {
            let sl = r.right + gap;
            if (sl + tw > window.innerWidth - pad) sl = r.left - tw - gap;
            place(sl, r.top + r.height / 2 - th / 2, 'side-right');
            return;
        }
        // Ship-row equipment dots sit packed in one line — opening above/below
        // would cover the neighbouring dots, so open beside the row instead.
        if (anchor.classList.contains('hs-ship-slot-dot')) {
            const row = anchor.closest('.hs-ship-slot-dots') || anchor;
            const b = row.getBoundingClientRect();
            let sl = b.right + gap;
            if (sl + tw > window.innerWidth - pad) sl = b.left - tw - gap;
            place(sl, r.top + r.height / 2 - th / 2, 'side-right');
            return;
        }
        // Bay inventory + ship-row storage: open beside the cell so the tip never
        // covers the hovered item (below+clamp used to slide back over it) and
        // never covers the equipment-slot dots sitting just above the grid.
        const invPanel = !anchor.closest('[data-tip-side]') && (
            anchor.closest('.hs-bay-inv')
            || anchor.closest('.hs-ship-storage-row .hs-storage-cell')
            || (anchor.classList.contains('hs-storage-cell') && !!anchor.closest('.hs-storage-grid'))
        );
        if (invPanel) {
            let sl = r.right + gap;
            if (sl + tw > window.innerWidth - pad) sl = Math.max(pad, r.left - tw - gap);
            // Vertically centre on the cell, but keep the tip from sliding back
            // over the cell when clampBox hits the viewport edge.
            let st = r.top + r.height / 2 - th / 2;
            const tipBottom = st + th;
            if (st < r.bottom && tipBottom > r.top) {
                // Would overlap the cell: prefer below, else above, else side-only clamp.
                if (r.bottom + gap + th <= window.innerHeight - pad) st = r.bottom + gap;
                else if (r.top - gap - th >= pad) st = r.top - th - gap;
            }
            place(sl, st, 'side-right');
            return;
        }
        const leftBar = anchor.closest('.hs-hangar-list, [data-tip-side="right"]');
        const rightBar = !leftBar && anchor.closest('.hs-hangar-preview, [data-tip-side="left"]');
        if (leftBar || rightBar) {
            const b = (leftBar || rightBar).getBoundingClientRect();
            let sl = leftBar ? b.right + gap : b.left - tw - gap;
            // No room on that side: fall back to the other.
            if (sl + tw > window.innerWidth - pad || sl < pad) {
                sl = leftBar ? r.left - tw - gap : r.right + gap;
            }
            place(sl, r.top + r.height / 2 - th / 2, leftBar ? 'side-right' : 'side-left');
            return;
        }
        // Bezel tools sit in the top rim — always open below so the tip never
        // gets sheared by the stage clip / bezel band.
        const bezelTool = !!anchor.closest('.vf-bezel-tools, .vf-bezel-res, .vf-bezel-vol, .vf-bezel-fx');
        const spaceAbove = r.top - gap;
        const spaceBelow = window.innerHeight - r.bottom - gap;
        const preferBelow = bezelTool || (spaceAbove < th && spaceBelow >= spaceAbove);
        let left = r.left + (r.width / 2) - (tw / 2);
        let top = preferBelow ? (r.bottom + gap) : (r.top - th - gap);
        if (preferBelow) tip.classList.add('below');
        // If the preferred side still overflows, flip once more.
        if (!preferBelow && top < pad && spaceBelow >= th) {
            top = r.bottom + gap;
            tip.classList.add('below');
        } else if (preferBelow && top + th > window.innerHeight - pad && spaceAbove >= th) {
            top = r.top - th - gap;
            tip.classList.remove('below');
        }
        // Final guard: if clamp would drag the tip back over the anchor, open
        // beside it instead so the hovered item stays visible.
        const rawTop = top;
        const clamped = this.clampBox(left, top, tw, th, pad);
        if (clamped.top < r.bottom && clamped.top + th > r.top
            && clamped.left < r.right && clamped.left + tw > r.left) {
            let sl = r.right + gap;
            if (sl + tw > window.innerWidth - pad) sl = Math.max(pad, r.left - tw - gap);
            tip.classList.remove('below');
            place(sl, rawTop, 'side-right');
            return;
        }
        place(left, top, null);
    }

    /** Equipped weapon id to compare a storage/shop tip against, or null. */
    _weaponCompareId(anchor) {
        if (!anchor || typeof anchor.getAttribute !== 'function') return null;
        if (anchor.getAttribute('data-part-kind') !== 'weapon') return null;
        const partId = anchor.getAttribute('data-part-id');
        if (!partId || anchor.classList.contains('is-equipped')) return null;
        let shipId = anchor.getAttribute('data-drag-ship') || anchor.getAttribute('data-ship') || '';
        if (!shipId && typeof profileManager !== 'undefined' && profileManager.getActiveProfile) {
            const p = profileManager.getActiveProfile();
            shipId = (p && p.activeShipId) || '';
        }
        if (!shipId && typeof homeStationUI !== 'undefined' && homeStationUI.hangarShipId) {
            shipId = homeStationUI.hangarShipId;
        }
        if (!shipId || typeof shipLoadoutManager === 'undefined' || !shipLoadoutManager.getLoadout) return null;
        const L = shipLoadoutManager.getLoadout(shipId);
        const mounted = (L && (L.weaponSlots || L.weapons)) || [];
        const compareId = mounted.find((w) => w) || null;
        if (!compareId || compareId === partId) return null;
        return compareId;
    }

    /** Per-stat 'up'/'down'/null for a tip DMG line vs the equipped gun. */
    _weaponStatDeltas(anchor, sm) {
        const out = [null, null, null];
        const compareId = this._weaponCompareId(anchor);
        if (!compareId || typeof weaponConfigManager === 'undefined' || !weaponConfigManager.getWeapon) return out;
        const c = weaponConfigManager.getWeapon(compareId);
        if (!c) return out;
        const mine = [Number(sm[1]), Number(sm[2]), sm[3] ? parseFloat(sm[3]) : NaN];
        const theirs = [
            Number(c.damage) || 0,
            Number(c.speed) || 0,
            c.cooldown ? (1000 / c.cooldown) : 0
        ];
        for (let i = 0; i < 3; i++) {
            if (!Number.isFinite(mine[i])) continue;
            if (mine[i] < theirs[i]) out[i] = 'down';
            else if (mine[i] > theirs[i]) out[i] = 'up';
        }
        return out;
    }

    hide() {
        this._active = null;
        this.unbindMoveWatch();
        if (this._delayTimer) {
            clearTimeout(this._delayTimer);
            this._delayTimer = 0;
        }
        if (this._raf) {
            cancelAnimationFrame(this._raf);
            this._raf = 0;
        }
        if (!this.el) return;
        // Keep text and position so the fade-out plays in place.
        this.el.classList.remove('visible');
    }
}

UiTooltipManager.SHOW_DELAY_MS = 450;
UiTooltipManager.COMPACT_DELAY_MS = 650;

const uiTooltip = new UiTooltipManager();
window.uiTooltip = uiTooltip;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => uiTooltip.init());
} else {
    uiTooltip.init();
}
