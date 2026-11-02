"use strict";

/**
 * Per-stage / per-enemy-type soundtrack overrides, layered on top of the
 * per-planet YouTube soundtrack (planetConfigManager) and the procedural
 * ambient drone fallback. Resolution priority (see soundtrack-override.js):
 * active enemy type > current stage > planet > procedural drone.
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

    hasTrack(entry) {
        return !!(entry && (entry.youtubeUrl || entry.localAudioData));
    }

    getStageTrack(stageId) {
        return this.stageTracks[stageId] || null;
    }

    setStageTrack(stageId, data) {
        if (!stageId) return;
        if (!this.hasTrack(data)) {
            delete this.stageTracks[stageId];
        } else {
            this.stageTracks[stageId] = {
                youtubeUrl: data.youtubeUrl || '',
                localAudioData: data.localAudioData || '',
                localAudioName: data.localAudioName || ''
            };
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
            this.menuTrack = {
                youtubeUrl: data.youtubeUrl || '',
                localAudioData: data.localAudioData || '',
                localAudioName: data.localAudioName || ''
            };
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
            this.enemyTracks[enemyTypeId] = {
                youtubeUrl: data.youtubeUrl || '',
                localAudioData: data.localAudioData || '',
                localAudioName: data.localAudioName || ''
            };
        }
        this.save();
    }
}

const soundtrackConfigManager = new SoundtrackConfigManager();
