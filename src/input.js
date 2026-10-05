// Tilt, slide and keyboard all give one number: steer -1..1 (positive = lean right). Plus menu keys and taps.
// Rock the phone like a boat: turning it clockwise leans right. If the phone gives no sensor data (see the pause screen's
// tilt test) the finger slide works instead: slide left/right anywhere on the screen.
import { wheelAngle, upFromOrientation, steerFromAngle, TILT_FULL_LOCK } from './tilt.js';

// held/py: is a finger (or mouse button) down, and where it is on the screen (client y): Sudden Shower walks you toward it.
// vert: up/down keys (+1 = up).
export const input = { steer: 0, vert: 0, keys: [], start: false, touch: false, held: false, py: 0 };
export const tilt = { ok: false, angle: 0, smooth: 0, neutral: 0, steer: 0, on: false, flip: false, source: '', events: 0, empty: 0,
  secure: typeof isSecureContext === 'boolean' ? isSecureContext : true, fullLock: TILT_FULL_LOCK };

const screenAngle = () => (screen.orientation && typeof screen.orientation.angle === 'number' ? screen.orientation.angle : (typeof window.orientation === 'number' ? (window.orientation + 360) % 360 : 90));
function feedUp(ux, uy) {
  const a = wheelAngle(ux, uy, screenAngle());
  if (!tilt.ok) { tilt.ok = true; tilt.smooth = a; tilt.neutral = a; }
  tilt.angle = a;
}
export function recentreTilt() { tilt.neutral = tilt.smooth; }
export function setSteerMode(on, flip, fullLockDeg) { tilt.on = !!on; tilt.flip = !!flip; tilt.fullLock = (fullLockDeg * Math.PI) / 180; }
export function requestTiltPermission() {
  try { const D = window.DeviceMotionEvent; if (D && typeof D.requestPermission === 'function') D.requestPermission().catch(() => {}); } catch {}
}

const held = new Set();
let pressed = false, slide = 0;
const menuKeys = [];
const MENU = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right', Enter: 'enter', Space: 'enter' };

export function setupInput({ onPause, canvas, onTap } = {}) {
  // ---- tilt sensors ----
  let gotMotion = false;
  addEventListener('devicemotion', (e) => {
    tilt.events++;
    const a = e.accelerationIncludingGravity;
    if (!a || a.x == null || a.y == null || a.z == null || Math.abs(a.x) + Math.abs(a.y) + Math.abs(a.z) < 1) { tilt.empty++; return; }
    gotMotion = true; tilt.source = 'motion'; feedUp(a.x, a.y);
  });
  addEventListener('deviceorientation', (e) => {
    if (gotMotion) return; tilt.events++;
    if (e.beta == null || e.gamma == null) { tilt.empty++; return; }
    tilt.source = 'orientation'; const up = upFromOrientation(e.beta, e.gamma); feedUp(up[0], up[1]);
  });

  // ---- keyboard ----
  addEventListener('keydown', (e) => {
    if ((e.code === 'KeyP' || e.code === 'Escape') && !e.repeat) { onPause && onPause(); return; }
    if (!held.has(e.code)) { pressed = true; if (MENU[e.code]) menuKeys.push(MENU[e.code]); }
    held.add(e.code);
    if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
  });
  addEventListener('keyup', (e) => held.delete(e.code));
  addEventListener('blur', () => held.clear());

  // ---- touch / mouse: a tap, and a finger slide that steers when tilt isn't in use ----
  input.touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  let id = null, ox = 0, moved = 0;
  const RANGE = 90;
  canvas.addEventListener('pointerdown', (e) => {
    pressed = true; onTap && onTap(e);
    if (id !== null) return;
    id = e.pointerId; ox = e.clientX; moved = 0; slide = 0; input.held = true; input.py = e.clientY;
    try { canvas.setPointerCapture(e.pointerId); } catch {}
  });
  canvas.addEventListener('pointermove', (e) => { if (e.pointerId !== id) return; const dx = e.clientX - ox; moved = Math.max(moved, Math.abs(dx)); slide = clamp(dx / RANGE, -1, 1); input.py = e.clientY; });
  const up = (e) => { if (e.pointerId === id) { id = null; slide = 0; input.held = false; } };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
}
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const down = (list) => list.some((c) => held.has(c));

/** Once per step. */
export function pollInput() {
  const kb = (down(['ArrowRight', 'KeyD']) ? 1 : 0) - (down(['ArrowLeft', 'KeyA']) ? 1 : 0);
  let steer = kb;
  if (tilt.on && tilt.ok) {
    let d = tilt.angle - tilt.smooth; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    tilt.smooth += d * 0.3;
    tilt.steer = steerFromAngle(tilt.smooth, tilt.neutral, tilt.flip, tilt.fullLock);
    steer = Math.abs(tilt.steer) > 0 ? tilt.steer : kb;
  } else if (Math.abs(slide) > 0.02) steer = slide;
  input.steer = steer;
  input.vert = (down(['ArrowUp', 'KeyW']) ? 1 : 0) - (down(['ArrowDown', 'KeyS']) ? 1 : 0);
  input.keys = menuKeys.splice(0);
  input.start = pressed; pressed = false;
  return input;
}
