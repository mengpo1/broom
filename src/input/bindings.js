// Default control schemes. Keyboard bindings use KeyboardEvent.code so they follow the physical
// key (WASD is ZQSD on an AZERTY keyboard without any change). Everything is remappable per player.

export const ACTIONS = ['steerLeft', 'steerRight', 'throttle', 'brake', 'shiftUp', 'shiftDown', 'boost', 'reset', 'camera', 'pause'];

export const DEFAULT_CONTROLS = [
  {
    device: 'keyboard',
    keys: { steerLeft: 'ArrowLeft', steerRight: 'ArrowRight', throttle: 'ArrowUp', brake: 'ArrowDown', shiftUp: 'ShiftRight', shiftDown: 'ControlRight', boost: 'Space', reset: 'Backspace', camera: 'KeyC', pause: 'Escape' },
    mouseSensitivity: 1,
  },
  {
    device: 'keyboard',
    keys: { steerLeft: 'KeyA', steerRight: 'KeyD', throttle: 'KeyW', brake: 'KeyS', shiftUp: 'KeyE', shiftDown: 'KeyQ', boost: 'KeyF', reset: 'KeyR', camera: 'KeyV', pause: 'KeyP' },
    mouseSensitivity: 1,
  },
];

/** Standard-mapping gamepad layout (not remappable: it follows the W3C standard gamepad). */
export const GAMEPAD_MAP = { throttle: 7, brake: 6, shiftUp: 5, shiftDown: 4, boost: 0, reset: 3, camera: 2, pause: 9, steerAxis: 0, accept: 0, back: 1, up: 12, down: 13, left: 14, right: 15 };

export const DEVICES = ['keyboard', 'mouse', 'gamepad0', 'gamepad1'];

export function cloneControls(controls) {
  return controls.map((c) => ({ device: c.device, keys: { ...c.keys }, mouseSensitivity: c.mouseSensitivity ?? 1 }));
}

/** Language-neutral name of a KeyboardEvent.code (letters, digits, function keys); named keys are in the dictionaries. */
export function keyName(code) {
  if (!code) return '-';
  return code.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad/, 'NUM ').toUpperCase();
}
