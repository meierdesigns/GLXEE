"use strict";

// factionGui: the one owner of the faction GUI switch.
// Everything that changes the GUI faction (profile switch, creation, joining, FX frame preview, the pilot-plate sync)
// ends up in go(). It never runs two switches at once: while the cables are swapping, the latest request just
// replaces the pending one, so a burst of calls plays ONE smooth change. Requests before the first player input
// (boot / refresh) are applied instantly, so a reload paints the saved faction without any animation.
const factionGui = (() => {
    const ROOT = document.documentElement;
    let shown = ROOT.getAttribute('data-faction') || '';       // faction currently stamped on the page (stage-boot.js sets it on the first frame)
    let desired = shown;
    let busy = false;
    let ready = false;

    const bezel = () => document.getElementById('vf-bezel');
    const reduce = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    // Animate only for changes the player causes: boot, refresh and restore (all before any input) switch instantly,
    // so a reload never replays the cable swap.
    const arm = () => { ready = true; };
    ['pointerdown', 'keydown', 'touchstart'].forEach((ev) => window.addEventListener(ev, arm, { once: true, capture: true }));

    // The frame (bezel attribute, cable styling attribute) and the remembered values follow the stamped theme.
    function commit(id, stamp) {
        shown = id;
        stamp();
        const bz = bezel();
        const wizard = bz && bz.dataset.pendingFaction;          // the pilot wizard drives the bezel itself while picking
        if (!wizard) {
            if (bz && bz.getAttribute('data-faction') !== id) bz.setAttribute('data-faction', id);
            if (ROOT.getAttribute('data-vf-faction') !== id) ROOT.setAttribute('data-vf-faction', id);
        }
        repaintBackdrops();
        const preview = bz && (bz.hasAttribute('data-preview') || bz.hasAttribute('data-fx-preview'));
        // The station overlay carries its own copy of the faction tokens (cover art, panels): recolour it with the rest.
        if (typeof homeStationUI !== 'undefined' && homeStationUI.overlay && homeStationUI.applyFactionTheme) {
            try { homeStationUI.applyFactionTheme(preview ? id : undefined); } catch (e) { /* station not ready */ }
        }
    }

    // Backdrops painted by the parallax layer stay frozen while another surface covers them, so a faction change
    // (or the wizard previewing one) left e.g. the menu hangar in the old faction's image. Repaint every host from its CSS.
    function repaintBackdrops() {
        const P = window.VFBgMouseParallaxParts;
        if (!P || !P.getPrimaryBase || !P.readHostBackground || !P.paintBaseInstant) return;
        document.querySelectorAll('.vf-bg-parallax-host').forEach((host) => {
            try {
                const base = P.getPrimaryBase(host), bg = P.readHostBackground(host);
                if (base && bg && bg.img && bg.img !== 'none' && base.style.backgroundImage !== bg.img) P.paintBaseInstant(base, bg.img, bg.bgColor);
            } catch (e) { /* host not ready */ }
        });
    }
    window.vfRepaintBackdrops = repaintBackdrops;

    /** Switch the GUI to `id`. `stamp()` paints the theme (colours, palette) once the frame is ready for it. */
    function go(id, stamp) {
        desired = id;
        const bz = bezel();
        const same = id === shown && (!bz || bz.getAttribute('data-faction') === id);
        if (same) { stamp(); return id; }                        // colour edits of the same faction: no animation
        if (window.console && console.info) console.info('[factionGui] ' + shown + ' -> ' + id + (ready ? ' (animated)' : ' (instant)'), new Error().stack.split('\n').slice(2, 6).join(' | '));
        if (busy) { pendingStamp = stamp; return id; }           // a switch is playing: the newest request wins afterwards
        const sw = window.vfFitScope && window.vfFitScope.cableSwitch;
        if (!ready || !bz || !sw || reduce()) { commit(id, stamp); return id; }
        busy = true;
        pendingStamp = null;
        sw(id, () => {
            busy = false;
            commit(id, stamp);
            if (desired !== id) go(desired, pendingStamp || stamp);
        });
        return id;
    }
    let pendingStamp = null;

    /** Pilot-plate sync: bring the GUI back in line with the active profile unless something is previewing. */
    function follow(id) {
        if (busy || !id) return;
        const bz = bezel();
        if (bz && (bz.hasAttribute('data-preview') || bz.hasAttribute('data-fx-preview') || bz.dataset.pendingFaction)) return;
        if (id === desired && (!bz || bz.getAttribute('data-faction') === desired)) return;
        if (typeof factionShipStyles !== 'undefined' && factionShipStyles.applyDocumentFactionTheme) factionShipStyles.applyDocumentFactionTheme(id);
    }

    /** The one door to the cable swap, for flows that recolour the frame themselves (pilot wizard): same gate as go(). */
    function swap(id, apply) {
        const sw = window.vfFitScope && window.vfFitScope.cableSwitch;
        if (!ready || !sw || reduce()) { apply(); return; }
        sw(id, apply);
    }

    /**
     * Refresh check: which faction MUST the GUI show? Preview > pilot wizard > active profile > saved snapshot > terran.
     * If the page shows something else it is corrected at once, without animation.
     */
    function expected() {
        const bz = bezel();
        if (bz && bz.hasAttribute('data-fx-preview')) return bz.getAttribute('data-faction') || '';
        if (bz && bz.dataset.pendingFaction) return bz.dataset.pendingFaction;
        const fss = typeof factionShipStyles !== 'undefined' ? factionShipStyles : null;
        return fss && fss.resolveActiveFaction ? fss.resolveActiveFaction() : ((window.vfGuiState && window.vfGuiState.id) || 'terran');
    }
    function reconcile() {
        const bz = bezel();
        if (!bz || busy || bz.hasAttribute('data-preview')) return;
        const want = expected();
        if (!want) return;
        const docOk = ROOT.getAttribute('data-faction') === want && ROOT.getAttribute('data-vf-faction') === want;
        if (docOk && bz.getAttribute('data-faction') === want) return;
        if (window.console && console.info) console.info('[factionGui] reconcile -> ' + want + ' (instant)');
        if (typeof factionShipStyles !== 'undefined' && factionShipStyles.applyDocumentFactionTheme) factionShipStyles.applyDocumentFactionTheme(want);
        else commit(want, () => {});
    }

    /** A flow that stamped the document itself (pilot wizard) tells the switch what is shown now. */
    function sync(id) { shown = id; desired = id; }

    return { go, follow, swap, sync, reconcile, expected, get shown() { return shown; }, get busy() { return busy; }, get armed() { return ready; } };
})();
window.factionGui = factionGui;
