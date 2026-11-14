"use strict";

// Gamepad support: polls the Gamepad API every frame and feeds the same
// input paths the keyboard already drives (inputHandler.keys in combat,
// synthetic keydown/keyup events everywhere a screen already listens for
// Arrow/Enter/Escape). See js/core/gamepad/combat.js and
// js/core/gamepad/menu-nav.js for the two modes.
class GamepadManager {
    constructor() {
        this.deadzone = 0.35;
        this._running = false;
        this._combatState = {};
        this._menuState = {
            up: { active: false },
            down: { active: false },
            left: { active: false },
            right: { active: false },
            a: false,
            b: false
        };
        this._wasCombat = false;
        // Linux DEs reset idle on keyboard/pointer only — gamepad HID is ignored.
        // Browser Wake Lock is best-effort; the local dev server also exposes
        // /__user-activity (D-Bus SimulateUserActivity) which truly resets idle.
        this._wakeLock = null;
        this._wakeWanted = false;
        this._wakeBusy = false;
        this._wakeNextTry = 0;
        this._wakeVideo = null;
        this._wakeVideoOn = false;
        this._lastActivityPoke = 0;
        this._activityPokeOk = null;
        this._bindDisplayWake();
    }

    start() {
        if (this._running) return;
        this._running = true;
        const tick = () => {
            this.poll();
            requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    }

    /** Drop sticky menu arrows so a held stick cannot keep ArrowRight latched into combat. */
    releaseMenuDirections() {
        this.updateMenuDirection('up', 'ArrowUp', false);
        this.updateMenuDirection('down', 'ArrowDown', false);
        this.updateMenuDirection('left', 'ArrowLeft', false);
        this.updateMenuDirection('right', 'ArrowRight', false);
    }

    /** Clear ship move / fire keys without requiring a prior combat frame. */
    clearShipControlKeys() {
        const g = (typeof window !== 'undefined') ? window.game : null;
        const inputHandler = g && g.inputHandler;
        if (!inputHandler || !inputHandler.keys) return;
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Space',
            'Shift', 'ShiftLeft', 'ShiftRight', 'a', 's', 'd', 'A', 'S', 'D'].forEach((k) => {
            inputHandler.keys[k] = false;
        });
        this._combatState = {};
    }

    /** Sync A/RT edge tracker when "FIRE TO START" appears (avoids a held menu confirm blocking fire). */
    primeMissionStartFire() {
        this.releaseMenuDirections();
        this.clearShipControlKeys();
        if (typeof navigator === 'undefined' || !navigator.getGamepads) {
            this._menuState.a = false;
            return;
        }
        const pads = navigator.getGamepads();
        let held = false;
        for (let i = 0; i < pads.length; i++) {
            if (!pads[i] || !pads[i].connected) continue;
            held = this.isButtonPressed(pads[i], 0) || this.isButtonPressed(pads[i], 7);
            break;
        }
        this._menuState.a = held;
    }

    _bindDisplayWake() {
        if (typeof document === 'undefined') return;
        const self = this;
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && self._wakeWanted) {
                self._wakeNextTry = 0;
                self._acquireDisplayWake();
            } else if (document.visibilityState !== 'visible') {
                self._releaseDisplayWake(true);
            }
        });
        // Gamepad presses are NOT trusted activation — re-arm on real gestures
        // so Chromium/Firefox can actually take the system idle inhibitor.
        const arm = () => {
            if (!self._wakeWanted) return;
            self._wakeNextTry = 0;
            self._acquireDisplayWake();
        };
        ['pointerdown', 'keydown', 'touchstart', 'click'].forEach((ev) => {
            document.addEventListener(ev, arm, true);
        });
    }

    _setWakeWanted(wanted) {
        wanted = !!wanted;
        if (this._wakeWanted === wanted) {
            if (wanted) this._acquireDisplayWake();
            return;
        }
        this._wakeWanted = wanted;
        if (wanted) this._acquireDisplayWake();
        else this._releaseDisplayWake(false);
    }

    _acquireDisplayWake() {
        if (!this._wakeWanted) return;
        if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
        this._acquireWakeLock();
        this._startWakeVideo();
        this._pokeSystemActivity();
    }

    /**
     * Ask the local GLXEE dev server to reset the Linux screensaver/idle timer.
     * No-ops on static hosts (itch.io, python -m http.server) where the route
     * is missing — Wake Lock remains the only option there.
     */
    _pokeSystemActivity() {
        if (typeof fetch !== 'function') return;
        if (this._activityPokeOk === false) return;
        const now = (typeof performance !== 'undefined' && performance.now)
            ? performance.now() : Date.now();
        // Dim timeouts can be ~60s; poke often enough and on first arm.
        if (this._lastActivityPoke && (now - this._lastActivityPoke) < 20000) return;
        this._lastActivityPoke = now;
        const self = this;
        try {
            fetch('/__user-activity', { cache: 'no-store', keepalive: true })
                .then((res) => {
                    if (!res || !res.ok) {
                        self._activityPokeOk = false;
                        return;
                    }
                    self._activityPokeOk = true;
                })
                .catch(() => { self._activityPokeOk = false; });
        } catch (e) {
            this._activityPokeOk = false;
        }
    }

    _releaseDisplayWake(keepWanted) {
        if (!keepWanted) this._wakeWanted = false;
        this._releaseWakeLock();
        this._stopWakeVideo();
    }

    _acquireWakeLock() {
        if (this._wakeBusy || this._wakeLock) return;
        if (typeof navigator === 'undefined' || !navigator.wakeLock || !navigator.wakeLock.request) {
            return;
        }
        const now = (typeof performance !== 'undefined' && performance.now)
            ? performance.now() : Date.now();
        if (now < this._wakeNextTry) return;
        this._wakeBusy = true;
        const self = this;
        navigator.wakeLock.request('screen').then((lock) => {
            self._wakeBusy = false;
            if (!self._wakeWanted
                || (typeof document !== 'undefined'
                    && document.visibilityState !== 'visible')) {
                try { lock.release(); } catch (e) { /* ignore */ }
                return;
            }
            self._wakeLock = lock;
            lock.addEventListener('release', () => {
                if (self._wakeLock === lock) self._wakeLock = null;
                if (self._wakeWanted
                    && typeof document !== 'undefined'
                    && document.visibilityState === 'visible') {
                    self._wakeNextTry = 0;
                    self._acquireWakeLock();
                }
            });
        }).catch(() => {
            self._wakeBusy = false;
            // No activation yet / API blocked — video fallback still runs;
            // retry wake lock after the next trusted gesture or shortly.
            self._wakeNextTry = now + 2500;
        });
    }

    _releaseWakeLock() {
        const lock = this._wakeLock;
        this._wakeLock = null;
        if (!lock) return;
        try { lock.release(); } catch (e) { /* ignore */ }
    }

    /**
     * 1×1 canvas captureStream → muted <video>. Gives Linux compositors a
     * playing-media signal when Screen Wake Lock alone does not inhibit DPMS.
     */
    _ensureWakeVideo() {
        if (this._wakeVideo) return this._wakeVideo;
        if (typeof document === 'undefined') return null;
        let stream = null;
        try {
            const canvas = document.createElement('canvas');
            canvas.width = 1;
            canvas.height = 1;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.fillStyle = '#000';
                ctx.fillRect(0, 0, 1, 1);
            }
            if (typeof canvas.captureStream === 'function') {
                stream = canvas.captureStream(1);
            }
        } catch (e) {
            stream = null;
        }
        if (!stream) return null;
        const v = document.createElement('video');
        v.setAttribute('playsinline', '');
        v.setAttribute('muted', '');
        v.setAttribute('aria-hidden', 'true');
        v.muted = true;
        v.defaultMuted = true;
        v.playsInline = true;
        v.tabIndex = -1;
        v.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;'
            + 'pointer-events:none;bottom:0;left:0;z-index:-1;';
        try {
            v.srcObject = stream;
        } catch (e) {
            return null;
        }
        document.documentElement.appendChild(v);
        this._wakeVideo = v;
        this._wakeCanvasStream = stream;
        return v;
    }

    _startWakeVideo() {
        const v = this._ensureWakeVideo();
        if (!v) return;
        if (!v.paused && this._wakeVideoOn) return;
        this._wakeVideoOn = true;
        const play = v.play();
        if (play && play.catch) {
            play.catch(() => { this._wakeVideoOn = false; });
        }
    }

    _stopWakeVideo() {
        this._wakeVideoOn = false;
        const v = this._wakeVideo;
        if (!v) return;
        try { v.pause(); } catch (e) { /* ignore */ }
    }

    isButtonPressed(gamepad, index) {
        const b = gamepad.buttons[index];
        if (!b) return false;
        // Analog triggers (LT/RT) often expose value without pressed=true.
        if (typeof b === 'number') return b > 0.5;
        if (b.pressed) return true;
        return typeof b.value === 'number' && b.value > 0.5;
    }

    /** Analog stick OR d-pad button, whichever reads "pressed" for that direction. */
    direction(gamepad) {
        const axisX = gamepad.axes[0] || 0;
        const axisY = gamepad.axes[1] || 0;
        return {
            left: this.isButtonPressed(gamepad, 14) || axisX < -this.deadzone,
            right: this.isButtonPressed(gamepad, 15) || axisX > this.deadzone,
            up: this.isButtonPressed(gamepad, 12) || axisY < -this.deadzone,
            down: this.isButtonPressed(gamepad, 13) || axisY > this.deadzone
        };
    }

    /** Combat only while the fight screen owns the frame and isn't paused. */
    isCombatMode() {
        const g = (typeof window !== 'undefined') ? window.game : null;
        if (!g || !g.gameLoop || !g.gameState) return false;
        if (g.gameState.isPaused) return false;
        // Victory/game-over sit on top of the combat surface without
        // hiding it, so isCombatSurfaceActive() stays true there too;
        // route those to menu-style arrow/enter navigation instead.
        if (typeof document !== 'undefined') {
            const victoryOverlay = document.getElementById('victoryOverlay');
            if (victoryOverlay && !victoryOverlay.classList.contains('hidden')) return false;
            const gameOverOverlay = document.getElementById('gameOver');
            if (gameOverOverlay && !gameOverOverlay.classList.contains('hidden')) return false;
        }
        try {
            return g.gameLoop.isCombatSurfaceActive();
        } catch (e) {
            return false;
        }
    }

    poll() {
        if (typeof navigator === 'undefined' || !navigator.getGamepads) return;
        const pads = navigator.getGamepads();
        let gamepad = null;
        for (let i = 0; i < pads.length; i++) {
            if (pads[i] && pads[i].connected) { gamepad = pads[i]; break; }
        }
        if (!gamepad) {
            this._setWakeWanted(false);
            this.resetCombatKeys();
            return;
        }
        // Connected pad + visible tab ⇒ inhibit system display sleep (Linux
        // idle ignores Gamepad API; Wake Lock + silent video cover Chromium/DE).
        this._setWakeWanted(true);
        // "FIRE TO START" lives inside the combat surface (isCombatMode()
        // is already true there) but wants a discrete confirm press like a
        // menu, not held-key combat state, so it's special-cased here.
        if (typeof missionStartManager !== 'undefined' && missionStartManager.isAwaitingFire()) {
            // Stick release must not be skipped here — otherwise menu Arrow* keydowns stick into combat.
            this.releaseMenuDirections();
            const fireHeld = this.isButtonPressed(gamepad, 0) || this.isButtonPressed(gamepad, 7); // A / RT
            if (fireHeld && !this._menuState.a) missionStartManager.onFire();
            this._menuState.a = fireHeld;
            return;
        }
        if (this.isCombatMode()) {
            // Drop the menu HUD frame the moment combat owns the surface.
            if (!this._wasCombat && typeof gamepadCursor !== 'undefined' && gamepadCursor.markPointer) {
                gamepadCursor.markPointer();
            }
            this._wasCombat = true;
            this.updateCombat(gamepad);
        } else {
            const wasCombat = !!this._combatState.any || this._wasCombat;
            this._wasCombat = false;
            this.resetCombatKeys();
            if (wasCombat) {
                // A may still be physically held from firing in combat; sync
                // the menu edge-tracker so this frame isn't read as a fresh
                // press (which would instantly confirm the first menu item,
                // e.g. auto-restarting on the game-over screen).
                this._menuState.a = this.isButtonPressed(gamepad, 0);
            }
            this.updateMenu(gamepad);
        }
    }

    /** Release every key the combat adapter may have set, so an unplugged
     * controller (or leaving combat) never leaves the ship stuck moving/firing. */
    resetCombatKeys() {
        const g = (typeof window !== 'undefined') ? window.game : null;
        const inputHandler = g && g.inputHandler;
        if (!inputHandler || !this._combatState.any) return;
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Space',
            'Shift', 'ShiftLeft', 'ShiftRight', 'a', 's', 'd'].forEach((k) => {
            inputHandler.keys[k] = false;
        });
        this._combatState = {};
    }
}

const gamepadManager = new GamepadManager();
if (typeof window !== 'undefined') {
    window.gamepadManager = gamepadManager;
    gamepadManager.start();
}
