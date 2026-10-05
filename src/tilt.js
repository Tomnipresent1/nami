// Tilt steering maths (pure, so it can be tested in Node).
// The phone reports which way "up" is in its own coordinates: (ux, uy, uz) — flat on a table face-up is (0, 0, +g).
// Held sideways like a steering wheel, turning the phone clockwise should steer RIGHT (positive).

/** Wheel angle in radians (clockwise = positive) from the up vector and the screen angle (0, 90, 180, 270). */
export function wheelAngle(ux, uy, screenAngle) {
  switch (((screenAngle % 360) + 360) % 360) {
    case 90: return Math.atan2(uy, ux);       // landscape, top of the phone to the left
    case 270: return Math.atan2(-uy, -ux);    // landscape, top of the phone to the right
    case 180: return Math.atan2(ux, -uy);     // upside-down portrait
    default: return Math.atan2(-ux, uy);      // portrait
  }
}

/** Up vector from DeviceOrientation angles (degrees), for phones that only report those. */
export function upFromOrientation(beta, gamma) {
  const b = (beta * Math.PI) / 180, g = (gamma * Math.PI) / 180;
  return [-Math.sin(g) * Math.cos(b), Math.sin(b), Math.cos(b) * Math.cos(g)];
}

export const TILT_FULL_LOCK = (30 * Math.PI) / 180;   // 30 degrees of wheel turn = full steering
export const TILT_DEADZONE = 0.04;

/** Turns a wheel angle (minus the calibrated neutral) into a steering value -1..1. */
export function steerFromAngle(angle, neutral, flip = false, fullLock = TILT_FULL_LOCK) {
  let d = angle - neutral;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  let s = Math.max(-1, Math.min(1, d / fullLock));
  if (Math.abs(s) < TILT_DEADZONE) s = 0;
  else s = Math.sign(s) * (Math.abs(s) - TILT_DEADZONE) / (1 - TILT_DEADZONE);
  return flip ? -s : s;
}
