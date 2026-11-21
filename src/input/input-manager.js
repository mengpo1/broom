// Input devices for one or two local players: keyboard, mouse and up to two gamepads, each player
// with its own device and bindings. Produces the same abstract controls for the simulation
// (steer -1..1, throttle, brake, gear shifts, boost, reset) whatever the device, and menu
// navigation events for the interface.

import { clamp } from '../core/math.js';
import { GAMEPAD_MAP, DEFAULT_CONTROLS, cloneControls } from './bindings.js';

const MENU_KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Enter: 'accept', NumpadEnter: 'accept', Space: 'accept', Escape: 'back', Backspace: 'back' };

export class InputManager {
  constructor(target, controls) {
    this.controls = cloneControls(controls || DEFAULT_CONTROLS);
    this.keys = new Set();
    this.pressed = [];            // key codes pressed since the last poll (edges)
    this.menuQueue = [];
    this.mouseX = 0; this.mouseButtons = 0; this.mouseSteer = 0;
    this.capture = null;          // function(code) while the options page waits for a key
    this.onGesture = null;        // called on the first key / click (audio unlock)
    this.onPointer = null;        // function(x, y, type) for menu clicks
    this.padPrev = [new Array(17).fill(false), new Array(17).fill(false)];
    this.padAxisPrev = [0, 0];
    this.edges = [{ shift: 0, reset: false, camera: false, pause: false }, { shift: 0, reset: false, camera: false, pause: false }];
    this.target = target;
    this.enabled = true;
    window.addEventListener('keydown', (e) => this.keyDown(e));
    window.addEventListener('keyup', (e) => { this.keys.delete(e.code); });
    window.addEventListener('blur', () => { this.keys.clear(); this.mouseButtons = 0; });
    target.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === target) this.mouseX += e.movementX;
      else if (this.onPointer) this.onPointer(e.offsetX, e.offsetY, 'move');
    });
    target.addEventListener('mousedown', (e) => {
      this.mouseButtons |= 1 << e.button;
      if (this.onGesture) this.onGesture();
      if (document.pointerLockElement !== target && this.onPointer) this.onPointer(e.offsetX, e.offsetY, 'down');
    });
    target.addEventListener('mouseup', (e) => { this.mouseButtons &= ~(1 << e.button); });
    target.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  keyDown(e) {
    if (this.onGesture) this.onGesture();
    if (this.capture) { const done = this.capture; this.capture = null; done(e.code); e.preventDefault(); return; }
    if (!e.repeat) { this.pressed.push(e.code); }
    this.keys.add(e.code);
    const menu = MENU_KEYS[e.code];
    if (menu) this.menuQueue.push(menu);
    if (e.code.startsWith('Arrow') || e.code === 'Space' || e.code === 'Backspace' || e.code === 'Tab') e.preventDefault();
  }

  setControls(controls) { this.controls = cloneControls(controls); }

  /** Lock the pointer when a player drives with the mouse (relative movement steers). */
  updatePointerLock(playerCount, racing) {
    const wanted = racing && this.controls.slice(0, playerCount).some((c) => c.device === 'mouse');
    if (wanted && document.pointerLockElement !== this.target && this.target.requestPointerLock) {
      const p = this.target.requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    } else if (!wanted && document.pointerLockElement === this.target) document.exitPointerLock();
  }

  gamepad(index) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : null;
    if (!pads) return null;
    let seen = 0;
    for (let i = 0; i < pads.length; i++) {
      const pad = pads[i];
      if (!pad || !pad.connected) continue;
      if (seen === index) return pad;
      seen++;
    }
    return null;
  }

  /** Once per rendered frame: gamepad edges and menu events. */
  poll() {
    for (let g = 0; g < 2; g++) {
      const pad = this.gamepad(g);
      if (!pad) continue;
      const prev = this.padPrev[g];
      const down = (b) => !!(pad.buttons[b] && pad.buttons[b].pressed);
      const edge = (b) => down(b) && !prev[b];
      if (edge(GAMEPAD_MAP.accept)) this.menuQueue.push('accept');
      if (edge(GAMEPAD_MAP.back)) this.menuQueue.push('back');
      if (edge(GAMEPAD_MAP.up)) this.menuQueue.push('up');
      if (edge(GAMEPAD_MAP.down)) this.menuQueue.push('down');
      if (edge(GAMEPAD_MAP.left)) this.menuQueue.push('left');
      if (edge(GAMEPAD_MAP.right)) this.menuQueue.push('right');
      const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
      const dir = Math.abs(ay) > 0.6 ? (ay > 0 ? 2 : 1) : Math.abs(ax) > 0.6 ? (ax > 0 ? 4 : 3) : 0;
      if (dir && dir !== this.padAxisPrev[g]) this.menuQueue.push(['', 'up', 'down', 'left', 'right'][dir]);
      this.padAxisPrev[g] = dir;
      for (let p = 0; p < 2; p++) {
        if (this.controls[p].device !== `gamepad${g}`) continue;
        const e = this.edges[p];
        if (edge(GAMEPAD_MAP.shiftUp)) e.shift = 1;
        if (edge(GAMEPAD_MAP.shiftDown)) e.shift = -1;
        if (edge(GAMEPAD_MAP.reset)) e.reset = true;
        if (edge(GAMEPAD_MAP.camera)) e.camera = true;
        if (edge(GAMEPAD_MAP.pause)) e.pause = true;
      }
      for (let b = 0; b < 17; b++) prev[b] = down(b);
    }
    for (const code of this.pressed) {
      for (let p = 0; p < 2; p++) {
        const c = this.controls[p];
        if (c.device !== 'keyboard' && c.device !== 'mouse') continue;
        const e = this.edges[p], k = c.keys;
        if (code === k.shiftUp) e.shift = 1;
        if (code === k.shiftDown) e.shift = -1;
        if (code === k.reset) e.reset = true;
        if (code === k.camera) e.camera = true;
        if (code === k.pause) e.pause = true;
      }
    }
    this.pressed.length = 0;
  }

  /** Next menu event ('up', 'down', 'left', 'right', 'accept', 'back') or null. */
  nextMenuEvent() { return this.menuQueue.length ? this.menuQueue.shift() : null; }
  clearMenuEvents() { this.menuQueue.length = 0; }

  /** Take (and clear) an edge-triggered action of a player: 'camera' or 'pause'. */
  take(player, name) {
    const e = this.edges[player];
    const v = e[name];
    e[name] = false;
    return v;
  }

  /** Called before each simulation step: feed the players' controls to the race. */
  apply(race) {
    if (!this.enabled) return;
    for (let p = 0; p < 2; p++) {
      if (!race.playerCars[p]) continue;
      const c = this.controls[p], e = this.edges[p];
      let steer = 0, throttle = 0, brake = 0, boost = false;
      if (c.device === 'keyboard' || c.device === 'mouse') {
        const k = c.keys, keys = this.keys;
        if (c.device === 'mouse') {
          // relative mouse steering: the wheel stays where the hand left it, with a gentle return
          this.mouseSteer = clamp(this.mouseSteer + this.mouseX * 0.0042 * c.mouseSensitivity, -1, 1);
          this.mouseX = 0;
          this.mouseSteer *= 0.994;
          steer = this.mouseSteer;
          throttle = this.mouseButtons & 1 || keys.has(k.throttle) ? 1 : 0;
          brake = this.mouseButtons & 4 || keys.has(k.brake) ? 1 : 0;
        } else {
          steer = (keys.has(k.steerRight) ? 1 : 0) - (keys.has(k.steerLeft) ? 1 : 0);
          throttle = keys.has(k.throttle) ? 1 : 0;
          brake = keys.has(k.brake) ? 1 : 0;
        }
        boost = keys.has(k.boost);
      } else {
        const pad = this.gamepad(c.device === 'gamepad1' ? 1 : 0);
        if (pad) {
          const ax = pad.axes[GAMEPAD_MAP.steerAxis] || 0;
          const dead = Math.abs(ax) < 0.08 ? 0 : (Math.abs(ax) - 0.08) / 0.92;
          steer = Math.sign(ax) * dead * dead * (0.4 + 0.6 * dead);
          if (pad.buttons[GAMEPAD_MAP.left] && pad.buttons[GAMEPAD_MAP.left].pressed) steer = -1;
          if (pad.buttons[GAMEPAD_MAP.right] && pad.buttons[GAMEPAD_MAP.right].pressed) steer = 1;
          throttle = pad.buttons[GAMEPAD_MAP.throttle] ? pad.buttons[GAMEPAD_MAP.throttle].value : 0;
          brake = pad.buttons[GAMEPAD_MAP.brake] ? pad.buttons[GAMEPAD_MAP.brake].value : 0;
          boost = !!(pad.buttons[GAMEPAD_MAP.boost] && pad.buttons[GAMEPAD_MAP.boost].pressed);
        }
      }
      race.setPlayerInput(p, steer, throttle, brake, e.shift, boost, e.reset);
      e.shift = 0; e.reset = false;
    }
  }
}
