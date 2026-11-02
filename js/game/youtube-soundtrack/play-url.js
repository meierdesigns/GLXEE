"use strict";

// Generic "play this arbitrary URL under this key" entry point, used by
// soundtrack overrides (stage/enemy) that aren't tied to a planet config.
extendClass(YouTubeSoundtrackManager, {
    playUrl(key, url) {
        const videoId = this.extractVideoId(url);
        if (!videoId) {
            if (this.currentKey === key) this.stop();
            return false;
        }
        return this._playVideo(key, videoId, 'custom');
    }
});
