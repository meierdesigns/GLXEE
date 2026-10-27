"use strict";

// GamepadManager menu mapping: every screen outside combat (start screen,
// profile selection, galaxy map, home station, pause menu, modals) already
// listens for real ArrowUp/Down/Left/Right, Enter and Escape keydown events
// on document/window. Rather than rebuild per-screen focus logic, this
// dispatches the same synthetic KeyboardEvents those listeners already
// handle, so D-pad/stick = arrows, A = Enter, B = Escape everywhere a
// keyboard equivalent exists.
//
// One dispatch per press, no auto-repeat: the stick/d-pad must be released
// and pressed again to move further. Holding a direction down must not
// walk through several menu entries - that read as the menu "skipping"
// entries during testing, so repeat-while-held was removed on purpose.
extendClass(GamepadManager, {
    dispatchKey(type, key) {
        const target = (document.activeElement && document.body.contains(document.activeElement))
            ? document.activeElement
            : document.body;
        const event = new KeyboardEvent(type, {
            key,
            code: key,
            bubbles: true,
            cancelable: true
        });
        target.dispatchEvent(event);
    },

    updateMenuDirection(name, key, pressed) {
        const st = this._menuState[name];
        if (pressed && !st.active) {
            st.active = true;
            this.dispatchKey('keydown', key);
        } else if (!pressed && st.active) {
            st.active = false;
            this.dispatchKey('keyup', key);
        }
    },

    updateMenu(gamepad) {
        const dir = this.direction(gamepad);
        this.updateMenuDirection('up', 'ArrowUp', dir.up);
        this.updateMenuDirection('down', 'ArrowDown', dir.down);
        this.updateMenuDirection('left', 'ArrowLeft', dir.left);
        this.updateMenuDirection('right', 'ArrowRight', dir.right);

        const aHeld = this.isButtonPressed(gamepad, 0); // A -> Enter
        if (aHeld && !this._menuState.a) this.dispatchKey('keydown', 'Enter');
        if (!aHeld && this._menuState.a) this.dispatchKey('keyup', 'Enter');
        this._menuState.a = aHeld;

        const bHeld = this.isButtonPressed(gamepad, 1) || this.isButtonPressed(gamepad, 8); // B / Back -> Escape
        if (bHeld && !this._menuState.b) this.dispatchKey('keydown', 'Escape');
        if (!bHeld && this._menuState.b) this.dispatchKey('keyup', 'Escape');
        this._menuState.b = bHeld;
    }
});
