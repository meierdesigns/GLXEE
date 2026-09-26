"use strict";

/**
 * Shared in-game modal dialogs — replaces window.confirm / alert / prompt so
 * every modal wears the app + faction styling and speaks the same keyboard
 * language (←/→/↑/↓ move, ENTER confirm, ESC cancel).
 *
 *   uiDialog.confirm('Delete?').then((ok) => { ... });
 *   uiDialog.alert('Saved.');
 *   uiDialog.prompt('Name', 'Default').then((value) => { ... }); // null = cancelled
 *
 * While open, the dialog swallows keys in the capture phase so the overlay
 * underneath never reacts to them.
 */
class UIDialog {
    constructor() {
        this._active = null;
    }

    get isOpen() {
        return !!this._active;
    }

    confirm(message, opts = {}) {
        return this._open({
            message,
            title: opts.title,
            buttons: [
                { label: opts.okLabel || 'OK', value: true, primary: true, danger: !!opts.danger },
                { label: opts.cancelLabel || 'CANCEL', value: false, cancel: true }
            ]
        });
    }

    alert(message, opts = {}) {
        return this._open({
            message,
            title: opts.title,
            buttons: [{ label: opts.okLabel || 'OK', value: undefined, primary: true, cancel: true }]
        });
    }

    prompt(message, defaultValue = '', opts = {}) {
        return this._open({
            message,
            title: opts.title,
            input: { value: defaultValue == null ? '' : String(defaultValue), maxLength: opts.maxLength },
            buttons: [
                { label: opts.okLabel || 'OK', value: 'input', primary: true },
                { label: opts.cancelLabel || 'CANCEL', value: null, cancel: true }
            ]
        });
    }

    _open(spec) {
        if (this._active) this._active.finish(this._active.cancelValue);
        return new Promise((resolve) => {
            const backdrop = document.createElement('div');
            backdrop.className = 'ui-dialog-backdrop';
            const box = document.createElement('div');
            box.className = 'ui-dialog';
            box.setAttribute('role', 'dialog');
            box.setAttribute('aria-modal', 'true');
            const faction = document.documentElement.getAttribute('data-faction');
            if (faction) box.setAttribute('data-faction', faction);

            if (spec.title) {
                const h = document.createElement('h3');
                h.className = 'ui-dialog-title';
                h.textContent = spec.title;
                box.appendChild(h);
            }
            const msg = document.createElement('p');
            msg.className = 'ui-dialog-message';
            msg.textContent = spec.message == null ? '' : String(spec.message);
            box.appendChild(msg);

            let input = null;
            if (spec.input) {
                input = document.createElement('input');
                input.type = 'text';
                input.className = 'ui-dialog-input';
                input.value = spec.input.value;
                input.autocomplete = 'off';
                input.spellcheck = false;
                if (spec.input.maxLength) input.maxLength = spec.input.maxLength;
                box.appendChild(input);
            }

            const actions = document.createElement('div');
            actions.className = 'ui-dialog-actions';
            let cancelValue;
            const buttons = spec.buttons.map((b) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'action-button' + (b.primary ? '' : ' secondary') + (b.danger ? ' danger' : '');
                btn.textContent = b.label;
                btn.addEventListener('click', () => finish(b.value === 'input' ? input.value : b.value));
                if (b.cancel) cancelValue = b.value;
                actions.appendChild(btn);
                return btn;
            });
            box.appendChild(actions);
            backdrop.appendChild(box);

            const previousFocus = document.activeElement;
            const focusables = input ? [input].concat(buttons) : buttons;
            let focusIdx = 0;
            const focusAt = (i) => {
                focusIdx = (i + focusables.length) % focusables.length;
                focusables.forEach((el, n) => el.classList.toggle('nav-focused', n === focusIdx));
                try { focusables[focusIdx].focus({ preventScroll: true }); } catch (e) { focusables[focusIdx].focus(); }
            };

            const onKey = (e) => {
                const onInput = input && document.activeElement === input;
                if (e.key === 'Escape') {
                    finish(cancelValue);
                } else if (e.key === 'Enter') {
                    const el = focusables[focusIdx];
                    if (onInput || !el || el === input) buttons[0].click();
                    else el.click();
                } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                    if (input) focusAt(e.key === 'ArrowUp' ? 0 : Math.max(1, focusIdx));
                    else focusAt(focusIdx + (e.key === 'ArrowUp' ? -1 : 1));
                } else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !onInput) {
                    const b = buttons.indexOf(focusables[focusIdx]);
                    const nb = (b + (e.key === 'ArrowLeft' ? -1 : 1) + buttons.length) % buttons.length;
                    focusAt(focusables.indexOf(buttons[nb]));
                } else if (e.key === 'Tab') {
                    focusAt(focusIdx + (e.shiftKey ? -1 : 1));
                } else if (onInput) {
                    // Let typing reach the text field, but not the overlays below.
                    e.stopImmediatePropagation();
                    return;
                } else {
                    return;
                }
                e.preventDefault();
                e.stopImmediatePropagation();
            };
            const swallow = (e) => {
                if (e.target && box.contains(e.target)) return;
                e.stopImmediatePropagation();
            };
            backdrop.addEventListener('mousedown', (e) => {
                if (e.target === backdrop) e.preventDefault();
            });

            const finish = (value) => {
                if (!this._active || this._active.box !== box) return;
                window.removeEventListener('keydown', onKey, true);
                window.removeEventListener('keyup', swallow, true);
                backdrop.remove();
                this._active = null;
                if (previousFocus && typeof previousFocus.focus === 'function' && document.contains(previousFocus)) {
                    try { previousFocus.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
                }
                resolve(value);
            };

            this._active = { box, finish, cancelValue };
            window.addEventListener('keydown', onKey, true);
            window.addEventListener('keyup', swallow, true);
            document.body.appendChild(backdrop);
            if (input) {
                focusAt(0);
                input.select();
            } else {
                focusAt(0);
            }
        });
    }
}

const uiDialog = new UIDialog();
window.uiDialog = uiDialog;
