"use strict";

/**
 * Per-stage / per-enemy-type soundtrack overrides, layered on top of the
 * per-planet YouTube / vftrack soundtrack. Resolution priority
 * (see soundtrack-override.js): active enemy type > current stage >
 * planet YouTube > planet vftrack > procedural drone.
 */
class SoundtrackConfigManager {
    constructor() {
        this.storageKey = 'vf_soundtrack_overrides_v1';
        this.stageTracks = {};
        this.enemyTracks = {};
        this.menuTrack = null;
        this.load();
    }

    load() {
        try {
            const raw = localStorage.getItem(this.storageKey);
            if (!raw) return;
            const data = JSON.parse(raw);
            this.stageTracks = (data && data.stageTracks) || {};
            this.enemyTracks = (data && data.enemyTracks) || {};
            this.menuTrack = (data && data.menuTrack) || null;
        } catch (e) {
            this.stageTracks = {};
            this.enemyTracks = {};
            this.menuTrack = null;
        }
    }

    save() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify({
                stageTracks: this.stageTracks,
                enemyTracks: this.enemyTracks,
                menuTrack: this.menuTrack
            }));
        } catch (e) {
            // Quota exceeded (large local audio as base64) — silently skip persisting.
        }
    }

    _packTrack(data) {
        let trackerData = null;
        if (data && data.trackerData) {
            try {
                trackerData = typeof VFTrackerParse !== 'undefined'
                    ? VFTrackerParse.toCompact(data.trackerData)
                    : data.trackerData;
            } catch (e) {
                trackerData = null;
            }
        }
        return {
            youtubeUrl: (data && data.youtubeUrl) || '',
            localAudioData: (data && data.localAudioData) || '',
            localAudioName: (data && data.localAudioName) || '',
            trackerData
        };
    }

    hasTrack(entry) {
        return !!(entry && (entry.youtubeUrl || entry.localAudioData || entry.trackerData));
    }

    getStageTrack(stageId) {
        return this.stageTracks[stageId] || null;
    }

    setStageTrack(stageId, data) {
        if (!stageId) return;
        if (!this.hasTrack(data)) {
            delete this.stageTracks[stageId];
        } else {
            this.stageTracks[stageId] = this._packTrack(data);
        }
        this.save();
    }

    getMenuTrack() {
        return this.menuTrack;
    }

    setMenuTrack(data) {
        if (!this.hasTrack(data)) {
            this.menuTrack = null;
        } else {
            this.menuTrack = this._packTrack(data);
        }
        this.save();
    }

    getEnemyTrack(enemyTypeId) {
        return this.enemyTracks[enemyTypeId] || null;
    }

    setEnemyTrack(enemyTypeId, data) {
        if (!enemyTypeId) return;
        if (!this.hasTrack(data)) {
            delete this.enemyTracks[enemyTypeId];
        } else {
            this.enemyTracks[enemyTypeId] = this._packTrack(data);
        }
        this.save();
    }
}

const soundtrackConfigManager = new SoundtrackConfigManager();
