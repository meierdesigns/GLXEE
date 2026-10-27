"use strict";

/**
 * Tiny procedural face for the in-stage shopkeeper: idle / happy (after a
 * purchase) / sad (can't afford). No sprite sheet, just pixel rects on a canvas.
 */
class ShopkeeperFace {
    constructor() {
        this.state = 'idle';
        this.timer = 0;
    }

    setState(state, ms) {
        this.state = state;
        this.timer = Math.max(0, Number(ms) || 0);
    }

    update(deltaTime) {
        if (this.timer > 0) {
            this.timer -= deltaTime;
            if (this.timer <= 0) this.state = 'idle';
        }
    }

    /** Draws into a canvas 2D context, filling the whole canvas. */
    render(ctx, w, h) {
        if (!ctx) return;
        const px = Math.max(2, Math.floor(Math.min(w, h) / 16));
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#e8b878';
        ctx.fillRect(w * 0.2, h * 0.15, w * 0.6, h * 0.7);
        const eyeY = this.state === 'happy' ? h * 0.42 : h * 0.4;
        ctx.fillStyle = '#2a1c10';
        if (this.state === 'happy') {
            // Squinting, happy eyes: short horizontal dashes.
            ctx.fillRect(w * 0.3, eyeY, px * 2, px);
            ctx.fillRect(w * 0.62, eyeY, px * 2, px);
        } else if (this.state === 'sad') {
            ctx.fillRect(w * 0.3, eyeY, px, px * 2);
            ctx.fillRect(w * 0.68, eyeY, px, px * 2);
        } else {
            ctx.fillRect(w * 0.3, eyeY, px, px);
            ctx.fillRect(w * 0.68, eyeY, px, px);
        }
        ctx.fillStyle = '#7a3a28';
        if (this.state === 'happy') {
            ctx.fillRect(w * 0.36, h * 0.62, w * 0.28, px);
            ctx.fillRect(w * 0.34, h * 0.58, px, px);
            ctx.fillRect(w * 0.64, h * 0.58, px, px);
        } else if (this.state === 'sad') {
            ctx.fillRect(w * 0.36, h * 0.68, w * 0.28, px);
            ctx.fillRect(w * 0.34, h * 0.64, px, px);
            ctx.fillRect(w * 0.64, h * 0.64, px, px);
        } else {
            ctx.fillRect(w * 0.38, h * 0.64, w * 0.24, px);
        }
    }
}

const shopkeeperFace = new ShopkeeperFace();
window.shopkeeperFace = shopkeeperFace;
