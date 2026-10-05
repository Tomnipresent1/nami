// The sea: where the water surface is, and what a big wave does over its life. Pure maths (no drawing, no sound).
// Picture space is 600 units tall and as wide as the screen needs. y grows DOWN. "Height" is metres-ish above the resting
// sea level, so the surface sits at y = BASE_Y - height. Everything rolls from right to left.

export const VH = 600;          // picture height
export const BASE_Y = 440;      // resting sea level (where the boat floats)
export const HORIZON = 215;     // where sea meets sky

export const smooth = (u) => { u = u < 0 ? 0 : u > 1 ? 1 : u; return u * u * (3 - 2 * u); };
export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// ---- the everyday swell: three gentle sine waves drifting left ----
const SWELL = [[9, 0.011, 0.75, 0], [5, 0.019, 1.25, 1.7], [2.5, 0.034, 1.9, 0.4]];
export function ambient(x, t, scale = 1) {
  let h = 0;
  for (const [a, k, w, p] of SWELL) h += a * Math.sin(k * x + w * t + p);
  return h * scale;
}

// ---- the life of one big wave (seconds since it was born) ----
export const T_CURL_START = 2.4;     // the lip starts to lean forward
export const T_BREAK = 4.5;          // the claws begin to fall
export const T_LAND = 4.9;           // the moment the foam hits the water: this is when you are or aren't in the way
export const T_BREAK_END = 5.6;
export const T_GONE = 9.4;
export const WAVE_SPEED = 62;        // how fast the crest rolls left (units per second)
export const ZONE_FRONT = 160;       // the landing zone reaches this far in front of (left of) the crest...
export const ZONE_BACK = 15;         // ...up to just in front of the crest

/** How tall the wave is now. */
export function waveAmp(w) {
  const t = w.t;
  if (t < 3.0) return w.H * smooth(t / 3.0);
  if (t < T_BREAK_END) return w.H;
  return w.H * (1 - smooth((t - T_BREAK_END) / 3.6));
}
/** How far the lip leans over (0 = not at all, 1 = fully curled). */
export function waveCurl(w) {
  const t = w.t;
  if (t < T_CURL_START) return 0;
  if (t < T_BREAK_END) return smooth((t - T_CURL_START) / 2.1);
  return 1 - smooth((t - T_BREAK_END) / 1.4);
}
/** 0..1 how far the claws have fallen (0 before the break starts). */
export function waveBreak(w) { return smooth((w.t - T_BREAK) / (T_BREAK_END - T_BREAK)); }
export const waveX = (w) => w.xs - WAVE_SPEED * w.t;     // where the crest is now
export function waveZone(w) {                            // the patch of water the foam will land on (fixed in place)
  const xc = w.xs - WAVE_SPEED * T_LAND;
  return [xc - ZONE_FRONT, xc - ZONE_BACK];
}

/** The profile of a big wave: a long gentle back, a steep face. d = x - crest position. */
export function waveHeightAt(w, x) {
  const amp = waveAmp(w);
  if (amp <= 0) return 0;
  const d = x - waveX(w);
  if (d >= 0) return amp * Math.exp(-(d / 250) * (d / 250));
  return amp * (1 - smooth(-d / 200));
}

/** Water height at x: everyday swell plus every big wave that is alive. */
export function surface(waves, x, t) {
  let h = ambient(x, t);
  for (const w of waves) h += waveHeightAt(w, x);
  return h;
}
export function surfaceSlope(waves, x, t) { return (surface(waves, x + 2, t) - surface(waves, x - 2, t)) / 4; }
