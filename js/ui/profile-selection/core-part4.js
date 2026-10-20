"use strict";

// ProfileSelectionManager members, continued from core-part3.js (kept under ~500 lines per file).
// Final STORY step: pick one of 1–3 story paths offered by the selected start
// profile. Planets are assigned from the start cluster; the pilot does not
// pick a planet here.
extendClass(ProfileSelectionManager, {
    /** Pixel icon (mask-tinted like kit icons). */
    storyIconHtml(iconKey, size) {
        const key = iconKey || 'kitStandardIssue';
        const px = size || 96;
        const m = typeof iconRenderer !== 'undefined' && iconRenderer.imgHtml
            ? /src="([^"]+)"/.exec(iconRenderer.imgHtml(key, px, 'hs-pixel') || '') : null;
        return m ? `<i class="profile-story-ico" style="--pk-img:url('${m[1]}')" aria-hidden="true"></i>` : '';
    },

    renderMissionStepHtml() {
        const o = this._startOpts || {};
        const kit = this.currentKit();
        const kitIcon = kit.icon || 'kitStandardIssue';
        const paths = this.currentStoryPaths();
        const path = this.currentStoryPath();
        const gid = String(o.galaxy || '').toLowerCase();
        const bound = this.bindStoryMissionsToPlanets(path, gid);
        // Keep a start planet for applyStartOptions (first story mission's planet).
        o.missionPlanetId = (bound[0] && bound[0].planetId) || o.missionPlanetId || null;
        const n = Math.max(1, paths.length);
        const pathList = paths.map((p) => `
            <button type="button" class="profile-story-card${p.id === path.id ? ' selected' : ''}"
                data-story-id="${p.id}" tabindex="-1" title="${p.blurb}">
                <span class="profile-story-card-art">${this.storyIconHtml(p.icon, 96)}</span>
                <span class="profile-story-card-text">
                    <span class="profile-story-card-title">${p.title}</span>
                    <span class="profile-story-card-meta">${(p.missions || []).length} MISSION${(p.missions || []).length === 1 ? '' : 'S'}</span>
                    <span class="profile-story-card-blurb">${p.blurb}</span>
                </span>
            </button>`).join('');
        const kindLabel = (m) => {
            const k = String(m.targetKind || 'planet');
            if (k === 'station') return 'STATION';
            if (k === 'find_planet') return 'LOCATE';
            if (k === 'find_galaxy') return 'GALAXY';
            return 'PLANET';
        };
        const targetLabel = (m) => {
            if (m.targetKind === 'station') return m.stationName || m.planetName || 'STATION';
            if (m.targetKind === 'find_galaxy') return m.galaxyName || 'UNKNOWN GALAXY';
            return m.planetName || m.objective || 'TARGET';
        };
        const missionRows = bound.length ? bound.map((m, i) => `
            <li class="profile-story-mission${i === 0 ? ' is-first' : ''}" title="${m.hint || m.objective || ''}">
                <span class="profile-story-mission-idx">${i + 1}</span>
                <span class="profile-story-mission-body">
                    <b>${m.name}</b>
                    <small>${kindLabel(m)} · ${targetLabel(m)}</small>
                </span>
                ${m.difficulty ? `<span class="profile-story-mission-diff">${String(m.difficulty).toUpperCase()}</span>` : ''}
            </li>`).join('') : '<li class="profile-story-mission is-empty">NO MISSIONS ON THIS PATH.</li>';
        return `
            <div class="profile-story-step" data-start-row="mission" style="--story-count:${n}">
                <div class="profile-story-head">
                    <div class="profile-story-profile" title="${kit.text || ''}">
                        <span class="profile-story-profile-art">${this.storyIconHtml(kitIcon, 96)}</span>
                        <span class="profile-story-profile-text">
                            <span class="profile-story-profile-label">START PROFILE</span>
                            <strong class="profile-story-profile-name">${kit.label}</strong>
                            ${kit.text ? `<span class="profile-story-profile-blurb">${kit.text}</span>` : ''}
                        </span>
                    </div>
                    <h2 class="profile-selection-title">CHOOSE YOUR STORY</h2>
                </div>
                <div class="profile-story-layout">
                    <div class="profile-story-list" role="listbox" aria-label="Story paths">${pathList}</div>
                    <div class="profile-story-detail">
                        <div class="profile-story-detail-head">
                            <span class="profile-story-detail-art">${this.storyIconHtml(path.icon, 72)}</span>
                            <div class="profile-story-detail-copy">
                                <h3 class="profile-story-detail-title">${path.title}</h3>
                                <p class="profile-story-detail-blurb">${path.blurb}</p>
                            </div>
                        </div>
                        <ol class="profile-story-missions" aria-label="Missions">${missionRows}</ol>
                    </div>
                </div>
            </div>`;
    },

    bindMissionEvents() {
        if (!this.overlay) return;
        this.overlay.querySelectorAll('.profile-story-card').forEach((card) => {
            card.addEventListener('click', () => {
                this._startOpts.storyPathId = card.getAttribute('data-story-id');
                // Rebuild so the mission strip matches the new path.
                this.createUI();
            });
        });
    },
});
